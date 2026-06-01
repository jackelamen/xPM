import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, UsersIcon, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { useSelector } from "react-redux";
import CreateProjectDialog from "./CreateProjectDialog";

const ProjectOverview = () => {
    const statusColors = {
        PLANNING: "bg-zinc-200 text-zinc-800 dark:bg-zinc-600 dark:text-zinc-200",
        ACTIVE: "bg-emerald-200 text-emerald-800 dark:bg-emerald-500 dark:text-emerald-900",
        ON_HOLD: "bg-amber-200 text-amber-800 dark:bg-amber-500 dark:text-amber-900",
        COMPLETED: "bg-blue-200 text-blue-800 dark:bg-blue-500 dark:text-blue-900",
        CANCELLED: "bg-red-200 text-red-800 dark:bg-red-500 dark:text-red-900"
    };

    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const projects = currentWorkspace?.projects || []

    const getProgress = (project) => {
        const tasks = project.tasks || []
        if (!tasks.length) return 0
        const done = tasks.filter((t) => t.status === "DONE").length
        return Math.round((done / tasks.length) * 100)
    }

    return currentWorkspace && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.07] rounded-xl overflow-hidden">
            <div className="border-b border-gray-100 dark:border-white/[0.06] px-4 py-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">Projects</h2>
                <Link to={'/projects'} className="text-[12px] text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors">
                    View all <ArrowRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="p-0">
                {projects.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-500 rounded-full flex items-center justify-center">
                            <FolderOpen size={32} />
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400">No projects yet</p>
                        <button onClick={() => setIsDialogOpen(true)} className="mt-4 px-4 py-2 text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white dark:text-zinc-200 rounded hover:opacity-90 transition">
                            Create your First Project
                        </button>
                        <CreateProjectDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                        {projects.slice(0, 5).map((project) => (
                            <Link key={project.id} to={`/projectsDetail?id=${project.id}&tab=tasks`} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-[13px] font-medium text-gray-800 dark:text-zinc-200 truncate">
                                            {project.name}
                                        </h3>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${statusColors[project.status]}`}>
                                            {project.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-zinc-500">
                                        <span className="flex items-center gap-1">
                                            <UsersIcon className="w-3 h-3" />
                                            {project.members?.length || 1}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {project.tasks?.length || 0} tasks
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 w-24">
                                    {(() => {
                                        const progress = getProgress(project)
                                        return (
                                            <div>
                                                <div className="w-full bg-gray-100 dark:bg-white/[0.06] rounded-full h-1">
                                                    <div className="h-1 bg-gray-900 dark:bg-zinc-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                                                </div>
                                                <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 text-right">{progress}%</p>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProjectOverview;
