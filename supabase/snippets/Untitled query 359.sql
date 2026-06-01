select pg_get_constraintdef(oid) from pg_constraint 
where conname = 'workspace_members_role_check';