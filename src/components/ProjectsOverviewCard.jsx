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
        {
            label: 'Active',
            value: stats.active,
            icon: FolderOpen,
            gradient: 'bg-gradient-to-br from-[#4A88FF] to-[#6063ee]',
        },
        {
            label: 'Completed',
            value: stats.completed,
            icon: CheckCircle2,
            gradient: 'bg-gradient-to-br from-[#34D399] to-[#10B981]',
        },
        {
            label: 'Due This Week',
            value: stats.tasksDueThisWeek,
            icon: Clock,
            gradient: 'bg-gradient-to-br from-[#FBBF24] to-[#F59E0B]',
        },
        {
            label: 'Overdue',
            value: stats.overdue,
            icon: AlertTriangle,
            gradient: stats.overdue > 0 ? 'bg-gradient-to-br from-[#F87171] to-[#EF4444]' : 'bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-700 dark:to-zinc-800',
        },
    ]

    return (
        <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Overview</h2>
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
                        <div key={kpi.label} className={`glass-card-hover ${kpi.gradient} rounded-xl p-4 text-white`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold opacity-90">{kpi.label}</span>
                                <kpi.icon className="size-3.5 opacity-80" />
                            </div>
                            <div className="text-2xl font-bold">{kpi.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
