import { useState } from "react";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { createTask } from "../features/workspaceSlice";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import Modal from "./Modal";
import { accentBtn, ghostBtn, inputCls, labelCls } from "./ui";
import toast from "react-hot-toast";

const blank = (me) => ({
    title: "", description: "", type: "OTHER", status: "TODO", priority: "MEDIUM",
    leadId: me || "", assigneeIds: [], start_date: "", due_date: "", due_time: "", estimate: "",
});

// A task needs a title. Who, and when, are one click away. The rest stays folded away.
export default function CreateTaskDialog({ showCreateTask, setShowCreateTask, projectId }) {
    const dispatch = useDispatch();
    const { user } = useAuth();
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace || null);
    const teamMembers = currentWorkspace?.members || [];

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [more, setMore] = useState(false);
    const [formData, setFormData] = useState(() => blank(user?.id));
    const set = (patch) => setFormData((f) => ({ ...f, ...patch }));

    const close = () => { setShowCreateTask(false); setMore(false); };

    const toggleAssignee = (id) => set({
        assigneeIds: formData.assigneeIds.includes(id) ? formData.assigneeIds.filter((x) => x !== id) : [...formData.assigneeIds, id],
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentWorkspace || !formData.title.trim()) return;
        setIsSubmitting(true);
        try {
            const task = await dispatch(createTask({
                workspaceId: currentWorkspace.id,
                projectId,
                title: formData.title.trim(),
                description: formData.description,
                type: formData.type,
                status: formData.status,
                priority: formData.priority,
                leadId: formData.leadId || null,
                assigneeIds: formData.assigneeIds,
                startDate: formData.start_date || null,
                dueDate: formData.due_date || null,
                dueTime: formData.due_time || null,
            })).unwrap();
            if (formData.estimate) {
                // The create call doesn't take an estimate, so set it right after.
                await supabase.from("xpm_tasks").update({ estimate_minutes: Number(formData.estimate) }).eq("id", task.id);
            }
            toast.success("Task created");
            setFormData(blank(user?.id));
            close();
        } catch (err) {
            toast.error(err?.message || err || "Failed to create task");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal open={!!showCreateTask} onClose={close} title="New task" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="task-title" className="sr-only">Title</label>
                    <input id="task-title" autoFocus value={formData.title} onChange={(e) => set({ title: e.target.value })}
                        placeholder="What needs to be done?" required
                        className={`${inputCls} !text-[17px] !py-2.5`} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Assigned to</label>
                        <select value={formData.leadId} onChange={(e) => set({ leadId: e.target.value })} className={inputCls}>
                            <option value="">Unassigned</option>
                            {teamMembers.map((m) => (
                                <option key={m.user_id} value={m.user_id}>{m.user_id === user?.id ? "Me" : (m.user?.name || m.user?.email)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Due</label>
                        <input type="date" value={formData.due_date} onChange={(e) => set({ due_date: e.target.value })} className={inputCls} />
                    </div>
                </div>

                <button type="button" onClick={() => setMore((v) => !v)}
                    className="flex items-center gap-1 text-[13px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                    <ChevronDownIcon className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} />
                    {more ? "Fewer options" : "More options"}
                    {!more && <span className="font-normal text-gray-400">· notes, start date, estimate, priority</span>}
                </button>

                {more && (
                    <div className="space-y-4 pt-1">
                        <div>
                            <label className={labelCls}>Notes</label>
                            <textarea value={formData.description} onChange={(e) => set({ description: e.target.value })} placeholder="Anything worth knowing" className={`${inputCls} h-20 resize-none`} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Starts</label>
                                <input type="date" value={formData.start_date} onChange={(e) => set({ start_date: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Due time</label>
                                <input type="time" value={formData.due_time} onChange={(e) => set({ due_time: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Estimate (minutes)</label>
                                <input type="number" min="0" step="5" value={formData.estimate} onChange={(e) => set({ estimate: e.target.value })} placeholder="30" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Priority</label>
                                <select value={formData.priority} onChange={(e) => set({ priority: e.target.value })} className={inputCls}>
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Status</label>
                                <select value={formData.status} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
                                    <option value="TODO">To do</option>
                                    <option value="IN_PROGRESS">In progress</option>
                                    <option value="DONE">Done</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Type</label>
                                <select value={formData.type} onChange={(e) => set({ type: e.target.value })} className={inputCls}>
                                    {["OTHER", "MEETING", "WRITING", "STRATEGY", "DESIGN", "ADMIN", "OUTREACH"].map((t) => (
                                        <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {teamMembers.length > 1 && (
                            <div>
                                <label className={labelCls}>Also assign to</label>
                                <div className="flex flex-wrap gap-2">
                                    {teamMembers.filter((m) => m.user_id !== formData.leadId).map((m) => {
                                        const on = formData.assigneeIds.includes(m.user_id);
                                        return (
                                            <button type="button" key={m.user_id} onClick={() => toggleAssignee(m.user_id)}
                                                className={`px-3 py-1.5 rounded-lg text-[13px] border transition-colors ${on ? "bg-ink-900 text-white border-ink-900 dark:bg-white dark:text-ink-950 dark:border-white" : "border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-ink-400"}`}>
                                                {m.user?.name || m.user?.email}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={close} className={ghostBtn}>Cancel</button>
                    <button type="submit" disabled={isSubmitting || !formData.title.trim()} className={accentBtn}>
                        {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                        {isSubmitting ? "Creating…" : "Create task"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
