-- Find your workspace ID first
select id, name from workspaces;

-- Then insert yourself as a member (replace the UUIDs)
insert into workspace_members (workspace_id, user_id, role)
values ('1adff310-9600-4677-b7bc-602e5b159625', '0098e640-f9ca-42d3-a38b-494b2fd08b84', 'owner')
on conflict do nothing;