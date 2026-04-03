-- Ensure map_share_token exists on projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS map_share_token text;

-- Ensure note exists on map_pois
ALTER TABLE map_pois ADD COLUMN IF NOT EXISTS note text;

-- Ensure map_poi_categories table exists
CREATE TABLE IF NOT EXISTS map_poi_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  display_style text NOT NULL DEFAULT 'dot',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE map_poi_categories ENABLE ROW LEVEL SECURITY;

-- Ensure category_id exists on map_pois
ALTER TABLE map_pois ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES map_poi_categories(id) ON DELETE SET NULL;

-- ── Anon read policies for public map share ──────────────────────────────────
-- projects: anon can read a project when looking up by share token
DROP POLICY IF EXISTS "Anon read shared project" ON projects;
CREATE POLICY "Anon read shared project"
  ON projects FOR SELECT TO anon
  USING (map_share_token IS NOT NULL);

-- areas: anon can read areas belonging to a shared project
DROP POLICY IF EXISTS "Anon read areas for shared project" ON areas;
CREATE POLICY "Anon read areas for shared project"
  ON areas FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = areas.project_id
        AND projects.map_share_token IS NOT NULL
    )
  );

-- positions: anon can read positions belonging to a shared project
DROP POLICY IF EXISTS "Anon read positions for shared project" ON positions;
CREATE POLICY "Anon read positions for shared project"
  ON positions FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = positions.project_id
        AND projects.map_share_token IS NOT NULL
    )
  );

-- map_pois: anon can read POIs belonging to a shared project
DROP POLICY IF EXISTS "Anon read map_pois for shared project" ON map_pois;
CREATE POLICY "Anon read map_pois for shared project"
  ON map_pois FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = map_pois.project_id
        AND projects.map_share_token IS NOT NULL
    )
  );

-- map_poi_categories: project members can manage, anon can read when shared
DROP POLICY IF EXISTS "Project members can manage map_poi_categories" ON map_poi_categories;
CREATE POLICY "Project members can manage map_poi_categories"
  ON map_poi_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = map_poi_categories.project_id
        AND project_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anon read map_poi_categories for shared project" ON map_poi_categories;
CREATE POLICY "Anon read map_poi_categories for shared project"
  ON map_poi_categories FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = map_poi_categories.project_id
        AND projects.map_share_token IS NOT NULL
    )
  );
