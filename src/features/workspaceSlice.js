import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "../lib/supabase";

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const fetchWorkspaces = createAsyncThunk(
    "workspace/fetchWorkspaces",
    async (_, { rejectWithValue }) => {
        try {
            // Fetch workspaces the current user is a member of
            const { data: memberships, error: memberError } = await supabase
                .from("workspace_members")
                .select("workspace_id")

            if (memberError) throw memberError
            if (!memberships.length) return []

            const workspaceIds = memberships.map((m) => m.workspace_id)

            const { data: workspaces, error: wsError } = await supabase
                .from("workspaces")
                .select("*")
                .in("id", workspaceIds)

            if (wsError) throw wsError
            return workspaces
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
                    .from("tasks")
                    .select("id, project_id, title, description, status, type, priority, assignee_id, due_date, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)")
                    .in("project_id", projectIds)
                    .order("position", { ascending: true })

                if (taskError) throw taskError
                tasks = taskData
            }

            // Attach tasks to their projects
            const projectsWithTasks = projects.map((p) => ({
                ...p,
                tasks: tasks.filter((t) => t.project_id === p.id),
                members: members.filter((m) => m.workspace_id === workspaceId),
            }))

            return { members, projects: projectsWithTasks }
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
    async ({ workspaceId, name, description, status }, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            const { data, error } = await supabase
                .from("projects")
                .insert({
                    workspace_id: workspaceId,
                    name,
                    description,
                    status: status || "ACTIVE",
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
    async ({ workspaceId, projectId, title, description, status, priority, type, assigneeId, dueDate }, { rejectWithValue }) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            const { data, error } = await supabase
                .from("tasks")
                .insert({
                    workspace_id: workspaceId,
                    project_id: projectId,
                    title,
                    description,
                    status: status || "TODO",
                    priority: priority || "MEDIUM",
                    type: type || "TASK",
                    assignee_id: assigneeId || null,
                    due_date: dueDate || null,
                    created_by: user.id,
                })
                .select("id, project_id, title, description, status, type, priority, assignee_id, due_date, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(id, name, email, avatar_url)")
                .single()

            if (error) throw error
            return data
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
                .from("tasks")
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

export const deleteTasks = createAsyncThunk(
    "workspace/deleteTasks",
    async ({ taskIds, projectId }, { rejectWithValue }) => {
        try {
            const { error } = await supabase
                .from("tasks")
                .delete()
                .in("id", taskIds)

            if (error) throw error
            return { taskIds, projectId }
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
        loading: false,
        detailLoading: false,
        error: null,
    },
    reducers: {
        setCurrentWorkspace: (state, action) => {
            const ws = state.workspaces.find((w) => w.id === action.payload)
            if (ws) state.currentWorkspace = ws
        },
        clearWorkspaces: (state) => {
            state.workspaces = []
            state.currentWorkspace = null
        },
    },
    extraReducers: (builder) => {
        // fetchWorkspaces
        builder.addCase(fetchWorkspaces.pending, (state) => { state.loading = true; state.error = null })
        builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
            state.workspaces = action.payload
            state.loading = false
            if (!state.currentWorkspace && action.payload.length > 0) {
                state.currentWorkspace = { ...action.payload[0], members: [], projects: [] }
            }
        })
        builder.addCase(fetchWorkspaces.rejected, (state, action) => { state.loading = false; state.error = action.payload })

        // fetchWorkspaceDetail
        builder.addCase(fetchWorkspaceDetail.pending, (state) => { state.detailLoading = true })
        builder.addCase(fetchWorkspaceDetail.fulfilled, (state, action) => {
            state.detailLoading = false
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
    }
})

export const { setCurrentWorkspace, clearWorkspaces } = workspaceSlice.actions
export default workspaceSlice.reducer
