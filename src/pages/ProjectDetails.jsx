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

    const statusColors = {
        PLANNING: "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-200",
        ACTIVE: "bg-emerald-200 text-emerald-900 dark:bg-emerald-500 dark:text-emerald-900",
        ON_HOLD: "bg-amber-200 text-amber-900 dark:bg-amber-500 dark:text-amber-900",
        COMPLETED: "bg-blue-200 text-blue-900 dark:bg-blue-500 dark:text-blue-900",
        CANCELLED: "bg-red-200 text-red-900 dark:bg-red-500 dark:text-red-900",
    };

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
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
                        onClick={() => navigate('/projects')}
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg font-semibold leading-tight">{project.name}</h1>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[project.status]}`}>
                                {project.status.replace("_", " ")}
                            </span>
                        </div>
                        {project.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{project.description}</p>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateTask(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition"
                >
                    <PlusIcon className="size-3.5" />
                    New Task
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Total Tasks</span>
                        <ListTodo className="size-3.5 text-zinc-400" />
                    </div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-white">{totalTasks}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Completed</span>
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{completed}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">In Progress</span>
                        <Clock className="size-3.5 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{inProgress}</div>
                </div>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Team</span>
                        <Users className="size-3.5 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{project.members?.length || 0}</div>
                </div>
            </div>

            {/* Progress bar */}
            {totalTasks > 0 && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Progress</span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{completionPct}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div>
                <div className="flex flex-wrap border-b border-zinc-200 dark:border-zinc-800 mb-6 gap-0">
                    {TABS.map((tabItem) => (
                        <button
                            key={tabItem.key}
                            onClick={() => { setActiveTab(tabItem.key); setSearchParams({ id: id, tab: tabItem.key }); }}
                            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-all border-b-2 -mb-px ${
                                activeTab === tabItem.key
                                    ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-medium"
                                    : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                            }`}
                        >
                            <tabItem.icon className="size-3.5" />
                            {tabItem.label}
                        </button>
                    ))}
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
