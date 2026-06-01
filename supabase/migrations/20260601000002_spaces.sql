-- Create spaces table
CREATE TABLE spaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    color text NOT NULL DEFAULT '#6366f1',
    icon text,
    company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
    created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view spaces"
    ON spaces FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "workspace members can insert spaces"
    ON spaces FOR INSERT
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "workspace members can update spaces"
    ON spaces FOR UPDATE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "workspace members can delete spaces"
    ON spaces FOR DELETE
    USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- Add space_id to projects
ALTER TABLE projects ADD COLUMN space_id uuid REFERENCES spaces(id) ON DELETE SET NULL;

-- Seed a "General" space for each workspace and assign existing projects to it
DO $$
DECLARE
    ws RECORD;
    new_space_id uuid;
BEGIN
    FOR ws IN SELECT id FROM workspaces LOOP
        INSERT INTO spaces (workspace_id, name, description, color, icon)
        VALUES (ws.id, 'General', 'Internal and admin work', '#6366f1', 'folder')
        RETURNING id INTO new_space_id;

        UPDATE projects SET space_id = new_space_id WHERE workspace_id = ws.id;
    END LOOP;
END $$;
