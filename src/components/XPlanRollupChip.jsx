// Compact "7/12 · 2 overdue" chip content. Returns null when there's no link.
export default function RollupChip({ stats }) {
    if (!stats) return null;
    if (stats.total === 0) return <span className="text-[11px] text-gray-400 dark:text-zinc-500">no tasks</span>;
    const pct = Math.round((stats.done / stats.total) * 100);
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400 tabular-nums">
            <span className="w-10 h-1 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                <span className="block h-full bg-green-500" style={{ width: `${pct}%` }} />
            </span>
            {stats.done}/{stats.total}
            {stats.overdue > 0 && <span className="text-red-600 dark:text-red-400 font-medium">{stats.overdue} overdue</span>}
        </span>
    );
}
