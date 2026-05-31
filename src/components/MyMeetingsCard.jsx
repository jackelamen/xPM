import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { addDays, format, isAfter, startOfToday } from 'date-fns'
import { ArrowUpRightIcon, CalendarDaysIcon, Code2Icon, VideoIcon } from 'lucide-react'

export default function MyMeetingsCard() {
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const upcoming = useMemo(() => {
        const today = startOfToday()
        const fallbackDate = addDays(today, 1)

        return (currentWorkspace?.projects || [])
            .flatMap((project) =>
                (project.tasks || [])
                    .filter((task) => task.status !== 'DONE')
                    .map((task) => ({
                        ...task,
                        projectId: project.id,
                        projectName: project.name,
                        sortDate: task.due_date ? new Date(task.due_date) : fallbackDate,
                    }))
            )
            .filter((task) => !task.due_date || isAfter(task.sortDate, addDays(today, -1)))
            .sort((a, b) => a.sortDate - b.sortDate)
            .slice(0, 2)
    }, [currentWorkspace])

    return (
        <div className="bg-white dark:bg-white/[0.03] border border-[#e5e2e1] dark:border-white/[0.07] rounded-[24px] p-7 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[22px] font-bold text-[#000101] dark:text-white">Upcoming Work</h2>
                <Link to="/projects" className="w-9 h-9 rounded-full border border-[#c5c6ca] dark:border-white/[0.1] flex items-center justify-center text-gray-600 dark:text-zinc-400 hover:bg-[#f1eded] dark:hover:bg-white/[0.05] transition-colors" title="Open projects">
                    <CalendarDaysIcon size={14} />
                </Link>
            </div>

            <div className="flex flex-col gap-4">
                {upcoming.length === 0 ? (
                    <div className="border border-[#c5c6ca] dark:border-white/[0.08] rounded-2xl p-5 text-[13px] text-gray-500 dark:text-zinc-500">
                        No upcoming dated work yet.
                    </div>
                ) : (
                    upcoming.map((task, index) => (
                        <Link
                            key={task.id}
                            to={`/projectsDetail?id=${task.projectId}&tab=tasks`}
                            className="border border-[#c5c6ca] dark:border-white/[0.08] rounded-2xl p-4 flex items-center justify-between hover:bg-[#f6f3f2] dark:hover:bg-white/[0.04] transition-colors"
                        >
                            <div className="min-w-[82px]">
                                <p className="text-[12px] text-gray-500 dark:text-zinc-500 mb-1">Due Date</p>
                                <p className="text-[15px] font-extrabold text-[#000101] dark:text-white">
                                    {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'Next'}
                                </p>
                            </div>
                            <div className="flex-1 ml-4 border-l border-[#c5c6ca] dark:border-white/[0.08] pl-4 min-w-0">
                                <h4 className="text-[15px] font-extrabold text-[#000101] dark:text-white truncate">{task.projectName}</h4>
                                <div className={`flex items-center gap-1 text-[12px] mt-1 ${index === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                    {index === 0 ? <Code2Icon size={13} /> : <VideoIcon size={13} />}
                                    <span className="truncate">{task.title}</span>
                                </div>
                            </div>
                            <ArrowUpRightIcon size={15} className="text-gray-500 dark:text-zinc-500 ml-3 flex-shrink-0" />
                        </Link>
                    ))
                )}
            </div>

            <Link to="/projects" className="text-[14px] text-[#000101] dark:text-white font-bold mt-5 hover:underline flex items-center gap-1">
                See all work <ArrowUpRightIcon size={13} />
            </Link>
        </div>
    )
}
