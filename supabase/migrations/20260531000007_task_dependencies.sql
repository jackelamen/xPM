-- task_dependencies: formal scheduling dependencies between tasks
create table public.xpm_task_dependencies (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.xpm_tasks(id) on delete cascade,
    depends_on_task_id uuid not null references public.xpm_tasks(id) on delete cascade,
    dependency_type text not null default 'blocks'
        check (dependency_type in ('blocks', 'blocked_by', 'related')),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz default now(),
    -- prevent duplicate or self-referential deps
    unique (task_id, depends_on_task_id),
    check (task_id != depends_on_task_id)
);

alter table public.xpm_task_dependencies enable row level security;

create policy "task_dependencies_select" on public.xpm_task_dependencies for select
    using (exists (
        select 1 from public.xpm_tasks t
        join public.workspace_members wm on wm.workspace_id = t.workspace_id
        where t.id = xpm_task_dependencies.task_id and wm.user_id = auth.uid()
    ));

create policy "task_dependencies_insert" on public.xpm_task_dependencies for insert
    with check (
        auth.uid() = created_by
        and exists (
            select 1 from public.xpm_tasks t
            join public.workspace_members wm on wm.workspace_id = t.workspace_id
            where t.id = xpm_task_dependencies.task_id and wm.user_id = auth.uid()
        )
    );

create policy "task_dependencies_delete" on public.xpm_task_dependencies for delete
    using (exists (
        select 1 from public.xpm_tasks t
        join public.workspace_members wm on wm.workspace_id = t.workspace_id
        where t.id = xpm_task_dependencies.task_id and wm.user_id = auth.uid()
    ));

create index xpm_task_dependencies_task_id_idx on public.xpm_task_dependencies(task_id);
create index xpm_task_dependencies_depends_on_idx on public.xpm_task_dependencies(depends_on_task_id);

-- Circular dependency check function
-- Returns true if adding task_id -> depends_on_task_id would create a cycle
create or replace function public.would_create_cycle(
    p_task_id uuid,
    p_depends_on_task_id uuid
) returns boolean
language sql stable security definer as $$
    with recursive deps as (
        select task_id, depends_on_task_id
        from public.xpm_task_dependencies
        where task_id = p_depends_on_task_id
        union all
        select d.task_id, d.depends_on_task_id
        from public.xpm_task_dependencies d
        join deps on d.task_id = deps.depends_on_task_id
    )
    select exists (
        select 1 from deps where depends_on_task_id = p_task_id
    );
$$;
