-- ============================================================
-- IMS - Migration 004: Team/Position-Log connection + display mode
-- ============================================================

-- Add team_id to logs (which team is handling this incident)
ALTER TABLE logs ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX idx_logs_team_id ON logs(team_id);

-- Add position_id to logs (which position reported/is linked to this incident)
ALTER TABLE logs ADD COLUMN position_id UUID REFERENCES positions(id) ON DELETE SET NULL;
CREATE INDEX idx_logs_position_id ON logs(position_id);

-- Add display mode to project_members
CREATE TYPE member_display_mode AS ENUM ('dynamic', 'fixed', 'cp_org');
ALTER TABLE project_members ADD COLUMN display_mode member_display_mode NOT NULL DEFAULT 'dynamic';
