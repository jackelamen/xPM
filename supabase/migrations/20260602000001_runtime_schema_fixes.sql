-- Runtime schema fixes for fields already used by the React app.

alter table public.workspaces
    add column if not exists icon_url text;

alter table public.spaces
    add column if not exists icon_url text;

alter table public.projects
    add column if not exists priority text default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH')),
    add column if not exists progress integer not null default 0 check (progress >= 0 and progress <= 100),
    add column if not exists start_date date,
    add column if not exists end_date date;

alter table public.xpm_tasks
    add column if not exists archived_at timestamptz;

create index if not exists tasks_archived_at_idx on public.xpm_tasks(archived_at);
