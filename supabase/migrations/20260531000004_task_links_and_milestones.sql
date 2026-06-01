-- Task links table
create table public.xpm_task_links (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.xpm_tasks(id) on delete cascade,
    url text not null,
    label text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now()
);

alter table public.xpm_task_links enable row level security;

create policy "task_links_select" on public.xpm_task_links for select
    using (exists (
        select 1 from public.xpm_tasks t
        join public.workspace_members wm on wm.workspace_id = t.workspace_id
        where t.id = xpm_task_links.task_id and wm.user_id = auth.uid()
    ));

create policy "task_links_insert" on public.xpm_task_links for insert
    with check (auth.uid() = created_by);

create policy "task_links_delete" on public.xpm_task_links for delete
    using (auth.uid() = created_by);

create index xpm_task_links_task_id_idx on public.xpm_task_links(task_id);

-- CRM tables
create table public.contacts (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    email text,
    phone text,
    title text,
    company_id uuid,
    owner_id uuid references public.profiles(id) on delete set null,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.companies (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    website text,
    industry text,
    owner_id uuid references public.profiles(id) on delete set null,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.contacts add constraint contacts_company_fk
    foreign key (company_id) references public.companies(id) on delete set null;

create table public.pipelines (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table public.pipeline_stages (
    id uuid primary key default gen_random_uuid(),
    pipeline_id uuid not null references public.pipelines(id) on delete cascade,
    name text not null,
    position integer not null default 0,
    color text
);

create table public.deals (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    pipeline_id uuid not null references public.pipelines(id) on delete cascade,
    stage_id uuid not null references public.pipeline_stages(id) on delete cascade,
    company_id uuid references public.companies(id) on delete set null,
    contact_id uuid references public.contacts(id) on delete set null,
    name text not null,
    value numeric,
    owner_id uuid references public.profiles(id) on delete set null,
    expected_close_date date,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Saved views
create table public.saved_views (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    owner_id uuid references public.profiles(id) on delete cascade,
    name text not null,
    scope text not null default 'personal' check (scope in ('personal', 'project', 'workspace')),
    view_type text not null default 'list' check (view_type in ('list', 'board', 'calendar', 'timeline', 'gantt', 'workload', 'dashboard')),
    filters jsonb default '{}',
    sorts jsonb default '{}',
    grouping jsonb default '{}',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- RLS for CRM and saved views
alter table public.contacts enable row level security;
alter table public.companies enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.saved_views enable row level security;

create policy "contacts_select" on public.contacts for select
    using (exists (select 1 from public.workspace_members where workspace_id = contacts.workspace_id and user_id = auth.uid()));
create policy "contacts_insert" on public.contacts for insert
    with check (exists (select 1 from public.workspace_members where workspace_id = contacts.workspace_id and user_id = auth.uid()));
create policy "contacts_update" on public.contacts for update
    using (exists (select 1 from public.workspace_members where workspace_id = contacts.workspace_id and user_id = auth.uid()));
create policy "contacts_delete" on public.contacts for delete
    using (exists (select 1 from public.workspace_members where workspace_id = contacts.workspace_id and user_id = auth.uid()));

create policy "companies_select" on public.companies for select
    using (exists (select 1 from public.workspace_members where workspace_id = companies.workspace_id and user_id = auth.uid()));
create policy "companies_insert" on public.companies for insert
    with check (exists (select 1 from public.workspace_members where workspace_id = companies.workspace_id and user_id = auth.uid()));
create policy "companies_update" on public.companies for update
    using (exists (select 1 from public.workspace_members where workspace_id = companies.workspace_id and user_id = auth.uid()));
create policy "companies_delete" on public.companies for delete
    using (exists (select 1 from public.workspace_members where workspace_id = companies.workspace_id and user_id = auth.uid()));

create policy "pipelines_select" on public.pipelines for select
    using (exists (select 1 from public.workspace_members where workspace_id = pipelines.workspace_id and user_id = auth.uid()));
create policy "pipelines_insert" on public.pipelines for insert
    with check (exists (select 1 from public.workspace_members where workspace_id = pipelines.workspace_id and user_id = auth.uid()));
create policy "pipelines_update" on public.pipelines for update
    using (exists (select 1 from public.workspace_members where workspace_id = pipelines.workspace_id and user_id = auth.uid()));

create policy "pipeline_stages_select" on public.pipeline_stages for select
    using (exists (select 1 from public.pipelines p join public.workspace_members wm on wm.workspace_id = p.workspace_id where p.id = pipeline_stages.pipeline_id and wm.user_id = auth.uid()));
create policy "pipeline_stages_insert" on public.pipeline_stages for insert
    with check (exists (select 1 from public.pipelines p join public.workspace_members wm on wm.workspace_id = p.workspace_id where p.id = pipeline_stages.pipeline_id and wm.user_id = auth.uid()));
create policy "pipeline_stages_update" on public.pipeline_stages for update
    using (exists (select 1 from public.pipelines p join public.workspace_members wm on wm.workspace_id = p.workspace_id where p.id = pipeline_stages.pipeline_id and wm.user_id = auth.uid()));
create policy "pipeline_stages_delete" on public.pipeline_stages for delete
    using (exists (select 1 from public.pipelines p join public.workspace_members wm on wm.workspace_id = p.workspace_id where p.id = pipeline_stages.pipeline_id and wm.user_id = auth.uid()));

create policy "deals_select" on public.deals for select
    using (exists (select 1 from public.workspace_members where workspace_id = deals.workspace_id and user_id = auth.uid()));
create policy "deals_insert" on public.deals for insert
    with check (exists (select 1 from public.workspace_members where workspace_id = deals.workspace_id and user_id = auth.uid()));
create policy "deals_update" on public.deals for update
    using (exists (select 1 from public.workspace_members where workspace_id = deals.workspace_id and user_id = auth.uid()));
create policy "deals_delete" on public.deals for delete
    using (exists (select 1 from public.workspace_members where workspace_id = deals.workspace_id and user_id = auth.uid()));

create policy "saved_views_select" on public.saved_views for select
    using (owner_id = auth.uid() or scope != 'personal');
create policy "saved_views_insert" on public.saved_views for insert
    with check (auth.uid() = owner_id);
create policy "saved_views_update" on public.saved_views for update
    using (auth.uid() = owner_id);
create policy "saved_views_delete" on public.saved_views for delete
    using (auth.uid() = owner_id);

-- Indexes
create index contacts_workspace_id_idx on public.contacts(workspace_id);
create index companies_workspace_id_idx on public.companies(workspace_id);
create index deals_workspace_id_idx on public.deals(workspace_id);
create index deals_pipeline_id_idx on public.deals(pipeline_id);
create index deals_stage_id_idx on public.deals(stage_id);
