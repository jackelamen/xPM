import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import ProjectSidebar from './ProjectsSidebar'
import WorkspaceDropdown from './WorkspaceDropdown'
import { useSelector } from 'react-redux'
import {
    LayoutDashboardIcon, SettingsIcon, UsersIcon, ContactIcon,
    UsersRoundIcon, CheckSquareIcon, ArchiveIcon, Layers,
    FolderOpenIcon, ChevronRightIcon, PanelLeftCloseIcon, PanelLeftOpenIcon,
    BuildingIcon, Globe2Icon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const COLLAPSED_KEY = 'xpm_sidebar_collapsed'

// ── Tooltip for icon-only mode ────────────────────────────────────────────────
function Tip({ label, children }) {
    return (
        <div className="relative group/tip">
            {children}
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50
                px-2 py-1 rounded-md bg-gray-900 dark:bg-zinc-100 text-white dark:text-gray-900
                text-[11px] font-medium whitespace-nowrap shadow-lg
                opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
                {label}
            </div>
        </div>
    )
}

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
    const navigate = useNavigate()
    const spaces   = useSelector((s) => s.workspace.spaces || [])
    const projects = useSelector((s) => s.workspace.currentWorkspace?.projects || [])
    const currentWorkspace = useSelector((s) => s.workspace.currentWorkspace)
    const { isSuperadmin } = useAuth()

    const [spacesExpanded,   setSpacesExpanded]   = useState(false)
    const [projectsExpanded, setProjectsExpanded] = useState(false)

    const [collapsed, setCollapsed] = useState(() => {
        try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY)) === true }
        catch { return false }
    })

    const toggleCollapsed = () => {
        const next = !collapsed
        setCollapsed(next)
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next))
        if (next) { setSpacesExpanded(false); setProjectsExpanded(false) }
    }

    const activeClass   = 'bg-white dark:bg-white/[0.07] text-gray-900 dark:text-white shadow-sm shadow-black/5 dark:shadow-none ring-1 ring-black/[0.06] dark:ring-white/[0.08]'
    const inactiveClass = 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04]'
    const baseClass     = 'flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all text-[14px] font-medium mb-1'
    const navLinkClass  = ({ isActive }) => `${baseClass} ${isActive ? activeClass : inactiveClass}`

    const simpleItems = [
        { name: 'Dashboard', href: '/',         icon: LayoutDashboardIcon },
        { name: 'My Tasks',  href: '/my-tasks', icon: CheckSquareIcon },
        ...(isSuperadmin ? [{ name: 'All Workspaces', href: '/all-tasks', icon: Globe2Icon }] : []),
    ]
    const bottomItems = [
        { name: 'Workload', href: '/workload', icon: UsersRoundIcon },
        { name: 'CRM',      href: '/crm',      icon: ContactIcon },
        { name: 'Team',     href: '/team',      icon: UsersIcon },
        { name: 'Archive',  href: '/archive',   icon: ArchiveIcon },
    ]

    const sidebarRef = useRef(null)
    useEffect(() => {
        const h = (e) => {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target))
                setIsSidebarOpen(false)
        }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [setIsSidebarOpen])

    // ── Shared wrapper classes ────────────────────────────────────────────────
    const wrapperBase = `z-10 bg-white/70 dark:bg-black/40 backdrop-blur-xl flex-shrink-0 flex flex-col h-screen
        border-r border-white/50 dark:border-white/[0.06] transition-all duration-200
        sm:relative sm:translate-x-0
        max-sm:fixed max-sm:top-0 max-sm:left-0 max-sm:z-10
        ${isSidebarOpen ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full'}`

    // ── Collapsed (icon-only) mode ────────────────────────────────────────────
    if (collapsed) {
        const iconLink = (href, Icon, label, end = false) => (
            <Tip key={href} label={label}>
                <NavLink to={href} end={end}
                    className={({ isActive }) =>
                        `flex items-center justify-center w-9 h-9 rounded-lg mb-0.5 transition-all
                        ${isActive ? activeClass : inactiveClass}`
                    }>
                    <Icon size={16} strokeWidth={1.75} />
                </NavLink>
            </Tip>
        )

        return (
            <div ref={sidebarRef} className={`${wrapperBase} w-[56px]`}>
                {/* Workspace icon — click to expand */}
                <div className="flex items-center justify-center py-[13px] border-b border-white/50 dark:border-white/[0.06]">
                    <Tip label={currentWorkspace?.name || 'Workspace'}>
                        <button onClick={toggleCollapsed}
                            className="flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden flex-shrink-0
                                hover:ring-2 hover:ring-blue-400 transition-all">
                            {currentWorkspace?.icon_url
                                ? <img src={currentWorkspace.icon_url} alt={currentWorkspace.name} className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-gray-900 dark:bg-zinc-200 flex items-center justify-center">
                                    {currentWorkspace
                                        ? <span className="text-white dark:text-zinc-900 font-bold text-[11px]">
                                            {currentWorkspace.name?.slice(0,2).toUpperCase()}
                                          </span>
                                        : <BuildingIcon size={14} className="text-white" />
                                    }
                                  </div>
                            }
                        </button>
                    </Tip>
                </div>

                {/* Nav icons */}
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center py-3 px-[7px]">
                    {simpleItems.map((i) => iconLink(i.href, i.icon, i.name, i.href === '/'))}

                    <Tip label="Spaces">
                        <NavLink to="/spaces"
                            className={({ isActive }) =>
                                `flex items-center justify-center w-9 h-9 rounded-lg mb-0.5 transition-all
                                ${isActive ? activeClass : inactiveClass}`
                            }>
                            <Layers size={16} strokeWidth={1.75} />
                        </NavLink>
                    </Tip>
                    <Tip label="Projects">
                        <NavLink to="/projects"
                            className={({ isActive }) =>
                                `flex items-center justify-center w-9 h-9 rounded-lg mb-0.5 transition-all
                                ${isActive ? activeClass : inactiveClass}`
                            }>
                            <FolderOpenIcon size={16} strokeWidth={1.75} />
                        </NavLink>
                    </Tip>

                    {bottomItems.map((i) => iconLink(i.href, i.icon, i.name))}
                </div>

                {/* Bottom: settings + toggle */}
                <div className="flex flex-col items-center px-[7px] py-3 border-t border-gray-200/80 dark:border-white/[0.06] gap-0.5">
                    <Tip label="Settings">
                        <NavLink to="/settings"
                            className={({ isActive }) =>
                                `flex items-center justify-center w-9 h-9 rounded-lg transition-all
                                ${isActive ? activeClass : inactiveClass}`
                            }>
                            <SettingsIcon size={14} strokeWidth={1.75} />
                        </NavLink>
                    </Tip>
                    <Tip label="Expand">
                        <button onClick={toggleCollapsed}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${inactiveClass}`}>
                            <PanelLeftOpenIcon size={15} strokeWidth={1.75} />
                        </button>
                    </Tip>
                </div>
            </div>
        )
    }

    // ── Expanded mode ─────────────────────────────────────────────────────────
    return (
        <div ref={sidebarRef} className={`${wrapperBase} w-[220px]`}>
            {/* Workspace dropdown */}
            <WorkspaceDropdown />

            <div className='flex-1 overflow-y-scroll no-scrollbar flex flex-col py-3'>
                <div className='px-3'>
                    {simpleItems.map((item) => (
                        <NavLink to={item.href} key={item.name} end={item.href === '/'} className={navLinkClass}>
                            <item.icon size={16} strokeWidth={1.75} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}

                    {/* Spaces */}
                    <div className='mb-0.5'>
                        <div className='flex items-center rounded-md overflow-hidden'>
                            <NavLink to='/spaces'
                                className={({ isActive }) =>
                                    `flex items-center gap-3 py-2.5 pl-3 pr-1 flex-1 rounded-lg transition-all text-[14px] font-medium ${isActive ? activeClass : inactiveClass}`
                                }>
                                <Layers size={16} strokeWidth={1.75} />
                                <span>Spaces</span>
                            </NavLink>
                            <button onClick={() => setSpacesExpanded((v) => !v)}
                                className={`p-1.5 rounded-md transition-all ${inactiveClass}`}>
                                <ChevronRightIcon size={11} className={`transition-transform duration-150 ${spacesExpanded ? 'rotate-90' : ''}`} />
                            </button>
                        </div>
                        {spacesExpanded && (
                            <div className='mt-0.5 mb-1 space-y-0.5'>
                                {spaces.length === 0
                                    ? <p className='pl-8 text-[11px] text-zinc-400 dark:text-zinc-600 py-1'>No spaces yet</p>
                                    : spaces.map((space) => (
                                        <button key={space.id}
                                            onClick={() => navigate(`/spaces/${space.id}`)}
                                            className='w-full flex items-center gap-2 pl-7 pr-2.5 py-1 rounded-md text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors'>
                                            <span className='w-2 h-2 rounded-full flex-shrink-0' style={{ backgroundColor: space.color }} />
                                            <span className='truncate'>{space.name}</span>
                                            <span className='ml-auto text-[10px] text-zinc-400 dark:text-zinc-600'>
                                                {projects.filter((p) => p.space_id === space.id).length}
                                            </span>
                                        </button>
                                    ))
                                }
                            </div>
                        )}
                    </div>

                    {/* Projects */}
                    <div className='mb-0.5'>
                        <div className='flex items-center rounded-md overflow-hidden'>
                            <NavLink to='/projects'
                                className={({ isActive }) =>
                                    `flex items-center gap-3 py-2.5 pl-3 pr-1 flex-1 rounded-lg transition-all text-[14px] font-medium ${isActive ? activeClass : inactiveClass}`
                                }>
                                <FolderOpenIcon size={16} strokeWidth={1.75} />
                                <span>Projects</span>
                            </NavLink>
                            <button onClick={() => setProjectsExpanded((v) => !v)}
                                className={`p-1.5 rounded-md transition-all ${inactiveClass}`}>
                                <ChevronRightIcon size={11} className={`transition-transform duration-150 ${projectsExpanded ? 'rotate-90' : ''}`} />
                            </button>
                        </div>
                        {projectsExpanded && (
                            <div className='mt-0.5 mb-1'>
                                <ProjectSidebar compact />
                            </div>
                        )}
                    </div>

                    {bottomItems.map((item) => (
                        <NavLink to={item.href} key={item.name} className={navLinkClass}>
                            <item.icon size={16} strokeWidth={1.75} />
                            <span>{item.name}</span>
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className='px-3 py-3 border-t border-gray-200/80 dark:border-white/[0.06] flex items-center gap-1'>
                <NavLink to='/settings' className={({ isActive }) => `${baseClass} flex-1 ${isActive ? activeClass : inactiveClass}`}>
                    <SettingsIcon size={14} strokeWidth={1.75} />
                    <span>Settings</span>
                </NavLink>
                <button onClick={toggleCollapsed} title="Collapse sidebar"
                    className={`p-2 rounded-lg transition-all flex-shrink-0 ${inactiveClass}`}>
                    <PanelLeftCloseIcon size={15} strokeWidth={1.75} />
                </button>
            </div>
        </div>
    )
}

export default Sidebar
