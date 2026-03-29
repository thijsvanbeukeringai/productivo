-- ============================================================
-- IMS - Migration 002: Row Level Security Policies
-- ============================================================

ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_followups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_company_member(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_company_admin(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
    AND role IN ('super_admin', 'company_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION project_role(p_project_id UUID)
RETURNS user_role LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM project_members
  WHERE project_id = p_project_id AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION can_write_logs(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
    AND role IN ('super_admin', 'company_admin', 'centralist', 'planner')
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_super_admin());

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (is_company_member(id) OR is_super_admin());

CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (is_company_admin(id) OR is_super_admin());

-- ============================================================
-- COMPANY MEMBERS
-- ============================================================
CREATE POLICY "company_members_select" ON company_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_company_admin(company_id)
    OR is_super_admin()
  );

CREATE POLICY "company_members_insert" ON company_members
  FOR INSERT WITH CHECK (is_company_admin(company_id) OR is_super_admin());

CREATE POLICY "company_members_update" ON company_members
  FOR UPDATE USING (is_company_admin(company_id) OR is_super_admin());

CREATE POLICY "company_members_delete" ON company_members
  FOR DELETE USING (is_company_admin(company_id) OR is_super_admin());

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (
    is_project_member(id)
    OR is_company_admin(company_id)
    OR is_super_admin()
  );

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (is_company_admin(company_id) OR is_super_admin());

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (is_company_admin(company_id) OR is_super_admin());

-- ============================================================
-- PROJECT MEMBERS
-- ============================================================
CREATE POLICY "project_members_select" ON project_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_project_member(project_id)
    OR is_super_admin()
  );

CREATE POLICY "project_members_insert" ON project_members
  FOR INSERT WITH CHECK (
    project_role(project_id) IN ('company_admin', 'centralist')
    OR is_company_admin((SELECT company_id FROM projects WHERE id = project_id))
    OR is_super_admin()
  );

CREATE POLICY "project_members_update" ON project_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR project_role(project_id) IN ('company_admin')
    OR is_super_admin()
  );

-- ============================================================
-- INVITATIONS
-- ============================================================
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (is_company_admin(company_id) OR is_super_admin());

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (is_company_admin(company_id) OR is_super_admin());

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE POLICY "subjects_select" ON subjects
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

CREATE POLICY "subjects_insert" ON subjects
  FOR INSERT WITH CHECK (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "subjects_update" ON subjects
  FOR UPDATE USING (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "subjects_delete" ON subjects
  FOR DELETE USING (
    project_role(project_id) IN ('company_admin', 'centralist')
    OR is_super_admin()
  );

-- ============================================================
-- AREAS
-- ============================================================
CREATE POLICY "areas_select" ON areas
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

CREATE POLICY "areas_insert" ON areas
  FOR INSERT WITH CHECK (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "areas_update" ON areas
  FOR UPDATE USING (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "areas_delete" ON areas
  FOR DELETE USING (
    project_role(project_id) IN ('company_admin')
    OR is_super_admin()
  );

-- ============================================================
-- TEAMS
-- ============================================================
CREATE POLICY "teams_select" ON teams
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

CREATE POLICY "teams_insert" ON teams
  FOR INSERT WITH CHECK (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "teams_update" ON teams
  FOR UPDATE USING (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "teams_delete" ON teams
  FOR DELETE USING (
    project_role(project_id) IN ('company_admin', 'centralist')
    OR is_super_admin()
  );

-- ============================================================
-- POSITIONS
-- ============================================================
CREATE POLICY "positions_select" ON positions
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

CREATE POLICY "positions_insert" ON positions
  FOR INSERT WITH CHECK (can_write_logs(project_id) OR is_super_admin());

CREATE POLICY "positions_update" ON positions
  FOR UPDATE USING (is_project_member(project_id) OR is_super_admin());

-- ============================================================
-- LOGS
-- ============================================================
CREATE POLICY "logs_select" ON logs
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

CREATE POLICY "logs_insert" ON logs
  FOR INSERT WITH CHECK (can_write_logs(project_id));

CREATE POLICY "logs_update" ON logs
  FOR UPDATE USING (
    logged_by = auth.uid()
    OR project_role(project_id) IN ('super_admin', 'company_admin', 'centralist')
  );

-- ============================================================
-- LOG FOLLOW-UPS
-- ============================================================
CREATE POLICY "followups_select" ON log_followups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM logs l
      WHERE l.id = log_id AND is_project_member(l.project_id)
    )
  );

CREATE POLICY "followups_insert" ON log_followups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM logs l
      WHERE l.id = log_id AND can_write_logs(l.project_id)
    )
  );

-- ============================================================
-- ENFORCEMENT COUNTERS
-- ============================================================
CREATE POLICY "enforcement_counters_select" ON enforcement_counters
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

-- ============================================================
-- PROJECT DOCUMENTS
-- ============================================================
CREATE POLICY "project_documents_select" ON project_documents
  FOR SELECT USING (is_project_member(project_id) OR is_super_admin());

CREATE POLICY "project_documents_insert" ON project_documents
  FOR INSERT WITH CHECK (can_write_logs(project_id));

CREATE POLICY "project_documents_delete" ON project_documents
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR project_role(project_id) IN ('company_admin')
    OR is_super_admin()
  );
