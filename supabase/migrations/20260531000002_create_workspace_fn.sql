-- Function to create a workspace and add the creator as admin
-- Runs as SECURITY DEFINER to bypass RLS during the bootstrapping step
create or replace function public.create_workspace_for_user(
    p_name text,
    p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace workspaces;
begin
    -- Insert workspace
    insert into public.workspaces (name, created_by)
    values (p_name, p_user_id)
    returning * into v_workspace;

    -- Add creator as admin member
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace.id, p_user_id, 'admin');

    return row_to_json(v_workspace);
end;
$$;
