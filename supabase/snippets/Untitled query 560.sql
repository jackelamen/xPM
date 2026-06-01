alter table public.project_field_definitions add column if not exists label text not null default '';
notify pgrst, 'reload schema';
