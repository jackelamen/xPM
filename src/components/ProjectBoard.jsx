import { useState } from "react"
import { useDispatch } from "react-redux"
import { updateTaskStatus } from "../features/workspaceSlice"
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
} from "@dnd-kit/core"
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { format } from "date-fns"
import { CalendarIcon, FlagIcon } from "lucide-react"
import toast from "react-hot-toast"

const COLUMNS = [
    { id: "TODO", label: "To Do", color: "bg-zinc-400" },
    { id: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500" },
    { id: "DONE", label: "Done", color: "bg-emerald-500" },
]

const priorityColors = {
    LOW: "text-zinc-400",
    MEDIUM: "text-blue-500",
    HIGH: "text-orange-500",
    URGENT: "text-red-500",
}

const typeColors = {
    TASK: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    BUG: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    FEATURE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    IMPROVEMENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    OTHER: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
}

// Individual draggable task card
function TaskCard({ task, onTaskClick, isDragging }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onTaskClick && onTaskClick(task.id)}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all select-none"
        >
            {/* Type badge */}
            <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColors[task.type] || typeColors.TASK}`}>
                    {task.type}
                </span>
                {task.priority && (
                    <FlagIcon className={`size-3 ${priorityColors[task.priority] || "text-zinc-400"}`} />
                )}
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-snug mb-2">
                {task.title}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between mt-2">
                {task.assignee ? (
                    <div className="size-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-medium">
                        {(task.assignee.name || task.assignee.email || "?")[0].toUpperCase()}
                    </div>
                ) : (
                    <div className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                )}

                {task.due_date && (
                    <div className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
                        <CalendarIcon className="size-3" />
                        {format(new Date(task.due_date), "MMM d")}
                    </div>
                )}
            </div>
        </div>
    )
}

// Drag overlay card (shown while dragging)
function DragCard({ task }) {
    return (
        <div className="bg-white dark:bg-zinc-900 border border-blue-400 dark:border-blue-500 rounded-lg p-3 shadow-lg rotate-1 w-64">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColors[task.type] || typeColors.TASK}`}>
                {task.type}
            </span>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 mt-2 leading-snug">
                {task.title}
            </p>
        </div>
    )
}

// Column component
function Column({ column, tasks, onTaskClick, activeId }) {
    const { setNodeRef, isOver } = useSortable({ id: column.id })

    return (
        <div ref={setNodeRef} className="flex flex-col min-w-72 max-w-72 flex-shrink-0">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`size-2 rounded-full ${column.color}`} />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {column.label}
                </span>
                <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                    {tasks.length}
                </span>
            </div>

            {/* Cards */}
            <div className={`flex-1 rounded-lg p-2 min-h-32 space-y-2 transition-colors ${
                isOver
                    ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-300 dark:ring-blue-700"
                    : "bg-zinc-50 dark:bg-zinc-900/50"
            }`}>
                <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onTaskClick={onTaskClick}
                            isDragging={activeId === task.id}
                        />
                    ))}
                </SortableContext>

                {tasks.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-xs text-zinc-400 dark:text-zinc-600">
                        Drop tasks here
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ProjectBoard({ tasks, projectId, onTaskClick }) {
    const dispatch = useDispatch()
    const [activeId, setActiveId] = useState(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    )

    const activeTask = tasks.find((t) => t.id === activeId)

    const tasksByStatus = COLUMNS.reduce((acc, col) => {
        acc[col.id] = tasks.filter((t) => t.status === col.id)
        return acc
    }, {})

    const getColumnForTask = (taskId) => {
        for (const col of COLUMNS) {
            if (tasksByStatus[col.id].find((t) => t.id === taskId)) return col.id
        }
        return null
    }

    const handleDragStart = ({ active }) => {
        setActiveId(active.id)
    }

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null)
        if (!over || active.id === over.id) return

        const sourceStatus = getColumnForTask(active.id)

        // Check if dropped on a column id directly
        const targetColumn = COLUMNS.find((c) => c.id === over.id)
        const targetStatus = targetColumn
            ? targetColumn.id
            : getColumnForTask(over.id)

        if (!targetStatus || sourceStatus === targetStatus) return

        try {
            await dispatch(updateTaskStatus({
                taskId: active.id,
                projectId,
                status: targetStatus,
            })).unwrap()
        } catch {
            toast.error("Failed to update task status")
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4">
                <SortableContext items={COLUMNS.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {COLUMNS.map((col) => (
                        <Column
                            key={col.id}
                            column={col}
                            tasks={tasksByStatus[col.id]}
                            onTaskClick={onTaskClick}
                            activeId={activeId}
                        />
                    ))}
                </SortableContext>
            </div>

            <DragOverlay>
                {activeTask ? <DragCard task={activeTask} /> : null}
            </DragOverlay>
        </DndContext>
    )
}
