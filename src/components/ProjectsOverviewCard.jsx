import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { ArrowUpRightIcon } from 'lucide-react'

export default function ProjectsOverviewCard() {
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const stats = useMemo(() => {
        if (!currentWorkspace) return { total: 0, completed: 0, inProgress: 0, notStarted: 0 }
        const projects = currentWorkspace.projects || []
        return {
            total: projects.length,
            completed: projects.filter((p) => p.status === 'COMPLETED').length,
            inProgress: projects.filter((p) => p.status === 'ACTIVE').length,
            notStarted: projects.filter((p) => p.status === 'PLANNING').length,
        }
    }, [currentWorkspace])

    const total = stats.total || 1
    // Build conic-gradient segments
    const completedDeg = (stats.completed / total) * 360
    const inProgressDeg = (stats.inProgress / total) * 360
    const donutGradient = stats.total === 0
        ? 'conic-gradient(#e5e7eb 0% 100%)'
        : `conic-gradient(
            #3b82f6 0deg ${completedDeg}deg,
            #f59e0b ${completedDeg}deg ${completedDeg + inProgressDeg}deg,
            #e5e7eb ${completedDeg + inProgressDeg}deg 360deg
          )`

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-[#e5e2e1] dark:border-white/[0.07] rounded-[24px] p-7 flex flex-col shadow-[0_4px_20px_rgba(0,0,0,0.04)] h-[340px]">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[22px] font-bold text-[#000101] dark:text-white">Projects Overview</h2>
                <Link to="/projects">
                    <button className="w-9 h-9 rounded-full border border-[#c5c6ca] dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05] transition-colors">
                        <ArrowUpRightIcon size={13} />
                    </button>
                </Link>
            </div>

            <div className="flex flex-col items-center justify-center flex-1">
                {/* Donut */}
                <div className="relative flex-shrink-0">
                    <div
                        className="w-40 h-40 rounded-full"
                        style={{ background: donutGradient }}
                    >
                        <div className="absolute inset-4 bg-white dark:bg-[#111111] rounded-full flex flex-col items-center justify-center">
                            <span className="text-[28px] font-extrabold text-[#000101] dark:text-white leading-none">{stats.total}</span>
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">Projects</span>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-6 text-[13px]">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-zinc-400">Completed: {stats.completed}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-zinc-400">In Progress: {stats.inProgress}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-500">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-zinc-700 flex-shrink-0" />
                            <span>Not Started: {stats.notStarted}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
