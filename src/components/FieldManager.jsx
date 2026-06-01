import { useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { upsertFieldDefinitions } from "../features/workspaceSlice";
import { SlidersHorizontalIcon, GripVerticalIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import toast from "react-hot-toast";

// Built-in columns that are always available (not stored in project_field_definitions)
export const BUILTIN_FIELDS = [
    { key: "type",       label: "Type",       builtin: true },
    { key: "priority",   label: "Priority",   builtin: true },
    { key: "status",     label: "Status",     builtin: true },
    { key: "assignee",   label: "Assignee",   builtin: true },
    { key: "start_date", label: "Start Date", builtin: true },
    { key: "due_date",   label: "Due Date",   builtin: true },
];

/**
 * FieldManager
 * Props:
 *   projectId   — current project UUID
 *   fieldDefs   — array of project_field_definitions rows from Redux
 *   builtinVisible — { [key]: boolean } persisted in localStorage per project
 *   onBuiltinVisibilityChange — (key, visible) => void
 */
const FieldManager = ({ projectId, fieldDefs = [], builtinVisible, onBuiltinVisibilityChange }) => {
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    const [fields, setFields] = useState([]);
    const panelRef = useRef(null);
    const dragItem = useRef(null);
    const dragOver = useRef(null);

    // Sync local state from redux fieldDefs
    useEffect(() => {
        setFields(
            [...fieldDefs].sort((a, b) => a.position - b.position)
        );
    }, [fieldDefs]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const toggleVisible = (key) => {
        setFields((prev) => prev.map((f) => f.key === key ? { ...f, visible: !f.visible } : f));
    };

    const handleDragStart = (index) => { dragItem.current = index; };
    const handleDragEnter = (index) => { dragOver.current = index; };
    const handleDragEnd = () => {
        const updated = [...fields];
        const dragged = updated.splice(dragItem.current, 1)[0];
        updated.splice(dragOver.current, 0, dragged);
        dragItem.current = null;
        dragOver.current = null;
        setFields(updated.map((f, i) => ({ ...f, position: i })));
    };

    const handleSave = async () => {
        try {
            await dispatch(upsertFieldDefinitions({
                projectId,
                fields: fields.map(({ id, created_at, ...rest }) => rest),
            })).unwrap();
            toast.success("Field settings saved");
            setOpen(false);
        } catch (err) {
            toast.error("Failed to save fields");
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="px-3 py-1 flex items-center gap-2 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
                <SlidersHorizontalIcon className="size-3.5" />
                Fields
            </button>

            {open && (
                <div className="absolute right-0 top-8 z-50 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-4">
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                        Built-in columns
                    </p>
                    <div className="flex flex-col gap-1 mb-4">
                        {BUILTIN_FIELDS.map((f) => {
                            const visible = builtinVisible?.[f.key] !== false;
                            return (
                                <div key={f.key} className="flex items-center justify-between py-1 px-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{f.label}</span>
                                    <button
                                        type="button"
                                        onClick={() => onBuiltinVisibilityChange(f.key, !visible)}
                                        className={`${visible ? "text-blue-500" : "text-zinc-400 dark:text-zinc-600"} hover:opacity-80 transition`}
                                    >
                                        {visible ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {fields.length > 0 && (
                        <>
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
                                Custom columns
                            </p>
                            <div className="flex flex-col gap-1 mb-4">
                                {fields.map((f, index) => (
                                    <div
                                        key={f.key}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragEnter={() => handleDragEnter(index)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-grab active:cursor-grabbing"
                                    >
                                        <GripVerticalIcon className="size-3.5 text-zinc-400 shrink-0" />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{f.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleVisible(f.key)}
                                            className={`${f.visible ? "text-blue-500" : "text-zinc-400 dark:text-zinc-600"} hover:opacity-80 transition`}
                                        >
                                            {f.visible ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleSave}
                                className="w-full py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm transition"
                            >
                                Save
                            </button>
                        </>
                    )}

                    {fields.length === 0 && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-2">
                            Import from Asana to add custom columns.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default FieldManager;
