-- =============================================
-- Stop notifying for archived (and, for assignment, already-completed) tasks
--
-- Archiving a task only sets archived_at (see archiveTasks in
-- workspaceSlice.js) - it does not require the task to be DONE first. Two
-- gaps this leaves in 20260617000001_notifications.sql:
--
--   1. enqueue_due_reminders() excludes status = 'DONE' but never checks
--      archived_at, so an archived task with a past due_date generates a
--      TASK_DUE reminder every day indefinitely - the "once per day" guard
--      only limits frequency, it never stops.
--   2. on_task_notify()'s TASK_ASSIGNED branch has no status or archived_at
--      check at all, so reassigning an archived or already-completed task
--      (a normal record-keeping action, not new work) still sends
--      "X assigned you a task".
-- =============================================

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
      and t.archived_at is null
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
    -- Skipped for archived or already-completed tasks - reassigning one of
    -- those is bookkeeping, not new work landing on someone's plate.
    if new.assignee_id is not null
       and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
       and new.assignee_id is distinct from actor
       and new.archived_at is null
       and new.status <> 'DONE' then
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
