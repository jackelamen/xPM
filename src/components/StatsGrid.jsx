import { FolderOpen, CheckCircle, Users, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";

export default function StatsGrid() {
    const { user } = useAuth()
    const currentWorkspace = useSelector(
        (state) => state?.workspace?.currentWorkspace || null
    );

    const stats = useMemo(() => {
        if (!currentWorkspace) return { totalProjects: 0, completedProjects: 0, myTasks: 0, overdueIssues: 0 }

        const allTasks = currentWorkspace.projects.flatMap((p) => p.tasks || [])
        const now = new Date()

        return {
            totalProjects: currentWorkspace.projects.length,
            completedProjects: currentWorkspace.projects.filter((p) => p.status === "COMPLETED").length,
            myTasks: allTasks.filter((t) => t.assignee_id === user?.id && t.status !== "DONE").length,
            overdueIssues: allTasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status !== "DONE").length,
        }
    }, [currentWorkspace, user])

    const statCards = [
        {
            icon: FolderOpen,
            title: "Projects",
            value: stats.totalProjects,
            subtitle: `in workspace`,
        },
        {
            icon: CheckCircle,
            title: "Completed",
            value: stats.completedProjects,
            subtitle: `of ${stats.totalProjects} projects`,
        },
        {
            icon: Users,
            title: "My Tasks",
            value: stats.myTasks,
            subtitle: "assigned to me",
        },
        {
            icon: AlertTriangle,
            title: "Overdue",
            value: stats.overdueIssues,
            subtitle: "need attention",
            highlight: stats.overdueIssues > 0,
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-6">
            {statCards.map(
                ({ icon: Icon, title, value, subtitle, highlight }, i) => (
                    <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.07] rounded-xl p-4 hover:border-gray-300 dark:hover:border-white/[0.12] transition-colors">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[12px] font-medium text-gray-500 dark:text-zinc-400">
                                {title}
                            </p>
                            <Icon size={13} className={highlight ? "text-amber-500" : "text-gray-400 dark:text-zinc-500"} strokeWidth={1.75} />
                        </div>
                        <p className={`text-2xl font-semibold tracking-tight ${highlight && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
                            {value}
                        </p>
                        {subtitle && (
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                )
            )}
        </div>
    );
}
