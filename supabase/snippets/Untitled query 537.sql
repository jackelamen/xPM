set role authenticated;
set local request.jwt.claims = '{"sub": "0098e640-f9ca-42d3-a38b-494b2fd08b84"}';
select id, title, workspace_id from tasks;
