import { useState, useMemo, useRef, useCallback } from "react"
import { supabase } from "../lib/supabase"
import {
    format, addDays, differenceInDays, startOfDay, isToday,
    isWeekend, subDays, parseISO, startOfWeek, endOfWeek
} from "date-fns"
import {
    ChevronLeftIcon, ChevronRightIcon, CalendarIcon,
    CircleIcon, CircleDotIcon, CheckCircle2Icon, ZoomInIcon, ZoomOutIcon, UserIcon
} from "lucide-react"
import toast from "react-hot-toast"

const STATUS_COLORS = {
    TODO: { bar: "bg-zinc-300 dark:bg-zinc-600", text: "text-zinc-600 dark:text-zinc-300" },
    IN_PROGRESS: { bar: "bg-blue-400 dark:bg-blue-500", text: "text-blue-600" },
    DONE: { bar: "bg-emerald-400 dark:bg-emerald-500", text: "text-emerald-600" },
}

const PRIORITY_COLORS = {
    URGENT: "ring-2 ring-red-400",
    HIGH: "ring-2 ring-orange-400",
    MEDIUM: "",
    LOW: "",
}

const GROUP_OPTIONS = [
    { value: "none", label: "No grouping" },
    { value: "assignee", label: "By assignee" },
    { value: "status", label: "By status" },
]

const DAY_WIDTH_OPTIONS = [
    { value: 24, label: "Day (wide)" },
    { value: 16, label: "Day (normal)" },
    { value: 8, label: "Week" },
]

export default function ProjectTimeline({ tasks, projectId }) {
    const today = startOfDay(new Date())
    const [viewStart, setViewStart] = useState(subDays(today, 7))
    const [dayWidth, setDayWidth] = useState(16)
    const [groupBy, setGroupBy] = useState("none")
    const [dragging, setDragging] = useState(null) // { taskId, startX, origStart, origEnd, mode: 'move'|'resize-left'|'resize-right' }
    const [localDates, setLocalDates] = useState({}) // taskId -> { start_date, due_date }
    const containerRef = useRef(null)
    const rowHeight = 40
    const headerHeight = 48
    const leftColWidth = 220

    const VISIBLE_DAYS = Math.floor((typeof window !== "undefined" ? window.innerWidth - leftColWidth - 40 : 900) / dayWidth)
    const viewEnd = addDays(viewStart, VISIBLE_DAYS)

    const getDate = (task, field) => {
        const override = localDates[task.id]
        if (override && override[field]) return parseISO(override[field])
        if (task[field]) return parseISO(task[field])
        return null
    }

    // Tasks that have at least a due date
    const scheduledTasks = useMemo(() => tasks.filter(t => t.due_date || localDates[t.id]?.due_date), [tasks, localDates])
    const unscheduledTasks = useMemo(() => tasks.filter(t => !t.due_date && !localDates[t.id]?.due_date), [tasks, localDates])

    // Grouping
    const groups = useMemo(() => {
        if (groupBy === "none") return [{ key: "all", label: "All Tasks", tasks: scheduledTasks }]
        if (groupBy === "assignee") {
            const map = {}
            scheduledTasks.forEach(t => {
                const key = t.assignee?.name || "Unassigned"
                if (!map[key]) map[key] = []
                map[key].push(t)
            })
            return Object.entries(map).map(([key, tasks]) => ({ key, label: key, tasks }))
        }
        if (groupBy === "status") {
            const order = ["TODO", "IN_PROGRESS", "DONE"]
            const map = { TODO: [], IN_PROGRESS: [], DONE: [] }
            scheduledTasks.forEach(t => { if (map[t.status]) map[t.status].push(t) })
            const labels = { TODO: "To Do", IN_PROGRESS: "In Progress", DONE: "Done" }
            return order.filter(k => map[k].length > 0).map(k => ({ key: k, label: labels[k], tasks: map[k] }))
        }
        return [{ key: "all", label: "All Tasks", tasks: scheduledTasks }]
    }, [scheduledTasks, groupBy])

    // X position helpers
    const dayOffset = (date) => differenceInDays(startOfDay(date), startOfDay(viewStart))
    const xPos = (date) => dayOffset(date) * dayWidth
    const dateFromX = (x) => addDays(viewStart, Math.round(x / dayWidth))

    // Header days
    const headerDays = useMemo(() => {
        return Array.from({ length: VISIBLE_DAYS + 1 }, (_, i) => addDays(viewStart, i))
    }, [viewStart, VISIBLE_DAYS])

    // Month labels in header
    const monthLabels = useMemo(() => {
        const months = []
        let currentMonth = null
        let startX = 0
        headerDays.forEach((day, i) => {
            const month = format(day, "MMMM yyyy")
            if (month !== currentMonth) {
                if (currentMonth) months.push({ label: currentMonth, x: startX, width: (i - months.length > 0 ? i : i) * dayWidth })
                currentMonth = month
                startX = i * dayWidth
            }
        })
        if (currentMonth) months.push({ label: currentMonth, x: startX })
        return months
    }, [headerDays, dayWidth])

    const scrollLeft = () => setViewStart(prev => subDays(prev, 7))
    const scrollRight = () => setViewStart(prev => addDays(prev, 7))
    const jumpToday = () => setViewStart(subDays(today, 7))

    // Drag handlers
    const handleBarMouseDown = useCallback((e, task, mode) => {
        e.preventDefault()
        e.stopPropagation()
        const startDate = getDate(task, "start_date")
        const dueDate = getDate(task, "due_date")
        setDragging({ taskId: task.id, startX: e.clientX, origStart: startDate, origEnd: dueDate, mode })
    }, [localDates])

    const handleMouseMove = useCallback((e) => {
        if (!dragging) return
        const dx = e.clientX - dragging.startX
        const daysDelta = Math.round(dx / dayWidth)
        const { taskId, origStart, origEnd, mode } = dragging
        let newStart = origStart
        let newEnd = origEnd

        if (mode === "move") {
            if (origEnd) newEnd = addDays(origEnd, daysDelta)
            if (origStart) newStart = addDays(origStart, daysDelta)
        } else if (mode === "resize-left") {
            // Use origStart if available, otherwise anchor to origEnd as the base
            const base = origStart || (origEnd ? subDays(origEnd, 1) : today)
            newStart = addDays(base, daysDelta)
            if (newEnd && newStart >= newEnd) newStart = subDays(newEnd, 1)
        } else if (mode === "resize-right") {
            // Always adjusts due date — origEnd must exist (bar wouldn't render without it)
            const base = origEnd || today
            newEnd = addDays(base, daysDelta)
            if (newStart && newEnd <= newStart) newEnd = addDays(newStart, 1)
            else if (!newStart && newEnd <= today) newEnd = addDays(today, 1)
        }
        setLocalDates(prev => ({
            ...prev,
            [taskId]: {
                start_date: newStart ? format(newStart, "yyyy-MM-dd") : null,
                due_date: newEnd ? format(newEnd, "yyyy-MM-dd") : null,
            }
        }))
    }, [dragging, dayWidth])

    const handleMouseUp = useCallback(async () => {
        if (!dragging) return
        const override = localDates[dragging.taskId]
        if (override) {
            const updates = {}
            if (override.start_date !== undefined) updates.start_date = override.start_date
            if (override.due_date !== undefined) updates.due_date = override.due_date
            const { error } = await supabase.from("tasks").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", dragging.taskId)
            if (error) { toast.error("Failed to save dates"); return }
            toast.success("Dates updated")
        }
        setDragging(null)
    }, [dragging, localDates])

    const totalContentWidth = VISIBLE_DAYS * dayWidth
    const todayX = xPos(today)

    return (
        <div className="space-y-3">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                    <button onClick={scrollLeft} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-400">
                        <ChevronLeftIcon className="size-4" />
                    </button>
                    <button onClick={jumpToday} className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                        Today
                    </button>
                    <button onClick={scrollRight} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-400">
                        <ChevronRightIcon className="size-4" />
                    </button>
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {format(viewStart, "MMM d")} – {format(viewEnd, "MMM d, yyyy")}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                        className="text-xs px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none">
                        {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
                        {DAY_WIDTH_OPTIONS.map(o => (
                            <button key={o.value} onClick={() => setDayWidth(o.value)}
                                className={`px-2 py-1 text-xs transition ${dayWidth === o.value ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Timeline grid */}
            <div
                ref={containerRef}
                className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 select-none"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div style={{ minWidth: leftColWidth + totalContentWidth }}>
                    {/* Header */}
                    <div className="flex sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                        <div style={{ width: leftColWidth, minWidth: leftColWidth }} className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 py-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Task</span>
                        </div>
                        <div className="relative flex-1" style={{ height: headerHeight }}>
                            {/* Month labels */}
                            {monthLabels.map((m, i) => (
                                <div key={i} className="absolute top-0 text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1 truncate"
                                    style={{ left: m.x, top: 2 }}>
                                    {m.label}
                                </div>
                            ))}
                            {/* Day labels */}
                            <div className="absolute bottom-0 flex" style={{ height: 24 }}>
                                {headerDays.slice(0, VISIBLE_DAYS).map((day, i) => {
                                    const isT = isToday(day)
                                    const isWe = isWeekend(day)
                                    return (
                                        <div key={i} style={{ width: dayWidth, minWidth: dayWidth }}
                                            className={`flex items-center justify-center text-xs border-r border-zinc-100 dark:border-zinc-800 ${isT ? "text-blue-600 dark:text-blue-400 font-bold" : isWe ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}>
                                            {dayWidth >= 16 ? format(day, "d") : (i % 7 === 0 ? format(day, "MMM d") : "")}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Today line + rows */}
                    <div className="relative">
                        {/* Today vertical line */}
                        {todayX >= 0 && todayX <= totalContentWidth && (
                            <div className="absolute top-0 bottom-0 w-px bg-blue-400 dark:bg-blue-500 z-10 pointer-events-none"
                                style={{ left: leftColWidth + todayX }} />
                        )}

                        {groups.map((group) => (
                            <div key={group.key}>
                                {/* Group header (only if grouping is active) */}
                                {groupBy !== "none" && (
                                    <div className="flex items-center bg-zinc-50 dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800 px-3 py-1.5">
                                        <div style={{ width: leftColWidth, minWidth: leftColWidth }} className="flex-shrink-0">
                                            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wide">{group.label}</span>
                                        </div>
                                    </div>
                                )}

                                {group.tasks.length === 0 && (
                                    <div className="flex items-center px-3 py-3 border-b border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400">
                                        <div style={{ width: leftColWidth }}>No tasks</div>
                                    </div>
                                )}

                                {group.tasks.map((task) => {
                                    const startDate = getDate(task, "start_date")
                                    const dueDate = getDate(task, "due_date")
                                    const statusConfig = STATUS_COLORS[task.status] || STATUS_COLORS.TODO

                                    // Bar geometry
                                    const barStart = startDate ? xPos(startDate) : (dueDate ? xPos(dueDate) : null)
                                    const barEnd = dueDate ? xPos(dueDate) + dayWidth : null
                                    const barLeft = barStart !== null ? barStart : null
                                    const barWidth = (barStart !== null && barEnd !== null) ? Math.max(barEnd - barStart, dayWidth) : dayWidth
                                    const isVisible = barLeft !== null && barLeft < totalContentWidth && (barLeft + barWidth) > 0
                                    const isDraggingThis = dragging?.taskId === task.id

                                    return (
                                        <div key={task.id}
                                            className="flex items-center border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition group"
                                            style={{ height: rowHeight }}>
                                            {/* Left col: task name */}
                                            <div style={{ width: leftColWidth, minWidth: leftColWidth }}
                                                className="flex-shrink-0 px-3 border-r border-zinc-100 dark:border-zinc-800 h-full flex items-center gap-2">
                                                <div className={`size-1.5 rounded-full flex-shrink-0 ${statusConfig.bar}`} />
                                                <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{task.title}</span>
                                                {task.assignee?.name && (
                                                    <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0 truncate max-w-16">{task.assignee.name.split(" ")[0]}</span>
                                                )}
                                            </div>

                                            {/* Right col: bar */}
                                            <div className="relative flex-1 h-full">
                                                {/* Weekend shading */}
                                                {headerDays.slice(0, VISIBLE_DAYS).map((day, i) =>
                                                    isWeekend(day) ? (
                                                        <div key={i} className="absolute inset-y-0 bg-zinc-50 dark:bg-zinc-800/30 pointer-events-none"
                                                            style={{ left: i * dayWidth, width: dayWidth }} />
                                                    ) : null
                                                )}

                                                {isVisible && (
                                                    <div
                                                        className={`absolute rounded flex items-center ${statusConfig.bar} ${PRIORITY_COLORS[task.priority] || ""} ${isDraggingThis ? "opacity-80 shadow-lg" : "hover:opacity-90"} transition-opacity`}
                                                        style={{
                                                            left: Math.max(0, barLeft),
                                                            width: barWidth - (barLeft < 0 ? -barLeft : 0),
                                                            top: "50%",
                                                            transform: "translateY(-50%)",
                                                            height: 24,
                                                            zIndex: isDraggingThis ? 20 : 1,
                                                            cursor: "grab",
                                                        }}
                                                        onMouseDown={(e) => {
                                                            // Only trigger move if the click was not on a resize handle
                                                            if (e.target.dataset.resize) return
                                                            handleBarMouseDown(e, task, "move")
                                                        }}
                                                        title={`${task.title}\n${startDate ? format(startDate, "MMM d") : "No start"} → ${dueDate ? format(dueDate, "MMM d") : "No due"}`}
                                                    >
                                                        {/* Left resize handle */}
                                                        {startDate && (
                                                            <div
                                                                data-resize="left"
                                                                className="absolute left-0 top-0 bottom-0 w-3 rounded-l hover:bg-black/20"
                                                                style={{ cursor: "ew-resize" }}
                                                                onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, task, "resize-left") }}
                                                            />
                                                        )}
                                                        <span className="text-xs text-white font-medium truncate select-none px-3">
                                                            {barWidth > 60 ? task.title : ""}
                                                        </span>
                                                        {/* Right resize handle */}
                                                        <div
                                                            data-resize="right"
                                                            className="absolute right-0 top-0 bottom-0 w-3 rounded-r hover:bg-black/20"
                                                            style={{ cursor: "ew-resize" }}
                                                            onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, task, "resize-right") }}
                                                        />
                                                    </div>
                                                )}

                                                {!isVisible && barLeft !== null && (
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                                                        {dueDate ? format(dueDate, "MMM d") : ""}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Unscheduled tasks */}
            {unscheduledTasks.length > 0 && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                            Unscheduled ({unscheduledTasks.length})
                        </p>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {unscheduledTasks.map(task => {
                            const statusConfig = STATUS_COLORS[task.status] || STATUS_COLORS.TODO
                            return (
                                <div key={task.id} className="flex items-center gap-3 px-4 py-2">
                                    <div className={`size-2 rounded-full ${statusConfig.bar}`} />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{task.title}</span>
                                    {task.assignee?.name && (
                                        <span className="text-xs text-zinc-400">{task.assignee.name}</span>
                                    )}
                                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">No dates</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {scheduledTasks.length === 0 && unscheduledTasks.length === 0 && (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
                    <CalendarIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No tasks yet. Create tasks with due dates to see the timeline.</p>
                </div>
            )}
        </div>
    )
}
