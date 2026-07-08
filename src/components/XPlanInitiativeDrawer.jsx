import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
    XIcon, PlusIcon, TrashIcon, Loader2Icon, HandshakeIcon,
    LayersIcon, TargetIcon, FlagIcon, Rows3Icon, UploadCloudIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500";
const miniInputCls = "px-2 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-400";
const labelCls = "text-xs font-medium text-gray-500 dark:text-zinc-400";

const PHASE_STATUSES = ["upcoming", "active", "done"];

// Same green/amber/red semantics as xPortal's lib/kpi.js, so the preview here
// matches what the client will see.
function kpiHealth(kpi) {
    if (kpi.kind === "boolean") {
        if (kpi.current_value == null) return { tone: "none", progress: null };
        return { tone: Number(kpi.current_value) ? "good" : "off", progress: null };
    }
    const current = kpi.current_value == null ? null : Number(kpi.current_value);
    const target = kpi.target_value == null ? null : Number(kpi.target_value);
    if (current == null || target == null) return { tone: "none", progress: null };
    const down = kpi.direction === "down";
    const met = down ? current <= target : current >= target;
    if (met) return { tone: "good", progress: 1 };
    const ratio = down ? (current > 0 ? target / current : 0) : (target > 0 ? current / target : 0);
    const progress = Math.max(0, Math.min(1, ratio));
    return { tone: progress >= 0.85 ? "close" : "off", progress };
}

const TONE_STYLES = {
    good:  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    close: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    off:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    none:  "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function Section({ icon, title, hint, action, children }) {
    const Icon = icon;
    return (
        <section>
            <div className="flex items-center gap-2 mb-2.5">
                <Icon className="size-4 text-gray-400 dark:text-zinc-500" />
                <h3 className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200">{title}</h3>
                {hint && <span className="text-[11px] text-gray-400 dark:text-zinc-500">{hint}</span>}
                <div className="ml-auto">{action}</div>
            </div>
            {children}
        </section>
    );
}

// ─── Plan Builder rows ────────────────────────────────────────────────────────
function PhaseRow({ row, onChange, onDelete }) {
    return (
        <div className="flex items-center gap-2">
            <input className={`${miniInputCls} flex-1`} value={row.title} placeholder="Phase title"
                onChange={(e) => onChange({ ...row, title: e.target.value })} />
            <input type="date" className={miniInputCls} value={row.starts_on || ""}
                onChange={(e) => onChange({ ...row, starts_on: e.target.value || null })} />
            <input type="date" className={miniInputCls} value={row.ends_on || ""}
                onChange={(e) => onChange({ ...row, ends_on: e.target.value || null })} />
            <select className={miniInputCls} value={row.status}
                onChange={(e) => onChange({ ...row, status: e.target.value })}>
                {PHASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition flex-shrink-0">
                <TrashIcon className="size-3.5 text-gray-400 hover:text-red-500" />
            </button>
        </div>
    );
}

function MilestoneRow({ row, onChange, onDelete }) {
    return (
        <div className="flex items-center gap-2">
            <input className={`${miniInputCls} flex-1`} value={row.title} placeholder="Milestone title"
                onChange={(e) => onChange({ ...row, title: e.target.value })} />
            <input type="date" className={miniInputCls} value={row.starts_on || ""}
                onChange={(e) => onChange({ ...row, starts_on: e.target.value || null })} />
            <select className={miniInputCls} value={row.status}
                onChange={(e) => onChange({ ...row, status: e.target.value })}>
                {PHASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition flex-shrink-0">
                <TrashIcon className="size-3.5 text-gray-400 hover:text-red-500" />
            </button>
        </div>
    );
}

function KpiRow({ row, onChange, onDelete }) {
    const health = kpiHealth(row);
    return (
        <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 w-12 text-center ${TONE_STYLES[health.tone]}`}>
                {health.tone === "none" ? "—" : health.tone === "good" ? "on" : health.tone === "close" ? "near" : "off"}
            </span>
            <input className={`${miniInputCls} flex-1`} value={row.name} placeholder="KPI name"
                onChange={(e) => onChange({ ...row, name: e.target.value })} />
            <select className={miniInputCls} value={row.kind}
                onChange={(e) => onChange({ ...row, kind: e.target.value, ...(e.target.value === "boolean" ? { target_value: null, unit: null } : {}) })}>
                <option value="numeric">numeric</option>
                <option value="boolean">yes/no</option>
            </select>
            {row.kind === "numeric" ? (
                <>
                    <input type="number" className={`${miniInputCls} w-20`} value={row.target_value ?? ""} placeholder="Target"
                        onChange={(e) => onChange({ ...row, target_value: e.target.value === "" ? null : e.target.value })} />
                    <input className={`${miniInputCls} w-16`} value={row.unit || ""} placeholder="Unit"
                        onChange={(e) => onChange({ ...row, unit: e.target.value || null })} />
                    <select className={miniInputCls} value={row.direction}
                        onChange={(e) => onChange({ ...row, direction: e.target.value })}>
                        <option value="up">↑ up</option>
                        <option value="down">↓ down</option>
                    </select>
                </>
            ) : (
                <select className={miniInputCls} value={row.current_value ?? ""}
                    onChange={(e) => onChange({ ...row, current_value: e.target.value === "" ? null : Number(e.target.value) })}>
                    <option value="">Pending</option>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                </select>
            )}
            <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition flex-shrink-0">
                <TrashIcon className="size-3.5 text-gray-400 hover:text-red-500" />
            </button>
        </div>
    );
}

// ─── Generic child-table list managed against Supabase ───────────────────────
function usePlanList(table, initiativeId) {
    const [rows, setRows] = useState(null);

    useEffect(() => {
        let on = true;
        supabase.from(table).select("*").eq("initiative_id", initiativeId).order("sort_order")
            .then(({ data, error }) => {
                if (!on) return;
                if (error) toast.error(error.message);
                setRows(data || []);
            });
        return () => { on = false; };
    }, [table, initiativeId]);

    const add = async (defaults) => {
        const { data, error } = await supabase.from(table)
            .insert({ initiative_id: initiativeId, sort_order: rows?.length || 0, ...defaults })
            .select().single();
        if (error) return toast.error(error.message);
        setRows((prev) => [...(prev || []), data]);
    };

    // Debounced-ish persistence: update local immediately, save on blur is
    // overkill for these small lists — persist on every change but keep the
    // response out of the render path.
    const update = (next) => {
        setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
        supabase.from(table).update(next).eq("id", next.id).then(({ error }) => {
            if (error) toast.error(error.message);
        });
    };

    const remove = async (id) => {
        setRows((prev) => prev.filter((r) => r.id !== id));
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) toast.error(error.message);
    };

    return { rows, add, update, remove };
}

// ─── Drawer ───────────────────────────────────────────────────────────────────
export default function XPlanInitiativeDrawer({ initiative, workspaceId, lanes, members, onClose, onChanged }) {
    const [form, setForm] = useState(null);
    const [deals, setDeals] = useState([]);
    const [spaces, setSpaces] = useState([]);
    const [saving, setSaving] = useState(false);
    const [pushing, setPushing] = useState(false);
    const [lastPushedAt, setLastPushedAt] = useState(initiative.last_pushed_at);

    const phases = usePlanList("xplan_phases", initiative.id);
    const milestones = usePlanList("xplan_milestones", initiative.id);
    const kpis = usePlanList("xplan_kpis", initiative.id);

    useEffect(() => {
        setForm({
            title: initiative.title || "",
            description: initiative.description || "",
            lane_id: initiative.lane_id || "",
            owner_id: initiative.owner_id || "",
            start_date: initiative.start_date || "",
            end_date: initiative.end_date || "",
            horizon: initiative.horizon,
            status: initiative.status,
            deal_id: initiative.deal_id || "",
            space_id: initiative.space_id || "",
        });
    }, [initiative]);

    useEffect(() => {
        supabase.from("deals")
            .select("id, name, value, stage:pipeline_stages(name), company:companies(name)")
            .eq("workspace_id", workspaceId).order("created_at", { ascending: false })
            .then(({ data }) => setDeals(data || []));
        supabase.from("spaces")
            .select("id, name, color")
            .eq("workspace_id", workspaceId).order("name")
            .then(({ data }) => setSpaces(data || []));
    }, [workspaceId]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const save = async () => {
        if (!form.title.trim()) return toast.error("Title is required");
        setSaving(true);
        const { error } = await supabase.from("roadmap_initiatives").update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            lane_id: form.lane_id || null,
            owner_id: form.owner_id || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            horizon: form.horizon,
            status: form.status,
            deal_id: form.deal_id || null,
            space_id: form.space_id || null,
            updated_at: new Date().toISOString(),
        }).eq("id", initiative.id);
        setSaving(false);
        if (error) return toast.error(error.message);
        toast.success("Initiative saved");
        onChanged?.();
    };

    // Manual push (initial and re-push alike): save first so xPortal gets what's
    // on screen, then invoke the edge function that holds the bridge secret.
    const push = async () => {
        if (!form.space_id) return toast.error("Link a Space first — xPortal needs a client to attach the plan to.");
        setPushing(true);
        await save();
        const { data, error } = await supabase.functions.invoke("push-to-xportal", {
            body: { initiative_id: initiative.id },
        });
        setPushing(false);
        if (error) {
            let msg = error.message;
            try { msg = JSON.parse(await error.context?.text())?.error || msg; } catch { /* keep default */ }
            return toast.error(`Push failed: ${msg}`);
        }
        if (data?.error) return toast.error(`Push failed: ${data.error}`);
        setLastPushedAt(new Date().toISOString());
        toast.success("Plan pushed to xPortal");
        onChanged?.();
    };

    if (!form) return null;
    const linkedDeal = deals.find((d) => d.id === form.deal_id);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl h-full bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                    <div>
                        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Initiative</h2>
                        {lastPushedAt && (
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                                Last pushed to xPortal {format(new Date(lastPushedAt), "MMM d, yyyy h:mm a")}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
                        <XIcon className="size-4 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">
                    {/* Core details */}
                    <div className="flex flex-col gap-3.5">
                        <div>
                            <label className={labelCls}>Title</label>
                            <input className={`${inputCls} mt-1`} value={form.title} onChange={set("title")} />
                        </div>
                        <div>
                            <label className={labelCls}>Description</label>
                            <textarea className={`${inputCls} mt-1`} rows={2} value={form.description} onChange={set("description")} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className={labelCls}>Lane</label>
                                <select className={`${inputCls} mt-1`} value={form.lane_id} onChange={set("lane_id")}>
                                    <option value="">No lane</option>
                                    {lanes.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Owner</label>
                                <select className={`${inputCls} mt-1`} value={form.owner_id} onChange={set("owner_id")}>
                                    <option value="">Unassigned</option>
                                    {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Status</label>
                                <select className={`${inputCls} mt-1`} value={form.status} onChange={set("status")}>
                                    {["planned", "active", "at-risk", "done", "dropped"].map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Start date</label>
                                <input type="date" className={`${inputCls} mt-1`} value={form.start_date} onChange={set("start_date")} />
                            </div>
                            <div>
                                <label className={labelCls}>End date</label>
                                <input type="date" className={`${inputCls} mt-1`} value={form.end_date} onChange={set("end_date")} />
                            </div>
                            <div>
                                <label className={labelCls}>Horizon</label>
                                <select className={`${inputCls} mt-1`} value={form.horizon} onChange={set("horizon")}>
                                    <option value="now">Now</option>
                                    <option value="next">Next</option>
                                    <option value="later">Later</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Links */}
                    <Section icon={HandshakeIcon} title="CRM deal" hint="manual link">
                        <select className={inputCls} value={form.deal_id} onChange={set("deal_id")}>
                            <option value="">Not linked</option>
                            {deals.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}{d.company?.name ? ` — ${d.company.name}` : ""}{d.stage?.name ? ` (${d.stage.name})` : ""}
                                </option>
                            ))}
                        </select>
                        {linkedDeal?.value != null && (
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1.5">
                                Deal value: {Number(linkedDeal.value).toLocaleString()}
                            </p>
                        )}
                    </Section>

                    <Section icon={LayersIcon} title="Space" hint="link once the pursuit is won">
                        <select className={inputCls} value={form.space_id} onChange={set("space_id")}>
                            <option value="">Not linked</option>
                            {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </Section>

                    {/* Plan Builder */}
                    <div className="border-t border-gray-100 dark:border-zinc-800 pt-5 flex flex-col gap-6">
                        <div>
                            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">Client plan</h3>
                            <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                                What gets pushed to xPortal: the phases, milestones and KPIs the client will see.
                            </p>
                        </div>

                        <Section icon={Rows3Icon} title="Phases" hint="rendered as the project timeline"
                            action={
                                <button onClick={() => phases.add({ title: "New phase" })}
                                    className="flex items-center gap-1 text-[12px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition">
                                    <PlusIcon className="size-3.5" /> Add
                                </button>
                            }>
                            <div className="flex flex-col gap-2">
                                {phases.rows === null ? <Loader2Icon className="size-4 animate-spin text-gray-400" />
                                    : phases.rows.length === 0
                                        ? <p className="text-[12px] text-gray-400 dark:text-zinc-500">No phases yet. Phase order = list order.</p>
                                        : phases.rows.map((r) => (
                                            <PhaseRow key={r.id} row={r} onChange={phases.update} onDelete={() => phases.remove(r.id)} />
                                        ))}
                            </div>
                        </Section>

                        <Section icon={FlagIcon} title="Milestones" hint="point-in-time markers"
                            action={
                                <button onClick={() => milestones.add({ title: "New milestone" })}
                                    className="flex items-center gap-1 text-[12px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition">
                                    <PlusIcon className="size-3.5" /> Add
                                </button>
                            }>
                            <div className="flex flex-col gap-2">
                                {milestones.rows === null ? <Loader2Icon className="size-4 animate-spin text-gray-400" />
                                    : milestones.rows.length === 0
                                        ? <p className="text-[12px] text-gray-400 dark:text-zinc-500">No milestones yet.</p>
                                        : milestones.rows.map((r) => (
                                            <MilestoneRow key={r.id} row={r} onChange={milestones.update} onDelete={() => milestones.remove(r.id)} />
                                        ))}
                            </div>
                        </Section>

                        <Section icon={TargetIcon} title="KPIs" hint="targets the engagement is measured on"
                            action={
                                <button onClick={() => kpis.add({ name: "New KPI" })}
                                    className="flex items-center gap-1 text-[12px] font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition">
                                    <PlusIcon className="size-3.5" /> Add
                                </button>
                            }>
                            <div className="flex flex-col gap-2">
                                {kpis.rows === null ? <Loader2Icon className="size-4 animate-spin text-gray-400" />
                                    : kpis.rows.length === 0
                                        ? <p className="text-[12px] text-gray-400 dark:text-zinc-500">No KPIs yet. Health chips match xPortal's green/amber/red.</p>
                                        : kpis.rows.map((r) => (
                                            <KpiRow key={r.id} row={r} onChange={kpis.update} onDelete={() => kpis.remove(r.id)} />
                                        ))}
                            </div>
                        </Section>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex-shrink-0">
                    <button onClick={save} disabled={saving}
                        className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg px-4 py-2 hover:opacity-90 transition disabled:opacity-50">
                        {saving && <Loader2Icon className="size-4 animate-spin" />}
                        Save changes
                    </button>
                    <button onClick={push} disabled={pushing || saving}
                        title={form.space_id ? "Send this plan to the client's xPortal" : "Link a Space first"}
                        className="ml-auto flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition disabled:opacity-50">
                        {pushing ? <Loader2Icon className="size-4 animate-spin" /> : <UploadCloudIcon className="size-4" />}
                        {pushing ? "Pushing…" : lastPushedAt ? "Re-push to xPortal" : "Push to xPortal"}
                    </button>
                </div>
            </div>
        </div>
    );
}
