import { format } from "date-fns";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { deleteTasks, updateTaskStatus, archiveTasks } from "../features/workspaceSlice";
import { CalendarIcon, MessageSquare, CheckCircle2, Circle, Trash, XIcon, DownloadIcon, Users, PenLine, Lightbulb, Palette, ClipboardList, ArchiveIcon, Mail } from "lucide-react";
import SavedViews from "./SavedViews";
import UserAvatar from "./UserAvatar";

import FieldManager, { BUILTIN_FIELDS } from "./FieldManager";

const typeIcons = {
    MEETING: { icon: Users, color: "text-blue-600 dark:text-blue-400" },
    WRITING: { icon: PenLine, color: "text-green-600 dark:text-green-400" },
    STRATEGY: { icon: Lightbulb, color: "text-amber-600 dark:text-amber-400" },
    DESIGN: { icon: Palette, color: "text-purple-600 dark:text-purple-400" },
    ADMIN: { icon: ClipboardList, color: "text-zinc-600 dark:text-zinc-400" },
    OUTREACH: { icon: Mail, color: "text-teal-600 dark:text-teal-400" },
    OTHER: { icon: MessageSquare, color: "text-rose-600 dark:text-rose-400" },
};

const StackedAvatars = ({ assignees, size = 20 }) => {
    if (!assignees?.length) return <span className="text-zinc-400 text-xs">—</span>;
    const visible = assignees.slice(0, 3);
    const overflow = assignees.length - visible.length;
    return (
        <div className="flex items-center -space-x-1.5">
            {visible.map((a) => <UserAvatar key={a.id} user={a} size={size} />)}
            {overflow > 0 && (
                <span className="flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium border-2 border-white dark:border-zinc-900"
                    style={{ width: size, height: size }}>
                    +{overflow}
                </span>
            )}
        </div>
    );
};

const priorityTexts = {
    LOW: { background: "bg-red-100 dark:bg-red-950", prioritycolor: "text-red-600 dark:text-red-400" },
    MEDIUM: { background: "bg-blue-100 dark:bg-blue-950", prioritycolor: "text-blue-600 dark:text-blue-400" },
    HIGH: { background: "bg-emerald-100 dark:bg-emerald-950", prioritycolor: "text-emerald-600 dark:text-emerald-400" },
};

const ProjectTasks = ({ tasks, onTaskClick, projectId, onRefresh, fieldDefinitions = [] }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [selectedTasks, setSelectedTasks] = useState([]);
    const [hoveredTask, setHoveredTask] = useState(null);
    const [optimisticStatuses, setOptimisticStatuses] = useState({});

    const handleToggleComplete = async (e, task) => {
        e.stopPropagation();
        const currentStatus = optimisticStatuses[task.id] ?? task.status;
        const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
        // Update UI immediately
        setOptimisticStatuses((prev) => ({ ...prev, [task.id]: newStatus }));
        try {
            await dispatch(updateTaskStatus({ taskId: task.id, projectId: task.project_id, status: newStatus })).unwrap();
            // On success, clear the optimistic override (Redux state now has the real value)
            setOptimisticStatuses((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
        } catch {
            // Revert on failure
            setOptimisticStatuses((prev) => { const next = { ...prev }; delete next[task.id]; return next; });
            toast.error("Failed to update task");
        }
    };

    const isSelecting = selectedTasks.length > 0;

    // Builtin column visibility — persisted per project in localStorage
    const storageKey = `field_visibility_${projectId}`;
    const [builtinVisible, setBuiltinVisible] = useState(() => {
        try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
        catch { return {}; }
    });

    const handleBuiltinVisibilityChange = (key, visible) => {
        setBuiltinVisible((prev) => {
            const next = { ...prev, [key]: visible };
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });
    };

    // Custom field columns that are currently visible (sorted by position)
    const visibleCustomFields = useMemo(
        () => [...fieldDefinitions]
            .sort((a, b) => a.position - b.position)
            .filter((f) => f.visible),
        [fieldDefinitions]
    );

    const handleExportCSV = () => {
        const headers = ["Title", "Status", "Type", "Priority", "Assignee", "Due Date", "Created"]
        const rows = tasks.map((t) => [
            `"${(t.title || "").replace(/"/g, '""')}"`,
            t.status || "",
            t.type || "",
            t.priority || "",
            (t.assignees?.length ? t.assignees.map((a) => a.name || a.email).join("; ") : t.assignee?.name || t.assignee?.email || ""),
            t.due_date ? format(new Date(t.due_date), "yyyy-MM-dd") : "",
            t.created_at ? format(new Date(t.created_at), "yyyy-MM-dd") : "",
        ])
        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `tasks-${format(new Date(), "yyyy-MM-dd")}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Tasks exported")
    };

    const [filters, setFilters] = useState({
        status: "",
        type: "",
        priority: "",
        assignee: "",
    });

    const assigneeList = useMemo(
        () => Array.from(new Set(
            tasks.flatMap((t) =>
                t.assignees?.length ? t.assignees.map((a) => a.name) : (t.assignee?.name ? [t.assignee.name] : [])
            ).filter(Boolean)
        )),
        [tasks]
    );

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const { status, type, priority, assignee } = filters;
            return (
                (!status || task.status === status) &&
                (!type || task.type === type) &&
                (!priority || task.priority === priority) &&
                (!assignee || (task.assignees?.length ? task.assignees.some((a) => a.name === assignee) : task.assignee?.name === assignee))
            );
        });
    }, [filters, tasks]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const task = tasks.find((t) => t.id === taskId)
            await dispatch(updateTaskStatus({ taskId, projectId: task.project_id, status: newStatus })).unwrap()
            toast.success("Status updated")
        } catch (error) {
            toast.error(error || "Failed to update status")
        }
    };

    const handleDelete = async () => {
        try {
            const confirm = window.confirm("Are you sure you want to delete the selected tasks?");
            if (!confirm) return;

            const task = tasks.find((t) => selectedTasks.includes(t.id))
            toast.loading("Deleting tasks...");
            await dispatch(deleteTasks({ taskIds: selectedTasks, projectId: task?.project_id })).unwrap()
            setSelectedTasks([])
            toast.dismissAll();
            toast.success("Tasks deleted");
        } catch (error) {
            toast.dismissAll();
            toast.error(error || "Failed to delete tasks")
        }
    };

    const handleArchiveTasks = async () => {
        try {
            const task = tasks.find((t) => selectedTasks.includes(t.id))
            toast.loading("Archiving tasks...");
            await dispatch(archiveTasks({ taskIds: selectedTasks, projectId: task?.project_id })).unwrap()
            setSelectedTasks([])
            toast.dismissAll();
            toast.success(`${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''} archived`);
        } catch (error) {
            toast.dismissAll();
            toast.error(error || "Failed to archive tasks")
        }
    };

    return (
        <div>
            {/* Filters + Saved Views */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
                <SavedViews
                    projectId={projectId}
                    viewType="list"
                    currentFilters={filters}
                    onLoadView={(savedFilters) => setFilters({ status: "", type: "", priority: "", assignee: "", ...savedFilters })}
                />
                {["status", "type", "priority", "assignee"].map((name) => {
                    const options = {
                        status: [
                            { label: "All Statuses", value: "" },
                            { label: "To Do", value: "TODO" },
                            { label: "In Progress", value: "IN_PROGRESS" },
                            { label: "Done", value: "DONE" },
                        ],
                        type: [
                            { label: "All Types", value: "" },
                            { label: "Meeting", value: "MEETING" },
                            { label: "Writing", value: "WRITING" },
                            { label: "Strategy", value: "STRATEGY" },
                            { label: "Design", value: "DESIGN" },
                            { label: "Admin", value: "ADMIN" },
                            { label: "Outreach", value: "OUTREACH" },
                            { label: "Other", value: "OTHER" },
                        ],
                        priority: [
                            { label: "All Priorities", value: "" },
                            { label: "Low", value: "LOW" },
                            { label: "Medium", value: "MEDIUM" },
                            { label: "High", value: "HIGH" },
                        ],
                        assignee: [
                            { label: "All Assignees", value: "" },
                            ...assigneeList.map((n) => ({ label: n, value: n })),
                        ],
                    };
                    return (
                        <select key={name} name={name} onChange={handleFilterChange} className=" border not-dark:bg-white border-zinc-300 dark:border-zinc-800 outline-none px-3 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200" >
                            {options[name].map((opt, idx) => (
                                <option key={idx} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    );
                })}

                {/* Reset filters */}
                {(filters.status || filters.type || filters.priority || filters.assignee) && (
                    <button type="button" onClick={() => setFilters({ status: "", type: "", priority: "", assignee: "" })} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-purple-400 to-purple-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors" >
                        <XIcon className="size-3" /> Reset
                    </button>
                )}

                {selectedTasks.length > 0 && (
                    <>
                        <button type="button" onClick={handleArchiveTasks} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors">
                            <ArchiveIcon className="size-3" /> Archive ({selectedTasks.length})
                        </button>
                        <button type="button" onClick={handleDelete} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-indigo-400 to-indigo-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors">
                            <Trash className="size-3" /> Delete
                        </button>
                    </>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <FieldManager
                        projectId={projectId}
                        fieldDefs={fieldDefinitions}
                        builtinVisible={builtinVisible}
                        onBuiltinVisibilityChange={handleBuiltinVisibilityChange}
                    />
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="px-3 py-1 flex items-center gap-2 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                        <DownloadIcon className="size-3" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Tasks Table */}
            <div className="overflow-auto rounded-lg lg:border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="w-full">
                    {/* Desktop/Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full text-sm text-left bg-zinc-50 not-dark:bg-zinc-50 text-zinc-900 dark:text-zinc-300 dark:bg-zinc-900/40">
                            <thead className="text-xs uppercase dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 ">
                                <tr>
                                    {/* Combined checkbox + circle column */}
                                    <th className="pl-4 pr-3 w-14">
                                        {isSelecting && (
                                            <input
                                                onChange={() => selectedTasks.length === tasks.length ? setSelectedTasks([]) : setSelectedTasks(tasks.map((t) => t.id))}
                                                checked={selectedTasks.length === tasks.length}
                                                type="checkbox"
                                                className="size-3 accent-zinc-600 dark:accent-zinc-500"
                                            />
                                        )}
                                    </th>
                                    <th className="px-4 pl-0 py-3">Title</th>
                                    {builtinVisible.type !== false && <th className="px-4 py-3">Type</th>}
                                    {builtinVisible.priority !== false && <th className="px-4 py-3">Priority</th>}
                                    {builtinVisible.status !== false && <th className="px-4 py-3">Status</th>}
                                    {builtinVisible.assignee !== false && <th className="px-4 py-3">Assignee</th>}
                                    {builtinVisible.start_date === true && <th className="px-4 py-3">Start Date</th>}
                                    {builtinVisible.due_date !== false && <th className="px-4 py-3">Due Date</th>}
                                    {visibleCustomFields.map((f) => (
                                        <th key={f.key} className="px-4 py-3">{f.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.length > 0 ? (
                                    filteredTasks.map((task) => {
                                        const { icon: Icon, color } = typeIcons[task.type] || {};
                                        const { background, prioritycolor } = priorityTexts[task.priority] || {};

                                        const effectiveStatus = optimisticStatuses[task.id] ?? task.status;
                                        const isDone = effectiveStatus === "DONE";

                                        return (
                                            <tr
                                                key={task.id}
                                                onClick={() => onTaskClick && onTaskClick(task.id)}
                                                onMouseEnter={() => setHoveredTask(task.id)}
                                                onMouseLeave={() => setHoveredTask(null)}
                                                className={`border-t border-zinc-300 dark:border-zinc-800 group hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all cursor-pointer ${isDone ? "opacity-50" : ""}`}
                                            >
                                                {/* Combined checkbox + circle cell */}
                                                <td onClick={e => e.stopPropagation()} className="pl-4 pr-3 w-14">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`transition-opacity ${(isSelecting || hoveredTask === task.id) ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                                                            <input
                                                                type="checkbox"
                                                                className="size-3 accent-zinc-600 dark:accent-zinc-500"
                                                                onChange={() => selectedTasks.includes(task.id) ? setSelectedTasks(selectedTasks.filter((i) => i !== task.id)) : setSelectedTasks((prev) => [...prev, task.id])}
                                                                checked={selectedTasks.includes(task.id)}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleToggleComplete(e, task)}
                                                            className="flex items-center justify-center text-zinc-400 hover:text-emerald-500 transition-colors shrink-0"
                                                            title={isDone ? "Mark incomplete" : "Mark complete"}
                                                        >
                                                            {isDone
                                                                ? <CheckCircle2 className="size-4 text-emerald-500" />
                                                                : <Circle className="size-4" />
                                                            }
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className={`px-4 pl-0 py-2 ${isDone ? "line-through text-zinc-400 dark:text-zinc-500" : ""}`}>{task.title}</td>
                                                {builtinVisible.type !== false && (
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            {Icon && <Icon className={`size-4 ${color}`} />}
                                                            <span className={`uppercase text-xs ${color}`}>{task.type}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                {builtinVisible.priority !== false && (
                                                    <td className="px-4 py-2">
                                                        <span className={`text-xs px-2 py-1 rounded ${background} ${prioritycolor}`}>
                                                            {task.priority}
                                                        </span>
                                                    </td>
                                                )}
                                                {builtinVisible.status !== false && (
                                                    <td onClick={e => e.stopPropagation()} className="px-4 py-2">
                                                        <select name="status" onChange={(e) => handleStatusChange(task.id, e.target.value)} value={task.status} className="group-hover:ring ring-zinc-100 outline-none px-2 pr-4 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200 cursor-pointer" >
                                                            <option value="TODO">To Do</option>
                                                            <option value="IN_PROGRESS">In Progress</option>
                                                            <option value="DONE">Done</option>
                                                        </select>
                                                    </td>
                                                )}
                                                {builtinVisible.assignee !== false && (
                                                    <td className="px-4 py-2">
                                                        <StackedAvatars assignees={task.assignees?.length ? task.assignees : (task.assignee ? [task.assignee] : [])} />
                                                    </td>
                                                )}
                                                {builtinVisible.start_date === true && (
                                                    <td className="px-4 py-2">
                                                        {task.start_date ? (
                                                            <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                                                                <CalendarIcon className="size-4" />
                                                                {format(new Date(task.start_date), "dd MMM")}
                                                            </div>
                                                        ) : <span className="text-zinc-400">—</span>}
                                                    </td>
                                                )}
                                                {builtinVisible.due_date !== false && (
                                                    <td className="px-4 py-2">
                                                        {task.due_date ? (
                                                            <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                                <CalendarIcon className="size-4 shrink-0" />
                                                                {format(new Date(task.due_date), "dd MMMM")}
                                                                {task.due_time && (
                                                                    <span className="text-zinc-400 dark:text-zinc-500 text-xs">· {task.due_time.slice(0, 5)}</span>
                                                                )}
                                                            </div>
                                                        ) : <span className="text-zinc-400">—</span>}
                                                    </td>
                                                )}
                                                {visibleCustomFields.map((f) => {
                                                    const val = task.custom_fields?.[f.key] || "";
                                                    return (
                                                        <td key={f.key} className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                                                            {f.field_type === "tags" && val ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {String(val).split(",").filter(Boolean).map((tag, i) => (
                                                                        <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs">{tag.trim()}</span>
                                                                    ))}
                                                                </div>
                                                            ) : f.field_type === "date" && val ? (
                                                                <div className="flex items-center gap-1">
                                                                    <CalendarIcon className="size-3.5" />
                                                                    {format(new Date(val), "dd MMM")}
                                                                </div>
                                                            ) : (
                                                                <span>{val || "—"}</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center text-zinc-500 dark:text-zinc-400 py-6">
                                            No tasks found for the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Card View */}
                    <div className="lg:hidden flex flex-col gap-4">
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map((task) => {
                                const { icon: Icon, color } = typeIcons[task.type] || {};
                                const { background, prioritycolor } = priorityTexts[task.priority] || {};

                                return (
                                    <div key={task.id} className={`dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-2 ${task.status === "DONE" ? "opacity-50" : ""}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => handleToggleComplete(e, task)}
                                                className="flex items-center justify-center text-zinc-400 hover:text-emerald-500 transition-colors shrink-0"
                                                title={task.status === "DONE" ? "Mark incomplete" : "Mark complete"}
                                            >
                                                {task.status === "DONE"
                                                    ? <CheckCircle2 className="size-5 text-emerald-500" />
                                                    : <Circle className="size-5" />
                                                }
                                            </button>
                                            <h3 className={`text-zinc-900 dark:text-zinc-200 text-sm font-semibold flex-1 ${task.status === "DONE" ? "line-through text-zinc-400 dark:text-zinc-500" : ""}`}>{task.title}</h3>
                                            <input type="checkbox" className="size-4 accent-zinc-600 dark:accent-zinc-500" onChange={() => selectedTasks.includes(task.id) ? setSelectedTasks(selectedTasks.filter((i) => i !== task.id)) : setSelectedTasks((prev) => [...prev, task.id])} checked={selectedTasks.includes(task.id)} />
                                        </div>

                                        <div className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                                            {Icon && <Icon className={`size-4 ${color}`} />}
                                            <span className={`${color} uppercase`}>{task.type}</span>
                                        </div>

                                        <div>
                                            <span className={`text-xs px-2 py-1 rounded ${background} ${prioritycolor}`}>
                                                {task.priority}
                                            </span>
                                        </div>

                                        <div>
                                            <label className="text-zinc-600 dark:text-zinc-400 text-xs">Status</label>
                                            <select name="status" onChange={(e) => handleStatusChange(task.id, e.target.value)} value={task.status} className="w-full mt-1 bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-700 outline-none px-2 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200" >
                                                <option value="TODO">To Do</option>
                                                <option value="IN_PROGRESS">In Progress</option>
                                                <option value="DONE">Done</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <StackedAvatars assignees={task.assignees?.length ? task.assignees : (task.assignee ? [task.assignee] : [])} size={18} />
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                            <CalendarIcon className="size-4 shrink-0" />
                                            {format(new Date(task.due_date), "dd MMMM")}
                                            {task.due_time && (
                                                <span className="text-zinc-400 dark:text-zinc-500 text-xs">· {task.due_time.slice(0, 5)}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-center text-zinc-500 dark:text-zinc-400 py-4">
                                No tasks found for the selected filters.
                            </p>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ProjectTasks;
