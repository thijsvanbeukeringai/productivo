-- Replace walkie_talkie boolean with walkie_talkie_type text
-- Values: null (niet nodig), 'inear', 'spreeksleutel', 'heavy_duty'
ALTER TABLE crew_planning ADD COLUMN IF NOT EXISTS walkie_talkie_type text;

-- Migrate existing true values to 'inear'
UPDATE crew_planning SET walkie_talkie_type = 'inear' WHERE walkie_talkie = true;

ALTER TABLE crew_planning DROP COLUMN IF EXISTS walkie_talkie;
