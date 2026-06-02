import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useAuth } from '../context/AuthContext'
import { format, isToday, isTomorrow, isPast, startOfDay } from 'date-fns'
import {
    CheckCircle2, Circle, CircleDot, ChevronDown, ChevronRight, Settings2, Eye, EyeOff, ZapIcon,
} from 'lucide-react'
import { updateTask } from '../features/workspaceSlice'
import TaskPanel from '../components/TaskPanel'
import toast from 'react-hot-toast'
import { getPulseEnabled } from './ProfileSettings'
import { supabase } from '../lib/supabase'

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS   = ['TODO', 'IN_PROGRESS', 'DONE']
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const TYPE_OPTIONS     = ['MEETING', 'WRITING', 'STRATEGY', 'DESIGN', 'ADMIN', 'OTHER']

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

const TYPE_CFG = Object.fromEntries(
    TYPE_OPTIONS.map((t) => [t, { label: t[0] + t.slice(1).toLowerCase(), cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' }])
)

// columns — key, label, col-span (out of 12)
const ALL_COLS = [
    { key: 'status',        label: 'Status',     width: '90px',  defaultOn: true },
    { key: 'title',         label: 'Title',      width: '1fr',   defaultOn: true, fixed: true },
    { key: 'priority',      label: 'Priority',   width: '88px',  defaultOn: true },
    { key: 'type',          label: 'Type',       width: '88px',  defaultOn: true },
    { key: 'due_date',      label: 'Due Date',   width: '110px', defaultOn: true },
    { key: 'start_date',    label: 'Start Date', width: '110px', defaultOn: false },
    { key: 'project',       label: 'Project',    width: '110px', defaultOn: true },
    { key: 'assignee',      label: 'Assignee',   width: '110px', defaultOn: false },
    { key: 'section',       label: 'Section',    width: '88px',  defaultOn: false },
    { key: 'tags',          label: 'Tags',       width: '80px',  defaultOn: false },
    { key: 'send_to_pulse', label: 'Pulse',      width: '44px',  defaultOn: false, pulseOnly: true },
]

function visibleCols(colVis) {
    return ALL_COLS.filter((c) => c.fixed || colVis[c.key] !== false)
}

function gridTemplate(cols) {
    return cols.map((c) => c.width).join(' ')
}

function getGroup(task) {
    if (!task.due_date) return 'later'
    const d = new Date(task.due_date)
    if (isPast(startOfDay(d)) || isToday(d)) return 'today'
    if (isTomorrow(d)) return 'tomorrow'
    return 'later'
}

// ── reusable dropdown ─────────────────────────────────────────────────────────

function Dropdown({ trigger, children }) {
    const [open, setOpen] = useState(false)
    const [pos, setPos] = useState({ top: 0, left: 0 })
    const triggerRef = useRef(null)
    const menuRef = useRef(null)

    useEffect(() => {
        const h = (e) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target) &&
                menuRef.current && !menuRef.current.contains(e.target)
            ) setOpen(false)
        }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    const handleOpen = (e) => {
        e.stopPropagation()
        if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
        }
        setOpen((v) => !v)
    }

    return (
        <>
            <div ref={triggerRef} onClick={handleOpen} className="inline-block">
                {trigger}
            </div>
            {open && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999 }}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl py-1 min-w-[140px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {typeof children === 'function' ? children(() => setOpen(false)) : children}
                </div>,
                document.body
            )}
        </>
    )
}

// ── cell components ───────────────────────────────────────────────────────────

function StatusCell({ task, onSave }) {
    const cfg = STATUS_CFG[task.status] || STATUS_CFG.TODO
    const Icon = cfg.Icon
    return (
        <Dropdown
            trigger={
                <button className={`flex items-center gap-1.5 text-xs font-medium ${cfg.cls} hover:opacity-70 transition-opacity`}>
                    <Icon size={13} strokeWidth={1.75} />
                    {cfg.label}
                </button>
            }
        >
            {(close) => STATUS_OPTIONS.map((s) => {
                const c = STATUS_CFG[s]; const I = c.Icon
                return (
                    <button key={s} onClick={() => { onSave({ status: s }); close() }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <I size={13} className={c.cls} />
                        <span className="text-zinc-700 dark:text-zinc-300">{c.label}</span>
                    </button>
                )
            })}
        </Dropdown>
    )
}

function BadgeCell({ value, cfgMap, options, onSave, placeholder = '—' }) {
    const cfg = cfgMap[value]
    return (
        <Dropdown
            trigger={
                <button className={`text-xs px-2 py-0.5 rounded font-medium transition-opacity hover:opacity-80 ${cfg?.cls || 'text-zinc-300 dark:text-zinc-700'}`}>
                    {cfg?.label || <span className="opacity-40">{placeholder}</span>}
                </button>
            }
        >
            {(close) => options.map((opt) => {
                const c = cfgMap[opt]
                return (
                    <button key={opt} onClick={() => { onSave(opt); close() }}
                        className="w-full text-left px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${c?.cls || 'text-zinc-500'}`}>{c?.label || opt}</span>
                    </button>
                )
            })}
        </Dropdown>
    )
}

function DateCell({ value, onSave }) {
    const [editing, setEditing] = useState(false)
    const isOverdue = value && isPast(new Date(value)) && !isToday(new Date(value))
    if (editing) return (
        <input type="date" autoFocus defaultValue={value?.slice(0, 10) || ''}
            onBlur={(e) => { onSave(e.target.value || null); setEditing(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5 bg-white dark:bg-zinc-800 outline-none w-full"
        />
    )
    return (
        <button onClick={(e) => { e.stopPropagation(); setEditing(true) }}
            className={`text-sm hover:underline ${isOverdue ? 'text-red-500 font-medium' : value ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100'}`}>
            {value ? format(new Date(value), 'MMM d, yyyy') : '—'}
        </button>
    )
}

function ProjectCell({ task, projects, onSave }) {
    const proj = projects.find((p) => p.id === task.projectId)
    return (
        <Dropdown
            trigger={
                <button className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline truncate max-w-[120px]">
                    {proj?.name || '—'}
                </button>
            }
        >
            {(close) => projects.map((p) => (
                <button key={p.id} onClick={() => { onSave({ project_id: p.id }); close() }}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors truncate">
                    {p.name}
                </button>
            ))}
        </Dropdown>
    )
}

function AssigneeCell({ task, members, onSave }) {
    const member = members.find((m) => m.user_id === task.assignee_id)
    const name = member?.user?.name || member?.user?.email
    return (
        <Dropdown
            trigger={
                <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:underline">
                    {name ? (
                        <>
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0">{name[0].toUpperCase()}</span>
                            <span className="truncate max-w-[80px]">{name}</span>
                        </>
                    ) : <span className="text-zinc-300 dark:text-zinc-700 opacity-0 group-hover:opacity-100">Assign</span>}
                </button>
            }
        >
            {(close) => <>
                <button onClick={() => { onSave({ assignee_id: null }); close() }}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">Unassign</button>
                {members.map((m) => {
                    const n = m.user?.name || m.user?.email || 'Unknown'
                    return (
                        <button key={m.user_id} onClick={() => { onSave({ assignee_id: m.user_id }); close() }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                            <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[9px] flex items-center justify-center font-bold">{n[0].toUpperCase()}</span>
                            <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{n}</span>
                        </button>
                    )
                })}
            </>}
        </Dropdown>
    )
}

function TextCell({ value, onSave, placeholder = '—' }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value || '')
    const commit = () => { onSave(draft); setEditing(false) }
    if (editing) return (
        <input autoFocus type="text" value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5 bg-white dark:bg-zinc-800 outline-none w-full"
        />
    )
    return (
        <button onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(value || '') }}
            className={`text-xs text-left truncate hover:underline ${value ? 'text-zinc-500' : 'text-zinc-300 opacity-0 group-hover:opacity-100'}`}>
            {value || placeholder}
        </button>
    )
}

// ── send to pulse ─────────────────────────────────────────────────────────────

// Pulse priority: 0=none, 1=low, 2=medium, 3=high
function xpmPriorityToPulse(p) {
    if (p === 'HIGH' || p === 'URGENT') return 3
    if (p === 'MEDIUM') return 2
    if (p === 'LOW') return 1
    return 0
}

async function sendTaskToPulse(task, userId) {
    try {
        const { error } = await supabase.from('tasks').insert({
            user_id: userId,
            title: task.title,
            notes: task.description || null,
            due_at: task.due_date ? new Date(task.due_date).toISOString() : null,
            status: 'todo',
            priority: xpmPriorityToPulse(task.priority),
        })
        if (error) throw error
        return true
    } catch (err) {
        toast.error(err.message || 'Failed to send to Pulse')
        return false
    }
}

function SendToPulseCell({ task, userId }) {
    const [sent, setSent] = useState(!!task.custom_fields?.sent_to_pulse)
    const [loading, setLoading] = useState(false)

    const handle = async (e) => {
        e.stopPropagation()
        if (sent || loading) return
        setLoading(true)
        const ok = await sendTaskToPulse(task, userId)
        if (ok) {
            setSent(true)
            toast.success('Task sent to Pulse')
        }
        setLoading(false)
    }

    return (
        <button
            onClick={handle}
            disabled={sent || loading}
            title={sent ? 'Already sent to Pulse' : 'Send this task to Pulse'}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                sent
                    ? 'text-violet-500 cursor-default'
                    : 'text-zinc-400 hover:text-violet-500'
            }`}
        >
            {loading
                ? <span className="size-3 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                : <ZapIcon size={14} strokeWidth={2.5} fill={sent ? 'currentColor' : 'none'} className={sent ? 'text-violet-500' : 'text-zinc-400 hover:text-violet-500'} />
            }
        </button>
    )
}

// ── column visibility picker ──────────────────────────────────────────────────

function FieldPicker({ colVis, onChange }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] transition-colors">
                <Settings2 size={12} /> Fields
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl py-2 w-52">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-3 pb-2">Show / hide fields</p>
                    {ALL_COLS.filter((c) => !c.fixed && (!c.pulseOnly || getPulseEnabled())).map((col) => {
                        const on = colVis[col.key] !== false
                        return (
                            <label key={col.key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                                <input type="checkbox" checked={on} onChange={(e) => onChange(col.key, e.target.checked)} className="size-3" />
                                <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1">{col.label}</span>
                                {on ? <Eye size={11} className="text-zinc-400" /> : <EyeOff size={11} className="text-zinc-300" />}
                            </label>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ── task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, cols, members, projects, onRowClick, onSave, userId }) {
    const isDone = task.status === 'DONE'
    const save = useCallback((fields) => onSave(task, fields), [task, onSave])

    const renderCell = (col) => {
        switch (col.key) {
            case 'status':
                return <StatusCell task={task} onSave={save} />
            case 'title':
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={(e) => { e.stopPropagation(); save({ status: isDone ? 'TODO' : 'DONE' }) }}
                            className={`flex-shrink-0 transition-colors ${isDone ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-emerald-400'}`}>
                            {isDone ? <CheckCircle2 size={16} strokeWidth={1.75} /> : <Circle size={16} strokeWidth={1.75} />}
                        </button>
                        <button onClick={() => onRowClick(task)}
                            className={`text-sm font-medium truncate text-left hover:underline ${isDone ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {task.title}
                        </button>
                    </div>
                )
            case 'priority':
                return <BadgeCell value={task.priority} cfgMap={PRIORITY_CFG} options={PRIORITY_OPTIONS} onSave={(v) => save({ priority: v })} placeholder="Priority" />
            case 'type':
                return <BadgeCell value={task.type} cfgMap={TYPE_CFG} options={TYPE_OPTIONS} onSave={(v) => save({ type: v })} placeholder="Type" />
            case 'due_date':
                return <DateCell value={task.due_date} onSave={(v) => save({ due_date: v })} />
            case 'start_date':
                return <DateCell value={task.start_date} onSave={(v) => save({ start_date: v })} />
            case 'project':
                return <ProjectCell task={task} projects={projects} onSave={save} />
            case 'assignee':
                return <AssigneeCell task={task} members={members} onSave={save} />
            case 'section':
                return <TextCell value={task.custom_fields?.section} onSave={(v) => save({ custom_fields: { ...task.custom_fields, section: v } })} placeholder="Section" />
            case 'tags':
                return <TextCell value={task.custom_fields?.tags} onSave={(v) => save({ custom_fields: { ...task.custom_fields, tags: v } })} placeholder="Tags" />
            case 'send_to_pulse':
                return <SendToPulseCell task={task} userId={userId} />
            default:
                return null
        }
    }

    return (
        <div className={`group grid border-t border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] hover:-translate-y-px hover:shadow-sm transition-all duration-150 cursor-pointer ${isDone ? 'opacity-60' : ''}`}
            style={{ gridTemplateColumns: gridTemplate(cols) }}>
            {cols.map((col) => (
                <div key={col.key} className="px-3 py-3 flex items-center min-w-0 overflow-hidden">
                    {renderCell(col)}
                </div>
            ))}
        </div>
    )
}

// ── mobile task card ──────────────────────────────────────────────────────────

function MobileTaskCard({ task, onRowClick, onSave }) {
    const isDone = task.status === 'DONE'
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
    const priorityCfg = PRIORITY_CFG[task.priority]

    const PRIORITY_DOT = {
        LOW:    'bg-zinc-400',
        MEDIUM: 'bg-amber-400',
        HIGH:   'bg-emerald-500',
        URGENT: 'bg-red-500',
    }

    return (
        <div
            onClick={() => onRowClick(task)}
            className={`flex items-start gap-3 px-4 py-3.5 border-b border-zinc-100 dark:border-white/[0.06] active:bg-zinc-50 dark:active:bg-white/[0.03] transition-colors ${isDone ? 'opacity-50' : ''}`}
        >
            {/* Checkbox */}
            <button
                onClick={(e) => { e.stopPropagation(); onSave(task, { status: isDone ? 'TODO' : 'DONE' }) }}
                className={`flex-shrink-0 mt-0.5 transition-colors ${isDone ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-600'}`}
            >
                {isDone ? <CheckCircle2 size={20} strokeWidth={1.75} /> : <Circle size={20} strokeWidth={1.75} />}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={`text-[15px] font-medium leading-snug ${isDone ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>
                    {task.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[12px] text-zinc-400 dark:text-zinc-500 truncate">{task.projectName}</span>
                    {task.priority && (
                        <>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span className="flex items-center gap-1 text-[12px] text-zinc-400 dark:text-zinc-500">
                                <span className={`size-2 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-zinc-400'}`} />
                                {priorityCfg?.label}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Due date badge */}
            {task.due_date && (
                <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                    isOverdue
                        ? 'bg-red-900/60 text-red-300'
                        : 'bg-zinc-800 text-zinc-300 dark:bg-zinc-700 dark:text-zinc-200'
                }`}>
                    {format(new Date(task.due_date), 'MMM d')}
                </span>
            )}
        </div>
    )
}

// ── section ───────────────────────────────────────────────────────────────────

function Section({ title, tasks, cols, members, projects, defaultOpen = true, accent, onRowClick, onSave, userId, mobile }) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="border-t border-zinc-100 dark:border-white/[0.05] first:border-t-0">
            <button onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 w-full text-left px-4 sm:px-6 py-4 hover:bg-zinc-50/60 dark:hover:bg-white/[0.02] transition-colors">
                {open ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
                <span className={`text-xs font-bold uppercase tracking-widest ${accent || 'text-zinc-500 dark:text-zinc-400'}`}>{title}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-600 ml-1 tabular-nums">{tasks.length}</span>
            </button>
            {open && tasks.map((t) => (
                mobile
                    ? <MobileTaskCard key={t.id} task={t} onRowClick={onRowClick} onSave={onSave} />
                    : <TaskRow key={t.id} task={t} cols={cols} members={members} projects={projects}
                        onRowClick={onRowClick} onSave={onSave} userId={userId} />
            ))}
        </div>
    )
}

// ── page ──────────────────────────────────────────────────────────────────────

const VIS_KEY = 'mytasks_col_vis'

export default function MyTasks() {
    const { user } = useAuth()
    const dispatch = useDispatch()
    const { currentWorkspace } = useSelector((s) => s.workspace)
    const members = useSelector((s) => s.workspace.currentWorkspace?.members || [])
    const projects = currentWorkspace?.projects || []

    const [selectedTaskId, setSelectedTaskId] = useState(null)
    const [selectedProjectId, setSelectedProjectId] = useState(null)
    const [showDone] = useState(true)

    const [colVis, setColVis] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(VIS_KEY)) || {}
            // Apply defaults for any key not yet saved
            const defaults = Object.fromEntries(ALL_COLS.filter((c) => !c.fixed).map((c) => [c.key, c.defaultOn]))
            return { ...defaults, ...saved }
        } catch { return {} }
    })

    const handleColVis = (key, val) => {
        setColVis((prev) => {
            const next = { ...prev, [key]: val }
            localStorage.setItem(VIS_KEY, JSON.stringify(next))
            return next
        })
    }

    const cols = visibleCols(colVis)

    const allMyTasks = useMemo(() => {
        if (!currentWorkspace || !user) return []
        return projects.flatMap((p) =>
            (p.tasks || [])
                .filter((t) => !t.archived_at && (t.assignee_id === user.id || t.created_by === user.id))
                .map((t) => ({ ...t, projectId: p.id, projectName: p.name }))
        )
    }, [currentWorkspace, user])

    const activeTasks = useMemo(() => allMyTasks.filter((t) => t.status !== 'DONE'), [allMyTasks])
    const doneTasks   = useMemo(() => allMyTasks.filter((t) => t.status === 'DONE'), [allMyTasks])

    const grouped = useMemo(() => ({
        today:    activeTasks.filter((t) => getGroup(t) === 'today'),
        tomorrow: activeTasks.filter((t) => getGroup(t) === 'tomorrow'),
        later:    activeTasks.filter((t) => getGroup(t) === 'later'),
    }), [activeTasks])

    const handleSave = useCallback(async (task, fields) => {
        try {
            await dispatch(updateTask({ taskId: task.id, projectId: task.projectId, fields })).unwrap()
        } catch (err) {
            toast.error(err || 'Failed to save')
        }
    }, [dispatch])

    const openPanel = (t) => { setSelectedTaskId(t.id); setSelectedProjectId(t.projectId) }

    const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'M'

    // Detect mobile viewport
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 640)
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [])

    const sectionProps = { members, projects, defaultOpen: true, onRowClick: openPanel, onSave: handleSave, userId: user?.id, mobile: isMobile }

    return (
        <div className="max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-5 sm:mb-8">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-base sm:text-lg font-bold text-zinc-600 dark:text-zinc-300">
                        {displayName[0].toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">My Tasks</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{activeTasks.length} open · {doneTasks.length} completed</p>
                    </div>
                </div>
                {/* Fields picker only shown on desktop */}
                <div className="hidden sm:block">
                    <FieldPicker colVis={colVis} onChange={handleColVis} />
                </div>
            </div>

            {/* Table / List */}
            <div className="glass-panel rounded-xl overflow-hidden">
                {/* Desktop: column headers */}
                {!isMobile && (
                    <div className="grid border-b border-zinc-200 dark:border-white/[0.07] bg-zinc-50/80 dark:bg-white/[0.02]"
                        style={{ gridTemplateColumns: gridTemplate(cols) }}>
                        {cols.map((col) => (
                            <div key={col.key} className="px-3 py-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">{col.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sections */}
                <Section title="Do Today"    tasks={grouped.today}    cols={cols} {...sectionProps} />
                <Section title="Do Tomorrow" tasks={grouped.tomorrow} cols={cols} {...sectionProps} />
                <Section title="Later"       tasks={grouped.later}    cols={cols} {...sectionProps} />

                {/* Empty state */}
                {activeTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <CheckCircle2 className="size-10 text-zinc-200 dark:text-zinc-700" />
                        <p className="text-sm text-zinc-400">You're all caught up</p>
                    </div>
                )}

                {/* Completed */}
                {doneTasks.length > 0 && (
                    <Section title="Completed" tasks={doneTasks} cols={cols} {...sectionProps} defaultOpen={showDone} />
                )}
            </div>

            {selectedTaskId && selectedProjectId && (
                <TaskPanel taskId={selectedTaskId} projectId={selectedProjectId}
                    onClose={() => { setSelectedTaskId(null); setSelectedProjectId(null) }} />
            )}
        </div>
    )
}
