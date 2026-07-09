import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2Icon } from 'lucide-react'
import { supabase } from '../lib/supabase'

const Login = () => {
    const { signIn, signUp } = useAuth()
    const navigate = useNavigate()

    const [mode, setMode] = useState('login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password)
                if (error) throw error
                navigate('/')
            } else if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                })
                if (error) throw error
                toast.success('Check your email for a password reset link.')
                setMode('login')
            } else {
                const { error } = await signUp(email, password)
                if (error) throw error

                // Update profile name if provided
                if (name.trim()) {
                    await supabase
                        .from('profiles')
                        .update({ name: name.trim() })
                        .eq('email', email.toLowerCase())
                }

                toast.success('Account created. You can now sign in.')
                setMode('login')
                setName('')
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-[#f8f8f8] dark:bg-[#0e0e0e]">
            {/* Left panel */}
            <div className="hidden lg:flex flex-col justify-between w-[380px] bg-gray-900 dark:bg-black p-10 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
                        <span className="text-gray-900 font-bold text-[11px] tracking-tight">xPM</span>
                    </div>
                    <span className="text-white font-semibold text-[14px]">EDGEx PM</span>
                </div>
                <div>
                    <blockquote className="text-gray-300 text-[15px] leading-relaxed font-light italic mb-4">
                        "The workspace built for how we actually work."
                    </blockquote>
                    <p className="text-gray-500 text-[12px]">Replace Asana. Keep control.</p>
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-[340px]">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-7 h-7 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
                            <span className="text-white dark:text-gray-900 font-bold text-[11px]">xPM</span>
                        </div>
                        <span className="text-gray-900 dark:text-white font-semibold text-[14px]">EDGEx PM</span>
                    </div>

                    <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white mb-1">
                        {mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Reset your password' : 'Create account'}
                    </h1>
                    <p className="text-[13px] text-gray-500 dark:text-zinc-400 mb-7">
                        {mode === 'login' ? 'Welcome back to your workspace' : mode === 'forgot' ? "We'll email you a link to set a new password" : 'Get started with EDGEx PM'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-[12px] font-medium text-gray-600 dark:text-zinc-400 mb-1.5">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 placeholder:text-gray-400 dark:placeholder:text-zinc-600 transition-shadow"
                                    placeholder="Jack Lamen"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-[12px] font-medium text-gray-600 dark:text-zinc-400 mb-1.5">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 placeholder:text-gray-400 dark:placeholder:text-zinc-600 transition-shadow"
                                placeholder="you@company.com"
                            />
                        </div>

                        {mode !== 'forgot' && (
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-[12px] font-medium text-gray-600 dark:text-zinc-400">
                                        Password
                                    </label>
                                    {mode === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => setMode('forgot')}
                                            className="text-[12px] text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 hover:underline"
                                        >
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 placeholder:text-gray-400 dark:placeholder:text-zinc-600 transition-shadow"
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 mt-1 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                            {loading && <Loader2Icon className="size-3.5 animate-spin" />}
                            {mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Create account'}
                        </button>
                    </form>

                    <p className="text-[12px] text-center text-gray-400 dark:text-zinc-500 mt-5">
                        {mode === 'forgot' ? (
                            <button
                                onClick={() => setMode('login')}
                                className="text-gray-700 dark:text-zinc-300 font-medium hover:underline"
                            >
                                Back to sign in
                            </button>
                        ) : (
                            <>
                                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                                <button
                                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setName('') }}
                                    className="text-gray-700 dark:text-zinc-300 font-medium hover:underline"
                                >
                                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
