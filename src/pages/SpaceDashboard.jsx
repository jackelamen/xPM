import { useMemo, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useSelector } from "react-redux"
import { format, isAfter, isBefore, addDays, parseISO } from "date-fns"
import { ArrowLeft, Layers, ChevronDown, ChevronRight, Plus } from "lucide-react"
import CreateProjectDialog from "../components/CreateProjectDialog"
import { ProjectStatus, PriorityTag } from "../components/Badges"
import Tooltip from "../components/Tooltip"

const SORT_OPTIONS = [
    { value: "priority", label: "Most open tasks" },
    { value: "progress", label: "Least progress" },
    { value: "status",   label: "Status" },
    { value: "name",     label: "Name" },
]

function Stat({ value, label, accent }) {
    return (
        <div>
            <p className={`font-display text-[44px] font-bold leading-none tabular-nums ${accent ? "text-signal-500" : "text-white"}`}>{value}</p>
            <p className="mt-1.5 text-[14px] text-ink-300">{label}</p>
        </div>
    )
}

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
                if (isBefore(due, now)) overdue.push({ ...t, projectName: p.name, projectId: p.id, projectColor: p.color, isOverdue: true })
                else if (!isAfter(due, cutoff)) window.push({ ...t, projectName: p.name, projectId: p.id, projectColor: p.color, isOverdue: false })
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
            <Layers className="size-10 text-gray-300" />
            <p className="text-gray-500 text-sm">Space not found</p>
            <button onClick={() => navigate("/spaces")} className="text-sm font-medium text-ink-700 dark:text-ink-300 hover:underline">Back to Spaces</button>
        </div>
    )

    return (
        <>
        <div className="max-w-[1240px] mx-auto space-y-8">

            {/* Hook: the space, its colour, and where it stands */}
            <section className="relative rounded-2xl bg-ink-900 text-white overflow-hidden">
                <span className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: space.color }} />
                <div className="p-7 sm:p-9 sm:pl-11">
                    <div className="flex items-start justify-between gap-4">
                        <button onClick={() => navigate("/spaces")} className="inline-flex items-center gap-1.5 text-[14px] text-ink-300 hover:text-white">
                            <ArrowLeft className="size-4" /> Spaces
                        </button>
                        <button
                            onClick={() => setCreateProjectOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/[0.16] text-[14px] font-semibold transition-colors"
                        >
                            <Plus className="size-4" /> New project
                        </button>
                    </div>
                    <h1 className="mt-5 text-[40px] sm:text-[48px] font-bold tracking-tight leading-none">{space.name}</h1>
                    {space.description && <p className="mt-3 text-[16px] text-ink-200 max-w-2xl">{space.description}</p>}
                    <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
                        <Stat value={spaceProjects.length} label={spaceProjects.length === 1 ? "project" : "projects"} />
                        <Stat value={totalTasks} label="tasks" />
                        <Stat value={doneTasks} label="done" />
                        <Stat value={`${spacePct}%`} label="complete" accent />
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-x-10 gap-y-8">

                {/* Projects */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                        <h2 className="text-[22px] font-semibold text-gray-900 dark:text-white">Projects</h2>
                        <label className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-zinc-400">
                            Sort
                            <select
                                value={projectSort}
                                onChange={(e) => setProjectSort(e.target.value)}
                                className="text-[13px] border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-1 text-gray-700 dark:text-zinc-300 outline-none cursor-pointer bg-white dark:bg-zinc-900"
                            >
                                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </label>
                    </div>

                    {sortedProjects.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 py-14 text-center">
                            <p className="font-display text-[20px] font-semibold text-gray-900 dark:text-white">No projects in this space</p>
                            <button onClick={() => setCreateProjectOpen(true)} className="mt-4 px-5 py-2.5 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[14px] font-semibold transition-colors">Create a project</button>
                        </div>
                    ) : (
                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                            {sortedProjects.map((project) => {
                                const isExpanded = expandedProjects[project.id] ?? true
                                const openTasks = (project.tasks || []).filter(t => t.status !== "DONE" && !t.archived)
                                const color = project.color || space.color

                                return (
                                    <div key={project.id} className="p-5">
                                        <div className="flex items-center gap-3">
                                            <Tooltip label={isExpanded ? "Hide open tasks" : "Show open tasks"}>
                                                <button onClick={() => toggleExpand(project.id)} aria-label={isExpanded ? "Hide open tasks" : "Show open tasks"} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition">
                                                    {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                </button>
                                            </Tooltip>
                                            <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                            <Link
                                                to={`/projectsDetail?id=${project.id}&tab=tasks`}
                                                className="font-display text-[19px] font-semibold text-gray-900 dark:text-white hover:text-ink-600 dark:hover:text-ink-300 transition-colors truncate"
                                            >
                                                {project.name}
                                            </Link>
                                            <ProjectStatus status={project.status} className="ml-auto flex-shrink-0" />
                                        </div>

                                        <div className="mt-3 flex items-center gap-3 pl-[26px]">
                                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, backgroundColor: color }} />
                                            </div>
                                            <span className="text-[13px] text-gray-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                                                <span className="font-semibold text-gray-800 dark:text-zinc-200">{project.progress}%</span> · {project.doneCount}/{project.taskCount}
                                            </span>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-3 pl-[26px]">
                                                {openTasks.length === 0 ? (
                                                    <p className="text-[14px] text-gray-400">Nothing open.</p>
                                                ) : (
                                                    <ul>
                                                        {openTasks.slice(0, 6).map((t) => (
                                                            <li key={t.id}>
                                                                <Link
                                                                    to={`/projectsDetail?id=${project.id}&tab=tasks`}
                                                                    className="flex items-center gap-3 py-1.5 text-[14px] text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white transition"
                                                                >
                                                                    <span className="size-3.5 rounded-full border-[1.5px] border-gray-300 dark:border-zinc-600 flex-shrink-0" />
                                                                    <span className="truncate flex-1">{t.title}</span>
                                                                    <PriorityTag priority={t.priority} />
                                                                </Link>
                                                            </li>
                                                        ))}
                                                        {openTasks.length > 6 && (
                                                            <li>
                                                                <Link to={`/projectsDetail?id=${project.id}&tab=tasks`} className="inline-block pt-1 text-[13px] text-gray-500 hover:text-gray-900 dark:hover:text-white">
                                                                    {openTasks.length - 6} more
                                                                </Link>
                                                            </li>
                                                        )}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                {/* Upcoming: quiet, no surface */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3">
                        <h2 className="text-[22px] font-semibold text-gray-900 dark:text-white">Coming up</h2>
                        <select
                            value={upcomingDays}
                            onChange={(e) => setUpcomingDays(Number(e.target.value))}
                            aria-label="Time window"
                            className="text-[13px] border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-1 text-gray-700 dark:text-zinc-300 outline-none cursor-pointer bg-white dark:bg-zinc-900"
                        >
                            <option value={3}>Next 3 days</option>
                            <option value={7}>Next 7 days</option>
                            <option value={14}>Next 14 days</option>
                            <option value={30}>Next 30 days</option>
                        </select>
                    </div>

                    {upcomingTasks.length === 0 ? (
                        <p className="py-3 text-[14px] text-gray-500 dark:text-zinc-400">Nothing due in the next {upcomingDays} days.</p>
                    ) : (
                        <ul>
                            {upcomingTasks.map((t) => (
                                <li key={t.id}>
                                    <Link
                                        to={`/projectsDetail?id=${t.projectId}&tab=tasks`}
                                        className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-zinc-800 group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15px] text-gray-900 dark:text-zinc-100 truncate group-hover:text-ink-600 dark:group-hover:text-ink-300 transition-colors">{t.title}</p>
                                            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-zinc-500 min-w-0">
                                                <span className="size-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.projectColor || "#6489b3" }} />
                                                <span className="truncate">{t.projectName}</span>
                                            </p>
                                        </div>
                                        <span className={`text-[12px] whitespace-nowrap ${t.isOverdue ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-500 dark:text-zinc-400"}`}>
                                            {t.isOverdue ? "Overdue · " : ""}{format(parseISO(t.due_date), "EEE MMM d")}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
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
