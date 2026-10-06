// Compact "7/12 · 2 overdue" chip content. Returns null when there's no link.
export default function RollupChip({ stats, onDark = false }) {
    if (!stats) return null;
    if (stats.total === 0) return <span className={`text-[12px] ${onDark ? "text-ink-300" : "text-gray-400 dark:text-zinc-500"}`}>no tasks</span>;
    const pct = Math.round((stats.done / stats.total) * 100);
    return (
        <span className={`inline-flex items-center gap-1.5 text-[12px] tabular-nums ${onDark ? "text-ink-200" : "text-gray-500 dark:text-zinc-400"}`}>
            <span className={`w-12 h-1.5 rounded-full overflow-hidden ${onDark ? "bg-white/15" : "bg-gray-200 dark:bg-zinc-700"}`}>
                <span className="block h-full bg-signal-500" style={{ width: `${pct}%` }} />
            </span>
            {stats.done}/{stats.total}
            {stats.overdue > 0 && <span className={`font-semibold ${onDark ? "text-red-300" : "text-red-600 dark:text-red-400"}`}>{stats.overdue} overdue</span>}
        </span>
    );
}
