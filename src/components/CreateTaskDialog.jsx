import { useState } from "react";
import { Calendar as CalendarIcon, Loader2Icon, ChevronDownIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { format } from "date-fns";
import { createTask } from "../features/workspaceSlice";
import toast from "react-hot-toast";

export default function CreateTaskDialog({ showCreateTask, setShowCreateTask, projectId }) {
    const dispatch = useDispatch();
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const teamMembers = currentWorkspace?.members || [];

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "MEETING",
        status: "TODO",
        priority: "MEDIUM",
        leadId: "",
        assigneeIds: [],
        due_date: "",
    });

    const toggleAssignee = (userId) => {
        setFormData((prev) => ({
            ...prev,
            assigneeIds: prev.assigneeIds.includes(userId)
                ? prev.assigneeIds.filter((id) => id !== userId)
                : [...prev.assigneeIds, userId],
        }));
    };

    const assigneeLabel = () => {
        const count = formData.assigneeIds.length;
        if (count === 0) return "None";
        if (count === 1) {
            const m = teamMembers.find((m) => m.user_id === formData.assigneeIds[0]);
            return m?.user?.name || m?.user?.email || "1 member";
        }
        return `${count} members`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentWorkspace) return;
        setIsSubmitting(true);
        try {
            await dispatch(createTask({
                workspaceId: currentWorkspace.id,
                projectId,
                title: formData.title,
                description: formData.description,
                type: formData.type,
                status: formData.status,
                priority: formData.priority,
                leadId: formData.leadId || null,
                assigneeIds: formData.assigneeIds,
                dueDate: formData.due_date || null,
            })).unwrap();
            toast.success("Task created!");
            setShowCreateTask(false);
            setFormData({ title: "", description: "", type: "MEETING", status: "TODO", priority: "MEDIUM", leadId: "", assigneeIds: [], due_date: "" });
        } catch (err) {
            toast.error(err || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    return showCreateTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 text-zinc-900 dark:text-white">
                <h2 className="text-xl font-bold mb-4">Create New Task</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div className="space-y-1">
                        <label htmlFor="title" className="text-sm font-medium">Title</label>
                        <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Task title" className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label htmlFor="description" className="text-sm font-medium">Description</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe the task" className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Type & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Type</label>
                            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1" >
                                <option value="MEETING">Meeting</option>
                                <option value="WRITING">Writing</option>
                                <option value="STRATEGY">Strategy</option>
                                <option value="DESIGN">Design</option>
                                <option value="ADMIN">Admin</option>
                                <option value="OUTREACH">Outreach</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Priority</label>
                            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"                             >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    {/* Lead and Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Project Lead</label>
                            <select value={formData.leadId} onChange={(e) => setFormData({ ...formData, leadId: e.target.value })} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1">
                                <option value="">Unassigned</option>
                                {teamMembers.map((member) => (
                                    <option key={member.user_id} value={member.user_id}>
                                        {member.user?.name || member.user?.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Status</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1">
                                <option value="TODO">To Do</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="DONE">Done</option>
                            </select>
                        </div>
                    </div>

                    {/* Assignees multi-select */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Assignees</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowAssigneeDropdown((v) => !v)}
                                className="w-full flex items-center justify-between rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1"
                            >
                                <span>{assigneeLabel()}</span>
                                <ChevronDownIcon className="size-4 text-zinc-400" />
                            </button>
                            {showAssigneeDropdown && (
                                <div className="absolute z-10 mt-1 w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg max-h-48 overflow-y-auto">
                                    {teamMembers.map((member) => (
                                        <label key={member.user_id} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-sm text-zinc-800 dark:text-zinc-200">
                                            <input
                                                type="checkbox"
                                                checked={formData.assigneeIds.includes(member.user_id)}
                                                onChange={() => toggleAssignee(member.user_id)}
                                                className="rounded"
                                            />
                                            {member.user?.name || member.user?.email}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Due Date</label>
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="size-5 text-zinc-500 dark:text-zinc-400" />
                            <input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} min={new Date().toISOString().split('T')[0]} className="w-full rounded dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-zinc-900 dark:text-zinc-200 text-sm mt-1" />
                        </div>
                        {formData.due_date && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {format(new Date(formData.due_date), "PPP")}
                            </p>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setShowCreateTask(false)} className="rounded border border-zinc-300 dark:border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" >
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded px-5 py-2 text-sm bg-gradient-to-br from-blue-500 to-blue-600 hover:opacity-90 text-white transition disabled:opacity-60" >
                            {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                            {isSubmitting ? "Creating..." : "Create Task"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    ) : null;
}
