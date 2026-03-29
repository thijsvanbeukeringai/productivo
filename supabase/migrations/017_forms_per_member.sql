-- Forms are per crew member, not per company

ALTER TABLE form_responses ADD COLUMN IF NOT EXISTS crew_member_id uuid REFERENCES crew_members(id) ON DELETE CASCADE;
ALTER TABLE form_responses DROP CONSTRAINT IF EXISTS form_responses_form_id_crew_company_id_key;
ALTER TABLE form_responses ALTER COLUMN crew_company_id DROP NOT NULL;
ALTER TABLE form_responses ADD CONSTRAINT form_responses_form_id_member_key UNIQUE (form_id, crew_member_id);
CREATE INDEX IF NOT EXISTS form_responses_member_idx ON form_responses(crew_member_id);
