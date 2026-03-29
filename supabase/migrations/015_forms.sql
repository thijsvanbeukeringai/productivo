-- Forms: custom data-collection forms assigned to crew companies

CREATE TABLE IF NOT EXISTS forms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Zonder titel',
  description text,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_fields (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('text','textarea','select','checkbox','radio','number')),
  label       text        NOT NULL,
  placeholder text,
  options     jsonb,
  required    boolean     NOT NULL DEFAULT false,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  crew_company_id uuid        NOT NULL REFERENCES crew_companies(id) ON DELETE CASCADE,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id, crew_company_id)
);

CREATE TABLE IF NOT EXISTS form_responses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  crew_company_id uuid        NOT NULL REFERENCES crew_companies(id) ON DELETE CASCADE,
  data            jsonb       NOT NULL DEFAULT '{}',
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id, crew_company_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS forms_project_id_idx           ON forms(project_id);
CREATE INDEX IF NOT EXISTS form_fields_form_id_idx        ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS form_assignments_form_idx      ON form_assignments(form_id);
CREATE INDEX IF NOT EXISTS form_assignments_company_idx   ON form_assignments(crew_company_id);
CREATE INDEX IF NOT EXISTS form_responses_form_idx        ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS form_responses_company_idx     ON form_responses(crew_company_id);

-- RLS
ALTER TABLE forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields      ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forms' AND policyname='Project members can view forms') THEN
    CREATE POLICY "Project members can view forms" ON forms FOR SELECT
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id=forms.project_id AND project_members.user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forms' AND policyname='Admins can manage forms') THEN
    CREATE POLICY "Admins can manage forms" ON forms FOR ALL
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id=forms.project_id AND project_members.user_id=auth.uid() AND project_members.role IN ('super_admin','company_admin','centralist')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_fields' AND policyname='Project members can view form fields') THEN
    CREATE POLICY "Project members can view form fields" ON form_fields FOR SELECT
      USING (EXISTS (SELECT 1 FROM forms JOIN project_members ON project_members.project_id=forms.project_id WHERE forms.id=form_fields.form_id AND project_members.user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_fields' AND policyname='Admins can manage form fields') THEN
    CREATE POLICY "Admins can manage form fields" ON form_fields FOR ALL
      USING (EXISTS (SELECT 1 FROM forms JOIN project_members ON project_members.project_id=forms.project_id WHERE forms.id=form_fields.form_id AND project_members.user_id=auth.uid() AND project_members.role IN ('super_admin','company_admin','centralist')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_assignments' AND policyname='Project members can view form assignments') THEN
    CREATE POLICY "Project members can view form assignments" ON form_assignments FOR SELECT
      USING (EXISTS (SELECT 1 FROM forms JOIN project_members ON project_members.project_id=forms.project_id WHERE forms.id=form_assignments.form_id AND project_members.user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_assignments' AND policyname='Admins can manage form assignments') THEN
    CREATE POLICY "Admins can manage form assignments" ON form_assignments FOR ALL
      USING (EXISTS (SELECT 1 FROM forms JOIN project_members ON project_members.project_id=forms.project_id WHERE forms.id=form_assignments.form_id AND project_members.user_id=auth.uid() AND project_members.role IN ('super_admin','company_admin','centralist')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='form_responses' AND policyname='Project members can view form responses') THEN
    CREATE POLICY "Project members can view form responses" ON form_responses FOR SELECT
      USING (EXISTS (SELECT 1 FROM forms JOIN project_members ON project_members.project_id=forms.project_id WHERE forms.id=form_responses.form_id AND project_members.user_id=auth.uid()));
  END IF;
END $$;
