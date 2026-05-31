import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import {
    PlusIcon, Loader2Icon, SaveIcon, TrashIcon, XIcon,
    FileTextIcon, UsersIcon, LightbulbIcon, BookOpenIcon, LayoutIcon
} from "lucide-react"
import { format } from "date-fns"
import toast from "react-hot-toast"

const NOTE_TYPES = [
    { value: "general", label: "General", icon: FileTextIcon, color: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" },
    { value: "meeting", label: "Meeting", icon: UsersIcon, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
    { value: "decision", label: "Decision", icon: LightbulbIcon, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
    { value: "brief", label: "Brief", icon: BookOpenIcon, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
    { value: "planning", label: "Planning", icon: LayoutIcon, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
]

const noteTypeConfig = (type) => NOTE_TYPES.find(t => t.value === type) || NOTE_TYPES[0]

// Simple auto-growing textarea
function AutoTextarea({ value, onChange, placeholder, className }) {
    const ref = useRef(null)
    useEffect(() => {
        if (ref.current) {
            ref.current.style.height = "auto"
            ref.current.style.height = ref.current.scrollHeight + "px"
        }
    }, [value])
    return (
        <textarea
            ref={ref}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={className}
            rows={4}
            style={{ resize: "none", overflow: "hidden" }}
        />
    )
}

// Individual note card in edit mode
function NoteEditor({ note, onSave, onCancel, onDelete, isNew = false }) {
    const [title, setTitle] = useState(note.title || "")
    const [body, setBody] = useState(note.body || "")
    const [noteType, setNoteType] = useState(note.note_type || "general")
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!title.trim()) { toast.error("Title is required"); return }
        setSaving(true)
        await onSave({ title: title.trim(), body, note_type: noteType })
        setSaving(false)
    }

    return (
        <div className="border-2 border-blue-300 dark:border-blue-600 rounded-xl p-4 space-y-3 bg-white dark:bg-zinc-950 shadow-sm">
            {/* Type selector */}
            <div className="flex gap-1 flex-wrap">
                {NOTE_TYPES.map(nt => (
                    <button key={nt.value} type="button" onClick={() => setNoteType(nt.value)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition ${noteType === nt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}>
                        <nt.icon className="size-3" /> {nt.label}
                    </button>
                ))}
            </div>
            {/* Title */}
            <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full text-base font-semibold text-zinc-900 dark:text-white bg-transparent border-0 focus:outline-none placeholder-zinc-400"
            />
            {/* Body */}
            <AutoTextarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your note here..."
                className="w-full text-sm text-zinc-700 dark:text-zinc-300 bg-transparent border-0 focus:outline-none placeholder-zinc-400 leading-relaxed"
            />
            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {!isNew && (
                    <button onClick={onDelete} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition">
                        <TrashIcon className="size-4" /> Delete
                    </button>
                )}
                <div className={`flex gap-2 ${isNew ? "ml-auto" : ""}`}>
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving || !title.trim()}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60 hover:opacity-90 transition">
                        {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
                        {isNew ? "Create Note" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Individual note card in view mode
function NoteCard({ note, onEdit }) {
    const config = noteTypeConfig(note.note_type)
    const Icon = config.icon
    return (
        <div
            onClick={onEdit}
            className="group border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-600 cursor-pointer transition space-y-2"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.color}`}>
                        <Icon className="size-3" /> {config.label}
                    </span>
                </div>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                    {format(new Date(note.updated_at || note.created_at), "MMM d, yyyy")}
                </span>
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm leading-snug">{note.title}</h3>
            {note.body && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                    {note.body}
                </p>
            )}
            <div className="pt-1">
                <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition">Click to edit</span>
            </div>
        </div>
    )
}

export default function ProjectNotes({ projectId }) {
    const { user } = useAuth()
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState(null) // null = none, "new" = creating
    const [filterType, setFilterType] = useState("")

    useEffect(() => { fetchNotes() }, [projectId])

    const fetchNotes = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("project_notes")
            .select("*")
            .eq("project_id", projectId)
            .order("updated_at", { ascending: false })
        setNotes(data || [])
        setLoading(false)
    }

    const handleCreate = async ({ title, body, note_type }) => {
        const { data, error } = await supabase.from("project_notes").insert({
            project_id: projectId,
            title,
            body: body || null,
            note_type,
            created_by: user.id,
            updated_by: user.id,
        }).select().single()
        if (error) { toast.error("Failed to create note"); return }
        setNotes(prev => [data, ...prev])
        setEditingId(null)
        toast.success("Note created")
    }

    const handleUpdate = async (id, { title, body, note_type }) => {
        const { data, error } = await supabase.from("project_notes").update({
            title,
            body: body || null,
            note_type,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        }).eq("id", id).select().single()
        if (error) { toast.error("Failed to save note"); return }
        setNotes(prev => prev.map(n => n.id === id ? data : n))
        setEditingId(null)
        toast.success("Note saved")
    }

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this note?")) return
        await supabase.from("project_notes").delete().eq("id", id)
        setNotes(prev => prev.filter(n => n.id !== id))
        setEditingId(null)
        toast.success("Note deleted")
    }

    const filtered = filterType ? notes.filter(n => n.note_type === filterType) : notes

    if (loading) return <div className="flex justify-center py-12"><Loader2Icon className="size-6 animate-spin text-zinc-400" /></div>

    return (
        <div className="space-y-4 max-w-4xl">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                    <button onClick={() => setFilterType("")}
                        className={`px-3 py-1 text-xs rounded-full border transition ${!filterType ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}>
                        All ({notes.length})
                    </button>
                    {NOTE_TYPES.map(nt => {
                        const count = notes.filter(n => n.note_type === nt.value).length
                        if (count === 0) return null
                        return (
                            <button key={nt.value} onClick={() => setFilterType(nt.value)}
                                className={`px-3 py-1 text-xs rounded-full border transition ${filterType === nt.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"}`}>
                                {nt.label} ({count})
                            </button>
                        )
                    })}
                </div>
                <button
                    onClick={() => setEditingId("new")}
                    disabled={editingId === "new"}
                    className="ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition disabled:opacity-60"
                >
                    <PlusIcon className="size-4" /> New Note
                </button>
            </div>

            {/* New note form */}
            {editingId === "new" && (
                <NoteEditor
                    note={{}}
                    isNew
                    onSave={handleCreate}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => setEditingId(null)}
                />
            )}

            {/* Notes grid */}
            {filtered.length === 0 && editingId !== "new" ? (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
                    <FileTextIcon className="size-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{filterType ? `No ${filterType} notes yet` : "No notes yet"}</p>
                    <p className="text-xs mt-1">Create notes to document decisions, meetings, and project context.</p>
                </div>
            ) : (
                <div className="columns-1 md:columns-2 gap-4 space-y-4">
                    {filtered.map(note => {
                        if (editingId === note.id) {
                            return (
                                <div key={note.id} className="break-inside-avoid mb-4">
                                    <NoteEditor
                                        note={note}
                                        onSave={(data) => handleUpdate(note.id, data)}
                                        onCancel={() => setEditingId(null)}
                                        onDelete={() => handleDelete(note.id)}
                                    />
                                </div>
                            )
                        }
                        return (
                            <div key={note.id} className="break-inside-avoid mb-4">
                                <NoteCard note={note} onEdit={() => setEditingId(note.id)} />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
