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
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-2 gap-x-8 gap-y-8">
            {/* The hook: what's in Now */}
            <section className="lg:col-span-2 rounded-2xl bg-ink-900 text-white overflow-hidden">
                <div className="flex items-baseline gap-3 px-6 sm:px-8 pt-6 pb-2">
                    <h2 className="text-[28px] font-semibold">Now</h2>
                    <span className="text-[15px] text-ink-300 tabular-nums">{nowRows.length} of {NOW_CAP}</span>
                    <span className="ml-auto hidden sm:block text-[14px] text-ink-300">Pick 1 to 3 things that actually move this week.</span>
                </div>
                {overCap && (
                    <p className="mx-6 sm:mx-8 mb-2 px-3 py-2 rounded-lg text-[13px] bg-signal-500/15 text-signal-300">
                        That's more than {NOW_CAP} in Now. Choose what moves this week and push the rest to Next.
                    </p>
                )}
                {nowRows.length === 0 ? (
                    <p className="px-6 sm:px-8 pb-8 pt-2 text-[16px] text-ink-200">Nothing in Now. Move one to three projects here from Next during your weekly review.</p>
                ) : (
                    <ul className="pb-3">
                        {nowRows.map((r) => (
                            <li key={r.id}>
                                <button onClick={() => onOpen(r)} className="w-full text-left px-6 sm:px-8 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.05] transition-colors border-t border-white/10">
                                    <div className="min-w-0">
                                        <p className="text-[19px] font-medium truncate">{r.title}</p>
                                        {r.lane && (
                                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-ink-300">
                                                <span className="size-2 rounded-full" style={{ background: r.lane.color }} />{r.lane.name}
                                            </p>
                                        )}
                                    </div>
                                    {r.xpm_project_id
                                        ? <RollupChip stats={rollup[r.id]} onDark />
                                        : <span className="inline-flex items-center gap-1 text-[12px] text-ink-300"><LinkIcon className="size-3" />no tasks linked</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {unlinkedNow.length > 0 && (
                    <p className="px-6 sm:px-8 py-3 text-[13px] text-ink-300 border-t border-white/10">
                        {unlinkedNow.length} Now project{unlinkedNow.length > 1 ? "s have" : " has"} no task list. Open one and create or link an xPM project so progress shows up here.
                    </p>
                )}
            </section>

            <section>
                <div className="flex items-center gap-2 pb-2">
                    <span className="size-2 rounded-full bg-signal-500" />
                    <h3 className="text-[18px] font-semibold text-gray-900 dark:text-white">Needs attention</h3>
                    <span className="text-[13px] text-gray-400 tabular-nums">{attention.length}</span>
                </div>
                {attention.length === 0 ? <p className="py-2 text-[14px] text-gray-500 dark:text-zinc-400">Nothing slipping.</p> : (
                    <ul>
                        {attention.map(({ row, reasons }) => (
                            <li key={row.id}>
                                <button onClick={() => onOpen(row)} className="w-full text-left py-3 border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/60 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[15px] font-medium text-gray-900 dark:text-zinc-100 truncate">{row.title}</p>
                                        <LaneDot lane={row.lane} />
                                    </div>
                                    <p className="text-[13px] text-signal-700 dark:text-signal-400 mt-0.5">{reasons.join(" · ")}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <div className="flex items-center gap-2 pb-2">
                    <span className="size-2 rounded-full bg-ink-400" />
                    <h3 className="text-[18px] font-semibold text-gray-900 dark:text-white">Coming up</h3>
                    <span className="text-[13px] text-gray-400 tabular-nums">next {SOON_DAYS} days · {upcoming.length}</span>
                </div>
                {upcoming.length === 0 ? <p className="py-2 text-[14px] text-gray-500 dark:text-zinc-400">No end dates or milestones in the next two weeks.</p> : (
                    <ul>
                        {upcoming.map((u, i) => (
                            <li key={`${u.row.id}-${i}`}>
                                <button onClick={() => onOpen(u.row)} className="w-full text-left py-3 border-b border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900/60 transition-colors">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[15px] font-medium text-gray-900 dark:text-zinc-100 truncate">{u.label === "Ends" ? `${u.row.title} ends` : u.label}</p>
                                            {u.label !== "Ends" && <p className="text-[13px] text-gray-400 dark:text-zinc-500 truncate">{u.row.title}</p>}
                                        </div>
                                        <span className="font-display text-[15px] font-semibold text-gray-700 dark:text-zinc-300 whitespace-nowrap">
                                            {u.left === 0 ? "today" : u.left === 1 ? "tomorrow" : format(day(u.date), "EEE MMM d")}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

// Compact dashboard card.
export function XPlanThisWeekCard({ workspaceId, bare = false }) {
    const { rows, buckets, rollup } = useThisWeek(workspaceId);
    if (!workspaceId) return null;

    return (
        <section className={bare ? "" : "rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"}>
            <div className={`flex items-center justify-between ${bare ? "pb-2" : "px-5 py-3 border-b border-gray-100 dark:border-zinc-800"}`}>
                <h3 className={bare ? "text-[18px] font-semibold text-gray-900 dark:text-white" : "text-[13px] font-semibold text-gray-800 dark:text-zinc-200"}>xPlan · this week</h3>
                <Link to="/xplan" className="text-[12px] text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white inline-flex items-center gap-0.5">
                    Open <ArrowUpRightIcon className="size-3" />
                </Link>
            </div>
            {!rows ? (
                <div className="flex justify-center py-6"><Loader2Icon className="size-4 text-gray-400 animate-spin" /></div>
            ) : buckets.nowRows.length === 0 && buckets.attention.length === 0 ? (
                bare
                ? <p className="py-3 text-[13px] text-gray-500 dark:text-zinc-400">No projects in Now. <Link to="/xplan" className="underline">Choose what moves this week</Link>.</p>
                : <Empty>No projects in Now. <Link to="/xplan" className="underline">Plan your week</Link>.</Empty>
            ) : (
                <ul>
                    {buckets.attention.slice(0, 3).map(({ row, reasons }) => (
                        <li key={`a-${row.id}`} className={`${bare ? "py-2.5" : "px-5 py-2.5"} border-b border-gray-100 dark:border-zinc-800/60`}>
                            <p className="text-[14px] font-medium text-gray-900 dark:text-zinc-100 truncate">{row.title}</p>
                            <p className="text-[12px] text-signal-700 dark:text-signal-400">{reasons[0]}</p>
                        </li>
                    ))}
                    {buckets.nowRows.filter((r) => !buckets.attention.some((a) => a.row.id === r.id)).slice(0, 4).map((r) => (
                        <li key={`n-${r.id}`} className={`${bare ? "py-2.5" : "px-5 py-2.5"} border-b border-gray-100 dark:border-zinc-800/60 last:border-0 flex items-center justify-between gap-3`}>
                            <p className="text-[14px] text-gray-800 dark:text-zinc-200 truncate">{r.title}</p>
                            <RollupChip stats={rollup[r.id]} />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
