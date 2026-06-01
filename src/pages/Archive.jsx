import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import { ArchiveIcon, FolderOpenIcon, CheckSquareIcon, RotateCcwIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { supabase } from "../lib/supabase"
import { fetchWorkspaceDetail } from "../features/workspaceSlice"
import toast from "react-hot-toast"

export default function Archive() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const currentWorkspace = useSelector((state) => state.workspace.currentWorkspace)

    const [archivedProjects, setArchivedProjects] = useState([])
    const [archivedTasks, setArchivedTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState("projects")
    const [restoring, setRestoring] = useState(null)
    const [selected, setSelected] = useState([])
    const [deleting, setDeleting] = useState(false)

    const toggleSelect = (id) =>
        setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

    const toggleSelectAll = (items) => {
        const ids = items.map((i) => i.id)
        const allSelected = ids.every((id) => selected.includes(id))
        setSelected(allSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])])
    }

    // Clear selection when switching tabs
    const handleTabChange = (t) => { setTab(t); setSelected([]) }

    const handleBulkDelete = async () => {
        if (!window.confirm(`Permanently delete ${selected.length} ${tab === "projects" ? "project(s)" : "task(s)"}? This cannot be undone.`)) return
        setDeleting(true)
        try {
            const table = tab === "projects" ? "projects" : "tasks"
            const { error } = await supabase.from(table).delete().in("id", selected)
            if (error) throw error
            toast.success(`${selected.length} ${tab === "projects" ? "project(s)" : "task(s)"} deleted`)
            if (tab === "projects") {
                setArchivedProjects((prev) => prev.filter((p) => !selected.includes(p.id)))
            } else {
                setArchivedTasks((prev) => prev.filter((t) => !selected.includes(t.id)))
            }
            setSelected([])
            dispatch(fetchWorkspaceDetail(currentWorkspace.id))
        } catch (err) {
            toast.error("Failed to delete")
        } finally {
            setDeleting(false)
        }
    }

    useEffect(() => {
        if (!currentWorkspace?.id) return
        fetchArchived()
    }, [currentWorkspace?.id])

    const fetchArchived = async () => {
        setLoading(true)
        try {
            const [{ data: projects }, { data: tasks }] = await Promise.all([
                supabase
                    .from("projects")
                    .select("id, name, description, status, archived_at")
                    .eq("workspace_id", currentWorkspace.id)
                    .not("archived_at", "is", null)
                    .order("archived_at", { ascending: false }),
                supabase
                    .from("xpm_tasks")
                    .select("id, title, status, priority, archived_at, project_id, projects(name)")
                    .eq("workspace_id", currentWorkspace.id)
                    .not("archived_at", "is", null)
                    .order("archived_at", { ascending: false }),
            ])
            setArchivedProjects(projects || [])
            setArchivedTasks(tasks || [])
        } catch (err) {
            toast.error("Failed to load archive")
        } finally {
            setLoading(false)
        }
    }

    const restoreProject = async (projectId) => {
        setRestoring(projectId)
        try {
            const { error } = await supabase
                .from("projects")
                .update({ archived_at: null })
                .eq("id", projectId)
            if (error) throw error
            toast.success("Project restored")
            setArchivedProjects((prev) => prev.filter((p) => p.id !== projectId))
            dispatch(fetchWorkspaceDetail(currentWorkspace.id))
        } catch (err) {
            toast.error("Failed to restore project")
        } finally {
            setRestoring(null)
        }
    }

    const restoreTask = async (taskId) => {
        setRestoring(taskId)
        try {
            const { error } = await supabase
                .from("xpm_tasks")
                .update({ archived_at: null })
                .eq("id", taskId)
            if (error) throw error
            toast.success("Task restored")
            setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId))
            dispatch(fetchWorkspaceDetail(currentWorkspace.id))
        } catch (err) {
            toast.error("Failed to restore task")
        } finally {
            setRestoring(null)
        }
    }

    const formatDate = (iso) => {
        if (!iso) return ""
        return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <ArchiveIcon className="size-5 text-zinc-400" />
                <div>
                    <h1 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight leading-none">Archive</h1>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Archived projects and tasks</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-white/[0.07] mb-6">
                <button
                    onClick={() => handleTabChange("projects")}
                    className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                        tab === "projects"
                            ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                            : "border-transparent text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                >
                    <FolderOpenIcon size={13} /> Projects
                    {archivedProjects.length > 0 && (
                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full px-1.5 py-0.5 tabular-nums">
                            {archivedProjects.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => handleTabChange("tasks")}
                    className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
                        tab === "tasks"
                            ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                            : "border-transparent text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                >
                    <CheckSquareIcon size={13} /> Tasks
                    {archivedTasks.length > 0 && (
                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full px-1.5 py-0.5 tabular-nums">
                            {archivedTasks.length}
                        </span>
                    )}
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2Icon className="size-5 text-zinc-400 animate-spin" />
                </div>
            ) : tab === "projects" ? (
                archivedProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <FolderOpenIcon className="size-8 text-zinc-300 dark:text-zinc-700" />
                        <p className="text-sm text-zinc-400">No archived projects</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Bulk action bar */}
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={archivedProjects.length > 0 && archivedProjects.every((p) => selected.includes(p.id))}
                                    onChange={() => toggleSelectAll(archivedProjects)}
                                    className="size-3.5 accent-red-500"
                                />
                                Select all
                            </label>
                            {selected.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={deleting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50"
                                >
                                    {deleting ? <Loader2Icon size={12} className="animate-spin" /> : <Trash2Icon size={12} />}
                                    Delete {selected.length} project{selected.length > 1 ? "s" : ""}
                                </button>
                            )}
                        </div>
                        {archivedProjects.map((project) => (
                            <div
                                key={project.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-white dark:bg-zinc-900/50 transition-colors ${
                                    selected.includes(project.id)
                                        ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                                        : "border-zinc-200 dark:border-zinc-800"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(project.id)}
                                    onChange={() => toggleSelect(project.id)}
                                    className="size-3.5 accent-red-500 flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200 truncate">{project.name}</p>
                                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                        Archived {formatDate(project.archived_at)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => restoreProject(project.id)}
                                    disabled={restoring === project.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50 flex-shrink-0"
                                >
                                    {restoring === project.id ? <Loader2Icon size={12} className="animate-spin" /> : <RotateCcwIcon size={12} />}
                                    Restore
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                archivedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <CheckSquareIcon className="size-8 text-zinc-300 dark:text-zinc-700" />
                        <p className="text-sm text-zinc-400">No archived tasks</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {/* Bulk action bar */}
                        <div className="flex items-center justify-between mb-3">
                            <label className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={archivedTasks.length > 0 && archivedTasks.every((t) => selected.includes(t.id))}
                                    onChange={() => toggleSelectAll(archivedTasks)}
                                    className="size-3.5 accent-red-500"
                                />
                                Select all
                            </label>
                            {selected.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={deleting}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md bg-red-500 hover:bg-red-600 text-white transition disabled:opacity-50"
                                >
                                    {deleting ? <Loader2Icon size={12} className="animate-spin" /> : <Trash2Icon size={12} />}
                                    Delete {selected.length} task{selected.length > 1 ? "s" : ""}
                                </button>
                            )}
                        </div>
                        {archivedTasks.map((task) => (
                            <div
                                key={task.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-white dark:bg-zinc-900/50 transition-colors ${
                                    selected.includes(task.id)
                                        ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                                        : "border-zinc-200 dark:border-zinc-800"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(task.id)}
                                    onChange={() => toggleSelect(task.id)}
                                    className="size-3.5 accent-red-500 flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-medium text-zinc-800 dark:text-zinc-200 truncate">{task.title}</p>
                                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                        {task.projects?.name && <span className="mr-2">{task.projects.name}</span>}
                                        Archived {formatDate(task.archived_at)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => restoreTask(task.id)}
                                    disabled={restoring === task.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50 flex-shrink-0"
                                >
                                    {restoring === task.id ? <Loader2Icon size={12} className="animate-spin" /> : <RotateCcwIcon size={12} />}
                                    Restore
                                </button>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    )
}
