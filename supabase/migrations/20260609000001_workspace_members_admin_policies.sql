-- Reconcile workspace_members RLS with what is live, and add the one missing
-- piece (an UPDATE policy for role changes).
--
-- The live database already had, applied out-of-band:
--   * is_workspace_admin(uuid) helper (SECURITY DEFINER)
--   * workspace_members_insert  → with check is_workspace_admin(workspace_id)
--   * workspace_members_delete  → using (user_id = auth.uid() OR is_workspace_admin(workspace_id))
--   * workspace_members_select  → workspace_id in (select get_my_workspace_ids())
--
-- These statements are written idempotently so applying this migration is safe
-- whether or not the objects already exist. The only behavioural change is the
-- new UPDATE policy: before this, no UPDATE policy existed, so role changes by
-- anyone silently affected zero rows.

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.workspace_members
        where workspace_id = p_workspace_id
          and user_id = auth.uid()
          and role = 'admin'
    );
$$;

-- INSERT: admins only.
drop policy if exists "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members for insert
    with check ( public.is_workspace_admin(workspace_id) );

-- DELETE: admins may remove anyone; any member may remove themselves (leave).
drop policy if exists "workspace_members_delete" on public.workspace_members;
create policy "workspace_members_delete" on public.workspace_members for delete
    using ( user_id = auth.uid() or public.is_workspace_admin(workspace_id) );

-- UPDATE: admins only (role changes). This is the newly added gate.
drop policy if exists "workspace_members_update" on public.workspace_members;
create policy "workspace_members_update" on public.workspace_members for update
    using ( public.is_workspace_admin(workspace_id) )
    with check ( public.is_workspace_admin(workspace_id) );
