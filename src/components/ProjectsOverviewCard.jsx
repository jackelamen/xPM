import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowUpRightIcon, FolderOpen, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { isAfter, startOfDay, endOfWeek } from 'date-fns'

export default function ProjectsOverviewCard() {
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const stats = useMemo(() => {
        if (!currentWorkspace) return { active: 0, completed: 0, onHold: 0, total: 0, tasksDueThisWeek: 0, overdue: 0 }
        const projects = currentWorkspace.projects || []
        const now = new Date()
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
        const todayStart = startOfDay(now)

        let tasksDueThisWeek = 0
        let overdue = 0
        projects.forEach((p) => {
            ;(p.tasks || []).forEach((t) => {
                if (!t.due_date || t.status === 'DONE') return
                const d = new Date(t.due_date)
                if (d < todayStart) overdue++
                else if (!isAfter(d, weekEnd)) tasksDueThisWeek++
            })
        })

        return {
            total: projects.length,
            active: projects.filter((p) => p.status === 'ACTIVE').length,
            completed: projects.filter((p) => p.status === 'COMPLETED').length,
            onHold: projects.filter((p) => p.status === 'ON_HOLD').length,
            tasksDueThisWeek,
            overdue,
        }
    }, [currentWorkspace])

    const kpis = [
        { label: 'Active', value: stats.active, tile: 'bg-ink-900 text-white', sub: 'text-ink-300', icon: FolderOpen },
        { label: 'Completed', value: stats.completed, tile: 'bg-gray-100 dark:bg-zinc-800 text-ink-900 dark:text-white', sub: 'text-gray-500 dark:text-zinc-400', icon: CheckCircle2 },
        { label: 'Due This Week', value: stats.tasksDueThisWeek, tile: 'bg-signal-500/15 text-ink-900 dark:text-white', sub: 'text-signal-700 dark:text-signal-400', icon: Clock },
        { label: 'Overdue', value: stats.overdue, tile: stats.overdue > 0 ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500', sub: stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-zinc-500', icon: AlertTriangle },
    ]

    return (
        <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[20px] font-semibold text-zinc-900 dark:text-white">Overview</h2>
                <Link to="/spaces" className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    All spaces <ArrowUpRightIcon size={11} />
                </Link>
            </div>

            {stats.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <FolderOpen className="size-8 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-500">No projects yet</p>
                    <Link
                        to="/spaces"
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-80 transition"
                    >
                        + Create your first project
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={`${kpi.tile} rounded-xl p-4`}>
                            <div className="font-display text-[40px] font-bold leading-none tabular-nums">{kpi.value}</div>
                            <div className={`mt-2 text-[13px] font-medium ${kpi.sub}`}>{kpi.label}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
