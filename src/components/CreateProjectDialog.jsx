import { useState } from "react";
import { Loader2Icon, ChevronDownIcon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { createProject } from "../features/workspaceSlice";
import Modal from "./Modal";
import { accentBtn, ghostBtn, inputCls, labelCls, PROJECT_COLORS } from "./ui";
import toast from "react-hot-toast";

// A project needs a name. Space and colour are one click; the rest is folded away.
const CreateProjectDialog = ({ isDialogOpen, setIsDialogOpen, defaultSpaceId = "" }) => {
    const dispatch = useDispatch();
    const { currentWorkspace } = useSelector((state) => state.workspace);
    const spaces = useSelector((state) => state.workspace.spaces || []);
    const projectCount = currentWorkspace?.projects?.length || 0;

    const blank = () => ({
        name: "", description: "", status: "PLANNING", priority: "MEDIUM",
        start_date: "", end_date: "", space_id: defaultSpaceId,
        color: PROJECT_COLORS[projectCount % PROJECT_COLORS.length],
    });
    const [formData, setFormData] = useState(blank);
    const [more, setMore] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const set = (patch) => setFormData((f) => ({ ...f, ...patch }));

    const close = () => { setIsDialogOpen(false); setMore(false); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentWorkspace || !formData.name.trim()) return;
        setIsSubmitting(true);
        try {
            await dispatch(createProject({
                workspaceId: currentWorkspace.id,
                name: formData.name.trim(),
                description: formData.description,
                status: formData.status,
                priority: formData.priority,
                startDate: formData.start_date,
                endDate: formData.end_date,
                spaceId: formData.space_id || null,
                color: formData.color,
            })).unwrap();
            toast.success("Project created");
            setFormData(blank());
            close();
        } catch (err) {
            toast.error(err?.message || err || "Failed to create project");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal open={!!isDialogOpen} onClose={close} title="New project" subtitle={currentWorkspace ? `In ${currentWorkspace.name}` : undefined} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="project-name" className="sr-only">Project name</label>
                    <input id="project-name" autoFocus type="text" value={formData.name} onChange={(e) => set({ name: e.target.value })}
                        placeholder="Project name" required className={`${inputCls} !text-[17px] !py-2.5`} />
                </div>

                {spaces.length > 0 && (
                    <div>
                        <label className={labelCls}>Space</label>
                        <select value={formData.space_id} onChange={(e) => set({ space_id: e.target.value })} className={inputCls}>
                            <option value="">No space</option>
                            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}

                <div>
                    <label className={labelCls}>Color</label>
                    <div className="flex flex-wrap gap-2">
                        {PROJECT_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => set({ color: c })} aria-label={`Color ${c}`} aria-pressed={formData.color === c}
                                className={`size-7 rounded-full transition-transform ${formData.color === c ? "ring-2 ring-offset-2 ring-ink-700 dark:ring-offset-zinc-900 scale-110" : "hover:scale-105"}`}
                                style={{ backgroundColor: c }} />
                        ))}
                    </div>
                </div>

                <button type="button" onClick={() => setMore((v) => !v)}
                    className="flex items-center gap-1 text-[13px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
                    <ChevronDownIcon className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} />
                    {more ? "Fewer options" : "More options"}
                    {!more && <span className="font-normal text-gray-400">· description, dates, status</span>}
                </button>

                {more && (
                    <div className="space-y-4 pt-1">
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea value={formData.description} onChange={(e) => set({ description: e.target.value })} placeholder="What is this project for?" className={`${inputCls} h-20 resize-none`} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Status</label>
                                <select value={formData.status} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
                                    <option value="PLANNING">Planning</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="ON_HOLD">On hold</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Priority</label>
                                <select value={formData.priority} onChange={(e) => set({ priority: e.target.value })} className={inputCls}>
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Starts</label>
                                <input type="date" value={formData.start_date} onChange={(e) => set({ start_date: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Ends</label>
                                <input type="date" value={formData.end_date} min={formData.start_date || undefined} onChange={(e) => set({ end_date: e.target.value })} className={inputCls} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={close} className={ghostBtn}>Cancel</button>
                    <button type="submit" disabled={isSubmitting || !currentWorkspace || !formData.name.trim()} className={accentBtn}>
                        {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                        {isSubmitting ? "Creating…" : "Create project"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateProjectDialog;
