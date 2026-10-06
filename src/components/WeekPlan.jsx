import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { updateTask } from '../features/workspaceSlice'
import { useThisWeek } from '../lib/useThisWeek'
import { allTasks, fmtMins, isMine, minutesOf, openLeaves, weekStartOf, whenOf, ymd } from '../lib/flow'


function BacklogRow({ t, days, isNow, onAssign }) {
    return (
        <li draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
            className="px-3 py-2 border-b border-gray-50 dark:border-zinc-800/60 last:border-0 cursor-grab active:cursor-grabbing">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-gray-900 dark:text-zinc-100 leading-snug">{t.title}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">
                        {t.projectName}{t.due_date && ` · due ${format(new Date(`${t.due_date}T00:00:00`), 'MMM d')}`}
                    </p>
                </div>
                {isNow && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">xPlan Now</span>}
            </div>
            <div className="flex gap-1 mt-1.5">
                {days.map((d, i) => (
                    <button key={i} onClick={() => onAssign(t, d)} title={`Plan for ${format(d, 'EEEE')}`}
                        className="w-6 h-6 rounded text-[11px] text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900">
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

    const mine = useMemo(() => openLeaves(allTasks(projects)).filter((t) => isMine(t, user?.id) && !t.custom_fields?.someday), [projects, user?.id])

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
    const done = async () => {
        try { await markRitual({ planned: weekStartStr }); toast.success(weekKind === 'next' ? 'Next week is planned' : 'Week planned'); navigate('/') }
        catch (e) { toast.error(e.message || 'Could not save') }
    }

    const GROUPS = [['overdue', 'Overdue'], ['carried', 'Carried over'], ['coming', 'Coming up'], ['nodate', 'No date']]
    const weekdays = days.slice(0, 5).concat(days[5])

    return (
        <div>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-gray-900 dark:text-white">
                        Plan {weekKind === 'next' ? 'next week' : 'this week'}
                    </h1>
                    <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">
                        {format(start, 'MMM d')} – {format(addDays(start, 6), 'MMM d')} · drag tasks onto a day, or use the day buttons
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-zinc-800 overflow-hidden text-[13px]">
                        {[['this', 'This week'], ['next', 'Next week']].map(([k, label]) => (
                            <button key={k} onClick={() => onWeekKind(k)}
                                className={`px-3 py-1.5 ${weekKind === k ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-zinc-300'}`}>{label}</button>
                        ))}
                    </div>
                    <button onClick={done} className="px-4 py-2 rounded-lg text-[13px] font-medium bg-emerald-600 text-white">
                        Done planning ({planned})
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <button onClick={() => setShowCap((v) => !v)} className="text-[12px] text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                    Daily capacity {showCap ? '▴' : '▾'}
                </button>
                {showCap && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3">
                        {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                            <label key={dow} className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-zinc-300">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow]}
                                <input type="number" min="0" max="16" step="0.5" defaultValue={prefs.capacity[dow]}
                                    onBlur={(e) => {
                                        const v = Math.max(0, Math.min(16, Number(e.target.value) || 0))
                                        if (v === prefs.capacity[dow]) return
                                        const next = [...prefs.capacity]; next[dow] = v
                                        updatePrefs({ capacity: next }).catch((err) => toast.error(err.message || 'Could not save'))
                                    }}
                                    className="w-14 px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-700 bg-transparent text-[12px]" />h
                            </label>
                        ))}
                        <span className="text-[11px] text-gray-400">hours you can really plan per day, after meetings. 0 turns the warning off. The Weekend column uses Saturday.</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
                <aside className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden lg:max-h-[calc(100vh-220px)] overflow-y-auto">
                    <p className="px-4 py-3 text-[13px] font-semibold text-gray-800 dark:text-zinc-200 border-b border-gray-100 dark:border-zinc-800">Backlog</p>
                    {GROUPS.every(([k]) => backlog[k].length === 0)
                        ? <p className="px-4 py-6 text-[13px] text-gray-500 dark:text-zinc-400">Nothing waiting. Everything assigned to you is planned or parked.</p>
                        : GROUPS.filter(([k]) => backlog[k].length).map(([k, label]) => (
                            <div key={k}>
                                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label} · {backlog[k].length}</p>
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
                        return (
                            <div key={c.key} onDragOver={(e) => { e.preventDefault(); setOver(c.key) }} onDragLeave={() => setOver(null)} onDrop={(e) => onDrop(e, c)}
                                className={`rounded-xl border min-h-[180px] p-2 transition-colors ${over === c.key ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60'}`}>
                                <div className="flex items-baseline justify-between px-1 mb-2">
                                    <p className={`text-[13px] font-semibold ${isToday ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-zinc-200'}`}>
                                        {c.label} <span className="font-normal text-gray-400">{format(c.date, 'd')}</span>
                                    </p>
                                    {mins > 0 && <span className={`text-[11px] tabular-nums ${overCap ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'}`}>{fmtMins(mins)}{cap > 0 && ` / ${fmtMins(cap)}`}</span>}
                                </div>
                                {mins > 0 && cap > 0 && (
                                    <div className="h-1 rounded-full bg-gray-100 dark:bg-zinc-800 mb-2 overflow-hidden">
                                        <div className={`h-full ${overCap ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (mins / cap) * 100)}%` }} />
                                    </div>
                                )}
                                <ul className="space-y-1.5">
                                    {c.tasks.map((t) => (
                                        <li key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                                            className="group rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 cursor-grab active:cursor-grabbing">
                                            <p className="text-[12px] text-gray-900 dark:text-zinc-100 leading-snug">{t.title}</p>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className="text-[10px] text-gray-400 truncate">{t.projectName}</span>
                                                <button onClick={() => setStart(t, null)} className="text-[10px] text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">remove</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    })}
                </div>
            </div>
            <p className="text-[12px] text-gray-400 dark:text-zinc-500 mt-4">
                Planning sets each task's start date. Tasks inside your Pulse auto-send window are sent to Pulse on their own.
            </p>
        </div>
    )
}
