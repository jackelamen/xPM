-- Update task type constraint from developer-centric to general types

-- First migrate existing rows so no old values remain
UPDATE xpm_tasks
SET type = 'OTHER'
WHERE type IN ('TASK', 'BUG', 'FEATURE', 'IMPROVEMENT');

-- Drop old constraint and add new one
ALTER TABLE xpm_tasks DROP CONSTRAINT IF EXISTS xpm_tasks_type_check;

ALTER TABLE xpm_tasks
  ADD CONSTRAINT xpm_tasks_type_check
  CHECK (type IN ('MEETING', 'WRITING', 'STRATEGY', 'DESIGN', 'ADMIN', 'OTHER'));

-- Update the column default
ALTER TABLE xpm_tasks ALTER COLUMN type SET DEFAULT 'OTHER';
