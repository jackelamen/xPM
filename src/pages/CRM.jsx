import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import {
    PlusIcon, UserIcon, BuildingIcon, TrendingUpIcon,
    XIcon, Loader2Icon, PencilIcon, TrashIcon, ExternalLinkIcon
} from "lucide-react";
import toast from "react-hot-toast";

const TABS = ["Contacts", "Companies", "Deals"];

const inputCls = "w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1";
const labelCls = "text-sm text-zinc-600 dark:text-zinc-400";

// ─── Contacts ────────────────────────────────────────────────────────────────
function Contacts({ workspaceId }) {
    const { user } = useAuth();
    const [contacts, setContacts] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "", title: "", company_id: "", notes: "" });
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchAll() }, [workspaceId]);

    const fetchAll = async () => {
        setLoading(true);
        const [{ data: c }, { data: co }] = await Promise.all([
            supabase.from("contacts").select("*, company:companies(id, name)").eq("workspace_id", workspaceId).order("name"),
            supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).order("name"),
        ]);
        setContacts(c || []);
        setCompanies(co || []);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase.from("contacts").insert({
                workspace_id: workspaceId,
                owner_id: user.id,
                name: form.name,
                email: form.email || null,
                phone: form.phone || null,
                title: form.title || null,
                company_id: form.company_id || null,
                notes: form.notes || null,
            });
            if (error) throw error;
            toast.success("Contact created");
            setForm({ name: "", email: "", phone: "", title: "", company_id: "", notes: "" });
            setShowForm(false);
            fetchAll();
        } catch (err) {
            toast.error(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this contact?")) return;
        await supabase.from("contacts").delete().eq("id", id);
        setContacts((prev) => prev.filter((c) => c.id !== id));
        toast.success("Contact deleted");
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">
                    <PlusIcon className="size-4" /> New Contact
                </button>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-zinc-900 dark:text-white">New Contact</h2>
                            <button onClick={() => setShowForm(false)}><XIcon className="size-4 text-zinc-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-3">
                            <div><label className={labelCls}>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></div>
                                <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} /></div>
                                <div>
                                    <label className={labelCls}>Company</label>
                                    <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className={inputCls}>
                                        <option value="">None</option>
                                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + " h-16 resize-none"} /></div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Cancel</button>
                                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60">
                                    {saving && <Loader2Icon className="size-3.5 animate-spin" />} Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {contacts.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
                    <UserIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No contacts yet</p>
                </div>
            ) : (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                            <tr>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Title</th>
                                <th className="px-4 py-3 text-left">Company</th>
                                <th className="px-4 py-3 text-left">Email</th>
                                <th className="px-4 py-3 text-left">Phone</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {contacts.map((c) => (
                                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{c.name}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.title || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.company?.name || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.email || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.phone || "—"}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleDelete(c.id)} className="text-zinc-400 hover:text-red-500 transition">
                                            <TrashIcon className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Companies ────────────────────────────────────────────────────────────────
function Companies({ workspaceId }) {
    const { user } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", website: "", industry: "", notes: "" });
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchCompanies() }, [workspaceId]);

    const fetchCompanies = async () => {
        setLoading(true);
        const { data } = await supabase.from("companies").select("*").eq("workspace_id", workspaceId).order("name");
        setCompanies(data || []);
        setLoading(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase.from("companies").insert({
                workspace_id: workspaceId,
                owner_id: user.id,
                name: form.name,
                website: form.website || null,
                industry: form.industry || null,
                notes: form.notes || null,
            });
            if (error) throw error;
            toast.success("Company created");
            setForm({ name: "", website: "", industry: "", notes: "" });
            setShowForm(false);
            fetchCompanies();
        } catch (err) {
            toast.error(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this company?")) return;
        await supabase.from("companies").delete().eq("id", id);
        setCompanies((prev) => prev.filter((c) => c.id !== id));
        toast.success("Company deleted");
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">
                    <PlusIcon className="size-4" /> New Company
                </button>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-zinc-900 dark:text-white">New Company</h2>
                            <button onClick={() => setShowForm(false)}><XIcon className="size-4 text-zinc-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-3">
                            <div><label className={labelCls}>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelCls}>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} placeholder="https://" /></div>
                                <div><label className={labelCls}>Industry</label><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputCls} /></div>
                            </div>
                            <div><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + " h-16 resize-none"} /></div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Cancel</button>
                                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60">
                                    {saving && <Loader2Icon className="size-3.5 animate-spin" />} Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {companies.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
                    <BuildingIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No companies yet</p>
                </div>
            ) : (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                            <tr>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Industry</th>
                                <th className="px-4 py-3 text-left">Website</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {companies.map((c) => (
                                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">{c.name}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.industry || "—"}</td>
                                    <td className="px-4 py-3">
                                        {c.website ? (
                                            <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                                                {c.website.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3" />
                                            </a>
                                        ) : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleDelete(c.id)} className="text-zinc-400 hover:text-red-500 transition">
                                            <TrashIcon className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Deals ────────────────────────────────────────────────────────────────────
function Deals({ workspaceId }) {
    const { user } = useAuth();
    const [pipelines, setPipelines] = useState([]);
    const [activePipeline, setActivePipeline] = useState(null);
    const [stages, setStages] = useState([]);
    const [deals, setDeals] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDealForm, setShowDealForm] = useState(false);
    const [showPipelineForm, setShowPipelineForm] = useState(false);
    const [dealForm, setDealForm] = useState({ name: "", stage_id: "", contact_id: "", company_id: "", value: "", expected_close_date: "" });
    const [pipelineName, setPipelineName] = useState("");
    const [saving, setSaving] = useState(false);
    const [draggingDeal, setDraggingDeal] = useState(null);

    useEffect(() => { fetchAll() }, [workspaceId]);

    const fetchAll = async () => {
        setLoading(true);
        const [{ data: p }, { data: c }, { data: co }] = await Promise.all([
            supabase.from("pipelines").select("*, stages:pipeline_stages(*)").eq("workspace_id", workspaceId).order("created_at"),
            supabase.from("contacts").select("id, name").eq("workspace_id", workspaceId).order("name"),
            supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).order("name"),
        ]);
        setPipelines(p || []);
        setContacts(c || []);
        setCompanies(co || []);
        if (p && p.length > 0) {
            const pipe = p[0];
            setActivePipeline(pipe);
            setStages((pipe.stages || []).sort((a, b) => a.position - b.position));
            fetchDeals(pipe.id);
        } else {
            setLoading(false);
        }
    };

    const fetchDeals = async (pipelineId) => {
        const { data } = await supabase
            .from("deals")
            .select("*, contact:contacts(id, name), company:companies(id, name)")
            .eq("pipeline_id", pipelineId)
            .order("created_at");
        setDeals(data || []);
        setLoading(false);
    };

    const handleCreatePipeline = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data: pipe, error } = await supabase.from("pipelines").insert({ workspace_id: workspaceId, name: pipelineName }).select().single();
            if (error) throw error;
            // Default stages
            await supabase.from("pipeline_stages").insert([
                { pipeline_id: pipe.id, name: "Lead", position: 0, color: "#6366f1" },
                { pipeline_id: pipe.id, name: "Qualified", position: 1, color: "#3b82f6" },
                { pipeline_id: pipe.id, name: "Proposal", position: 2, color: "#f59e0b" },
                { pipeline_id: pipe.id, name: "Negotiation", position: 3, color: "#f97316" },
                { pipeline_id: pipe.id, name: "Closed Won", position: 4, color: "#10b981" },
                { pipeline_id: pipe.id, name: "Closed Lost", position: 5, color: "#ef4444" },
            ]);
            toast.success("Pipeline created");
            setPipelineName("");
            setShowPipelineForm(false);
            fetchAll();
        } catch (err) {
            toast.error(err.message || "Failed to create pipeline");
        } finally {
            setSaving(false);
        }
    };

    const handleCreateDeal = async (e) => {
        e.preventDefault();
        if (!activePipeline) return;
        setSaving(true);
        try {
            const { error } = await supabase.from("deals").insert({
                workspace_id: workspaceId,
                pipeline_id: activePipeline.id,
                stage_id: dealForm.stage_id || stages[0]?.id,
                owner_id: user.id,
                name: dealForm.name,
                contact_id: dealForm.contact_id || null,
                company_id: dealForm.company_id || null,
                value: dealForm.value ? parseFloat(dealForm.value) : null,
                expected_close_date: dealForm.expected_close_date || null,
            });
            if (error) throw error;
            toast.success("Deal created");
            setDealForm({ name: "", stage_id: "", contact_id: "", company_id: "", value: "", expected_close_date: "" });
            setShowDealForm(false);
            fetchDeals(activePipeline.id);
        } catch (err) {
            toast.error(err.message || "Failed to create deal");
        } finally {
            setSaving(false);
        }
    };

    const handleMoveDeal = async (dealId, newStageId) => {
        await supabase.from("deals").update({ stage_id: newStageId }).eq("id", dealId);
        setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage_id: newStageId } : d));
    };

    const handleDeleteDeal = async (id) => {
        if (!window.confirm("Delete this deal?")) return;
        await supabase.from("deals").delete().eq("id", id);
        setDeals((prev) => prev.filter((d) => d.id !== id));
        toast.success("Deal deleted");
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;

    if (pipelines.length === 0) return (
        <div className="text-center py-16">
            <TrendingUpIcon className="size-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">No pipelines yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Create a pipeline to start tracking deals</p>
            {showPipelineForm ? (
                <form onSubmit={handleCreatePipeline} className="flex gap-2 max-w-xs mx-auto">
                    <input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="Pipeline name" className="flex-1 px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" required autoFocus />
                    <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded bg-blue-500 text-white disabled:opacity-60">Create</button>
                </form>
            ) : (
                <button onClick={() => setShowPipelineForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white mx-auto hover:opacity-90 transition">
                    <PlusIcon className="size-4" /> Create Pipeline
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    {pipelines.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => { setActivePipeline(p); setStages((p.stages || []).sort((a, b) => a.position - b.position)); fetchDeals(p.id); }}
                            className={`px-3 py-1.5 text-sm rounded border transition ${activePipeline?.id === p.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowDealForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">
                    <PlusIcon className="size-4" /> New Deal
                </button>
            </div>

            {/* Deal form modal */}
            {showDealForm && (
                <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-zinc-900 dark:text-white">New Deal</h2>
                            <button onClick={() => setShowDealForm(false)}><XIcon className="size-4 text-zinc-400" /></button>
                        </div>
                        <form onSubmit={handleCreateDeal} className="space-y-3">
                            <div><label className={labelCls}>Deal Name *</label><input value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} className={inputCls} required /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Stage</label>
                                    <select value={dealForm.stage_id} onChange={(e) => setDealForm({ ...dealForm, stage_id: e.target.value })} className={inputCls}>
                                        {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div><label className={labelCls}>Value ($)</label><input type="number" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} className={inputCls} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls}>Contact</label>
                                    <select value={dealForm.contact_id} onChange={(e) => setDealForm({ ...dealForm, contact_id: e.target.value })} className={inputCls}>
                                        <option value="">None</option>
                                        {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Company</label>
                                    <select value={dealForm.company_id} onChange={(e) => setDealForm({ ...dealForm, company_id: e.target.value })} className={inputCls}>
                                        <option value="">None</option>
                                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div><label className={labelCls}>Expected Close</label><input type="date" value={dealForm.expected_close_date} onChange={(e) => setDealForm({ ...dealForm, expected_close_date: e.target.value })} className={inputCls} /></div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setShowDealForm(false)} className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">Cancel</button>
                                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60">
                                    {saving && <Loader2Icon className="size-3.5 animate-spin" />} Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Kanban board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => {
                    const stageDeals = deals.filter((d) => d.stage_id === stage.id);
                    const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                    return (
                        <div
                            key={stage.id}
                            className="flex-shrink-0 w-64"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => draggingDeal && handleMoveDeal(draggingDeal, stage.id)}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className="size-2 rounded-full" style={{ backgroundColor: stage.color || "#6366f1" }} />
                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{stage.name}</span>
                                <span className="ml-auto text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
                            </div>
                            {total > 0 && (
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">${total.toLocaleString()}</p>
                            )}
                            <div className="space-y-2 min-h-16 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-2">
                                {stageDeals.map((deal) => (
                                    <div
                                        key={deal.id}
                                        draggable
                                        onDragStart={() => setDraggingDeal(deal.id)}
                                        onDragEnd={() => setDraggingDeal(null)}
                                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-zinc-300 dark:hover:border-zinc-600 transition group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-snug">{deal.name}</p>
                                            <button onClick={() => handleDeleteDeal(deal.id)} className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition flex-shrink-0">
                                                <XIcon className="size-3.5" />
                                            </button>
                                        </div>
                                        {deal.value && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">${deal.value.toLocaleString()}</p>}
                                        {(deal.company?.name || deal.contact?.name) && (
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                                {deal.company?.name || deal.contact?.name}
                                            </p>
                                        )}
                                    </div>
                                ))}
                                {stageDeals.length === 0 && (
                                    <div className="flex items-center justify-center h-12 text-xs text-zinc-400 dark:text-zinc-600">Drop here</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────
export default function CRM() {
    const [activeTab, setActiveTab] = useState("Contacts");
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace);

    if (!currentWorkspace) return null;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">CRM</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your contacts, companies, and deals</p>
            </div>

            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {TABS.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${activeTab === tab ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === "Contacts" && <Contacts workspaceId={currentWorkspace.id} />}
            {activeTab === "Companies" && <Companies workspaceId={currentWorkspace.id} />}
            {activeTab === "Deals" && <Deals workspaceId={currentWorkspace.id} />}
        </div>
    );
}
