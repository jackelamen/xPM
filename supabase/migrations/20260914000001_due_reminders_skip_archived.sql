-- enqueue_due_reminders() never excluded archived tasks: archiving a task
-- doesn't necessarily set status = 'DONE', so an archived-but-not-DONE
-- task with a past due_date kept generating a fresh TASK_DUE notification
-- every day, forever. Add the same archived_at guard used elsewhere
-- (e.g. get_my_tasks_global).

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
