import { useState, useEffect, useMemo } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useSearchParams } from "react-router-dom"
import { Plus, Search, FolderOpen, UploadIcon, Layers, ArchiveIcon } from "lucide-react"
import ProjectCard from "../components/ProjectCard"
import CreateProjectDialog from "../components/CreateProjectDialog"
import AsanaImport from "../components/AsanaImport"
import { archiveProjects } from "../features/workspaceSlice"
import toast from "react-hot-toast"

export default function Projects() {
    const dispatch = useDispatch()
    const projects = useSelector((state) => state?.workspace?.currentWorkspace?.projects || [])
    const spaces = useSelector((state) => state.workspace.spaces || [])

    const [searchParams] = useSearchParams()
    const spaceFilter = searchParams.get("space")

    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [defaultSpaceId, setDefaultSpaceId] = useState(spaceFilter || "")
    const [selectedProjects, setSelectedProjects] = useState([])

    useEffect(() => {
        if (spaceFilter) setDefaultSpaceId(spaceFilter)
    }, [spaceFilter])

    const filteredProjects = useMemo(() => {
        let filtered = projects
        if (spaceFilter) filtered = filtered.filter((p) => p.space_id === spaceFilter)
        if (searchTerm) filtered = filtered.filter((p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        if (statusFilter !== "ALL") filtered = filtered.filter((p) => p.status === statusFilter)
        return filtered
    }, [projects, spaceFilter, searchTerm, statusFilter])

    // Group projects by space
    const grouped = useMemo(() => {
        if (spaceFilter) {
            // Single space view — no grouping needed
            return null
        }
        const groups = []
        const spaceMap = new Map(spaces.map((s) => [s.id, s]))

        // Projects with a space
        spaces.forEach((space) => {
            const spaceProjects = filteredProjects.filter((p) => p.space_id === space.id)
            if (spaceProjects.length > 0) {
                groups.push({ space, projects: spaceProjects })
            }
        })

        // Unassigned projects
        const unassigned = filteredProjects.filter((p) => !p.space_id || !spaceMap.has(p.space_id))
        if (unassigned.length > 0) {
            groups.push({ space: null, projects: unassigned })
        }

        return groups
    }, [filteredProjects, spaces, spaceFilter])

    const activeSpaceName = spaceFilter ? spaces.find((s) => s.id === spaceFilter)?.name : null

    const toggleSelectProject = (id) => {
        setSelectedProjects((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        )
    }

    const handleArchiveProjects = async () => {
        try {
            toast.loading("Archiving projects...")
            await dispatch(archiveProjects({ projectIds: selectedProjects })).unwrap()
            setSelectedProjects([])
            toast.dismissAll()
            toast.success(`${selectedProjects.length} project${selectedProjects.length > 1 ? "s" : ""} archived`)
        } catch (err) {
            toast.dismissAll()
            toast.error(err || "Failed to archive projects")
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
                <div>
                    {activeSpaceName && (
                        <span className="text-[14px] text-gray-500 dark:text-zinc-400 flex items-center gap-1 mb-1">
                            <Layers className="size-3.5" /> {activeSpaceName}
                        </span>
                    )}
                    <h1 className="text-[34px] sm:text-[40px] font-bold tracking-tight leading-none text-ink-900 dark:text-white">Projects</h1>
                    <p className="mt-2 text-[15px] text-gray-500 dark:text-zinc-400">
                        {activeSpaceName ? `Projects in ${activeSpaceName}` : `${projects.length} across ${spaces.length} space${spaces.length === 1 ? "" : "s"}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center px-4 py-2.5 text-[14px] font-medium rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                    >
                        <UploadIcon className="size-3.5 mr-2" /> Import from Asana
                    </button>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center px-4 py-2.5 text-[14px] font-semibold rounded-lg bg-ink-900 hover:bg-ink-800 dark:bg-white dark:text-ink-950 text-white transition-colors"
                    >
                        <Plus className="size-3.5 mr-2" /> New project
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                    <input
                        onChange={(e) => setSearchTerm(e.target.value)}
                        value={searchTerm}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-ink-500"
                        placeholder="Search projects..."
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm outline-none"
                >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PLANNING">Planning</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {/* Bulk action bar */}
            {selectedProjects.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-signal-500/15 border border-signal-500/40">
                    <span className="text-sm text-ink-900 dark:text-signal-300 font-medium">
                        {selectedProjects.length} project{selectedProjects.length > 1 ? "s" : ""} selected
                    </span>
                    <button
                        onClick={handleArchiveProjects}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-signal-500 hover:bg-signal-400 text-ink-950 transition-colors"
                    >
                        <ArchiveIcon className="size-3.5" /> Archive
                    </button>
                    <button
                        onClick={() => setSelectedProjects([])}
                        className="text-sm text-gray-600 dark:text-zinc-300 hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Projects */}
            {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <FolderOpen className="size-10 text-gray-300 dark:text-zinc-700" />
                    <p className="font-display text-[20px] font-semibold text-gray-900 dark:text-white">No projects found</p>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-[14px] font-semibold rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 transition-colors"
                    >
                        <Plus className="size-3.5" /> New project
                    </button>
                </div>
            ) : spaceFilter || !grouped ? (
                <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProjects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            selected={selectedProjects.includes(project.id)}
                            onToggleSelect={toggleSelectProject}
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-8">
                    {grouped.map(({ space, projects: groupProjects }) => (
                        <div key={space?.id || "unassigned"}>
                            <div className="flex items-center gap-2.5 mb-4">
                                {space ? (
                                    <>
                                        <span className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                                        <h2 className="text-[20px] font-semibold text-gray-900 dark:text-white">{space.name}</h2>
                                        <span className="text-[13px] text-gray-400">{groupProjects.length} project{groupProjects.length !== 1 ? "s" : ""}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
                                        <h2 className="text-[20px] font-semibold text-gray-500 dark:text-zinc-400">Unassigned</h2>
                                        <span className="text-xs text-zinc-400 dark:text-zinc-600">{groupProjects.length} project{groupProjects.length !== 1 ? "s" : ""}</span>
                                    </>
                                )}
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {groupProjects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        selected={selectedProjects.includes(project.id)}
                                        onToggleSelect={toggleSelectProject}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateProjectDialog
                isDialogOpen={isDialogOpen}
                setIsDialogOpen={setIsDialogOpen}
                defaultSpaceId={defaultSpaceId}
            />
            <AsanaImport isOpen={isImportOpen} setIsOpen={setIsImportOpen} />
        </div>
    )
}
