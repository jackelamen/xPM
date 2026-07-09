/**
 * ResetPassword — handles the /reset-password link from Supabase's
 * "forgot password" email (see Login.jsx's resetPasswordForEmail call).
 *
 * Supabase's client redirects here with recovery tokens in the URL hash;
 * supabase-js auto-parses them (detectSessionInUrl defaults to true) and
 * fires a PASSWORD_RECOVERY auth event once the session is set. We wait for
 * that event specifically, rather than just checking for any session, so
 * an already-logged-in user landing here by accident isn't silently treated
 * as mid-reset.
 */
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { Loader2Icon, XCircleIcon } from "lucide-react"
import toast from "react-hot-toast"

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 mt-1.5"

export default function ResetPassword() {
    const navigate = useNavigate()
    const [stage, setStage] = useState("waiting") // waiting | ready | error
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") setStage("ready")
        })

        // The URL carries an error (e.g. expired/used link) instead of tokens.
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
        if (hash.get("error")) setStage("error")

        // Recovery link already consumed by the time this mounts (e.g. a
        // refresh) — a lingering recovery session still lets updateUser work.
        const timeout = setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session } }) => {
                setStage((s) => (s === "waiting" ? (session ? "ready" : "error") : s))
            })
        }, 2500)

        return () => { subscription.unsubscribe(); clearTimeout(timeout) }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (password.length < 6) return toast.error("Password must be at least 6 characters")
        if (password !== confirm) return toast.error("Passwords don't match")
        setSubmitting(true)
        const { error } = await supabase.auth.updateUser({ password })
        setSubmitting(false)
        if (error) return toast.error(error.message)
        toast.success("Password updated — you're signed in.")
        navigate("/")
    }

    return (
        <div className="min-h-screen bg-[#f8f8f8] dark:bg-[#0e0e0e] flex items-center justify-center p-4">
            <div className="w-full max-w-[340px]">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-7 h-7 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
                        <span className="text-white dark:text-gray-900 font-bold text-[11px]">xPM</span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold text-[14px]">EDGEx PM</span>
                </div>

                {stage === "waiting" && (
                    <div className="flex flex-col items-center py-10 gap-3 text-center">
                        <Loader2Icon className="size-7 animate-spin text-gray-400" />
                        <p className="text-[13px] text-gray-500 dark:text-zinc-400">Verifying your reset link...</p>
                    </div>
                )}

                {stage === "error" && (
                    <div className="flex flex-col items-center py-10 gap-3 text-center">
                        <XCircleIcon className="size-9 text-red-500" />
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white">Link expired or invalid</p>
                        <p className="text-[13px] text-gray-500 dark:text-zinc-400">Request a new reset link from the sign-in page.</p>
                        <button
                            onClick={() => navigate("/login")}
                            className="mt-2 px-4 py-2 text-[13px] rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-white/[0.1] transition"
                        >
                            Back to sign in
                        </button>
                    </div>
                )}

                {stage === "ready" && (
                    <>
                        <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white mb-1">Set a new password</h1>
                        <p className="text-[13px] text-gray-500 dark:text-zinc-400 mb-7">Choose a new password for your account</p>

                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-[12px] font-medium text-gray-600 dark:text-zinc-400">
                                    New password
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={inputCls}
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-[12px] font-medium text-gray-600 dark:text-zinc-400">
                                    Confirm new password
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    className={inputCls}
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                                {submitting && <Loader2Icon className="size-3.5 animate-spin" />}
                                Update password
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
