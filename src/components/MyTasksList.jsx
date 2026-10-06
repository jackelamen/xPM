import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { format, isToday, subDays } from 'date-fns'
import { ChevronRightIcon, CircleIcon, CheckCircle2Icon, ZapIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePulse } from '../context/PulseContext'
import { scheduleText } from '../lib/pulse'
import { updateTask } from '../features/workspaceSlice'
import { BUCKETS, allTasks, bucketOf, day, isMine, openLeaves, whenOf, ymd } from '../lib/flow'
import { CaptureButton } from './QuickCapture'
import TaskPanel from './TaskPanel'
import Tooltip from './Tooltip'

const EMPTY_TEXT = {
    overdue: 'Nothing overdue.',
    today: 'Nothing for today.',
    week: 'Nothing else this week.',
    later: 'Nothing scheduled further out.',
    nodate: 'Everything has a date.',
    someday: 'Nothing parked.',
}

function When({ date, due }) {
    if (!date) return null
    const d = day(date)
    const today = ymd(new Date())
    if (due && due < today) return <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">Overdue · {format(day(due), 'MMM d')}</span>
    if (isToday(d)) return <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">Today</span>
    return <span className="text-[12px] text-gray-500 dark:text-zinc-400">{format(d, 'EEE MMM d')}</span>
}

function Row({ t, onOpen, onToggle, pulse }) {
    const done = t.status === 'DONE'
    const st = pulse.enabled ? pulse.byXpmTask.get(t.id) : null
    const inPulse = st || t.custom_fields?.sent_to_pulse
    return (
        <li className="group flex items-center gap-3 px-4 py-2 border-b border-gray-50 dark:border-zinc-800/60 last:border-0 hover:bg-gray-50/70 dark:hover:bg-zinc-800/30">
            <Tooltip label={done ? 'Mark not done' : 'Mark done'} side="right">
                <button onClick={() => onToggle(t)} aria-label={done ? 'Mark not done' : 'Mark done'}
                    className={done ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-emerald-500'}>
                    {done ? <CheckCircle2Icon size={18} strokeWidth={1.75} /> : <CircleIcon size={18} strokeWidth={1.75} />}
                </button>
            </Tooltip>
            <button onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
                <span className={`text-[14px] ${done ? 'line-through text-zinc-400' : 'text-gray-900 dark:text-zinc-100'}`}>{t.title}</span>
                <span className="ml-2 text-[12px] text-gray-400 dark:text-zinc-500">{t.projectName}</span>
            </button>
            {pulse.enabled && inPulse && (
                <Tooltip label={st?.pulseTask ? `In Pulse · ${st.location?.label || ''}\n${scheduleText(st.pulseTask)}` : 'Sent to Pulse'}>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                        <ZapIcon className="size-3" fill="currentColor" />{st?.location?.label || 'In Pulse'}
                    </span>
                </Tooltip>
            )}
            <When date={whenOf(t)} due={t.due_date} />
        </li>
    )
}

// My Tasks as a plain list. Sections come from each task's dates, so there's
// nothing to organise by hand.
export default function MyTasksList() {
    const { user } = useAuth()
    const dispatch = useDispatch()
    const pulse = usePulse()
    const projects = useSelector((s) => s.workspace?.currentWorkspace?.projects || [])
    const [selected, setSelected] = useState(null)
    const [collapsed, setCollapsed] = useState({ someday: true, waiting: true, done: true })

    const { sections, waiting, doneRecent, total } = useMemo(() => {
        const all = allTasks(projects)
        const open = openLeaves(all)
        const mine = open.filter((t) => isMine(t, user?.id))
        const now = new Date()
        const byWhen = (a, b) => (whenOf(a) || '9999').localeCompare(whenOf(b) || '9999')
        const by = Object.fromEntries(BUCKETS.map((b) => [b.key, []]))
        for (const t of mine) by[bucketOf(t, now)].push(t)
        for (const k of Object.keys(by)) by[k].sort(byWhen)
        const cutoff = subDays(now, 7).toISOString()
        return {
            sections: by,
            total: mine.length,
            waiting: open.filter((t) => t.created_by === user?.id && t.assignee_id && !isMine(t, user?.id)).sort(byWhen),
            doneRecent: all.filter((t) => t.status === 'DONE' && isMine(t, user?.id) && t.completed_at && t.completed_at > cutoff)
                .sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
        }
    }, [projects, user?.id])

    const toggle = (t) => dispatch(updateTask({ taskId: t.id, projectId: t.projectId, fields: { status: t.status === 'DONE' ? 'TODO' : 'DONE' } }))
        .unwrap().catch((e) => toast.error(e || 'Could not update'))

    const list = [
        ...BUCKETS.map((b) => ({ key: b.key, label: b.label, items: sections[b.key] })),
        { key: 'waiting', label: 'Waiting on others', items: waiting },
        { key: 'done', label: 'Done this week', items: doneRecent },
    ]
    const alwaysOpen = new Set(['today'])

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-end justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-gray-900 dark:text-white">My Tasks</h1>
                    <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">{total} open</p>
                </div>
                <CaptureButton label="Add task" />
            </div>

            <div className="space-y-5">
                {list.map(({ key, label, items }) => {
                    // Empty sections are hidden, except Today, so the day always has an answer.
                    if (items.length === 0 && !alwaysOpen.has(key)) return null
                    const isCollapsed = collapsed[key] && !alwaysOpen.has(key)
                    return (
                        <section key={key} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                            <button onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
                                className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-zinc-800 text-left">
                                <ChevronRightIcon className={`size-3.5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                <span className={`text-[14px] font-semibold ${key === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-zinc-200'}`}>{label}</span>
                                <span className="text-[12px] text-gray-400 tabular-nums">{items.length}</span>
                            </button>
                            {!isCollapsed && (items.length === 0
                                ? <p className="px-4 py-4 text-[13px] text-gray-500 dark:text-zinc-400">{EMPTY_TEXT[key]}</p>
                                : <ul>{items.map((t) => <Row key={t.id} t={t} pulse={pulse} onToggle={toggle} onOpen={(x) => setSelected({ taskId: x.id, projectId: x.projectId })} />)}</ul>)}
                        </section>
                    )
                })}
            </div>

            {selected && <TaskPanel taskId={selected.taskId} projectId={selected.projectId} onClose={() => setSelected(null)} />}
        </div>
    )
}
