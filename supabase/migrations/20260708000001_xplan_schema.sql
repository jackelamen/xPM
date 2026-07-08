-- xPlan: BD roadmap planning module.
-- Workspace-scoped lanes + initiatives, with an optional manual link to a CRM
-- deal and (once won) to the space/project that executes the plan. The
-- xplan_* child tables hold the draft client plan (phases/milestones/KPIs)
-- that later gets pushed to xPortal via the bridge — their column names
-- deliberately mirror xPortal's project_milestones / project_kpis shape.

create table public.roadmap_lanes (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    name text not null,
    color text not null default '#6366f1',
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table public.roadmap_initiatives (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    lane_id uuid references public.roadmap_lanes(id) on delete set null,
    deal_id uuid references public.deals(id) on delete set null,
    space_id uuid references public.spaces(id) on delete set null,
    xpm_project_id uuid references public.projects(id) on delete set null,
    title text not null,
    description text,
    owner_id uuid references public.profiles(id) on delete set null,
    start_date date,
    end_date date,
    -- horizon drives the Now/Next/Later board independent of dates
    horizon text not null default 'next' check (horizon in ('now', 'next', 'later')),
    status text not null default 'planned' check (status in ('planned', 'active', 'at-risk', 'done', 'dropped')),
    color text,
    sort_order integer not null default 0,
    last_pushed_at timestamptz,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Draft client plan: phases and point milestones (mirrors xPortal's
-- project_milestones kind='phase'/'milestone' split).
create table public.xplan_phases (
    id uuid primary key default gen_random_uuid(),
    initiative_id uuid not null references public.roadmap_initiatives(id) on delete cascade,
    title text not null,
    starts_on date,
    ends_on date,
    status text not null default 'upcoming' check (status in ('upcoming', 'active', 'done')),
    sort_order integer not null default 0
);

create table public.xplan_milestones (
    id uuid primary key default gen_random_uuid(),
    initiative_id uuid not null references public.roadmap_initiatives(id) on delete cascade,
    title text not null,
    starts_on date,
    status text not null default 'upcoming' check (status in ('upcoming', 'active', 'done')),
    sort_order integer not null default 0
);

-- Draft KPI targets (mirrors xPortal's project_kpis).
create table public.xplan_kpis (
    id uuid primary key default gen_random_uuid(),
    initiative_id uuid not null references public.roadmap_initiatives(id) on delete cascade,
    name text not null,
    kind text not null default 'numeric' check (kind in ('numeric', 'boolean')),
    target_value numeric,
    current_value numeric,
    unit text,
    direction text not null default 'up' check (direction in ('up', 'down')),
    sort_order integer not null default 0
);

-- RLS: same workspace_members pattern as every other module.
alter table public.roadmap_lanes enable row level security;
alter table public.roadmap_initiatives enable row level security;
alter table public.xplan_phases enable row level security;
alter table public.xplan_milestones enable row level security;
alter table public.xplan_kpis enable row level security;

create policy "workspace members full access to lanes"
    on public.roadmap_lanes for all
    using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
    with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "workspace members full access to initiatives"
    on public.roadmap_initiatives for all
    using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
    with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- Child tables inherit access through their initiative's workspace.
create policy "workspace members full access to xplan phases"
    on public.xplan_phases for all
    using (initiative_id in (
        select i.id from public.roadmap_initiatives i
        join public.workspace_members wm on wm.workspace_id = i.workspace_id
        where wm.user_id = auth.uid()
    ))
    with check (initiative_id in (
        select i.id from public.roadmap_initiatives i
        join public.workspace_members wm on wm.workspace_id = i.workspace_id
        where wm.user_id = auth.uid()
    ));

create policy "workspace members full access to xplan milestones"
    on public.xplan_milestones for all
    using (initiative_id in (
        select i.id from public.roadmap_initiatives i
        join public.workspace_members wm on wm.workspace_id = i.workspace_id
        where wm.user_id = auth.uid()
    ))
    with check (initiative_id in (
        select i.id from public.roadmap_initiatives i
        join public.workspace_members wm on wm.workspace_id = i.workspace_id
        where wm.user_id = auth.uid()
    ));

create policy "workspace members full access to xplan kpis"
    on public.xplan_kpis for all
    using (initiative_id in (
        select i.id from public.roadmap_initiatives i
        join public.workspace_members wm on wm.workspace_id = i.workspace_id
        where wm.user_id = auth.uid()
    ))
    with check (initiative_id in (
        select i.id from public.roadmap_initiatives i
        join public.workspace_members wm on wm.workspace_id = i.workspace_id
        where wm.user_id = auth.uid()
    ));

create index roadmap_initiatives_workspace_idx on public.roadmap_initiatives(workspace_id);
create index roadmap_initiatives_lane_idx on public.roadmap_initiatives(lane_id);
create index roadmap_lanes_workspace_idx on public.roadmap_lanes(workspace_id);
create index xplan_phases_initiative_idx on public.xplan_phases(initiative_id);
create index xplan_milestones_initiative_idx on public.xplan_milestones(initiative_id);
create index xplan_kpis_initiative_idx on public.xplan_kpis(initiative_id);
