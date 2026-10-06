import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { addDays, format, isToday } from 'date-fns'
import { ArrowUpRightIcon, InboxIcon, ZapIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { usePulse } from '../context/PulseContext'
import { useInbox } from '../context/InboxContext'
import { patchTask, setTaskAssignees, updateTask } from '../features/workspaceSlice'
import { sendTaskToPulse } from '../lib/pulse'
import { allTasks, bucketOf, nextStep, openLeaves, whenOf, isMine, weekStartOf, ymd } from '../lib/flow'
import { XPlanThisWeekCard } from '../components/XPlanThisWeek'
import { CaptureButton } from '../components/QuickCapture'
import CreateProjectDialog from '../components/CreateProjectDialog'
import TaskPanel from '../components/TaskPanel'

const SOON_DAYS = 7
const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const parseDay = (d) => new Date(`${d}T00:00:00`)

function Heading({ title, count, dot, action }) {
    return (
        <div className="flex items-center gap-2 pb-2">
            {dot && <span className={`size-2 rounded-full ${dot}`} />}
            <h2 className="text-[18px] font-semibold text-gray-900 dark:text-white">{title}</h2>
            {count != null && <span className="text-[13px] text-gray-400 tabular-nums">{count}</span>}
            <div className="ml-auto">{action}</div>
        </div>
    )
}

function DueLabel({ date }) {
    if (!date) return <span className="text-[12px] text-gray-400">no date</span>
    const d = parseDay(date)
    if (date < todayStr()) return <span className="text-[12px] font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">Overdue · {format(d, 'MMM d')}</span>
    if (isToday(d)) return <span className="text-[12px] font-semibold text-signal-700 dark:text-signal-400">Today</span>
    return <span className="text-[12px] text-gray-500 dark:text-zinc-400 whitespace-nowrap">{format(d, 'EEE MMM d')}</span>
}

function PulseChip({ task, byXpmTask, enabled }) {
    if (!enabled) return null
    const st = byXpmTask.get(task.id)
    const linked = st || task.custom_fields?.sent_to_pulse
    if (!linked) return null
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
            <ZapIcon className="size-3" fill="currentColor" />{st?.location ? st.location.label : 'In Pulse'}
        </span>
    )
}

const ProjectTag = ({ task, className = '' }) => (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
        <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: task.projectColor || '#6489b3' }} />
        <span className="truncate">{task.projectName}</span>
    </span>
)

function TaskLine({ task, onOpen, children }) {
    return (
        <li className="flex items-center gap-3 py-2.5 border-b border-gray-100 dark:border-zinc-800/70 last:border-0">
            <button onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
                <p className="text-[15px] text-gray-900 dark:text-zinc-100 truncate">{task.title}</p>
                <ProjectTag task={task} className="text-[12px] text-gray-400 dark:text-zinc-500" />
            </button>
            {children}
        </li>
    )
}

export default function Home() {
    const { user, displayName, pulse, rituals } = useAuth()
    const dispatch = useDispatch()
    const inbox = useInbox()
    const { byXpmTask, needsReview, enabled: pulseEnabled, reload } = usePulse()
    const workspace = useSelector((s) => s.workspace?.currentWorkspace)
    const projects = useMemo(() => workspace?.projects || [], [workspace])
    const [selected, setSelected] = useState(null)
    const [showNewProject, setShowNewProject] = useState(false)
    const [sending, setSending] = useState(false)

    const now = new Date()
    const hour = now.getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const firstName = (displayName || '').split(' ')[0]

    const { overdue, todayTasks, weekTasks, nextWeekCount, noDate, waiting, unsent, inPulseCounts } = useMemo(() => {
        const colors = Object.fromEntries(projects.map((p) => [p.id, p.color]))
        const all = allTasks(projects).map((t) => ({ ...t, projectColor: colors[t.projectId] }))
        const open = openLeaves(all)
        const mine = open.filter((t) => isMine(t, user?.id))
        const today = todayStr()
        const soonEnd = format(addDays(new Date(), SOON_DAYS), 'yyyy-MM-dd')
        const byDue = (a, b) => (a.due_date || '').localeCompare(b.due_date || '')
        const byWhen = (a, b) => (whenOf(a) || '').localeCompare(whenOf(b) || '')
        const overdueT = mine.filter((t) => t.due_date && t.due_date < today).sort(byDue)
        const soonT = mine.filter((t) => t.due_date && t.due_date >= today && t.due_date <= soonEnd).sort(byDue)
        const counts = { today: 0, upcoming: 0, anytime: 0, someday: 0, inbox: 0 }
        for (const t of mine) { const k = byXpmTask.get(t.id)?.location?.key; if (k && counts[k] !== undefined) counts[k]++ }
        const n = new Date()
        const nwStart = ymd(addDays(weekStartOf(n), 7)), nwEnd = ymd(addDays(weekStartOf(n), 13))
        return {
            nextWeekCount: mine.filter((t) => !t.custom_fields?.someday && whenOf(t) && whenOf(t) >= nwStart && whenOf(t) <= nwEnd).length,
            overdue: overdueT,
            todayTasks: mine.filter((t) => bucketOf(t, n) === 'today').sort(byWhen),
            weekTasks: mine.filter((t) => bucketOf(t, n) === 'week').sort(byWhen),
            noDate: mine.filter((t) => !t.due_date && !t.start_date && !t.custom_fields?.someday),
            waiting: open.filter((t) => t.created_by === user?.id && t.assignee_id && t.assignee_id !== user?.id)
                .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')),
            unsent: [...overdueT, ...soonT].filter((t) => !t.custom_fields?.sent_to_pulse && !byXpmTask.has(t.id) && !t.custom_fields?.someday),
            inPulseCounts: counts,
        }
    }, [projects, user?.id, byXpmTask])

    const fields = (t, f) => dispatch(updateTask({ taskId: t.id, projectId: t.projectId, fields: f })).unwrap().catch((e) => toast.error(e || 'Could not save'))
    const complete = (t) => fields(t, { status: 'DONE' })
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

    const weekPlanned = todayTasks.length + weekTasks.length
    const step = inbox.loading ? null : nextStep({ inboxCount: inbox.count, rituals, weekPlanned, nextWeekPlanned: nextWeekCount, overdue: overdue.length })
    const open = (t) => setSelected({ taskId: t.id, projectId: t.projectId })
    const pulseProps = { byXpmTask, enabled: pulseEnabled }

    return (
        <div className="max-w-[1240px] mx-auto">
            <CreateProjectDialog isDialogOpen={showNewProject} setIsDialogOpen={setShowNewProject} />

            {/* Hook: today, big. */}
            <section className="rounded-2xl bg-ink-900 text-white overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                    <div className="p-7 sm:p-9 flex flex-col">
                        <p className="text-[15px] text-ink-200">{greeting}, {firstName}</p>
                        <div className="mt-4 flex items-end gap-4">
                            <span className="font-display font-bold text-[88px] sm:text-[112px] leading-[0.8] text-signal-500 tabular-nums -ml-1">{format(now, 'd')}</span>
                            <div className="pb-1">
                                <p className="font-display text-[28px] font-semibold leading-none">{format(now, 'EEEE')}</p>
                                <p className="text-[15px] text-ink-300 mt-1.5">{format(now, 'MMMM yyyy')}</p>
                            </div>
                        </div>
                        <p className="mt-5 text-[15px] text-ink-200">
                            {overdue.length > 0 && <span className="font-semibold text-red-300">{overdue.length} overdue · </span>}
                            {todayTasks.length} for today · {weekTasks.length} later this week
                        </p>

                        <div className="mt-auto pt-8">
                            {step ? (
                                <>
                                    <p className="text-[13px] text-ink-300">Next up</p>
                                    <p className="font-display text-[24px] font-semibold leading-tight mt-0.5">{step.title}</p>
                                    <p className="text-[14px] text-ink-300 mt-1">{step.detail}</p>
                                    <Link to={step.to} className="mt-4 inline-flex items-center px-5 py-2.5 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[15px] font-semibold transition-colors">{step.cta}</Link>
                                </>
                            ) : (
                                <p className="font-display text-[22px] font-semibold text-ink-100">
                                    {todayTasks.length > 0 ? 'Inbox clear, week planned. Do the work.' : 'Inbox clear, week planned. Today is open.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-ink-800 p-7 sm:p-9">
                        <div className="flex items-center gap-2 mb-3">
                            <h2 className="text-[22px] font-semibold">Today</h2>
                            <span className="text-[14px] text-ink-300 tabular-nums">{todayTasks.length}</span>
                            <div className="ml-auto flex items-center gap-1">
                                <button onClick={() => setShowNewProject(true)} className="hidden sm:block px-3 py-2 text-[13px] text-ink-300 hover:text-white">New project</button>
                                <CaptureButton label="Add task" onDark />
                            </div>
                        </div>
                        {todayTasks.length === 0 ? (
                            <div className="py-6">
                                <p className="text-[17px] text-ink-100">Nothing planned for today.</p>
                                <p className="text-[14px] text-ink-300 mt-1">
                                    {weekTasks.length > 0
                                        ? `Next up: ${weekTasks[0].title} · ${format(parseDay(whenOf(weekTasks[0])), 'EEE')}`
                                        : overdue.length > 0 ? `${overdue.length} overdue ${overdue.length > 1 ? 'are' : 'is'} waiting for a new day.` : 'Pull something in from the week, or from "No date".'}
                                </p>
                                {/* The left panel already offers this exact action when it's the next step. */}
                                {!step?.to?.startsWith('/week?tab=plan') && (
                                    <Link to="/week?tab=plan" className="mt-4 inline-flex items-center px-5 py-2.5 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[15px] font-semibold transition-colors">
                                        {weekPlanned > 0 ? `Pull something into today · ${weekPlanned} planned` : 'Plan the week'}
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <ul>
                                {todayTasks.slice(0, 7).map((t) => (
                                    <li key={t.id} className="flex items-center gap-3 py-3 border-b border-white/10 last:border-0">
                                        <button onClick={() => complete(t)} aria-label={`Mark "${t.title}" done`}
                                            className="size-5 rounded-full border-2 border-ink-400 hover:border-signal-500 hover:bg-signal-500/20 flex-shrink-0 transition-colors" />
                                        <button onClick={() => open(t)} className="min-w-0 flex-1 text-left">
                                            <p className="text-[16px] text-white truncate">{t.title}</p>
                                            <ProjectTag task={t} className="text-[12px] text-ink-300" />
                                        </button>
                                        {pulseEnabled && (byXpmTask.get(t.id) || t.custom_fields?.sent_to_pulse) && (
                                            <ZapIcon className="size-3.5 text-violet-300 flex-shrink-0" fill="currentColor" />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {todayTasks.length > 7 && <Link to="/my-tasks" className="inline-block mt-3 text-[13px] text-ink-300 hover:text-white">{todayTasks.length - 7} more in My Tasks</Link>}
                    </div>
                </div>
            </section>

            {/* Secondary: what needs attention. One surface, not seven. */}
            <div className="mt-8 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-10 gap-y-8">
                <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 px-6 py-5 space-y-7">
                    {overdue.length > 0 && (
                        <section>
                            <Heading title="Slipping" count={overdue.length} dot="bg-red-500" />
                            <ul>{overdue.slice(0, 6).map((t) => (
                                <TaskLine key={t.id} task={t} onOpen={open}>
                                    <PulseChip task={t} {...pulseProps} />
                                    <DueLabel date={t.due_date} />
                                </TaskLine>
                            ))}</ul>
                            {overdue.length > 6 && <Link to="/my-tasks" className="inline-block pt-2 text-[13px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">{overdue.length - 6} more in My Tasks</Link>}
                        </section>
                    )}

                    <section>
                        <Heading title="Later this week" count={weekTasks.length} />
                        {weekTasks.length === 0
                            ? <p className="py-2 text-[14px] text-gray-500 dark:text-zinc-400">Nothing else is planned this week.</p>
                            : <ul>{weekTasks.slice(0, 6).map((t) => (
                                <TaskLine key={t.id} task={t} onOpen={open}>
                                    <PulseChip task={t} {...pulseProps} />
                                    <DueLabel date={whenOf(t)} />
                                </TaskLine>
                            ))}</ul>}
                    </section>

                    {noDate.length > 0 && (
                        <section>
                            <Heading title="No date" count={noDate.length} />
                            <ul>{noDate.slice(0, 6).map((t) => (
                                <TaskLine key={t.id} task={t} onOpen={open}>
                                    <input type="date" aria-label="Set due date" title="Set a due date"
                                        onChange={(e) => e.target.value && fields(t, { due_date: e.target.value })}
                                        className="text-[12px] w-[112px] rounded border border-gray-200 dark:border-zinc-700 bg-transparent px-1 py-0.5 text-gray-600 dark:text-zinc-300" />
                                    <button onClick={() => makeSomeday(t)} className="text-[12px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">Someday</button>
                                    <button onClick={() => notMine(t)} className="text-[12px] text-gray-400 hover:text-gray-900 dark:hover:text-white">Not mine</button>
                                </TaskLine>
                            ))}</ul>
                            {noDate.length > 6 && <Link to="/my-tasks" className="inline-block pt-2 text-[13px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">{noDate.length - 6} more in My Tasks</Link>}
                        </section>
                    )}
                </div>

                {/* Quiet column: context, not chores. */}
                <div className="space-y-8">
                    <XPlanThisWeekCard workspaceId={workspace?.id} bare />

                    {pulseEnabled && (
                        <section>
                            <Heading title="Pulse"
                                action={needsReview.length > 0 && (
                                    <Link to="/pulse-inbox" className="inline-flex items-center gap-1 text-[13px] font-medium text-violet-600 dark:text-violet-400">
                                        <InboxIcon className="size-3.5" />{needsReview.length} to review <ArrowUpRightIcon className="size-3" />
                                    </Link>
                                )} />
                            <p className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-gray-600 dark:text-zinc-300">
                                {['today', 'upcoming', 'anytime', 'someday'].map((k) => (
                                    <span key={k}><span className="font-display font-semibold text-[18px] tabular-nums text-gray-900 dark:text-white">{inPulseCounts[k]}</span> <span className="text-gray-400 capitalize">{k}</span></span>
                                ))}
                            </p>
                            {unsent.length > 0 ? (
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <p className="text-[14px] text-gray-600 dark:text-zinc-300">
                                        {unsent.length} overdue or due soon, not in Pulse yet
                                        {!pulse.autoSend && <span className="text-gray-400"> · auto-send is off</span>}
                                    </p>
                                    <button onClick={sendAll} disabled={sending}
                                        className="flex-shrink-0 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
                                        {sending ? 'Sending…' : 'Send to Pulse'}
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-2 text-[14px] text-gray-500 dark:text-zinc-400">Everything due soon is already in Pulse.</p>
                            )}
                        </section>
                    )}

                    <section>
                        <Heading title="Waiting on others" count={waiting.length} />
                        {waiting.length === 0
                            ? <p className="py-1 text-[14px] text-gray-500 dark:text-zinc-400">Nothing you handed off is still open.</p>
                            : <ul>{waiting.slice(0, 6).map((t) => (
                                <TaskLine key={t.id} task={t} onOpen={open}>
                                    <span className="text-[12px] text-gray-500 dark:text-zinc-400 truncate max-w-[110px]">{t.assignee?.name || t.assignee?.email || 'Someone'}</span>
                                    <DueLabel date={t.due_date} />
                                </TaskLine>
                            ))}</ul>}
                    </section>

                    <Link to="/overview" className="inline-flex items-center gap-1 text-[13px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">
                        Portfolio overview <ArrowUpRightIcon className="size-3.5" />
                    </Link>
                </div>
            </div>

            {selected && <TaskPanel taskId={selected.taskId} projectId={selected.projectId} onClose={() => setSelected(null)} />}
        </div>
    )
}
