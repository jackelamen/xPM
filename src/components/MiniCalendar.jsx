import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { ChevronLeftIcon, ChevronRightIcon, ArrowUpRightIcon } from 'lucide-react'
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isToday,
    addMonths,
    subMonths,
    isSameDay,
} from 'date-fns'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function MiniCalendar() {
    const [current, setCurrent] = useState(new Date())
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const monthStart = startOfMonth(current)
    const monthEnd = endOfMonth(current)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: calStart, end: calEnd })
    const datedTasks = (currentWorkspace?.projects || [])
        .flatMap((project) => project.tasks || [])
        .filter((task) => task.due_date)

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-[#e5e2e1] dark:border-white/[0.07] rounded-[24px] p-7 shadow-[0_4px_20px_rgba(0,0,0,0.04)] h-[340px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[22px] font-bold text-[#000101] dark:text-white">Calendar</span>
                </div>
                <Link to="/projects" className="w-9 h-9 rounded-full border border-[#c5c6ca] dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05] transition-colors" title="Open projects">
                    <ArrowUpRightIcon size={13} />
                </Link>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-[16px] font-bold text-[#000101] dark:text-zinc-200">
                    {format(current, 'MMMM yyyy')}
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() => setCurrent(subMonths(current, 1))}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 rounded transition-colors"
                    >
                        <ChevronLeftIcon size={14} />
                    </button>
                    <button
                        onClick={() => setCurrent(addMonths(current, 1))}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 rounded transition-colors"
                    >
                        <ChevronRightIcon size={14} />
                    </button>
                </div>
            </div>

            {/* Day of week labels */}
            <div className="grid grid-cols-7 text-center mb-1">
                {DOW.map((d) => (
                    <span key={d} className="text-[12px] font-semibold text-gray-600 dark:text-zinc-500 py-1">
                        {d}
                    </span>
                ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 text-center">
                {days.map((day) => {
                    const sameMonth = isSameMonth(day, current)
                    const today = isToday(day)
                    const hasTask = datedTasks.some((task) => isSameDay(new Date(task.due_date), day))
                    return (
                        <div key={day.toISOString()} className="relative py-1.5 flex items-center justify-center">
                            <span
                                className={`w-8 h-8 inline-flex items-center justify-center rounded-full text-[14px] transition-colors cursor-pointer
                                    ${today
                                        ? 'bg-[#000101] dark:bg-white text-white dark:text-gray-900 font-bold'
                                        : sameMonth
                                            ? 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.07]'
                                            : 'text-gray-300 dark:text-zinc-700'
                                    }`}
                            >
                                {format(day, 'd')}
                            </span>
                            {hasTask && !today && (
                                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#4648d4]" />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
