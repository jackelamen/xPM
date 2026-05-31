import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { PlusIcon, CheckIcon, FlagIcon } from 'lucide-react'
import { format, isToday, isTomorrow } from 'date-fns'
import { updateTaskStatus } from '../features/workspaceSlice'
import toast from 'react-hot-toast'

const taskColors = [
    {
        bg: 'bg-[#FFF4E5] dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-900/50',
        icon: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    },
    {
        bg: 'bg-[#F0F7FF] dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-900/50',
        icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
    },
    {
        bg: 'bg-[#F5F0FF] dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-900/50',
        icon: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400',
    },
    {
        bg: 'bg-[#F0FFF4] dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-900/50',
        icon: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    },
]

const priorityColors = {
    URGENT: 'text-red-500',
    HIGH: 'text-orange-500',
    MEDIUM: 'text-blue-500',
    LOW: 'text-gray-300 dark:text-zinc-600',
}

const typeInitials = {
    BUG: '🐛',
    FEATURE: '⚡',
    TASK: '✓',
    IMPROVEMENT: '↑',
    OTHER: '·',
}

export default function MyTasksCard() {
    const { user } = useAuth()
    const dispatch = useDispatch()
    const [filter, setFilter] = useState('today')
    const { currentWorkspace } = useSelector((state) => state.workspace)
    const firstProjectId = currentWorkspace?.projects?.[0]?.id

    const allMyTasks = useMemo(() => {
        if (!currentWorkspace || !user) return []
        return currentWorkspace.projects.flatMap((p) =>
            (p.tasks || [])
                .filter((t) => t.assignee_id === user.id && t.status !== 'DONE')
                .map((t) => ({ ...t, projectId: p.id, projectName: p.name }))
        )
    }, [currentWorkspace, user])

    const filteredTasks = useMemo(() => {
        const now = new Date()
        if (filter === 'today') {
            return allMyTasks.filter((t) => !t.due_date || isToday(new Date(t.due_date)) || new Date(t.due_date) < now)
        }
        return allMyTasks.filter((t) => t.due_date && isTomorrow(new Date(t.due_date)))
    }, [allMyTasks, filter])

    const inProgressCount = allMyTasks.filter((t) => t.status === 'IN_PROGRESS').length

    const completeTask = async (task) => {
        try {
            await dispatch(updateTaskStatus({ taskId: task.id, projectId: task.projectId, status: 'DONE' })).unwrap()
            toast.success('Task completed')
        } catch (err) {
            toast.error(err || 'Failed to update task')
        }
    }

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-[#e5e2e1] dark:border-white/[0.07] rounded-[24px] p-6 flex flex-col h-full shadow-[0_4px_20px_rgba(0,0,0,0.04)] min-h-[760px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[22px] font-bold text-[#000101] dark:text-white">My Tasks</h2>
                <Link
                    to={firstProjectId ? `/projectsDetail?id=${firstProjectId}&tab=tasks` : '/projects'}
                    className="w-9 h-9 rounded-full border border-[#c5c6ca] dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05] transition-colors"
                    title="Open tasks"
                >
                    <PlusIcon size={14} />
                </Link>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 mb-5">
                <button
                    onClick={() => setFilter('today')}
                    className={`px-5 py-2 rounded-full text-[12px] font-bold transition-colors ${
                        filter === 'today'
                            ? 'bg-[#000101] dark:bg-white text-white dark:text-gray-900'
                            : 'border border-[#c5c6ca] dark:border-white/[0.1] text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05]'
                    }`}
                >
                    Today
                </button>
                <button
                    onClick={() => setFilter('tomorrow')}
                    className={`px-5 py-2 rounded-full text-[12px] font-bold transition-colors ${
                        filter === 'tomorrow'
                            ? 'bg-[#000101] dark:bg-white text-white dark:text-gray-900'
                            : 'border border-[#c5c6ca] dark:border-white/[0.1] text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05]'
                    }`}
                >
                    Tomorrow
                </button>
            </div>

            {/* Task count row */}
            <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[14px] font-bold text-gray-800 dark:text-zinc-300 flex items-center gap-2">
                    <span className="bg-[#000101] dark:bg-white text-white dark:text-gray-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {filteredTasks.length}
                    </span>
                    {filter === 'today' ? 'Active Tasks' : "Tomorrow's Tasks"}
                </span>
                {inProgressCount > 0 && (
                <span className="text-[12px] text-gray-500 dark:text-zinc-500">
                        {inProgressCount} in progress
                    </span>
                )}
            </div>

            {/* Task cards */}
            <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar flex-1">
                {filteredTasks.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-10">
                        <p className="text-[13px] text-gray-400 dark:text-zinc-600">No tasks for {filter === 'today' ? 'today' : 'tomorrow'}</p>
                    </div>
                ) : (
                    filteredTasks.map((task, index) => {
                        const color = taskColors[index % taskColors.length]
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isToday(new Date(task.due_date))
                        return (
                            <Link
                                key={task.id}
                                to={`/projectsDetail?id=${task.projectId}&tab=tasks`}
                                className={`${color.bg} ${color.border} border rounded-2xl p-5 relative group hover:shadow-md transition-shadow min-h-[180px]`}
                            >
                                {/* Icon */}
                                <div className={`w-9 h-9 ${color.icon} rounded-xl flex items-center justify-center mb-5 text-[14px] font-bold shadow-sm`}>
                                    {typeInitials[task.type] || '·'}
                                </div>

                                {/* Title */}
                                <h3 className="text-[17px] font-bold text-[#000101] dark:text-zinc-100 mb-2 leading-tight pr-8">
                                    {task.title}
                                </h3>

                                {/* Meta */}
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-[13px] leading-relaxed text-gray-600 dark:text-zinc-500 truncate">
                                        {task.projectName}
                                    </span>
                                    {task.due_date && (
                                        <span className={`text-[10px] font-medium ml-auto flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`}>
                                            {isOverdue ? 'Overdue' : format(new Date(task.due_date), 'MMM d')}
                                        </span>
                                    )}
                                </div>

                                {/* Priority + check */}
                                <div className="absolute top-5 right-5 flex items-center gap-1.5">
                                    {task.priority && task.priority !== 'LOW' && (
                                        <FlagIcon size={11} className={priorityColors[task.priority]} />
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            completeTask(task)
                                        }}
                                        className="w-7 h-7 rounded-full border border-[#c5c6ca] dark:border-zinc-600 flex items-center justify-center bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 transition-colors"
                                        title="Mark complete"
                                    >
                                        <CheckIcon size={10} className="text-gray-400 dark:text-zinc-500" />
                                    </button>
                                </div>
                            </Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}
