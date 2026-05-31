import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { SlidersHorizontalIcon } from 'lucide-react'

const statusConfig = {
    ACTIVE: {
        label: 'On Track',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
        bar: 'bg-emerald-500',
    },
    PLANNING: {
        label: 'Planning',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
        bar: 'bg-blue-500',
    },
    ON_HOLD: {
        label: 'On Hold',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
        bar: 'bg-amber-500',
    },
    COMPLETED: {
        label: 'Completed',
        badge: 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
        bar: 'bg-gray-400 dark:bg-zinc-500',
    },
    CANCELLED: {
        label: 'Cancelled',
        badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
        bar: 'bg-red-500',
    },
}

export default function ProjectStatusCard() {
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const projects = useMemo(() => {
        if (!currentWorkspace) return []
        return (currentWorkspace.projects || [])
            .filter((p) => p.status !== 'CANCELLED')
            .slice(0, 5)
            .map((p) => {
                const tasks = p.tasks || []
                const done = tasks.filter((t) => t.status === 'DONE').length
                const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
                return { ...p, progress }
            })
    }, [currentWorkspace])

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-[#e5e2e1] dark:border-white/[0.07] rounded-[24px] p-7 flex flex-col flex-1 shadow-[0_4px_20px_rgba(0,0,0,0.04)] min-h-[400px]">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[22px] font-bold text-[#000101] dark:text-white">Project Status</h2>
                <button className="w-9 h-9 rounded-full border border-[#c5c6ca] dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05] transition-colors">
                    <SlidersHorizontalIcon size={13} />
                </button>
            </div>

            {projects.length === 0 ? (
                <p className="text-[13px] text-gray-400 dark:text-zinc-600 text-center py-6">No projects yet</p>
            ) : (
                <div className="flex flex-col gap-6">
                    {projects.map((project) => {
                        const config = statusConfig[project.status] || statusConfig.PLANNING
                        return (
                            <Link
                                key={project.id}
                                to={`/projectsDetail?id=${project.id}&tab=tasks`}
                                className="group"
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[16px] font-bold text-[#000101] dark:text-zinc-200 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        {project.name}
                                    </span>
                                    <div className="flex items-center gap-2.5 flex-shrink-0 ml-3">
                                        <span className="text-[16px] font-bold text-gray-700 dark:text-zinc-400 tabular-nums">
                                            {project.progress}%
                                        </span>
                                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${config.badge}`}>
                                            {config.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full bg-[#ebe7e7] dark:bg-white/[0.06] rounded-full h-3">
                                    <div
                                        className={`${config.bar} h-3 rounded-full transition-all`}
                                        style={{ width: `${project.progress}%` }}
                                    />
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
