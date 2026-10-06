import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { updateTask } from '../features/workspaceSlice'
import { useThisWeek } from '../lib/useThisWeek'
import { allTasks, fmtMins, isMine, minutesOf, openLeaves, weekStartOf, whenOf, ymd } from '../lib/flow'

const Dot = ({ color }) => <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: color || '#6489b3' }} />

function BacklogRow({ t, days, isNow, onAssign }) {
    return (
        <li draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
            className="px-4 py-2.5 border-b border-gray-100 dark:border-zinc-800/70 last:border-0 cursor-grab active:cursor-grabbing hover:bg-gray-50 dark:hover:bg-zinc-800/40">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-gray-900 dark:text-zinc-100 leading-snug">{t.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-zinc-500 min-w-0">
                        <Dot color={t.projectColor} /><span className="truncate">{t.projectName}</span>
                        {t.due_date && <span className="flex-shrink-0">· due {format(new Date(`${t.due_date}T00:00:00`), 'MMM d')}</span>}
                    </p>
                </div>
                {isNow && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-signal-500/20 text-signal-700 dark:text-signal-400">Now</span>}
            </div>
            <div className="flex gap-1 mt-2">
                {days.map((d, i) => (
                    <button key={i} onClick={() => onAssign(t, d)} title={`Plan for ${format(d, 'EEEE')}`}
                        className="w-7 h-7 rounded-md text-[12px] font-medium text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hover:bg-signal-500 hover:border-signal-500 hover:text-ink-950 transition-colors">
                        {format(d, 'EEEEE')}
                    </button>
                ))}
            </div>
        </li>
    )
}

export default function WeekPlan({ weekKind, onWeekKind }) {
    const { user, markRitual, prefs, updatePrefs } = useAuth()
    const [showCap, setShowCap] = useState(false)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const workspace = useSelector((s) => s.workspace?.currentWorkspace)
    const projects = useMemo(() => workspace?.projects || [], [workspace])
    const { rows } = useThisWeek(workspace?.id)
    const [over, setOver] = useState(null)

    const nowProjects = useMemo(() => new Set((rows || []).filter((r) => r.horizon === 'now' && r.xpm_project_id).map((r) => r.xpm_project_id)), [rows])

    const start = addDays(weekStartOf(), weekKind === 'next' ? 7 : 0)
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
    const weekStartStr = ymd(start), weekEndStr = ymd(addDays(start, 6)), todayStr = ymd(new Date())

    const mine = useMemo(() => {
        const colors = Object.fromEntries(projects.map((p) => [p.id, p.color]))
        return openLeaves(allTasks(projects).map((t) => ({ ...t, projectColor: colors[t.projectId] })))
            .filter((t) => isMine(t, user?.id) && !t.custom_fields?.someday)
    }, [projects, user?.id])

    const { columns, backlog } = useMemo(() => {
        const cols = days.slice(0, 5).map((d) => ({ date: d, key: ymd(d), label: format(d, 'EEE'), tasks: [] }))
        const weekend = { date: days[5], key: ymd(days[5]), label: 'Weekend', tasks: [] }
        cols.push(weekend)
        const groups = { overdue: [], nodate: [], carried: [], coming: [] }
        const horizon = ymd(addDays(start, 6 + 28))
        for (const t of mine) {
            const w = whenOf(t)
            if (t.due_date && t.due_date < todayStr && !(w && w >= weekStartStr)) { groups.overdue.push(t); continue }
            if (!w) { groups.nodate.push(t); continue }
            if (w >= weekStartStr && w <= weekEndStr) {
                const col = cols.find((c) => c.key === w) || weekend
                col.tasks.push(t); continue
            }
            if (w < weekStartStr) groups.carried.push(t)
            else if (w <= horizon) groups.coming.push(t)
        }
        const nowFirst = (a, b) => (nowProjects.has(b.projectId) ? 1 : 0) - (nowProjects.has(a.projectId) ? 1 : 0)
        for (const g of Object.values(groups)) g.sort(nowFirst)
        return { columns: cols, backlog: groups }
    }, [mine, days, nowProjects, todayStr, weekStartStr, weekEndStr]) // eslint-disable-line react-hooks/exhaustive-deps

    const setStart = (t, date) =>
        dispatch(updateTask({ taskId: t.id, projectId: t.projectId, fields: { start_date: date ? ymd(date) : null } }))
            .unwrap().catch((e) => toast.error(e || 'Could not plan that task'))

    const onDrop = (e, col) => {
        e.preventDefault(); setOver(null)
        const t = mine.find((x) => x.id === e.dataTransfer.getData('text/plain'))
        if (t) setStart(t, col.date)
    }

    const planned = columns.reduce((n, c) => n + c.tasks.length, 0)
    const plannedMins = columns.reduce((n, c) => n + c.tasks.reduce((m, t) => m + minutesOf(t), 0), 0)
    // Open time only counts days that are still ahead.
    const openMins = columns.reduce((n, c) => {
        const cap = (prefs.capacity[c.date.getDay()] || 0) * 60
        const used = c.tasks.reduce((m, t) => m + minutesOf(t), 0)
        return c.key >= todayStr && cap > 0 ? n + Math.max(cap - used, 0) : n
    }, 0)

    const done = async () => {
        try { await markRitual({ planned: weekStartStr }); toast.success(weekKind === 'next' ? 'Next week is planned' : 'Week planned'); navigate('/') }
        catch (e) { toast.error(e.message || 'Could not save') }
    }

    const GROUPS = [['overdue', 'Overdue', 'bg-red-500'], ['carried', 'Carried over', 'bg-signal-500'], ['coming', 'Coming up', 'bg-ink-400'], ['nodate', 'No date', 'bg-gray-300']]
    const weekdays = days.slice(0, 5).concat(days[5])

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-none text-ink-900 dark:text-white">
                        {weekKind === 'next' ? 'Next week' : 'This week'}
                    </h1>
                    <p className="mt-2 text-[15px] text-gray-500 dark:text-zinc-400">
                        {format(start, 'MMM d')} – {format(addDays(start, 6), 'MMM d')}
                        <span className="mx-2 text-gray-300">·</span>
                        <span className="font-semibold text-gray-800 dark:text-zinc-200">{fmtMins(plannedMins) || '0m'}</span> planned
                        {openMins > 0 && <><span className="mx-2 text-gray-300">·</span><span className="font-semibold text-gray-800 dark:text-zinc-200">{fmtMins(openMins)}</span> still open</>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-0.5 text-[14px]">
                        {[['this', 'This week'], ['next', 'Next week']].map(([k, label]) => (
                            <button key={k} onClick={() => onWeekKind(k)}
                                className={`px-3.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${weekKind === k ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-950' : 'text-gray-600 dark:text-zinc-300 hover:text-gray-900'}`}>{label}</button>
                        ))}
                    </div>
                    <button onClick={done} className="px-5 py-2.5 rounded-lg text-[15px] font-semibold bg-signal-500 hover:bg-signal-400 text-ink-950 transition-colors whitespace-nowrap">
                        Done planning · {planned}
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <button onClick={() => setShowCap((v) => !v)} className="text-[13px] text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                    Daily capacity {showCap ? '▴' : '▾'}
                </button>
                {showCap && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
                        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                            <label key={dow} className="flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-zinc-300">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]}
                                <input type="number" min="0" max="16" step="0.5" defaultValue={prefs.capacity[dow]}
                                    onBlur={(e) => {
                                        const v = Math.max(0, Math.min(16, Number(e.target.value) || 0))
                                        if (v === prefs.capacity[dow]) return
                                        const next = [...prefs.capacity]; next[dow] = v
                                        updatePrefs({ capacity: next }).catch((err) => toast.error(err.message || 'Could not save'))
                                    }}
                                    className="w-14 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 bg-transparent text-[13px]" />h
                            </label>
                        ))}
                        <span className="text-[12px] text-gray-400">hours you can really plan per day, after meetings. 0 turns the warning off. The Weekend column uses Saturday.</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
                <aside className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden lg:max-h-[calc(100vh-240px)] overflow-y-auto">
                    <h2 className="px-4 pt-4 pb-2 text-[18px] font-semibold text-gray-900 dark:text-white">Backlog</h2>
                    {GROUPS.every(([k]) => backlog[k].length === 0)
                        ? <p className="px-4 pb-5 text-[14px] text-gray-500 dark:text-zinc-400">Nothing waiting. Everything assigned to you is planned or parked.</p>
                        : GROUPS.filter(([k]) => backlog[k].length).map(([k, label, dot]) => (
                            <div key={k}>
                                <p className="flex items-center gap-2 px-4 pt-3 pb-1 text-[13px] font-semibold text-gray-600 dark:text-zinc-300">
                                    <span className={`size-2 rounded-full ${dot}`} />{label}
                                    <span className="font-normal text-gray-400">{backlog[k].length}</span>
                                </p>
                                <ul>{backlog[k].map((t) => <BacklogRow key={t.id} t={t} days={weekdays} isNow={nowProjects.has(t.projectId)} onAssign={setStart} />)}</ul>
                            </div>
                        ))}
                </aside>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 content-start">
                    {columns.map((c) => {
                        const mins = c.tasks.reduce((n, t) => n + minutesOf(t), 0)
                        const cap = (prefs.capacity[c.date.getDay()] || 0) * 60 // 0 means no limit set
                        const overCap = cap > 0 && mins > cap
                        const isToday = c.key === todayStr
                        const past = c.key < todayStr
                        const isDrop = over === c.key
                        return (
                            <div key={c.key} onDragOver={(e) => { e.preventDefault(); setOver(c.key) }} onDragLeave={() => setOver(null)} onDrop={(e) => onDrop(e, c)}
                                className={`rounded-2xl overflow-hidden flex flex-col min-h-[260px] transition-all ${past ? 'opacity-55' : ''} ${
                                    isDrop ? 'ring-2 ring-signal-500 bg-signal-500/10'
                                        : isToday ? 'bg-ink-900 text-white'
                                        : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800'}`}>
                                <div className="px-3.5 pt-3.5 pb-3">
                                    <div className="flex items-baseline justify-between">
                                        <p className={`text-[13px] font-medium ${isToday ? 'text-ink-200' : 'text-gray-500 dark:text-zinc-400'}`}>{c.label}</p>
                                        {isToday && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-signal-500 text-ink-950">Today</span>}
                                    </div>
                                    <p className={`font-display font-bold text-[38px] leading-none mt-0.5 tabular-nums ${isToday ? 'text-signal-500' : 'text-ink-900 dark:text-white'}`}>{format(c.date, 'd')}</p>
                                    <p className={`mt-2 text-[12px] tabular-nums ${overCap ? 'font-semibold text-red-500' : isToday ? 'text-ink-300' : 'text-gray-400'}`}>
                                        {cap > 0
                                            ? (overCap ? `${fmtMins(mins - cap)} over` : `${fmtMins(cap - mins)} free`)
                                            : mins > 0 ? fmtMins(mins) : 'open'}
                                    </p>
                                    {cap > 0 && (
                                        <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${isToday ? 'bg-white/15' : 'bg-gray-100 dark:bg-zinc-800'}`}>
                                            <div className={`h-full rounded-full ${overCap ? 'bg-red-500' : 'bg-signal-500'}`} style={{ width: `${Math.min(100, (mins / cap) * 100)}%` }} />
                                        </div>
                                    )}
                                </div>
                                <ul className="px-2 pb-2 space-y-1.5 flex-1">
                                    {c.tasks.map((t) => (
                                        <li key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                                            style={{ borderLeftColor: t.projectColor || '#6489b3' }}
                                            className="group rounded-lg border-l-[3px] bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 px-2.5 py-2 shadow-sm shadow-ink-950/5 cursor-grab active:cursor-grabbing">
                                            <p className="text-[13px] font-medium leading-snug">{t.title}</p>
                                            <div className="flex items-center justify-between mt-1 gap-2">
                                                <span className="text-[11px] text-gray-400 truncate">{t.projectName} · {fmtMins(minutesOf(t))}</span>
                                                <button onClick={() => setStart(t, null)} className="text-[11px] text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">remove</button>
                                            </div>
                                        </li>
                                    ))}
                                    {c.tasks.length === 0 && (
                                        <li className={`rounded-lg border border-dashed px-2.5 py-4 text-center text-[12px] ${isDrop ? 'border-signal-500 text-signal-700' : isToday ? 'border-white/20 text-ink-300' : 'border-gray-200 dark:border-zinc-700 text-gray-400'}`}>
                                            {isDrop ? 'Drop to plan' : 'Nothing planned'}
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )
                    })}
                </div>
            </div>
            <p className="text-[13px] text-gray-400 dark:text-zinc-500 mt-5">
                Planning sets each task's start date. Tasks inside your Pulse auto-send window are sent to Pulse on their own.
            </p>
        </div>
    )
}
