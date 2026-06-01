import { useState } from 'react';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronRightIcon, SettingsIcon, KanbanIcon, ChartColumnIcon, CalendarIcon, ArrowRightIcon, Layers } from 'lucide-react';
import { useSelector } from 'react-redux';

const ProjectSidebar = ({ compact = false }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [expandedSpaces, setExpandedSpaces] = useState(new Set())
    const [expandedProjects, setExpandedProjects] = useState(new Set())

    const spaces = useSelector((state) => state.workspace.spaces || [])
    const projects = useSelector((state) => state?.workspace?.currentWorkspace?.projects || [])

    const getProjectSubItems = (projectId) => [
        { title: 'Tasks', icon: KanbanIcon, url: `/projectsDetail?id=${projectId}&tab=tasks` },
        { title: 'Board', icon: KanbanIcon, url: `/projectsDetail?id=${projectId}&tab=board` },
        { title: 'Calendar', icon: CalendarIcon, url: `/projectsDetail?id=${projectId}&tab=calendar` },
        { title: 'Analytics', icon: ChartColumnIcon, url: `/projectsDetail?id=${projectId}&tab=analytics` },
        { title: 'Settings', icon: SettingsIcon, url: `/projectsDetail?id=${projectId}&tab=settings` },
    ]

    const toggleSpace = (id) => {
        const s = new Set(expandedSpaces)
        s.has(id) ? s.delete(id) : s.add(id)
        setExpandedSpaces(s)
    }

    const toggleProject = (id) => {
        const s = new Set(expandedProjects)
        s.has(id) ? s.delete(id) : s.add(id)
        setExpandedProjects(s)
    }

    const renderProject = (project, indent = false) => {
        const isExpanded = expandedProjects.has(project.id)
        return (
            <div key={project.id}>
                <button
                    onClick={() => toggleProject(project.id)}
                    className={`w-full flex items-center gap-2 py-1.5 rounded-md transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04] ${indent ? 'pl-4 pr-2.5' : 'px-2.5'}`}
                >
                    <ChevronRightIcon className={`size-3 text-zinc-400 dark:text-zinc-600 transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                    <div className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 flex-shrink-0" />
                    <span className="truncate text-[13px] font-medium">{project.name}</span>
                </button>

                {isExpanded && (
                    <div className={`space-y-0.5 mb-1 ${indent ? 'ml-9' : 'ml-5'}`}>
                        {getProjectSubItems(project.id).map((subItem) => {
                            const isActive =
                                location.pathname === '/projectsDetail' &&
                                searchParams.get('id') === project.id &&
                                searchParams.get('tab') === subItem.title.toLowerCase()
                            return (
                                <Link
                                    key={subItem.title}
                                    to={subItem.url}
                                    className={`flex items-center gap-2 px-2.5 py-1 rounded-md transition-colors text-[12px] ${isActive ? 'bg-white dark:bg-white/[0.07] text-zinc-900 dark:text-zinc-100 font-medium ring-1 ring-black/[0.06] dark:ring-white/[0.08]' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/[0.03]'}`}
                                >
                                    <subItem.icon className="size-3 flex-shrink-0" strokeWidth={1.5} />
                                    {subItem.title}
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    // Build grouped structure
    const spaceMap = new Map(spaces.map((s) => [s.id, s]))
    const unassigned = projects.filter((p) => !p.space_id || !spaceMap.has(p.space_id))

    return (
        <div className={compact ? "" : "mt-1"}>
            {!compact && (
                <div className="flex items-center justify-between px-2.5 py-1.5">
                    <h3 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                        Spaces
                    </h3>
                    <Link to="/spaces">
                        <button className="size-4 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded flex items-center justify-center transition-colors">
                            <ArrowRightIcon className="size-3" />
                        </button>
                    </Link>
                </div>
            )}

            <div className="space-y-0.5">
                {spaces.map((space) => {
                    const spaceProjects = projects.filter((p) => p.space_id === space.id)
                    const isExpanded = expandedSpaces.has(space.id)
                    return (
                        <div key={space.id}>
                            <button
                                onClick={() => toggleSpace(space.id)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04]"
                            >
                                <ChevronRightIcon className={`size-3 text-zinc-400 dark:text-zinc-600 transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: space.color }} />
                                <span className="truncate text-[13px] font-medium">{space.name}</span>
                                {spaceProjects.length > 0 && (
                                    <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-600 flex-shrink-0">{spaceProjects.length}</span>
                                )}
                            </button>

                            {isExpanded && (
                                <div className="space-y-0.5 mb-1">
                                    {spaceProjects.length === 0 ? (
                                        <button
                                            onClick={() => navigate(`/spaces/${space.id}`)}
                                            className="w-full text-left pl-9 pr-2.5 py-1 text-[12px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400"
                                        >
                                            No projects yet
                                        </button>
                                    ) : (
                                        spaceProjects.map((p) => renderProject(p, true))
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Unassigned projects */}
                {unassigned.length > 0 && (
                    <div>
                        <div className="px-2.5 py-1.5 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
                            <span className="text-[12px] text-zinc-400 dark:text-zinc-500">Unassigned</span>
                        </div>
                        {unassigned.map((p) => renderProject(p, true))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ProjectSidebar
