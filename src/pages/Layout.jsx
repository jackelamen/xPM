import { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { fetchWorkspaces, fetchWorkspaceDetail, createWorkspace } from '../features/workspaceSlice'
import { useAuth } from '../context/AuthContext'
import { Loader2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import QuickCapture from '../components/QuickCapture'

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [wsName, setWsName] = useState('')
    const [creating, setCreating] = useState(false)

    const { user } = useAuth()
    const dispatch = useDispatch()
    const { loading, currentWorkspace, workspaces } = useSelector((state) => state.workspace)

    useEffect(() => {
        dispatch(loadTheme())
    }, [])

    useEffect(() => {
        if (user) {
            dispatch(fetchWorkspaces())
        }
    }, [user])

    useEffect(() => {
        if (currentWorkspace?.id) {
            dispatch(fetchWorkspaceDetail(currentWorkspace.id))
        }
    }, [currentWorkspace?.id])

    const handleCreateWorkspace = async (e) => {
        e.preventDefault()
        if (!wsName.trim()) return
        setCreating(true)
        try {
            await dispatch(createWorkspace({ name: wsName.trim(), userId: user.id })).unwrap()
            toast.success('Workspace created!')
        } catch (err) {
            toast.error(err || 'Failed to create workspace')
        } finally {
            setCreating(false)
        }
    }

    if (loading) return (
        <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )

    // New user with no workspace yet
    if (!loading && workspaces.length === 0) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 px-4">
            <div className="w-full max-w-sm text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 mb-4">
                    <span className="text-white font-bold text-sm">xPM</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    Create your first workspace
                </h1>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
                    A workspace holds your projects and team.
                </p>
                <form onSubmit={handleCreateWorkspace} className="space-y-3">
                    <input
                        type="text"
                        required
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="e.g. Signal 7 Partners"
                        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={creating}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                    >
                        {creating && <Loader2Icon className="size-4 animate-spin" />}
                        Create workspace
                    </button>
                </form>
            </div>
        </div>
    )

    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Outlet />
                </div>
            </div>
            <QuickCapture />
        </div>
    )
}

export default Layout
