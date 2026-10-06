import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PriorityTag } from "./Badges";
import Tooltip from "./Tooltip";

const key = (d) => format(d, "yyyy-MM-dd");
// A task sits on its due date; one with only a start date sits on that.
const dateOf = (t) => t.due_date || t.start_date || null;
const parse = (s) => new Date(`${s}T00:00:00`);

const ProjectCalendar = ({ tasks }) => {
    const [month, setMonth] = useState(new Date());
    const [selected, setSelected] = useState(key(new Date()));
    const todayKey = key(new Date());

    const byDay = useMemo(() => {
        const m = {};
        for (const t of tasks) { const d = dateOf(t); if (d) (m[d] ||= []).push(t); }
        return m;
    }, [tasks]);

    // Full weeks, Monday first (the same as the week planner), so every date sits under its weekday.
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    });

    const open = tasks.filter((t) => t.status !== "DONE" && dateOf(t));
    const overdue = open.filter((t) => t.due_date && t.due_date < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const upcoming = open.filter((t) => dateOf(t) >= todayKey).sort((a, b) => dateOf(a).localeCompare(dateOf(b))).slice(0, 6);
    const selectedTasks = byDay[selected] || [];

    const goToday = () => { setMonth(new Date()); setSelected(todayKey); };

    return (
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-x-10 gap-y-8">
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[26px] font-semibold text-ink-900 dark:text-white">{format(month, "MMMM yyyy")}</h2>
                    <div className="flex items-center gap-1">
                        <button onClick={goToday} className="px-3 py-1.5 text-[13px] font-medium rounded-md border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800">Today</button>
                        <Tooltip label="Previous month">
                            <button onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month" className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-zinc-800">
                                <ChevronLeft className="size-5" />
                            </button>
                        </Tooltip>
                        <Tooltip label="Next month">
                            <button onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month" className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-zinc-800">
                                <ChevronRight className="size-5" />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="grid grid-cols-7 border-b border-gray-100 dark:border-zinc-800">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <div key={d} className="px-2 py-2 text-[13px] font-medium text-gray-500 dark:text-zinc-400">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {days.map((day) => {
                            const k = key(day);
                            const list = byDay[k] || [];
                            const inMonth = isSameMonth(day, month);
                            const isToday = k === todayKey;
                            const isSel = k === selected;
                            const hasOverdue = list.some((t) => t.status !== "DONE" && t.due_date && t.due_date < todayKey);
                            return (
                                <button key={k} onClick={() => setSelected(k)}
                                    className={`min-h-[64px] sm:min-h-[96px] p-1.5 text-left border-b border-r border-gray-100 dark:border-zinc-800 flex flex-col gap-1 transition-colors
                                        ${isSel ? "bg-ink-50 dark:bg-zinc-800 ring-2 ring-inset ring-ink-600" : "hover:bg-gray-50 dark:hover:bg-zinc-800/60"}
                                        ${inMonth ? "" : "bg-gray-50/70 dark:bg-zinc-950/40"}`}>
                                    <span className={`self-start text-[13px] tabular-nums size-6 rounded-full flex items-center justify-center
                                        ${isToday ? "bg-signal-500 text-ink-950 font-bold" : inMonth ? "text-gray-800 dark:text-zinc-200" : "text-gray-300 dark:text-zinc-600"}`}>
                                        {format(day, "d")}
                                    </span>
                                    <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                                        {list.slice(0, 2).map((t) => (
                                            <span key={t.id} className={`truncate rounded px-1.5 py-0.5 text-[12px] leading-tight
                                                ${t.status === "DONE" ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 line-through" : hasOverdue && t.due_date < todayKey ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300" : "bg-ink-50 dark:bg-zinc-800 text-ink-800 dark:text-zinc-200"}`}>
                                                {t.title}
                                            </span>
                                        ))}
                                        {list.length > 2 && <span className="px-1.5 text-[12px] text-gray-500 dark:text-zinc-400">+{list.length - 2} more</span>}
                                    </span>
                                    {list.length > 0 && <span className="sm:hidden self-start size-1.5 rounded-full bg-ink-600" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                <section>
                    <h3 className="text-[18px] font-semibold text-gray-900 dark:text-white pb-2">
                        {selected === todayKey ? "Today" : format(parse(selected), "EEE, MMM d")}
                        <span className="ml-2 text-[13px] font-normal text-gray-400">{selectedTasks.length}</span>
                    </h3>
                    {selectedTasks.length === 0 ? (
                        <p className="text-[14px] text-gray-500 dark:text-zinc-400">Nothing on this day.</p>
                    ) : (
                        <ul>
                            {selectedTasks.map((t) => (
                                <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-200 dark:border-zinc-800">
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-[15px] truncate ${t.status === "DONE" ? "line-through text-gray-400" : "text-gray-900 dark:text-zinc-100"}`}>{t.title}</p>
                                        {t.assignee && <p className="text-[12px] text-gray-400 dark:text-zinc-500 truncate">{t.assignee.name || t.assignee.email}</p>}
                                    </div>
                                    <PriorityTag priority={t.priority} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {overdue.length > 0 && (
                    <section>
                        <h3 className="flex items-center gap-2 text-[18px] font-semibold text-gray-900 dark:text-white pb-2">
                            <span className="size-2 rounded-full bg-red-500" />Overdue
                            <span className="text-[13px] font-normal text-gray-400">{overdue.length}</span>
                        </h3>
                        <ul>
                            {overdue.slice(0, 5).map((t) => (
                                <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-200 dark:border-zinc-800">
                                    <p className="text-[15px] text-gray-900 dark:text-zinc-100 truncate flex-1">{t.title}</p>
                                    <span className="text-[12px] font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">{format(parse(t.due_date), "MMM d")}</span>
                                </li>
                            ))}
                            {overdue.length > 5 && <li className="pt-2 text-[13px] text-gray-500">{overdue.length - 5} more</li>}
                        </ul>
                    </section>
                )}

                <section>
                    <h3 className="text-[18px] font-semibold text-gray-900 dark:text-white pb-2">Coming up</h3>
                    {upcoming.length === 0 ? (
                        <p className="text-[14px] text-gray-500 dark:text-zinc-400">Nothing scheduled.</p>
                    ) : (
                        <ul>
                            {upcoming.map((t) => (
                                <li key={t.id} className="flex items-center gap-3 py-2.5 border-b border-gray-200 dark:border-zinc-800">
                                    <p className="text-[15px] text-gray-900 dark:text-zinc-100 truncate flex-1">{t.title}</p>
                                    <span className="text-[12px] text-gray-500 dark:text-zinc-400 whitespace-nowrap">{format(parse(dateOf(t)), "EEE MMM d")}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
};

export default ProjectCalendar;
