select conname from pg_constraint 
where conrelid = 'public.tasks'::regclass 
and contype = 'f' 
and conname like '%assignee%';
