create policy "projects_delete" on public.projects for delete
    using (
        exists (
            select 1 from public.workspace_members
            where workspace_id = projects.workspace_id and user_id = auth.uid()
        )
    );
    