import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { fetchWorkspaces, fetchWorkspaceDetail, createWorkspace, archiveTasks } from '../features/workspaceSlice'
import { getAutoArchiveSetting } from './ProfileSettings'
import { useAuth } from '../context/AuthContext'
import { Loader2Icon } from 'lucide-react'
import toast from 'react-hot-toast'

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

    // Auto-archive completed tasks
    useEffect(() => {
        if (!currentWorkspace?.projects) return
        const { enabled, days } = getAutoArchiveSetting()
        if (!enabled) return

        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)

        const toArchive = currentWorkspace.projects.flatMap((p) =>
            (p.tasks || [])
                .filter((t) =>
                    t.status === 'DONE' &&
                    !t.archived_at &&
                    t.updated_at &&
                    new Date(t.updated_at) < cutoff
                )
                .map((t) => ({ id: t.id, projectId: p.id }))
        )

        if (toArchive.length === 0) return

        // Group by project and dispatch
        const byProject = toArchive.reduce((acc, t) => {
            if (!acc[t.projectId]) acc[t.projectId] = []
            acc[t.projectId].push(t.id)
            return acc
        }, {})

        Object.entries(byProject).forEach(([projectId, taskIds]) => {
            dispatch(archiveTasks({ taskIds, projectId }))
        })
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
        <div className='flex items-center justify-center h-screen bg-white dark:bg-[#0f0f11]'>
            <Loader2Icon className="size-5 text-gray-400 dark:text-zinc-500 animate-spin" />
        </div>
    )

    // New user with no workspace yet
    if (!loading && workspaces.length === 0) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f0f11] px-4">
            <div className="w-full max-w-[320px]">
                <div className="flex items-center gap-2.5 mb-8">
                    <div className="w-7 h-7 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
                        <span className="text-white dark:text-gray-900 font-bold text-[11px]">xPM</span>
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold text-[14px]">EDGEx PM</span>
                </div>
                <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white mb-1">
                    Create your workspace
                </h1>
                <p className="text-[13px] text-gray-500 dark:text-zinc-400 mb-6">
                    A workspace holds your projects and team.
                </p>
                <form onSubmit={handleCreateWorkspace} className="space-y-3">
                    <input
                        type="text"
                        required
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="e.g. Signal 7 Partners"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 placeholder:text-gray-400 dark:placeholder:text-zinc-600"
                    />
                    <button
                        type="submit"
                        disabled={creating}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        {creating && <Loader2Icon className="size-3.5 animate-spin" />}
                        Create workspace
                    </button>
                </form>
            </div>
        </div>
    )

    return (
        <div className="flex gradient-mesh dark:gradient-mesh text-gray-900 dark:text-slate-100 min-h-screen">
            {/* Sidebar overlay backdrop on mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-[9] sm:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen min-w-0">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-4 sm:p-6 xl:p-8 overflow-y-scroll bg-transparent">
                    <Outlet context={{ setIsSidebarOpen }} />
                </div>
            </div>
        </div>
    )
}

export default Layout
