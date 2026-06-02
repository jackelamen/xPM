-- =============================================
-- EDGEx PM Initial Schema
-- =============================================

create extension if not exists pgcrypto;

-- Profiles (linked to Supabase Auth)
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text,
    email text,
    avatar_url text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, name)
    values (new.id, new.email, split_part(new.email, '@', 1));
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Workspaces
create table public.workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Workspace members
create table public.workspace_members (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    role text not null default 'member' check (role in ('admin', 'member')),
    created_at timestamptz default now(),
    unique (workspace_id, user_id)
);

-- Projects
create table public.projects (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    description text,
    color text,
    icon text,
    status text not null default 'ACTIVE' check (status in ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
    visibility text not null default 'workspace' check (visibility in ('workspace', 'private')),
    private_owner_id uuid references public.profiles(id) on delete set null,
    archived_at timestamptz,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Project sections
create table public.project_sections (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    position integer not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Tasks
create table public.xpm_tasks (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    section_id uuid references public.project_sections(id) on delete set null,
    title text not null,
    description text,
    status text not null default 'TODO' check (status in ('TODO', 'IN_PROGRESS', 'DONE')),
    priority text check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    type text not null default 'TASK' check (type in ('TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER')),
    assignee_id uuid references public.profiles(id) on delete set null,
    visibility text not null default 'project' check (visibility in ('project', 'private')),
    private_owner_id uuid references public.profiles(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    start_date date,
    due_date date,
    completed_at timestamptz,
    parent_task_id uuid references public.xpm_tasks(id) on delete set null,
    milestone boolean not null default false,
    position integer not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Task comments
create table public.xpm_task_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.xpm_tasks(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    body text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Task activity
create table public.xpm_task_activity_events (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references public.workspaces(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    task_id uuid references public.xpm_tasks(id) on delete cascade,
    actor_id uuid references public.profiles(id) on delete set null,
    event_type text not null,
    event_data jsonb default '{}',
    created_at timestamptz default now()
);

-- =============================================
-- Row Level Security
-- =============================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_sections enable row level security;
alter table public.xpm_tasks enable row level security;
alter table public.xpm_task_comments enable row level security;
alter table public.xpm_task_activity_events enable row level security;

-- Profiles: users can read all profiles, update only their own
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Workspaces: members can see their workspaces
create policy "workspaces_select" on public.workspaces for select
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = workspaces.id and user_id = auth.uid()
    ));
create policy "workspaces_insert" on public.workspaces for insert
    with check (auth.uid() IS NOT NULL);
create policy "workspaces_update" on public.workspaces for update
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = workspaces.id and user_id = auth.uid() and role = 'admin'
    ));

-- Workspace members: see all members of any workspace you belong to
create policy "workspace_members_select" on public.workspace_members for select
    using (
        workspace_id in (
            select workspace_id from public.workspace_members
            where user_id = auth.uid()
        )
    );
create policy "workspace_members_insert" on public.workspace_members for insert
    with check (
        workspace_id in (
            select workspace_id from public.workspace_members
            where user_id = auth.uid()
        )
    );

-- Projects: workspace members see shared projects; private projects only to owner
create policy "projects_select" on public.projects for select
    using (
        exists (
            select 1 from public.workspace_members
            where workspace_id = projects.workspace_id and user_id = auth.uid()
        ) and (
            visibility = 'workspace' or private_owner_id = auth.uid()
        )
    );
create policy "projects_insert" on public.projects for insert
    with check (
        exists (
            select 1 from public.workspace_members
            where workspace_id = projects.workspace_id and user_id = auth.uid()
        )
    );
create policy "projects_update" on public.projects for update
    using (
        exists (
            select 1 from public.workspace_members
            where workspace_id = projects.workspace_id and user_id = auth.uid()
        )
    );

-- Project sections
create policy "sections_select" on public.project_sections for select
    using (exists (
        select 1 from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = project_sections.project_id and wm.user_id = auth.uid()
    ));
create policy "sections_insert" on public.project_sections for insert
    with check (exists (
        select 1 from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = project_sections.project_id and wm.user_id = auth.uid()
    ));
create policy "sections_update" on public.project_sections for update
    using (exists (
        select 1 from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = project_sections.project_id and wm.user_id = auth.uid()
    ));

-- Tasks
create policy "tasks_select" on public.xpm_tasks for select
    using (
        exists (
            select 1 from public.workspace_members
            where workspace_id = xpm_tasks.workspace_id and user_id = auth.uid()
        ) and (
            visibility = 'project' or private_owner_id = auth.uid()
        )
    );
create policy "tasks_insert" on public.xpm_tasks for insert
    with check (
        exists (
            select 1 from public.workspace_members
            where workspace_id = xpm_tasks.workspace_id and user_id = auth.uid()
        )
    );
create policy "tasks_update" on public.xpm_tasks for update
    using (
        exists (
            select 1 from public.workspace_members
            where workspace_id = xpm_tasks.workspace_id and user_id = auth.uid()
        )
    );
create policy "tasks_delete" on public.xpm_tasks for delete
    using (
        exists (
            select 1 from public.workspace_members
            where workspace_id = xpm_tasks.workspace_id and user_id = auth.uid()
        )
    );

-- Task comments
create policy "comments_select" on public.xpm_task_comments for select
    using (exists (
        select 1 from public.xpm_tasks t
        join public.workspace_members wm on wm.workspace_id = t.workspace_id
        where t.id = xpm_task_comments.task_id and wm.user_id = auth.uid()
    ));
create policy "comments_insert" on public.xpm_task_comments for insert
    with check (auth.uid() = author_id);
create policy "comments_update" on public.xpm_task_comments for update
    using (auth.uid() = author_id);
create policy "comments_delete" on public.xpm_task_comments for delete
    using (auth.uid() = author_id);

-- Activity events
create policy "activity_select" on public.xpm_task_activity_events for select
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = xpm_task_activity_events.workspace_id and user_id = auth.uid()
    ));
create policy "activity_insert" on public.xpm_task_activity_events for insert
    with check (auth.uid() = actor_id);

-- =============================================
-- Indexes for performance
-- =============================================

create index xpm_tasks_workspace_id_idx on public.xpm_tasks(workspace_id);
create index xpm_tasks_project_id_idx on public.xpm_tasks(project_id);
create index xpm_tasks_assignee_id_idx on public.xpm_tasks(assignee_id);
create index xpm_tasks_due_date_idx on public.xpm_tasks(due_date);
create index projects_workspace_id_idx on public.projects(workspace_id);
create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index xpm_activity_task_id_idx on public.xpm_task_activity_events(task_id);
