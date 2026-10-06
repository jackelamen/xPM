import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase";
import { differenceInCalendarDays, format } from "date-fns";
import { useTaskRollup, STALE_DAYS } from "./xplanRollup";

export const NOW_CAP = 3;
export const SOON_DAYS = 14;

export const day = (d) => new Date(`${d}T00:00:00`);

// Loads open projects plus upcoming draft milestones, and sorts them into the
// buckets the weekly review cares about.
export function useThisWeek(workspaceId) {
    const [rows, setRows] = useState(null);
    const [milestones, setMilestones] = useState([]);

    const load = useCallback(async () => {
        const { data } = await supabase
            .from("roadmap_initiatives")
            .select("*, lane:roadmap_lanes(id, name, color)")
            .eq("workspace_id", workspaceId)
            .not("status", "in", "(done,dropped)")
            .order("sort_order");
        const list = data || [];
        setRows(list);
        if (list.length) {
            const { data: ms } = await supabase
                .from("xplan_milestones")
                .select("id, title, starts_on, initiative_id")
                .in("initiative_id", list.map((r) => r.id))
                .neq("status", "done")
                .not("starts_on", "is", null);
            setMilestones(ms || []);
        } else setMilestones([]);
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    const rollup = useTaskRollup(rows);

    const buckets = useMemo(() => {
        if (!rows) return null;
        const today = new Date();
        const attention = [];
        const upcoming = [];
        const nowRows = rows.filter((r) => r.horizon === "now");

        for (const r of rows) {
            const stats = rollup[r.id];
            const reasons = [];
            if (r.status === "at-risk") reasons.push("Marked at-risk");
            if (stats?.overdue > 0) reasons.push(`${stats.overdue} overdue task${stats.overdue > 1 ? "s" : ""}`);
            if (r.end_date && day(r.end_date) < today && differenceInCalendarDays(today, day(r.end_date)) > 0) {
                reasons.push(`End date passed ${format(day(r.end_date), "MMM d")}`);
            }
            if (r.horizon === "now" || r.status === "active") {
                const last = stats?.lastActivity || r.updated_at;
                const idle = last ? differenceInCalendarDays(today, new Date(last)) : 0;
                if (idle >= STALE_DAYS) reasons.push(`Nothing touched in ${idle} days`);
            }
            if (reasons.length) attention.push({ row: r, reasons });

            const items = [];
            if (r.end_date) {
                const left = differenceInCalendarDays(day(r.end_date), today);
                if (left >= 0 && left <= SOON_DAYS) items.push({ label: "Ends", date: r.end_date, left });
            }
            for (const m of milestones.filter((x) => x.initiative_id === r.id)) {
                const left = differenceInCalendarDays(day(m.starts_on), today);
                if (left >= 0 && left <= SOON_DAYS) items.push({ label: m.title, date: m.starts_on, left });
            }
            for (const it of items) upcoming.push({ row: r, ...it });
        }
        upcoming.sort((a, b) => a.left - b.left);

        return {
            attention,
            upcoming,
            nowRows,
            overCap: nowRows.length > NOW_CAP,
            unlinkedNow: nowRows.filter((r) => !r.xpm_project_id),
        };
    }, [rows, rollup, milestones]);

    return { rows, buckets, rollup, reload: load };
}

