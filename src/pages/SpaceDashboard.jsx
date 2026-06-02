import { useMemo, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { format, isAfter, isBefore, addDays, parseISO } from "date-fns"
import {
    ArrowLeft, FolderOpen, CheckCircle2, Circle,
    AlertTriangle, Layers, ChevronDown, ChevronRight,
    CalendarIcon, ArrowUpDown, TrendingUp, Plus,
} from "lucide-react"
import CreateProjectDialog from "../components/CreateProjectDialog"

const statusConfig = {
    ACTIVE:    { label: "On Track",  badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",  bar: "bg-emerald-500" },
    PLANNING:  { label: "Planning",  badge: "bg-blue-100 text-blue-700 border border-blue-200",            bar: "bg-blue-500" },
    ON_HOLD:   { label: "On Hold",   badge: "bg-amber-100 text-amber-700 border border-amber-200",         bar: "bg-amber-500" },
    COMPLETED: { label: "Completed", badge: "bg-zinc-100 text-zinc-600 border border-zinc-200",            bar: "bg-zinc-400" },
    CANCELLED: { label: "Cancelled", badge: "bg-red-100 text-red-700 border border-red-200",               bar: "bg-red-400" },
}

const priorityBadge = {
    HIGH:   "bg-emerald-100 text-emerald-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    LOW:    "bg-zinc-100 text-zinc-500",
}

const SORT_OPTIONS = [
    { value: "priority", label: "Priority" },
    { value: "progress", label: "Progress" },
    { value: "status",   label: "Status" },
    { value: "name",     label: "Name" },
]

const statCards = (spaceProjects, totalTasks, doneTasks, spacePct) => [
    { label: "Projects",       value: spaceProjects.length, Icon: FolderOpen },
    { label: "Total Tasks",    value: totalTasks,           Icon: CheckCircle2 },
    { label: "Completed",      value: doneTasks,            Icon: CheckCircle2 },
    { label: "Space Progress", value: `${spacePct}%`,       Icon: TrendingUp },
]

export default function SpaceDashboard() {
    const { spaceId } = useParams()
    const navigate = useNavigate()
    const spaces = useSelector((s) => s.workspace.spaces || [])
    const allProjects = useSelector((s) => s.workspace.currentWorkspace?.projects || [])

    const space = spaces.find((s) => s.id === spaceId)
    const spaceProjects = allProjects.filter((p) => p.space_id === spaceId)

    const [projectSort, setProjectSort] = useState("priority")
    const [expandedProjects, setExpandedProjects] = useState({})
    const [upcomingDays, setUpcomingDays] = useState(7)
    const [createProjectOpen, setCreateProjectOpen] = useState(false)

    const toggleExpand = (id) => setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }))

    const enrichedProjects = useMemo(() => spaceProjects.map((p) => {
        const tasks = p.tasks || []
        const done = tasks.filter((t) => t.status === "DONE").length
        const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
        return { ...p, progress, taskCount: tasks.length, doneCount: done }
    }), [spaceProjects])

    const sortedProjects = useMemo(() => [...enrichedProjects].sort((a, b) => {
        if (projectSort === "priority") return (b.tasks || []).filter(t => t.status !== "DONE").length - (a.tasks || []).filter(t => t.status !== "DONE").length
        if (projectSort === "progress") return a.progress - b.progress
        if (projectSort === "status") return (a.status || "").localeCompare(b.status || "")
        return a.name.localeCompare(b.name)
    }), [enrichedProjects, projectSort])

    const upcomingTasks = useMemo(() => {
        const now = new Date()
        const cutoff = addDays(now, upcomingDays)
        const overdue = [], window = []
        for (const p of spaceProjects) {
            for (const t of p.tasks || []) {
                if (!t.due_date || t.status === "DONE" || t.archived) continue
                const due = parseISO(t.due_date)
                if (isBefore(due, now)) overdue.push({ ...t, projectName: p.name, projectId: p.id, isOverdue: true })
                else if (!isAfter(due, cutoff)) window.push({ ...t, projectName: p.name, projectId: p.id, isOverdue: false })
            }
        }
        return [
            ...overdue.sort((a, b) => parseISO(a.due_date) - parseISO(b.due_date)),
            ...window.sort((a, b) => parseISO(a.due_date) - parseISO(b.due_date)),
        ]
    }, [spaceProjects, upcomingDays])

    const totalTasks = enrichedProjects.reduce((a, p) => a + p.taskCount, 0)
    const doneTasks  = enrichedProjects.reduce((a, p) => a + p.doneCount, 0)
    const spacePct   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    if (!space) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Layers className="size-10 text-zinc-300" />
            <p className="text-zinc-500 text-sm">Space not found</p>
            <button onClick={() => navigate("/spaces")} className="text-sm text-blue-600 hover:underline">Back to Spaces</button>
        </div>
    )

    return (
        <>
        <div className="max-w-6xl mx-auto space-y-8">

            {/* Breadcrumb + title */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <button
                        onClick={() => navigate("/spaces")}
                        className="hover:text-zinc-900 transition flex items-center gap-1"
                    >
                        <ArrowLeft className="size-3.5" />
                    </button>
                    <span>/</span>
                    <span>Spaces</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">{space.name}</h1>
                    </div>
                    <button
                        onClick={() => setCreateProjectOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
                    >
                        <Plus className="size-4" />
                        New Project
                    </button>
                </div>
                {space.description && <p className="text-sm text-zinc-500 dark:text-zinc-400 ml-7">{space.description}</p>}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards(spaceProjects, totalTasks, doneTasks, spacePct).map(({ label, value, Icon }) => (
                    <div key={label} className="glass-panel glass-card-hover rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.07]">
                            <Icon className="size-9" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">{label}</p>
                        <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white leading-none">{value}</p>
                    </div>
                ))}
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Projects — 2/3 width */}
                <div className="lg:col-span-2">
                    <div className="glass-panel rounded-xl p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Projects</h2>
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="size-3.5 text-zinc-400" />
                                <select
                                    value={projectSort}
                                    onChange={(e) => setProjectSort(e.target.value)}
                                    className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer bg-white/50 dark:bg-zinc-800/50"
                                >
                                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {sortedProjects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <FolderOpen className="size-8 text-zinc-300" />
                                <p className="text-sm text-zinc-400">No projects in this space</p>
                                <button onClick={() => setCreateProjectOpen(true)} className="text-xs text-blue-600 hover:underline">Create a project</button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {sortedProjects.map((project) => {
                                    const cfg = statusConfig[project.status] || statusConfig.PLANNING
                                    const isExpanded = expandedProjects[project.id] ?? true
                                    const openTasks = (project.tasks || []).filter(t => t.status !== "DONE" && !t.archived)

                                    return (
                                        <div
                                            key={project.id}
                                            className="border border-zinc-200/60 dark:border-zinc-700/60 rounded-lg p-5 bg-white/40 dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors"
                                        >
                                            {/* Project header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleExpand(project.id)}
                                                        className="text-zinc-400 hover:text-zinc-600 transition"
                                                    >
                                                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                    </button>
                                                    <Link
                                                        to={`/projectsDetail?id=${project.id}&tab=tasks`}
                                                        className="text-base font-semibold text-zinc-800 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 transition"
                                                    >
                                                        {project.name}
                                                    </Link>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${cfg.badge}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>

                                            {/* Progress */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-xs text-zinc-500">
                                                    <span>Progress</span>
                                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                                        {project.progress}% <span className="font-normal text-zinc-400 ml-1">{project.doneCount}/{project.taskCount} tasks</span>
                                                    </span>
                                                </div>
                                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                                                    <div className={`h-2 rounded-full transition-all ${cfg.bar}`} style={{ width: `${project.progress}%` }} />
                                                </div>
                                            </div>

                                            {/* Open tasks */}
                                            {isExpanded && (
                                                <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                                                    {openTasks.length === 0 ? (
                                                        <p className="text-sm text-zinc-400 italic text-center">No open tasks</p>
                                                    ) : (
                                                        <div className="flex flex-col gap-1.5">
                                                            {openTasks.slice(0, 6).map((t) => (
                                                                <Link
                                                                    key={t.id}
                                                                    to={`/projectsDetail?id=${project.id}&tab=tasks`}
                                                                    className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition py-0.5"
                                                                >
                                                                    <Circle className="size-3 flex-shrink-0 text-zinc-300" />
                                                                    <span className="truncate flex-1">{t.title}</span>
                                                                    {t.priority && (
                                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${priorityBadge[t.priority] || ""}`}>
                                                                            {t.priority}
                                                                        </span>
                                                                    )}
                                                                </Link>
                                                            ))}
                                                            {openTasks.length > 6 && (
                                                                <Link to={`/projectsDetail?id=${project.id}&tab=tasks`} className="text-xs text-blue-500 hover:underline mt-1">
                                                                    +{openTasks.length - 6} more
                                                                </Link>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Upcoming tasks — 1/3 width */}
                <div className="lg:col-span-1">
                    <div className="glass-panel rounded-xl p-6 flex flex-col gap-4 min-h-[400px]">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Upcoming Tasks</h2>
                            <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 bg-white/50 dark:bg-zinc-800/50">
                                <CalendarIcon className="size-3 text-zinc-400" />
                                <select
                                    value={upcomingDays}
                                    onChange={(e) => setUpcomingDays(Number(e.target.value))}
                                    className="text-xs bg-transparent outline-none cursor-pointer text-zinc-600 dark:text-zinc-400"
                                >
                                    <option value={3}>Next 3 days</option>
                                    <option value={7}>Next 7 days</option>
                                    <option value={14}>Next 14 days</option>
                                    <option value={30}>Next 30 days</option>
                                </select>
                            </div>
                        </div>

                        {upcomingTasks.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-60 py-12">
                                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                    <CheckCircle2 className="size-7 text-zinc-400" />
                                </div>
                                <p className="text-sm text-zinc-400 text-center">No upcoming tasks in this window</p>
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                                {upcomingTasks.map((t) => (
                                    <Link
                                        key={t.id}
                                        to={`/projectsDetail?id=${t.projectId}&tab=tasks`}
                                        className="flex items-start gap-2.5 py-3 first:pt-0 group"
                                    >
                                        <Circle className="size-3.5 text-zinc-300 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-900 transition">{t.title}</p>
                                            <p className="text-[11px] text-zinc-400 truncate">{t.projectName}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            {t.priority && (
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityBadge[t.priority] || ""}`}>
                                                    {t.priority}
                                                </span>
                                            )}
                                            <span className={`text-[10px] flex items-center gap-0.5 ${t.isOverdue ? "text-red-500 font-medium" : "text-zinc-400"}`}>
                                                {t.isOverdue && <AlertTriangle className="size-3" />}
                                                {format(parseISO(t.due_date), "dd MMM")}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <CreateProjectDialog
            isDialogOpen={createProjectOpen}
            setIsDialogOpen={setCreateProjectOpen}
            defaultSpaceId={spaceId}
        />
        </>
    )
}
