import { useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import { Plus, Layers, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { deleteSpace } from "../features/workspaceSlice"
import CreateSpaceDialog from "../components/CreateSpaceDialog"
import toast from "react-hot-toast"

export default function Spaces() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const spaces = useSelector((state) => state.workspace.spaces || [])
    const projects = useSelector((state) => state.workspace.currentWorkspace?.projects || [])

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editSpace, setEditSpace] = useState(null)
    const [menuOpen, setMenuOpen] = useState(null)

    const projectsBySpace = (spaceId) => projects.filter((p) => p.space_id === spaceId)

    const handleDelete = async (space) => {
        const count = projectsBySpace(space.id).length
        const msg = count > 0
            ? `Delete "${space.name}"? Its ${count} project(s) will become unassigned.`
            : `Delete "${space.name}"?`
        if (!window.confirm(msg)) return
        try {
            await dispatch(deleteSpace({ spaceId: space.id })).unwrap()
            toast.success("Space deleted")
        } catch (err) {
            toast.error(err || "Failed to delete space")
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-7">
                <div>
                    <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Spaces</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Group projects by client or area of work</p>
                </div>
                <button
                    onClick={() => { setEditSpace(null); setIsDialogOpen(true) }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition flex-shrink-0"
                >
                    <Plus className="size-3.5" /> New Space
                </button>
            </div>

            {spaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Layers className="size-10 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">No spaces yet</p>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="text-sm font-medium px-4 py-2 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-80 transition"
                    >
                        + Create your first space
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {spaces.map((space) => {
                        const spaceProjects = projectsBySpace(space.id)
                        const totalTasks = spaceProjects.reduce((acc, p) => acc + (p.tasks?.length || 0), 0)
                        const doneTasks = spaceProjects.reduce((acc, p) => acc + (p.tasks?.filter(t => t.status === "DONE").length || 0), 0)
                        const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

                        return (
                            <div
                                key={space.id}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative"
                                onClick={() => navigate(`/spaces/${space.id}`)}
                            >
                                {/* Color bar */}
                                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: space.color }} />

                                {/* Menu */}
                                <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setMenuOpen(menuOpen === space.id ? null : space.id)}
                                        className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </button>
                                    {menuOpen === space.id && (
                                        <div className="absolute right-0 top-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 min-w-[140px] py-1">
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                                onClick={() => { setEditSpace(space); setIsDialogOpen(true); setMenuOpen(null) }}
                                            >
                                                <Pencil className="size-3.5" /> Edit
                                            </button>
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => { handleDelete(space); setMenuOpen(null) }}
                                            >
                                                <Trash2 className="size-3.5" /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Space dot + name */}
                                <div className="flex items-center gap-2.5 mt-2 mb-3">
                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{space.name}</h3>
                                </div>

                                {space.description && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">{space.description}</p>
                                )}

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                                    <span className="flex items-center gap-1">
                                        <FolderOpen className="size-3.5" />
                                        {spaceProjects.length} project{spaceProjects.length !== 1 ? "s" : ""}
                                    </span>
                                    <span>{totalTasks} task{totalTasks !== 1 ? "s" : ""}</span>
                                </div>

                                {/* Progress */}
                                {totalTasks > 0 && (
                                    <div>
                                        <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                            <span>Progress</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: space.color }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <CreateSpaceDialog
                isOpen={isDialogOpen}
                onClose={() => { setIsDialogOpen(false); setEditSpace(null) }}
                editSpace={editSpace}
            />
        </div>
    )
}
