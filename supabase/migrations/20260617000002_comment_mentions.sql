-- =============================================
-- @mentions in task comments
--   - xpm_comment_mentions : which users were mentioned in a comment
--   - can_see_task()       : visibility check mirroring the tasks/projects RLS
--   - trigger              : on mention -> COMMENT_MENTION notification (suppressed
--                            if the mentioned user can't see the task)
--   - extends notifications.type + notification_prefs with COMMENT_MENTION
-- =============================================

-- ---- Extend the notification type + prefs ----
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
    check (type in ('TASK_ASSIGNED', 'TASK_COMPLETED', 'TASK_DUE', 'COMMENT_MENTION'));

alter table public.notification_prefs
    add column if not exists comment_mention_email boolean not null default true,
    add column if not exists comment_mention_push  boolean not null default true;

-- ---- Mentions table ----
create table if not exists public.xpm_comment_mentions (
    id                uuid primary key default gen_random_uuid(),
    comment_id        uuid not null references public.xpm_task_comments(id) on delete cascade,
    mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
    created_at        timestamptz not null default now(),
    unique (comment_id, mentioned_user_id)
);

create index if not exists xpm_comment_mentions_comment_idx on public.xpm_comment_mentions(comment_id);
create index if not exists xpm_comment_mentions_user_idx on public.xpm_comment_mentions(mentioned_user_id);

alter table public.xpm_comment_mentions enable row level security;

-- Read mentions for any comment whose task you can see; write only for comments you authored.
create policy "comment_mentions_select" on public.xpm_comment_mentions
    for select using (
        exists (
            select 1 from public.xpm_task_comments c
            join public.xpm_tasks t on t.id = c.task_id
            where c.id = xpm_comment_mentions.comment_id
              and exists (
                  select 1 from public.workspace_members wm
                  where wm.workspace_id = t.workspace_id and wm.user_id = auth.uid()
              )
        )
    );
create policy "comment_mentions_insert" on public.xpm_comment_mentions
    for insert with check (
        exists (
            select 1 from public.xpm_task_comments c
            where c.id = xpm_comment_mentions.comment_id and c.author_id = auth.uid()
        )
    );

-- ---- Visibility helper (mirrors tasks_select + projects_select RLS) ----
create or replace function public.can_see_task(p_user uuid, p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.xpm_tasks t
        join public.projects p on p.id = t.project_id
        where t.id = p_task
          and exists (
              select 1 from public.workspace_members wm
              where wm.workspace_id = t.workspace_id and wm.user_id = p_user
          )
          and (t.visibility = 'project' or t.private_owner_id = p_user)
          and (p.visibility = 'workspace' or p.private_owner_id = p_user)
    );
$$;

-- ---- Mention -> notification (suppressed when recipient can't see the task) ----
create or replace function public.on_comment_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor  uuid := auth.uid();
    a_name text;
    c      record;
begin
    -- Don't notify yourself.
    if new.mentioned_user_id = actor then
        return new;
    end if;

    select cm.body, t.id as task_id, t.title, t.workspace_id, t.project_id
        into c
    from public.xpm_task_comments cm
    join public.xpm_tasks t on t.id = cm.task_id
    where cm.id = new.comment_id;

    -- Suppress if the mentioned user can't see the task.
    if not public.can_see_task(new.mentioned_user_id, c.task_id) then
        return new;
    end if;

    a_name := public.notif_actor_name(actor);

    insert into public.notifications
        (recipient_id, workspace_id, project_id, task_id, actor_id, type, title, body, data)
    values (
        new.mentioned_user_id, c.workspace_id, c.project_id, c.task_id, actor,
        'COMMENT_MENTION',
        a_name || ' mentioned you in a comment',
        left(c.body, 140),
        jsonb_build_object('comment_id', new.comment_id, 'task_title', c.title)
    );
    return new;
end;
$$;

create trigger xpm_comment_mentions_notify
    after insert on public.xpm_comment_mentions
    for each row execute function public.on_comment_mention();
