ALTER TABLE projects ADD COLUMN IF NOT EXISTS day_items jsonb DEFAULT '{}';
ALTER TABLE accreditation_person_items ADD COLUMN IF NOT EXISTS day text;
