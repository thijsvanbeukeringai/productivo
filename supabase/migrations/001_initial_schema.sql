-- ============================================================
-- IMS - Event Incident Management System
-- Migration 001: Initial Schema
-- ============================================================

-- ENUMS
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'company_admin',
  'centralist',
  'planner',
  'runner'
);

CREATE TYPE log_priority AS ENUM ('info', 'low', 'mid', 'high');
CREATE TYPE log_status AS ENUM ('open', 'closed');
CREATE TYPE enforcement_type AS ENUM ('ejection', 'arrest', 'refusal', 'ban');
CREATE TYPE area_status AS ENUM ('open', 'regulated', 'closed');
CREATE TYPE position_status AS ENUM ('normal', 'portocheck_done', 'sanitary_break');

-- ============================================================
-- COMPANIES
-- ============================================================
CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMPANY MEMBERS
-- ============================================================
CREATE TABLE company_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'runner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  location_name    TEXT,
  location_address TEXT,
  start_date       DATE,
  end_date         DATE,
  project_leader   TEXT,
  invoice_details  JSONB DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECT MEMBERS (per-project role + context settings)
-- ============================================================
CREATE TABLE project_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role                user_role NOT NULL DEFAULT 'runner',
  custom_display_name TEXT,
  standby_teams       BOOLEAN NOT NULL DEFAULT false,
  fixed_positions     BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ============================================================
-- INVITATIONS
-- ============================================================
CREATE TABLE invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  email        TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'runner',
  token        TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by   UUID REFERENCES profiles(id),
  accepted_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBJECTS (per project - configurable log categories)
-- ============================================================
CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AREAS (per project)
-- ============================================================
CREATE TABLE areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     area_status NOT NULL DEFAULT 'open',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TEAMS (per project)
-- ============================================================
CREATE TABLE teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number       INTEGER NOT NULL,
  member_names TEXT[] DEFAULT '{}',
  area_id      UUID REFERENCES areas(id) ON DELETE SET NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  is_standby   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, number)
);

-- ============================================================
-- POSITIONS (per project)
-- ============================================================
CREATE TABLE positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  name        TEXT,
  area_id     UUID REFERENCES areas(id) ON DELETE SET NULL,
  status      position_status NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, number)
);

-- ============================================================
-- LOGS (core table)
-- ============================================================
CREATE TABLE logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  incident_text         TEXT NOT NULL,
  subject_id            UUID REFERENCES subjects(id) ON DELETE SET NULL,
  priority              log_priority NOT NULL DEFAULT 'info',
  status                log_status NOT NULL DEFAULT 'open',
  area_id               UUID REFERENCES areas(id) ON DELETE SET NULL,
  assigned_user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  logged_by             UUID NOT NULL REFERENCES profiles(id),
  display_name_snapshot TEXT NOT NULL,
  enforcement_type      enforcement_type,
  image_urls            TEXT[] DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOG FOLLOW-UPS
-- ============================================================
CREATE TABLE log_followups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id                UUID NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
  content               TEXT NOT NULL,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  display_name_snapshot TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ENFORCEMENT COUNTERS (maintained by trigger)
-- ============================================================
CREATE TABLE enforcement_counters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  shift_date DATE NOT NULL,
  ejections  INTEGER NOT NULL DEFAULT 0,
  arrests    INTEGER NOT NULL DEFAULT 0,
  refusals   INTEGER NOT NULL DEFAULT 0,
  bans       INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, shift_date)
);

-- ============================================================
-- PROJECT DOCUMENTS
-- ============================================================
CREATE TABLE project_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_logs_project_id   ON logs(project_id);
CREATE INDEX idx_logs_created_at   ON logs(created_at DESC);
CREATE INDEX idx_logs_status        ON logs(status);
CREATE INDEX idx_logs_priority      ON logs(priority);
CREATE INDEX idx_logs_area_id       ON logs(area_id);
CREATE INDEX idx_logs_assigned_user ON logs(assigned_user_id);
CREATE INDEX idx_logs_enforcement   ON logs(enforcement_type) WHERE enforcement_type IS NOT NULL;
CREATE INDEX idx_log_followups_log  ON log_followups(log_id);
CREATE INDEX idx_project_members_user  ON project_members(user_id);
CREATE INDEX idx_company_members_user  ON company_members(user_id);
CREATE INDEX idx_teams_project_area    ON teams(project_id, area_id);
