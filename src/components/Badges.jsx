// Status and priority, drawn the same way on every screen.
// Status is a coloured dot plus plain words (not a loud pill). Priority only shouts when it should:
// Urgent is red, High is amber, the rest stay quiet.

const STATUS = {
    ACTIVE:    { label: 'Active',    dot: 'bg-emerald-500' },
    PLANNING:  { label: 'Planning',  dot: 'bg-ink-400' },
    ON_HOLD:   { label: 'On hold',   dot: 'bg-signal-500' },
    COMPLETED: { label: 'Completed', dot: 'bg-ink-700' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-red-500' },
}

export function ProjectStatus({ status, className = '', onDark = false }) {
    const s = STATUS[status] || STATUS.PLANNING
    return (
        <span className={`inline-flex items-center gap-1.5 text-[13px] ${onDark ? 'text-ink-200' : 'text-gray-600 dark:text-zinc-300'} ${className}`}>
            <span className={`size-2 rounded-full ${s.dot}`} />{s.label}
        </span>
    )
}

const PRIORITY = {
    URGENT: 'text-red-600 dark:text-red-400 font-semibold',
    HIGH: 'text-signal-700 dark:text-signal-400 font-semibold',
    MEDIUM: 'text-gray-400 dark:text-zinc-500',
    LOW: 'text-gray-300 dark:text-zinc-600',
}

export function PriorityTag({ priority, className = '' }) {
    if (!priority || priority === 'MEDIUM' || priority === 'LOW') return null
    return <span className={`text-[12px] capitalize ${PRIORITY[priority]} ${className}`}>{priority.toLowerCase()}</span>
}
