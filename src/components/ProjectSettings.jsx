import { useState, useEffect } from "react";
import { PROJECT_COLORS } from "./ui";
import { Save, Loader2Icon, Trash2Icon } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { supabase } from "../lib/supabase";
import { fetchWorkspaceDetail } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const inputClasses = "w-full px-3 py-2 rounded mt-1 border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-ink-500";
const labelClasses = "text-sm text-zinc-600 dark:text-zinc-400";
const cardClasses = "rounded-2xl border p-6 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800";

export default function ProjectSettings({ project }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const spaces = useSelector((state) => state.workspace.spaces || []);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        status: "PLANNING",
        space_id: "",
        pulse_tag: "",
        color: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    useEffect(() => {
        if (project) {
            setFormData({
                name: project.name || "",
                description: project.description || "",
                status: project.status || "PLANNING",
                space_id: project.space_id || "",
                pulse_tag: project.pulse_tag || "",
                color: project.color || "",
            });
        }
    }, [project]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!project) return;
        setIsSubmitting(true);
        try {
            // Normalize the same way Pulse normalizes tags client-side (trim,
            // strip leading '#', lowercase) — the DB trigger on tasks.tags
            // would lowercase it anyway, so match that up front for a
            // consistent preview in the field itself.
            const normalizedPulseTag = formData.pulse_tag.trim().replace(/^#/, "").toLowerCase() || null

            const { data, error } = await supabase
                .from("projects")
                .update({
                    name: formData.name,
                    description: formData.description,
                    status: formData.status,
                    space_id: formData.space_id || null,
                    pulse_tag: normalizedPulseTag,
                    color: formData.color || null,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", project.id)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) { toast.error("You don't have permission to edit this project."); return; }
            toast.success("Project updated");
            dispatch(fetchWorkspaceDetail(project.workspace_id));
        } catch (err) {
            toast.error(err.message || "Failed to save");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!window.confirm("Archive this project? It will be hidden but not deleted.")) return;
        setIsArchiving(true);
        try {
            const { data, error } = await supabase
                .from("projects")
                .update({ archived_at: new Date().toISOString() })
                .eq("id", project.id)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) { toast.error("You don't have permission to archive this project."); setIsArchiving(false); return; }
            toast.success("Project archived");
            dispatch(fetchWorkspaceDetail(project.workspace_id));
            navigate("/projects");
        } catch (err) {
            toast.error(err.message || "Failed to archive");
            setIsArchiving(false);
        }
    };

    if (!project) return null;

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            {/* Project Details */}
            <div className={cardClasses}>
                <h2 className="text-[20px] font-semibold text-gray-900 dark:text-white mb-4">Project details</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Project Name</label>
                        <input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={inputClasses}
                            required
                        />
                    </div>

                    <div>
                        <label className={labelClasses}>Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className={inputClasses + " h-24 resize-none"}
                        />
                    </div>

                    <div>
                        <label className={labelClasses}>Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className={inputClasses}
                        >
                            <option value="PLANNING">Planning</option>
                            <option value="ACTIVE">Active</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className={labelClasses}>Space</label>
                        <select
                            value={formData.space_id}
                            onChange={(e) => setFormData({ ...formData, space_id: e.target.value })}
                            className={inputClasses}
                        >
                            <option value="">No space</option>
                            {spaces.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClasses}>Color</label>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            {PROJECT_COLORS.map((c) => (
                                <button key={c} type="button" onClick={() => setFormData({ ...formData, color: c })} aria-label={`Color ${c}`} aria-pressed={formData.color === c}
                                    className={`size-7 rounded-full transition-transform ${formData.color === c ? "ring-2 ring-offset-2 ring-ink-700 dark:ring-offset-zinc-900 scale-110" : "hover:scale-105"}`}
                                    style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Pulse Tag</label>
                        <input
                            value={formData.pulse_tag}
                            onChange={(e) => setFormData({ ...formData, pulse_tag: e.target.value })}
                            placeholder={formData.name ? formData.name.toLowerCase() : "e.g. bee-business-development"}
                            className={inputClasses}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            Tag applied to tasks sent to Pulse from this project. Leave blank to default to the project name, lowercased.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 text-[14px] font-semibold bg-ink-900 hover:bg-ink-800 dark:bg-white dark:text-ink-950 text-white px-4 py-2.5 rounded-lg disabled:opacity-60 transition-colors"
                    >
                        {isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>

            {/* Danger Zone */}
            <div className="space-y-6">
                {/* Members */}
                <div className={cardClasses}>
                    <h2 className="text-[20px] font-semibold text-gray-900 dark:text-white mb-3">
                        Team Members <span className="text-sm text-zinc-500">({project.members?.length || 0})</span>
                    </h2>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(project.members || []).map((member) => (
                            <div key={member.id || member.user_id} className="flex items-center gap-3 px-3 py-2 rounded dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-300">
                                <div className="size-6 rounded-full bg-ink-800 flex items-center justify-center text-white text-xs font-medium">
                                    {(member.user?.name || member.user?.email || "?")[0].toUpperCase()}
                                </div>
                                <span className="flex-1 truncate">{member.user?.name || member.user?.email}</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{member.role}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="rounded-lg border border-red-200 dark:border-red-900 p-6">
                    <h2 className="text-[20px] font-semibold text-red-600 dark:text-red-400 mb-1">Danger zone</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                        Archiving a project hides it from all views. Tasks are preserved.
                    </p>
                    <button
                        onClick={handleArchive}
                        disabled={isArchiving}
                        className="flex items-center gap-2 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
                    >
                        {isArchiving ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
                        {isArchiving ? "Archiving..." : "Archive Project"}
                    </button>
                </div>
            </div>
        </div>
    );
}
