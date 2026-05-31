import { useState } from "react";
import { UserPlus, Loader2Icon } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchWorkspaceDetail } from "../features/workspaceSlice";
import toast from "react-hot-toast";

const AddProjectMember = ({ isDialogOpen, setIsDialogOpen }) => {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');
    const dispatch = useDispatch();

    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const project = currentWorkspace?.projects.find((p) => p.id === id);

    // Workspace members not already in this project
    const projectMemberIds = (project?.members || []).map((m) => m.user_id || m.user?.id);
    const availableMembers = (currentWorkspace?.members || []).filter(
        (m) => !projectMemberIds.includes(m.user_id)
    );

    const [selectedUserId, setSelectedUserId] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedUserId || !project) return;
        setIsAdding(true);
        try {
            // Projects don't have a separate members table yet —
            // we track project membership through task assignment.
            // For now, confirm the user is a workspace member which gives project access.
            toast.success("Member has workspace access and can be assigned tasks in this project.");
            setIsDialogOpen(false);
        } catch (err) {
            toast.error(err.message || "Failed to add member");
        } finally {
            setIsAdding(false);
        }
    };

    if (!isDialogOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                <div className="mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <UserPlus className="size-5" /> Add Member to Project
                    </h2>
                    {project && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            {project.name}
                        </p>
                    )}
                </div>

                {availableMembers.length === 0 ? (
                    <div className="text-center py-6">
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            All workspace members are already in this project.
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                            Invite new members from the Team page first.
                        </p>
                        <button
                            onClick={() => setIsDialogOpen(false)}
                            className="mt-4 px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Select Member
                            </label>
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 text-sm py-2 px-3 focus:outline-none focus:border-blue-500"
                                required
                            >
                                <option value="">Select a workspace member</option>
                                {availableMembers.map((member) => (
                                    <option key={member.user_id} value={member.user_id}>
                                        {member.user?.name || member.user?.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDialogOpen(false)}
                                className="px-5 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isAdding || !selectedUserId}
                                className="flex items-center gap-2 px-5 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-50 hover:opacity-90 transition"
                            >
                                {isAdding && <Loader2Icon className="size-4 animate-spin" />}
                                {isAdding ? "Adding..." : "Confirm"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AddProjectMember;
