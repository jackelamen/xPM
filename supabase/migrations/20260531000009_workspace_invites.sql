
-- workspace_invites: pending email invitations to workspaces
create table public.workspace_invites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    invited_by uuid not null references public.profiles(id) on delete cascade,
    email text not null,
    role text not null default 'member' check (role in ('admin', 'member')),
    token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
    expires_at timestamptz not null default (now() + interval '7 days'),
    created_at timestamptz default now(),
    accepted_at timestamptz,
    unique (workspace_id, email, status) -- prevent duplicate pending invites
);

alter table public.workspace_invites enable row level security;

-- Workspace admins/members can see invites for their workspace
create policy "workspace_invites_select" on public.workspace_invites for select
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = workspace_invites.workspace_id and user_id = auth.uid()
    ));

-- Workspace admins can create invites
create policy "workspace_invites_insert" on public.workspace_invites for insert
    with check (
        auth.uid() = invited_by
        and exists (
            select 1 from public.workspace_members
            where workspace_id = workspace_invites.workspace_id
              and user_id = auth.uid()
              and role = 'admin'
        )
    );

-- Workspace admins can update (cancel) invites
create policy "workspace_invites_update" on public.workspace_invites for update
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = workspace_invites.workspace_id
          and user_id = auth.uid()
          and role = 'admin'
    ));

create index workspace_invites_workspace_id_idx on public.workspace_invites(workspace_id);
create index workspace_invites_token_idx on public.workspace_invites(token);
create index workspace_invites_email_idx on public.workspace_invites(email);

-- RPC: accept_workspace_invite
-- Called after the invited user signs up/logs in and lands on the accept-invite page.
-- Validates the token, adds the user to the workspace, marks invite accepted.
create or replace function public.accept_workspace_invite(p_token text)
returns jsonb
language plpgsql security definer as $$
declare
    v_invite public.workspace_invites;
    v_workspace public.workspaces;
begin
    -- Find and validate token
    select * into v_invite
    from public.workspace_invites
    where token = p_token
      and status = 'pending'
      and expires_at > now();

    if not found then
        return jsonb_build_object('success', false, 'error', 'Invalid or expired invite link');
    end if;

    -- Check user email matches invite (Supabase email is on auth.users)
    if (select email from auth.users where id = auth.uid()) != v_invite.email then
        return jsonb_build_object('success', false, 'error', 'This invite was sent to a different email address');
    end if;

    -- Check not already a member
    if exists (
        select 1 from public.workspace_members
        where workspace_id = v_invite.workspace_id and user_id = auth.uid()
    ) then
        -- Already a member — just mark accepted and return success
        update public.workspace_invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
        select name into v_workspace.name from public.workspaces where id = v_invite.workspace_id;
        return jsonb_build_object('success', true, 'workspace_id', v_invite.workspace_id, 'workspace_name', v_workspace.name, 'already_member', true);
    end if;

    -- Add to workspace
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_invite.workspace_id, auth.uid(), v_invite.role);

    -- Mark accepted
    update public.workspace_invites
    set status = 'accepted', accepted_at = now()
    where id = v_invite.id;

    select name into v_workspace.name from public.workspaces where id = v_invite.workspace_id;

    return jsonb_build_object(
        'success', true,
        'workspace_id', v_invite.workspace_id,
        'workspace_name', v_workspace.name
    );
end;
$$;
