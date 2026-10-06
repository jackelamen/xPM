import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// A project with nothing touched in this many days counts as stale.
export const STALE_DAYS = 14;

const todayStr = () => new Date().toISOString().slice(0, 10);

// Task progress for xPlan projects that are linked to an xPM project.
// Returns { [initiativeId]: { total, done, overdue, lastActivity, nextDue } }.
export function useTaskRollup(rows) {
    const [rollup, setRollup] = useState({});
    const key = (rows || []).map((r) => `${r.id}:${r.xpm_project_id || ""}`).join(",");

    useEffect(() => {
        const linked = (rows || []).filter((r) => r.xpm_project_id);
        if (linked.length === 0) { setRollup({}); return; }
        let on = true;
        supabase
            .from("xpm_tasks")
            .select("project_id, status, due_date, updated_at")
            .in("project_id", linked.map((r) => r.xpm_project_id))
            .then(({ data }) => {
                if (!on) return;
                const today = todayStr();
                const byProject = {};
                for (const t of data || []) {
                    const p = (byProject[t.project_id] ||= { total: 0, done: 0, overdue: 0, lastActivity: null, nextDue: null });
                    p.total++;
                    if (t.status === "DONE") p.done++;
                    else if (t.due_date) {
                        if (t.due_date < today) p.overdue++;
                        else if (!p.nextDue || t.due_date < p.nextDue) p.nextDue = t.due_date;
                    }
                    if (t.updated_at && (!p.lastActivity || t.updated_at > p.lastActivity)) p.lastActivity = t.updated_at;
                }
                const out = {};
                for (const r of linked) out[r.id] = byProject[r.xpm_project_id] || { total: 0, done: 0, overdue: 0, lastActivity: null, nextDue: null };
                setRollup(out);
            });
        return () => { on = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return rollup;
}
