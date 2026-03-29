-- GPS calibration points for map geo-referencing
ALTER TABLE projects ADD COLUMN IF NOT EXISTS map_calibration jsonb DEFAULT '[]';
