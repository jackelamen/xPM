import { useState, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '../context/AuthContext'
import { usePulse } from '../context/PulseContext'
import { useInbox } from '../context/InboxContext'
import { createTask } from '../features/workspaceSlice'
import { sendTaskToPulse } from '../lib/pulse'
import { parseCapture } from '../lib/parseCapture'
import { PlusIcon, XIcon, Loader2Icon, ZapIcon, CalendarIcon, FolderIcon, FlagIcon, ClockIcon } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const OPEN_EVENT = 'xpm:capture'

function Chip({ icon, children, onRemove }) {
    const Icon = icon
    return (
        <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[12px] text-zinc-700 dark:text-zinc-300">
            <Icon className="size-3 text-zinc-400" />{children}
            {onRemove && (
                <button type="button" onClick={onRemove} aria-label="Remove" className="p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
                    <XIcon className="size-3" />
                </button>
            )}
        </span>
    )
}

// Type a task and press Enter. "#project", "!high", "tomorrow", "fri", "2pm" are
// picked out of the text and shown as chips you can dismiss. With no project it
// lands in your Inbox, so capturing never asks you to decide anything.
function CaptureBar() {
    const [open, setOpen] = useState(false)
    const [text, setText] = useState('')
    const [ignore, setIgnore] = useState(() => new Set())
    const [manualProject, setManualProject] = useState('')
    const [toPulse, setToPulse] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const inputRef = useRef(null)
    const dispatch = useDispatch()
    const { user, pulse } = useAuth()
    const { reload } = usePulse()
    const inbox = useInbox()

    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace)
    const projects = useMemo(() => currentWorkspace?.projects || [], [currentWorkspace])

    // Global keyboard shortcut: Cmd+Shift+K
    useEffect(() => {
        function handleKeyDown(e) {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen((prev) => !prev)
            }
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Buttons elsewhere (Home, Dashboard) open the bar through this event.
    useEffect(() => {
        const openBar = () => setOpen(true)
        window.addEventListener(OPEN_EVENT, openBar)
        return () => window.removeEventListener(OPEN_EVENT, openBar)
    }, [])

    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

    const parsed = useMemo(() => parseCapture(text, projects, new Date(), ignore), [text, projects, ignore])
    const validManual = projects.some((p) => p.id === manualProject) ? manualProject : ''
    const projectId = parsed.project?.id || validManual // '' means Inbox
    const project = projects.find((p) => p.id === projectId)
    const toInbox = !projectId
    const title = parsed.title.trim()
    const dismiss = (kind) => setIgnore((s) => new Set(s).add(kind))

    const close = () => { setOpen(false); setText(''); setIgnore(new Set()) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title || !currentWorkspace || submitting) return
        setSubmitting(true)
        try {
            const target = toInbox ? await inbox.ensure() : { id: projectId }
            const task = await dispatch(createTask({
                workspaceId: currentWorkspace.id,
                projectId: target.id,
                title,
                priority: parsed.priority || 'MEDIUM',
                status: 'TODO',
                type: 'OTHER',
                leadId: user?.id || null,
                dueDate: parsed.dueDate,
                dueTime: parsed.dueTime,
            })).unwrap()
            setManualProject('')

            if (toInbox) { inbox.reload(); toast.success('Added to Inbox') }
            else if (toPulse && pulse.enabled) {
                const ok = await sendTaskToPulse(
                    { ...task, projectId, projectName: project?.name, pulseTag: project?.pulse_tag || null },
                    user.id, currentWorkspace.id,
                    { onError: (err) => toast.error(err.message || 'Failed to send to Pulse') })
                if (ok) { toast.success('Task created and sent to Pulse'); reload() }
            } else toast.success('Task created')
            close()
        } catch (err) {
            toast.error(err?.message || err || 'Failed to create task')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                title="Quick capture (⌘⇧K)"
                aria-label="Quick capture"
                className="fixed bottom-6 right-6 z-40 size-12 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg hover:opacity-90 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            >
                <PlusIcon className="size-5" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/30" onClick={close} />
                    <form onSubmit={handleSubmit}
                        className="fixed top-[22vh] left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                        <input
                            ref={inputRef}
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Add a task…  try “Send proposal friday 2pm #acme !high”"
                            className="w-full px-5 py-4 bg-transparent text-[16px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                            autoComplete="off"
                        />

                        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3 min-h-[34px]">
                            {parsed.dueDate && (
                                <Chip icon={CalendarIcon} onRemove={() => dismiss('date')}>
                                    {format(new Date(`${parsed.dueDate}T00:00:00`), 'EEE MMM d')}
                                </Chip>
                            )}
                            {parsed.dueTime && <Chip icon={ClockIcon} onRemove={() => dismiss('time')}>{parsed.dueTime}</Chip>}
                            {parsed.priority && <Chip icon={FlagIcon} onRemove={() => dismiss('priority')}>{parsed.priority.toLowerCase()}</Chip>}
                            {parsed.project
                                ? <Chip icon={FolderIcon} onRemove={() => dismiss('project')}>{parsed.project.name}</Chip>
                                : (
                                    <label className="inline-flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                                        <FolderIcon className="size-3" />
                                        <select value={validManual} onChange={(e) => setManualProject(e.target.value)}
                                            className="bg-transparent focus:outline-none max-w-[180px] truncate cursor-pointer">
                                            <option value="">Inbox</option>
                                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </label>
                                )}
                        </div>

                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60">
                            {pulse.enabled ? (
                                <label className={`inline-flex items-center gap-1.5 text-[12px] text-zinc-600 dark:text-zinc-300 ${toInbox ? 'opacity-40' : 'cursor-pointer'}`}
                                    title={toInbox ? 'Pick a project first; Inbox tasks are triaged before they go to Pulse' : undefined}>
                                    <input type="checkbox" disabled={toInbox} checked={toPulse && !toInbox} onChange={(e) => setToPulse(e.target.checked)} className="rounded" />
                                    <ZapIcon className="size-3 text-violet-500" /> Also send to Pulse
                                </label>
                            ) : <span className="text-[11px] text-zinc-400">↵ add · Esc close</span>}
                            <button type="submit" disabled={submitting || !title}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-40 hover:opacity-90 transition">
                                {submitting && <Loader2Icon className="size-3.5 animate-spin" />}
                                Add task
                            </button>
                        </div>
                    </form>
                </>
            )}
        </>
    )
}

export function CaptureButton({ label = 'Quick Capture' }) {
    return (
        <button
            onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
            title="Quick capture (⌘⇧K)"
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[13px] font-semibold rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors shadow-sm whitespace-nowrap"
        >
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            {label}
            <span className="ml-1 text-[10px] opacity-60 font-normal hidden lg:inline">⌘⇧K</span>
        </button>
    )
}

// One bar lives in the layout (so ⌘⇧K works on every page); variant="inline"
// renders just a button that opens it.
export default function QuickCapture({ variant = 'floating', label }) {
    return variant === 'inline' ? <CaptureButton label={label} /> : <CaptureBar />
}
