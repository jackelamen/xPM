import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ArrowRightIcon } from "lucide-react";

// Colors for charts and priorities
const COLORS = ["#0f3a68", "#2b9c78", "#ffb020", "#c2410c", "#7c5cd6", "#6489b3", "#a8325e"];
// Urgent is red, High is amber, the rest stay quiet.
const PRIORITY_COLORS = {
    URGENT: "text-red-600 dark:text-red-400",
    HIGH: "text-signal-600",
    MEDIUM: "text-ink-500 dark:text-ink-300",
    LOW: "text-gray-400",
};

const ProjectAnalytics = ({ project, tasks }) => {
    const { stats, statusData, typeData, priorityData } = useMemo(() => {
        const now = new Date();
        const total = tasks.length;

        const stats = {
            total,
            completed: 0,
            inProgress: 0,
            todo: 0,
            overdue: 0,
        };

        const statusMap = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
        const typeMap = { MEETING: 0, WRITING: 0, STRATEGY: 0, DESIGN: 0, ADMIN: 0, OUTREACH: 0, OTHER: 0 };
        const priorityMap = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

        tasks.forEach((t) => {
            if (t.status === "DONE") stats.completed++;
            if (t.status === "IN_PROGRESS") stats.inProgress++;
            if (t.status === "TODO") stats.todo++;
            if (t.due_date && new Date(`${t.due_date}T00:00:00`) < now && t.status !== "DONE") stats.overdue++;

            if (statusMap[t.status] !== undefined) statusMap[t.status]++;
            if (typeMap[t.type] !== undefined) typeMap[t.type]++;
            if (priorityMap[t.priority] !== undefined) priorityMap[t.priority]++;
        });

        return {
            stats,
            statusData: Object.entries(statusMap).map(([k, v]) => ({ name: k.replace("_", " "), value: v })),
            typeData: Object.entries(typeMap).filter(([_, v]) => v > 0).map(([k, v]) => ({ name: k, value: v })),
            priorityData: Object.entries(priorityMap).map(([k, v]) => ({
                name: k,
                value: v,
                percentage: total > 0 ? Math.round((v / total) * 100) : 0,
            })),
        };
    }, [tasks]);

    const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

    const metrics = [
        { label: "Completion rate", value: `${completionRate}%`, tone: "text-ink-900 dark:text-white" },
        { label: "In progress", value: stats.inProgress, tone: "text-ink-900 dark:text-white" },
        { label: "Overdue", value: stats.overdue, tone: stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-zinc-500" },
        { label: "Team size", value: project?.members?.length || 0, tone: "text-ink-900 dark:text-white" },
    ];

    return (
        <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m, i) => (
                    <div
                        key={i}
                        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5"
                    >
                        <p className={`font-display text-[38px] font-bold leading-none tabular-nums ${m.tone}`}>{m.value}</p>
                        <p className="mt-2 text-[14px] text-gray-500 dark:text-zinc-400">{m.label}</p>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Tasks by Status */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6">
                    <h2 className="text-gray-900 dark:text-white mb-4 text-[18px] font-semibold">Tasks by Status</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={statusData}>
                            <XAxis
                                dataKey="name"
                                tick={{ fill: "#52525b", fontSize: 12 }}
                                axisLine={{ stroke: "#d4d4d8" }}
                                dark={{ stroke: "#27272a" }}
                            />
                            <YAxis tick={{ fill: "#52525b", fontSize: 12 }} axisLine={{ stroke: "#d4d4d8" }} />
                            <Bar dataKey="value" fill="#0f3a68" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Tasks by Type */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6">
                    <h2 className="text-gray-900 dark:text-white mb-4 text-[18px] font-semibold">Tasks by Type</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={typeData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, value }) => `${name}: ${value}`}
                            >
                                {typeData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Priority Breakdown */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6">
                <h2 className="text-gray-900 dark:text-white mb-4 text-[18px] font-semibold">Tasks by Priority</h2>
                <div className="space-y-4">
                    {priorityData.map((p) => (
                        <div key={p.name} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <ArrowRightIcon className={`size-3.5 ${PRIORITY_COLORS[p.name]} bg-transparent dark:bg-transparent`} />
                                    <span className="text-zinc-900 dark:text-zinc-200 capitalize">{p.name.toLowerCase()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-600 dark:text-zinc-400 text-sm">{p.value} tasks</span>
                                    <span className="px-2 py-0.5 border border-zinc-400 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                                        {p.percentage}%
                                    </span>
                                </div>
                            </div>
                            <div className="w-full bg-zinc-300 dark:bg-zinc-800 rounded-full h-1.5">
                                <div
                                    className={`h-1.5 rounded-full ${PRIORITY_COLORS[p.name]}`}
                                    style={{ width: `${p.percentage}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProjectAnalytics;
