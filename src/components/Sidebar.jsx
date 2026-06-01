import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import ProjectSidebar from './ProjectsSidebar'
import WorkspaceDropdown from './WorkspaceDropdown'
import { useSelector } from 'react-redux'
import {
    LayoutDashboardIcon, SettingsIcon, UsersIcon, ContactIcon,
    UsersRoundIcon, CheckSquareIcon, ArchiveIcon, Layers,
    FolderOpenIcon, ChevronRightIcon,
} from 'lucide-react'

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const navigate = useNavigate()
    const spaces = useSelector((s) => s.workspace.spaces || [])
    const projects = useSelector((s) => s.workspace.currentWorkspace?.projects || [])

    const [spacesExpanded, setSpacesExpanded] = useState(false)
    const [projectsExpanded, setProjectsExpanded] = useState(false)

    const activeClass = 'bg-white dark:bg-white/[0.07] text-gray-900 dark:text-white shadow-sm shadow-black/5 dark:shadow-none ring-1 ring-black/[0.06] dark:ring-white/[0.08]'
    const inactiveClass = 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04]'
    const baseClass = 'flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all text-[14px] font-medium mb-1'

    const navLinkClass = ({ isActive }) => `${baseClass} ${isActive ? activeClass : inactiveClass}`

    const simpleItems = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboardIcon },
        { name: 'My Tasks', href: '/my-tasks', icon: CheckSquareIcon },
    ]

    const bottomItems = [
        { name: 'Workload', href: '/workload', icon: UsersRoundIcon },
        { name: 'CRM', href: '/crm', icon: ContactIcon },
        { name: 'Team', href: '/team', icon: UsersIcon },
        { name: 'Archive', href: '/archive', icon: ArchiveIcon },
    ]

    const sidebarRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsSidebarOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [setIsSidebarOpen])

    return (
        <div ref={sidebarRef} className={`z-10 bg-white/70 dark:bg-black/40 backdrop-blur-xl min-w-[220px] flex flex-col h-screen border-r border-white/50 dark:border-white/[0.06] max-sm:absolute transition-all ${isSidebarOpen ? 'left-0' : '-left-full'}`}>
            <WorkspaceDropdown />
            <div className='flex-1 overflow-y-scroll no-scrollbar flex flex-col py-3'>
                <div className='px-3'>

                    {/* Simple nav items */}
                    {simpleItems.map((item) => (
                        <NavLink to={item.href} key={item.name} end={item.href === '/'} className={navLinkClass}>
                            <item.icon size={16} strokeWidth={1.75} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}

                    {/* Spaces — nav tab + expand arrow */}
                    <div className='mb-0.5'>
                        <div className='flex items-center rounded-md overflow-hidden'>
                            <NavLink
                                to='/spaces'
                                className={({ isActive }) => `flex items-center gap-3 py-2.5 pl-3 pr-1 flex-1 rounded-lg transition-all text-[14px] font-medium ${isActive ? activeClass : inactiveClass}`}
                            >
                                <Layers size={16} strokeWidth={1.75} />
                                <span>Spaces</span>
                            </NavLink>
                            <button
                                onClick={() => setSpacesExpanded((v) => !v)}
                                className={`p-1.5 rounded-md transition-all ${inactiveClass}`}
                                title={spacesExpanded ? 'Collapse' : 'Expand'}
                            >
                                <ChevronRightIcon size={11} className={`transition-transform duration-150 ${spacesExpanded ? 'rotate-90' : ''}`} />
                            </button>
                        </div>

                        {spacesExpanded && (
                            <div className='mt-0.5 mb-1 space-y-0.5'>
                                {spaces.length === 0 ? (
                                    <p className='pl-8 text-[11px] text-zinc-400 dark:text-zinc-600 py-1'>No spaces yet</p>
                                ) : spaces.map((space) => (
                                    <button
                                        key={space.id}
                                        onClick={() => navigate(`/spaces/${space.id}`)}
                                        className={`w-full flex items-center gap-2 pl-7 pr-2.5 py-1 rounded-md text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors`}
                                    >
                                        <span className='w-2 h-2 rounded-full flex-shrink-0' style={{ backgroundColor: space.color }} />
                                        <span className='truncate'>{space.name}</span>
                                        <span className='ml-auto text-[10px] text-zinc-400 dark:text-zinc-600'>
                                            {projects.filter((p) => p.space_id === space.id).length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Projects — nav tab + expand arrow */}
                    <div className='mb-0.5'>
                        <div className='flex items-center rounded-md overflow-hidden'>
                            <NavLink
                                to='/projects'
                                className={({ isActive }) => `flex items-center gap-3 py-2.5 pl-3 pr-1 flex-1 rounded-lg transition-all text-[14px] font-medium ${isActive ? activeClass : inactiveClass}`}
                            >
                                <FolderOpenIcon size={16} strokeWidth={1.75} />
                                <span>Projects</span>
                            </NavLink>
                            <button
                                onClick={() => setProjectsExpanded((v) => !v)}
                                className={`p-1.5 rounded-md transition-all ${inactiveClass}`}
                                title={projectsExpanded ? 'Collapse' : 'Expand'}
                            >
                                <ChevronRightIcon size={11} className={`transition-transform duration-150 ${projectsExpanded ? 'rotate-90' : ''}`} />
                            </button>
                        </div>

                        {projectsExpanded && (
                            <div className='mt-0.5 mb-1'>
                                <ProjectSidebar compact />
                            </div>
                        )}
                    </div>

                    {/* Bottom nav items */}
                    {bottomItems.map((item) => (
                        <NavLink to={item.href} key={item.name} className={navLinkClass}>
                            <item.icon size={16} strokeWidth={1.75} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                </div>
            </div>

            {/* Settings pinned to bottom */}
            <div className='px-3 py-3 border-t border-gray-200/80 dark:border-white/[0.06]'>
                <NavLink to='/settings' className={navLinkClass}>
                    <SettingsIcon size={14} strokeWidth={1.75} />
                    <span>Settings</span>
                </NavLink>
            </div>
        </div>
    )
}

export default Sidebar
