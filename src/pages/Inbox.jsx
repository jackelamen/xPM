import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { addDays, format, nextMonday } from 'date-fns'
import { CheckCircle2Icon, Loader2Icon, Trash2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useInbox } from '../context/InboxContext'
import { ymd } from '../lib/flow'
import Tooltip from '../components/Tooltip'

const PRESETS = [
    { key: 'today', label: 'Today', date: () => ymd(new Date()) },
    { key: 'tomorrow', label: 'Tomorrow', date: () => ymd(addDays(new Date(), 1)) },
    { key: 'nextweek', label: 'Next week', date: () => ymd(nextMonday(new Date())) },
    { key: 'pick', label: 'Pick a date' },
    { key: 'none', label: 'No date' },
    { key: 'someday', label: 'Someday' },
]

// One captured task at a time: choose where it lives and when it happens.
export default function Inbox() {
    const inbox = useInbox()
    const projects = useSelector((s) => s.workspace?.currentWorkspace?.projects || [])
    const [skipped, setSkipped] = useState([])
    const [projectId, setProjectId] = useState('')
    const [when, setWhen] = useState('none')
    const [picked, setPicked] = useState('')
    const [busy, setBusy] = useState(false)
    const [handled, setHandled] = useState(0)

    // Most-used projects first, as one-click chips; the rest live in a menu.
    const ranked = useMemo(() => [...projects].sort((a, b) => (b.tasks?.length || 0) - (a.tasks?.length || 0)), [projects])
    const chips = ranked.slice(0, 8), rest = ranked.slice(8)

    const queue = useMemo(() => {
        const fresh = inbox.tasks.filter((t) => !skipped.includes(t.id))
        return fresh.length ? fresh : inbox.tasks
    }, [inbox.tasks, skipped])
    const task = queue[0]
    const total = handled + inbox.tasks.length

    // Reset the form for each new task. A date typed during capture is kept.
    useEffect(() => {
        if (!task) return
        setWhen(task.start_date || task.due_date ? 'keep' : 'none')
        setPicked('')
        setProjectId((p) => p || '')
    }, [task?.id])

    const apply = async (e) => {
        e?.preventDefault()
        if (!task || !projectId || busy) return
        setBusy(true)
        try {
            const patch = {}
            if (when === 'someday') patch.custom_fields = { ...(task.custom_fields || {}), someday: true }
            else if (when === 'none') patch.start_date = null
            else if (when === 'pick') { if (!picked) { toast.error('Pick a date'); setBusy(false); return } patch.start_date = picked }
            else if (when !== 'keep') patch.start_date = PRESETS.find((p) => p.key === when).date()
            await inbox.triage(task, projectId, patch)
            setHandled((n) => n + 1)
        } catch (err) { toast.error(err?.message || 'Could not move the task') }
        finally { setBusy(false) }
    }

    const remove = async () => {
        if (!task || !window.confirm(`Delete “${task.title}”?`)) return
        try { await inbox.discard(task); setHandled((n) => n + 1) } catch (err) { toast.error(err?.message || 'Could not delete') }
    }

    if (inbox.loading) return <div className="flex justify-center py-24"><Loader2Icon className="size-5 animate-spin text-zinc-400" /></div>

    if (!task) {
        return (
            <div className="max-w-xl mx-auto text-center py-20">
                <CheckCircle2Icon className="size-10 mx-auto text-emerald-500 mb-4" />
                <h1 className="text-[24px] font-bold tracking-tight text-gray-900 dark:text-white">Inbox clear</h1>
                <p className="text-[14px] text-gray-500 dark:text-zinc-400 mt-2">
                    {handled > 0 ? `You sorted ${handled} item${handled > 1 ? 's' : ''}.` : 'Nothing waiting. Press ⌘⇧K to capture something.'}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <Link to="/week?tab=plan" className="px-4 py-2 rounded-lg text-[13px] font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900">Plan your week</Link>
                    <Link to="/" className="px-4 py-2 rounded-lg text-[13px] border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300">Home</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-xl mx-auto">
            <div className="flex items-baseline justify-between mb-4">
                <h1 className="text-[34px] font-bold tracking-tight leading-none text-ink-900 dark:text-white">Inbox</h1>
                <p className="text-[13px] text-gray-500 dark:text-zinc-400 tabular-nums">{handled + 1} of {total}</p>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 mb-6 overflow-hidden">
                <div className="h-full bg-signal-500 transition-all" style={{ width: `${(handled / Math.max(total, 1)) * 100}%` }} />
            </div>

            <form onSubmit={apply} className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-7">
                <h2 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-white">{task.title}</h2>
                {task.description && <p className="text-[13px] text-gray-500 dark:text-zinc-400 mt-1">{task.description}</p>}
                <p className="text-[12px] text-gray-400 mt-1">Captured {format(new Date(task.created_at), 'EEE MMM d, h:mm a')}</p>

                <p className="mt-7 text-[14px] font-semibold text-gray-900 dark:text-zinc-100">Where does it live?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {chips.map((p) => (
                        <button type="button" key={p.id} onClick={() => setProjectId(p.id)}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[14px] border transition-colors ${projectId === p.id
                                ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-950 dark:border-white'
                                : 'border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-ink-400'}`}>
                            <span className="size-2 rounded-full" style={{ background: p.color || '#6489b3' }} />{p.name}
                        </button>
                    ))}
                    {rest.length > 0 && (
                        <select value={rest.some((p) => p.id === projectId) ? projectId : ''} onChange={(e) => e.target.value && setProjectId(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-transparent text-[14px] text-gray-600 dark:text-zinc-300">
                            <option value="">More projects…</option>
                            {rest.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                </div>

                <p className="mt-6 text-[14px] font-semibold text-gray-900 dark:text-zinc-100">When?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {(task.start_date || task.due_date) && (
                        <button type="button" onClick={() => setWhen('keep')}
                            className={`px-3 py-1.5 rounded-full text-[13px] border ${when === 'keep' ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-950 dark:border-white' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300'}`}>
                            Keep {format(new Date(`${task.start_date || task.due_date}T00:00:00`), 'MMM d')}
                        </button>
                    )}
                    {PRESETS.map((p) => (
                        <button type="button" key={p.key} onClick={() => setWhen(p.key)}
                            className={`px-3 py-1.5 rounded-full text-[13px] border ${when === p.key ? 'bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-950 dark:border-white' : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300'}`}>
                            {p.label}
                        </button>
                    ))}
                </div>
                {when === 'pick' && (
                    <input type="date" value={picked} onChange={(e) => setPicked(e.target.value)}
                        className="mt-3 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-transparent text-[13px]" />
                )}

                <div className="mt-7 flex items-center gap-3">
                    <button type="submit" disabled={!projectId || busy}
                        className="px-5 py-2.5 rounded-lg text-[15px] font-semibold bg-signal-500 hover:bg-signal-400 text-ink-950 disabled:opacity-40 transition-colors">
                        {busy ? 'Saving…' : 'Done · next'}
                    </button>
                    <button type="button" onClick={() => setSkipped((s) => [...s, task.id])} disabled={inbox.tasks.length < 2}
                        className="text-[13px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white disabled:opacity-30">Skip</button>
                    <Tooltip label="Delete this task" className="ml-auto">
                        <button type="button" onClick={remove} className="text-gray-400 hover:text-red-600" aria-label="Delete this task">
                            <Trash2Icon className="size-4" />
                        </button>
                    </Tooltip>
                </div>
            </form>
        </div>
    )
}
