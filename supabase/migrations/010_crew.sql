-- ============================================================
-- IMS - Migration 010: Crew Management System (Module 3)
-- ============================================================

-- Show days on projects (which dates are actual show days)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS show_days date[] NOT NULL DEFAULT '{}';

-- ============================================================
-- CREW COMPANIES (external companies invited per project)
-- ============================================================
CREATE TABLE IF NOT EXISTS crew_companies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           text NOT NULL,
  contact_name   text NOT NULL,
  contact_email  text NOT NULL,
  target_count   int,
  invite_token   text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invite_sent_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CREW MEMBERS (submitted by external companies via portal)
-- ============================================================
CREATE TABLE IF NOT EXISTS crew_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_company_id uuid NOT NULL REFERENCES crew_companies(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text,
  phone           text,
  clothing_size   text,
  notes           text,
  parking_ticket  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CREW PLANNING (per day per crew member)
-- ============================================================
CREATE TABLE IF NOT EXISTS crew_planning (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id uuid NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_date      date NOT NULL,
  lunch          boolean NOT NULL DEFAULT false,
  diner          boolean NOT NULL DEFAULT false,
  night_snack    boolean NOT NULL DEFAULT false,
  parking_card   boolean NOT NULL DEFAULT false,
  walkie_talkie  boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'pending_approval',
  checked_in     boolean NOT NULL DEFAULT false,
  checked_in_at  timestamptz,
  UNIQUE(crew_member_id, work_date)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE crew_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_planning   ENABLE ROW LEVEL SECURITY;

-- crew_companies: project members can view
CREATE POLICY "Project members can view crew_companies"
  ON crew_companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = crew_companies.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- crew_companies: admins can manage
CREATE POLICY "Admins can manage crew_companies"
  ON crew_companies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = crew_companies.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('super_admin', 'company_admin', 'centralist')
    )
  );

-- crew_members: project members can view
CREATE POLICY "Project members can view crew_members"
  ON crew_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = crew_members.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- crew_members: admins can manage
CREATE POLICY "Admins can manage crew_members"
  ON crew_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = crew_members.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('super_admin', 'company_admin', 'centralist')
    )
  );

-- crew_planning: project members can view
CREATE POLICY "Project members can view crew_planning"
  ON crew_planning FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = crew_planning.project_id
        AND project_members.user_id = auth.uid()
    )
  );

-- crew_planning: admins can manage
CREATE POLICY "Admins can manage crew_planning"
  ON crew_planning FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = crew_planning.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('super_admin', 'company_admin', 'centralist')
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS crew_companies_project_id_idx ON crew_companies(project_id);
CREATE INDEX IF NOT EXISTS crew_companies_token_idx       ON crew_companies(invite_token);
CREATE INDEX IF NOT EXISTS crew_members_company_id_idx   ON crew_members(crew_company_id);
CREATE INDEX IF NOT EXISTS crew_members_project_id_idx   ON crew_members(project_id);
CREATE INDEX IF NOT EXISTS crew_planning_member_id_idx   ON crew_planning(crew_member_id);
CREATE INDEX IF NOT EXISTS crew_planning_project_date_idx ON crew_planning(project_id, work_date);
