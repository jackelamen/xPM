-- Apply the full custom_fields migration
create table if not exists public.project_field_definitions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    name text not null,
    field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'select', 'multi_select', 'checkbox', 'url', 'person')),
    options jsonb default '[]',
    position integer not null default 0,
    visible boolean not null default true,
    created_at timestamptz default now()
);

alter table public.tasks add column if not exists custom_fields jsonb default '{}';

-- RLS
alter table public.project_field_definitions enable row level security;

create policy "field_defs_select" on public.project_field_definitions for select
    using (exists (
        select 1 from public.workspace_members wm
        join public.projects p on p.workspace_id = wm.workspace_id
        where p.id = project_id and wm.user_id = auth.uid()
    ));

create policy "field_defs_insert" on public.project_field_definitions for insert
    with check (exists (
        select 1 from public.workspace_members wm
        join public.projects p on p.workspace_id = wm.workspace_id
        where p.id = project_id and wm.user_id = auth.uid()
    ));

create policy "field_defs_update" on public.project_field_definitions for update
    using (exists (
        select 1 from public.workspace_members wm
        join public.projects p on p.workspace_id = wm.workspace_id
        where p.id = project_id and wm.user_id = auth.uid()
    ));

create policy "field_defs_delete" on public.project_field_definitions for delete
    using (exists (
        select 1 from public.workspace_members wm
        join public.projects p on p.workspace_id = wm.workspace_id
        where p.id = project_id and wm.user_id = auth.uid()
    ));