import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { fetchWorkspaceDetail } from '../features/workspaceSlice'

const InboxContext = createContext(null)

const TASK_COLS = 'id, project_id, workspace_id, title, description, status, priority, assignee_id, created_by, start_date, due_date, due_time, estimate_minutes, custom_fields, created_at'

// The Inbox is a hidden, per-person project (icon = 'inbox', private to its owner).
// It's kept out of the project list; captured tasks wait here until they're
// triaged into a real project.
export function InboxProvider({ children }) {
    const { user } = useAuth()
    const dispatch = useDispatch()
    const workspaceId = useSelector((s) => s.workspace?.currentWorkspace?.id)
    const [project, setProject] = useState(null)
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        if (!user?.id || !workspaceId) { setProject(null); setTasks([]); setLoading(false); return }
        const { data: proj } = await supabase.from('projects').select('id, name')
            .eq('workspace_id', workspaceId).eq('icon', 'inbox').eq('private_owner_id', user.id).limit(1).maybeSingle()
        setProject(proj || null)
        if (proj) {
            const { data } = await supabase.from('xpm_tasks').select(TASK_COLS)
                .eq('project_id', proj.id).is('archived_at', null).neq('status', 'DONE')
                .order('created_at', { ascending: true })
            setTasks(data || [])
        } else setTasks([])
        setLoading(false)
    }, [user?.id, workspaceId])

    useEffect(() => { setLoading(true); load() }, [load])

    // Creates the Inbox project the first time something is captured.
    const ensure = useCallback(async () => {
        if (project) return project
        const { data, error } = await supabase.from('projects').insert({
            workspace_id: workspaceId, name: 'Inbox', icon: 'inbox', status: 'ACTIVE',
            visibility: 'private', private_owner_id: user.id, created_by: user.id,
        }).select('id, name').single()
        if (error) throw error
        setProject(data)
        return data
    }, [project, workspaceId, user?.id])

    // Moves an inbox task into a real project and applies the triage choices.
    const triage = useCallback(async (task, projectId, patch = {}) => {
        const { error } = await supabase.from('xpm_tasks')
            .update({ project_id: projectId, section_id: null, updated_at: new Date().toISOString(), ...patch })
            .eq('id', task.id)
        if (error) throw error
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
        dispatch(fetchWorkspaceDetail(workspaceId))
    }, [dispatch, workspaceId])

    const discard = useCallback(async (task) => {
        const { error } = await supabase.from('xpm_tasks').delete().eq('id', task.id)
        if (error) throw error
        setTasks((prev) => prev.filter((t) => t.id !== task.id))
    }, [])

    const value = useMemo(() => ({ project, tasks, count: tasks.length, loading, reload: load, ensure, triage, discard }),
        [project, tasks, loading, load, ensure, triage, discard])
    return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

const EMPTY = { project: null, tasks: [], count: 0, loading: false, reload: () => {}, ensure: async () => null, triage: async () => {}, discard: async () => {} }
export const useInbox = () => useContext(InboxContext) || EMPTY
