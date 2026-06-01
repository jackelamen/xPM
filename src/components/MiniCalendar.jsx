import { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUpRightIcon, Circle } from 'lucide-react'
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths,
    isSameDay, isPast, startOfDay,
} from 'date-fns'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function MiniCalendar() {
    const [current, setCurrent] = useState(new Date())
    const [selectedDay, setSelectedDay] = useState(new Date())
    const navigate = useNavigate()
    const { currentWorkspace } = useSelector((s) => s.workspace)

    const monthStart = startOfMonth(current)
    const monthEnd   = endOfMonth(current)
    const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 })
    const days       = eachDayOfInterval({ start: calStart, end: calEnd })

    // All tasks with due dates, enriched with project info
    const allTasks = useMemo(() =>
        (currentWorkspace?.projects || []).flatMap((p) =>
            (p.tasks || [])
                .filter((t) => t.due_date && !t.archived_at)
                .map((t) => ({ ...t, projectId: p.id, projectName: p.name }))
        ),
    [currentWorkspace])

    // Tasks on a given day
    const tasksOnDay = (day) => allTasks.filter((t) => isSameDay(new Date(t.due_date), day))

    // Dot color for a day: red = has overdue, black/violet = due that day, blue dot = upcoming
    const dotColor = (day) => {
        const tasks = tasksOnDay(day).filter((t) => t.status !== 'DONE')
        if (!tasks.length) return null
        if (isPast(startOfDay(day)) && !isToday(day)) return 'bg-red-400'
        return 'bg-violet-400'
    }

    // Tasks for selected day
    const selectedTasks = useMemo(() => tasksOnDay(selectedDay), [selectedDay, allTasks])

    const handleDayClick = (day) => {
        setSelectedDay(day)
        // If clicking a day in a different month, navigate there
        if (!isSameMonth(day, current)) setCurrent(day)
    }

    return (
        <div className="glass-panel rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-base font-semibold text-zinc-900 dark:text-white">Calendar</span>
                <button
                    onClick={() => navigate('/projectsDetail?tab=calendar')}
                    className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                    View all <ArrowUpRightIcon size={11} />
                </button>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-[15px] font-bold text-zinc-900 dark:text-zinc-200">
                    {format(current, 'MMMM yyyy')}
                </span>
                <div className="flex gap-1">
                    <button onClick={() => setCurrent(subMonths(current, 1))}
                        className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded transition-colors">
                        <ChevronLeftIcon size={14} />
                    </button>
                    <button onClick={() => setCurrent(addMonths(current, 1))}
                        className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 rounded transition-colors">
                        <ChevronRightIcon size={14} />
                    </button>
                </div>
            </div>

            {/* Day of week labels */}
            <div className="grid grid-cols-7 text-center mb-1">
                {DOW.map((d) => (
                    <span key={d} className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 py-1">{d}</span>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 text-center gap-y-0.5">
                {days.map((day) => {
                    const sameMonth = isSameMonth(day, current)
                    const today     = isToday(day)
                    const selected  = isSameDay(day, selectedDay)
                    const dot       = dotColor(day)

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => handleDayClick(day)}
                            className="flex flex-col items-center justify-center h-10 gap-0.5"
                        >
                            <span className={`w-7 h-7 inline-flex items-center justify-center rounded-full text-[13px] transition-colors
                                ${today
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold'
                                    : selected
                                        ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold ring-1 ring-violet-300 dark:ring-violet-700'
                                        : sameMonth
                                            ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.07]'
                                            : 'text-zinc-300 dark:text-zinc-700'
                                }`}
                            >
                                {format(day, 'd')}
                            </span>
                            <span className={`w-1 h-1 rounded-full transition-colors ${dot || 'bg-transparent'}`} />
                        </button>
                    )
                })}
            </div>

            {/* Selected day task list */}
            <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2">
                    {isToday(selectedDay) ? 'Today' : format(selectedDay, 'EEE, MMM d')}
                    {selectedTasks.length > 0 && <span className="ml-1.5 normal-case font-normal">· {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</span>}
                </p>

                {selectedTasks.length === 0 ? (
                    <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">No tasks due</p>
                ) : (
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                        {selectedTasks.map((t) => {
                            const isDone    = t.status === 'DONE'
                            const isOverdue = isPast(startOfDay(new Date(t.due_date))) && !isToday(new Date(t.due_date)) && !isDone
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => navigate(`/projectsDetail?id=${t.projectId}&tab=tasks`)}
                                    className="flex items-start gap-2 text-left w-full group hover:bg-zinc-50 dark:hover:bg-white/[0.03] rounded-lg px-1.5 py-1 transition-colors"
                                >
                                    <span className={`mt-0.5 flex-shrink-0 ${isDone ? 'text-emerald-500' : isOverdue ? 'text-red-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                                        {isDone
                                            ? <svg viewBox="0 0 14 14" className="w-3 h-3 fill-current"><circle cx="7" cy="7" r="7"/><path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                                            : <Circle size={12} strokeWidth={1.5} />
                                        }
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-xs font-medium truncate ${isDone ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white'}`}>
                                            {t.title}
                                        </p>
                                        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 truncate">{t.projectName}</p>
                                    </div>
                                    {isOverdue && !isDone && (
                                        <span className="text-[9px] font-bold text-red-400 flex-shrink-0 mt-0.5">OVERDUE</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
