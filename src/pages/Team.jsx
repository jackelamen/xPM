import { useEffect, useState } from "react";
import { Search, UserPlus, Folder, CheckSquare, Users, Trash2, Edit2 } from "lucide-react";
import InviteMemberDialog from "../components/InviteMemberDialog";
import { useSelector, useDispatch } from "react-redux";
import { fetchWorkspaceDetail } from "../features/workspaceSlice";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const Team = () => {
    const [tasks, setTasks] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [removingId, setRemovingId] = useState(null);
    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);
    const projects = currentWorkspace?.projects || [];
    const dispatch = useDispatch();
    const { user: currentUser } = useAuth();

    const handleRemove = async (member) => {
        if (member.user_id === currentUser?.id) {
            toast.error("You can't remove yourself.");
            return;
        }
        if (!window.confirm(`Remove ${member.user?.name || member.user?.email} from this workspace?`)) return;
        setRemovingId(member.id);
        const { error } = await supabase
            .from("workspace_members")
            .delete()
            .eq("id", member.id);
        if (error) {
            toast.error("Failed to remove member.");
        } else {
            toast.success("Member removed.");
            dispatch(fetchWorkspaceDetail(currentWorkspace.id));
        }
        setRemovingId(null);
    };

    const filteredUsers = users.filter(
        (user) =>
            user?.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user?.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        setUsers(currentWorkspace?.members || []);
        setTasks(currentWorkspace?.projects?.reduce((acc, project) => [...acc, ...project.tasks], []) || []);
    }, [currentWorkspace]);

    const activeProjects = projects.filter((p) => p.status !== "CANCELLED" && p.status !== "COMPLETED");

    const stats = [
        {
            label: "Total Members",
            value: users.length,
            icon: <Users className="size-4" />,
            iconBg: "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-300",
            bg: "bg-blue-500/5",
        },
        {
            label: "Active Projects",
            value: activeProjects.length,
            icon: <Folder className="size-4" />,
            iconBg: "bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-300",
            bg: "bg-violet-500/5",
        },
        {
            label: "Total Tasks",
            value: tasks.length,
            icon: <CheckSquare className="size-4" />,
            iconBg: "bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-300",
            bg: "bg-rose-500/5",
        },
    ];

    return (
        <div className="flex flex-col gap-5 sm:gap-8 max-w-6xl mx-auto pb-12">

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Team</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                        Manage team members and their contributions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
                    >
                        <UserPlus className="size-4" />
                        Invite Member
                    </button>
                </div>
                <InviteMemberDialog isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex items-center gap-4 group hover:-translate-y-0.5 transition-transform duration-150"
                    >
                        <div className={`p-3 rounded-xl ${stat.iconBg} flex-shrink-0`}>
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                        </div>
                        {/* subtle background watermark icon */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.04] scale-[2.5] pointer-events-none group-hover:opacity-[0.07] transition-opacity">
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>

            {/* Table Panel */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">

                {/* Toolbar */}
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3 bg-gray-50/60 dark:bg-zinc-900">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 size-3.5" />
                        <input
                            type="text"
                            placeholder="Filter members..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                <Users className="size-7 text-gray-400 dark:text-zinc-500" />
                            </div>
                            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                                {users.length === 0 ? "No team members yet" : "No members match your search"}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                                {users.length === 0 ? "Invite someone to get started" : "Try a different search term"}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-zinc-800">
                                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Member</th>
                                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm">
                                                    {(user.user?.name || user.user?.email || "?")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                                                        {user.user?.name || user.user?.email || "Unknown"}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-zinc-500 sm:hidden">{user.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-sm text-gray-500 dark:text-zinc-400 hidden sm:table-cell">
                                            {user.user?.email}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                user.role === "admin" || user.role === "ADMIN"
                                                    ? "bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300"
                                                    : "bg-gray-100 dark:bg-zinc-700/60 text-gray-600 dark:text-zinc-300"
                                            }`}>
                                                {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase() : "Member"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 text-right">
                                            {user.user_id !== currentUser?.id && (
                                                <button
                                                    onClick={() => handleRemove(user)}
                                                    disabled={removingId === user.id}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                                    title="Remove member"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                {filteredUsers.length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/40 dark:bg-zinc-900 text-xs text-gray-400 dark:text-zinc-500">
                        Showing {filteredUsers.length} of {users.length} {users.length === 1 ? "member" : "members"}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Team;
