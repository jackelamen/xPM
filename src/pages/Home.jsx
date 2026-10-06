import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { addDays, format, isToday } from 'date-fns'
import { AlertTriangleIcon, CalendarClockIcon, HourglassIcon, InboxIcon, ZapIcon, CalendarOffIcon, ArrowUpRightIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePulse } from '../context/PulseContext'
import { patchTask, setTaskAssignees, updateTask } from '../features/workspaceSlice'
import { sendTaskToPulse } from '../lib/pulse'
import { useInbox } from '../context/InboxContext'
import { bucketOf, nextStep, whenOf } from '../lib/flow'
import { XPlanThisWeekCard } from '../components/XPlanThisWeek'
import { CaptureButton } from '../components/QuickCapture'
import CreateProjectDialog from '../components/CreateProjectDialog'
import TaskPanel from '../components/TaskPanel'

const SOON_DAYS = 7
const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const parseDay = (d) => new Date(`${d}T00:00:00`)

function Card({ icon, tone, title, count, action, children }) {
    const Icon = icon
    return (
        <section className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                <Icon className={`size-4 ${tone}`} />
                <h3 className="text-[14px] font-semibold text-gray-800 dark:text-zinc-200">{title}</h3>
                {count != null && <span className="text-[12px] text-gray-400 tabular-nums">{count}</span>}
                <div className="ml-auto">{action}</div>
            </div>
            {children}
        </section>
    )
}

const Empty = ({ children }) => <p className="px-5 py-5 text-[13px] text-gray-500 dark:text-zinc-400">{children}</p>

function DueLabel({ date }) {
    if (!date) return <span className="text-[12px] text-gray-400">no date</span>
    const d = parseDay(date)
    if (date < todayStr()) return <span className="text-[12px] font-semibold text-red-600 dark:text-red-400">Overdue · {format(d, 'MMM d')}</span>
    if (isToday(d)) return <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">Today</span>
    return <span className="text-[12px] text-gray-500 dark:text-zinc-400">{format(d, 'EEE MMM d')}</span>
}

function PulseChip({ task, byXpmTask, enabled }) {
    if (!enabled) return null
    const st = byXpmTask.get(task.id)
    const linked = st || task.custom_fields?.sent_to_pulse
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${linked ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-zinc-500'}`}>
            <ZapIcon className="size-3" fill={linked ? 'currentColor' : 'none'} />
            {st?.location ? st.location.label : linked ? 'In Pulse' : 'Not in Pulse'}
        </span>
    )
}

function TaskLine({ task, onOpen, children }) {
    return (
        <li className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-50 dark:border-zinc-800/60 last:border-0 hover:bg-gray-50/70 dark:hover:bg-zinc-800/30">
            <button onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
                <p className="text-[14px] text-gray-900 dark:text-zinc-100 truncate">{task.title}</p>
                <p className="text-[12px] text-gray-400 dark:text-zinc-500 truncate">{task.projectName}</p>
            </button>
            {children}
        </li>
    )
}

export default function Home() {
    const { user, displayName, pulse, rituals } = useAuth()
    const inbox = useInbox()
    const dispatch = useDispatch()
    const { byXpmTask, needsReview, enabled: pulseEnabled, reload } = usePulse()
    const workspace = useSelector((s) => s.workspace?.currentWorkspace)
    const projects = useMemo(() => workspace?.projects || [], [workspace])
    const [selected, setSelected] = useState(null)
    const [showNewProject, setShowNewProject] = useState(false)
    const [sending, setSending] = useState(false)

    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    const { overdue, todayTasks, weekTasks, noDate, waiting, unsent, inPulseCounts } = useMemo(() => {
        const all = projects.flatMap((p) => (p.tasks || []).map((t) => ({ ...t, projectId: p.id, projectName: p.name, pulseTag: p.pulse_tag || null })))
        const parents = new Set(all.map((t) => t.parent_task_id).filter(Boolean))
        const open = all.filter((t) => !t.archived_at && t.status !== 'DONE' && !parents.has(t.id))
        const isMine = (t) => t.assignee_id === user?.id || (t.assignees || []).some((a) => a?.id === user?.id)
        const mine = open.filter(isMine)
        const today = todayStr()
        const soonEnd = format(addDays(new Date(), SOON_DAYS), 'yyyy-MM-dd')
        const byDue = (a, b) => (a.due_date || '').localeCompare(b.due_date || '')

        const overdueT = mine.filter((t) => t.due_date && t.due_date < today).sort(byDue)
        const soonT = mine.filter((t) => t.due_date && t.due_date >= today && t.due_date <= soonEnd).sort(byDue)
        const counts = { today: 0, upcoming: 0, anytime: 0, someday: 0, inbox: 0 }
        for (const t of mine) { const k = byXpmTask.get(t.id)?.location?.key; if (k && counts[k] !== undefined) counts[k]++ }
        const now = new Date()
        const byWhen = (a, b) => (whenOf(a) || '').localeCompare(whenOf(b) || '')
        return {
            overdue: overdueT,
            soon: soonT,
            todayTasks: mine.filter((t) => bucketOf(t, now) === 'today').sort(byWhen),
            weekTasks: mine.filter((t) => bucketOf(t, now) === 'week').sort(byWhen),
            noDate: mine.filter((t) => !t.due_date && !t.start_date && !t.custom_fields?.someday),
            waiting: open.filter((t) => t.created_by === user?.id && t.assignee_id && t.assignee_id !== user?.id)
                .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')),
            unsent: [...overdueT, ...soonT].filter((t) => !t.custom_fields?.sent_to_pulse && !byXpmTask.has(t.id) && !t.custom_fields?.someday),
            inPulseCounts: counts,
        }
    }, [projects, user?.id, byXpmTask])

    const fields = (t, f) => dispatch(updateTask({ taskId: t.id, projectId: t.projectId, fields: f })).unwrap().catch((e) => toast.error(e || 'Could not save'))
    const makeSomeday = (t) => fields(t, { custom_fields: { ...(t.custom_fields || {}), someday: true } })
    const notMine = async (t) => {
        const rest = [...new Set([t.assignee_id, ...(t.assignees || []).map((a) => a?.id)].filter((id) => id && id !== user.id))]
        try { await dispatch(setTaskAssignees({ taskId: t.id, projectId: t.projectId, leadId: rest[0] || null, assigneeIds: rest })).unwrap() }
        catch (e) { toast.error(e || 'Could not save') }
    }

    const sendAll = async () => {
        if (!window.confirm(`Send ${unsent.length} task${unsent.length > 1 ? 's' : ''} to Pulse?`)) return
        setSending(true)
        let sent = 0
        for (const t of unsent) {
            if (await sendTaskToPulse(t, user.id, workspace.id)) {
                sent++
                dispatch(patchTask({ projectId: t.projectId, task: { id: t.id, custom_fields: { ...(t.custom_fields || {}), sent_to_pulse: true } } }))
            }
        }
        setSending(false)
        if (sent) { toast.success(`Sent ${sent} to Pulse`); reload() }
    }

    const step = inbox.loading ? null : nextStep({ inboxCount: inbox.count, rituals })
    const open = (t) => setSelected({ taskId: t.id, projectId: t.projectId })
    const pulseProps = { byXpmTask, enabled: pulseEnabled }
    const nothingAtAll = projects.length === 0

    return (
        <div className="max-w-[1200px] mx-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
                <div className="min-w-0">
                    <p className="text-[12px] text-gray-500 dark:text-zinc-400 mb-1">{format(new Date(), 'EEEE, MMMM d')}</p>
                    <h1 className="text-[24px] sm:text-[28px] font-bold text-gray-900 dark:text-white tracking-tight leading-snug">
                        {greeting}, {displayName}
                    </h1>
                    <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">
                        {overdue.length > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{overdue.length} overdue · </span>}
                        {todayTasks.length} for today · {weekTasks.length} later this week
                        {noDate.length > 0 && ` · ${noDate.length} with no date`}
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                    <button onClick={() => setShowNewProject(true)} className="hidden sm:block text-[13px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">
                        New project
                    </button>
                    <CaptureButton label="Add task" />
                </div>
            </div>
            <CreateProjectDialog isDialogOpen={showNewProject} setIsDialogOpen={setShowNewProject} />

            {/* The one thing to do next */}
            {step ? (
                <div className="mb-6 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[12px] font-medium uppercase tracking-wide text-gray-400">Next</p>
                        <p className="text-[17px] font-semibold text-gray-900 dark:text-white">{step.title}</p>
                        <p className="text-[13px] text-gray-500 dark:text-zinc-400">{step.detail}</p>
                    </div>
                    <Link to={step.to} className="flex-shrink-0 px-4 py-2 rounded-lg text-[14px] font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900">{step.cta}</Link>
                </div>
            ) : (
                <p className="mb-6 text-[13px] text-emerald-700 dark:text-emerald-400">Inbox clear and the week is planned. Do the work.</p>
            )}

            {nothingAtAll ? (
                <Card icon={CalendarClockIcon} tone="text-blue-500" title="Get started">
                    <Empty>No projects yet. <button className="underline" onClick={() => setShowNewProject(true)}>Create one</button> to start adding work.</Empty>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-5">
                        <Card icon={AlertTriangleIcon} tone="text-red-500" title="Slipping" count={overdue.length}>
                            {overdue.length === 0
                                ? <Empty>Nothing overdue.</Empty>
                                : <ul>{overdue.slice(0, 8).map((t) => (
                                    <TaskLine key={t.id} task={t} onOpen={open}>
                                        <PulseChip task={t} {...pulseProps} />
                                        <DueLabel date={t.due_date} />
                                    </TaskLine>
                                ))}</ul>}
                            {overdue.length > 8 && <Link to="/my-tasks" className="block px-5 py-2.5 text-[12px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white border-t border-gray-100 dark:border-zinc-800">{overdue.length - 8} more in My Tasks</Link>}
                        </Card>

                        <Card icon={CalendarClockIcon} tone="text-blue-500" title="Today" count={todayTasks.length}>
                            {todayTasks.length === 0
                                ? <Empty>Nothing planned for today. <Link to="/week?tab=plan" className="underline">Plan the week</Link> or pull something from "No date".</Empty>
                                : <ul>{todayTasks.map((t) => (
                                    <TaskLine key={t.id} task={t} onOpen={open}>
                                        <PulseChip task={t} {...pulseProps} />
                                        <DueLabel date={whenOf(t)} />
                                    </TaskLine>
                                ))}</ul>}
                        </Card>

                        {weekTasks.length > 0 && (
                            <Card icon={CalendarClockIcon} tone="text-zinc-500" title="Later this week" count={weekTasks.length}>
                                <ul>{weekTasks.slice(0, 8).map((t) => (
                                    <TaskLine key={t.id} task={t} onOpen={open}>
                                        <PulseChip task={t} {...pulseProps} />
                                        <DueLabel date={whenOf(t)} />
                                    </TaskLine>
                                ))}</ul>
                            </Card>
                        )}

                        <Card icon={CalendarOffIcon} tone="text-zinc-500" title="No date" count={noDate.length}>
                            {noDate.length === 0
                                ? <Empty>Everything assigned to you has a date or is parked as Someday.</Empty>
                                : <ul>{noDate.slice(0, 10).map((t) => (
                                    <TaskLine key={t.id} task={t} onOpen={open}>
                                        <input type="date" aria-label="Set due date" title="Set a due date"
                                            onChange={(e) => e.target.value && fields(t, { due_date: e.target.value })}
                                            className="text-[12px] w-[112px] rounded border border-gray-200 dark:border-zinc-700 bg-transparent px-1 py-0.5 text-gray-600 dark:text-zinc-300" />
                                        <button onClick={() => makeSomeday(t)} className="text-[12px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">Someday</button>
                                        <button onClick={() => notMine(t)} className="text-[12px] text-gray-400 hover:text-gray-900 dark:hover:text-white">Not mine</button>
                                    </TaskLine>
                                ))}</ul>}
                            {noDate.length > 10 && <Link to="/my-tasks" className="block px-5 py-2.5 text-[12px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white border-t border-gray-100 dark:border-zinc-800">{noDate.length - 10} more in My Tasks</Link>}
                        </Card>
                    </div>

                    <div className="flex flex-col gap-5">
                        <XPlanThisWeekCard workspaceId={workspace?.id} />

                        {pulseEnabled && (
                            <Card icon={ZapIcon} tone="text-violet-500" title="Pulse"
                                action={needsReview.length > 0 && (
                                    <Link to="/pulse-inbox" className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-600 dark:text-violet-400">
                                        <InboxIcon className="size-3.5" />{needsReview.length} to review <ArrowUpRightIcon className="size-3" />
                                    </Link>
                                )}>
                                <div className="px-5 py-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-gray-600 dark:text-zinc-300">
                                    {['today', 'upcoming', 'anytime', 'someday'].map((k) => (
                                        <span key={k}><span className="font-semibold tabular-nums">{inPulseCounts[k]}</span> <span className="text-gray-400 capitalize">{k}</span></span>
                                    ))}
                                </div>
                                {unsent.length > 0 ? (
                                    <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                                        <p className="text-[13px] text-gray-600 dark:text-zinc-300">
                                            {unsent.length} overdue or due soon, not in Pulse yet
                                            {!pulse.autoSend && <span className="text-gray-400"> · auto-send is off</span>}
                                        </p>
                                        <button onClick={sendAll} disabled={sending}
                                            className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-violet-600 text-white disabled:opacity-50">
                                            {sending ? 'Sending…' : 'Send to Pulse'}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800 text-[13px] text-gray-400 dark:text-zinc-500">Everything due soon is already in Pulse.</p>
                                )}
                            </Card>
                        )}

                        <Card icon={HourglassIcon} tone="text-amber-500" title="Waiting on others" count={waiting.length}>
                            {waiting.length === 0
                                ? <Empty>Nothing you assigned to someone else is still open.</Empty>
                                : <ul>{waiting.slice(0, 8).map((t) => (
                                    <TaskLine key={t.id} task={t} onOpen={open}>
                                        <span className="text-[12px] text-gray-500 dark:text-zinc-400 truncate max-w-[110px]">{t.assignee?.name || t.assignee?.email || 'Someone'}</span>
                                        <DueLabel date={t.due_date} />
                                    </TaskLine>
                                ))}</ul>}
                        </Card>

                        <Link to="/overview" className="self-start text-[13px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-1">
                            Portfolio overview <ArrowUpRightIcon className="size-3.5" />
                        </Link>
                    </div>
                </div>
            )}

            {selected && <TaskPanel taskId={selected.taskId} projectId={selected.projectId} onClose={() => setSelected(null)} />}
        </div>
    )
}
