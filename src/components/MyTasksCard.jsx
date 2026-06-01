import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { PlusIcon, CheckIcon, FlagIcon, CalendarIcon } from 'lucide-react'
import { format, isToday, startOfDay, endOfWeek } from 'date-fns'
import { updateTaskStatus } from '../features/workspaceSlice'
import toast from 'react-hot-toast'

const priorityColors = {
    URGENT: 'text-red-500',
    HIGH: 'text-orange-500',
    MEDIUM: 'text-blue-500',
    LOW: 'text-zinc-300 dark:text-zinc-600',
}

const typeLabels = {
    MEETING: 'Meeting',
    WRITING: 'Writing',
    STRATEGY: 'Strategy',
    DESIGN: 'Design',
    ADMIN: 'Admin',
    OTHER: 'Other',
}

// Convert a hex color to a very light tinted background
function hexToTintBg(hex) {
    if (!hex) return null
    try {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return { bg: `rgba(${r},${g},${b},0.07)`, border: `rgba(${r},${g},${b},0.25)`, dot: hex }
    } catch {
        return null
    }
}

export default function MyTasksCard() {
    const { user } = useAuth()
    const dispatch = useDispatch()
    const [tab, setTab] = useState('today') // 'today' | 'week'
    const { currentWorkspace } = useSelector((state) => state.workspace)
    const spaces = useSelector((state) => state.workspace.spaces || [])
    const firstProjectId = currentWorkspace?.projects?.[0]?.id

    // Build a project → space color map
    const projectSpaceColor = useMemo(() => {
        const map = {}
        const spaceMap = new Map(spaces.map((s) => [s.id, s]))
        ;(currentWorkspace?.projects || []).forEach((p) => {
            if (p.space_id && spaceMap.has(p.space_id)) {
                map[p.id] = spaceMap.get(p.space_id).color
            }
        })
        return map
    }, [currentWorkspace, spaces])

    const allMyTasks = useMemo(() => {
        if (!currentWorkspace || !user) return []
        return currentWorkspace.projects.flatMap((p) =>
            (p.tasks || [])
                .filter((t) => {
                    const mine = t.assignee_id === user.id || t.created_by === user.id || (!t.assignee_id && !t.created_by)
                    return mine
                })
                .map((t) => ({ ...t, projectId: p.id, projectName: p.name, spaceColor: projectSpaceColor[p.id] || null }))
        )
    }, [currentWorkspace, user, projectSpaceColor])

    const activeTasks = useMemo(() => allMyTasks.filter((t) => t.status !== 'DONE'), [allMyTasks])

    const filteredTasks = useMemo(() => {
        const todayStart = startOfDay(new Date())
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
        if (tab === 'today') {
            return activeTasks.filter((t) => {
                if (!t.due_date) return isToday(new Date())
                return startOfDay(new Date(t.due_date)) <= todayStart
            })
        }
        return activeTasks.filter((t) => {
            if (!t.due_date) return true
            return startOfDay(new Date(t.due_date)) <= weekEnd
        })
    }, [activeTasks, tab])

    const setStatus = async (task, status) => {
        try {
            await dispatch(updateTaskStatus({ taskId: task.id, projectId: task.projectId, status })).unwrap()
            toast.success(status === 'DONE' ? 'Task completed' : 'Task reopened')
        } catch (err) {
            toast.error(err || 'Failed to update task')
        }
    }

    const tabClass = (t) =>
        `px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
            tab === t
                ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
        }`

    return (
        <div className="glass-panel rounded-2xl p-6 flex flex-col h-full min-h-[760px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">My Tasks</h2>
                <Link
                    to={firstProjectId ? `/projectsDetail?id=${firstProjectId}&tab=tasks` : '/projects'}
                    className="w-7 h-7 rounded-md border border-zinc-200 dark:border-white/[0.1] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/[0.05] transition-colors"
                    title="Open tasks"
                >
                    <PlusIcon size={13} />
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4">
                <button onClick={() => setTab('today')} className={tabClass('today')}>Today</button>
                <button onClick={() => setTab('week')} className={tabClass('week')}>This Week</button>
            </div>

            {/* Count row */}
            <div className="flex items-center gap-2 mb-3 px-0.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {filteredTasks.length}
                    </span>
                    <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                        {tab === 'today' ? 'Due Today' : 'This Week'}
                    </span>
                </div>

            {/* Task list */}
            <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar flex-1">
                {filteredTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3">
                        <><CheckIcon size={24} className="text-zinc-200 dark:text-zinc-700" /><p className="text-sm text-zinc-400 dark:text-zinc-600">{tab === 'today' ? 'Nothing due today' : 'Nothing due this week'}</p><Link to={firstProjectId ? `/projectsDetail?id=${firstProjectId}&tab=tasks` : '/projects'} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">+ Add a task</Link></>
                    </div>
                ) : (
                    filteredTasks.map((task) => {
                        const tint = hexToTintBg(task.spaceColor)
                        const isOverdue = !task.due_date
                            ? false
                            : new Date(task.due_date) < new Date() && !isToday(new Date(task.due_date))
                        const isDone = task.status === 'DONE'

                        return (
                            <div
                                key={task.id}
                                className="glass-card-hover group relative rounded-xl border-l-4 px-3.5 py-3"
                                style={tint
                                    ? { backgroundColor: tint.bg, borderLeftColor: tint.dot, borderTop: `1px solid ${tint.border}`, borderRight: `1px solid ${tint.border}`, borderBottom: `1px solid ${tint.border}` }
                                    : { backgroundColor: 'rgba(255,255,255,0.4)', borderLeftColor: '#e4e4e7', borderTop: '1px solid rgba(255,255,255,0.3)', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.3)' }
                                }
                            >
                                {/* No separate color bar needed — border-l-4 handles it */}

                                <div className="flex items-start gap-2.5 pl-2">
                                    {/* Check button */}
                                    <button
                                        onClick={() => setStatus(task, isDone ? 'TODO' : 'DONE')}
                                        title={isDone ? 'Reopen task' : 'Mark complete'}
                                        className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                            isDone
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400'
                                        }`}
                                    >
                                        {isDone && <CheckIcon size={9} />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        {/* Title */}
                                        <Link
                                            to={`/projectsDetail?id=${task.projectId}&tab=tasks`}
                                            className={`block text-[13px] font-medium leading-snug hover:underline ${isDone ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-100'}`}
                                        >
                                            {task.title}
                                        </Link>

                                        {/* Meta row */}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{task.projectName}</span>

                                            {task.type && task.type !== 'OTHER' && (
                                                <span className="text-[10px] text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                                    {typeLabels[task.type]}
                                                </span>
                                            )}

                                            {task.due_date && (
                                                <span className={`flex items-center gap-0.5 text-[10px] ml-auto flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                                    <CalendarIcon size={9} />
                                                    {isOverdue ? 'Overdue' : format(new Date(task.due_date), 'MMM d')}
                                                </span>
                                            )}

                                            {task.priority && task.priority !== 'LOW' && (
                                                <FlagIcon size={10} className={`flex-shrink-0 ${priorityColors[task.priority]}`} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
