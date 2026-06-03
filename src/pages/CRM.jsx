import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useSelector } from "react-redux";
import { useAuth } from "../context/AuthContext";
import {
    PlusIcon, UserIcon, BuildingIcon, TrendingUpIcon,
    XIcon, Loader2Icon, TrashIcon, ExternalLinkIcon,
    SearchIcon, PencilIcon, CheckIcon, SettingsIcon,
    LayoutDashboardIcon, AlertCircleIcon, ClockIcon,
    ChevronLeftIcon, ChevronRightIcon, UploadIcon
} from "lucide-react";
import toast from "react-hot-toast";
import { ContactDetail, CompanyDetail, DealDetail } from "../components/CRMDetailPanel";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

const TABS = ["Dashboard", "Contacts", "Companies", "Deals"];

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500 mt-1";
const labelCls = "text-xs font-medium text-gray-500 dark:text-zinc-400";

const STATUS_STYLES = {
    Customer:       "bg-green-100 text-green-800 border border-green-200",
    "Qualified Lead": "bg-blue-100 text-blue-800 border border-blue-200",
    Partner:        "bg-purple-100 text-purple-800 border border-purple-200",
    Lead:           "bg-gray-100 text-gray-700 border border-gray-200",
    Prospect:       "bg-amber-100 text-amber-800 border border-amber-200",
};

// ─── Shared modal wrapper ─────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
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

// ─── Table panel wrapper ──────────────────────────────────────────────────────
function TablePanel({ toolbar, children, footer }) {
    return (
        <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
            {toolbar && (
                <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    {toolbar}
                </div>
            )}
            <div className="overflow-x-auto">{children}</div>
            {footer && (
                <div className="px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/40 dark:bg-zinc-900 flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500">
                    {footer}
                </div>
            )}
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

function SearchInput({ value, onChange, placeholder }) {
    return (
        <div className="relative w-full sm:w-64">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 dark:text-zinc-500" />
            <input
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500"
            />
        </div>
    );
}

function Avatar({ name, color = "from-blue-500 to-indigo-600", size = "size-8", text = "text-xs" }) {
    return (
        <div className={`${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white ${text} font-semibold flex-shrink-0`}>
            {(name || "?")[0].toUpperCase()}
        </div>
    );
}

function PrimaryBtn({ onClick, children, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:opacity-90 transition shadow-sm disabled:opacity-50"
        >
            {children}
        </button>
    );
}

// ─── Contacts ────────────────────────────────────────────────────────────────
function Contacts({ workspaceId }) {
    const { user } = useAuth();
    const [contacts, setContacts] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [form, setForm] = useState({ name: "", name_other: "", email: "", phone: "", title: "", company_id: "", linkedin_url: "", last_contacted_at: "", notes: "" });
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
                name_other: form.name_other || null,
                email: form.email || null,
                phone: form.phone || null,
                title: form.title || null,
                company_id: form.company_id || null,
                linkedin_url: form.linkedin_url || null,
                last_contacted_at: form.last_contacted_at || null,
                notes: form.notes || null,
            });
            if (error) throw error;
            toast.success("Contact created");
            setForm({ name: "", name_other: "", email: "", phone: "", title: "", company_id: "", linkedin_url: "", last_contacted_at: "", notes: "" });
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

    const filtered = useMemo(() => contacts.filter(c => {
        const matchQ = !query || c.name.toLowerCase().includes(query.toLowerCase()) || (c.email && c.email.toLowerCase().includes(query.toLowerCase()));
        const matchCo = !filterCompany || c.company_id === filterCompany;
        return matchQ && matchCo;
    }), [contacts, query, filterCompany]);

    if (loading) return <div className="flex justify-center py-16"><Loader2Icon className="size-5 animate-spin text-gray-300" /></div>;

    return (
        <div className="space-y-4">
            {showForm && (
                <Modal title="New Contact" onClose={() => setShowForm(false)}>
                    <form onSubmit={handleSave} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Name (English) *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required autoFocus /></div>
                            <div><label className={labelCls}>Name (Other)</label><input value={form.name_other} onChange={(e) => setForm({ ...form, name_other: e.target.value })} className={inputCls} placeholder="e.g. 한국어 이름" /></div>
                        </div>
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
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>LinkedIn URL</label><input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className={inputCls} placeholder="https://linkedin.com/in/..." /></div>
                            <div><label className={labelCls}>Last Contacted</label><input type="date" value={form.last_contacted_at} onChange={(e) => setForm({ ...form, last_contacted_at: e.target.value })} className={inputCls} /></div>
                        </div>
                        <div><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + " h-16 resize-none"} /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition">Cancel</button>
                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium disabled:opacity-50">
                                {saving && <Loader2Icon className="size-3.5 animate-spin" />} Save
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <TablePanel
                toolbar={
                    <>
                        <div className="flex items-center gap-2">
                            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts..." />
                            {companies.length > 0 && (
                                <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}
                                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 focus:outline-none">
                                    <option value="">All Companies</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                        </div>
                        <PrimaryBtn onClick={() => setShowForm(true)}>
                            <PlusIcon className="size-3.5" /> New Contact
                        </PrimaryBtn>
                    </>
                }
                footer={
                    <>
                        <span>Showing {filtered.length} of {contacts.length} contacts</span>
                        <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40" disabled><ChevronLeftIcon className="size-4" /></button>
                            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40" disabled><ChevronRightIcon className="size-4" /></button>
                        </div>
                    </>
                }
            >
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                            <UserIcon className="size-7 text-gray-400 dark:text-zinc-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{query || filterCompany ? "No contacts match your filters" : "No contacts yet"}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Add your first contact to get started</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile: card list */}
                        <div className="sm:hidden divide-y divide-gray-100 dark:divide-zinc-800">
                            {filtered.map((c) => (
                                <div key={c.id} onClick={() => setSelectedId(c.id)}
                                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                                    <Avatar name={c.name} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                                        <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{c.company?.name || c.title || c.email || "—"}</p>
                                    </div>
                                    <button onClick={(e) => handleDelete(c.id, e)}
                                        className="p-1.5 rounded-lg text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex-shrink-0">
                                        <TrashIcon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {/* Desktop: table */}
                        <table className="hidden sm:table w-full text-left">
                            <TableHead cols={[
                                { label: "Name" }, { label: "Company" }, { label: "Email" },
                                { label: "Phone" }, { label: "Title" }, { label: "", right: true }
                            ]} />
                            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                                {filtered.map((c) => (
                                    <tr key={c.id} onClick={() => setSelectedId(c.id)} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <Avatar name={c.name} />
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{c.company?.name || "—"}</td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{c.email || "—"}</td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{c.phone || "—"}</td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{c.title || "—"}</td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button onClick={(e) => handleDelete(c.id, e)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                                                <TrashIcon className="size-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </TablePanel>

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
    const [form, setForm] = useState({ name: "", industry: "", brand_names: "", website: "", linkedin_url: "", phone: "", address: "", city: "", province: "", country: "", notes: "" });
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState("");
    const [filterIndustry, setFilterIndustry] = useState("");

    useEffect(() => { fetchCompanies() }, [workspaceId]);

    const fetchCompanies = async () => {
        setLoading(true);
        const { data } = await supabase.from("companies").select("*, logo_url").eq("workspace_id", workspaceId).order("name");
        setCompanies(data || []);
        setLoading(false);
    };

    const handleLogoUpload = async (companyId, file) => {
        if (!file) return;
        try {
            const ext = file.name.split('.').pop();
            const path = `companies/${companyId}/logo.${ext}`;
            const { error: upErr } = await supabase.storage
                .from('workspace-assets')
                .upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            const { data } = supabase.storage.from('workspace-assets').getPublicUrl(path);
            const url = data.publicUrl + '?t=' + Date.now();
            const { error: dbErr } = await supabase.from('companies').update({ logo_url: url }).eq('id', companyId);
            if (dbErr) throw dbErr;
            setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, logo_url: url } : c));
            toast.success('Logo updated');
        } catch (err) {
            toast.error(err.message || 'Upload failed');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase.from("companies").insert({
                workspace_id: workspaceId,
                owner_id: user.id,
                name: form.name,
                industry: form.industry || null,
                brand_names: form.brand_names || null,
                website: form.website || null,
                linkedin_url: form.linkedin_url || null,
                phone: form.phone || null,
                address: form.address || null,
                city: form.city || null,
                province: form.province || null,
                country: form.country || null,
                notes: form.notes || null,
            });
            if (error) throw error;
            toast.success("Company created");
            setForm({ name: "", industry: "", brand_names: "", website: "", linkedin_url: "", phone: "", address: "", city: "", province: "", country: "", notes: "" });
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

    if (loading) return <div className="flex justify-center py-16"><Loader2Icon className="size-5 animate-spin text-gray-300" /></div>;

    return (
        <div className="space-y-4">
            {showForm && (
                <Modal title="New Company" onClose={() => setShowForm(false)}>
                    <form onSubmit={handleSave} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Company Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required autoFocus /></div>
                            <div><label className={labelCls}>Category / Industry</label><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputCls} /></div>
                        </div>
                        <div><label className={labelCls}>Brand Name(s)</label><input value={form.brand_names} onChange={(e) => setForm({ ...form, brand_names: e.target.value })} className={inputCls} placeholder="e.g. Nike, Jordan" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className={labelCls}>Website</label><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} placeholder="https://" /></div>
                            <div><label className={labelCls}>LinkedIn URL</label><input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className={inputCls} placeholder="https://linkedin.com/company/..." /></div>
                        </div>
                        <div><label className={labelCls}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></div>
                        <div><label className={labelCls}>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} /></div>
                        <div className="grid grid-cols-3 gap-3">
                            <div><label className={labelCls}>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} /></div>
                            <div><label className={labelCls}>Province</label><input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className={inputCls} /></div>
                            <div><label className={labelCls}>Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputCls} /></div>
                        </div>
                        <div><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls + " h-16 resize-none"} /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition">Cancel</button>
                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium disabled:opacity-50">
                                {saving && <Loader2Icon className="size-3.5 animate-spin" />} Save
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <TablePanel
                toolbar={
                    <>
                        <div className="flex items-center gap-2">
                            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies..." />
                            {industries.length > 0 && (
                                <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}
                                    className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 focus:outline-none">
                                    <option value="">All Industries</option>
                                    {industries.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            )}
                        </div>
                        <PrimaryBtn onClick={() => setShowForm(true)}>
                            <PlusIcon className="size-3.5" /> New Company
                        </PrimaryBtn>
                    </>
                }
                footer={
                    <>
                        <span>Showing {filtered.length} of {companies.length} companies</span>
                        <div className="flex items-center gap-1">
                            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40" disabled><ChevronLeftIcon className="size-4" /></button>
                            <button className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-40" disabled><ChevronRightIcon className="size-4" /></button>
                        </div>
                    </>
                }
            >
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                            <BuildingIcon className="size-7 text-gray-400 dark:text-zinc-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{query || filterIndustry ? "No companies match your filters" : "No companies yet"}</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile: card list */}
                        <div className="sm:hidden divide-y divide-gray-100 dark:divide-zinc-800">
                            {filtered.map((c) => (
                                <div key={c.id} onClick={() => setSelectedId(c.id)}
                                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                                    <div className="size-9 rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                        {c.logo_url
                                            ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" />
                                            : <Avatar name={c.name} color="from-purple-500 to-violet-600" size="size-9" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                                        <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{c.industry || c.size || "—"}</p>
                                    </div>
                                    <button onClick={(e) => handleDelete(c.id, e)}
                                        className="p-1.5 rounded-lg text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex-shrink-0">
                                        <TrashIcon className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {/* Desktop: table */}
                        <table className="hidden sm:table w-full text-left">
                            <TableHead cols={[
                                { label: "Name" }, { label: "Industry" }, { label: "Size" },
                                { label: "Website" }, { label: "", right: true }
                            ]} />
                            <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/60">
                                {filtered.map((c) => (
                                    <tr key={c.id} onClick={() => setSelectedId(c.id)} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <label className="relative cursor-pointer flex-shrink-0 group/logo" title="Upload logo" onClick={e => e.stopPropagation()}>
                                                    <div className="size-8 rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center">
                                                        {c.logo_url
                                                            ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" />
                                                            : <Avatar name={c.name} color="from-purple-500 to-violet-600" size="size-8" />
                                                        }
                                                    </div>
                                                    <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
                                                        <UploadIcon className="size-3 text-white" />
                                                    </div>
                                                    <input type="file" accept="image/*" className="hidden"
                                                        onChange={e => handleLogoUpload(c.id, e.target.files?.[0])} />
                                                </label>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{c.industry || "—"}</td>
                                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-zinc-400">{c.size || "—"}</td>
                                        <td className="px-5 py-3.5">
                                            {c.website ? (
                                                <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-blue-500 hover:underline text-sm">
                                                    {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLinkIcon className="size-3" />
                                                </a>
                                            ) : <span className="text-gray-400 dark:text-zinc-500 text-sm">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button onClick={(e) => handleDelete(c.id, e)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                                                <TrashIcon className="size-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </TablePanel>

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

// ─── Stage Manager ────────────────────────────────────────────────────────────
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
        if (!error && data) { setStages(prev => [...prev, data]); setNewStageName(""); }
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
        <Modal title={`Manage Stages — ${pipeline.name}`} onClose={() => { onSaved(stages); onClose(); }}>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {stages.map((stage) => (
                    <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-zinc-900 group">
                        <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || "#6366f1" }} />
                        {editingId === stage.id ? (
                            <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleRename(stage.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleRename(stage.id); if (e.key === "Escape") setEditingId(null); }}
                                className="flex-1 text-sm px-2 py-0.5 rounded border border-blue-400 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none" />
                        ) : (
                            <span className="flex-1 text-sm text-gray-700 dark:text-zinc-300">{stage.name}</span>
                        )}
                        <button onClick={() => { setEditingId(stage.id); setEditingName(stage.name); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition">
                            <PencilIcon className="size-3.5" />
                        </button>
                        <button onClick={() => handleDelete(stage.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition">
                            <TrashIcon className="size-3.5" />
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="New stage name..."
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                <button onClick={handleAdd} disabled={saving || !newStageName.trim()} className="px-3 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50">
                    {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Add"}
                </button>
            </div>
            <div className="flex justify-end mt-4">
                <button onClick={() => { onSaved(stages); onClose(); }} className="px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:opacity-90 transition">Done</button>
            </div>
        </Modal>
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
        } else { setLoading(false); }
    };

    const fetchDeals = async (pipelineId) => {
        const { data } = await supabase.from("deals")
            .select("*, contact:contacts(id, name), company:companies(id, name)")
            .eq("pipeline_id", pipelineId).order("created_at");
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
        } finally { setSaving(false); }
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
        } finally { setSaving(false); }
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

    if (loading) return <div className="flex justify-center py-16"><Loader2Icon className="size-5 animate-spin text-gray-300" /></div>;

    const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const isClosedStage = (name) => name === "Closed Won" || name === "Closed Lost";

    return (
        <div className="flex flex-col gap-4 -mx-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white/60 dark:bg-zinc-900/60 backdrop-blur border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-3">
                    {/* Pipeline switcher */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {pipelines.map((p) => (
                            <button key={p.id} onClick={() => switchPipeline(p)}
                                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-lg border transition ${activePipeline?.id === p.id ? "border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-400"}`}>
                                {p.name}
                            </button>
                        ))}
                        {showPipelineForm ? (
                            <form onSubmit={handleCreatePipeline} className="flex gap-2">
                                <input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="Pipeline name" autoFocus
                                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-gray-400" required />
                                <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50">Create</button>
                                <button type="button" onClick={() => setShowPipelineForm(false)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500">Cancel</button>
                            </form>
                        ) : (
                            <button onClick={() => setShowPipelineForm(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-lg border border-dashed border-gray-300 dark:border-zinc-600 text-gray-400 hover:border-gray-500 hover:text-gray-600 transition">
                                <PlusIcon className="size-3" /> Pipeline
                            </button>
                        )}
                    </div>
                    <div className="w-px h-5 bg-gray-200 dark:bg-zinc-700" />
                    <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter deals..." />
                </div>
                <div className="flex items-center gap-3">
                    {totalPipelineValue > 0 && (
                        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                            <span>Total: <span className="text-gray-700 dark:text-zinc-300">${totalPipelineValue.toLocaleString()}</span></span>
                            <span>Deals: <span className="text-gray-700 dark:text-zinc-300">{deals.length}</span></span>
                        </div>
                    )}
                    {activePipeline && (
                        <button onClick={() => setShowStageManager(true)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800" title="Manage stages">
                            <SettingsIcon className="size-4" />
                        </button>
                    )}
                    {activePipeline && (
                        <PrimaryBtn onClick={() => setShowDealForm(true)}>
                            <PlusIcon className="size-3.5" /> New Deal
                        </PrimaryBtn>
                    )}
                </div>
            </div>

            {showDealForm && (
                <Modal title="New Deal" onClose={() => setShowDealForm(false)}>
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
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowDealForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition">Cancel</button>
                            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium disabled:opacity-50">
                                {saving && <Loader2Icon className="size-3.5 animate-spin" />} Save
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {showStageManager && activePipeline && (
                <StageManager pipeline={{ ...activePipeline, stages }} onClose={() => setShowStageManager(false)} onSaved={(s) => setStages(s)} />
            )}

            {/* Kanban board */}
            {pipelines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                        <TrendingUpIcon className="size-7 text-gray-400 dark:text-zinc-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">No pipelines yet</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">Use the "+ Pipeline" button above to create one</p>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
                    {stages.map((stage) => {
                        const stageDeals = filteredDeals.filter((d) => d.stage_id === stage.id);
                        const total = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
                        const isDragOver = dragOverStage === stage.id;
                        const closed = isClosedStage(stage.name);
                        return (
                            <div
                                key={stage.id}
                                className={`flex-shrink-0 w-72 flex flex-col rounded-xl border p-2 transition-opacity ${closed ? "opacity-70 border-gray-100 dark:border-zinc-800/50 bg-gray-50/40 dark:bg-zinc-900/20" : "border-gray-200 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900/40"}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                                onDragLeave={() => setDragOverStage(null)}
                                onDrop={() => { if (draggingDeal) { handleMoveDeal(draggingDeal, stage.id); setDragOverStage(null); } }}
                            >
                                {/* Column header */}
                                <div className="flex items-center justify-between px-2 py-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color || "#6366f1" }} />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">{stage.name}</span>
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded">{stageDeals.length}</span>
                                    </div>
                                    {total > 0 && (
                                        <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500">
                                            ${total >= 1000000 ? (total / 1000000).toFixed(1) + "M" : total >= 1000 ? Math.round(total / 1000) + "k" : total}
                                        </span>
                                    )}
                                </div>

                                {/* Cards */}
                                <div className={`flex-1 space-y-2.5 min-h-[3rem] rounded-lg p-1.5 transition-colors ${isDragOver ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-dashed ring-blue-300 dark:ring-blue-700" : ""}`}>
                                    {stageDeals.map((deal) => {
                                        const urgency = getDealUrgency(deal);
                                        return (
                                            <div
                                                key={deal.id}
                                                draggable
                                                onDragStart={() => setDraggingDeal(deal.id)}
                                                onDragEnd={() => { setDraggingDeal(null); setDragOverStage(null); }}
                                                onClick={() => setSelectedDealId(deal.id)}
                                                className={`bg-white dark:bg-zinc-900 rounded-lg p-3.5 cursor-grab active:cursor-grabbing border-l-4 border border-gray-100 dark:border-zinc-800 hover:-translate-y-0.5 hover:shadow-md transition-all group relative ${closed ? "opacity-75" : ""}`}
                                                style={{ borderLeftColor: stage.color || "#6366f1" }}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <p className={`text-[14px] font-semibold text-gray-900 dark:text-white leading-snug ${closed ? "line-through decoration-gray-400" : ""}`}>
                                                        {deal.name}
                                                    </p>
                                                    <button onClick={(e) => handleDeleteDeal(deal.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition flex-shrink-0 -mt-0.5 -mr-0.5">
                                                        <XIcon className="size-3.5" />
                                                    </button>
                                                </div>
                                                {(deal.company?.name || deal.contact?.name) && (
                                                    <p className="text-[12px] text-gray-400 dark:text-zinc-500 mb-3">{deal.company?.name || deal.contact?.name}</p>
                                                )}
                                                <div className="flex items-center justify-between pt-2.5 border-t border-gray-50 dark:border-zinc-800">
                                                    <span className={`text-[12px] font-bold ${closed ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-zinc-200"}`}>
                                                        {deal.value ? `$${Number(deal.value).toLocaleString()}` : "—"}
                                                    </span>
                                                    {deal.expected_close_date && (
                                                        <span className={`flex items-center gap-1 text-[11px] ${urgency === "overdue" ? "text-red-500" : urgency === "soon" ? "text-amber-500" : "text-gray-400 dark:text-zinc-500"}`}>
                                                            {urgency === "overdue" ? <AlertCircleIcon className="size-3" /> : <ClockIcon className="size-3" />}
                                                            {format(new Date(deal.expected_close_date), "MMM d")}
                                                            {urgency === "overdue" && " · Overdue"}
                                                        </span>
                                                    )}
                                                    {closed && <span className="text-[11px] text-gray-400 dark:text-zinc-500">Closed</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {stageDeals.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-16 text-center opacity-50">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-600">
                                                {isDragOver ? "Drop here" : "No deals"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedDealId && (
                <DealDetail id={selectedDealId} stages={stages} contacts={contacts} companies={companies}
                    workspaceId={workspaceId} onClose={() => setSelectedDealId(null)}
                    onDeleted={() => { setDeals((prev) => prev.filter((d) => d.id !== selectedDealId)); setSelectedDealId(null); }} />
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
        const closedWonIds = new Set();
        const closedLostIds = new Set();
        (pipelines || []).forEach(p => {
            (p.stages || []).forEach(s => {
                if (s.name === "Closed Won") closedWonIds.add(s.id);
                if (s.name === "Closed Lost") closedLostIds.add(s.id);
            });
        });

        const openDeals = allDeals.filter(d => !closedWonIds.has(d.stage_id) && !closedLostIds.has(d.stage_id));
        const wonDeals = allDeals.filter(d => closedWonIds.has(d.stage_id));
        const totalPipelineValue = openDeals.reduce((s, d) => s + (d.value || 0), 0);
        const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
        const overdueDeals = openDeals.filter(d => d.expected_close_date && isPast(new Date(d.expected_close_date)));
        const soonDeals = openDeals.filter(d => d.expected_close_date && !isPast(new Date(d.expected_close_date)) &&
            isWithinInterval(new Date(d.expected_close_date), { start: new Date(), end: addDays(new Date(), 7) }));

        const stageMap = {};
        (pipelines || []).forEach(p => {
            (p.stages || []).forEach(s => {
                const sd = openDeals.filter(d => d.stage_id === s.id);
                if (sd.length > 0) stageMap[s.id] = { name: s.name, color: s.color, count: sd.length, value: sd.reduce((sum, d) => sum + (d.value || 0), 0) };
            });
        });

        setStats({ contactCount: contacts?.length || 0, companyCount: companies?.length || 0, openDealCount: openDeals.length, wonDealCount: wonDeals.length, totalPipelineValue, wonValue, stageBreakdown: Object.values(stageMap) });
        setOverdue(overdueDeals);
        setClosingSoon(soonDeals);
        setLoading(false);
    };

    if (loading) return <div className="flex justify-center py-16"><Loader2Icon className="size-5 animate-spin text-gray-300" /></div>;
    if (!stats) return null;

    const urgent = overdue.length + closingSoon.length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">CRM Overview</h2>
                <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Real-time pipeline metrics and activity.</p>
            </div>

            {/* 4 stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[
                    { label: "Total Contacts", value: stats.contactCount, Icon: UserIcon, accent: false },
                    { label: "Total Companies", value: stats.companyCount, Icon: BuildingIcon, accent: false },
                    { label: "Open Deals", value: stats.openDealCount, Icon: TrendingUpIcon, accent: false },
                    { label: "Won Deals", value: stats.wonDealCount, Icon: CheckIcon, accent: true },
                ].map(item => (
                    <div key={item.label} className={`relative bg-white dark:bg-zinc-900 border rounded-2xl p-5 overflow-hidden ${item.accent ? "border-indigo-200 dark:border-indigo-800" : "border-gray-200 dark:border-zinc-800"}`}>
                        {item.accent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-2xl" />}
                        <div className="flex items-start justify-between mb-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">{item.label}</p>
                            <item.Icon className={`size-4 ${item.accent ? "text-indigo-400" : "text-gray-300 dark:text-zinc-600"}`} />
                        </div>
                        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Pipeline value + Won value */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6">
                    <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">Pipeline Value</p>
                    <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                        ${stats.totalPipelineValue.toLocaleString()}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
                        <AlertCircleIcon className="size-3.5" />
                        Across {stats.openDealCount} open deals in the pipeline
                    </p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6">
                    <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-1">Won Value</p>
                    <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight mb-3">
                        ${stats.wonValue.toLocaleString()}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
                        <CheckIcon className="size-3.5" />
                        From {stats.wonDealCount} successfully closed deals
                    </p>
                </div>
            </div>

            {/* Stage breakdown + Needs attention */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stage breakdown */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUpIcon className="size-4 text-indigo-500" />
                        <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Pipeline Breakdown</p>
                    </div>
                    {stats.stageBreakdown.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                            <div className="size-10 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
                                <CheckIcon className="size-5 text-gray-400" />
                            </div>
                            <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">No open deals yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.stageBreakdown.map(s => {
                                const maxVal = Math.max(...stats.stageBreakdown.map(x => x.count));
                                const pct = Math.round((s.count / maxVal) * 100);
                                return (
                                    <div key={s.name}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="size-2 rounded-full" style={{ backgroundColor: s.color || "#6366f1" }} />
                                                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{s.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-gray-400">{s.count} deal{s.count !== 1 ? "s" : ""}</span>
                                                {s.value > 0 && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">${s.value.toLocaleString()}</span>}
                                            </div>
                                        </div>
                                        <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color || "#6366f1" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Needs attention */}
                <div className={`rounded-2xl p-5 border ${urgent > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40" : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircleIcon className={`size-4 ${urgent > 0 ? "text-red-500" : "text-gray-400"}`} />
                        <p className={`text-sm font-semibold ${urgent > 0 ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-zinc-200"}`}>
                            Needs Attention {urgent > 0 && <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{urgent}</span>}
                        </p>
                    </div>
                    {urgent === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="size-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                                <CheckIcon className="size-5 text-gray-400 dark:text-zinc-500" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">You're all caught up!</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">No urgent deals or tasks require your immediate attention.</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {overdue.map(d => (
                                <div key={d.id} className="flex items-start gap-2.5 p-2.5 bg-white/70 dark:bg-zinc-900/50 rounded-xl border border-red-100 dark:border-red-900/30">
                                    <AlertCircleIcon className="size-4 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{d.name}</p>
                                        <p className="text-xs text-red-500">Overdue · {d.expected_close_date && format(new Date(d.expected_close_date), "MMM d")}</p>
                                    </div>
                                    {d.value && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">${Number(d.value).toLocaleString()}</span>}
                                </div>
                            ))}
                            {closingSoon.map(d => (
                                <div key={d.id} className="flex items-start gap-2.5 p-2.5 bg-white/70 dark:bg-zinc-900/50 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <ClockIcon className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{d.name}</p>
                                        <p className="text-xs text-amber-500">Closing soon · {d.expected_close_date && format(new Date(d.expected_close_date), "MMM d")}</p>
                                    </div>
                                    {d.value && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex-shrink-0">${Number(d.value).toLocaleString()}</span>}
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
    const [activeTab, setActiveTab] = useState("Dashboard");
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace);

    if (!currentWorkspace) return null;

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-5 sm:gap-6 pb-12">
            {/* Sub-nav tabs — scrollable on mobile */}
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

            {activeTab === "Contacts" && <Contacts workspaceId={currentWorkspace.id} />}
            {activeTab === "Companies" && <Companies workspaceId={currentWorkspace.id} />}
            {activeTab === "Deals" && <Deals workspaceId={currentWorkspace.id} />}
            {activeTab === "Dashboard" && <CRMDashboard workspaceId={currentWorkspace.id} />}
        </div>
    );
}
