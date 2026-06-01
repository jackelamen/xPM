import { useState, useRef } from "react"
import { XIcon, Loader2Icon, UploadIcon } from "lucide-react"
import { useDispatch, useSelector } from "react-redux"
import { createSpace, updateSpace } from "../features/workspaceSlice"
import { supabase } from "../lib/supabase"
import toast from "react-hot-toast"

const COLORS = [
    "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
    "#f97316", "#64748b",
]

const CreateSpaceDialog = ({ isOpen, onClose, editSpace = null }) => {
    const dispatch = useDispatch()
    const { currentWorkspace } = useSelector((state) => state.workspace)

    const [name, setName] = useState(editSpace?.name || "")
    const [description, setDescription] = useState(editSpace?.description || "")
    const [color, setColor] = useState(editSpace?.color || "#6366f1")
    const [iconUrl, setIconUrl] = useState(editSpace?.icon_url || "")
    const [uploading, setUploading] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const fileRef = useRef()

    const handleIconUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            // Use a temp ID for new spaces, real ID for edits
            const folder = editSpace?.id || `new_${Date.now()}`
            const ext = file.name.split('.').pop()
            const path = `spaces/${folder}/icon.${ext}`
            const { error: upErr } = await supabase.storage
                .from('workspace-assets')
                .upload(path, file, { upsert: true })
            if (upErr) throw upErr
            const { data } = supabase.storage.from('workspace-assets').getPublicUrl(path)
            setIconUrl(data.publicUrl + '?t=' + Date.now())
            toast.success('Icon uploaded')
        } catch (err) {
            toast.error(err.message || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setIsSubmitting(true)
        try {
            if (editSpace) {
                await dispatch(updateSpace({ spaceId: editSpace.id, name: name.trim(), description, color, icon_url: iconUrl || null })).unwrap()
                toast.success("Space updated")
            } else {
                await dispatch(createSpace({ workspaceId: currentWorkspace.id, name: name.trim(), description, color, icon_url: iconUrl || null })).unwrap()
                toast.success("Space created")
            }
            onClose()
        } catch (err) {
            toast.error(err || "Failed to save space")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200 relative">
                <button className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200" onClick={onClose}>
                    <XIcon className="size-4" />
                </button>

                <h2 className="text-base font-semibold mb-4">{editSpace ? "Edit Space" : "New Space"}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Icon upload */}
                    <div>
                        <label className="block text-sm mb-2 text-zinc-700 dark:text-zinc-300">Icon <span className="text-zinc-400">(optional)</span></label>
                        <div className="flex items-center gap-3">
                            <div
                                onClick={() => fileRef.current?.click()}
                                className="size-12 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center cursor-pointer hover:border-zinc-400 transition-colors overflow-hidden relative group"
                            >
                                {uploading ? (
                                    <Loader2Icon className="size-4 animate-spin text-zinc-400" />
                                ) : iconUrl ? (
                                    <img src={iconUrl} alt="space icon" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="size-6 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                )}
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                    <UploadIcon className="size-3 text-white" />
                                </div>
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                            <div className="text-xs text-zinc-400">
                                <p>Click to upload an image</p>
                                <p>PNG, JPG, SVG — max 2MB</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-zinc-700 dark:text-zinc-300">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. SHOPLINE Korea, Signal 7 Internal"
                            className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-zinc-700 dark:text-zinc-300">Description <span className="text-zinc-400">(optional)</span></label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What is this space for?"
                            className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-1 focus:ring-blue-500 h-16 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2 text-zinc-700 dark:text-zinc-300">Color</label>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-7 h-7 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-zinc-400 dark:ring-zinc-500 scale-110" : "hover:scale-105"}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting || !name.trim()}
                            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50 transition">
                            {isSubmitting && <Loader2Icon className="size-3.5 animate-spin" />}
                            {editSpace ? "Save Changes" : "Create Space"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateSpaceDialog
