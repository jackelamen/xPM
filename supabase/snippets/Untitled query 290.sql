alter table public.tasks add column if not exists archived_at timestamptz;
notify pgrst, 'reload schema';