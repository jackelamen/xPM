import { addDays, format, endOfDay } from "date-fns"
import { supabase } from "./supabase"

// Where the "Open Pulse" link points. Hidden when unset.
export const PULSE_URL = import.meta.env.VITE_PULSE_URL || ""

// Pre-server-side setting (browser-only); read once to migrate it.
export const PULSE_LEGACY_KEY = "xpm_pulse_enabled"

export const AUTO_SEND_DEFAULT_DAYS = 7

export function xpmPriorityToPulse(p) {
    if (p === "HIGH" || p === "URGENT") return 3
    if (p === "MEDIUM") return 2
    if (p === "LOW") return 1
    return 0
}

const localISO = (dateStr, time) => new Date(`${dateStr}T${time || "00:00:00"}`).toISOString()

// Tasks being sent right now, so a manual click and the auto-sender can't
// both insert the same task.
const inFlight = new Set()

// Copies an xPM task into Pulse and records the bridge link.
// Returns true when the task is in Pulse afterwards (sent now or already there).
export async function sendTaskToPulse(task, userId, workspaceId, { onError } = {}) {
    if (inFlight.has(task.id)) return false
    inFlight.add(task.id)
    try {
        const { data: existing } = await supabase
            .from("pulse_xpm_task_links").select("id")
            .eq("user_id", userId).eq("xpm_task_id", task.id).limit(1)
        if (existing?.length) return true

        // The project's custom Pulse tag wins when set (Project Settings ->
        // Pulse Tag); otherwise fall back to the project name lowercased.
        const effectiveTag = task.pulseTag || (task.projectName ? task.projectName.toLowerCase() : null)
        const tags = [effectiveTag].filter(Boolean)
        // Pulse's Someday is a tag, not a status.
        if (task.custom_fields?.someday) tags.push("someday")

        let listId = null
        if (task.projectName) {
            const { data: found } = await supabase
                .from("lists").select("id")
                .eq("user_id", userId).ilike("name", task.projectName)
                .is("deleted_at", null).maybeSingle()
            if (found) {
                listId = found.id
            } else {
                const { data: created } = await supabase
                    .from("lists").insert({ user_id: userId, name: task.projectName })
                    .select("id").single()
                if (created) listId = created.id
            }
        }

        // A task with only a date is all-day in Pulse. Writing midnight without
        // all_day made it a timed 12:00 AM item.
        const allDay = !task.due_time
        const { data: pulseTask, error } = await supabase.from("tasks").insert({
            user_id: userId,
            title: task.title,
            notes: task.description || null,
            start_at: task.start_date ? localISO(task.start_date) : null,
            due_at: task.due_date ? localISO(task.due_date, task.due_time) : null,
            all_day: allDay,
            status: "todo",
            priority: xpmPriorityToPulse(task.priority),
            duration_minutes: task.estimate_minutes || 30,
            list_id: listId,
            tags,
        }).select("id").single()
        if (error) throw error

        if (pulseTask?.id) {
            await supabase.from("pulse_xpm_task_links").insert({
                user_id: userId,
                xpm_workspace_id: workspaceId || null,
                xpm_project_id: task.projectId || null,
                xpm_task_id: task.id,
                pulse_task_id: String(pulseTask.id),
                pulse_task_title: task.title,
                pulse_project_tag: effectiveTag,
                sync_status: "linked",
            })
        }

        // Persist the flag so the bolt stays purple after reload.
        await supabase
            .from("xpm_tasks")
            .update({ custom_fields: { ...(task.custom_fields || {}), sent_to_pulse: true } })
            .eq("id", task.id)

        return true
    } catch (err) {
        onError?.(err)
        return false
    } finally {
        inFlight.delete(task.id)
    }
}

// Where a Pulse task shows up, using Pulse's own names.
export function pulseLocation(pt) {
    if (!pt) return null
    if (pt.completed_at || pt.status === "done") return { key: "done", label: "Done" }
    if ((pt.tags || []).includes("someday")) return { key: "someday", label: "Someday" }
    if (!pt.start_at && !pt.due_at) {
        return pt.list_id ? { key: "anytime", label: "Anytime" } : { key: "inbox", label: "Inbox" }
    }
    const first = [pt.start_at, pt.due_at].filter(Boolean).sort()[0]
    return new Date(first) <= endOfDay(new Date())
        ? { key: "today", label: "Today" }
        : { key: "upcoming", label: "Upcoming" }
}

export function scheduleText(pt) {
    if (!pt) return null
    const parts = []
    if (pt.start_at) parts.push(`Starts ${format(new Date(pt.start_at), pt.all_day ? "EEE MMM d" : "EEE MMM d, h:mm a")}`)
    if (pt.due_at) parts.push(`Due ${format(new Date(pt.due_at), pt.all_day ? "EEE MMM d" : "EEE MMM d, h:mm a")}`)
    return parts.length ? parts.join(" · ") : "Not scheduled"
}

// Tasks that are mine, open, dated, and not yet in Pulse.
// A task qualifies when its start or due date falls inside the window
// (overdue counts). Undated, Someday and umbrella tasks never qualify.
export function autoSendCandidates(projects, userId, days, linkedTaskIds) {
    const windowEnd = format(addDays(new Date(), days), "yyyy-MM-dd")
    const all = projects.flatMap((p) =>
        (p.tasks || []).map((t) => ({ ...t, projectId: p.id, projectName: p.name, pulseTag: p.pulse_tag || null })))
    const parents = new Set(all.map((t) => t.parent_task_id).filter(Boolean))
    return all.filter((t) => {
        if (t.archived_at || t.status === "DONE") return false
        if (parents.has(t.id)) return false
        const mine = t.assignee_id === userId || (t.assignees || []).some((a) => a?.id === userId)
        if (!mine) return false
        if (t.custom_fields?.sent_to_pulse || t.custom_fields?.someday) return false
        if (linkedTaskIds.has(t.id)) return false
        return (t.start_date && t.start_date <= windowEnd) || (t.due_date && t.due_date <= windowEnd)
    })
}
