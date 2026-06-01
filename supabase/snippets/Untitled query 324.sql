alter table public.project_field_definitions 
add constraint project_field_definitions_project_id_key_key 
unique (project_id, key);

notify pgrst, 'reload schema';