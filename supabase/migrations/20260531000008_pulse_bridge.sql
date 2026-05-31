-- pulse_xpm_task_links: bridge table connecting Pulse tasks to xPM projects/tasks
-- Pulse lives on the shared Supabase project (mdkyijbgvxedelcqcouu)
-- This table allows Pulse to tag its tasks with an xPM project, and xPM to
-- surface those Pulse tasks in the relevant project views.
create table public.pulse_xpm_task_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    -- xPM side (nullable until a match is confirmed)
    xpm_workspace_id uuid references public.workspaces(id) on delete cascade,
    xpm_project_id uuid references public.projects(id) on delete set null,
    xpm_task_id uuid references public.tasks(id) on delete set null,
    -- Pulse side
    pulse_task_id text not null,          -- Pulse task primary key (text, Pulse owns its schema)
    pulse_task_title text,                 -- cached for display without cross-app join
    pulse_project_tag text,               -- the project name string Pulse user typed
    -- Status
    sync_status text not null default 'linked'
        check (sync_status in ('linked', 'needs_review', 'ignored', 'promoted')),
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, pulse_task_id)
);

alter table public.pulse_xpm_task_links enable row level security;

-- Users can only see/manage their own bridge records
create policy "pulse_xpm_links_select" on public.pulse_xpm_task_links for select
    using (auth.uid() = user_id);
create policy "pulse_xpm_links_insert" on public.pulse_xpm_task_links for insert
    with check (auth.uid() = user_id);
create policy "pulse_xpm_links_update" on public.pulse_xpm_task_links for update
    using (auth.uid() = user_id);
create policy "pulse_xpm_links_delete" on public.pulse_xpm_task_links for delete
    using (auth.uid() = user_id);

create index pulse_xpm_links_user_idx on public.pulse_xpm_task_links(user_id);
create index pulse_xpm_links_project_idx on public.pulse_xpm_task_links(xpm_project_id);
create index pulse_xpm_links_xpm_task_idx on public.pulse_xpm_task_links(xpm_task_id);

-- ─── RPC: get_xpm_tasks_for_pulse ─────────────────────────────────────────────
-- Pulse calls this RPC to fetch xPM tasks assigned to the current user.
-- Returns only tasks the user can see (via workspace membership).
-- Pulse uses this to populate the user's daily planning surface.
create or replace function public.get_xpm_tasks_for_pulse(p_user_id uuid default null)
returns table (
    id uuid,
    title text,
    status text,
    priority text,
    due_date date,
    project_id uuid,
    project_name text,
    workspace_id uuid,
    workspace_name text,
    milestone boolean,
    recurrence_rule text
)
language sql stable security definer as $$
    select
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        p.name as project_name,
        t.workspace_id,
        w.name as workspace_name,
        t.milestone,
        t.recurrence_rule
    from public.tasks t
    join public.projects p on p.id = t.project_id
    join public.workspaces w on w.id = t.workspace_id
    join public.workspace_members wm on wm.workspace_id = t.workspace_id
    where
        t.assignee_id = coalesce(p_user_id, auth.uid())
        and wm.user_id = auth.uid()
        and t.status != 'DONE'
        and p.archived_at is null
    order by t.due_date asc nulls last, t.priority desc;
$$;

-- ─── RPC: link_pulse_task_to_project ─────────────────────────────────────────
-- Called by Pulse when a user tags a task with an xPM project name.
-- Finds the matching xPM project (fuzzy by name) and creates/updates the bridge record.
create or replace function public.link_pulse_task_to_project(
    p_pulse_task_id text,
    p_pulse_task_title text,
    p_project_name text,
    p_workspace_id uuid default null
)
returns jsonb
language plpgsql security definer as $$
declare
    v_project record;
    v_link record;
    v_matches int;
begin
    -- Find matching xPM project(s) by name within the user's workspaces
    select count(*) into v_matches
    from public.projects proj
    join public.workspace_members wm on wm.workspace_id = proj.workspace_id
    where wm.user_id = auth.uid()
      and lower(proj.name) = lower(p_project_name)
      and proj.archived_at is null
      and (p_workspace_id is null or proj.workspace_id = p_workspace_id);

    if v_matches = 0 then
        -- No match — create bridge record in needs_review state
        insert into public.pulse_xpm_task_links
            (user_id, pulse_task_id, pulse_task_title, pulse_project_tag, sync_status)
        values
            (auth.uid(), p_pulse_task_id, p_pulse_task_title, p_project_name, 'needs_review')
        on conflict (user_id, pulse_task_id) do update
            set pulse_task_title = excluded.pulse_task_title,
                pulse_project_tag = excluded.pulse_project_tag,
                sync_status = 'needs_review',
                updated_at = now();
        return jsonb_build_object('status', 'needs_review', 'message', 'No matching xPM project found');
    end if;

    if v_matches > 1 then
        -- Multiple matches — store without resolving, surface to user
        insert into public.pulse_xpm_task_links
            (user_id, pulse_task_id, pulse_task_title, pulse_project_tag, sync_status)
        values
            (auth.uid(), p_pulse_task_id, p_pulse_task_title, p_project_name, 'needs_review')
        on conflict (user_id, pulse_task_id) do update
            set pulse_task_title = excluded.pulse_task_title,
                pulse_project_tag = excluded.pulse_project_tag,
                sync_status = 'needs_review',
                updated_at = now();
        return jsonb_build_object('status', 'needs_review', 'message', 'Multiple matching projects found');
    end if;

    -- Exactly one match
    select * into v_project
    from public.projects proj
    join public.workspace_members wm on wm.workspace_id = proj.workspace_id
    where wm.user_id = auth.uid()
      and lower(proj.name) = lower(p_project_name)
      and proj.archived_at is null
      and (p_workspace_id is null or proj.workspace_id = p_workspace_id)
    limit 1;

    insert into public.pulse_xpm_task_links
        (user_id, xpm_workspace_id, xpm_project_id, pulse_task_id, pulse_task_title, pulse_project_tag, sync_status)
    values
        (auth.uid(), v_project.workspace_id, v_project.id, p_pulse_task_id, p_pulse_task_title, p_project_name, 'linked')
    on conflict (user_id, pulse_task_id) do update
        set xpm_workspace_id = excluded.xpm_workspace_id,
            xpm_project_id = excluded.xpm_project_id,
            pulse_task_title = excluded.pulse_task_title,
            pulse_project_tag = excluded.pulse_project_tag,
            sync_status = 'linked',
            updated_at = now();

    return jsonb_build_object('status', 'linked', 'project_id', v_project.id, 'project_name', v_project.name);
end;
$$;
