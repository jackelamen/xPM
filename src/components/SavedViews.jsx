import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useSelector } from "react-redux"
import { BookmarkIcon, BookmarkCheckIcon, Loader2Icon, XIcon, ChevronDownIcon } from "lucide-react"
import toast from "react-hot-toast"

export default function SavedViews({ projectId, viewType, currentFilters, onLoadView }) {
    const { user } = useAuth()
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace)
    const [views, setViews] = useState([])
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [showNameInput, setShowNameInput] = useState(false)
    const [viewName, setViewName] = useState("")
    const [activeViewId, setActiveViewId] = useState(null)

    useEffect(() => {
        if (projectId) fetchViews()
    }, [projectId])

    const fetchViews = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("saved_views")
            .select("*")
            .eq("project_id", projectId)
            .eq("owner_id", user.id)
            .order("created_at", { ascending: true })
        setViews(data || [])
        setLoading(false)
    }

    const handleSave = async () => {
        if (!viewName.trim() || !currentWorkspace) return
        setSaving(true)
        try {
            const { data, error } = await supabase
                .from("saved_views")
                .insert({
                    workspace_id: currentWorkspace.id,
                    project_id: projectId,
                    owner_id: user.id,
                    name: viewName.trim(),
                    view_type: viewType || "list",
                    filters: currentFilters || {},
                    scope: "personal",
                })
                .select()
                .single()
            if (error) throw error
            setViews((prev) => [...prev, data])
            setViewName("")
            setShowNameInput(false)
            setActiveViewId(data.id)
            toast.success(`View "${data.name}" saved`)
        } catch (err) {
            toast.error(err.message || "Failed to save view")
        } finally {
            setSaving(false)
        }
    }

    const handleLoad = (view) => {
        setActiveViewId(view.id)
        setOpen(false)
        if (onLoadView) onLoadView(view.filters || {})
        toast.success(`View "${view.name}" loaded`)
    }

    const handleDelete = async (e, viewId) => {
        e.stopPropagation()
        await supabase.from("saved_views").delete().eq("id", viewId)
        setViews((prev) => prev.filter((v) => v.id !== viewId))
        if (activeViewId === viewId) setActiveViewId(null)
        toast.success("View deleted")
    }

    const activeView = views.find((v) => v.id === activeViewId)

    return (
        <div className="relative">
            <div className="flex items-center gap-1.5">
                {/* Active view badge */}
                {activeView && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-xs text-blue-600 dark:text-blue-400">
                        <BookmarkCheckIcon className="size-3" />
                        {activeView.name}
                        <button onClick={() => { setActiveViewId(null); if (onLoadView) onLoadView({}) }} className="ml-0.5 hover:text-blue-800 dark:hover:text-blue-200">
                            <XIcon className="size-3" />
                        </button>
                    </div>
                )}

                {/* Dropdown trigger */}
                <button
                    onClick={() => setOpen(!open)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                    <BookmarkIcon className="size-3" />
                    Views
                    <ChevronDownIcon className="size-3" />
                </button>
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-40 overflow-hidden">
                        {/* Saved views list */}
                        <div className="p-1">
                            {loading ? (
                                <div className="flex justify-center py-3">
                                    <Loader2Icon className="size-4 animate-spin text-zinc-400" />
                                </div>
                            ) : views.length === 0 ? (
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-3">No saved views yet</p>
                            ) : (
                                views.map((view) => (
                                    <button
                                        key={view.id}
                                        onClick={() => handleLoad(view)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm text-left transition group ${activeViewId === view.id ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <BookmarkIcon className="size-3 flex-shrink-0" />
                                            <span className="truncate">{view.name}</span>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, view.id)}
                                            className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition flex-shrink-0"
                                        >
                                            <XIcon className="size-3.5" />
                                        </button>
                                    </button>
                                ))
                            )}
                        </div>

                        <div className="border-t border-zinc-100 dark:border-zinc-800 p-2">
                            {showNameInput ? (
                                <div className="flex gap-1">
                                    <input
                                        autoFocus
                                        value={viewName}
                                        onChange={(e) => setViewName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowNameInput(false) }}
                                        placeholder="View name..."
                                        className="flex-1 text-xs px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !viewName.trim()}
                                        className="px-2 py-1 rounded bg-blue-500 text-white text-xs disabled:opacity-50"
                                    >
                                        {saving ? <Loader2Icon className="size-3 animate-spin" /> : "Save"}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowNameInput(true)}
                                    className="w-full text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-left px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                >
                                    + Save current filters as view
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
