/**
 * PulseBridge — surfaces Pulse-linked tasks inside an xPM project view.
 *
 * How it works:
 * - Reads pulse_xpm_task_links where xpm_project_id = projectId for the current user.
 * - Shows Pulse tasks with a distinct "Pulse" badge so they're clearly not native xPM tasks.
 * - Allows the user to: resolve 'needs_review' links, promote a Pulse task to a real xPM task,
 *   or unlink/ignore it.
 * - Provides a manual "Link Pulse task" form for cases where Pulse didn't auto-link.
 */
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useSelector } from "react-redux"
import {
    ZapIcon, PlusIcon, Loader2Icon, XIcon, CheckCircle2Icon,
    AlertCircleIcon, LinkIcon, ArrowRightIcon, ExternalLinkIcon
} from "lucide-react"
import toast from "react-hot-toast"
import { format } from "date-fns"

const SYNC_STATUS_CONFIG = {
    linked: { label: "Linked", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2Icon },
    needs_review: { label: "Needs review", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400", icon: AlertCircleIcon },
    ignored: { label: "Ignored", cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500", icon: XIcon },
    promoted: { label: "Promoted to xPM", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400", icon: CheckCircle2Icon },
}

export default function PulseBridge({ projectId, onTaskCreated }) {
    const { user } = useAuth()
    const currentWorkspace = useSelector(s => s.workspace?.currentWorkspace)
    const [links, setLinks] = useState([])
    const [loading, setLoading] = useState(true)
    const [showManualForm, setShowManualForm] = useState(false)
    const [manualForm, setManualForm] = useState({ pulse_task_id: "", pulse_task_title: "", pulse_project_tag: "" })
    const [saving, setSaving] = useState(false)
    const [promoting, setPromoting] = useState(null)

    useEffect(() => { if (projectId) fetchLinks() }, [projectId])

    const fetchLinks = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("pulse_xpm_task_links")
            .select("*")
            .eq("xpm_project_id", projectId)
            .eq("user_id", user.id)
            .neq("sync_status", "ignored")
            .order("created_at", { ascending: false })
        setLinks(data || [])
        setLoading(false)
    }

    const handleIgnore = async (linkId) => {
        await supabase.from("pulse_xpm_task_links").update({ sync_status: "ignored" }).eq("id", linkId)
        setLinks(prev => prev.filter(l => l.id !== linkId))
        toast.success("Link ignored")
    }

    const handleUnlink = async (linkId) => {
        await supabase.from("pulse_xpm_task_links").delete().eq("id", linkId)
        setLinks(prev => prev.filter(l => l.id !== linkId))
        toast.success("Unlinked")
    }

    const handleConfirmProject = async (link) => {
        // User confirms the project match for a needs_review link
        await supabase.from("pulse_xpm_task_links").update({
            xpm_project_id: projectId,
            xpm_workspace_id: currentWorkspace?.id,
            sync_status: "linked",
            updated_at: new Date().toISOString(),
        }).eq("id", link.id)
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, sync_status: "linked", xpm_project_id: projectId } : l))
        toast.success("Link confirmed")
    }

    const handlePromote = async (link) => {
        // Create a real xPM task from the Pulse task, then update bridge record
        setPromoting(link.id)
        try {
            const { data: task, error } = await supabase.from("tasks").insert({
                workspace_id: currentWorkspace.id,
                project_id: projectId,
                title: link.pulse_task_title || `Pulse task ${link.pulse_task_id}`,
                status: "TODO",
                priority: "MEDIUM",
                created_by: user.id,
                assignee_id: user.id,
            }).select("id, title").single()
            if (error) throw error

            await supabase.from("pulse_xpm_task_links").update({
                xpm_task_id: task.id,
                sync_status: "promoted",
                updated_at: new Date().toISOString(),
            }).eq("id", link.id)

            setLinks(prev => prev.map(l => l.id === link.id ? { ...l, xpm_task_id: task.id, sync_status: "promoted" } : l))
            toast.success(`"${task.title}" created as xPM task`)
            if (onTaskCreated) onTaskCreated()
        } catch (err) {
            toast.error(err.message || "Failed to promote task")
        } finally {
            setPromoting(null)
        }
    }

    const handleManualLink = async (e) => {
        e.preventDefault()
        if (!manualForm.pulse_task_id.trim() || !manualForm.pulse_task_title.trim()) return
        setSaving(true)
        try {
            const { error } = await supabase.from("pulse_xpm_task_links").insert({
                user_id: user.id,
                xpm_workspace_id: currentWorkspace?.id,
                xpm_project_id: projectId,
                pulse_task_id: manualForm.pulse_task_id.trim(),
                pulse_task_title: manualForm.pulse_task_title.trim(),
                pulse_project_tag: manualForm.pulse_project_tag.trim() || null,
                sync_status: "linked",
            })
            if (error?.code === "23505") { toast("This Pulse task is already linked"); return }
            if (error) throw error
            toast.success("Pulse task linked")
            setManualForm({ pulse_task_id: "", pulse_task_title: "", pulse_project_tag: "" })
            setShowManualForm(false)
            fetchLinks()
        } catch (err) {
            toast.error(err.message || "Failed to link")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="flex justify-center py-6"><Loader2Icon className="size-5 animate-spin text-zinc-400" /></div>

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ZapIcon className="size-4 text-violet-500" />
                    <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Pulse Tasks</h3>
                    {links.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                            {links.length}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition"
                >
                    <PlusIcon className="size-3.5" /> Link task
                </button>
            </div>

            {/* Manual link form */}
            {showManualForm && (
                <form onSubmit={handleManualLink} className="space-y-2 p-3 border border-violet-200 dark:border-violet-800 rounded-lg bg-violet-50/50 dark:bg-violet-900/10">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Paste a Pulse task ID and title to link it here. Pulse will auto-link via the bridge RPC going forward.
                    </p>
                    <input
                        value={manualForm.pulse_task_title}
                        onChange={e => setManualForm(p => ({ ...p, pulse_task_title: e.target.value }))}
                        placeholder="Pulse task title *"
                        required
                        className="w-full px-2 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <input
                        value={manualForm.pulse_task_id}
                        onChange={e => setManualForm(p => ({ ...p, pulse_task_id: e.target.value }))}
                        placeholder="Pulse task ID *"
                        required
                        className="w-full px-2 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowManualForm(false)} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition px-2 py-1">Cancel</button>
                        <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-violet-500 text-white disabled:opacity-60 hover:bg-violet-600 transition">
                            {saving && <Loader2Icon className="size-3 animate-spin" />} Link
                        </button>
                    </div>
                </form>
            )}

            {/* Linked tasks */}
            {links.length === 0 ? (
                <div className="py-4 text-center">
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        No Pulse tasks linked to this project yet.
                        <br />When you tag a task in Pulse with this project's name, it will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {links.map(link => {
                        const cfg = SYNC_STATUS_CONFIG[link.sync_status] || SYNC_STATUS_CONFIG.linked
                        const Icon = cfg.icon
                        return (
                            <div key={link.id} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 group">
                                <ZapIcon className="size-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm text-zinc-800 dark:text-zinc-200 font-medium truncate">
                                            {link.pulse_task_title || link.pulse_task_id}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
                                            <Icon className="size-2.5" /> {cfg.label}
                                        </span>
                                    </div>
                                    {link.pulse_project_tag && (
                                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                                            Tagged as "{link.pulse_project_tag}" in Pulse
                                        </p>
                                    )}
                                    {link.sync_status === "needs_review" && (
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => handleConfirmProject(link)}
                                                className="text-xs px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition">
                                                Confirm project match
                                            </button>
                                            <button onClick={() => handleIgnore(link.id)}
                                                className="text-xs px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                                                Ignore
                                            </button>
                                        </div>
                                    )}
                                    {link.sync_status === "linked" && !link.xpm_task_id && (
                                        <button
                                            onClick={() => handlePromote(link)}
                                            disabled={promoting === link.id}
                                            className="flex items-center gap-1 mt-2 text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition disabled:opacity-60"
                                        >
                                            {promoting === link.id ? <Loader2Icon className="size-3 animate-spin" /> : <ArrowRightIcon className="size-3" />}
                                            Promote to xPM task
                                        </button>
                                    )}
                                    {link.xpm_task_id && (
                                        <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                                            <LinkIcon className="size-3" /> Linked to xPM task
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => handleUnlink(link.id)}
                                    className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition flex-shrink-0">
                                    <XIcon className="size-3.5" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
