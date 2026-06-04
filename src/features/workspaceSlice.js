import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "../lib/supabase";

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchWorkspaces = createAsyncThunk(
    "workspace/fetchWorkspaces",
    async (_, { rejectWithValue }) => {
        try {
            // Step 1: get workspace IDs the current user belongs to
            const { data: memberships, error: memberError } = await supabase
                .from("workspace_members")
                .select("workspace_id")

            if (memberError) throw memberError
            if (!memberships || memberships.length === 0) return []

            const workspaceIds = memberships.map((m) => m.workspace_id)

            // Step 2: fetch workspaces by ID (avoids recursive RLS on workspaces policy)
            const { data: workspaces, error: wsError } = await supabase
                .from("workspaces")
                .select("*")
                .in("id", workspaceIds)

            if (wsError) throw wsError
            return workspaces || []
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const fetchWorkspaceDetail = createAsyncThunk(
    "workspace/fetchWorkspaceDetail",
    async (workspaceId, { rejectWithValue }) => {
        try {
            // Fetch members
            const { data: members, error: memberError } = await supabase
                .from("workspace_members")
                .select("*, user:profiles(*)")
                .eq("workspace_id", workspaceId)

            if (memberError) throw memberError

            // Fetch spaces
            const { data: spaces, error: spacesError } = await supabase
                .from("spaces")
                .select("*")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: true })

            if (spacesError) throw spacesError

            // Fetch projects
            const { data: projects, error: projectError } = await supabase
                .from("projects")
                .select("*")
                .eq("workspace_id", workspaceId)
                .is("archived_at", null)
                .order("created_at", { ascending: true })

            if (projectError) throw projectError

            // Fetch tasks for all projects (only columns needed)
            const projectIds = projects.map((p) => p.id)
            let tasks = []
            if (projectIds.length) {
                const { data: taskData, error: taskError } = await supabase
                    .from("xpm_tasks")
                    .select("id, project_id, title, description, status, type, priority, assignee_id, created_by, start_date, due_date, due_time, archived_at, created_at, updated_at, custom_fields, milestone, recurrence_rule, recurrence_anchor_date, assignee:profiles!xpm_tasks_assignee_id_fkey(id, name, email, avatar_url)")
                    .in("project_id", projectIds)
                    .is("archived_at", null)
                    .order("position", { ascending: true })

                if (taskError) throw taskError
                tasks = taskData

                // Fetch multi-assignees for all tasks
                const taskIds = tasks.map((t) => t.id)
                if (taskIds.length) {
                    const { data: assigneeRows } = await supabase
                        .from("xpm_task_assignees")
                        .select("task_id, user:profiles(id, name, email, avatar_url)")
                        .in("task_id", taskIds)
                    if (assigneeRows) {
                        const assigneeMap = {}
                        assigneeRows.forEach(({ task_id, user }) => {
                            if (!assigneeMap[task_id]) assigneeMap[task_id] = []
                            assigneeMap[task_id].push(user)
                        })
                        tasks = tasks.map((t) => ({ ...t, assignees: assigneeMap[t.id] || [] }))
                    }
                }
            }

            // Fetch custom field definitions for all projects
            let fieldDefinitions = []
            if (projectIds.length) {
                const { data: fieldDefs, error: fieldError } = await supabase
                    .from("project_field_definitions")
                    .select("*")
                    .in("project_id", projectIds)
                    .order("position", { ascending: true })
                if (!fieldError) fieldDefinitions = fieldDefs || []
            }

            // Attach tasks + field definitions to their projects
            const projectsWithTasks = projects.map((p) => ({
                ...p,
                tasks: tasks.filter((t) => t.project_id === p.id),
                members: members.filter((m) => m.workspace_id === workspaceId),
                fieldDefinitions: fieldDefinitions.filter((f) => f.project_id === p.id),
            }))

            return { members, spaces: spaces || [], projects: projectsWithTasks }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const createSpace = createAsyncThunk(
    "workspace/createSpace",
    async ({ workspaceId, name, description, color, icon_url }, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data, error } = await supabase
                .from("spaces")
                .insert({ workspace_id: workspaceId, name, description, color: color || "#6366f1", icon_url: icon_url || null, created_by: user.id })
                .select()
                .single()
            if (error) throw error
            return data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const updateSpace = createAsyncThunk(
    "workspace/updateSpace",
    async ({ spaceId, name, description, color, icon_url }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from("spaces")
                .update({ name, description, color, icon_url: icon_url ?? undefined, updated_at: new Date().toISOString() })
                .eq("id", spaceId)
                .select()
                .single()
            if (error) throw error
            return data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const deleteSpace = createAsyncThunk(
    "workspace/deleteSpace",
    async ({ spaceId }, { rejectWithValue }) => {
        try {
            const { error } = await supabase.from("spaces").delete().eq("id", spaceId)
            if (error) throw error
            return spaceId
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const createWorkspace = createAsyncThunk(
    "workspace/createWorkspace",
    async ({ name, userId }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .rpc("create_workspace_for_user", {
                    p_name: name,
                    p_user_id: userId,
                })

            if (error) throw error

            return { ...data, members: [], projects: [] }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const createProject = createAsyncThunk(
    "workspace/createProject",
    async ({ workspaceId, name, description, status, priority, startDate, endDate, spaceId }, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            const { data, error } = await supabase
                .from("projects")
                .insert({
                    workspace_id: workspaceId,
                    name,
                    description,
                    status: status || "ACTIVE",
                    priority: priority || "MEDIUM",
                    start_date: startDate || null,
                    end_date: endDate || null,
                    space_id: spaceId || null,
                    created_by: user.id,
                })
                .select()
                .single()

            if (error) throw error
            return { ...data, tasks: [], members: [] }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const createTask = createAsyncThunk(
    "workspace/createTask",
    async ({ workspaceId, projectId, title, description, status, priority, type, leadId, assigneeIds, startDate, dueDate, dueTime, customFields }, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            const { data, error } = await supabase
                .from("xpm_tasks")
                .insert({
                    workspace_id: workspaceId,
                    project_id: projectId,
                    title,
                    description,
                    status: status || "TODO",
                    priority: priority || "MEDIUM",
                    type: type || "OTHER",
                    assignee_id: leadId || null,
                    start_date: startDate || null,
                    due_date: dueDate || null,
                    due_time: dueTime || null,
                    custom_fields: customFields || {},
                    created_by: user.id,
                })
                .select("id, project_id, title, description, status, type, priority, assignee_id, created_by, start_date, due_date, due_time, archived_at, created_at, updated_at, custom_fields, milestone, recurrence_rule, recurrence_anchor_date, assignee:profiles!xpm_tasks_assignee_id_fkey(id, name, email, avatar_url)")
                .single()

            if (error) throw error

            // Insert multi-assignees
            const ids = assigneeIds?.length ? assigneeIds : (leadId ? [leadId] : [])
            if (ids.length) {
                await supabase.from("xpm_task_assignees").insert(
                    ids.map((uid) => ({ task_id: data.id, user_id: uid }))
                )
            }

            // Fetch assignee profiles to attach
            const { data: assigneeRows } = await supabase
                .from("xpm_task_assignees")
                .select("user:profiles(id, name, email, avatar_url)")
                .eq("task_id", data.id)

            return { ...data, assignees: (assigneeRows || []).map((r) => r.user) }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const updateTaskStatus = createAsyncThunk(
    "workspace/updateTaskStatus",
    async ({ taskId, projectId, status }, { rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from("xpm_tasks")
                .update({ status, updated_at: new Date().toISOString() })
                .eq("id", taskId)
                .select("id, project_id, status")
                .single()

            if (error) throw error
            return data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const updateTask = createAsyncThunk(
    "workspace/updateTask",
    async ({ taskId, projectId, fields }, { dispatch, rejectWithValue }) => {
        try {
            const { data, error } = await supabase
                .from("xpm_tasks")
                .update({ ...fields, updated_at: new Date().toISOString() })
                .eq("id", taskId)
                .select("*")
                .single()
            if (error) throw error
            dispatch(patchTask({ projectId, task: data }))
            return data
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// Replace all assignees for a task (pass empty array to clear)
export const setTaskAssignees = createAsyncThunk(
    "workspace/setTaskAssignees",
    async ({ taskId, projectId, leadId, assigneeIds }, { dispatch, rejectWithValue }) => {
        try {
            // Update lead on the task row
            const { error: taskError } = await supabase
                .from("xpm_tasks")
                .update({ assignee_id: leadId || null, updated_at: new Date().toISOString() })
                .eq("id", taskId)
            if (taskError) throw taskError

            // Replace join table rows
            await supabase.from("xpm_task_assignees").delete().eq("task_id", taskId)
            const ids = assigneeIds?.length ? assigneeIds : (leadId ? [leadId] : [])
            if (ids.length) {
                await supabase.from("xpm_task_assignees").insert(
                    ids.map((uid) => ({ task_id: taskId, user_id: uid }))
                )
            }

            // Fetch updated assignee profiles
            const { data: assigneeRows } = await supabase
                .from("xpm_task_assignees")
                .select("user:profiles(id, name, email, avatar_url)")
                .eq("task_id", taskId)

            const assignees = (assigneeRows || []).map((r) => r.user)
            dispatch(patchTask({ projectId, task: { id: taskId, assignee_id: leadId || null, assignees } }))
            return { taskId, assignees }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const deleteTasks = createAsyncThunk(
    "workspace/deleteTasks",
    async ({ taskIds, projectId }, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from("xpm_tasks")
                .delete()
                .in("id", taskIds)

            if (error) throw error
            return { taskIds, projectId }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const archiveTasks = createAsyncThunk(
    "workspace/archiveTasks",
    async ({ taskIds, projectId }, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from("xpm_tasks")
                .update({ archived_at: new Date().toISOString() })
                .in("id", taskIds)

            if (error) throw error
            return { taskIds, projectId }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const archiveProjects = createAsyncThunk(
    "workspace/archiveProjects",
    async ({ projectIds }, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from("projects")
                .update({ archived_at: new Date().toISOString() })
                .in("id", projectIds)

            if (error) throw error
            return { projectIds }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

export const upsertFieldDefinitions = createAsyncThunk(
    "workspace/upsertFieldDefinitions",
    async ({ projectId, fields }, { rejectWithValue }) => {
        // fields: array of { key, label, field_type, visible, position }
        try {
            const rows = fields.map((f) => ({ ...f, project_id: projectId }))
            const { data, error } = await supabase
                .from("project_field_definitions")
                .upsert(rows, { onConflict: "project_id,key" })
                .select()
            if (error) throw error
            return { projectId, fields: data }
        } catch (err) {
            return rejectWithValue(err.message)
        }
    }
)

// ─── Slice ────────────────────────────────────────────────────────────────────

const workspaceSlice = createSlice({
    name: "workspace",
    initialState: {
        workspaces: [],
        currentWorkspace: null,
        spaces: [],
        loading: false,
        detailLoading: false,
        error: null,
    },
    reducers: {
        setCurrentWorkspace: (state, action) => {
            const ws = state.workspaces.find((w) => w.id === action.payload)
            if (ws) {
                state.currentWorkspace = { ...ws, members: state.currentWorkspace?.members || [], projects: state.currentWorkspace?.projects || [] }
                try { localStorage.setItem('xpm_last_workspace_id', action.payload) } catch {}
            }
        },
        clearWorkspaces: (state) => {
            state.workspaces = []
            state.currentWorkspace = null
        },
        patchTask: (state, action) => {
            const { projectId, task } = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                    p.id === projectId
                        ? { ...p, tasks: p.tasks.map((t) => t.id === task.id ? { ...t, ...task } : t) }
                        : p
                )
            }
        },
    },
    extraReducers: (builder) => {
        // fetchWorkspaces
        builder.addCase(fetchWorkspaces.pending, (state) => { state.loading = true; state.error = null })
        builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
            state.workspaces = action.payload
            state.loading = false
            if (!state.currentWorkspace && action.payload.length > 0) {
                // Restore last selected workspace, fall back to first
                let lastId = null
                try { lastId = localStorage.getItem('xpm_last_workspace_id') } catch {}
                const preferred = lastId && action.payload.find((w) => w.id === lastId)
                state.currentWorkspace = { ...(preferred || action.payload[0]), members: [], projects: [] }
            }
        })
        builder.addCase(fetchWorkspaces.rejected, (state, action) => { state.loading = false; state.error = action.payload })

        // fetchWorkspaceDetail
        builder.addCase(fetchWorkspaceDetail.pending, (state) => { state.detailLoading = true })
        builder.addCase(fetchWorkspaceDetail.fulfilled, (state, action) => {
            state.detailLoading = false
            state.spaces = action.payload.spaces || []
            if (state.currentWorkspace) {
                state.currentWorkspace = {
                    ...state.currentWorkspace,
                    members: action.payload.members,
                    projects: action.payload.projects,
                }
                state.workspaces = state.workspaces.map((w) =>
                    w.id === state.currentWorkspace.id ? state.currentWorkspace : w
                )
            }
        })
        builder.addCase(fetchWorkspaceDetail.rejected, (state) => { state.detailLoading = false })

        // createSpace
        builder.addCase(createSpace.fulfilled, (state, action) => {
            state.spaces.push(action.payload)
        })

        // updateSpace
        builder.addCase(updateSpace.fulfilled, (state, action) => {
            state.spaces = state.spaces.map((s) => s.id === action.payload.id ? action.payload : s)
        })

        // deleteSpace
        builder.addCase(deleteSpace.fulfilled, (state, action) => {
            state.spaces = state.spaces.filter((s) => s.id !== action.payload)
        })

        // createWorkspace
        builder.addCase(createWorkspace.fulfilled, (state, action) => {
            state.workspaces.push(action.payload)
            state.currentWorkspace = action.payload
        })

        // createProject
        builder.addCase(createProject.fulfilled, (state, action) => {
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = [...(state.currentWorkspace.projects || []), action.payload]
                state.workspaces = state.workspaces.map((w) =>
                    w.id === state.currentWorkspace.id ? state.currentWorkspace : w
                )
            }
        })

        // createTask
        builder.addCase(createTask.fulfilled, (state, action) => {
            const task = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                    p.id === task.project_id ? { ...p, tasks: [...p.tasks, task] } : p
                )
                state.workspaces = state.workspaces.map((w) =>
                    w.id === state.currentWorkspace.id ? state.currentWorkspace : w
                )
            }
        })

        // updateTaskStatus
        builder.addCase(updateTaskStatus.fulfilled, (state, action) => {
            const { id, project_id, status } = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                    p.id === project_id
                        ? { ...p, tasks: p.tasks.map((t) => t.id === id ? { ...t, status } : t) }
                        : p
                )
            }
        })

        // deleteTasks
        builder.addCase(deleteTasks.fulfilled, (state, action) => {
            const { taskIds, projectId } = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                    p.id === projectId
                        ? { ...p, tasks: p.tasks.filter((t) => !taskIds.includes(t.id)) }
                        : p
                )
            }
        })

        // archiveTasks
        builder.addCase(archiveTasks.fulfilled, (state, action) => {
            const { taskIds, projectId } = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                    p.id === projectId
                        ? { ...p, tasks: p.tasks.filter((t) => !taskIds.includes(t.id)) }
                        : p
                )
            }
        })

        // archiveProjects
        builder.addCase(archiveProjects.fulfilled, (state, action) => {
            const { projectIds } = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.filter(
                    (p) => !projectIds.includes(p.id)
                )
            }
        })

        // upsertFieldDefinitions
        builder.addCase(upsertFieldDefinitions.fulfilled, (state, action) => {
            const { projectId, fields } = action.payload
            if (state.currentWorkspace) {
                state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
                    p.id === projectId ? { ...p, fieldDefinitions: fields } : p
                )
            }
        })
    }
})

export const { setCurrentWorkspace, clearWorkspaces, patchTask } = workspaceSlice.actions
export default workspaceSlice.reducer
