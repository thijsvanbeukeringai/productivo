-- ============================================================
-- IMS - Migration 013: Wristbands per project
-- ============================================================

CREATE TABLE IF NOT EXISTS wristbands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#3b82f6',
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add wristband_id to crew_members
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS wristband_id uuid REFERENCES wristbands(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE wristbands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view wristbands"
  ON wristbands FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = wristbands.project_id
      AND project_members.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage wristbands"
  ON wristbands FOR ALL
  USING (EXISTS (
    SELECT 1 FROM project_members
    WHERE project_members.project_id = wristbands.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('super_admin', 'company_admin', 'centralist')
  ));

CREATE INDEX IF NOT EXISTS wristbands_project_id_idx ON wristbands(project_id);
