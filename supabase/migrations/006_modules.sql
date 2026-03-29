-- ============================================================
-- IMS - Migration 006: Modular Sidebar & Feature Flagging
-- ============================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS active_modules text[] NOT NULL DEFAULT ARRAY['logbook'];
