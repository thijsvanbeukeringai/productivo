-- ============================================================
-- IMS - Migration 005: team_id → team_ids array (multiple teams per log)
-- ============================================================

ALTER TABLE logs DROP COLUMN IF EXISTS team_id;
ALTER TABLE logs ADD COLUMN team_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_logs_team_ids ON logs USING GIN(team_ids);
