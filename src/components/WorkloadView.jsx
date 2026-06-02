import { useState, useEffect, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { useSelector } from "react-redux"
import {
    Loader2Icon, UserIcon, ChevronDownIcon, ChevronRightIcon,
    AlertCircleIcon, CheckCircle2Icon, ClockIcon, CircleDotIcon, CircleIcon
} from "lucide-react"
import { format, isToday, isPast, isWithinInterval, endOfWeek, startOfDay } from "date-fns"
import UserAvatar from "./UserAvatar"

const STATUS_ICONS = {
    TODO: { icon: CircleIcon, cls: "text-zinc-400" },
    IN_PROGRESS: { icon: CircleDotIcon, cls: "text-blue-500" },
    DONE: { icon: CheckCircle2Icon, cls: "text-emerald-500" },
}

const PRIORITY_BADGE = {
    URGENT: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    HIGH: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    MEDIUM: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    LOW: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
}

const CAPACITY_THRESHOLDS = { healthy: 5, warning: 8 }

function capacityColor(count) {
    if (count <= CAPACITY_THRESHOLDS.healthy) return "bg-emerald-500"
    if (count <= CAPACITY_THRESHOLDS.warning) return "bg-amber-500"
    return "bg-red-500"
}

function capacityLabel(count) {
    if (count <= CAPACITY_THRESHOLDS.healthy) return { text: "Healthy", cls: "text-emerald-600 dark:text-emerald-400" }
    if (count <= CAPACITY_THRESHOLDS.warning) return { text: "Busy", cls: "text-amber-600 dark:text-amber-400" }
    return { text: "Overloaded", cls: "text-red-600 dark:text-red-400" }
}

function AssigneeRow({ user, tasks, onTaskClick }) {
    const [expanded, setExpanded] = useState(false)
    const today = startOfDay(new Date())
    const weekEnd = endOfWeek(today)
    const person = user?.name || user?.email || "Unknown"

    const activeTasks = tasks.filter(t => t.status !== "DONE")
    const overdueTasks = tasks.filter(t => t.status !== "DONE" && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)))
    const dueTodayTasks = tasks.filter(t => t.status !== "DONE" && t.due_date && isToday(new Date(t.due_date)))
    const dueThisWeekTasks = tasks.filter(t => t.status !== "DONE" && t.due_date &&
        !isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) &&
        isWithinInterval(new Date(t.due_date), { start: today, end: weekEnd }))
    const completedTasks = tasks.filter(t => t.status === "DONE")

    const { text: capLabel, cls: capCls } = capacityLabel(activeTasks.length)
    const barWidth = Math.min(100, (activeTasks.length / (CAPACITY_THRESHOLDS.warning + 2)) * 100)

    return (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {/* Row header */}
            <div
                className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-zinc-900/60 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Avatar */}
                <UserAvatar user={user} size={36} />

                {/* Name + capacity */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{person}</span>
                        <span className={`text-xs font-medium ${capCls}`}>{capLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden max-w-40">
                            <div className={`h-full rounded-full transition-all ${capacityColor(activeTasks.length)}`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className="text-xs text-zinc-400">{activeTasks.length} active</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4">
                    {overdueTasks.length > 0 && (
                        <div className="flex items-center gap-1 text-red-500">
                            <AlertCircleIcon className="size-3.5" />
                            <span className="text-xs font-medium">{overdueTasks.length} overdue</span>
                        </div>
                    )}
                    {dueTodayTasks.length > 0 && (
                        <div className="flex items-center gap-1 text-amber-500">
                            <ClockIcon className="size-3.5" />
                            <span className="text-xs font-medium">{dueTodayTasks.length} today</span>
                        </div>
                    )}
                    {dueThisWeekTasks.length > 0 && (
                        <div className="flex items-center gap-1 text-blue-500">
                            <span className="text-xs">{dueThisWeekTasks.length} this week</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2Icon className="size-3.5" />
                        <span className="text-xs">{completedTasks.length} done</span>
                    </div>
                </div>

                {/* Expand toggle */}
                <div className="flex-shrink-0 text-zinc-400">
                    {expanded ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                </div>
            </div>

            {/* Expanded task list */}
            {expanded && (
                <div className="border-t border-zinc-100 dark:border-zinc-800">
                    {/* Mobile stats */}
                    <div className="sm:hidden flex gap-3 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/30 flex-wrap text-xs">
                        {overdueTasks.length > 0 && <span className="text-red-500">{overdueTasks.length} overdue</span>}
                        {dueTodayTasks.length > 0 && <span className="text-amber-500">{dueTodayTasks.length} due today</span>}
                        {dueThisWeekTasks.length > 0 && <span className="text-blue-500">{dueThisWeekTasks.length} this week</span>}
                        <span className="text-emerald-500">{completedTasks.length} done</span>
                    </div>

                    {tasks.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-zinc-400">No tasks assigned</div>
                    ) : (
                        <div className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                            {tasks.map(task => {
                                const { icon: Icon, cls } = STATUS_ICONS[task.status] || STATUS_ICONS.TODO
                                const isOverdue = task.status !== "DONE" && task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date))
                                const isDueToday = task.due_date && isToday(new Date(task.due_date))
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => onTaskClick && onTaskClick(task)}
                                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition"
                                    >
                                        <Icon className={`size-3.5 flex-shrink-0 ${cls}`} />
                                        <span className={`text-sm flex-1 truncate ${task.status === "DONE" ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300"}`}>
                                            {task.title}
                                        </span>
                                        {task.project?.name && (
                                            <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate max-w-24 hidden md:block">{task.project.name}</span>
                                        )}
                                        {task.priority && (
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.MEDIUM}`}>
                                                {task.priority}
                                            </span>
                                        )}
                                        {task.due_date && (
                                            <span className={`text-xs flex-shrink-0 ${isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-amber-500 font-medium" : "text-zinc-400 dark:text-zinc-500"}`}>
                                                {isOverdue ? "Overdue · " : isDueToday ? "Today · " : ""}
                                                {format(new Date(task.due_date), "MMM d")}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function WorkloadView({ onTaskClick }) {
    const currentWorkspace = useSelector(state => state.workspace?.currentWorkspace)
    const [tasks, setTasks] = useState([])
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterProject, setFilterProject] = useState("")
    const [filterStatus, setFilterStatus] = useState("active") // "active" | "all"
    const [selectedTaskPanel, setSelectedTaskPanel] = useState(null)

    useEffect(() => {
        if (currentWorkspace) fetchWorkloadData()
    }, [currentWorkspace])

    const fetchWorkloadData = async () => {
        setLoading(true)
        const [{ data: memberData }, { data: taskData }] = await Promise.all([
            supabase
                .from("workspace_members")
                .select("*, user:profiles(id, name, email, avatar_url)")
                .eq("workspace_id", currentWorkspace.id),
            supabase
                .from("xpm_tasks")
                .select("id, title, status, priority, due_date, assignee_id, project_id, project:projects(id, name), assignee:profiles!xpm_tasks_assignee_id_fkey(id, name, email, avatar_url)")
                .eq("workspace_id", currentWorkspace.id)
                .is("archived_at", null)
                .order("due_date", { ascending: true, nullsFirst: false }),
        ])
        setMembers(memberData || [])
        setTasks(taskData || [])
        setLoading(false)
    }

    const projects = useMemo(() => {
        const seen = new Set()
        return tasks.map(t => t.project).filter(p => { if (!p || seen.has(p.id)) return false; seen.add(p.id); return true })
    }, [tasks])

    const filteredTasks = useMemo(() => tasks.filter(t => {
        const matchProject = !filterProject || t.project_id === filterProject
        const matchStatus = filterStatus === "all" || t.status !== "DONE"
        return matchProject && matchStatus
    }), [tasks, filterProject, filterStatus])

    // Group by assignee user_id (not name — avoids mismatches)
    const assigneeGroups = useMemo(() => {
        // Build a user map from members
        const userMap = {}
        members.forEach(m => { if (m.user) userMap[m.user_id] = m.user })

        const groups = {}
        filteredTasks.forEach(t => {
            if (!t.assignee_id) return
            if (!groups[t.assignee_id]) {
                // Prefer member profile, fall back to task assignee profile
                const user = userMap[t.assignee_id] || t.assignee || { id: t.assignee_id, name: "Unknown" }
                groups[t.assignee_id] = { user, tasks: [] }
            }
            groups[t.assignee_id].tasks.push(t)
        })

        return Object.values(groups).sort((a, b) => {
            const aActive = a.tasks.filter(t => t.status !== "DONE").length
            const bActive = b.tasks.filter(t => t.status !== "DONE").length
            return bActive - aActive
        })
    }, [filteredTasks, members])

    // Summary stats
    const totalActive = useMemo(() => filteredTasks.filter(t => t.status !== "DONE").length, [filteredTasks])
    const totalOverdue = useMemo(() => filteredTasks.filter(t => t.status !== "DONE" && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length, [filteredTasks])
    const totalUnassigned = useMemo(() => filteredTasks.filter(t => !t.assignee_id && t.status !== "DONE").length, [filteredTasks])

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>

    return (
        <div className="space-y-5 max-w-5xl">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Active Tasks", value: totalActive, cls: "text-zinc-900 dark:text-white" },
                    { label: "Overdue", value: totalOverdue, cls: totalOverdue > 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white" },
                    { label: "Unassigned", value: totalUnassigned, cls: totalUnassigned > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-white" },
                ].map(item => (
                    <div key={item.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                        <p className={`text-2xl font-bold ${item.cls}`}>{item.value}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1">
                    {["active", "all"].map(s => (
                        <button key={s} onClick={() => setFilterStatus(s)}
                            className={`px-3 py-1.5 text-xs rounded border transition capitalize ${filterStatus === s ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}>
                            {s === "active" ? "Active only" : "All tasks"}
                        </button>
                    ))}
                </div>
                {projects.length > 0 && (
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                        className="text-sm px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                )}
                <button onClick={fetchWorkloadData} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition">
                    Refresh
                </button>
            </div>

            {/* Capacity legend */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Capacity:</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" /> Healthy (≤{CAPACITY_THRESHOLDS.healthy})</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500 inline-block" /> Busy (≤{CAPACITY_THRESHOLDS.warning})</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 inline-block" /> Overloaded (&gt;{CAPACITY_THRESHOLDS.warning})</span>
            </div>

            {/* Assignee rows */}
            {assigneeGroups.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                    <UserIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No tasks or members found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {assigneeGroups.map(({ user, tasks: personTasks }) => (
                        <AssigneeRow
                            key={user.id || user.email}
                            user={user}
                            tasks={personTasks}
                            onTaskClick={onTaskClick}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
