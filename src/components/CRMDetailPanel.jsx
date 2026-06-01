import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { useSelector } from "react-redux"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
    XIcon, Loader2Icon, SaveIcon, TrashIcon, ExternalLinkIcon,
    CheckCircle2Icon, CircleIcon, CircleDotIcon, PlusIcon,
    FolderPlusIcon, MessageSquareIcon, PhoneIcon, MailIcon,
    UsersIcon, BriefcaseIcon, ClipboardListIcon, ChevronDownIcon,
    LinkIcon, CalendarIcon, BuildingIcon
} from "lucide-react"
import { format, isPast, isWithinInterval, addDays } from "date-fns"
import toast from "react-hot-toast"

const inputCls = "w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
const labelCls = "text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide"

const statusIcons = {
    TODO: { icon: CircleIcon, cls: "text-zinc-400" },
    IN_PROGRESS: { icon: CircleDotIcon, cls: "text-blue-500" },
    DONE: { icon: CheckCircle2Icon, cls: "text-emerald-500" },
}

const noteTypeOptions = [
    { value: "note", label: "Note", icon: MessageSquareIcon },
    { value: "call", label: "Call", icon: PhoneIcon },
    { value: "email", label: "Email", icon: MailIcon },
    { value: "meeting", label: "Meeting", icon: UsersIcon },
    { value: "update", label: "Update", icon: ClipboardListIcon },
]

const noteTypeColors = {
    note: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
    call: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    email: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    meeting: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    update: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
}

function Field({ label, value, onChange, type = "text", multiline = false, placeholder = "" }) {
    if (multiline) return (
        <div>
            <p className={labelCls}>{label}</p>
            <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={inputCls + " resize-none"} />
        </div>
    )
    return (
        <div>
            <p className={labelCls}>{label}</p>
            <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
        </div>
    )
}

// ─── Linked Tasks Section ─────────────────────────────────────────────────────
function LinkedTasksSection({ workspaceId, recordType, recordId }) {
    const [links, setLinks] = useState([])
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [showPicker, setShowPicker] = useState(false)
    const [query, setQuery] = useState("")
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const { user } = useAuth()

    useEffect(() => { fetchLinks() }, [recordId])

    const fetchLinks = async () => {
        setLoading(true)
        // Fetch links where this record is either source or target
        const [{ data: asSource }, { data: asTarget }] = await Promise.all([
            supabase.from("record_links")
                .select("id, target_type, target_id, relation_type")
                .eq("workspace_id", workspaceId)
                .eq("source_type", recordType)
                .eq("source_id", recordId)
                .eq("target_type", "task"),
            supabase.from("record_links")
                .select("id, source_type, source_id, relation_type")
                .eq("workspace_id", workspaceId)
                .eq("target_type", recordType)
                .eq("target_id", recordId)
                .eq("source_type", "task"),
        ])

        const taskIds = [
            ...((asSource || []).map(l => ({ linkId: l.id, taskId: l.target_id }))),
            ...((asTarget || []).map(l => ({ linkId: l.id, taskId: l.source_id }))),
        ]

        if (taskIds.length === 0) { setLinks([]); setLoading(false); return }

        const { data: taskData } = await supabase
            .from("xpm_tasks")
            .select("id, title, status, priority, due_date, project:projects(name)")
            .in("id", taskIds.map(t => t.taskId))

        const merged = taskIds.map(({ linkId, taskId }) => ({
            linkId,
            task: (taskData || []).find(t => t.id === taskId)
        })).filter(l => l.task)

        setLinks(merged)
        setLoading(false)
    }

    const handleSearch = async (q) => {
        setQuery(q)
        if (!q.trim()) { setSearchResults([]); return }
        setSearching(true)
        const { data } = await supabase
            .from("xpm_tasks")
            .select("id, title, status, project:projects(name)")
            .eq("workspace_id", workspaceId)
            .ilike("title", `%${q}%`)
            .limit(8)
        setSearchResults(data || [])
        setSearching(false)
    }

    const handleLink = async (task) => {
        const already = links.find(l => l.task?.id === task.id)
        if (already) { toast("Already linked"); return }
        const { error } = await supabase.from("record_links").insert({
            workspace_id: workspaceId,
            source_type: recordType,
            source_id: recordId,
            target_type: "task",
            target_id: task.id,
            relation_type: "related",
            created_by: user.id,
        })
        if (error) { toast.error("Failed to link"); return }
        toast.success("Task linked")
        setShowPicker(false)
        setQuery("")
        setSearchResults([])
        fetchLinks()
    }

    const handleUnlink = async (linkId) => {
        await supabase.from("record_links").delete().eq("id", linkId)
        setLinks(prev => prev.filter(l => l.linkId !== linkId))
        toast.success("Link removed")
    }

    const statusConfig = (status) => statusIcons[status] || statusIcons.TODO

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className={labelCls}>Linked Tasks ({links.length})</p>
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition"
                >
                    <PlusIcon className="size-3" /> Link task
                </button>
            </div>

            {showPicker && (
                <div className="mb-3 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 bg-zinc-50 dark:bg-zinc-900/50">
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search tasks..."
                        className="w-full px-2 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {searching && <div className="text-xs text-zinc-400 mt-1 px-1">Searching...</div>}
                    {searchResults.length > 0 && (
                        <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                            {searchResults.map(task => {
                                const { icon: Icon, cls } = statusConfig(task.status)
                                return (
                                    <button
                                        key={task.id}
                                        onClick={() => handleLink(task)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-left"
                                    >
                                        <Icon className={`size-3.5 flex-shrink-0 ${cls}`} />
                                        <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate">{task.title}</span>
                                        {task.project && <span className="text-xs text-zinc-400 ml-auto flex-shrink-0">{task.project.name}</span>}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {query && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-zinc-400 px-1 mt-1">No tasks found</p>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-3"><Loader2Icon className="size-4 animate-spin text-zinc-400" /></div>
            ) : links.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">No linked tasks</p>
            ) : (
                <div className="space-y-1.5">
                    {links.map(({ linkId, task }) => {
                        const { icon: Icon, cls } = statusConfig(task.status)
                        return (
                            <div key={linkId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900 group">
                                <Icon className={`size-3.5 flex-shrink-0 ${cls}`} />
                                <span className="text-sm text-zinc-800 dark:text-zinc-200 truncate flex-1">{task.title}</span>
                                {task.project && <span className="text-xs text-zinc-400">{task.project.name}</span>}
                                <button
                                    onClick={() => handleUnlink(linkId)}
                                    className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition flex-shrink-0"
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Deal Notes Section ───────────────────────────────────────────────────────
function DealNotesSection({ dealId, workspaceId }) {
    const { user } = useAuth()
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [body, setBody] = useState("")
    const [noteType, setNoteType] = useState("note")
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)

    useEffect(() => { fetchNotes() }, [dealId])

    const fetchNotes = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("deal_notes")
            .select("*, author:profiles(id, name)")
            .eq("deal_id", dealId)
            .order("created_at", { ascending: false })
        setNotes(data || [])
        setLoading(false)
    }

    const handleAdd = async (e) => {
        e.preventDefault()
        if (!body.trim()) return
        setSaving(true)
        try {
            const { error } = await supabase.from("deal_notes").insert({
                deal_id: dealId,
                workspace_id: workspaceId,
                author_id: user.id,
                body: body.trim(),
                note_type: noteType,
            })
            if (error) throw error
            setBody("")
            setNoteType("note")
            setShowForm(false)
            fetchNotes()
        } catch (err) {
            toast.error(err.message || "Failed to save note")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        await supabase.from("deal_notes").delete().eq("id", id)
        setNotes(prev => prev.filter(n => n.id !== id))
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className={labelCls}>Activity & Notes ({notes.length})</p>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 transition"
                >
                    <PlusIcon className="size-3" /> Add note
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleAdd} className="mb-3 space-y-2 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex gap-1 flex-wrap">
                        {noteTypeOptions.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setNoteType(opt.value)}
                                className={`px-2.5 py-1 text-xs rounded-full border transition ${noteType === opt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        autoFocus
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Add a note..."
                        rows={3}
                        className="w-full px-2 py-1.5 text-sm rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setShowForm(false); setBody("") }} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">Cancel</button>
                        <button type="submit" disabled={saving || !body.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-blue-500 text-white disabled:opacity-60 hover:bg-blue-600 transition">
                            {saving && <Loader2Icon className="size-3 animate-spin" />} Save
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-3"><Loader2Icon className="size-4 animate-spin text-zinc-400" /></div>
            ) : notes.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">No activity yet</p>
            ) : (
                <div className="space-y-2">
                    {notes.map(note => (
                        <div key={note.id} className="group flex gap-2.5">
                            <div className="mt-0.5 flex-shrink-0">
                                <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${noteTypeColors[note.note_type] || noteTypeColors.note}`}>
                                    {note.note_type}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug whitespace-pre-wrap">{note.body}</p>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                                    {note.author?.name || "Unknown"} · {format(new Date(note.created_at), "MMM d, yyyy")}
                                </p>
                            </div>
                            <button
                                onClick={() => handleDelete(note.id)}
                                className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition flex-shrink-0 mt-0.5"
                            >
                                <XIcon className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Panel Shell ──────────────────────────────────────────────────────────────
function PanelShell({ onClose, title, subtitle, badge, children }) {
    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30" onClick={onClose} />
            <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xl">
                <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="min-w-0">
                        {badge && (
                            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mb-1">
                                {badge}
                            </span>
                        )}
                        {title && <h2 className="text-base font-semibold text-zinc-900 dark:text-white truncate">{title}</h2>}
                        {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition ml-3 mt-0.5 flex-shrink-0">
                        <XIcon className="size-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </>
    )
}

// ─── Contact Detail ───────────────────────────────────────────────────────────
export function ContactDetail({ id, workspaceId, onClose, onDeleted }) {
    const [contact, setContact] = useState(null)
    const [companies, setCompanies] = useState([])
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("details")

    useEffect(() => { fetchAll() }, [id])

    const fetchAll = async () => {
        setLoading(true)
        const [{ data: c }, { data: co }] = await Promise.all([
            supabase.from("contacts").select("*, company:companies(id, name)").eq("id", id).single(),
            supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).order("name"),
        ])
        setContact(c)
        setCompanies(co || [])
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from("contacts").update({
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                title: contact.title,
                company_id: contact.company_id || null,
                notes: contact.notes,
                linkedin_url: contact.linkedin_url,
                source: contact.source,
                updated_at: new Date().toISOString(),
            }).eq("id", id)
            if (error) throw error
            toast.success("Contact saved")
        } catch (err) {
            toast.error(err.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm("Delete this contact?")) return
        await supabase.from("contacts").delete().eq("id", id)
        toast.success("Contact deleted")
        onDeleted()
        onClose()
    }

    if (loading) return <PanelShell onClose={onClose} badge="Contact"><div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div></PanelShell>
    if (!contact) return null

    return (
        <PanelShell onClose={onClose} badge="Contact" title={contact.name} subtitle={[contact.title, contact.company?.name].filter(Boolean).join(" · ")}>
            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 px-5">
                {["details", "tasks"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`py-2.5 px-1 text-xs font-medium border-b-2 transition capitalize -mb-px ${activeTab === tab ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>
                        {tab}
                    </button>
                ))}
            </div>

            <div className="p-5 space-y-4">
                {activeTab === "details" && (
                    <>
                        <Field label="Name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} />
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} type="email" />
                            <Field label="Phone" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Title" value={contact.title} onChange={(v) => setContact({ ...contact, title: v })} />
                            <div>
                                <p className={labelCls}>Company</p>
                                <select value={contact.company_id || ""} onChange={(e) => setContact({ ...contact, company_id: e.target.value || null })} className={inputCls}>
                                    <option value="">None</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="LinkedIn URL" value={contact.linkedin_url} onChange={(v) => setContact({ ...contact, linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
                            <Field label="Source" value={contact.source} onChange={(v) => setContact({ ...contact, source: v })} placeholder="e.g. Referral, LinkedIn" />
                        </div>
                        <Field label="Notes" value={contact.notes} onChange={(v) => setContact({ ...contact, notes: v })} multiline />
                        {contact.linkedin_url && (
                            <a href={contact.linkedin_url.startsWith("http") ? contact.linkedin_url : `https://${contact.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
                                <ExternalLinkIcon className="size-3.5" /> View LinkedIn
                            </a>
                        )}
                        <div className="flex justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition">
                                <TrashIcon className="size-4" /> Delete
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60 hover:opacity-90 transition">
                                {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />} Save
                            </button>
                        </div>
                    </>
                )}
                {activeTab === "tasks" && (
                    <LinkedTasksSection workspaceId={workspaceId} recordType="contact" recordId={id} />
                )}
            </div>
        </PanelShell>
    )
}

// ─── Company Detail ───────────────────────────────────────────────────────────
export function CompanyDetail({ id, workspaceId, onClose, onDeleted }) {
    const [company, setCompany] = useState(null)
    const [contacts, setContacts] = useState([])
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("details")

    useEffect(() => { fetchAll() }, [id])

    const fetchAll = async () => {
        setLoading(true)
        const [{ data: co }, { data: c }] = await Promise.all([
            supabase.from("companies").select("*").eq("id", id).single(),
            supabase.from("contacts").select("id, name, title, email").eq("company_id", id).order("name"),
        ])
        setCompany(co)
        setContacts(c || [])
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from("companies").update({
                name: company.name,
                website: company.website,
                industry: company.industry,
                notes: company.notes,
                size: company.size,
                employee_count: company.employee_count ? parseInt(company.employee_count) : null,
                linkedin_url: company.linkedin_url,
                founded_year: company.founded_year ? parseInt(company.founded_year) : null,
                updated_at: new Date().toISOString(),
            }).eq("id", id)
            if (error) throw error
            toast.success("Company saved")
        } catch (err) {
            toast.error(err.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm("Delete this company?")) return
        await supabase.from("companies").delete().eq("id", id)
        toast.success("Company deleted")
        onDeleted()
        onClose()
    }

    if (loading) return <PanelShell onClose={onClose} badge="Company"><div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div></PanelShell>
    if (!company) return null

    const sizeOptions = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]

    return (
        <PanelShell onClose={onClose} badge="Company" title={company.name} subtitle={[company.industry, company.size && `${company.size} employees`].filter(Boolean).join(" · ")}>
            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 px-5">
                {["details", "contacts", "tasks"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`py-2.5 px-1 text-xs font-medium border-b-2 transition capitalize -mb-px ${activeTab === tab ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>
                        {tab} {tab === "contacts" && contacts.length > 0 ? `(${contacts.length})` : ""}
                    </button>
                ))}
            </div>

            <div className="p-5 space-y-4">
                {activeTab === "details" && (
                    <>
                        <Field label="Name" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Website" value={company.website} onChange={(v) => setCompany({ ...company, website: v })} placeholder="https://" />
                            <Field label="Industry" value={company.industry} onChange={(v) => setCompany({ ...company, industry: v })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className={labelCls}>Company Size</p>
                                <select value={company.size || ""} onChange={(e) => setCompany({ ...company, size: e.target.value || null })} className={inputCls}>
                                    <option value="">Unknown</option>
                                    {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <Field label="Founded Year" value={company.founded_year} onChange={(v) => setCompany({ ...company, founded_year: v })} type="number" placeholder="e.g. 2018" />
                        </div>
                        <Field label="LinkedIn URL" value={company.linkedin_url} onChange={(v) => setCompany({ ...company, linkedin_url: v })} placeholder="https://linkedin.com/company/..." />
                        <Field label="Notes" value={company.notes} onChange={(v) => setCompany({ ...company, notes: v })} multiline />
                        {company.website && (
                            <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-500 hover:underline">
                                <ExternalLinkIcon className="size-3.5" /> Visit website
                            </a>
                        )}
                        <div className="flex justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition">
                                <TrashIcon className="size-4" /> Delete
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60 hover:opacity-90 transition">
                                {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />} Save
                            </button>
                        </div>
                    </>
                )}
                {activeTab === "contacts" && (
                    <>
                        {contacts.length === 0 ? (
                            <p className="text-sm text-zinc-400 dark:text-zinc-500 py-4 text-center">No contacts at this company</p>
                        ) : (
                            <div className="space-y-2">
                                {contacts.map((c) => (
                                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                        <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                            {c.name[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.name}</p>
                                            {c.title && <p className="text-xs text-zinc-400 dark:text-zinc-500">{c.title}</p>}
                                            {c.email && <p className="text-xs text-zinc-400 dark:text-zinc-500">{c.email}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
                {activeTab === "tasks" && (
                    <LinkedTasksSection workspaceId={workspaceId} recordType="company" recordId={id} />
                )}
            </div>
        </PanelShell>
    )
}

// ─── Deal Detail ──────────────────────────────────────────────────────────────
export function DealDetail({ id, stages, contacts, companies, workspaceId, onClose, onDeleted, onProjectCreated }) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [deal, setDeal] = useState(null)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [creatingProject, setCreatingProject] = useState(false)
    const [activeTab, setActiveTab] = useState("details")

    useEffect(() => { fetchDeal() }, [id])

    const fetchDeal = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("deals")
            .select("*, contact:contacts(id, name), company:companies(id, name)")
            .eq("id", id)
            .single()
        setDeal(data)
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const { error } = await supabase.from("deals").update({
                name: deal.name,
                stage_id: deal.stage_id,
                contact_id: deal.contact_id || null,
                company_id: deal.company_id || null,
                value: deal.value ? parseFloat(deal.value) : null,
                expected_close_date: deal.expected_close_date || null,
                probability: deal.probability ? parseInt(deal.probability) : null,
                description: deal.description || null,
                updated_at: new Date().toISOString(),
            }).eq("id", id)
            if (error) throw error
            toast.success("Deal saved")
        } catch (err) {
            toast.error(err.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm("Delete this deal?")) return
        await supabase.from("deals").delete().eq("id", id)
        toast.success("Deal deleted")
        onDeleted()
        onClose()
    }

    const handleCreateProject = async () => {
        if (!deal) return
        setCreatingProject(true)
        try {
            const { data: project, error } = await supabase
                .from("projects")
                .insert({
                    workspace_id: workspaceId,
                    name: deal.name,
                    description: deal.description || `Project created from deal: ${deal.name}`,
                    visibility: "workspace",
                    created_by: user.id,
                    color: "#6366f1",
                })
                .select()
                .single()
            if (error) throw error

            // Link the deal to the new project via record_links
            await supabase.from("record_links").insert({
                workspace_id: workspaceId,
                source_type: "deal",
                source_id: deal.id,
                target_type: "project",
                target_id: project.id,
                relation_type: "generated_from",
                created_by: user.id,
            })

            toast.success("Project created from deal")
            onClose()
            if (onProjectCreated) onProjectCreated(project)
            navigate(`/projects/${project.id}`)
        } catch (err) {
            toast.error(err.message || "Failed to create project")
        } finally {
            setCreatingProject(false)
        }
    }

    if (loading) return <PanelShell onClose={onClose} badge="Deal"><div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div></PanelShell>
    if (!deal) return null

    const stage = stages.find((s) => s.id === deal.stage_id)
    const isOverdue = deal.expected_close_date && isPast(new Date(deal.expected_close_date)) && stage?.name !== "Closed Won" && stage?.name !== "Closed Lost"
    const isClosingSoon = deal.expected_close_date && !isOverdue && isWithinInterval(new Date(deal.expected_close_date), { start: new Date(), end: addDays(new Date(), 7) })

    return (
        <PanelShell
            onClose={onClose}
            badge="Deal"
            title={deal.name}
            subtitle={[stage?.name, deal.value ? `$${Number(deal.value).toLocaleString()}` : null].filter(Boolean).join(" · ")}
        >
            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 px-5">
                {["details", "activity", "tasks"].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`py-2.5 px-1 text-xs font-medium border-b-2 transition capitalize -mb-px ${activeTab === tab ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}>
                        {tab}
                    </button>
                ))}
            </div>

            <div className="p-5 space-y-4">
                {activeTab === "details" && (
                    <>
                        {(isOverdue || isClosingSoon) && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isOverdue ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`}>
                                <CalendarIcon className="size-4 flex-shrink-0" />
                                {isOverdue ? "Close date has passed" : `Closing within 7 days (${format(new Date(deal.expected_close_date), "MMM d")})`}
                            </div>
                        )}

                        <Field label="Deal Name" value={deal.name} onChange={(v) => setDeal({ ...deal, name: v })} />
                        <Field label="Description" value={deal.description} onChange={(v) => setDeal({ ...deal, description: v })} multiline placeholder="What is this deal about?" />

                        <div>
                            <p className={labelCls}>Stage</p>
                            <select value={deal.stage_id || ""} onChange={(e) => setDeal({ ...deal, stage_id: e.target.value })} className={inputCls}>
                                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className={labelCls}>Value ($)</p>
                                <input type="number" value={deal.value || ""} onChange={(e) => setDeal({ ...deal, value: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <p className={labelCls}>Probability (%)</p>
                                <input type="number" min="0" max="100" value={deal.probability || ""} onChange={(e) => setDeal({ ...deal, probability: e.target.value })} className={inputCls} placeholder="e.g. 60" />
                            </div>
                        </div>

                        <div>
                            <p className={labelCls}>Expected Close</p>
                            <input type="date" value={deal.expected_close_date || ""} onChange={(e) => setDeal({ ...deal, expected_close_date: e.target.value || null })} className={inputCls} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className={labelCls}>Contact</p>
                                <select value={deal.contact_id || ""} onChange={(e) => setDeal({ ...deal, contact_id: e.target.value || null })} className={inputCls}>
                                    <option value="">None</option>
                                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <p className={labelCls}>Company</p>
                                <select value={deal.company_id || ""} onChange={(e) => setDeal({ ...deal, company_id: e.target.value || null })} className={inputCls}>
                                    <option value="">None</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="text-xs text-zinc-400 dark:text-zinc-500">
                            Created {format(new Date(deal.created_at), "MMM d, yyyy")}
                        </div>

                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                            <button
                                onClick={handleCreateProject}
                                disabled={creatingProject}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-60"
                            >
                                {creatingProject ? <Loader2Icon className="size-4 animate-spin" /> : <FolderPlusIcon className="size-4" />}
                                Create Project from Deal
                            </button>
                            <div className="flex justify-between">
                                <button onClick={handleDelete} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition">
                                    <TrashIcon className="size-4" /> Delete
                                </button>
                                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60 hover:opacity-90 transition">
                                    {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />} Save
                                </button>
                            </div>
                        </div>
                    </>
                )}
                {activeTab === "activity" && (
                    <DealNotesSection dealId={id} workspaceId={workspaceId} />
                )}
                {activeTab === "tasks" && (
                    <LinkedTasksSection workspaceId={workspaceId} recordType="deal" recordId={id} />
                )}
            </div>
        </PanelShell>
    )
}
