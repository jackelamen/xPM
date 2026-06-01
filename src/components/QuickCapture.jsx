import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '../context/AuthContext'
import { createTask } from '../features/workspaceSlice'
import { PlusIcon, XIcon, Loader2Icon } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuickCapture({ variant = 'floating' }) {
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState('')
    const [projectId, setProjectId] = useState('')
    const [priority, setPriority] = useState('MEDIUM')
    const [submitting, setSubmitting] = useState(false)
    const inputRef = useRef(null)
    const dispatch = useDispatch()
    const { user } = useAuth()

    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace)
    const projects = currentWorkspace?.projects || []
    const firstProjectId = projects[0]?.id

    // Global keyboard shortcut: Cmd+Shift+K
    useEffect(() => {
        function handleKeyDown(e) {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'k') {
                e.preventDefault()
                setOpen((prev) => !prev)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50)
            if (firstProjectId && !projectId) setProjectId(firstProjectId)
        }
    }, [open, firstProjectId, projectId])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title.trim() || !projectId || !currentWorkspace) return
        setSubmitting(true)
        try {
            await dispatch(createTask({
                workspaceId: currentWorkspace.id,
                projectId,
                title: title.trim(),
                priority,
                status: 'TODO',
                type: 'MEETING',
                assigneeId: user?.id || null,
            })).unwrap()
            toast.success('Task created')
            setTitle('')
            setOpen(false)
        } catch (err) {
            toast.error(err || 'Failed to create task')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            {variant === 'inline' ? (
                <button
                    onClick={() => setOpen(true)}
                    title="Quick capture (⌘⇧K)"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors whitespace-nowrap"
                >
                    <PlusIcon className="size-3.5" strokeWidth={2.5} />
                    Quick Capture
                    <span className="ml-1 text-[10px] text-gray-400 dark:text-zinc-600 font-normal hidden lg:inline">⌘⇧K</span>
                </button>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    title="Quick capture (⌘⇧K)"
                    className="fixed bottom-6 right-6 z-40 size-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:opacity-90 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                >
                    <PlusIcon className="size-5" />
                </button>
            )}

            {/* Modal */}
            {open && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/20 dark:bg-black/40" onClick={() => setOpen(false)} />
                    <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Quick Capture</h2>
                            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <XIcon className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <input
                                ref={inputRef}
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What needs to be done?"
                                className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-zinc-400"
                                required
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Project</label>
                                    <select
                                        value={projectId}
                                        onChange={(e) => setProjectId(e.target.value)}
                                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Select project</option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 block">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className="w-full px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <p className="text-xs text-zinc-400 dark:text-zinc-500">⌘⇧K to toggle</p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || !title.trim() || !projectId}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60 hover:opacity-90 transition"
                                    >
                                        {submitting && <Loader2Icon className="size-3.5 animate-spin" />}
                                        Add Task
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </>
    )
}
