/**
 * AcceptInvite — handles the /accept-invite?token=... route.
 *
 * Flow:
 * 1. User clicks invite link from email.
 * 2. If not logged in → show login/signup form.
 * 3. After auth → call accept_workspace_invite RPC with the token.
 * 4. On success → redirect to the workspace dashboard.
 */
import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { Loader2Icon, CheckCircle2Icon, XCircleIcon, ZapIcon } from "lucide-react"
import toast from "react-hot-toast"

const inputCls = "w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"

export default function AcceptInvite() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()

    const token = searchParams.get("token")
    const [stage, setStage] = useState("loading") // loading | auth | accepting | success | error
    const [inviteInfo, setInviteInfo] = useState(null) // { workspace_name, email, inviter }
    const [errorMsg, setErrorMsg] = useState("")
    const [authMode, setAuthMode] = useState("login") // login | signup
    const [form, setForm] = useState({ email: "", password: "", name: "" })
    const [submitting, setSubmitting] = useState(false)

    // Step 1: peek at invite info without accepting (for display)
    useEffect(() => {
        if (!token) { setStage("error"); setErrorMsg("No invite token found in URL."); return }
        peekInvite()
    }, [token])

    const peekInvite = async () => {
        const { data } = await supabase
            .from("workspace_invites")
            .select("email, workspace:workspaces(name), inviter:profiles!workspace_invites_invited_by_fkey(name)")
            .eq("token", token)
            .eq("status", "pending")
            .single()

        if (data) {
            setInviteInfo({
                email: data.email,
                workspace_name: data.workspace?.name || "a workspace",
                inviter_name: data.inviter?.name || "a teammate",
            })
            // Pre-fill email
            setForm(f => ({ ...f, email: data.email || "" }))
        }

        // If user already logged in, skip to accepting
        if (!authLoading) {
            setStage(user ? "accepting" : "auth")
        }
    }

    // When auth state resolves, decide next step
    useEffect(() => {
        if (authLoading) return
        if (stage === "loading") setStage(user ? "accepting" : "auth")
        if (stage === "auth" && user) setStage("accepting")
    }, [user, authLoading])

    // Step 3: call RPC to accept invite
    useEffect(() => {
        if (stage === "accepting") acceptInvite()
    }, [stage])

    const acceptInvite = async () => {
        const { data, error } = await supabase.rpc("accept_workspace_invite", { p_token: token })
        if (error || !data?.success) {
            setStage("error")
            setErrorMsg(data?.error || error?.message || "Failed to accept invite")
            return
        }
        setInviteInfo(prev => ({ ...prev, workspace_name: data.workspace_name || prev?.workspace_name }))
        setStage("success")
        toast.success(`You've joined ${data.workspace_name || "the workspace"}!`)
        setTimeout(() => navigate("/"), 2000)
    }

    // Auth handlers
    const handleLogin = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) { toast.error(error.message); setSubmitting(false); return }
        // Auth context will update and trigger the useEffect above
    }

    const handleSignup = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        const { error } = await supabase.auth.signUp({
            email: form.email,
            password: form.password,
            options: { data: { name: form.name } }
        })
        if (error) { toast.error(error.message); setSubmitting(false); return }
        toast.success("Account created — logging you in...")
        // Sign in immediately after signup
        await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        setSubmitting(false)
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <ZapIcon className="size-4 text-white" />
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-white">EDGEx PM</span>
                    </div>
                    {inviteInfo && (
                        <div>
                            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
                                You're invited to join {inviteInfo.workspace_name}
                            </h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {inviteInfo.inviter_name} invited {inviteInfo.email}
                            </p>
                        </div>
                    )}
                    {!inviteInfo && stage !== "error" && (
                        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Workspace Invite</h1>
                    )}
                </div>

                <div className="px-6 py-6">
                    {/* Loading */}
                    {(stage === "loading" || stage === "accepting") && (
                        <div className="flex flex-col items-center py-8 gap-3">
                            <Loader2Icon className="size-8 animate-spin text-blue-500" />
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                {stage === "accepting" ? "Joining workspace..." : "Loading invite..."}
                            </p>
                        </div>
                    )}

                    {/* Success */}
                    {stage === "success" && (
                        <div className="flex flex-col items-center py-8 gap-3 text-center">
                            <CheckCircle2Icon className="size-10 text-emerald-500" />
                            <p className="font-semibold text-zinc-900 dark:text-white">
                                You've joined {inviteInfo?.workspace_name}!
                            </p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Redirecting to your dashboard...</p>
                        </div>
                    )}

                    {/* Error */}
                    {stage === "error" && (
                        <div className="flex flex-col items-center py-8 gap-3 text-center">
                            <XCircleIcon className="size-10 text-red-500" />
                            <p className="font-semibold text-zinc-900 dark:text-white">Invite error</p>
                            <p className="text-sm text-red-500">{errorMsg}</p>
                            <button onClick={() => navigate("/login")}
                                className="mt-2 px-4 py-2 text-sm rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                                Go to login
                            </button>
                        </div>
                    )}

                    {/* Auth */}
                    {stage === "auth" && (
                        <div className="space-y-4">
                            <div className="flex gap-1 mb-4 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                {["login", "signup"].map(m => (
                                    <button key={m} onClick={() => setAuthMode(m)}
                                        className={`flex-1 py-2 text-sm font-medium transition capitalize ${authMode === m ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                                        {m === "login" ? "Sign in" : "Create account"}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={authMode === "login" ? handleLogin : handleSignup} className="space-y-3">
                                {authMode === "signup" && (
                                    <div>
                                        <label className="text-sm text-zinc-600 dark:text-zinc-400">Your name</label>
                                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="Full name" className={inputCls} required />
                                    </div>
                                )}
                                <div>
                                    <label className="text-sm text-zinc-600 dark:text-zinc-400">Email</label>
                                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        placeholder="you@example.com" className={inputCls} required />
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-600 dark:text-zinc-400">Password</label>
                                    <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="••••••••" className={inputCls} required minLength={6} />
                                </div>
                                <button type="submit" disabled={submitting}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium disabled:opacity-60 hover:opacity-90 transition mt-2">
                                    {submitting && <Loader2Icon className="size-4 animate-spin" />}
                                    {authMode === "login" ? "Sign in & accept invite" : "Create account & accept invite"}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
