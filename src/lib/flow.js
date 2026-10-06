import { addDays, format, startOfWeek } from "date-fns"

export const ymd = (d) => format(d, "yyyy-MM-dd")
export const weekStartOf = (d = new Date()) => startOfWeek(d, { weekStartsOn: 1 })
export const day = (s) => new Date(`${s}T00:00:00`)

// The date a task is "about": when you plan to start it, else when it's due.
export const whenOf = (t) => t.start_date || t.due_date || null

export const isMine = (t, userId) =>
    t.assignee_id === userId || (t.assignees || []).some((a) => a?.id === userId)

// Every non-archived task with its project attached.
export function allTasks(projects) {
    return (projects || []).flatMap((p) =>
        (p.tasks || []).filter((t) => !t.archived_at)
            .map((t) => ({ ...t, projectId: p.id, projectName: p.name, pulseTag: p.pulse_tag || null })))
}

// Open leaf tasks. Umbrella tasks (ones with subtasks) are represented by their subtasks.
export function openLeaves(tasks) {
    const parents = new Set(tasks.map((t) => t.parent_task_id).filter(Boolean))
    return tasks.filter((t) => t.status !== "DONE" && !parents.has(t.id))
}

export const BUCKETS = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "later", label: "Later" },
    { key: "nodate", label: "No date" },
    { key: "someday", label: "Someday" },
]

// Which section a task belongs to. Computed from dates, never stored.
export function bucketOf(t, now = new Date()) {
    if (t.custom_fields?.someday) return "someday"
    const today = ymd(now)
    if (t.due_date && t.due_date < today) return "overdue"
    const w = whenOf(t)
    if (!w) return "nodate"
    if (w <= today) return "today"
    return w <= ymd(addDays(weekStartOf(now), 6)) ? "week" : "later"
}

// What the person should do next, in order: triage, plan, review.
// `rituals` is { planned: <week start>, reviewed: <week start> }.
export function nextStep({ inboxCount, rituals = {}, now = new Date() }) {
    const dow = now.getDay() // 0 Sun .. 6 Sat
    const thisWeek = ymd(weekStartOf(now))
    const nextWeek = ymd(addDays(weekStartOf(now), 7))
    const endOfWeek = dow === 5 || dow === 6 || dow === 0

    if (inboxCount > 0) return { key: "triage", to: "/inbox", title: `Triage your inbox`, detail: `${inboxCount} item${inboxCount > 1 ? "s" : ""} waiting`, cta: "Start triage" }
    if (!endOfWeek && rituals.planned !== thisWeek) return { key: "plan", to: "/week?tab=plan", title: "Plan your week", detail: "Pick what you'll work on each day", cta: "Plan the week" }
    if (endOfWeek && rituals.reviewed !== thisWeek) return { key: "review", to: "/week?tab=review", title: "Review your week", detail: "Close out what didn't happen", cta: "Review the week" }
    if (endOfWeek && rituals.planned !== nextWeek) return { key: "plan-next", to: "/week?tab=plan&week=next", title: "Plan next week", detail: "Start Monday with a plan", cta: "Plan next week" }
    return null
}

// Estimated minutes for capacity; 30 matches Pulse's default.
export const minutesOf = (t) => t.estimate_minutes || 30

export const fmtMins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`)
