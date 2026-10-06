import { useState } from "react"
import Modal from "./Modal"
import { accentBtn, ghostBtn, inputCls, labelCls } from "./ui"
import { Mail, UserPlus, Loader2Icon, CopyIcon, CheckIcon, ExternalLinkIcon } from "lucide-react"
import { useSelector, useDispatch } from "react-redux"
import { supabase } from "../lib/supabase"
import { fetchWorkspaceDetail } from "../features/workspaceSlice"
import toast from "react-hot-toast"

const InviteMemberDialog = ({ isDialogOpen, setIsDialogOpen }) => {
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null)
    const dispatch = useDispatch()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({ email: "", role: "member" })
    const [inviteResult, setInviteResult] = useState(null) // { invite_link, message }
    const [copied, setCopied] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!currentWorkspace) return
        setIsSubmitting(true)
        setInviteResult(null)

        try {
            // First: check if user already exists and add them directly (for existing users)
            const { data: profile } = await supabase
                .from("profiles")
                .select("id, email, name")
                .eq("email", formData.email.trim().toLowerCase())
                .single()

            if (profile) {
                // User already exists — add directly without needing email invite
                const already = currentWorkspace.members?.find((m) => m.user_id === profile.id)
                if (already) {
                    toast.error("This person is already a member.")
                    return
                }
                const { data: inserted, error } = await supabase
                    .from("workspace_members")
                    .insert({ workspace_id: currentWorkspace.id, user_id: profile.id, role: formData.role })
                    .select()
                if (error) throw error
                // RLS may allow the call but block the row — no error, no row back.
                if (!inserted || inserted.length === 0) {
                    toast.error("Only workspace admins can add members.")
                    return
                }
                toast.success(`${profile.name || formData.email} added to ${currentWorkspace.name}`)
                dispatch(fetchWorkspaceDetail(currentWorkspace.id))
                setFormData({ email: "", role: "member" })
                setIsDialogOpen(false)
                return
            }

            // User doesn't exist yet — send email invite via Edge Function
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-workspace-invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    workspace_id: currentWorkspace.id,
                    email: formData.email.trim().toLowerCase(),
                    role: formData.role,
                }),
            })

            const result = await res.json()

            if (!res.ok) {
                // Edge Function may not be deployed in local dev — fall back to creating invite record directly
                if (res.status === 404 || res.status === 502) {
                    await createInviteDirectly()
                    return
                }
                throw new Error(result.error || "Failed to send invite")
            }

            setInviteResult(result)
            toast.success(result.message || `Invite sent to ${formData.email}`)

        } catch (err) {
            // If Edge Function isn't deployed (local dev), fall back to direct invite creation
            if (err.message?.includes("fetch")) {
                await createInviteDirectly()
            } else {
                toast.error(err.message || "Failed to invite member")
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    // Fallback for local dev or when Edge Function isn't available
    const createInviteDirectly = async () => {
        try {
            const { data: invite, error } = await supabase
                .from("workspace_invites")
                .insert({
                    workspace_id: currentWorkspace.id,
                    invited_by: (await supabase.auth.getUser()).data.user.id,
                    email: formData.email.trim().toLowerCase(),
                    role: formData.role,
                })
                .select("token")
                .single()

            if (error?.code === "23505") {
                // Duplicate — fetch existing token
                const { data: existing } = await supabase
                    .from("workspace_invites")
                    .select("token")
                    .eq("workspace_id", currentWorkspace.id)
                    .eq("email", formData.email.trim().toLowerCase())
                    .eq("status", "pending")
                    .single()
                if (existing) {
                    const link = `${window.location.origin}/accept-invite?token=${existing.token}`
                    setInviteResult({ invite_link: link, message: "Existing invite link (email delivery unavailable in local dev)" })
                }
                return
            }

            if (error) throw error

            const link = `${window.location.origin}/accept-invite?token=${invite.token}`
            setInviteResult({
                invite_link: link,
                message: "Email delivery requires the Edge Function to be deployed. Share this link manually:",
            })
        } catch (err) {
            toast.error(err.message || "Failed to create invite")
        }
    }

    const handleCopyLink = async () => {
        if (!inviteResult?.invite_link) return
        await navigator.clipboard.writeText(inviteResult.invite_link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("Link copied")
    }

    return (
        <Modal open={!!isDialogOpen} onClose={() => setIsDialogOpen(false)} size="sm"
            title={<span className="flex items-center gap-2"><UserPlus className="size-5" /> Invite a teammate</span>}
            subtitle={currentWorkspace ? `To ${currentWorkspace.name}` : undefined}>
                {/* Invite result */}
                {inviteResult && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">{inviteResult.message}</p>
                        {inviteResult.invite_link && (
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 text-zinc-600 dark:text-zinc-400 truncate">
                                    {inviteResult.invite_link}
                                </code>
                                <button onClick={handleCopyLink}
                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex-shrink-0">
                                    {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        )}
                        <button onClick={() => { setInviteResult(null); setFormData({ email: "", role: "member" }) }}
                            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
                            Invite another →
                        </button>
                    </div>
                )}

                {/* Form — hide after successful invite */}
                {!inviteResult && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className={labelCls}>Email address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="teammate@company.com"
                                    className={`${inputCls} pl-10`}
                                    required
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                If they already have an account, they'll be added immediately.
                                Otherwise an invite link will be generated.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className={labelCls}>Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className={inputCls}
                            >
                                <option value="member">Member: can create and edit tasks</option>
                                <option value="admin">Admin: can manage members and settings</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setIsDialogOpen(false)}
                                className={ghostBtn}>
                                Cancel
                            </button>
                            <button type="submit" disabled={isSubmitting || !currentWorkspace}
                                className={accentBtn}>
                                {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                                {isSubmitting ? "Inviting..." : "Send Invite"}
                            </button>
                        </div>
                    </form>
                )}

                {inviteResult && (
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setIsDialogOpen(false)}
                            className={ghostBtn}>
                            Done
                        </button>
                    </div>
                )}
        </Modal>
    )
}

export default InviteMemberDialog
