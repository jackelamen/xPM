import { Link } from "react-router-dom";
import { useState } from "react";
import { format } from "date-fns";
import { ProjectStatus } from "./Badges";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const ProjectCard = ({ project, selected = false, onToggleSelect }) => {
    const [hovered, setHovered] = useState(false)
    const showCheckbox = selected || hovered

    const tasks = project.tasks || []
    const done = tasks.filter((t) => t.status === "DONE").length
    const open = tasks.length - done
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
    const today = todayStr()
    const openTasks = tasks.filter((t) => t.status !== "DONE" && !t.archived_at)
    const overdue = openTasks.filter((t) => t.due_date && t.due_date < today).length
    const nextDue = openTasks.map((t) => t.due_date).filter((d) => d && d >= today).sort()[0]
    const color = project.color || "#6489b3"

    return (
        <div
            style={{ borderTopColor: color }}
            className={`relative bg-white dark:bg-zinc-900 border border-t-[4px] rounded-2xl p-5 transition-colors group ${
                selected
                    ? "border-signal-500 ring-1 ring-signal-500"
                    : "border-gray-200 dark:border-zinc-800 hover:border-ink-300 dark:hover:border-zinc-600"
            }`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {showCheckbox && onToggleSelect && (
                <button
                    onClick={(e) => { e.preventDefault(); onToggleSelect(project.id) }}
                    className="absolute top-3 right-3 z-10"
                    aria-label={selected ? "Deselect project" : "Select project"}
                >
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(project.id)}
                        className="size-4 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    />
                </button>
            )}

            <Link to={`/projectsDetail?id=${project.id}&tab=tasks`} className="block">
                <h3 className="text-[20px] font-semibold leading-tight text-gray-900 dark:text-white truncate pr-6 group-hover:text-ink-600 dark:group-hover:text-ink-300 transition-colors">
                    {project.name}
                </h3>
                <p className="mt-1 text-[14px] text-gray-500 dark:text-zinc-400 line-clamp-2 min-h-[42px]">
                    {project.description || "No description yet."}
                </p>

                <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                        <p className="font-display text-[34px] font-bold leading-none tabular-nums text-ink-900 dark:text-white">{open}</p>
                        <p className="mt-1 text-[13px] text-gray-500 dark:text-zinc-400">open task{open !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right text-[13px]">
                        <ProjectStatus status={project.status} className="justify-end" />
                        {overdue > 0
                            ? <p className="mt-1 font-semibold text-red-600 dark:text-red-400">{overdue} overdue</p>
                            : nextDue
                                ? <p className="mt-1 text-gray-500 dark:text-zinc-400">Next due {format(new Date(`${nextDue}T00:00:00`), "MMM d")}</p>
                                : <p className="mt-1 text-gray-400 dark:text-zinc-500">Nothing due</p>}
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[12px] tabular-nums text-gray-500 dark:text-zinc-400">{progress}%</span>
                </div>
            </Link>
        </div>
    );
};

export default ProjectCard;
