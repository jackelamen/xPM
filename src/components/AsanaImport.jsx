import { useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createProject, createTask, fetchWorkspaceDetail, upsertFieldDefinitions } from "../features/workspaceSlice";
import { UploadIcon, XIcon, Loader2Icon, CheckIcon, AlertCircleIcon } from "lucide-react";
import toast from "react-hot-toast";

function parseAsanaCSV(text) {
    const lines = text.split("\n").filter((l) => l.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase())

    const get = (row, name) => {
        // Exact match first, then fallback to includes
        let idx = headers.findIndex((h) => h === name)
        if (idx === -1) idx = headers.findIndex((h) => h.includes(name))
        if (idx === -1) return ""
        const val = row[idx] || ""
        return val.replace(/^"|"$/g, "").trim()
    }

    // Also validate date strings — return null if value is not a valid date
    const safeDate = (val) => {
        if (!val) return null
        const d = new Date(val)
        return isNaN(d.getTime()) ? null : val
    }

    const tasks = []
    for (let i = 1; i < lines.length; i++) {
        // Simple CSV split — handles quoted fields with commas
        const row = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || []

        const title = get(row, "name") || get(row, "task name")
        if (!title) continue

        const rawStatus = (get(row, "completed") || "").toLowerCase()
        const status = rawStatus === "true" || rawStatus === "yes" ? "DONE" : "TODO"

        const rawPriority = (get(row, "priority") || "").toUpperCase()
        const priority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(rawPriority) ? rawPriority : "MEDIUM"

        const dueDate = get(row, "due date") || get(row, "due_date") || ""

        const rawTags = get(row, "tags") || ""
        const rawStartDate = get(row, "start date") || get(row, "start_date") || ""

        tasks.push({
            title,
            description: get(row, "notes") || get(row, "description") || "",
            status,
            priority,
            type: "OTHER",
            start_date: safeDate(rawStartDate),
            due_date: safeDate(dueDate),
            custom_fields: {
                section: get(row, "section") || get(row, "section/column") || "",
                tags: rawTags,
            },
        })
    }
    return tasks
}

export default function AsanaImport({ isOpen, setIsOpen }) {
    const dispatch = useDispatch()
    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace)
    const fileRef = useRef(null)

    const [step, setStep] = useState("upload") // upload | preview | importing | done
    const [projectName, setProjectName] = useState("")
    const [parsedTasks, setParsedTasks] = useState([])
    const [importing, setImporting] = useState(false)
    const [importedCount, setImportedCount] = useState(0)

    const handleFile = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (!file.name.endsWith(".csv")) {
            toast.error("Please upload a .csv file")
            return
        }
        const reader = new FileReader()
        reader.onload = (ev) => {
            const tasks = parseAsanaCSV(ev.target.result)
            if (tasks.length === 0) {
                toast.error("No tasks found in this CSV. Make sure it's an Asana export.")
                return
            }
            setParsedTasks(tasks)
            setProjectName(file.name.replace(".csv", "").replace(/_/g, " "))
            setStep("preview")
        }
        reader.readAsText(file)
    }

    const handleImport = async () => {
        if (!currentWorkspace || !projectName.trim()) return
        setImporting(true)
        setStep("importing")
        try {
            // Create project
            const projectResult = await dispatch(createProject({
                workspaceId: currentWorkspace.id,
                name: projectName.trim(),
                description: `Imported from Asana on ${new Date().toLocaleDateString()}`,
                status: "ACTIVE",
            })).unwrap()

            // Seed field definitions for this project
            await dispatch(upsertFieldDefinitions({
                projectId: projectResult.id,
                fields: [
                    { key: "section", label: "Section", field_type: "text",  visible: true, position: 0 },
                    { key: "tags",    label: "Tags",    field_type: "tags",  visible: true, position: 1 },
                ],
            })).unwrap()

            // Create tasks one by one
            let count = 0
            for (const task of parsedTasks) {
                await dispatch(createTask({
                    workspaceId: currentWorkspace.id,
                    projectId: projectResult.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    type: task.type,
                    startDate: task.start_date,
                    dueDate: task.due_date,
                    customFields: task.custom_fields,
                })).unwrap()
                count++
                setImportedCount(count)
            }

            await dispatch(fetchWorkspaceDetail(currentWorkspace.id))
            setStep("done")
            toast.success(`Imported ${count} tasks into "${projectName}"`)
        } catch (err) {
            toast.error(err || "Import failed")
            setStep("preview")
        } finally {
            setImporting(false)
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setStep("upload")
        setParsedTasks([])
        setProjectName("")
        setImportedCount(0)
        if (fileRef.current) fileRef.current.value = ""
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-lg">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Import from Asana</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Upload an Asana CSV export to create a new project
                        </p>
                    </div>
                    <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <XIcon className="size-5" />
                    </button>
                </div>

                {step === "upload" && (
                    <div className="space-y-4">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
                        >
                            <UploadIcon className="size-8 text-zinc-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Click to upload your Asana CSV</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                Export from Asana: Project → Export/Print → CSV
                            </p>
                            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                            <p className="font-medium text-zinc-700 dark:text-zinc-300">How to export from Asana:</p>
                            <p>1. Open your project in Asana</p>
                            <p>2. Click the ··· menu → Export/Print</p>
                            <p>3. Select CSV</p>
                            <p>4. Upload the downloaded file here</p>
                        </div>
                    </div>
                )}

                {step === "preview" && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-zinc-600 dark:text-zinc-400">Project Name</label>
                            <input
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3">
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                {parsedTasks.length} tasks found
                            </p>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                {parsedTasks.slice(0, 20).map((t, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.status === "DONE" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                                        <span className="truncate">{t.title}</span>
                                        {t.priority !== "MEDIUM" && (
                                            <span className="text-zinc-400 flex-shrink-0">{t.priority}</span>
                                        )}
                                    </div>
                                ))}
                                {parsedTasks.length > 20 && (
                                    <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1">
                                        +{parsedTasks.length - 20} more tasks
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button onClick={() => setStep("upload")} className="px-4 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!projectName.trim()}
                                className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white disabled:opacity-60 hover:opacity-90 transition"
                            >
                                Import {parsedTasks.length} Tasks
                            </button>
                        </div>
                    </div>
                )}

                {step === "importing" && (
                    <div className="text-center py-8">
                        <Loader2Icon className="size-8 animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Importing tasks...
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                            {importedCount} of {parsedTasks.length} tasks imported
                        </p>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 mt-3">
                            <div
                                className="h-1.5 bg-blue-500 rounded-full transition-all"
                                style={{ width: `${parsedTasks.length ? (importedCount / parsedTasks.length) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {step === "done" && (
                    <div className="text-center py-8">
                        <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                            <CheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Import complete!
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                            {importedCount} tasks imported into "{projectName}"
                        </p>
                        <button
                            onClick={handleClose}
                            className="mt-4 px-4 py-2 text-sm rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 transition"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
