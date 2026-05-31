import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2Icon } from 'lucide-react'

const Login = () => {
    const { signIn, signUp } = useAuth()
    const navigate = useNavigate()

    const [mode, setMode] = useState('login') // 'login' | 'signup'
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
            } else {
                const { error } = await signUp(email, password)
                if (error) throw error
                toast.success('Account created. You can now sign in.')
                setMode('login')
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 px-4">
            <div className="w-full max-w-sm">
                {/* Logo / Title */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 mb-4">
                        <span className="text-white font-bold text-sm">xPM</span>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                        The EDGEx PM
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                        {mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-700 dark:text-zinc-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-700 dark:text-zinc-300 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                    >
                        {loading && <Loader2Icon className="size-4 animate-spin" />}
                        {mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                {/* Toggle */}
                <p className="text-sm text-center text-gray-500 dark:text-zinc-400 mt-6">
                    {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                        className="text-blue-500 hover:underline"
                    >
                        {mode === 'login' ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    )
}

export default Login
