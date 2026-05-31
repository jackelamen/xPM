import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import {
    PlusIcon, UserIcon, BuildingIcon, TrendingUpIcon,
    XIcon, Loader2Icon, TrashIcon, ExternalLinkIcon,
    SearchIcon, PencilIcon, CheckIcon, SettingsIcon,
    LayoutDashboardIcon, AlertCircleIcon, ClockIcon,
    ChevronRightIcon, DollarSignIcon
} from "lucide-react";
import toast from "react-hot-toast";
import { ContactDetail, CompanyDetail, DealDetail } from "../components/CRMDetailPanel";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

const TABS = ["Contacts", "Companies", "Deals", "Dashboard"];

const inputCls = "w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1";
const labelCls = "text-sm text-zinc-600 dark:text-zinc-400";

// ─── Contacts ────────────────────────────────────────────────────────────────
function Contacts({ workspaceId }) {
    const { user } = useAuth();
    const [contacts, setContacts] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ name: "", email: "", phone: "", title: "", company_id: "", notes: "" });
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [filterCompany, setFilterCompany] = useState("");

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

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this contact?")) return;
        await supabase.from("contacts").delete().eq("id", id);
        setContacts((prev) => prev.filter((c) => c.id !== id));
        toast.success("Contact deleted");
    };

    const filtered = useMemo(() => {
        return contacts.filter(c => {
            const matchQ = !query || c.name.toLowerCase().includes(query.toLowerCase()) || (c.email && c.email.toLowerCase().includes(query.toLowerCase()));
            const matchCo = !filterCompany || c.company_id === filterCompany;
            return matchQ && matchCo;
        });
    }, [contacts, query, filterCompany]);

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search contacts..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    className="text-sm px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="">All Companies</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition whitespace-nowrap">
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
                            <div><label className={labelCls}>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required autoFocus /></div>
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

            {filtered.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
                    <UserIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{query || filterCompany ? "No contacts match your filters" : "No contacts yet"}</p>
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
                            {filtered.map((c) => (
                                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="size-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                {c.name[0].toUpperCase()}
                                            </div>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.title || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.company?.name || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.email || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.phone || "—"}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={(e) => handleDelete(c.id, e)} className="text-zinc-400 hover:text-red-500 transition">
                                            <TrashIcon className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
                        {filtered.length} of {contacts.length} contacts
                    </div>
                </div>
            )}

            {selectedId && (
                <ContactDetail
                    id={selectedId}
                    workspaceId={workspaceId}
                    onClose={() => setSelectedId(null)}
                    onDeleted={() => { setContacts((prev) => prev.filter((c) => c.id !== selectedId)); setSelectedId(null); }}
                />
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
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ name: "", website: "", industry: "", notes: "" });
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [filterIndustry, setFilterIndustry] = useState("");

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

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this company?")) return;
        await supabase.from("companies").delete().eq("id", id);
        setCompanies((prev) => prev.filter((c) => c.id !== id));
        toast.success("Company deleted");
    };

    const industries = useMemo(() => [...new Set(companies.map(c => c.industry).filter(Boolean))].sort(), [companies]);

    const filtered = useMemo(() => companies.filter(c => {
        const matchQ = !query || c.name.toLowerCase().includes(query.toLowerCase());
        const matchI = !filterIndustry || c.industry === filterIndustry;
        return matchQ && matchI;
    }), [companies, query, filterIndustry]);

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search companies..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                {industries.length > 0 && (
                    <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}
                        className="text-sm px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">All Industries</option>
                        {industries.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                )}
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition whitespace-nowrap">
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
                            <div><label className={labelCls}>Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required autoFocus /></div>
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

            {filtered.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
                    <BuildingIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{query || filterIndustry ? "No companies match your filters" : "No companies yet"}</p>
                </div>
            ) : (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                            <tr>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Industry</th>
                                <th className="px-4 py-3 text-left">Size</th>
                                <th className="px-4 py-3 text-left">Website</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {filtered.map((c) => (
                                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition cursor-pointer">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="size-7 rounded bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                {c.name[0].toUpperCase()}
                                            </div>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.industry || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{c.size || "—"}</td>
                                    <td className="px-4 py-3">
                                        {c.website ? (
                                            <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-blue-500 hover:underline text-sm">
                                                {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLinkIcon className="size-3" />
                                            </a>
                                        ) : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={(e) => handleDelete(c.id, e)} className="text-zinc-400 hover:text-red-500 transition">
                                            <TrashIcon className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
                        {filtered.length} of {companies.length} companies
                    </div>
                </div>
            )}

            {selectedId && (
                <CompanyDetail
                    id={selectedId}
                    workspaceId={workspaceId}
                    onClose={() => setSelectedId(null)}
                    onDeleted={() => { setCompanies((prev) => prev.filter((c) => c.id !== selectedId)); setSelectedId(null); }}
                />
            )}
        </div>
    );
}

// ─── Pipeline Stage Manager ───────────────────────────────────────────────────
function StageManager({ pipeline, onClose, onSaved }) {
    const [stages, setStages] = useState([...(pipeline.stages || [])].sort((a, b) => a.position - b.position));
    const [newStageName, setNewStageName] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState("");
    const [saving, setSaving] = useState(false);

    const STAGE_COLORS = ["#6366f1", "#3b82f6", "#f59e0b", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

    const handleAdd = async () => {
        if (!newStageName.trim()) return;
        setSaving(true);
        const color = STAGE_COLORS[stages.length % STAGE_COLORS.length];
        const { data, error } = await supabase.from("pipeline_stages")
            .insert({ pipeline_id: pipeline.id, name: newStageName.trim(), position: stages.length, color })
            .select().single();
        if (!error && data) {
            setStages(prev => [...prev, data]);
            setNewStageName("");
        }
        setSaving(false);
    };

    const handleRename = async (id) => {
        if (!editingName.trim()) { setEditingId(null); return; }
        await supabase.from("pipeline_stages").update({ name: editingName.trim() }).eq("id", id);
        setStages(prev => prev.map(s => s.id === id ? { ...s, name: editingName.trim() } : s));
        setEditingId(null);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this stage? Deals in this stage will also be deleted.")) return;
        await supabase.from("pipeline_stages").delete().eq("id", id);
        setStages(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-zinc-900 dark:text-white">Manage Stages — {pipeline.name}</h2>
                    <button onClick={() => { onSaved(stages); onClose(); }}><XIcon className="size-4 text-zinc-400" /></button>
                </div>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {stages.map((stage, i) => (
                        <div key={stage.id} className="flex items-center gap-2 p-2 rounded bg-zinc-50 dark:bg-zinc-900 group">
                            <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || "#6366f1" }} />
                            {editingId === stage.id ? (
                                <input
                                    autoFocus
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={() => handleRename(stage.id)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(stage.id); if (e.key === "Escape") setEditingId(null); }}
                                    className="flex-1 text-sm px-1 py-0.5 rounded border border-blue-400 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                                />
                            ) : (
                                <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{stage.name}</span>
                            )}
                            <button onClick={() => { setEditingId(stage.id); setEditingName(stage.name); }} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition">
                                <PencilIcon className="size-3.5" />
                            </button>
                            <button onClick={() => handleDelete(stage.id)} className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition">
                                <TrashIcon className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        placeholder="New stage name..."
                        className="flex-1 px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button onClick={handleAdd} disabled={saving || !newStageName.trim()} className="px-3 py-2 text-sm rounded bg-blue-500 text-white disabled:opacity-60 hover:bg-blue-600 transition">
                        {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Add"}
                    </button>
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={() => { onSaved(stages); onClose(); }} className="px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">Done</button>
                </div>
            </div>
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
    const [showStageManager, setShowStageManager] = useState(false);
    const [dealForm, setDealForm] = useState({ name: "", stage_id: "", contact_id: "", company_id: "", value: "", expected_close_date: "" });
    const [pipelineName, setPipelineName] = useState("");
    const [saving, setSaving] = useState(false);
    const [draggingDeal, setDraggingDeal] = useState(null);
    const [dragOverStage, setDragOverStage] = useState(null);
    const [selectedDealId, setSelectedDealId] = useState(null);
    const [query, setQuery] = useState("");

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

    const handleDeleteDeal = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this deal?")) return;
        await supabase.from("deals").delete().eq("id", id);
        setDeals((prev) => prev.filter((d) => d.id !== id));
        toast.success("Deal deleted");
    };

    const switchPipeline = (pipe) => {
        setActivePipeline(pipe);
        setStages((pipe.stages || []).sort((a, b) => a.position - b.position));
        fetchDeals(pipe.id);
    };

    const getDealUrgency = (deal) => {
        if (!deal.expected_close_date) return null;
        const stage = stages.find(s => s.id === deal.stage_id);
        if (stage?.name === "Closed Won" || stage?.name === "Closed Lost") return null;
        const closeDate = new Date(deal.expected_close_date);
        if (isPast(closeDate)) return "overdue";
        if (isWithinInterval(closeDate, { start: new Date(), end: addDays(new Date(), 7) })) return "soon";
        return null;
    };

    const filteredDeals = useMemo(() => {
        if (!query) return deals;
        return deals.filter(d => d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.company?.name?.toLowerCase().includes(query.toLowerCase()) ||
            d.contact?.name?.toLowerCase().includes(query.toLowerCase()));
    }, [deals, query]);

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;

    const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    {pipelines.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => switchPipeline(p)}
                            className={`px-3 py-1.5 text-sm rounded border transition ${activePipeline?.id === p.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}
                        >
                            {p.name}
                        </button>
                    ))}
                    {showPipelineForm ? (
                        <form onSubmit={handleCreatePipeline} className="flex gap-2">
                            <input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="Pipeline name" autoFocus
                                className="px-3 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500" required />
                            <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white disabled:opacity-60">Create</button>
                            <button type="button" onClick={() => setShowPipelineForm(false)} className="px-3 py-1.5 text-sm rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500">Cancel</button>
                        </form>
                    ) : (
                        <button onClick={() => setShowPipelineForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition">
                            <PlusIcon className="size-3.5" /> Pipeline
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {totalPipelineValue > 0 && (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                            Total: <span className="font-medium text-zinc-800 dark:text-zinc-200">${totalPipelineValue.toLocaleString()}</span>
                        </span>
                    )}
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter deals..."
                            className="pl-8 pr-3 py-1.5 text-sm rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40" />
                    </div>
                    {activePipeline && (
                        <button onClick={() => setShowStageManager(true)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition rounded hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Manage stages">
                            <SettingsIcon className="size-4" />
                        </button>
                    )}
                    {activePipeline && (
                        <button onClick={() => setShowDealForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition">
                            <PlusIcon className="size-4" /> New Deal
                        </button>
                    )}
                </div>
            </div>

            {/* New deal form modal */}
            {showDealForm && (
                <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-zinc-900 dark:text-white">New Deal</h2>
                            <button onClick={() => setShowDealForm(false)}><XIcon className="size-4 text-zinc-400" /></button>
                        </div>
                        <form onSubmit={handleCreateDeal} className="space-y-3">
                            <div><label className={labelCls}>Deal Name *</label><input value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} className={inputCls} required autoFocus /></div>
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

            {/* Stage manager */}
            {showStageManager && activePipeline && (
                <StageManager
                    pipeline={{ ...activePipeline, stages }}
                    onClose={() => setShowStageManager(false)}
                    onSaved={(newStages) => setStages(newStages)}
                />
            )}

            {/* Kanban board */}
            {pipelines.length === 0 ? (
                <div className="text-center py-16">
                    <TrendingUpIcon className="size-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">No pipelines yet</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Use the "+ Pipeline" button above to create one</p>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {stages.map((stage) => {
                        const stageDeals = filteredDeals.filter((d) => d.stage_id === stage.id);
                        const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                        const isDragOver = dragOverStage === stage.id;
                        return (
                            <div
                                key={stage.id}
                                className="flex-shrink-0 w-64"
                                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                                onDragLeave={() => setDragOverStage(null)}
                                onDrop={() => { if (draggingDeal) { handleMoveDeal(draggingDeal, stage.id); setDragOverStage(null); } }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="size-2 rounded-full" style={{ backgroundColor: stage.color || "#6366f1" }} />
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{stage.name}</span>
                                    <span className="ml-auto text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{stageDeals.length}</span>
                                </div>
                                {total > 0 && <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">${total.toLocaleString()}</p>}
                                <div className={`space-y-2 min-h-16 rounded-lg p-2 transition ${isDragOver ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-700" : "bg-zinc-50 dark:bg-zinc-900/50"}`}>
                                    {stageDeals.map((deal) => {
                                        const urgency = getDealUrgency(deal);
                                        return (
                                            <div
                                                key={deal.id}
                                                draggable
                                                onDragStart={() => setDraggingDeal(deal.id)}
                                                onDragEnd={() => { setDraggingDeal(null); setDragOverStage(null); }}
                                                onClick={() => setSelectedDealId(deal.id)}
                                                className={`bg-white dark:bg-zinc-900 border rounded-lg p-3 cursor-pointer hover:shadow-sm transition group ${urgency === "overdue" ? "border-red-200 dark:border-red-800" : urgency === "soon" ? "border-amber-200 dark:border-amber-800" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"}`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-snug">{deal.name}</p>
                                                    <button onClick={(e) => handleDeleteDeal(deal.id, e)} className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition flex-shrink-0">
                                                        <XIcon className="size-3.5" />
                                                    </button>
                                                </div>
                                                {deal.value && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">${Number(deal.value).toLocaleString()}</p>}
                                                {(deal.company?.name || deal.contact?.name) && (
                                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{deal.company?.name || deal.contact?.name}</p>
                                                )}
                                                {deal.expected_close_date && (
                                                    <div className={`flex items-center gap-1 mt-1.5 text-xs ${urgency === "overdue" ? "text-red-500" : urgency === "soon" ? "text-amber-500" : "text-zinc-400 dark:text-zinc-500"}`}>
                                                        {urgency === "overdue" ? <AlertCircleIcon className="size-3" /> : urgency === "soon" ? <ClockIcon className="size-3" /> : <ClockIcon className="size-3" />}
                                                        {format(new Date(deal.expected_close_date), "MMM d")}
                                                        {urgency === "overdue" && " · Overdue"}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {stageDeals.length === 0 && (
                                        <div className="flex items-center justify-center h-12 text-xs text-zinc-400 dark:text-zinc-600">
                                            {isDragOver ? "Drop here" : "Empty"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedDealId && (
                <DealDetail
                    id={selectedDealId}
                    stages={stages}
                    contacts={contacts}
                    companies={companies}
                    workspaceId={workspaceId}
                    onClose={() => setSelectedDealId(null)}
                    onDeleted={() => { setDeals((prev) => prev.filter((d) => d.id !== selectedDealId)); setSelectedDealId(null); }}
                />
            )}
        </div>
    );
}

// ─── CRM Dashboard ────────────────────────────────────────────────────────────
function CRMDashboard({ workspaceId }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [overdue, setOverdue] = useState([]);
    const [closingSoon, setClosingSoon] = useState([]);

    useEffect(() => { fetchStats() }, [workspaceId]);

    const fetchStats = async () => {
        setLoading(true);
        const [{ data: contacts }, { data: companies }, { data: deals }, { data: pipelines }] = await Promise.all([
            supabase.from("contacts").select("id", { count: "exact" }).eq("workspace_id", workspaceId),
            supabase.from("companies").select("id", { count: "exact" }).eq("workspace_id", workspaceId),
            supabase.from("deals").select("id, name, value, stage_id, expected_close_date, company:companies(name), stage:pipeline_stages(name, color)").eq("workspace_id", workspaceId),
            supabase.from("pipelines").select("id, name, stages:pipeline_stages(*)").eq("workspace_id", workspaceId),
        ]);

        const allDeals = deals || [];
        const closedWonStageIds = new Set();
        const closedLostStageIds = new Set();
        (pipelines || []).forEach(p => {
            (p.stages || []).forEach(s => {
                if (s.name === "Closed Won") closedWonStageIds.add(s.id);
                if (s.name === "Closed Lost") closedLostStageIds.add(s.id);
            });
        });

        const openDeals = allDeals.filter(d => !closedWonStageIds.has(d.stage_id) && !closedLostStageIds.has(d.stage_id));
        const wonDeals = allDeals.filter(d => closedWonStageIds.has(d.stage_id));
        const totalPipelineValue = openDeals.reduce((s, d) => s + (d.value || 0), 0);
        const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);

        const overdueDeals = openDeals.filter(d => d.expected_close_date && isPast(new Date(d.expected_close_date)));
        const soonDeals = openDeals.filter(d => d.expected_close_date && !isPast(new Date(d.expected_close_date)) &&
            isWithinInterval(new Date(d.expected_close_date), { start: new Date(), end: addDays(new Date(), 7) }));

        // Stage breakdown for all open deals across all pipelines
        const stageMap = {};
        (pipelines || []).forEach(p => {
            (p.stages || []).forEach(s => {
                const stageDeals = openDeals.filter(d => d.stage_id === s.id);
                if (stageDeals.length > 0) {
                    stageMap[s.id] = { name: s.name, color: s.color, count: stageDeals.length, value: stageDeals.reduce((sum, d) => sum + (d.value || 0), 0) };
                }
            });
        });

        setStats({
            contactCount: contacts?.length || 0,
            companyCount: companies?.length || 0,
            openDealCount: openDeals.length,
            wonDealCount: wonDeals.length,
            totalPipelineValue,
            wonValue,
            stageBreakdown: Object.values(stageMap),
        });
        setOverdue(overdueDeals);
        setClosingSoon(soonDeals);
        setLoading(false);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>;
    if (!stats) return null;

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Contacts", value: stats.contactCount, icon: UserIcon, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Companies", value: stats.companyCount, icon: BuildingIcon, color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
                    { label: "Open Deals", value: stats.openDealCount, icon: TrendingUpIcon, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" },
                    { label: "Won Deals", value: stats.wonDealCount, icon: CheckIcon, color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20" },
                ].map(item => (
                    <div key={item.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                        <div className={`inline-flex p-2 rounded-lg mb-2 ${item.color}`}>
                            <item.icon className="size-4" />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">{item.value}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.label}</p>
                    </div>
                ))}
            </div>

            {/* Pipeline value */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Pipeline Value</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">${stats.totalPipelineValue.toLocaleString()}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Across {stats.openDealCount} open deals</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Won Value</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${stats.wonValue.toLocaleString()}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">From {stats.wonDealCount} won deals</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stage breakdown */}
                {stats.stageBreakdown.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Deals by Stage</p>
                        <div className="space-y-2">
                            {stats.stageBreakdown.map(s => (
                                <div key={s.name} className="flex items-center gap-3">
                                    <div className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color || "#6366f1" }} />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{s.name}</span>
                                    <span className="text-xs text-zinc-400">{s.count} deal{s.count !== 1 ? "s" : ""}</span>
                                    {s.value > 0 && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">${s.value.toLocaleString()}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Attention needed */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">Needs Attention</p>
                    {overdue.length === 0 && closingSoon.length === 0 ? (
                        <p className="text-sm text-zinc-400 dark:text-zinc-500">No urgent deals right now.</p>
                    ) : (
                        <div className="space-y-2">
                            {overdue.map(d => (
                                <div key={d.id} className="flex items-start gap-2">
                                    <AlertCircleIcon className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{d.name}</p>
                                        <p className="text-xs text-red-500">Overdue · {d.expected_close_date && format(new Date(d.expected_close_date), "MMM d")}</p>
                                    </div>
                                    {d.value && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 ml-auto flex-shrink-0">${Number(d.value).toLocaleString()}</span>}
                                </div>
                            ))}
                            {closingSoon.map(d => (
                                <div key={d.id} className="flex items-start gap-2">
                                    <ClockIcon className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{d.name}</p>
                                        <p className="text-xs text-amber-500">Closing soon · {d.expected_close_date && format(new Date(d.expected_close_date), "MMM d")}</p>
                                    </div>
                                    {d.value && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 ml-auto flex-shrink-0">${Number(d.value).toLocaleString()}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main CRM Page ────────────────────────────────────────────────────────────
export default function CRM() {
    const [activeTab, setActiveTab] = useState("Contacts");
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace);

    if (!currentWorkspace) return null;

    const tabIcons = {
        Contacts: UserIcon,
        Companies: BuildingIcon,
        Deals: TrendingUpIcon,
        Dashboard: LayoutDashboardIcon,
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">CRM</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage your contacts, companies, and deals</p>
            </div>

            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {TABS.map((tab) => {
                    const Icon = tabIcons[tab];
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${activeTab === tab ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
                        >
                            <Icon className="size-3.5" />
                            {tab}
                        </button>
                    );
                })}
            </div>

            {activeTab === "Contacts" && <Contacts workspaceId={currentWorkspace.id} />}
            {activeTab === "Companies" && <Companies workspaceId={currentWorkspace.id} />}
            {activeTab === "Deals" && <Deals workspaceId={currentWorkspace.id} />}
            {activeTab === "Dashboard" && <CRMDashboard workspaceId={currentWorkspace.id} />}
        </div>
    );
}
