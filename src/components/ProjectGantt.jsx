import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import {
    format, addDays, differenceInDays, startOfDay, isToday,
    isWeekend, subDays, parseISO, isBefore
} from "date-fns"
import {
    ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon,
    Loader2Icon, AlertTriangleIcon, LinkIcon
} from "lucide-react"
import toast from "react-hot-toast"

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_H = 44
const HEADER_H = 52
const LEFT_W = 240
const DAY_W = 18
const BAR_H = 22
const BAR_RADIUS = 4

const STATUS_COLORS = {
    TODO:        { fill: "#a1a1aa", stroke: "#71717a" },
    IN_PROGRESS: { fill: "#60a5fa", stroke: "#3b82f6" },
    DONE:        { fill: "#34d399", stroke: "#10b981" },
}

const PRIORITY_STROKE = {
    URGENT: "#ef4444",
    HIGH:   "#f97316",
    MEDIUM: null,
    LOW:    null,
}

// ─── Circular dependency detection (client-side BFS) ─────────────────────────
function wouldCreateCycle(taskId, dependsOnId, existingDeps) {
    // BFS upstream from dependsOnId — if we reach taskId, it's a cycle
    const visited = new Set()
    const queue = [dependsOnId]
    while (queue.length) {
        const current = queue.shift()
        if (current === taskId) return true
        if (visited.has(current)) continue
        visited.add(current)
        existingDeps.filter(d => d.task_id === current).forEach(d => queue.push(d.depends_on_task_id))
    }
    return false
}

// ─── Dependency line (SVG arrow from predecessor bar end to successor bar start)
function DepLine({ x1, y1, x2, y2, selected }) {
    // Route: right from x1,y1 → elbow → left to x2,y2
    const midX = x1 + Math.max(16, (x2 - x1) / 2)
    const d = x2 > x1 + 8
        ? `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`
        : `M${x1},${y1} L${x1 + 12},${y1} L${x1 + 12},${(y1 + y2) / 2} L${x2 - 12},${(y1 + y2) / 2} L${x2 - 12},${y2} L${x2},${y2}`
    return (
        <g>
            <path d={d} fill="none" stroke={selected ? "#f59e0b" : "#94a3b8"} strokeWidth={selected ? 2 : 1.5}
                strokeDasharray={selected ? "0" : "4 3"} markerEnd="url(#arrowhead)" />
        </g>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProjectGantt({ tasks, projectId }) {
    const { user } = useAuth()
    const today = startOfDay(new Date())
    const [viewStart, setViewStart] = useState(subDays(today, 5))
    const [deps, setDeps] = useState([])
    const [loadingDeps, setLoadingDeps] = useState(true)
    const [localDates, setLocalDates] = useState({})
    const [dragging, setDragging] = useState(null)
    const draggingRef = useRef(null)
    const [linking, setLinking] = useState(null) // { fromTaskId } — click mode for adding deps
    const [selectedDep, setSelectedDep] = useState(null)
    const [showDepPanel, setShowDepPanel] = useState(false)
    const svgRef = useRef(null)
    const containerRef = useRef(null)

    const VISIBLE_DAYS = 90
    const viewEnd = addDays(viewStart, VISIBLE_DAYS)
    const totalW = VISIBLE_DAYS * DAY_W

    // Fetch dependencies
    useEffect(() => {
        if (projectId) fetchDeps()
    }, [projectId])

    const fetchDeps = async () => {
        setLoadingDeps(true)
        const taskIds = tasks.map(t => t.id)
        if (!taskIds.length) { setDeps([]); setLoadingDeps(false); return }
        const { data } = await supabase
            .from("task_dependencies")
            .select("id, task_id, depends_on_task_id, dependency_type")
            .in("task_id", taskIds)
        setDeps(data || [])
        setLoadingDeps(false)
    }

    // Date helpers
    const getDate = (task, field) => {
        const override = localDates[task.id]
        if (override?.[field]) return parseISO(override[field])
        if (task[field]) return parseISO(task[field])
        return null
    }

    const xOf = (date) => Math.round(differenceInDays(startOfDay(date), startOfDay(viewStart)) * DAY_W)
    // Tasks with at least a due date
    const scheduledTasks = useMemo(() =>
        tasks.filter(t => t.due_date || localDates[t.id]?.due_date), [tasks, localDates])
    const unscheduledTasks = useMemo(() =>
        tasks.filter(t => !t.due_date && !localDates[t.id]?.due_date), [tasks, localDates])

    // Header days
    const headerDays = useMemo(() =>
        Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(viewStart, i)), [viewStart])

    // Month label positions
    const monthLabels = useMemo(() => {
        const months = []
        let cur = null, startX = 0
        headerDays.forEach((day, i) => {
            const m = format(day, "MMM yyyy")
            if (m !== cur) {
                if (cur) months.push({ label: cur, x: startX })
                cur = m; startX = i * DAY_W
            }
        })
        if (cur) months.push({ label: cur, x: startX })
        return months
    }, [headerDays])

    // Bar geometry for a task
    const barGeom = useCallback((task, rowY) => {
        const start = getDate(task, "start_date")
        const due = getDate(task, "due_date")
        if (!due) return null
        const barLeft = start ? xOf(start) : xOf(due)
        const barRight = xOf(due) + DAY_W
        const w = Math.max(barRight - barLeft, DAY_W)
        const barY = rowY + (ROW_H - BAR_H) / 2
        return { x: barLeft, y: barY, w, cx: barLeft + w, cy: barY + BAR_H / 2 }
    }, [localDates, viewStart])

    // Row index map
    const rowMap = useMemo(() => {
        const m = {}
        scheduledTasks.forEach((t, i) => { m[t.id] = i })
        return m
    }, [scheduledTasks])

    // ─── Drag handling — use ref to avoid stale closure in mousemove ────────
    const handleBarMouseDown = (e, task, mode) => {
        if (linking) return
        e.preventDefault()
        e.stopPropagation()
        const startDate = getDate(task, "start_date")
        const dueDate = getDate(task, "due_date")
        const dragState = { taskId: task.id, startX: e.clientX, origStart: startDate, origEnd: dueDate, mode }
        draggingRef.current = dragState
        setDragging(dragState)
    }

    const handleMouseMove = useCallback((e) => {
        const drag = draggingRef.current
        if (!drag) return
        const dx = e.clientX - drag.startX
        const daysDelta = Math.round(dx / DAY_W)
        const { taskId, origStart, origEnd, mode } = drag
        let ns = origStart, ne = origEnd

        if (mode === "move") {
            if (ne) ne = addDays(origEnd, daysDelta)
            if (ns) ns = addDays(origStart, daysDelta)
        } else if (mode === "resize-left") {
            const base = ns || (ne ? subDays(ne, 1) : today)
            ns = addDays(base, daysDelta)
            if (ne && ns >= ne) ns = subDays(ne, 1)
        } else if (mode === "resize-right") {
            const base = ne || today
            if (!ns) ns = base
            ne = addDays(base, daysDelta)
            if (ns && ne <= ns) ne = addDays(ns, 1)
        }
        setLocalDates(prev => ({
            ...prev,
            [taskId]: {
                start_date: ns ? format(ns, "yyyy-MM-dd") : null,
                due_date: ne ? format(ne, "yyyy-MM-dd") : null,
            }
        }))
    }, [today])

    const handleMouseUp = useCallback(() => {
        const drag = draggingRef.current
        if (!drag) return
        draggingRef.current = null
        setDragging(null)
        setLocalDates(prev => {
            const override = prev[drag.taskId]
            if (override) {
                const updates = {}
                if (override.start_date !== undefined) updates.start_date = override.start_date
                if (override.due_date !== undefined) updates.due_date = override.due_date
                supabase.from("tasks")
                    .update({ ...updates, updated_at: new Date().toISOString() })
                    .eq("id", drag.taskId)
                    .then(({ error }) => {
                        if (error) toast.error("Failed to save dates")
                        else toast.success("Dates updated")
                    })
            }
            return prev
        })
    }, [])

    useEffect(() => {
        if (!dragging) return
        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("mouseup", handleMouseUp)
        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mouseup", handleMouseUp)
        }
    }, [dragging, handleMouseMove, handleMouseUp])

    // ─── Link mode ──────────────────────────────────────────────────────────
    const handleBarClick = async (task) => {
        if (!linking) return
        if (linking.fromTaskId === task.id) { setLinking(null); return }

        // Cycle check
        if (wouldCreateCycle(linking.fromTaskId, task.id, deps)) {
            toast.error("This would create a circular dependency")
            setLinking(null)
            return
        }

        const { error } = await supabase.from("task_dependencies").insert({
            task_id: linking.fromTaskId,
            depends_on_task_id: task.id,
            dependency_type: "blocks",
            created_by: user.id,
        })
        if (error?.code === "23505") { toast("Already linked"); setLinking(null); return }
        if (error) { toast.error("Failed to add dependency"); setLinking(null); return }
        toast.success("Dependency added")
        setLinking(null)
        fetchDeps()
    }

    const handleDeleteDep = async (depId) => {
        await supabase.from("task_dependencies").delete().eq("id", depId)
        setDeps(prev => prev.filter(d => d.id !== depId))
        setSelectedDep(null)
        toast.success("Dependency removed")
    }

    // ─── Schedule slippage detection ────────────────────────────────────────
    const slippedTaskIds = useMemo(() => {
        const slipped = new Set()
        deps.forEach(dep => {
            const predecessor = tasks.find(t => t.id === dep.depends_on_task_id)
            const successor = tasks.find(t => t.id === dep.task_id)
            if (!predecessor || !successor) return
            const predEnd = getDate(predecessor, "due_date")
            const succStart = getDate(successor, "start_date") || getDate(successor, "due_date")
            if (predEnd && succStart && isBefore(succStart, predEnd)) {
                slipped.add(dep.task_id)
            }
        })
        return slipped
    }, [deps, tasks, localDates])

    const svgH = scheduledTasks.length * ROW_H + HEADER_H + 8
    const todayX = xOf(today)

    if (loadingDeps) return (
        <div className="flex justify-center py-12">
            <Loader2Icon className="size-6 animate-spin text-zinc-400" />
        </div>
    )

    return (
        <div className="space-y-3">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                    <button onClick={() => setViewStart(p => subDays(p, 14))}
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-400">
                        <ChevronLeftIcon className="size-4" />
                    </button>
                    <button onClick={() => setViewStart(subDays(today, 5))}
                        className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                        Today
                    </button>
                    <button onClick={() => setViewStart(p => addDays(p, 14))}
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-400">
                        <ChevronRightIcon className="size-4" />
                    </button>
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {format(viewStart, "MMM d")} – {format(viewEnd, "MMM d, yyyy")}
                </span>
                {slippedTaskIds.size > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-600 dark:text-amber-400 text-xs">
                        <AlertTriangleIcon className="size-3.5" />
                        {slippedTaskIds.size} schedule slip{slippedTaskIds.size !== 1 ? "s" : ""}
                    </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => setLinking(linking ? null : { fromTaskId: null })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border transition ${linking ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}>
                        <LinkIcon className="size-3.5" />
                        {linking?.fromTaskId ? "Click successor task" : linking ? "Click a task to start" : "Add dependency"}
                    </button>
                    {deps.length > 0 && (
                        <button onClick={() => setShowDepPanel(!showDepPanel)}
                            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700">
                            {deps.length} dep{deps.length !== 1 ? "s" : ""}
                        </button>
                    )}
                </div>
            </div>

            {/* Dependency list panel */}
            {showDepPanel && (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 bg-white dark:bg-zinc-900/60 space-y-1.5">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Dependencies</p>
                    {deps.map(dep => {
                        const from = tasks.find(t => t.id === dep.task_id)
                        const to = tasks.find(t => t.id === dep.depends_on_task_id)
                        if (!from || !to) return null
                        return (
                            <div key={dep.id} className="flex items-center gap-2 text-sm">
                                <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-40">{from.title}</span>
                                <span className="text-zinc-400 text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{dep.dependency_type}</span>
                                <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-40">{to.title}</span>
                                <button onClick={() => handleDeleteDep(dep.id)}
                                    className="ml-auto text-zinc-300 hover:text-red-500 transition flex-shrink-0">
                                    <XIcon className="size-3.5" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Main Gantt grid */}
            <div
                ref={containerRef}
                className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
            >
                <div style={{ minWidth: LEFT_W + totalW }} className="select-none">
                    {/* Left column header */}
                    <div className="flex sticky top-0 z-20 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                        <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                            className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 px-3 flex items-end pb-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Task</span>
                        </div>
                        {/* SVG header */}
                        <svg width={totalW} height={HEADER_H} className="flex-shrink-0">
                            {/* Weekend shading */}
                            {headerDays.map((day, i) => isWeekend(day) ? (
                                <rect key={i} x={i * DAY_W} y={0} width={DAY_W} height={HEADER_H}
                                    fill="currentColor" className="text-zinc-50 dark:text-zinc-800/60" />
                            ) : null)}
                            {/* Month labels */}
                            {monthLabels.map((m, i) => (
                                <text key={i} x={m.x + 4} y={16} fontSize={10} fontWeight={600}
                                    fill="currentColor" className="text-zinc-500 dark:text-zinc-400">
                                    {m.label}
                                </text>
                            ))}
                            {/* Day labels */}
                            {headerDays.map((day, i) => {
                                const isT = isToday(day)
                                const isWe = isWeekend(day)
                                return (
                                    <text key={i} x={i * DAY_W + DAY_W / 2} y={42} textAnchor="middle"
                                        fontSize={9} fontWeight={isT ? 700 : 400}
                                        fill={isT ? "#3b82f6" : isWe ? "#a1a1aa" : "currentColor"}
                                        className={isT ? "" : "text-zinc-400 dark:text-zinc-500"}>
                                        {format(day, "d")}
                                    </text>
                                )
                            })}
                            {/* Today line in header */}
                            {todayX >= 0 && todayX <= totalW && (
                                <line x1={todayX + DAY_W / 2} y1={0} x2={todayX + DAY_W / 2} y2={HEADER_H}
                                    stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.6} />
                            )}
                        </svg>
                    </div>

                    {/* Rows */}
                    <div className="flex">
                        {/* Left column: task names */}
                        <div style={{ width: LEFT_W, minWidth: LEFT_W }} className="flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800">
                            {scheduledTasks.map((task) => {
                                const isSlipped = slippedTaskIds.has(task.id)
                                const isLinkFrom = linking?.fromTaskId === task.id
                                return (
                                    <div key={task.id}
                                        style={{ height: ROW_H }}
                                        onClick={() => {
                                            if (linking && !linking.fromTaskId) {
                                                setLinking({ fromTaskId: task.id })
                                            } else if (linking?.fromTaskId && linking.fromTaskId !== task.id) {
                                                handleBarClick(task)
                                            }
                                        }}
                                        className={`flex items-center px-3 gap-2 border-b border-zinc-50 dark:border-zinc-800/60 ${linking ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40" : ""} ${isLinkFrom ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                                        <div className={`size-2 rounded-full flex-shrink-0 ${task.status === "DONE" ? "bg-emerald-400" : task.status === "IN_PROGRESS" ? "bg-blue-400" : "bg-zinc-300"}`} />
                                        <span className={`text-xs truncate flex-1 ${isSlipped ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                                            {task.title}
                                        </span>
                                        {isSlipped && <AlertTriangleIcon className="size-3 text-amber-500 flex-shrink-0" />}
                                        {isLinkFrom && <span className="text-xs text-blue-500 flex-shrink-0">↓</span>}
                                    </div>
                                )
                            })}
                            {unscheduledTasks.length > 0 && (
                                <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800">
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500">{unscheduledTasks.length} unscheduled</p>
                                    {unscheduledTasks.map(t => (
                                        <p key={t.id} className="text-xs text-zinc-400 truncate py-0.5">{t.title}</p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* SVG chart area */}
                        <svg
                            ref={svgRef}
                            width={totalW}
                            height={svgH}
                            className="flex-shrink-0 cursor-default"
                            style={{ cursor: linking ? "crosshair" : "default" }}
                        >
                            <defs>
                                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                                    <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
                                </marker>
                            </defs>

                            {/* Weekend shading */}
                            {headerDays.map((day, i) => isWeekend(day) ? (
                                <rect key={i} x={i * DAY_W} y={0} width={DAY_W} height={svgH}
                                    fill="currentColor" className="text-zinc-50 dark:text-zinc-800/30" />
                            ) : null)}

                            {/* Row dividers */}
                            {scheduledTasks.map((_, i) => (
                                <line key={i} x1={0} y1={HEADER_H + (i + 1) * ROW_H - 0.5}
                                    x2={totalW} y2={HEADER_H + (i + 1) * ROW_H - 0.5}
                                    stroke="currentColor" strokeWidth={0.5} className="text-zinc-100 dark:text-zinc-800/60" />
                            ))}

                            {/* Today line */}
                            {todayX >= 0 && todayX <= totalW && (
                                <line x1={todayX + DAY_W / 2} y1={0} x2={todayX + DAY_W / 2} y2={svgH}
                                    stroke="#3b82f6" strokeWidth={1.5} opacity={0.5} />
                            )}

                            {/* Dependency lines — drawn below bars */}
                            {deps.map(dep => {
                                const fromRow = rowMap[dep.task_id]
                                const toRow = rowMap[dep.depends_on_task_id]
                                if (fromRow === undefined || toRow === undefined) return null
                                const fromTask = scheduledTasks[fromRow]
                                const toTask = scheduledTasks[toRow]
                                if (!fromTask || !toTask) return null
                                const fromGeom = barGeom(fromTask, HEADER_H + fromRow * ROW_H)
                                const toGeom = barGeom(toTask, HEADER_H + toRow * ROW_H)
                                if (!fromGeom || !toGeom) return null
                                return (
                                    <DepLine
                                        key={dep.id}
                                        x1={toGeom.cx}
                                        y1={toGeom.cy}
                                        x2={fromGeom.x}
                                        y2={fromGeom.cy}
                                        selected={selectedDep === dep.id}
                                    />
                                )
                            })}

                            {/* Task bars */}
                            {scheduledTasks.map((task, i) => {
                                const rowY = HEADER_H + i * ROW_H
                                const geom = barGeom(task, rowY)
                                if (!geom) return null
                                const { x, y, w } = geom
                                const colors = STATUS_COLORS[task.status] || STATUS_COLORS.TODO
                                const priorityStroke = PRIORITY_STROKE[task.priority]
                                const isDraggingThis = dragging?.taskId === task.id
                                const isSlipped = slippedTaskIds.has(task.id)
                                const inView = x < totalW && x + w > 0
                                if (!inView) return null

                                const barFill = isSlipped ? "#fbbf24" : colors.fill
                                const barStroke = priorityStroke || (isSlipped ? "#f59e0b" : colors.stroke)

                                return (
                                    <g key={task.id}
                                        style={{ cursor: linking ? "pointer" : isDraggingThis ? "grabbing" : "grab" }}
                                        onClick={() => linking?.fromTaskId && handleBarClick(task)}>
                                        {/* Bar background — move handler only on the bar body, not the whole group */}
                                        <rect x={Math.max(0, x)} y={y} width={w - Math.max(0, -x)} height={BAR_H}
                                            rx={BAR_RADIUS} ry={BAR_RADIUS}
                                            fill={barFill} stroke={barStroke} strokeWidth={1.5}
                                            opacity={isDraggingThis ? 0.7 : 1}
                                            onMouseDown={(e) => !linking && handleBarMouseDown(e, task, "move")} />

                                        {/* Milestone diamond overlay */}
                                        {task.milestone && (
                                            <polygon
                                                points={`${x + w / 2},${y - 4} ${x + w / 2 + 8},${y + BAR_H / 2} ${x + w / 2},${y + BAR_H + 4} ${x + w / 2 - 8},${y + BAR_H / 2}`}
                                                fill="#f59e0b" stroke="#d97706" strokeWidth={1} opacity={0.85}
                                                style={{ pointerEvents: "none" }} />
                                        )}

                                        {/* Completion overlay */}
                                        {task.status === "DONE" && (
                                            <rect x={Math.max(0, x)} y={y} width={w - Math.max(0, -x)} height={BAR_H}
                                                rx={BAR_RADIUS} ry={BAR_RADIUS}
                                                fill="rgba(255,255,255,0.25)"
                                                style={{ pointerEvents: "none" }} />
                                        )}

                                        {/* Label */}
                                        {w > 40 && (
                                            <text x={Math.max(6, x + 6)} y={y + BAR_H / 2 + 4}
                                                fontSize={10} fontWeight={500} fill="white"
                                                style={{ pointerEvents: "none", userSelect: "none" }}>
                                                <tspan>{w > 80 ? task.title.slice(0, Math.floor(w / 8)) + (task.title.length > Math.floor(w / 8) ? "…" : "") : ""}</tspan>
                                            </text>
                                        )}

                                        {/* Resize handles — placed AFTER bar so they sit on top and capture events first */}
                                        {/* Left resize handle */}
                                        {getDate(task, "start_date") && (
                                            <rect x={Math.max(0, x)} y={y} width={8} height={BAR_H}
                                                rx={BAR_RADIUS} fill="rgba(0,0,0,0.0)"
                                                style={{ cursor: "ew-resize" }}
                                                onMouseDown={(e) => { e.stopPropagation(); !linking && handleBarMouseDown(e, task, "resize-left") }} />
                                        )}

                                        {/* Right resize handle */}
                                        <rect x={Math.max(0, x) + w - 8 - Math.max(0, -x)} y={y} width={8} height={BAR_H}
                                            rx={BAR_RADIUS} fill="rgba(0,0,0,0.0)"
                                            style={{ cursor: "ew-resize" }}
                                            onMouseDown={(e) => { e.stopPropagation(); !linking && handleBarMouseDown(e, task, "resize-right") }} />

                                        {/* Link button (appears on hover via CSS isn't easy in SVG — show when in link mode) */}
                                        {linking && !linking.fromTaskId && (
                                            <rect x={Math.max(0, x)} y={y} width={w} height={BAR_H}
                                                rx={BAR_RADIUS} fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth={1.5} />
                                        )}
                                        {linking?.fromTaskId && linking.fromTaskId !== task.id && (
                                            <rect x={Math.max(0, x)} y={y} width={w} height={BAR_H}
                                                rx={BAR_RADIUS} fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth={1.5} />
                                        )}
                                    </g>
                                )
                            })}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-zinc-300 inline-block" /> To Do</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-blue-400 inline-block" /> In Progress</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-emerald-400 inline-block" /> Done</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-amber-400 inline-block" /> Schedule slip</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rotate-45 bg-amber-400 inline-block" /> Milestone</span>
                <span className="text-zinc-300 dark:text-zinc-600">|</span>
                <span>Drag bars to shift dates · Drag edges to resize · Use "Add dependency" to connect tasks</span>
            </div>
        </div>
    )
}
