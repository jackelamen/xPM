import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
    format, addDays, differenceInDays, startOfDay, subDays, parseISO,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, CalendarOffIcon } from "lucide-react";
import toast from "react-hot-toast";

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_H = 40;
const HEADER_H = 52;
const LANE_LABEL_W = 170;
const BAR_H = 24;
const BAR_RADIUS = 6;
const LANE_GAP = 8;

// Zoom presets: pixels per day / days shown
const ZOOMS = {
    weeks:    { dayW: 36, days: 45 },
    months:   { dayW: 18, days: 90 },
    quarters: { dayW: 6,  days: 270 },
};

const STATUS_FILL = {
    planned:   { fill: "#a1a1aa", text: "#ffffff" },
    active:    { fill: "#3b82f6", text: "#ffffff" },
    "at-risk": { fill: "#f59e0b", text: "#ffffff" },
    done:      { fill: "#10b981", text: "#ffffff" },
};

// ─── Timeline ─────────────────────────────────────────────────────────────────
// rows: initiatives (joined with lane). Bars are drawn per initiative, grouped
// into swimlanes by lane. Drag body to move, edges to resize; dates persist to
// roadmap_initiatives on mouseup.
export default function XPlanTimeline({ rows, lanes, onBarClick, onDatesSaved }) {
    const today = startOfDay(new Date());
    const [zoom, setZoom] = useState("months");
    const [viewStart, setViewStart] = useState(subDays(today, 7));
    const [localDates, setLocalDates] = useState({});
    const [dragging, setDragging] = useState(null);
    const draggingRef = useRef(null);

    const { dayW, days } = ZOOMS[zoom];
    const viewEnd = addDays(viewStart, days);
    const totalW = days * dayW;

    const getDate = useCallback((row, field) => {
        const override = localDates[row.id];
        if (override && override[field] !== undefined)
            return override[field] ? parseISO(override[field]) : null;
        return row[field] ? parseISO(row[field]) : null;
    }, [localDates]);

    const xOf = useCallback(
        (date) => Math.round(differenceInDays(startOfDay(date), startOfDay(viewStart)) * dayW),
        [viewStart, dayW]
    );

    const scheduled = useMemo(
        () => rows.filter((r) => r.start_date && r.end_date && r.status !== "dropped"),
        [rows]
    );
    const unscheduled = useMemo(
        () => rows.filter((r) => (!r.start_date || !r.end_date) && r.status !== "dropped"),
        [rows]
    );

    // Swimlane layout: one section per lane (plus "No lane"), one row per initiative.
    const laneSections = useMemo(() => {
        const sections = [];
        let y = 0;
        const grouped = [...lanes.map((l) => ({ lane: l, items: [] })), { lane: null, items: [] }];
        for (const r of scheduled) {
            const g = grouped.find((s) => (s.lane?.id || null) === (r.lane_id || null)) || grouped[grouped.length - 1];
            g.items.push(r);
        }
        for (const g of grouped) {
            if (g.lane === null && g.items.length === 0) continue; // hide empty "No lane"
            const h = Math.max(g.items.length, 1) * ROW_H;
            sections.push({ ...g, y, h });
            y += h + LANE_GAP;
        }
        return { sections, totalH: y };
    }, [lanes, scheduled]);

    // Month header labels
    const monthLabels = useMemo(() => {
        const months = [];
        let cur = null, startX = 0;
        for (let i = 0; i < days; i++) {
            const day = addDays(viewStart, i);
            const m = format(day, zoom === "quarters" ? "MMM ''yy" : "MMMM yyyy");
            if (m !== cur) {
                if (cur) months.push({ label: cur, x: startX, w: i * dayW - startX });
                cur = m; startX = i * dayW;
            }
        }
        if (cur) months.push({ label: cur, x: startX, w: days * dayW - startX });
        return months;
    }, [viewStart, days, dayW, zoom]);

    // Week tick lines (skip in quarters zoom — months are enough)
    const weekTicks = useMemo(() => {
        if (zoom === "quarters") return [];
        const ticks = [];
        for (let i = 0; i < days; i++) {
            const day = addDays(viewStart, i);
            if (day.getDay() === 1) ticks.push({ x: i * dayW, label: format(day, "d") });
        }
        return ticks;
    }, [viewStart, days, dayW, zoom]);

    // ─── Drag: move / resize, ref-based to dodge stale closures ──────────────
    const startDrag = (e, row, mode) => {
        e.preventDefault();
        e.stopPropagation();
        const state = {
            id: row.id,
            startX: e.clientX,
            origStart: getDate(row, "start_date"),
            origEnd: getDate(row, "end_date"),
            mode,
            moved: false,
        };
        draggingRef.current = state;
        setDragging(state);
    };

    const onMove = useCallback((e) => {
        const drag = draggingRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const delta = Math.round(dx / dayW);
        if (delta !== 0) drag.moved = true;
        let ns = drag.origStart, ne = drag.origEnd;
        if (drag.mode === "move") {
            ns = addDays(drag.origStart, delta);
            ne = addDays(drag.origEnd, delta);
        } else if (drag.mode === "resize-left") {
            ns = addDays(drag.origStart, delta);
            if (ns >= ne) ns = subDays(ne, 1);
        } else {
            ne = addDays(drag.origEnd, delta);
            if (ne <= ns) ne = addDays(ns, 1);
        }
        setLocalDates((prev) => ({
            ...prev,
            [drag.id]: { start_date: format(ns, "yyyy-MM-dd"), end_date: format(ne, "yyyy-MM-dd") },
        }));
    }, [dayW]);

    const onUp = useCallback(() => {
        const drag = draggingRef.current;
        if (!drag) return;
        draggingRef.current = null;
        setDragging(null);
        setLocalDates((prev) => {
            const override = prev[drag.id];
            if (override && drag.moved) {
                supabase.from("roadmap_initiatives")
                    .update({ ...override, updated_at: new Date().toISOString() })
                    .eq("id", drag.id)
                    .then(({ error }) => {
                        if (error) { toast.error("Failed to save dates"); return; }
                        onDatesSaved?.(drag.id, override);
                        toast.success("Dates updated");
                    });
            }
            return prev;
        });
    }, [onDatesSaved]);

    useEffect(() => {
        if (!dragging) return;
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [dragging, onMove, onUp]);

    const svgH = HEADER_H + laneSections.totalH + 8;
    const todayX = xOf(today);
    const step = zoom === "quarters" ? 90 : zoom === "months" ? 30 : 14;

    return (
        <div className="space-y-3">
            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1">
                    <button onClick={() => setViewStart((p) => subDays(p, step))}
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-400">
                        <ChevronLeftIcon className="size-4" />
                    </button>
                    <button onClick={() => setViewStart(subDays(today, 7))}
                        className="px-3 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                        Today
                    </button>
                    <button onClick={() => setViewStart((p) => addDays(p, step))}
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-600 dark:text-zinc-400">
                        <ChevronRightIcon className="size-4" />
                    </button>
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {format(viewStart, "MMM d")} – {format(viewEnd, "MMM d, yyyy")}
                </span>
                <div className="ml-auto flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    {Object.keys(ZOOMS).map((z) => (
                        <button key={z} onClick={() => setZoom(z)}
                            className={`px-3 py-1.5 text-xs font-medium capitalize transition ${
                                zoom === z
                                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            }`}>
                            {z}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
                <div className="flex">
                    {/* Lane labels */}
                    <div className="flex-shrink-0 border-r border-gray-100 dark:border-zinc-800" style={{ width: LANE_LABEL_W }}>
                        <div style={{ height: HEADER_H }} className="border-b border-gray-100 dark:border-zinc-800 flex items-end px-4 pb-2">
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Lane</span>
                        </div>
                        {laneSections.sections.map((s) => (
                            <div key={s.lane?.id || "none"} style={{ height: s.h, marginBottom: LANE_GAP }}
                                className="flex items-start px-4 pt-2.5">
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-700 dark:text-zinc-300 truncate">
                                    <span className="size-2 rounded-full flex-shrink-0" style={{ background: s.lane?.color || "#a1a1aa" }} />
                                    {s.lane?.name || "No lane"}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Scrollable timeline */}
                    <div className="overflow-x-auto flex-1">
                        <svg width={totalW} height={svgH} className="block select-none">
                            {/* Month bands + labels */}
                            {monthLabels.map((m, i) => (
                                <g key={i}>
                                    <line x1={m.x} y1={0} x2={m.x} y2={svgH} className="stroke-gray-100 dark:stroke-zinc-800" strokeWidth={1} />
                                    <text x={m.x + 8} y={20} className="fill-gray-500 dark:fill-zinc-400 text-[11px] font-semibold">{m.label}</text>
                                </g>
                            ))}
                            {weekTicks.map((t, i) => (
                                <g key={i}>
                                    <line x1={t.x} y1={HEADER_H - 16} x2={t.x} y2={svgH} className="stroke-gray-50 dark:stroke-zinc-800/60" strokeWidth={1} />
                                    <text x={t.x + 3} y={HEADER_H - 6} className="fill-gray-300 dark:fill-zinc-600 text-[9px]">{t.label}</text>
                                </g>
                            ))}

                            {/* Lane section separators */}
                            {laneSections.sections.map((s, i) => i > 0 && (
                                <line key={i} x1={0} x2={totalW}
                                    y1={HEADER_H + s.y - LANE_GAP / 2} y2={HEADER_H + s.y - LANE_GAP / 2}
                                    className="stroke-gray-100 dark:stroke-zinc-800" strokeWidth={1} />
                            ))}

                            {/* Today line */}
                            {todayX >= 0 && todayX <= totalW && (
                                <g>
                                    <line x1={todayX} y1={HEADER_H - 16} x2={todayX} y2={svgH} stroke="#ef4444" strokeWidth={1.5} />
                                    <rect x={todayX - 18} y={HEADER_H - 30} width={36} height={14} rx={7} fill="#ef4444" />
                                    <text x={todayX} y={HEADER_H - 19.5} textAnchor="middle" className="fill-white text-[9px] font-semibold">Today</text>
                                </g>
                            )}

                            {/* Bars */}
                            {laneSections.sections.map((s) =>
                                s.items.map((r, rowIdx) => {
                                    const start = getDate(r, "start_date");
                                    const end = getDate(r, "end_date");
                                    if (!start || !end) return null;
                                    const x = xOf(start);
                                    const w = Math.max(xOf(end) + dayW - x, dayW);
                                    const y = HEADER_H + s.y + rowIdx * ROW_H + (ROW_H - BAR_H) / 2;
                                    const c = STATUS_FILL[r.status] || STATUS_FILL.planned;
                                    const fill = r.color || s.lane?.color || c.fill;
                                    const isDrag = dragging?.id === r.id;
                                    return (
                                        <g key={r.id} opacity={r.status === "done" ? 0.55 : 1}>
                                            <rect x={x} y={y} width={w} height={BAR_H} rx={BAR_RADIUS}
                                                fill={fill} stroke={isDrag ? "#111827" : "transparent"} strokeWidth={1.5}
                                                className="cursor-grab active:cursor-grabbing"
                                                onMouseDown={(e) => startDrag(e, r, "move")}
                                                onClick={() => { if (!draggingRef.current) onBarClick?.(r); }}
                                            />
                                            {/* Resize handles */}
                                            <rect x={x - 3} y={y} width={8} height={BAR_H} fill="transparent"
                                                className="cursor-ew-resize" onMouseDown={(e) => startDrag(e, r, "resize-left")} />
                                            <rect x={x + w - 5} y={y} width={8} height={BAR_H} fill="transparent"
                                                className="cursor-ew-resize" onMouseDown={(e) => startDrag(e, r, "resize-right")} />
                                            {/* At-risk notch */}
                                            {r.status === "at-risk" && (
                                                <circle cx={x + w - 8} cy={y + BAR_H / 2} r={3} fill="#fff" opacity={0.9} />
                                            )}
                                            <text x={x + 8} y={y + BAR_H / 2 + 3.5}
                                                className="pointer-events-none text-[11px] font-medium" fill="#ffffff">
                                                {w > 60 ? (r.title.length > w / 7 ? r.title.slice(0, Math.floor(w / 7)) + "…" : r.title) : ""}
                                            </text>
                                        </g>
                                    );
                                })
                            )}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Unscheduled */}
            {unscheduled.length > 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                        <CalendarOffIcon className="size-3.5" /> Unscheduled — click to set dates
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {unscheduled.map((r) => (
                            <button key={r.id} onClick={() => onBarClick?.(r)}
                                className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-[12px] text-gray-700 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition">
                                {r.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
