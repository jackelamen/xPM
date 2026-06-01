-- Add recurrence and estimation columns to tasks
-- These were in the project scope but missing from the initial schema.
alter table public.xpm_tasks
    add column if not exists recurrence_rule text
        check (recurrence_rule in ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    add column if not exists recurrence_anchor_date date,
    add column if not exists estimate_minutes integer;

-- Drop and recreate — Postgres won't allow create or replace when return type changes
drop function if exists public.get_xpm_tasks_for_pulse(uuid);

create function public.get_xpm_tasks_for_pulse(p_user_id uuid default null)
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
    from public.xpm_tasks t
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
