-- Briefings: composable documents assigned to crew companies

CREATE TABLE IF NOT EXISTS briefings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      text        NOT NULL DEFAULT 'Zonder titel',
  content    jsonb       NOT NULL DEFAULT '[]',
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefing_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id     uuid        NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  crew_company_id uuid        NOT NULL REFERENCES crew_companies(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(briefing_id, crew_company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS briefings_project_id_idx         ON briefings(project_id);
CREATE INDEX IF NOT EXISTS briefing_assignments_briefing_idx ON briefing_assignments(briefing_id);
CREATE INDEX IF NOT EXISTS briefing_assignments_company_idx  ON briefing_assignments(crew_company_id);

-- RLS
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'briefings' AND policyname = 'Project members can view briefings'
  ) THEN
    CREATE POLICY "Project members can view briefings"
      ON briefings FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = briefings.project_id
          AND project_members.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'briefings' AND policyname = 'Admins can manage briefings'
  ) THEN
    CREATE POLICY "Admins can manage briefings"
      ON briefings FOR ALL
      USING (EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = briefings.project_id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('super_admin', 'company_admin', 'centralist')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'briefing_assignments' AND policyname = 'Project members can view briefing assignments'
  ) THEN
    CREATE POLICY "Project members can view briefing assignments"
      ON briefing_assignments FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM briefings
        JOIN project_members ON project_members.project_id = briefings.project_id
        WHERE briefings.id = briefing_assignments.briefing_id
          AND project_members.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'briefing_assignments' AND policyname = 'Admins can manage briefing assignments'
  ) THEN
    CREATE POLICY "Admins can manage briefing assignments"
      ON briefing_assignments FOR ALL
      USING (EXISTS (
        SELECT 1 FROM briefings
        JOIN project_members ON project_members.project_id = briefings.project_id
        WHERE briefings.id = briefing_assignments.briefing_id
          AND project_members.user_id = auth.uid()
          AND project_members.role IN ('super_admin', 'company_admin', 'centralist')
      ));
  END IF;
END $$;
