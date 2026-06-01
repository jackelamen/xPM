-- =============================================
-- Custom Fields: per-project column definitions
-- + custom_fields JSONB on xpm_tasks
-- =============================================

-- 1. Add custom_fields JSONB to tasks (stores arbitrary key-value pairs)
alter table public.xpm_tasks
    add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- 2. Project field definitions table
--    One row per field per project. Controls label, type, visibility, order.
create table if not exists public.project_field_definitions (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects(id) on delete cascade,
    key         text not null,           -- storage key in custom_fields, e.g. "section", "tags"
    label       text not null,           -- display label, e.g. "Section", "Tags"
    field_type  text not null default 'text' check (field_type in ('text', 'date', 'tags', 'select')),
    visible     boolean not null default true,
    position    integer not null default 0,
    created_at  timestamptz default now(),
    unique (project_id, key)
);

-- RLS
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
