import { useEffect, useState, useRef } from "react"
import { useDispatch, useSelector } from "react-redux"
import { updateTaskStatus, deleteTasks, patchTask } from "../features/workspaceSlice"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { format } from "date-fns"
import {
    XIcon, CalendarIcon, UserIcon, FlagIcon,
    MessageCircleIcon, ClockIcon, Loader2Icon,
    CheckCircle2Icon, CircleIcon, CircleDotIcon,
    TrashIcon, PencilIcon, CheckIcon, LinkIcon,
    MilestoneIcon, PlusIcon
} from "lucide-react"
import toast from "react-hot-toast"

const statusOptions = [
    { value: "TODO", label: "To Do", icon: CircleIcon, color: "text-zinc-500" },
    { value: "IN_PROGRESS", label: "In Progress", icon: CircleDotIcon, color: "text-blue-500" },
    { value: "DONE", label: "Done", icon: CheckCircle2Icon, color: "text-emerald-500" },
]

const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"]

const priorityColors = {
    LOW: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800",
    MEDIUM: "text-blue-600 bg-blue-100 dark:bg-blue-900/40",
    HIGH: "text-orange-600 bg-orange-100 dark:bg-orange-900/40",
    URGENT: "text-red-600 bg-red-100 dark:bg-red-900/40",
}

const typeColors = {
    TASK: "text-green-600 bg-green-100 dark:bg-green-900/40",
    BUG: "text-red-600 bg-red-100 dark:bg-red-900/40",
    FEATURE: "text-blue-600 bg-blue-100 dark:bg-blue-900/40",
    IMPROVEMENT: "text-purple-600 bg-purple-100 dark:bg-purple-900/40",
    OTHER: "text-amber-600 bg-amber-100 dark:bg-amber-900/40",
}

// Inline editable text field
function EditableText({ value, onSave, multiline = false, placeholder = "Click to edit..." }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value || "")
    const ref = useRef(null)

    useEffect(() => { setDraft(value || "") }, [value])
    useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

    const handleSave = () => {
        setEditing(false)
        if (draft.trim() !== value) onSave(draft.trim())
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !multiline) handleSave()
        if (e.key === "Escape") { setEditing(false); setDraft(value || "") }
    }

    if (editing) {
        const cls = "w-full text-sm px-2 py-1 rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
        return multiline
            ? <textarea ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown} rows={3} className={cls} />
            : <input ref={ref} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown} className={cls} />
    }

    return (
        <div
            onClick={() => setEditing(true)}
            className="group flex items-start gap-1 cursor-text"
        >
            <span className={`text-sm ${value ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"} leading-snug`}>
                {value || placeholder}
            </span>
            <PencilIcon className="size-3 mt-0.5 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
        </div>
    )
}

export default function TaskPanel({ taskId, projectId, onClose }) {
    const dispatch = useDispatch()
    const { user } = useAuth()
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const project = currentWorkspace?.projects?.find((p) => p.id === projectId)
    const task = project?.tasks?.find((t) => t.id === taskId)
    const members = currentWorkspace?.members || []

    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState("")
    const [loadingComments, setLoadingComments] = useState(false)
    const [submittingComment, setSubmittingComment] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [subtasks, setSubtasks] = useState([])
    const [newSubtask, setNewSubtask] = useState("")
    const [addingSubtask, setAddingSubtask] = useState(false)

    useEffect(() => {
        if (taskId) {
            fetchComments()
            fetchSubtasks()
        }
    }, [taskId])

    const fetchComments = async () => {
        setLoadingComments(true)
        const { data, error } = await supabase
            .from("task_comments")
            .select("*, author:profiles(id, name, email)")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true })
        if (!error) setComments(data || [])
        setLoadingComments(false)
    }

    const fetchSubtasks = async () => {
        const { data } = await supabase
            .from("tasks")
            .select("id, title, status")
            .eq("parent_task_id", taskId)
            .order("created_at", { ascending: true })
        if (data) setSubtasks(data)
    }

    const handleAddSubtask = async () => {
        if (!newSubtask.trim() || !task) return
        setAddingSubtask(true)
        try {
            const { data, error } = await supabase
                .from("tasks")
                .insert({
                    workspace_id: currentWorkspace.id,
                    project_id: projectId,
                    title: newSubtask.trim(),
                    status: "TODO",
                    type: "TASK",
                    priority: "MEDIUM",
                    parent_task_id: taskId,
                    created_by: user.id,
                })
                .select("id, title, status")
                .single()
            if (error) throw error
            setSubtasks((prev) => [...prev, data])
            setNewSubtask("")
        } catch {
            toast.error("Failed to add subtask")
        } finally {
            setAddingSubtask(false)
        }
    }

    const toggleSubtaskStatus = async (subtask) => {
        const newStatus = subtask.status === "DONE" ? "TODO" : "DONE"
        const { error } = await supabase
            .from("tasks")
            .update({ status: newStatus })
            .eq("id", subtask.id)
        if (!error) {
            setSubtasks((prev) => prev.map((s) => s.id === subtask.id ? { ...s, status: newStatus } : s))
        }
    }

    // Task links
    const [links, setLinks] = useState([])
    const [newLinkUrl, setNewLinkUrl] = useState("")
    const [newLinkLabel, setNewLinkLabel] = useState("")
    const [addingLink, setAddingLink] = useState(false)
    const [showLinkForm, setShowLinkForm] = useState(false)

    useEffect(() => {
        if (taskId) fetchLinks()
    }, [taskId])

    const fetchLinks = async () => {
        const { data } = await supabase
            .from("task_links")
            .select("*")
            .eq("task_id", taskId)
            .order("created_at", { ascending: true })
        if (data) setLinks(data)
    }

    const handleAddLink = async () => {
        if (!newLinkUrl.trim()) return
        setAddingLink(true)
        try {
            const url = newLinkUrl.startsWith("http") ? newLinkUrl : `https://${newLinkUrl}`
            const { data, error } = await supabase
                .from("task_links")
                .insert({ task_id: taskId, url, label: newLinkLabel.trim() || null, created_by: user.id })
                .select()
                .single()
            if (error) throw error
            setLinks((prev) => [...prev, data])
            setNewLinkUrl("")
            setNewLinkLabel("")
            setShowLinkForm(false)
        } catch {
            toast.error("Failed to add link")
        } finally {
            setAddingLink(false)
        }
    }

    const handleDeleteLink = async (linkId) => {
        await supabase.from("task_links").delete().eq("id", linkId)
        setLinks((prev) => prev.filter((l) => l.id !== linkId))
    }

    const handleStatusChange = async (newStatus) => {
        if (!task || updatingStatus) return
        setUpdatingStatus(true)
        try {
            await dispatch(updateTaskStatus({ taskId, projectId, status: newStatus })).unwrap()
        } catch {
            toast.error("Failed to update status")
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleFieldUpdate = async (field, value) => {
        const { error } = await supabase
            .from("tasks")
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq("id", taskId)

        if (error) {
            toast.error("Failed to save")
            return
        }

        // Fetch updated task and patch Redux state
        const { data } = await supabase
            .from("tasks")
            .select("id, project_id, title, description, status, type, priority, assignee_id, due_date, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)")
            .eq("id", taskId)
            .single()

        if (data) {
            dispatch(patchTask({ projectId, task: data }))
        }
    }

    const handleDelete = async () => {
        if (!window.confirm("Delete this task?")) return
        setDeleting(true)
        try {
            await dispatch(deleteTasks({ taskIds: [taskId], projectId })).unwrap()
            toast.success("Task deleted")
            onClose()
        } catch {
            toast.error("Failed to delete task")
            setDeleting(false)
        }
    }

    const handleAddComment = async () => {
        if (!newComment.trim()) return
        setSubmittingComment(true)
        try {
            const { data, error } = await supabase
                .from("task_comments")
                .insert({ task_id: taskId, author_id: user.id, body: newComment.trim() })
                .select("*, author:profiles(id, name, email)")
                .single()
            if (error) throw error
            setComments((prev) => [...prev, data])
            setNewComment("")
        } catch {
            toast.error("Failed to add comment")
        } finally {
            setSubmittingComment(false)
        }
    }

    if (!task) return null

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30" onClick={onClose} />

            <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xl">

                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex-1 min-w-0 pr-4">
                        <EditableText
                            value={task.title}
                            onSave={(val) => handleFieldUpdate("title", val)}
                            placeholder="Task title"
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{project?.name}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="p-1.5 text-zinc-400 hover:text-red-500 transition rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete task"
                        >
                            {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <TrashIcon className="size-4" />}
                        </button>
                        <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            <XIcon className="size-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">

                    {/* Status */}
                    <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Status</p>
                        <div className="flex gap-2 flex-wrap">
                            {statusOptions.map((opt) => {
                                const Icon = opt.icon
                                const isActive = task.status === opt.value
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleStatusChange(opt.value)}
                                        disabled={updatingStatus}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${isActive
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                            : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400"
                                        }`}
                                    >
                                        <Icon className={`size-3.5 ${isActive ? "text-blue-500" : opt.color}`} />
                                        {opt.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Meta grid */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Priority */}
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <FlagIcon className="size-3" /> Priority
                            </p>
                            <select
                                value={task.priority || "MEDIUM"}
                                onChange={(e) => handleFieldUpdate("priority", e.target.value)}
                                className={`text-xs px-2 py-1 rounded font-medium border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${priorityColors[task.priority] || priorityColors.MEDIUM}`}
                            >
                                {priorityOptions.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        {/* Type */}
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Type</p>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${typeColors[task.type] || typeColors.TASK}`}>
                                {task.type || "TASK"}
                            </span>
                        </div>

                        {/* Assignee */}
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <UserIcon className="size-3" /> Assignee
                            </p>
                            <select
                                value={task.assignee_id || ""}
                                onChange={(e) => handleFieldUpdate("assignee_id", e.target.value || null)}
                                className="text-sm text-zinc-800 dark:text-zinc-200 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-0"
                            >
                                <option value="">Unassigned</option>
                                {members.map((m) => (
                                    <option key={m.user_id} value={m.user_id}>
                                        {m.user?.name || m.user?.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Due Date */}
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <CalendarIcon className="size-3" /> Due Date
                            </p>
                            <input
                                type="date"
                                value={task.due_date || ""}
                                onChange={(e) => handleFieldUpdate("due_date", e.target.value || null)}
                                className="text-sm text-zinc-800 dark:text-zinc-200 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-0"
                            />
                        </div>

                        {/* Created */}
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <ClockIcon className="size-3" /> Created
                            </p>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200">
                                {format(new Date(task.created_at), "MMM d, yyyy")}
                            </p>
                        </div>

                        {/* Milestone */}
                        <div>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <MilestoneIcon className="size-3" /> Milestone
                            </p>
                            <button
                                onClick={() => handleFieldUpdate("milestone", !task.milestone)}
                                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition ${task.milestone ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400"}`}
                            >
                                {task.milestone ? "★ Milestone" : "☆ Mark as milestone"}
                            </button>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Description</p>
                        <EditableText
                            value={task.description}
                            onSave={(val) => handleFieldUpdate("description", val)}
                            multiline
                            placeholder="Add a description..."
                        />
                    </div>

                    {/* Links */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                                <LinkIcon className="size-3" /> Links ({links.length})
                            </p>
                            <button onClick={() => setShowLinkForm(!showLinkForm)} className="text-xs text-blue-500 hover:underline">
                                {showLinkForm ? "Cancel" : "+ Add"}
                            </button>
                        </div>
                        {showLinkForm && (
                            <div className="space-y-1.5 mb-2">
                                <input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://..." className="w-full text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                <div className="flex gap-1.5">
                                    <input value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Label (optional)" className="flex-1 text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                    <button onClick={handleAddLink} disabled={addingLink || !newLinkUrl.trim()} className="px-2 py-1 rounded bg-blue-500 text-white text-sm disabled:opacity-50">
                                        {addingLink ? <Loader2Icon className="size-3.5 animate-spin" /> : "Add"}
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-1">
                            {links.map((link) => (
                                <div key={link.id} className="flex items-center gap-2 group">
                                    <LinkIcon className="size-3 text-zinc-400 flex-shrink-0" />
                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline truncate flex-1">
                                        {link.label || link.url}
                                    </a>
                                    <button onClick={() => handleDeleteLink(link.id)} className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition">
                                        <XIcon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Subtasks */}
                    <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                            Subtasks ({subtasks.length})
                        </p>
                        <div className="space-y-1.5 mb-2">
                            {subtasks.map((sub) => (
                                <div key={sub.id} className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleSubtaskStatus(sub)}
                                        className={`size-4 rounded border flex-shrink-0 flex items-center justify-center transition ${
                                            sub.status === "DONE"
                                                ? "bg-emerald-500 border-emerald-500 text-white"
                                                : "border-zinc-300 dark:border-zinc-600 hover:border-emerald-400"
                                        }`}
                                    >
                                        {sub.status === "DONE" && <CheckIcon className="size-2.5" />}
                                    </button>
                                    <span className={`text-sm ${sub.status === "DONE" ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
                                        {sub.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newSubtask}
                                onChange={(e) => setNewSubtask(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                                placeholder="Add subtask..."
                                className="flex-1 text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleAddSubtask}
                                disabled={addingSubtask || !newSubtask.trim()}
                                className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition"
                            >
                                {addingSubtask ? <Loader2Icon className="size-3.5 animate-spin" /> : "Add"}
                            </button>
                        </div>
                    </div>

                    {/* Comments */}
                    <div>
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-1">
                            <MessageCircleIcon className="size-3" /> Comments ({comments.length})
                        </p>

                        {loadingComments ? (
                            <div className="flex justify-center py-4">
                                <Loader2Icon className="size-5 animate-spin text-zinc-400" />
                            </div>
                        ) : comments.length === 0 ? (
                            <p className="text-sm text-zinc-400 dark:text-zinc-500">No comments yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-3">
                                        <div className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                            {(comment.author?.email || "?")[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                                    {comment.author?.name || comment.author?.email}
                                                </span>
                                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                                    {format(new Date(comment.created_at), "MMM d, h:mm a")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                {comment.body}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex gap-2">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment()
                            }}
                            placeholder="Add a comment... (⌘+Enter to submit)"
                            rows={2}
                            className="flex-1 text-sm px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        />
                        <button
                            onClick={handleAddComment}
                            disabled={submittingComment || !newComment.trim()}
                            className="flex items-center justify-center px-3 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-50 transition"
                        >
                            {submittingComment
                                ? <Loader2Icon className="size-4 animate-spin" />
                                : <span className="text-sm">Post</span>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
