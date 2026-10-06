import { useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useNavigate } from "react-router-dom"
import { Plus, Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { deleteSpace } from "../features/workspaceSlice"
import CreateSpaceDialog from "../components/CreateSpaceDialog"
import Tooltip from "../components/Tooltip"
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
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-none text-ink-900 dark:text-white">Spaces</h1>
                    <p className="mt-2 text-[15px] text-gray-500 dark:text-zinc-400">Group projects by client or area of work.</p>
                </div>
                <button
                    onClick={() => { setEditSpace(null); setIsDialogOpen(true) }}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold rounded-lg bg-ink-900 hover:bg-ink-800 dark:bg-white dark:text-ink-950 text-white transition-colors flex-shrink-0"
                >
                    <Plus className="size-4" /> New space
                </button>
            </div>

            {spaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 py-20 text-center">
                    <Layers className="size-9 mx-auto text-gray-300 dark:text-zinc-600 mb-3" />
                    <p className="font-display text-[20px] font-semibold text-gray-900 dark:text-white">No spaces yet</p>
                    <p className="text-[14px] text-gray-500 dark:text-zinc-400 mt-1">A space holds the projects for one client or area of work.</p>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="mt-5 text-[14px] font-semibold px-5 py-2.5 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 transition-colors"
                    >
                        Create your first space
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {spaces.map((space) => {
                        const spaceProjects = projectsBySpace(space.id)
                        const totalTasks = spaceProjects.reduce((acc, p) => acc + (p.tasks?.length || 0), 0)
                        const doneTasks = spaceProjects.reduce((acc, p) => acc + (p.tasks?.filter(t => t.status === "DONE").length || 0), 0)
                        const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

                        return (
                            <div
                                key={space.id}
                                className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-ink-300 dark:hover:border-zinc-600 rounded-2xl p-6 transition-colors cursor-pointer group"
                                onClick={() => navigate(`/spaces/${space.id}`)}
                            >
                                <div className="flex items-start justify-between">
                                    <span className="size-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${space.color}22` }}>
                                        <span className="size-4 rounded-full" style={{ backgroundColor: space.color }} />
                                    </span>
                                    <div onClick={(e) => e.stopPropagation()} className="relative -mr-2 -mt-1">
                                        <Tooltip label="Edit or delete">
                                            <button
                                                onClick={() => setMenuOpen(menuOpen === space.id ? null : space.id)}
                                                aria-label="Space options"
                                                className="size-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                                            >
                                                <MoreHorizontal className="size-4" />
                                            </button>
                                        </Tooltip>
                                        {menuOpen === space.id && (
                                            <div className="absolute right-0 top-9 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 min-w-[140px] py-1">
                                                <button
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
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
                                </div>

                                <h3 className="mt-4 text-[22px] font-semibold leading-tight text-gray-900 dark:text-white truncate">{space.name}</h3>
                                <p className="mt-1 text-[14px] text-gray-500 dark:text-zinc-400 line-clamp-2 min-h-[42px]">{space.description || "No description yet."}</p>

                                <div className="mt-5 flex items-end gap-6">
                                    <div>
                                        <p className="font-display text-[32px] font-bold leading-none tabular-nums text-ink-900 dark:text-white">{spaceProjects.length}</p>
                                        <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">project{spaceProjects.length !== 1 ? "s" : ""}</p>
                                    </div>
                                    <div>
                                        <p className="font-display text-[32px] font-bold leading-none tabular-nums text-ink-900 dark:text-white">{totalTasks}</p>
                                        <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">task{totalTasks !== 1 ? "s" : ""}</p>
                                    </div>
                                    {totalTasks > 0 && (
                                        <div className="ml-auto text-right">
                                            <p className="font-display text-[32px] font-bold leading-none tabular-nums" style={{ color: space.color }}>{pct}%</p>
                                            <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">done</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: space.color }} />
                                </div>
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
