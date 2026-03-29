-- Map columns on existing tables
ALTER TABLE projects ADD COLUMN IF NOT EXISTS map_background_url text;
ALTER TABLE areas ADD COLUMN IF NOT EXISTS map_polygon jsonb;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS map_point jsonb;

-- Points of interest
CREATE TABLE IF NOT EXISTS map_pois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'other',
  x float NOT NULL,
  y float NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE map_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view map_pois"
  ON map_pois FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = map_pois.project_id
        AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage map_pois"
  ON map_pois FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = map_pois.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('super_admin', 'company_admin')
    )
  );
