-- =============================================
-- xPM Notifications
--   - notifications        : one row per recipient per event (also drives in-app bell)
--   - push_subscriptions   : Web Push (VAPID) endpoints per device
--   - notification_prefs   : per-user email/push toggles
--   - triggers             : task assignment + completion -> notification rows
--   - pg_cron              : due-date reminders
--   - dispatch hook        : pg_net -> dispatch-notification edge function (email + push)
-- =============================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------
-- Tables
-- ---------------------------------------------

create table public.notifications (
    id            uuid primary key default gen_random_uuid(),
    recipient_id  uuid not null references public.profiles(id) on delete cascade,
    workspace_id  uuid references public.workspaces(id) on delete cascade,
    project_id    uuid references public.projects(id) on delete cascade,
    task_id       uuid references public.xpm_tasks(id) on delete cascade,
    actor_id      uuid references public.profiles(id) on delete set null,
    type          text not null check (type in ('TASK_ASSIGNED', 'TASK_COMPLETED', 'TASK_DUE')),
    title         text not null,
    body          text,
    data          jsonb not null default '{}',
    read_at       timestamptz,
    email_sent_at timestamptz,
    push_sent_at  timestamptz,
    created_at    timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications(recipient_id) where read_at is null;
create index notifications_task_idx on public.notifications(task_id);

create table public.push_subscriptions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.profiles(id) on delete cascade,
    endpoint   text not null unique,
    p256dh     text not null,
    auth       text not null,
    user_agent text,
    created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

create table public.notification_prefs (
    user_id              uuid primary key references public.profiles(id) on delete cascade,
    task_assigned_email  boolean not null default true,
    task_assigned_push   boolean not null default true,
    task_completed_email boolean not null default true,
    task_completed_push  boolean not null default true,
    task_due_email       boolean not null default true,
    task_due_push        boolean not null default true,
    updated_at           timestamptz not null default now()
);

-- ---------------------------------------------
-- RLS — users see/manage only their own rows
-- ---------------------------------------------

alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;

-- notifications: read + mark-read own; inserts come from SECURITY DEFINER triggers / service role.
create policy "notifications_select_own" on public.notifications
    for select using (auth.uid() = recipient_id);
create policy "notifications_update_own" on public.notifications
    for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
create policy "notifications_delete_own" on public.notifications
    for delete using (auth.uid() = recipient_id);

create policy "push_subscriptions_all_own" on public.push_subscriptions
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notification_prefs_all_own" on public.notification_prefs
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------
-- Dispatch config (service role key + function URL) — kept out of API via private schema
-- Fill these in after deploying (see DEPLOY notes at bottom).
-- ---------------------------------------------

create schema if not exists private;

create table private.notification_config (
    id                integer primary key default 1 check (id = 1),
    functions_base_url text,        -- e.g. https://<ref>.supabase.co/functions/v1
    service_role_key   text
);
insert into private.notification_config (id) values (1) on conflict do nothing;

-- ---------------------------------------------
-- Dispatch hook: every new notification fires the edge function via pg_net
-- ---------------------------------------------

create or replace function public.dispatch_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
    cfg private.notification_config%rowtype;
begin
    select * into cfg from private.notification_config where id = 1;
    if cfg.functions_base_url is null or cfg.service_role_key is null then
        -- Not configured yet; leave the row for in-app bell only.
        return new;
    end if;

    perform net.http_post(
        url     := cfg.functions_base_url || '/dispatch-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || cfg.service_role_key
        ),
        body    := jsonb_build_object('notification_id', new.id)
    );
    return new;
end;
$$;

create trigger notifications_dispatch
    after insert on public.notifications
    for each row execute function public.dispatch_notification();

-- ---------------------------------------------
-- Helpers
-- ---------------------------------------------

create or replace function public.notif_actor_name(p_actor uuid)
returns text
language sql
stable
as $$
    select coalesce(name, email, 'Someone') from public.profiles where id = p_actor;
$$;

-- ---------------------------------------------
-- Task triggers: assignment + completion
-- ---------------------------------------------

create or replace function public.on_task_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor    uuid := auth.uid();
    a_name   text := public.notif_actor_name(coalesce(auth.uid(), new.created_by));
begin
    -- Assignment: new assignee on insert, or assignee changed on update.
    if new.assignee_id is not null
       and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
       and new.assignee_id is distinct from actor then
        insert into public.notifications
            (recipient_id, workspace_id, project_id, task_id, actor_id, type, title, body, data)
        values (
            new.assignee_id, new.workspace_id, new.project_id, new.id, actor,
            'TASK_ASSIGNED',
            a_name || ' assigned you a task',
            new.title,
            jsonb_build_object('task_title', new.title, 'due_date', new.due_date)
        );
    end if;

    -- Completion: status moved to DONE -> notify creator (and assignee if different), excluding the actor.
    if tg_op = 'UPDATE'
       and new.status = 'DONE'
       and old.status is distinct from 'DONE' then
        insert into public.notifications
            (recipient_id, workspace_id, project_id, task_id, actor_id, type, title, body, data)
        select r, new.workspace_id, new.project_id, new.id, actor,
               'TASK_COMPLETED',
               a_name || ' completed a task',
               new.title,
               jsonb_build_object('task_title', new.title)
        from (
            select distinct r
            from unnest(array[new.created_by, new.assignee_id]) as r
            where r is not null and r is distinct from actor
        ) recipients;
    end if;

    return new;
end;
$$;

create trigger xpm_tasks_notify
    after insert or update on public.xpm_tasks
    for each row execute function public.on_task_notify();

-- ---------------------------------------------
-- Due-date reminders (pg_cron, every 15 min)
-- Notifies the assignee for tasks due today or overdue, once per task per day.
-- ---------------------------------------------

create or replace function public.enqueue_due_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.notifications
        (recipient_id, workspace_id, project_id, task_id, actor_id, type, title, body, data)
    select t.assignee_id, t.workspace_id, t.project_id, t.id, null,
           'TASK_DUE',
           case when t.due_date < current_date then 'Task overdue' else 'Task due today' end,
           t.title,
           jsonb_build_object('task_title', t.title, 'due_date', t.due_date)
    from public.xpm_tasks t
    where t.status <> 'DONE'
      and t.assignee_id is not null
      and t.due_date is not null
      and t.due_date <= current_date
      and not exists (
          select 1 from public.notifications n
          where n.task_id = t.id
            and n.type = 'TASK_DUE'
            and n.created_at >= current_date  -- once per calendar day per task
      );
end;
$$;

select cron.schedule(
    'xpm-due-reminders',
    '*/15 * * * *',
    $$select public.enqueue_due_reminders();$$
);

-- ---------------------------------------------
-- DEPLOY NOTES
--   1) supabase functions deploy dispatch-notification
--   2) supabase secrets set RESEND_API_KEY=... VAPID_PUBLIC_KEY=... \
--        VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@domain.com \
--        APP_URL=https://your-app  EMAIL_FROM="xPM <notify@your-domain>"
--   3) Populate the dispatch hook config (run once, service role / SQL editor):
--        update private.notification_config set
--          functions_base_url = 'https://<project-ref>.supabase.co/functions/v1',
--          service_role_key   = '<service-role-key>'
--        where id = 1;
-- =============================================
