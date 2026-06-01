drop table if exists public.project_field_definitions cascade;

create table public.project_field_definitions (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects(id) on delete cascade,
    key         text not null,
    label       text not null,
    field_type  text not null default 'text' check (field_type in ('text', 'date', 'tags', 'select')),
    visible     boolean not null default true,
    position    integer not null default 0,
    created_at  timestamptz default now(),
    unique (project_id, key)
);

alter table public.project_field_definitions enable row level security;

create policy "workspace members can read field definitions"
    on public.project_field_definitions for select
    using (
        project_id in (
            select p.id from public.projects p
            join public.workspace_members wm on wm.workspace_id = p.workspace_id
            where wm.user_id = auth.uid()
        )
    );

create policy "workspace members can insert field definitions"
    on public.project_field_definitions for insert
    with check (
        project_id in (
            select p.id from public.projects p
            join public.workspace_members wm on wm.workspace_id = p.workspace_id
            where wm.user_id = auth.uid()
        )
    );

create policy "workspace members can update field definitions"
    on public.project_field_definitions for update
    using (
        project_id in (
            select p.id from public.projects p
            join public.workspace_members wm on wm.workspace_id = p.workspace_id
            where wm.user_id = auth.uid()
        )
    );

create policy "workspace members can delete field definitions"
    on public.project_field_definitions for delete
    using (
        project_id in (
            select p.id from public.projects p
            join public.workspace_members wm on wm.workspace_id = p.workspace_id
            where wm.user_id = auth.uid()
        )
    );

notify pgrst, 'reload schema';