import { useState, useRef, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, FolderIcon, CheckSquareIcon, XIcon } from 'lucide-react'

export default function GlobalSearch({ className = '' }) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRef = useRef(null)
    const containerRef = useRef(null)
    const navigate = useNavigate()

    const currentWorkspace = useSelector((state) => state.workspace?.currentWorkspace)

    const results = useMemo(() => {
        if (!query.trim() || !currentWorkspace) return []
        const q = query.toLowerCase()
        const items = []

        // Search projects
        for (const project of currentWorkspace.projects || []) {
            if (
                project.name?.toLowerCase().includes(q) ||
                project.description?.toLowerCase().includes(q)
            ) {
                items.push({
                    type: 'project',
                    id: project.id,
                    title: project.name,
                    subtitle: project.status,
                    url: `/projectsDetail?id=${project.id}&tab=tasks`,
                })
            }

            // Search tasks within project
            for (const task of project.tasks || []) {
                if (
                    task.title?.toLowerCase().includes(q) ||
                    task.description?.toLowerCase().includes(q)
                ) {
                    items.push({
                        type: 'task',
                        id: task.id,
                        title: task.title,
                        subtitle: project.name,
                        projectId: project.id,
                        taskId: task.id,
                        url: `/projectsDetail?id=${project.id}&tab=tasks`,
                    })
                }
            }
        }

        return items.slice(0, 8)
    }, [query, currentWorkspace])

    useEffect(() => {
        setSelectedIndex(0)
    }, [results])

    useEffect(() => {
        function handleClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Global keyboard shortcut: Cmd+K
    useEffect(() => {
        function handleKeyDown(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                inputRef.current?.focus()
                setOpen(true)
            }
            if (e.key === 'Escape') {
                setOpen(false)
                setQuery('')
                inputRef.current?.blur()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            selectResult(results[selectedIndex])
        }
    }

    const selectResult = (result) => {
        navigate(result.url)
        setQuery('')
        setOpen(false)
        inputRef.current?.blur()
    }

    return (
        <div ref={containerRef} className={`relative flex-1 max-w-md ${className}`}>
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 size-3.5 pointer-events-none" />
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search projects, tasks... (⌘K)"
                className="pl-8 pr-8 py-1.5 w-full bg-transparent border-0 rounded-md text-[13px] text-gray-700 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:bg-gray-100 dark:focus:bg-white/[0.06] transition-colors"
            />
            {query && (
                <button
                    onClick={() => { setQuery(''); setOpen(false) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                    <XIcon className="size-3.5" />
                </button>
            )}

            {open && query.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden">
                    {results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                            No results for "{query}"
                        </div>
                    ) : (
                        <ul>
                            {results.map((result, i) => (
                                <li key={`${result.type}-${result.id}`}>
                                    <button
                                        onClick={() => selectResult(result)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                            i === selectedIndex
                                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        <div className={`flex-shrink-0 size-7 rounded flex items-center justify-center ${
                                            result.type === 'project'
                                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                                                : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                                        }`}>
                                            {result.type === 'project'
                                                ? <FolderIcon className="size-3.5" />
                                                : <CheckSquareIcon className="size-3.5" />
                                            }
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                                                {result.title}
                                            </p>
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                                                {result.type === 'project' ? 'Project' : result.subtitle}
                                            </p>
                                        </div>
                                        <span className="text-xs text-zinc-300 dark:text-zinc-600 flex-shrink-0">
                                            {result.type}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-2 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
                        <span>↑↓ navigate</span>
                        <span>↵ select</span>
                        <span>esc close</span>
                    </div>
                </div>
            )}
        </div>
    )
}
