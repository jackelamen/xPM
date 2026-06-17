import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { setCurrentWorkspace, fetchWorkspaceDetail } from '../features/workspaceSlice'
import { isPast, isToday, startOfDay } from 'date-fns'
import {
    CheckCircle2, Circle, CircleDot, ChevronDown, ChevronRight, Globe2, Loader2,
    SquareArrowOutUpRight, FolderIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── config (mirrors MyTasks) ───────────────────────────────────────────────────
const STATUS_OPTIONS   = ['TODO', 'IN_PROGRESS', 'DONE']
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

const STATUS_CFG = {
    TODO:        { label: 'To Do',       Icon: Circle,       cls: 'text-zinc-400 dark:text-zinc-500' },
    IN_PROGRESS: { label: 'In Progress', Icon: CircleDot,    cls: 'text-blue-500' },
    DONE:        { label: 'Done',        Icon: CheckCircle2, cls: 'text-emerald-500' },
}

const PRIORITY_CFG = {
    LOW:    { label: 'Low',    cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
    MEDIUM: { label: 'Medium', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400' },
    HIGH:   { label: 'High',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
    URGENT: { label: 'Urgent', cls: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' },
}

// ── small inline-edit primitives ───────────────────────────────────────────────
function StatusToggle({ status, onChange }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.TODO
    const next = () => {
        const i = STATUS_OPTIONS.indexOf(status)
        onChange(STATUS_OPTIONS[(i + 1) % STATUS_OPTIONS.length])
    }
    const Icon = cfg.Icon
    return (
        <button onClick={next} title={`${cfg.label} — click to cycle`}
            className="flex items-center gap-1.5 text-left whitespace-nowrap">
            <Icon size={16} className={`shrink-0 ${cfg.cls}`} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{cfg.label}</span>
        </button>
    )
}

function PrioritySelect({ priority, onChange }) {
    const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.MEDIUM
    return (
        <div className="relative inline-block">
            <select value={priority} onChange={(e) => onChange(e.target.value)}
                className={`appearance-none cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
                {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>
                ))}
            </select>
        </div>
    )
}

function DueDateCell({ value, onChange }) {
    const date = value ? new Date(value + 'T00:00:00') : null
    const overdue = date && isPast(startOfDay(date)) && !isToday(date)
    return (
        <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value || null)}
            className={`bg-transparent text-xs outline-none cursor-pointer ${overdue ? 'text-red-500' : 'text-zinc-500 dark:text-zinc-400'}`} />
    )
}

function TitleCell({ value, onSave }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    useEffect(() => setDraft(value), [value])
    if (editing) {
        const commit = () => { setEditing(false); if (draft.trim() && draft !== value) onSave(draft.trim()) }
        return (
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
                className="w-full bg-transparent border-b border-indigo-400 outline-none text-sm text-zinc-900 dark:text-white" />
        )
    }
    return (
        <button onClick={() => setEditing(true)}
            className="text-left text-sm text-zinc-900 dark:text-white hover:text-indigo-500 truncate w-full">
            {value}
        </button>
    )
}

// ── page ────────────────────────────────────────────────────────────────────────
export default function AllTasks() {
    const { isSuperadmin, loading: authLoading } = useAuth()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [collapsed, setCollapsed] = useState({}) // workspace_id -> bool
    const [showDone, setShowDone] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase.rpc('get_my_tasks_global')
        if (error) { setError(error.message); setLoading(false); return }
        setTasks(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { if (isSuperadmin) load() }, [isSuperadmin, load])

    // Persist a field change optimistically, roll back on failure.
    const handleSave = useCallback(async (taskId, fields) => {
        const prev = tasks
        const patch = { ...fields }
        if (Object.prototype.hasOwnProperty.call(fields, 'status')) {
            patch.completed_at = fields.status === 'DONE' ? new Date().toISOString() : null
        }
        setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, ...fields } : t)))
        const { error } = await supabase
            .from('xpm_tasks')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', taskId)
        if (error) { setTasks(prev); toast.error(error.message || 'Failed to save') }
    }, [tasks])

    // Open a task in its own workspace: switch workspace context, then deep-link
    // to the project detail with ?task=<id>, which opens the full TaskPanel editor.
    const openInWorkspace = useCallback((t) => {
        dispatch(setCurrentWorkspace(t.workspace_id))
        dispatch(fetchWorkspaceDetail(t.workspace_id))
        navigate(`/projectsDetail?id=${t.project_id}&task=${t.id}`)
    }, [dispatch, navigate])

    // Group: workspace -> project -> tasks
    const groups = useMemo(() => {
        const visible = showDone ? tasks : tasks.filter((t) => t.status !== 'DONE')
        const byWs = new Map()
        for (const t of visible) {
            if (!byWs.has(t.workspace_id)) byWs.set(t.workspace_id, { id: t.workspace_id, name: t.workspace_name, projects: new Map() })
            const ws = byWs.get(t.workspace_id)
            if (!ws.projects.has(t.project_id)) ws.projects.set(t.project_id, { id: t.project_id, name: t.project_name, tasks: [] })
            ws.projects.get(t.project_id).tasks.push(t)
        }
        return [...byWs.values()].map((ws) => ({ ...ws, projects: [...ws.projects.values()] }))
    }, [tasks, showDone])

    const openCount = tasks.filter((t) => t.status !== 'DONE').length
    const doneCount = tasks.length - openCount

    if (authLoading) return null
    if (!isSuperadmin) return <Navigate to="/my-tasks" replace />

    return (
        <div className="max-w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="grid place-items-center size-10 rounded-lg bg-indigo-500/10 text-indigo-500">
                        <Globe2 size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">All Workspaces</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {openCount} open · {doneCount} completed · {groups.length} workspace{groups.length === 1 ? '' : 's'}
                        </p>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                    <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
                    Show completed
                </label>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-zinc-400">
                    <Loader2 className="animate-spin mr-2" size={18} /> Loading tasks across all workspaces…
                </div>
            ) : error ? (
                <div className="py-12 text-center text-sm text-red-500">{error}</div>
            ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <CheckCircle2 className="size-10 text-zinc-200 dark:text-zinc-700" />
                    <p className="text-sm text-zinc-400">Nothing assigned to you anywhere. You're all caught up.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {groups.map((ws) => {
                        const isCollapsed = collapsed[ws.id]
                        const wsCount = ws.projects.reduce((n, p) => n + p.tasks.length, 0)
                        return (
                            <div key={ws.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                                <button onClick={() => setCollapsed((c) => ({ ...c, [ws.id]: !c[ws.id] }))}
                                    className="w-full flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-white/[0.02] border-b border-zinc-100 dark:border-white/[0.06] text-left">
                                    {isCollapsed ? <ChevronRight size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300">{ws.name}</span>
                                    <span className="text-[11px] text-zinc-400">· {wsCount}</span>
                                </button>
                                {!isCollapsed && (
                                    <table className="w-full border-collapse text-sm">
                                        <tbody>
                                            {ws.projects.map((p) => (
                                                <React.Fragment key={p.id}>
                                                    <tr className="bg-zinc-100/80 dark:bg-white/[0.04] border-t border-zinc-200 dark:border-white/[0.06]">
                                                        <td colSpan={5} className="px-4 py-2">
                                                            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-700 dark:text-zinc-200">
                                                                <FolderIcon size={13} className="text-indigo-500 shrink-0" />
                                                                {p.name}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {p.tasks.map((t) => (
                                                        <tr key={t.id} className="group border-t border-zinc-100 dark:border-white/[0.04] hover:bg-zinc-50 dark:hover:bg-white/[0.02]">
                                                            <td className="px-4 py-2 w-[120px] align-middle"><StatusToggle status={t.status} onChange={(s) => handleSave(t.id, { status: s })} /></td>
                                                            <td className="px-2 py-2 align-middle"><TitleCell value={t.title} onSave={(v) => handleSave(t.id, { title: v })} /></td>
                                                            <td className="px-2 py-2 w-[110px] align-middle"><PrioritySelect priority={t.priority} onChange={(v) => handleSave(t.id, { priority: v })} /></td>
                                                            <td className="px-2 py-2 w-[130px] align-middle"><DueDateCell value={t.due_date} onChange={(v) => handleSave(t.id, { due_date: v })} /></td>
                                                            <td className="px-3 py-2 w-[44px] align-middle text-right">
                                                                <button onClick={() => openInWorkspace(t)} title="Open in workspace"
                                                                    className="p-1 rounded text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <SquareArrowOutUpRight size={15} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
