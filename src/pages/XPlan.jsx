import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import {
    PlusIcon, XIcon, TrashIcon, Loader2Icon, PencilIcon,
    Rows3Icon, MapIcon, GripVerticalIcon, CalendarIcon,
} from "lucide-react";
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
    SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast from "react-hot-toast";
import { format } from "date-fns";
import XPlanTimeline from "../components/XPlanTimeline";
import XPlanInitiativeDrawer from "../components/XPlanInitiativeDrawer";

// Shared open-editor behavior: "new" → small create modal; an existing row →
// full drawer (details + links + plan builder).
function InitiativeEditor({ target, workspaceId, lanes, members, onSaved, onClose }) {
    if (target === "new") {
        return (
            <Modal title="New initiative" onClose={onClose}>
                <InitiativeForm workspaceId={workspaceId} lanes={lanes} members={members}
                    initial={null} onSaved={onSaved} onClose={onClose} />
            </Modal>
        );
    }
    return (
        <XPlanInitiativeDrawer initiative={target} workspaceId={workspaceId}
            lanes={lanes} members={members} onChanged={onSaved} onClose={onClose} />
    );
}

const TABS = ["Timeline", "Board", "Initiatives", "Lanes"];

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500 mt-1";
const labelCls = "text-xs font-medium text-gray-500 dark:text-zinc-400";

const STATUS_STYLES = {
    planned:   "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    active:    "bg-blue-100 text-blue-800 border border-blue-200",
    "at-risk": "bg-amber-100 text-amber-800 border border-amber-200",
    done:      "bg-green-100 text-green-800 border border-green-200",
    dropped:   "bg-red-100 text-red-700 border border-red-200",
};
const STATUSES = Object.keys(STATUS_STYLES);
const HORIZONS = ["now", "next", "later"];
const HORIZON_LABELS = { now: "Now", next: "Next", later: "Later" };

const LANE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
                        <XIcon className="size-4 text-gray-400" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function TablePanel({ toolbar, children }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
            {toolbar && (
                <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    {toolbar}
                </div>
            )}
            <div className="overflow-x-auto">{children}</div>
        </div>
    );
}

function TableHead({ cols }) {
    return (
        <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-800">
                {cols.map((col, i) => (
                    <th key={i} className={`px-5 py-3 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider ${col.right ? "text-right" : "text-left"}`}>
                        {col.label}
                    </th>
                ))}
            </tr>
        </thead>
    );
}

const fmtDate = (d) => (d ? format(new Date(`${d}T00:00:00`), "MMM d, yyyy") : "—");

// ─── Initiative create/edit form ─────────────────────────────────────────────
function InitiativeForm({ workspaceId, lanes, members, initial, onSaved, onClose }) {
    const { user } = useAuth();
    const [form, setForm] = useState({
        title: initial?.title || "",
        description: initial?.description || "",
        lane_id: initial?.lane_id || "",
        owner_id: initial?.owner_id || user?.id || "",
        start_date: initial?.start_date || "",
        end_date: initial?.end_date || "",
        horizon: initial?.horizon || "next",
        status: initial?.status || "planned",
    });
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error("Title is required");
        setSaving(true);
        const row = {
            workspace_id: workspaceId,
            title: form.title.trim(),
            description: form.description.trim() || null,
            lane_id: form.lane_id || null,
            owner_id: form.owner_id || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            horizon: form.horizon,
            status: form.status,
        };
        const q = initial
            ? supabase.from("roadmap_initiatives").update({ ...row, updated_at: new Date().toISOString() }).eq("id", initial.id)
            : supabase.from("roadmap_initiatives").insert({ ...row, created_by: user?.id || null });
        const { error } = await q;
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success(initial ? "Initiative updated" : "Initiative created");
        onSaved();
        onClose();
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
            <div>
                <label className={labelCls}>Title *</label>
                <input className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. APAC market entry — Q3 push" autoFocus />
            </div>
            <div>
                <label className={labelCls}>Description</label>
                <textarea className={inputCls} rows={2} value={form.description} onChange={set("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Lane</label>
                    <select className={inputCls} value={form.lane_id} onChange={set("lane_id")}>
                        <option value="">No lane</option>
                        {lanes.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Owner</label>
                    <select className={inputCls} value={form.owner_id} onChange={set("owner_id")}>
                        <option value="">Unassigned</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Start date</label>
                    <input type="date" className={inputCls} value={form.start_date} onChange={set("start_date")} />
                </div>
                <div>
                    <label className={labelCls}>End date</label>
                    <input type="date" className={inputCls} value={form.end_date} onChange={set("end_date")} />
                </div>
                <div>
                    <label className={labelCls}>Horizon</label>
                    <select className={inputCls} value={form.horizon} onChange={set("horizon")}>
                        {HORIZONS.map((h) => <option key={h} value={h}>{HORIZON_LABELS[h]}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={form.status} onChange={set("status")}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>
            <button disabled={saving} className="mt-2 flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg py-2.5 hover:opacity-90 transition disabled:opacity-50">
                {saving && <Loader2Icon className="size-4 animate-spin" />}
                {initial ? "Save changes" : "Create initiative"}
            </button>
        </form>
    );
}

// ─── Timeline tab ────────────────────────────────────────────────────────────
function Timeline({ workspaceId, lanes, members }) {
    const [rows, setRows] = useState(null);
    const [modal, setModal] = useState(null); // null | "new" | initiative row

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from("roadmap_initiatives")
            .select("*, lane:roadmap_lanes(id, name, color)")
            .eq("workspace_id", workspaceId)
            .order("sort_order")
            .order("created_at");
        if (error) toast.error(error.message);
        setRows(data || []);
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    // Keep local rows in sync after a drag-save without a full refetch.
    const onDatesSaved = useCallback((id, dates) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...dates } : r)));
    }, []);

    if (rows === null) return (
        <div className="flex justify-center py-16"><Loader2Icon className="size-6 text-gray-400 animate-spin" /></div>
    );

    return (
        <>
            <div className="flex justify-end -mb-1">
                <button
                    onClick={() => setModal("new")}
                    className="flex items-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                    <PlusIcon className="size-3.5" /> New initiative
                </button>
            </div>
            <XPlanTimeline rows={rows} lanes={lanes} onBarClick={setModal} onDatesSaved={onDatesSaved} />
            {modal && (
                <InitiativeEditor target={modal} workspaceId={workspaceId} lanes={lanes}
                    members={members} onSaved={load} onClose={() => setModal(null)} />
            )}
        </>
    );
}

// ─── Now / Next / Later board ────────────────────────────────────────────────
const BOARD_COLUMNS = [
    { id: "now",   label: "Now",   color: "bg-blue-500",  hint: "Actively pursuing" },
    { id: "next",  label: "Next",  color: "bg-violet-500", hint: "Queued up" },
    { id: "later", label: "Later", color: "bg-zinc-400",  hint: "On the radar" },
];

function BoardCard({ row, onClick, isDragging }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };

    return (
        <div
            ref={setNodeRef} style={style} {...attributes} {...listeners}
            onClick={() => onClick(row)}
            className="bg-white dark:bg-[#1c1c1c] border border-gray-200/80 dark:border-white/[0.07] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-white/[0.12] hover:shadow-sm transition-all select-none"
        >
            <p className="text-[13px] font-medium text-gray-800 dark:text-zinc-100 leading-snug">{row.title}</p>
            <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                    {row.lane && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                            <span className="size-1.5 rounded-full flex-shrink-0" style={{ background: row.lane.color }} />
                            {row.lane.name}
                        </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${STATUS_STYLES[row.status]}`}>{row.status}</span>
                </div>
                {row.end_date && (
                    <span className="flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-zinc-500 flex-shrink-0">
                        <CalendarIcon className="size-3" />
                        {format(new Date(`${row.end_date}T00:00:00`), "MMM d")}
                    </span>
                )}
            </div>
        </div>
    );
}

function BoardColumn({ column, rows, onCardClick, activeId }) {
    const { setNodeRef, isOver } = useSortable({ id: column.id });
    return (
        <div ref={setNodeRef} className="flex flex-col flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 mb-2.5 px-0.5">
                <div className={`size-1.5 rounded-full ${column.color}`} />
                <span className="text-[12px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">{column.label}</span>
                <span className="text-[11px] text-gray-400 dark:text-zinc-600">{column.hint}</span>
                <span className="ml-auto text-[11px] font-medium text-gray-400 dark:text-zinc-600 tabular-nums">{rows.length}</span>
            </div>
            <div className={`flex-1 rounded-xl p-2 min-h-40 space-y-2 transition-colors ${
                isOver ? "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200 dark:ring-blue-800" : "bg-gray-100/60 dark:bg-white/[0.025]"
            }`}>
                <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    {rows.map((row) => (
                        <BoardCard key={row.id} row={row} onClick={onCardClick} isDragging={activeId === row.id} />
                    ))}
                </SortableContext>
                {rows.length === 0 && (
                    <div className="flex items-center justify-center h-20 text-[11px] text-gray-400 dark:text-zinc-600">Drop here</div>
                )}
            </div>
        </div>
    );
}

function Board({ workspaceId, lanes, members }) {
    const [rows, setRows] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [modal, setModal] = useState(null); // null | "new" | initiative row
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from("roadmap_initiatives")
            .select("*, lane:roadmap_lanes(id, name, color)")
            .eq("workspace_id", workspaceId)
            .neq("status", "dropped")
            .order("sort_order")
            .order("created_at");
        if (error) toast.error(error.message);
        setRows(data || []);
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    const byHorizon = useMemo(() => {
        const acc = { now: [], next: [], later: [] };
        for (const r of rows || []) acc[r.horizon]?.push(r);
        return acc;
    }, [rows]);

    const findHorizon = (id) => BOARD_COLUMNS.find((c) => byHorizon[c.id].some((r) => r.id === id))?.id || null;

    const handleDragEnd = async ({ active, over }) => {
        setActiveId(null);
        if (!over || active.id === over.id) return;

        const source = findHorizon(active.id);
        const target = BOARD_COLUMNS.some((c) => c.id === over.id) ? over.id : findHorizon(over.id);
        if (!source || !target) return;

        // Build the target column's new order (and persist it).
        let targetList;
        if (source === target) {
            const list = byHorizon[source];
            const from = list.findIndex((r) => r.id === active.id);
            const to = list.findIndex((r) => r.id === over.id);
            if (from === -1 || to === -1) return;
            targetList = arrayMove(list, from, to);
        } else {
            const moved = byHorizon[source].find((r) => r.id === active.id);
            const overIdx = byHorizon[target].findIndex((r) => r.id === over.id);
            targetList = [...byHorizon[target]];
            targetList.splice(overIdx === -1 ? targetList.length : overIdx, 0, { ...moved, horizon: target });
        }

        // Optimistic local update.
        const updates = targetList.map((r, i) => ({ id: r.id, horizon: target, sort_order: i }));
        setRows((prev) => prev.map((r) => {
            const u = updates.find((x) => x.id === r.id);
            return u ? { ...r, ...u } : r;
        }));

        const results = await Promise.all(updates.map((u) =>
            supabase.from("roadmap_initiatives")
                .update({ horizon: u.horizon, sort_order: u.sort_order, updated_at: new Date().toISOString() })
                .eq("id", u.id)
        ));
        if (results.some((r) => r.error)) {
            toast.error("Failed to save the move");
            load();
        }
    };

    if (rows === null) return (
        <div className="flex justify-center py-16"><Loader2Icon className="size-6 text-gray-400 animate-spin" /></div>
    );

    const activeRow = rows.find((r) => r.id === activeId);

    return (
        <>
            <div className="flex justify-end">
                <button
                    onClick={() => setModal("new")}
                    className="flex items-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                >
                    <PlusIcon className="size-3.5" /> New initiative
                </button>
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={({ active }) => setActiveId(active.id)}
                onDragEnd={handleDragEnd}
            >
                <div className="flex gap-4 overflow-x-auto pb-4">
                    <SortableContext items={BOARD_COLUMNS.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        {BOARD_COLUMNS.map((col) => (
                            <BoardColumn key={col.id} column={col} rows={byHorizon[col.id]} onCardClick={setModal} activeId={activeId} />
                        ))}
                    </SortableContext>
                </div>
                <DragOverlay>
                    {activeRow ? (
                        <div className="bg-white dark:bg-zinc-900 border border-blue-400 dark:border-blue-500 rounded-lg p-3 shadow-lg rotate-1 w-64">
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-snug">{activeRow.title}</p>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {modal && (
                <InitiativeEditor target={modal} workspaceId={workspaceId} lanes={lanes}
                    members={members} onSaved={load} onClose={() => setModal(null)} />
            )}
        </>
    );
}

// ─── Initiatives tab ─────────────────────────────────────────────────────────
function Initiatives({ workspaceId, lanes, members, refreshLanes }) {
    const [rows, setRows] = useState(null);
    const [modal, setModal] = useState(null); // null | "new" | initiative row
    const [laneFilter, setLaneFilter] = useState("");

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from("roadmap_initiatives")
            .select("*, lane:roadmap_lanes(id, name, color), owner:profiles!roadmap_initiatives_owner_id_fkey(id, full_name, email)")
            .eq("workspace_id", workspaceId)
            .order("sort_order")
            .order("created_at");
        if (error) toast.error(error.message);
        setRows(data || []);
    }, [workspaceId]);

    useEffect(() => { load(); refreshLanes(); }, [load, refreshLanes]);

    const visible = useMemo(
        () => (rows || []).filter((r) => !laneFilter || r.lane_id === laneFilter),
        [rows, laneFilter]
    );

    const del = async (row) => {
        if (!confirm(`Delete "${row.title}"? Its draft plan (phases, milestones, KPIs) will be deleted too.`)) return;
        const { error } = await supabase.from("roadmap_initiatives").delete().eq("id", row.id);
        if (error) return toast.error(error.message);
        toast.success("Initiative deleted");
        load();
    };

    if (rows === null) return (
        <div className="flex justify-center py-16"><Loader2Icon className="size-6 text-gray-400 animate-spin" /></div>
    );

    return (
        <>
            <TablePanel
                toolbar={
                    <>
                        <select
                            value={laneFilter}
                            onChange={(e) => setLaneFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-700 dark:text-zinc-200 focus:outline-none"
                        >
                            <option value="">All lanes</option>
                            {lanes.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <button
                            onClick={() => setModal("new")}
                            className="flex items-center gap-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition"
                        >
                            <PlusIcon className="size-3.5" /> New initiative
                        </button>
                    </>
                }
            >
                {visible.length === 0 ? (
                    <div className="py-16 text-center">
                        <MapIcon className="size-8 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-zinc-400">No initiatives yet.</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Create your first BD initiative — a pursuit, campaign, or market push.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <TableHead cols={[
                            { label: "Initiative" }, { label: "Lane" }, { label: "Owner" },
                            { label: "Timeline" }, { label: "Horizon" }, { label: "Status" }, { label: "", right: true },
                        ]} />
                        <tbody>
                            {visible.map((r) => (
                                <tr key={r.id} className="border-b border-gray-50 dark:border-zinc-800/60 hover:bg-gray-50/60 dark:hover:bg-zinc-800/30 transition cursor-pointer" onClick={() => setModal(r)}>
                                    <td className="px-5 py-3.5">
                                        <p className="font-medium text-gray-900 dark:text-zinc-100">{r.title}</p>
                                        {r.description && <p className="text-xs text-gray-400 dark:text-zinc-500 truncate max-w-xs">{r.description}</p>}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        {r.lane ? (
                                            <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-700 dark:text-zinc-300">
                                                <span className="size-2 rounded-full" style={{ background: r.lane.color }} />
                                                {r.lane.name}
                                            </span>
                                        ) : <span className="text-gray-300 dark:text-zinc-600">—</span>}
                                    </td>
                                    <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-300">{r.owner?.full_name || r.owner?.email || "—"}</td>
                                    <td className="px-5 py-3.5 text-gray-500 dark:text-zinc-400 whitespace-nowrap text-[13px]">
                                        {r.start_date || r.end_date ? `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}` : "—"}
                                    </td>
                                    <td className="px-5 py-3.5 text-gray-600 dark:text-zinc-300">{HORIZON_LABELS[r.horizon]}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => setModal(r)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
                                                <PencilIcon className="size-3.5 text-gray-400" />
                                            </button>
                                            <button onClick={() => del(r)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                                                <TrashIcon className="size-3.5 text-gray-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </TablePanel>

            {modal && (
                <InitiativeEditor target={modal} workspaceId={workspaceId} lanes={lanes}
                    members={members} onSaved={load} onClose={() => setModal(null)} />
            )}
        </>
    );
}

// ─── Lanes tab ───────────────────────────────────────────────────────────────
function Lanes({ workspaceId, lanes, refreshLanes }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState(LANE_COLORS[0]);
    const [saving, setSaving] = useState(false);

    const add = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        const { error } = await supabase.from("roadmap_lanes").insert({
            workspace_id: workspaceId,
            name: name.trim(),
            color,
            sort_order: lanes.length,
        });
        setSaving(false);
        if (error) return toast.error(error.message);
        setName("");
        refreshLanes();
    };

    const del = async (lane) => {
        if (!confirm(`Delete lane "${lane.name}"? Initiatives in it keep existing without a lane.`)) return;
        const { error } = await supabase.from("roadmap_lanes").delete().eq("id", lane.id);
        if (error) return toast.error(error.message);
        refreshLanes();
    };

    const rename = async (lane) => {
        const next = prompt("Lane name", lane.name);
        if (!next?.trim() || next.trim() === lane.name) return;
        const { error } = await supabase.from("roadmap_lanes").update({ name: next.trim() }).eq("id", lane.id);
        if (error) return toast.error(error.message);
        refreshLanes();
    };

    return (
        <div className="max-w-xl">
            <TablePanel
                toolbar={
                    <form onSubmit={add} className="flex items-center gap-2 flex-1">
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="New lane, e.g. Partnerships, Outbound, Market entry…"
                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                        <div className="flex gap-1">
                            {LANE_COLORS.map((c) => (
                                <button key={c} type="button" onClick={() => setColor(c)}
                                    className={`size-5 rounded-full transition ${color === c ? "ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-zinc-900" : ""}`}
                                    style={{ background: c }} />
                            ))}
                        </div>
                        <button disabled={saving || !name.trim()} className="flex items-center gap-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-medium px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-40">
                            <PlusIcon className="size-3.5" /> Add
                        </button>
                    </form>
                }
            >
                {lanes.length === 0 ? (
                    <div className="py-12 text-center">
                        <Rows3Icon className="size-8 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 dark:text-zinc-400">No lanes yet. Lanes group initiatives on the roadmap — by motion, vertical, or owner.</p>
                    </div>
                ) : (
                    <ul>
                        {lanes.map((l) => (
                            <li key={l.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-zinc-800/60 last:border-0">
                                <GripVerticalIcon className="size-4 text-gray-300 dark:text-zinc-700" />
                                <span className="size-2.5 rounded-full" style={{ background: l.color }} />
                                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-zinc-200">{l.name}</span>
                                <button onClick={() => rename(l)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
                                    <PencilIcon className="size-3.5 text-gray-400" />
                                </button>
                                <button onClick={() => del(l)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition">
                                    <TrashIcon className="size-3.5 text-gray-400 hover:text-red-500" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </TablePanel>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function XPlan() {
    const [activeTab, setActiveTab] = useState("Timeline");
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace);
    const [lanes, setLanes] = useState([]);
    const [members, setMembers] = useState([]);

    const workspaceId = currentWorkspace?.id;

    const refreshLanes = useCallback(async () => {
        if (!workspaceId) return;
        const { data } = await supabase.from("roadmap_lanes").select("*").eq("workspace_id", workspaceId).order("sort_order");
        setLanes(data || []);
    }, [workspaceId]);

    useEffect(() => {
        if (!workspaceId) return;
        refreshLanes();
        supabase
            .from("workspace_members")
            .select("user:profiles(id, full_name, email)")
            .eq("workspace_id", workspaceId)
            .then(({ data }) => setMembers((data || []).map((m) => m.user).filter(Boolean)));
    }, [workspaceId, refreshLanes]);

    if (!currentWorkspace) return null;

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-5 sm:gap-6 pb-12">
            <div className="border-b border-gray-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
                <div className="flex gap-4 sm:gap-6 min-w-max">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 text-[14px] sm:text-[15px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                                activeTab === tab
                                    ? "border-gray-900 dark:border-white text-gray-900 dark:text-white"
                                    : "border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === "Timeline" && (
                <Timeline workspaceId={workspaceId} lanes={lanes} members={members} />
            )}
            {activeTab === "Board" && (
                <Board workspaceId={workspaceId} lanes={lanes} members={members} />
            )}
            {activeTab === "Initiatives" && (
                <Initiatives workspaceId={workspaceId} lanes={lanes} members={members} refreshLanes={refreshLanes} />
            )}
            {activeTab === "Lanes" && (
                <Lanes workspaceId={workspaceId} lanes={lanes} refreshLanes={refreshLanes} />
            )}
        </div>
    );
}
