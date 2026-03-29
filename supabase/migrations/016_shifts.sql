-- Crew shifts / rooster planning

CREATE TABLE IF NOT EXISTS crew_shifts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_date   date        NOT NULL,
  title       text        NOT NULL,
  start_time  time        NOT NULL,
  end_time    time        NOT NULL,
  max_slots   int,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crew_shift_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid        NOT NULL REFERENCES crew_shifts(id) ON DELETE CASCADE,
  crew_member_id  uuid        NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shift_id, crew_member_id)
);

CREATE INDEX IF NOT EXISTS crew_shifts_project_date_idx       ON crew_shifts(project_id, work_date);
CREATE INDEX IF NOT EXISTS crew_shift_assignments_shift_idx   ON crew_shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS crew_shift_assignments_member_idx  ON crew_shift_assignments(crew_member_id);

ALTER TABLE crew_shifts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_shift_assignments  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crew_shifts' AND policyname='Project members can view shifts') THEN
    CREATE POLICY "Project members can view shifts" ON crew_shifts FOR SELECT
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id=crew_shifts.project_id AND project_members.user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crew_shifts' AND policyname='Admins can manage shifts') THEN
    CREATE POLICY "Admins can manage shifts" ON crew_shifts FOR ALL
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id=crew_shifts.project_id AND project_members.user_id=auth.uid() AND project_members.role IN ('super_admin','company_admin','centralist')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crew_shift_assignments' AND policyname='Project members can view shift assignments') THEN
    CREATE POLICY "Project members can view shift assignments" ON crew_shift_assignments FOR SELECT
      USING (EXISTS (SELECT 1 FROM crew_shifts JOIN project_members ON project_members.project_id=crew_shifts.project_id WHERE crew_shifts.id=crew_shift_assignments.shift_id AND project_members.user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crew_shift_assignments' AND policyname='Admins can manage shift assignments') THEN
    CREATE POLICY "Admins can manage shift assignments" ON crew_shift_assignments FOR ALL
      USING (EXISTS (SELECT 1 FROM crew_shifts JOIN project_members ON project_members.project_id=crew_shifts.project_id WHERE crew_shifts.id=crew_shift_assignments.shift_id AND project_members.user_id=auth.uid() AND project_members.role IN ('super_admin','company_admin','centralist')));
  END IF;
END $$;
