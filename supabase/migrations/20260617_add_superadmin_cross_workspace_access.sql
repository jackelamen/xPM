-- Superadmin cross-workspace access
-- Lets a flagged superadmin read/update tasks across ALL workspaces,
-- without changing membership-based access for everyone else.

-- 1. Superadmin flag
alter table profiles add column if not exists is_superadmin boolean not null default false;
update profiles set is_superadmin = true where id = 'd17e7539-c970-490e-b13c-c7e49c37e6de'; -- jackelamen@gmail.com

-- 2. Helper that bypasses RLS to read the flag (avoids recursive policy evaluation)
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_superadmin from profiles where id = auth.uid()), false);
$$;

-- 3. Widen task read + update policies to allow the superadmin across all workspaces
drop policy if exists tasks_select on xpm_tasks;
create policy tasks_select on xpm_tasks
for select using (
  public.is_superadmin()
  or exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = xpm_tasks.workspace_id
      and workspace_members.user_id = auth.uid()
  )
);

drop policy if exists tasks_update on xpm_tasks;
create policy tasks_update on xpm_tasks
for update using (
  public.is_superadmin()
  or exists (
    select 1 from workspace_members
    where workspace_members.workspace_id = xpm_tasks.workspace_id
      and workspace_members.user_id = auth.uid()
  )
);
