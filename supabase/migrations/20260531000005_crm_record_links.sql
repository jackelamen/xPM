-- record_links: polymorphic relationship table
-- connects tasks, projects, contacts, companies, deals, and notes to each other
create table public.record_links (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    source_type text not null check (source_type in ('task', 'project', 'contact', 'company', 'deal', 'note')),
    source_id uuid not null,
    target_type text not null check (target_type in ('task', 'project', 'contact', 'company', 'deal', 'note')),
    target_id uuid not null,
    relation_type text not null default 'related' check (relation_type in ('related', 'belongs_to', 'follows_up', 'generated_from', 'blocks')),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now(),
    -- prevent duplicate links
    unique (workspace_id, source_type, source_id, target_type, target_id)
);

alter table public.record_links enable row level security;

create policy "record_links_select" on public.record_links for select
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = record_links.workspace_id and user_id = auth.uid()
    ));

create policy "record_links_insert" on public.record_links for insert
    with check (
        auth.uid() = created_by
        and exists (
            select 1 from public.workspace_members
            where workspace_id = record_links.workspace_id and user_id = auth.uid()
        )
    );

create policy "record_links_delete" on public.record_links for delete
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = record_links.workspace_id and user_id = auth.uid()
    ));

create index record_links_source_idx on public.record_links(workspace_id, source_type, source_id);
create index record_links_target_idx on public.record_links(workspace_id, target_type, target_id);

-- deal_notes: notes and activity log for deals
create table public.deal_notes (
    id uuid primary key default gen_random_uuid(),
    deal_id uuid not null references public.deals(id) on delete cascade,
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    author_id uuid references public.profiles(id) on delete set null,
    body text not null,
    note_type text not null default 'note' check (note_type in ('note', 'call', 'email', 'meeting', 'update')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table public.deal_notes enable row level security;

create policy "deal_notes_select" on public.deal_notes for select
    using (exists (
        select 1 from public.workspace_members
        where workspace_id = deal_notes.workspace_id and user_id = auth.uid()
    ));

create policy "deal_notes_insert" on public.deal_notes for insert
    with check (
        auth.uid() = author_id
        and exists (
            select 1 from public.workspace_members
            where workspace_id = deal_notes.workspace_id and user_id = auth.uid()
        )
    );

create policy "deal_notes_update" on public.deal_notes for update
    using (auth.uid() = author_id);

create policy "deal_notes_delete" on public.deal_notes for delete
    using (auth.uid() = author_id);

create index deal_notes_deal_id_idx on public.deal_notes(deal_id);

-- Add size/employee_count fields to companies for enrichment
alter table public.companies
    add column if not exists size text,
    add column if not exists employee_count integer,
    add column if not exists linkedin_url text,
    add column if not exists founded_year integer;

-- Add linkedin_url and source fields to contacts
alter table public.contacts
    add column if not exists linkedin_url text,
    add column if not exists source text;

-- Add probability and description fields to deals
alter table public.deals
    add column if not exists probability integer check (probability >= 0 and probability <= 100),
    add column if not exists description text,
    add column if not exists closed_at timestamptz;
