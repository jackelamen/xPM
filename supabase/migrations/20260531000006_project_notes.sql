-- project_notes: per-project notes, decisions, meeting notes, and briefs
create table public.project_notes (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    title text not null,
    body text,
    note_type text not null default 'general'
        check (note_type in ('general', 'meeting', 'decision', 'brief', 'planning')),
    created_by uuid references public.profiles(id) on delete set null,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.project_notes enable row level security;

-- Users can read notes for projects in their workspace
create policy "project_notes_select" on public.project_notes for select
    using (exists (
        select 1 from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = project_notes.project_id and wm.user_id = auth.uid()
    ));

create policy "project_notes_insert" on public.project_notes for insert
    with check (
        auth.uid() = created_by
        and exists (
            select 1 from public.projects p
            join public.workspace_members wm on wm.workspace_id = p.workspace_id
            where p.id = project_notes.project_id and wm.user_id = auth.uid()
        )
    );

create policy "project_notes_update" on public.project_notes for update
    using (exists (
        select 1 from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = project_notes.project_id and wm.user_id = auth.uid()
    ));

create policy "project_notes_delete" on public.project_notes for delete
    using (exists (
        select 1 from public.projects p
        join public.workspace_members wm on wm.workspace_id = p.workspace_id
        where p.id = project_notes.project_id and wm.user_id = auth.uid()
    ));

create index project_notes_project_id_idx on public.project_notes(project_id);
create index project_notes_updated_at_idx on public.project_notes(updated_at desc);
