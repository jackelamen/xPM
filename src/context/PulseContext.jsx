import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { patchTask } from '../features/workspaceSlice'
import { autoSendCandidates, pulseLocation, sendTaskToPulse } from '../lib/pulse'

const PulseContext = createContext(null)

const MAX_AUTO_SEND_PER_RUN = 25

// Loads the signed-in user's own bridge links plus the Pulse-side state of the
// linked tasks (timing / location only), and runs the auto-sender. Does nothing
// for people without Pulse switched on.
export function PulseProvider({ children }) {
    const { user, pulse } = useAuth()
    const dispatch = useDispatch()
    const workspaceId = useSelector((s) => s.workspace?.currentWorkspace?.id)
    const projects = useSelector((s) => s.workspace?.currentWorkspace?.projects)

    const [links, setLinks] = useState([])
    const [pulseTasks, setPulseTasks] = useState({})
    const [ready, setReady] = useState(false)

    const load = useCallback(async () => {
        if (!user?.id || !pulse.enabled) { setLinks([]); setPulseTasks({}); setReady(false); return }
        const { data: rows } = await supabase
            .from('pulse_xpm_task_links')
            .select('id, xpm_task_id, xpm_project_id, xpm_workspace_id, pulse_task_id, pulse_task_title, pulse_project_tag, sync_status, created_at')
            .eq('user_id', user.id)
            .neq('sync_status', 'ignored')
        const list = rows || []
        setLinks(list)

        // Only tasks that are already linked to an xPM project; the rest of the
        // Pulse list (personal tasks) is never read.
        const ids = list.filter((l) => l.xpm_task_id || l.xpm_project_id).map((l) => l.pulse_task_id)
        if (ids.length) {
            const { data: pts } = await supabase
                .from('tasks')
                .select('id, start_at, due_at, all_day, completed_at, status, tags, list_id, deleted_at')
                .in('id', ids)
            setPulseTasks(Object.fromEntries((pts || []).filter((t) => !t.deleted_at).map((t) => [String(t.id), t])))
        } else setPulseTasks({})
        setReady(true)
    }, [user?.id, pulse.enabled])

    useEffect(() => { load() }, [load])

    // xPM task id -> { link, pulseTask, location }
    const byXpmTask = useMemo(() => {
        const m = new Map()
        for (const l of links) {
            if (!l.xpm_task_id) continue
            const pt = pulseTasks[String(l.pulse_task_id)] || null
            m.set(l.xpm_task_id, { link: l, pulseTask: pt, location: pulseLocation(pt) })
        }
        return m
    }, [links, pulseTasks])

    const needsReview = useMemo(() => links.filter((l) => l.sync_status === 'needs_review'), [links])

    // ── Auto-send ────────────────────────────────────────────────────────────
    // Runs when xPM loads or the tasks change. Skips anything already linked or
    // sent, undated tasks, Someday tasks and anyone else's tasks.
    const running = useRef(false)
    useEffect(() => {
        if (!ready || !pulse.autoSend || !user?.id || !projects || running.current) return
        const linked = new Set(links.map((l) => l.xpm_task_id).filter(Boolean))
        const todo = autoSendCandidates(projects, user.id, pulse.days, linked).slice(0, MAX_AUTO_SEND_PER_RUN)
        if (!todo.length) return
        running.current = true
        ;(async () => {
            let sent = 0
            for (const t of todo) {
                const ok = await sendTaskToPulse(t, user.id, workspaceId)
                if (ok) {
                    sent++
                    dispatch(patchTask({ projectId: t.projectId, task: { id: t.id, custom_fields: { ...(t.custom_fields || {}), sent_to_pulse: true } } }))
                }
            }
            running.current = false
            if (sent) { toast.success(`Sent ${sent} task${sent > 1 ? 's' : ''} to Pulse`); load() }
        })()
    }, [ready, pulse.autoSend, pulse.days, user?.id, projects, links, workspaceId, dispatch, load])

    const value = useMemo(() => ({
        enabled: pulse.enabled, ready, links, byXpmTask, needsReview, reload: load,
    }), [pulse.enabled, ready, links, byXpmTask, needsReview, load])

    return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>
}

const EMPTY = { enabled: false, ready: false, links: [], byXpmTask: new Map(), needsReview: [], reload: () => {} }
export const usePulse = () => useContext(PulseContext) || EMPTY
