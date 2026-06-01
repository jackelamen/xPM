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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        {activeSpaceName && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                <Layers className="size-3" /> {activeSpaceName} /
                            </span>
                        )}
                        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Projects</h1>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
                        {activeSpaceName ? `Projects in ${activeSpaceName}` : "All projects across all spaces"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center px-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                    >
                        <UploadIcon className="size-3.5 mr-2" /> Import from Asana
                    </button>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition"
                    >
                        <Plus className="size-3.5 mr-2" /> New Project
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
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Search projects..."
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm outline-none"
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
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                        {selectedProjects.length} project{selectedProjects.length > 1 ? "s" : ""} selected
                    </span>
                    <button
                        onClick={handleArchiveProjects}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white transition"
                    >
                        <ArchiveIcon className="size-3.5" /> Archive
                    </button>
                    <button
                        onClick={() => setSelectedProjects([])}
                        className="text-sm text-amber-700 dark:text-amber-400 hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Projects */}
            {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <FolderOpen className="size-10 text-zinc-300 dark:text-zinc-700" />
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">No projects found</p>
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                        <Plus className="size-3.5" /> New Project
                    </button>
                </div>
            ) : spaceFilter || !grouped ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                            <div className="flex items-center gap-2 mb-3">
                                {space ? (
                                    <>
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                                        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{space.name}</h2>
                                        <span className="text-xs text-zinc-400 dark:text-zinc-600">{groupProjects.length} project{groupProjects.length !== 1 ? "s" : ""}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
                                        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Unassigned</h2>
                                        <span className="text-xs text-zinc-400 dark:text-zinc-600">{groupProjects.length} project{groupProjects.length !== 1 ? "s" : ""}</span>
                                    </>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
