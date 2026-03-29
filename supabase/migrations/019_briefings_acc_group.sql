-- Allow briefing_assignments to also target accreditation groups (not just crew companies)
ALTER TABLE briefing_assignments ALTER COLUMN crew_company_id DROP NOT NULL;

ALTER TABLE briefing_assignments
  ADD COLUMN IF NOT EXISTS accreditation_group_id uuid REFERENCES accreditation_groups(id) ON DELETE CASCADE;

-- Partial unique index for accreditation group assignments
CREATE UNIQUE INDEX IF NOT EXISTS briefing_acc_group_unique
  ON briefing_assignments(briefing_id, accreditation_group_id)
  WHERE accreditation_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS briefing_assignments_acc_group_idx
  ON briefing_assignments(accreditation_group_id);
