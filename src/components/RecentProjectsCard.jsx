import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { subDays, parseISO, formatDistanceToNow } from 'date-fns'
import { Activity, FolderOpen } from 'lucide-react'

const statusConfig = {
    ACTIVE:    { label: 'On Track',  badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400', dot: 'bg-emerald-500' },
    PLANNING:  { label: 'Planning',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',             dot: 'bg-blue-500' },
    ON_HOLD:   { label: 'On Hold',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',         dot: 'bg-amber-500' },
    COMPLETED: { label: 'Completed', badge: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',                dot: 'bg-zinc-400' },
    CANCELLED: { label: 'Cancelled', badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',                 dot: 'bg-red-500' },
}

export default function RecentProjectsCard() {
    const { currentWorkspace } = useSelector((s) => s.workspace)

    const recentProjects = useMemo(() => {
        if (!currentWorkspace) return []
        const cutoff = subDays(new Date(), 7)

        return (currentWorkspace.projects || [])
            .filter((p) => !p.archived_at)
            .map((p) => {
                const tasks = p.tasks || []
                const done = tasks.filter((t) => t.status === 'DONE').length
                const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0

                // Most recent activity: latest task updated_at, or project updated_at
                const latestTaskActivity = tasks.reduce((latest, t) => {
                    if (!t.updated_at) return latest
                    const d = parseISO(t.updated_at)
                    return d > latest ? d : latest
                }, new Date(0))

                const projectActivity = p.updated_at ? parseISO(p.updated_at) : new Date(0)
                const lastActive = latestTaskActivity > projectActivity ? latestTaskActivity : projectActivity

                return { ...p, progress, taskCount: tasks.length, doneCount: done, lastActive }
            })
            .filter((p) => p.lastActive > cutoff)
            .sort((a, b) => b.lastActive - a.lastActive)
            .slice(0, 6)
    }, [currentWorkspace])

    return (
        <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <Activity className="size-4 text-zinc-400" />
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Recent Projects</h2>
                </div>
                <Link
                    to="/spaces"
                    className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
                >
                    All spaces →
                </Link>
            </div>

            {recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <FolderOpen className="size-7 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">No project activity in the last 7 days</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {recentProjects.map((p) => {
                        const cfg = statusConfig[p.status] || statusConfig.PLANNING
                        return (
                            <Link
                                key={p.id}
                                to={`/projectsDetail?id=${p.id}&tab=tasks`}
                                className="flex items-center gap-3 group"
                            >
                                {/* Status dot */}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />

                                {/* Name + meta */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-900 dark:group-hover:text-white transition">
                                        {p.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="flex-1 h-1 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden max-w-[80px]">
                                            <div
                                                className={`h-full rounded-full ${cfg.dot}`}
                                                style={{ width: `${p.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-zinc-400 tabular-nums">{p.progress}%</span>
                                        <span className="text-[10px] text-zinc-400">{p.doneCount}/{p.taskCount} tasks</span>
                                    </div>
                                </div>

                                {/* Status badge + time */}
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                        {cfg.label}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                        {formatDistanceToNow(p.lastActive, { addSuffix: true })}
                                    </span>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
