-- Cross-workspace "my tasks" feed for superadmins.
-- Returns every non-archived task assigned to, created by, or co-assigned to the
-- caller across ALL workspaces. Gated on is_superadmin() so it only works for
-- flagged accounts. SECURITY DEFINER so it can read across workspaces in one call.

create or replace function public.get_my_tasks_global()
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  project_id uuid,
  project_name text,
  parent_task_id uuid,
  title text,
  description text,
  status text,
  type text,
  priority text,
  assignee_id uuid,
  created_by uuid,
  start_date date,
  due_date date,
  due_time text,
  milestone boolean,
  recurrence_rule text,
  recurrence_anchor_date date,
  custom_fields jsonb,
  "position" integer,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.workspace_id, w.name as workspace_name,
    t.project_id, p.name as project_name,
    t.parent_task_id, t.title, t.description,
    t.status::text, t.type::text, t.priority::text,
    t.assignee_id, t.created_by,
    t.start_date, t.due_date, t.due_time::text, t.milestone,
    t.recurrence_rule, t.recurrence_anchor_date, t.custom_fields,
    t.position, t.created_at, t.updated_at
  from xpm_tasks t
  join projects p on p.id = t.project_id
  join workspaces w on w.id = t.workspace_id
  where t.archived_at is null
    and public.is_superadmin()
    and (
      t.assignee_id = auth.uid()
      or t.created_by = auth.uid()
      or exists (
        select 1 from xpm_task_assignees a
        where a.task_id = t.id and a.user_id = auth.uid()
      )
    )
  order by w.name, p.name, t.position;
$$;

grant execute on function public.get_my_tasks_global() to authenticated;
