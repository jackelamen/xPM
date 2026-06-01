import { useState } from "react"
import { XIcon, Loader2Icon } from "lucide-react"
import { useDispatch, useSelector } from "react-redux"
import { createSpace, updateSpace } from "../features/workspaceSlice"
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
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setIsSubmitting(true)
        try {
            if (editSpace) {
                await dispatch(updateSpace({ spaceId: editSpace.id, name: name.trim(), description, color })).unwrap()
                toast.success("Space updated")
            } else {
                await dispatch(createSpace({ workspaceId: currentWorkspace.id, name: name.trim(), description, color })).unwrap()
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
                <button
                    className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
                    onClick={onClose}
                >
                    <XIcon className="size-4" />
                </button>

                <h2 className="text-base font-semibold mb-4">{editSpace ? "Edit Space" : "New Space"}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition"
                        >
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
