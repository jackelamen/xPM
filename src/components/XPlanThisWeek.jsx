import { Link } from "react-router-dom";
import { Loader2Icon, AlertTriangleIcon, ZapIcon, CalendarClockIcon, LinkIcon, ArrowUpRightIcon } from "lucide-react";
import { format } from "date-fns";
import RollupChip from "./XPlanRollupChip";
import { useThisWeek, NOW_CAP, SOON_DAYS, day } from "../lib/useThisWeek";

function Card({ icon, title, tone, count, children }) {
    const Icon = icon;
    return (
        <section className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-900">
                <Icon className={`size-4 ${tone}`} />
                <h3 className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200">{title}</h3>
                {count != null && <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{count}</span>}
            </div>
            {children}
        </section>
    );
}

const Empty = ({ children }) => <p className="px-5 py-5 text-[13px] text-gray-400 dark:text-zinc-500">{children}</p>;

function RowButton({ onClick, children }) {
    return (
        <button onClick={onClick}
            className="w-full text-left px-5 py-3 border-b border-gray-50 dark:border-zinc-800/60 last:border-0 hover:bg-gray-50/70 dark:hover:bg-zinc-800/30 transition">
            {children}
        </button>
    );
}

const LaneDot = ({ lane }) => lane
    ? <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400"><span className="size-1.5 rounded-full" style={{ background: lane.color }} />{lane.name}</span>
    : null;

// Full weekly-review tab inside xPlan.
export default function XPlanThisWeek({ workspaceId, onOpen }) {
    const { rows, buckets, rollup } = useThisWeek(workspaceId);

    if (!rows) return <div className="flex justify-center py-16"><Loader2Icon className="size-6 text-gray-400 animate-spin" /></div>;

    if (rows.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm text-gray-500 dark:text-zinc-400">No open projects yet.</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Add what you're committing to under Projects, then review it here each week.</p>
            </div>
        );
    }

    const { attention, upcoming, nowRows, overCap, unlinkedNow } = buckets;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card icon={AlertTriangleIcon} tone="text-amber-500" title="Needs attention" count={attention.length}>
                {attention.length === 0 ? <Empty>Nothing slipping. Nice.</Empty> : attention.map(({ row, reasons }) => (
                    <RowButton key={row.id} onClick={() => onOpen(row)}>
                        <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100 truncate">{row.title}</p>
                            <LaneDot lane={row.lane} />
                        </div>
                        <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-0.5">{reasons.join(" · ")}</p>
                    </RowButton>
                ))}
            </Card>

            <Card icon={CalendarClockIcon} tone="text-blue-500" title={`Coming up · next ${SOON_DAYS} days`} count={upcoming.length}>
                {upcoming.length === 0 ? <Empty>No end dates or milestones in the next two weeks.</Empty> : upcoming.map((u, i) => (
                    <RowButton key={`${u.row.id}-${i}`} onClick={() => onOpen(u.row)}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100 truncate">{u.label === "Ends" ? `${u.row.title} ends` : u.label}</p>
                                {u.label !== "Ends" && <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">{u.row.title}</p>}
                            </div>
                            <span className="text-[12px] text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                                {u.left === 0 ? "today" : u.left === 1 ? "tomorrow" : format(day(u.date), "EEE MMM d")}
                            </span>
                        </div>
                    </RowButton>
                ))}
            </Card>

            <div className="lg:col-span-2">
                <Card icon={ZapIcon} tone="text-violet-500" title="Now" count={`${nowRows.length} / ${NOW_CAP}`}>
                    {overCap && (
                        <p className="px-5 py-2.5 text-[12px] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-b border-amber-100 dark:border-amber-900/40">
                            That's more than {NOW_CAP} things in Now. Pick what actually moves this week and push the rest to Next.
                        </p>
                    )}
                    {nowRows.length === 0 ? <Empty>Nothing in Now. Move 1–3 projects here from Next during your weekly review.</Empty> : nowRows.map((r) => (
                        <RowButton key={r.id} onClick={() => onOpen(r)}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100 truncate">{r.title}</p>
                                    <LaneDot lane={r.lane} />
                                </div>
                                {r.xpm_project_id
                                    ? <RollupChip stats={rollup[r.id]} />
                                    : <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500"><LinkIcon className="size-3" />no tasks linked</span>}
                            </div>
                        </RowButton>
                    ))}
                    {unlinkedNow.length > 0 && (
                        <p className="px-5 py-2.5 text-[11px] text-gray-400 dark:text-zinc-500 border-t border-gray-100 dark:border-zinc-800">
                            {unlinkedNow.length} Now project{unlinkedNow.length > 1 ? "s have" : " has"} no task list. Open one and create or link an xPM project so progress shows up here.
                        </p>
                    )}
                </Card>
            </div>
        </div>
    );
}

// Compact dashboard card.
export function XPlanThisWeekCard({ workspaceId }) {
    const { rows, buckets, rollup } = useThisWeek(workspaceId);
    if (!workspaceId) return null;

    return (
        <section className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200">xPlan · this week</h3>
                <Link to="/xplan" className="text-[12px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-0.5">
                    Open <ArrowUpRightIcon className="size-3" />
                </Link>
            </div>
            {!rows ? (
                <div className="flex justify-center py-6"><Loader2Icon className="size-4 text-gray-400 animate-spin" /></div>
            ) : buckets.nowRows.length === 0 && buckets.attention.length === 0 ? (
                <Empty>No projects in Now. <Link to="/xplan" className="underline">Plan your week</Link>.</Empty>
            ) : (
                <ul>
                    {buckets.attention.slice(0, 3).map(({ row, reasons }) => (
                        <li key={`a-${row.id}`} className="px-5 py-2.5 border-b border-gray-50 dark:border-zinc-800/60">
                            <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-100 truncate">{row.title}</p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">{reasons[0]}</p>
                        </li>
                    ))}
                    {buckets.nowRows.filter((r) => !buckets.attention.some((a) => a.row.id === r.id)).slice(0, 4).map((r) => (
                        <li key={`n-${r.id}`} className="px-5 py-2.5 border-b border-gray-50 dark:border-zinc-800/60 last:border-0 flex items-center justify-between gap-3">
                            <p className="text-[13px] text-gray-800 dark:text-zinc-200 truncate">{r.title}</p>
                            <RollupChip stats={rollup[r.id]} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
