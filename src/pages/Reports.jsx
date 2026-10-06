import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { addDays, endOfDay, format, startOfDay, startOfWeek, subDays } from 'date-fns'
import { Loader2Icon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePulse } from '../context/PulseContext'

const PERIODS = {
    day: { label: 'Day', prevLabel: 'yesterday' },
    week: { label: 'Week', prevLabel: 'last week' },
    month: { label: '30 days', prevLabel: 'the previous 30 days' },
}

// [start, end) for the current and previous period.
function ranges(kind, now = new Date()) {
    if (kind === 'day') {
        const s = startOfDay(now), e = addDays(s, 1)
        return { cur: [s, e], prev: [subDays(s, 1), s] }
    }
    if (kind === 'week') {
        const s = startOfWeek(now, { weekStartsOn: 1 }), e = addDays(s, 7)
        return { cur: [s, e], prev: [subDays(s, 7), s] }
    }
    const e = addDays(startOfDay(now), 1), s = subDays(e, 30)
    return { cur: [s, e], prev: [subDays(s, 30), s] }
}

const inRange = (iso, [s, e]) => iso && new Date(iso) >= s && new Date(iso) < e

function Delta({ cur, prev, label }) {
    const d = cur - prev
    if (prev === 0 && cur === 0) return <span className="text-[12px] text-gray-400">no change vs {label}</span>
    const tone = d > 0 ? 'text-emerald-600 dark:text-emerald-400' : d < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
    return <span className={`text-[12px] ${tone}`}>{d > 0 ? '+' : ''}{d} vs {label}</span>
}

function Tile({ label, value, children }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 shadow-sm">
            <p className="text-[12px] text-gray-500 dark:text-zinc-400">{label}</p>
            <p className="text-[28px] font-bold text-gray-900 dark:text-white tabular-nums leading-tight">{value}</p>
            <div className="mt-0.5">{children}</div>
        </div>
    )
}

// Work only: xPM task completions per project, plus Pulse completions and focus
// time for tasks that are linked to an xPM project. Personal Pulse tasks are
// never read for this.
export default function Reports() {
    const { user, pulse } = useAuth()
    const { links, ready } = usePulse()
    const workspace = useSelector((s) => s.workspace?.currentWorkspace)
    const projects = useMemo(() => workspace?.projects || [], [workspace])
    const [kind, setKind] = useState('week')
    const [scope, setScope] = useState('mine')
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState({ done: [], pulseDone: [], focus: [], initiatives: [] })

    const { cur, prev } = useMemo(() => ranges(kind), [kind])
    const projectIds = useMemo(() => projects.map((p) => p.id), [projects])
    const linkKey = links.map((l) => l.pulse_task_id).join(',')

    useEffect(() => {
        if (!user?.id || projectIds.length === 0) { setLoading(false); return }
        let on = true
        ;(async () => {
            setLoading(true)
            const since = prev[0].toISOString()
            let q = supabase.from('xpm_tasks').select('id, project_id, completed_at, assignee_id')
                .in('project_id', projectIds).eq('status', 'DONE').gte('completed_at', since)
            if (scope === 'mine') q = q.eq('assignee_id', user.id)
            const [{ data: done }, { data: inits }] = await Promise.all([
                q,
                supabase.from('roadmap_initiatives').select('title, xpm_project_id').eq('workspace_id', workspace.id).not('xpm_project_id', 'is', null),
            ])

            let pulseDone = [], focus = []
            if (pulse.enabled && ready) {
                // Linked (work) tasks only.
                const linked = links.filter((l) => l.xpm_project_id)
                const ids = linked.map((l) => l.pulse_task_id)
                const projectByPulse = Object.fromEntries(linked.map((l) => [String(l.pulse_task_id), l.xpm_project_id]))
                if (ids.length) {
                    const [{ data: pts }, { data: sessions }] = await Promise.all([
                        supabase.from('tasks').select('id, completed_at').in('id', ids).gte('completed_at', since),
                        supabase.from('focus_sessions').select('date, duration_mins, task_ids, completed')
                            .eq('user_id', user.id).gte('date', format(prev[0], 'yyyy-MM-dd')),
                    ])
                    pulseDone = (pts || []).map((t) => ({ project_id: projectByPulse[String(t.id)], at: t.completed_at }))
                    for (const s of sessions || []) {
                        if (s.completed === false || !s.task_ids?.length) continue
                        const share = (s.duration_mins || 0) / s.task_ids.length
                        for (const tid of s.task_ids) {
                            const pid = projectByPulse[String(tid)]
                            if (pid) focus.push({ project_id: pid, at: `${s.date}T12:00:00`, mins: share })
                        }
                    }
                }
            }
            if (on) { setData({ done: done || [], pulseDone, focus, initiatives: inits || [] }); setLoading(false) }
        })()
        return () => { on = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, projectIds.join(','), kind, scope, pulse.enabled, ready, linkKey])

    const rows = useMemo(() => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const initByProject = Object.fromEntries(data.initiatives.map((i) => [i.xpm_project_id, i.title]))
        const parents = new Set(projects.flatMap((p) => p.tasks || []).map((t) => t.parent_task_id).filter(Boolean))
        return projects.map((p) => {
            const done = data.done.filter((t) => t.project_id === p.id)
            const overdue = (p.tasks || []).filter((t) =>
                !t.archived_at && t.status !== 'DONE' && !parents.has(t.id) && t.due_date && t.due_date < today
                && (scope === 'all' || t.assignee_id === user?.id)).length
            const mins = (range) => Math.round(data.focus.filter((f) => f.project_id === p.id && inRange(f.at, range)).reduce((a, f) => a + f.mins, 0))
            return {
                id: p.id, name: p.name, initiative: initByProject[p.id],
                done: done.filter((t) => inRange(t.completed_at, cur)).length,
                donePrev: done.filter((t) => inRange(t.completed_at, prev)).length,
                pulseDone: data.pulseDone.filter((t) => t.project_id === p.id && inRange(t.at, cur)).length,
                focus: mins(cur), focusPrev: mins(prev), overdue,
            }
        }).filter((r) => r.done || r.donePrev || r.pulseDone || r.focus || r.overdue)
          .sort((a, b) => b.done - a.done || b.focus - a.focus)
    }, [data, projects, cur, prev, scope, user?.id])

    const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
    const hours = (m) => `${(m / 60).toFixed(1)}h`
    const prevLabel = PERIODS[kind].prevLabel
    const rangeText = kind === 'day' ? format(cur[0], 'EEE MMM d') : `${format(cur[0], 'MMM d')} – ${format(subDays(endOfDay(cur[1]), 1), 'MMM d')}`

    return (
        <div className="max-w-[1100px] mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">Reports</h1>
                    <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">{rangeText} · compared with {prevLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden text-[13px]">
                        {['mine', 'all'].map((s) => (
                            <button key={s} onClick={() => setScope(s)}
                                className={`px-3 py-1.5 ${scope === s ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-zinc-300'}`}>
                                {s === 'mine' ? 'Mine' : 'Everyone'}
                            </button>
                        ))}
                    </div>
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden text-[13px]">
                        {Object.entries(PERIODS).map(([k, v]) => (
                            <button key={k} onClick={() => setKind(k)}
                                className={`px-3 py-1.5 ${kind === k ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-zinc-300'}`}>
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader2Icon className="size-5 animate-spin text-zinc-400" /></div>
            ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-zinc-800 py-14 text-center">
                    <p className="text-[14px] font-medium text-gray-700 dark:text-zinc-200">Nothing to report for this period</p>
                    <p className="text-[13px] text-gray-400 dark:text-zinc-500 mt-1">Completed tasks and focus time on linked work show up here.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <Tile label="Tasks completed" value={sum('done')}><Delta cur={sum('done')} prev={sum('donePrev')} label={prevLabel} /></Tile>
                        {pulse.enabled && (
                            <Tile label="Focused on work" value={hours(sum('focus'))}>
                                <span className="text-[12px] text-gray-400">{sum('focusPrev') ? `${hours(sum('focusPrev'))} ${prevLabel}` : `none ${prevLabel}`}</span>
                            </Tile>
                        )}
                        <Tile label="Overdue now" value={sum('overdue')}><span className="text-[12px] text-gray-400">across these projects</span></Tile>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="text-left text-[12px] text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                    <th className="px-5 py-3 font-medium">Project</th>
                                    <th className="px-3 py-3 font-medium text-right">Completed</th>
                                    <th className="px-3 py-3 font-medium text-right">vs {prevLabel}</th>
                                    {pulse.enabled && <th className="px-3 py-3 font-medium text-right">Done in Pulse</th>}
                                    {pulse.enabled && <th className="px-3 py-3 font-medium text-right">Focus</th>}
                                    <th className="px-5 py-3 font-medium text-right">Overdue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id} className="border-b border-gray-50 dark:border-zinc-800/60 last:border-0">
                                        <td className="px-5 py-3">
                                            <p className="text-gray-900 dark:text-zinc-100 font-medium">{r.name}</p>
                                            {r.initiative && <p className="text-[12px] text-gray-400">xPlan · {r.initiative}</p>}
                                        </td>
                                        <td className="px-3 py-3 text-right tabular-nums">{r.done}</td>
                                        <td className="px-3 py-3 text-right"><Delta cur={r.done} prev={r.donePrev} label="" /></td>
                                        {pulse.enabled && <td className="px-3 py-3 text-right tabular-nums text-violet-600 dark:text-violet-400">{r.pulseDone || '–'}</td>}
                                        {pulse.enabled && <td className="px-3 py-3 text-right tabular-nums">{r.focus ? hours(r.focus) : '–'}</td>}
                                        <td className={`px-5 py-3 text-right tabular-nums ${r.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'}`}>{r.overdue || '–'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {pulse.enabled && (
                        <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-3">
                            Pulse numbers cover only tasks linked to an xPM project. “Done in Pulse” overlaps with Completed when completion syncs back, so don't add them.
                        </p>
                    )}
                </>
            )}
        </div>
    )
}
