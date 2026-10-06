import { addDays, format } from "date-fns"

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const PRIORITIES = { low: "LOW", med: "MEDIUM", medium: "MEDIUM", high: "HIGH", urgent: "URGENT" }

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "")
const iso = (d) => format(d, "yyyy-MM-dd")

function nextWeekday(now, idx, skipThisWeek) {
    let diff = (idx - now.getDay() + 7) % 7
    if (diff === 0) diff = 7
    if (skipThisWeek) diff += 7
    return addDays(now, diff)
}

function findProject(token, projects) {
    const t = norm(token)
    if (!t) return null
    return projects.find((p) => norm(p.name) === t)
        || projects.find((p) => norm(p.name).startsWith(t))
        || projects.find((p) => norm(p.name).includes(t))
        || null
}

// Plain-code parser for the quick capture bar (no AI).
//   #project   !high   today / tomorrow / friday / next friday / in 3d
//   2026-03-05 / 3/5   2pm / 2:30pm / 14:30
// Anything recognised is lifted out of the title. `ignore` is a set of kinds
// ("project" | "date" | "time" | "priority") the person dismissed; those words stay in the title.
export function parseCapture(text, projects = [], now = new Date(), ignore = new Set()) {
    const words = text.split(/\s+/).filter(Boolean)
    const out = { project: null, dueDate: null, dueTime: null, priority: null }
    const used = new Set()

    for (let i = 0; i < words.length; i++) {
        const raw = words[i]
        const w = raw.toLowerCase().replace(/[.,;]+$/, "")

        if (w.startsWith("#") && !out.project && !ignore.has("project")) {
            const p = findProject(w.slice(1), projects)
            if (p) { out.project = p; used.add(i) }
            continue
        }
        if (w.startsWith("!") && !out.priority && !ignore.has("priority") && PRIORITIES[w.slice(1)]) {
            out.priority = PRIORITIES[w.slice(1)]; used.add(i); continue
        }

        if (!out.dueDate && !ignore.has("date")) {
            let d = null, span = 1
            if (w === "today") d = now
            else if (w === "tomorrow" || w === "tmrw") d = addDays(now, 1)
            else if (WEEKDAYS.includes(w)) d = nextWeekday(now, WEEKDAYS.indexOf(w), false)
            else if (w === "next" && WEEKDAYS.includes((words[i + 1] || "").toLowerCase())) {
                d = nextWeekday(now, WEEKDAYS.indexOf(words[i + 1].toLowerCase()), true); span = 2
            } else if (w === "in" && /^\d{1,3}d(ays?)?$/.test((words[i + 1] || "").toLowerCase())) {
                d = addDays(now, parseInt(words[i + 1], 10)); span = 2
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
                const parsed = new Date(`${w}T00:00:00`)
                if (!Number.isNaN(parsed.getTime())) d = parsed
            } else if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(w)) {
                const [m, day, y] = w.split("/").map(Number)
                let year = y ? (y < 100 ? 2000 + y : y) : now.getFullYear()
                let cand = new Date(year, m - 1, day)
                if (!y && cand < new Date(now.getFullYear(), now.getMonth(), now.getDate())) cand = new Date(year + 1, m - 1, day)
                if (cand.getMonth() === m - 1) d = cand
            }
            if (d) { out.dueDate = iso(d); for (let k = 0; k < span; k++) used.add(i + k); i += span - 1; continue }
        }

        if (!out.dueTime && !ignore.has("time")) {
            const t = w.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/) || w.match(/^(\d{1,2}):(\d{2})$/)
            if (t) {
                let h = parseInt(t[1], 10); const min = t[2] ? parseInt(t[2], 10) : 0
                const mer = t[3]
                if (mer === "pm" && h < 12) h += 12
                if (mer === "am" && h === 12) h = 0
                if (h <= 23 && min <= 59) {
                    out.dueTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
                    used.add(i)
                    // swallow a leading "at"
                    if ((words[i - 1] || "").toLowerCase() === "at") used.add(i - 1)
                }
            }
        }
    }

    out.title = words.filter((_, i) => !used.has(i)).join(" ")
    return out
}
