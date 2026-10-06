import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    ArrowLeftIcon, PlusIcon, SettingsIcon, BarChart3Icon, CalendarIcon,
    FileStackIcon, LayoutDashboardIcon, GanttChartIcon,
    FileTextIcon, NetworkIcon, CheckCircle2, Clock, Users, ListTodo
} from "lucide-react";
import ProjectAnalytics from "../components/ProjectAnalytics";
import ProjectSettings from "../components/ProjectSettings";
import CreateTaskDialog from "../components/CreateTaskDialog";
import ProjectCalendar from "../components/ProjectCalendar";
import ProjectTasks from "../components/ProjectTasks";
import ProjectBoard from "../components/ProjectBoard";
import ProjectTimeline from "../components/ProjectTimeline";
import ProjectNotes from "../components/ProjectNotes";
import ProjectGantt from "../components/ProjectGantt";
import TaskPanel from "../components/TaskPanel";
import { useSyncedPref } from "../lib/useSyncedPref";
import Tooltip from "../components/Tooltip";
import { ProjectStatus } from "../components/Badges";

export default function ProjectDetail() {

    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab');
    const id = searchParams.get('id');
    const taskParam = searchParams.get('task');

    const navigate = useNavigate();
    const projects = useSelector((state) => state?.workspace?.currentWorkspace?.projects || []);

    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [activeTab, setActiveTab] = useState(tab || "tasks");
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    // Tasks (the list) and Settings are always there; other views are added with "+ View".
    const [pinnedViews, setPinnedViews] = useSyncedPref("project_views", []);
    const [viewMenu, setViewMenu] = useState(false);

    useEffect(() => {
        if (tab) setActiveTab(tab);
    }, [tab]);

    // Deep link from notifications: ?task=<id> opens that task's panel.
    useEffect(() => {
        if (taskParam) setSelectedTaskId(taskParam);
    }, [taskParam]);

    const [fieldDefinitions, setFieldDefinitions] = useState([]);

    useEffect(() => {
        if (projects && projects.length > 0) {
            const proj = projects.find((p) => p.id === id);
            setProject(proj);
            setTasks(proj?.tasks || []);
            setFieldDefinitions(proj?.fieldDefinitions || []);
        }
    }, [id, projects]);

    if (!project) {
        return (
            <div className="p-6 text-center text-zinc-900 dark:text-zinc-200">
                <p className="text-3xl md:text-5xl mt-40 mb-10">Project not found</p>
                <button onClick={() => navigate('/projects')} className="mt-4 px-4 py-2 rounded bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600">
                    Back to Projects
                </button>
            </div>
        );
    }

    const TABS = [
        { key: "tasks", label: "Tasks", icon: FileStackIcon },
        { key: "board", label: "Board", icon: LayoutDashboardIcon },
        { key: "calendar", label: "Calendar", icon: CalendarIcon },
        { key: "timeline", label: "Timeline", icon: GanttChartIcon },
        { key: "gantt", label: "Gantt", icon: NetworkIcon },
        { key: "notes", label: "Notes", icon: FileTextIcon },
        { key: "analytics", label: "Analytics", icon: BarChart3Icon },
        { key: "settings", label: "Settings", icon: SettingsIcon },
    ];

    const totalTasks = tasks.length;
    const completed = tasks.filter((t) => t.status === "DONE").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const completionPct = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    return (
        <div className="max-w-6xl mx-auto text-zinc-900 dark:text-white">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-start gap-3 min-w-0">
                    <Tooltip label="Back to projects" side="bottom">
                        <button
                            className="mt-2 p-1.5 rounded-md hover:bg-gray-200/70 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition flex-shrink-0"
                            onClick={() => navigate('/projects')}
                            aria-label="Back to projects"
                        >
                            <ArrowLeftIcon className="w-4 h-4" />
                        </button>
                    </Tooltip>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="size-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#6489b3" }} />
                            <h1 className="text-[32px] sm:text-[40px] font-bold tracking-tight leading-none text-ink-900 dark:text-white truncate">{project.name}</h1>
                            <ProjectStatus status={project.status} />
                        </div>
                        {project.description && (
                            <p className="mt-2 text-[15px] text-gray-500 dark:text-zinc-400 max-w-3xl">{project.description}</p>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateTask(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-[14px] font-semibold rounded-lg bg-ink-900 hover:bg-ink-800 dark:bg-white dark:text-ink-950 text-white transition-colors flex-shrink-0 whitespace-nowrap"
                >
                    <PlusIcon className="size-4" />
                    New task
                </button>
            </div>

            {/* Where it stands: one line, not four tiles */}
            <div className="mb-7">
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                    {[
                        [totalTasks, totalTasks === 1 ? "task" : "tasks"],
                        [completed, "done"],
                        [inProgress, "in progress"],
                        [project.members?.length || 0, (project.members?.length || 0) === 1 ? "person" : "people"],
                    ].map(([n, label]) => (
                        <p key={label} className="flex items-baseline gap-1.5">
                            <span className="font-display text-[30px] font-bold leading-none tabular-nums text-ink-900 dark:text-white">{n}</span>
                            <span className="text-[14px] text-gray-500 dark:text-zinc-400">{label}</span>
                        </p>
                    ))}
                    {totalTasks > 0 && (
                        <p className="ml-auto flex items-baseline gap-1.5">
                            <span className="font-display text-[30px] font-bold leading-none tabular-nums" style={{ color: project.color || undefined }}>{completionPct}%</span>
                            <span className="text-[14px] text-gray-500 dark:text-zinc-400">complete</span>
                        </p>
                    )}
                </div>
                {totalTasks > 0 && (
                    <div className="mt-3 h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completionPct}%`, backgroundColor: project.color || "#6489b3" }} />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div>
                <div className="flex flex-wrap items-center border-b border-gray-200 dark:border-zinc-800 mb-6 gap-1">
                    {TABS.filter((t) => t.key === "tasks" || t.key === "settings" || pinnedViews.includes(t.key) || t.key === activeTab).map((tabItem) => (
                        <div key={tabItem.key} className="flex items-center -mb-px">
                            <button
                                onClick={() => { setActiveTab(tabItem.key); setSearchParams({ id: id, tab: tabItem.key }); }}
                                className={`font-display flex items-center gap-1.5 px-3 py-2.5 text-[16px] font-semibold transition-colors border-b-[3px] ${
                                    activeTab === tabItem.key
                                        ? "border-signal-500 text-ink-900 dark:text-white"
                                        : "border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
                                }`}
                            >
                                <tabItem.icon className="size-3.5" />
                                {tabItem.key === "tasks" ? "List" : tabItem.label}
                            </button>
                            {pinnedViews.includes(tabItem.key) && (
                                <button onClick={() => setPinnedViews((v) => v.filter((k) => k !== tabItem.key))}
                                    title={`Remove ${tabItem.label} from this bar`} aria-label={`Remove ${tabItem.label} view`}
                                    className="-ml-2 mr-1 text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs leading-none">×</button>
                            )}
                        </div>
                    ))}
                    <div className="relative">
                        <button onClick={() => setViewMenu((v) => !v)}
                            className="flex items-center gap-1 px-3 py-2.5 text-[14px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                            <PlusIcon className="size-3.5" /> View
                        </button>
                        {viewMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setViewMenu(false)} />
                                <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                                    {TABS.filter((t) => t.key !== "tasks" && t.key !== "settings").map((t) => (
                                        <button key={t.key}
                                            onClick={() => {
                                                setPinnedViews((v) => (v.includes(t.key) ? v : [...v, t.key]));
                                                setActiveTab(t.key); setSearchParams({ id: id, tab: t.key }); setViewMenu(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                            <t.icon className="size-3.5 text-zinc-400" />{t.label}
                                            {pinnedViews.includes(t.key) && <span className="ml-auto text-xs text-zinc-400">added</span>}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div>
                    {activeTab === "tasks" && (
                        <div className="dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectTasks tasks={tasks} projectId={id} fieldDefinitions={fieldDefinitions} onTaskClick={(taskId) => setSelectedTaskId(taskId)} />
                        </div>
                    )}
                    {activeTab === "board" && (
                        <div className="max-w-6xl">
                            <ProjectBoard tasks={tasks} projectId={id} onTaskClick={(taskId) => setSelectedTaskId(taskId)} />
                        </div>
                    )}
                    {activeTab === "calendar" && (
                        <div className="dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectCalendar tasks={tasks} />
                        </div>
                    )}
                    {activeTab === "timeline" && (
                        <div className="max-w-6xl">
                            <ProjectTimeline tasks={tasks} projectId={id} />
                        </div>
                    )}
                    {activeTab === "gantt" && (
                        <div className="max-w-6xl overflow-x-auto">
                            <ProjectGantt tasks={tasks} projectId={id} />
                        </div>
                    )}
                    {activeTab === "notes" && (
                        <div className="dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectNotes projectId={id} />
                        </div>
                    )}
                    {activeTab === "analytics" && (
                        <div className="dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectAnalytics tasks={tasks} project={project} />
                        </div>
                    )}
                    {activeTab === "settings" && (
                        <div className="dark:bg-zinc-900/40 rounded max-w-6xl">
                            <ProjectSettings project={project} />
                        </div>
                    )}
                </div>
            </div>

            {showCreateTask && <CreateTaskDialog showCreateTask={showCreateTask} setShowCreateTask={setShowCreateTask} projectId={id} />}

            {selectedTaskId && (
                <TaskPanel taskId={selectedTaskId} projectId={id} onClose={() => setSelectedTaskId(null)} />
            )}
        </div>
    );
}
