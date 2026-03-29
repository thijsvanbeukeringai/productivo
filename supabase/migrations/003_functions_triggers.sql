-- ============================================================
-- IMS - Migration 003: Functions & Triggers
-- ============================================================

-- ============================================================
-- SHIFT WINDOW: 07:00 today → 06:59 tomorrow (Amsterdam TZ)
-- Returns the "from" date of the current event shift
-- ============================================================
CREATE OR REPLACE FUNCTION get_shift_date(ts TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN EXTRACT(HOUR FROM ts AT TIME ZONE 'Europe/Amsterdam') >= 7
    THEN (ts AT TIME ZONE 'Europe/Amsterdam')::DATE
    ELSE (ts AT TIME ZONE 'Europe/Amsterdam')::DATE - INTERVAL '1 day'
  END::DATE;
$$;

-- ============================================================
-- AUTO-UPDATE updated_at COLUMN
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_projects_updated_at  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_areas_updated_at     BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_teams_updated_at     BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_logs_updated_at      BEFORE UPDATE ON logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ENFORCEMENT COUNTERS TRIGGER
-- Recalculates counts for a project+subject+shift when logs change
-- Handles the Ejection → Arrest upgrade (no double counting)
-- ============================================================
CREATE OR REPLACE FUNCTION update_enforcement_counters()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id UUID;
  v_subject_id UUID;
  v_shift_date DATE;
BEGIN
  -- For DELETE use OLD, otherwise use NEW
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  v_subject_id := COALESCE(NEW.subject_id, OLD.subject_id);
  v_shift_date := get_shift_date(COALESCE(NEW.created_at, OLD.created_at));

  -- Only process rows that have an enforcement type
  IF (TG_OP = 'DELETE' AND OLD.enforcement_type IS NULL) THEN
    RETURN OLD;
  END IF;
  IF (TG_OP != 'DELETE' AND NEW.enforcement_type IS NULL AND
      (TG_OP = 'INSERT' OR OLD.enforcement_type IS NULL)) THEN
    RETURN NEW;
  END IF;

  -- Ensure counter row exists
  INSERT INTO enforcement_counters (project_id, subject_id, shift_date)
  VALUES (v_project_id, v_subject_id, v_shift_date)
  ON CONFLICT (project_id, shift_date) DO NOTHING;

  -- Recalculate counts from source of truth
  UPDATE enforcement_counters ec
  SET
    ejections = (
      SELECT COUNT(*) FROM logs l
      WHERE l.project_id = ec.project_id
        AND (l.subject_id = ec.subject_id OR (l.subject_id IS NULL AND ec.subject_id IS NULL))
        AND get_shift_date(l.created_at) = ec.shift_date
        AND l.enforcement_type = 'ejection'
    ),
    arrests = (
      SELECT COUNT(*) FROM logs l
      WHERE l.project_id = ec.project_id
        AND (l.subject_id = ec.subject_id OR (l.subject_id IS NULL AND ec.subject_id IS NULL))
        AND get_shift_date(l.created_at) = ec.shift_date
        AND l.enforcement_type = 'arrest'
    ),
    refusals = (
      SELECT COUNT(*) FROM logs l
      WHERE l.project_id = ec.project_id
        AND (l.subject_id = ec.subject_id OR (l.subject_id IS NULL AND ec.subject_id IS NULL))
        AND get_shift_date(l.created_at) = ec.shift_date
        AND l.enforcement_type = 'refusal'
    ),
    bans = (
      SELECT COUNT(*) FROM logs l
      WHERE l.project_id = ec.project_id
        AND (l.subject_id = ec.subject_id OR (l.subject_id IS NULL AND ec.subject_id IS NULL))
        AND get_shift_date(l.created_at) = ec.shift_date
        AND l.enforcement_type = 'ban'
    ),
    updated_at = NOW()
  WHERE ec.project_id = v_project_id
    AND (ec.subject_id = v_subject_id OR (ec.subject_id IS NULL AND v_subject_id IS NULL))
    AND ec.shift_date = v_shift_date;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforcement_counters
AFTER INSERT OR UPDATE OF enforcement_type, subject_id OR DELETE
ON logs
FOR EACH ROW EXECUTE FUNCTION update_enforcement_counters();

-- ============================================================
-- AUTO-CREATE PROFILE AFTER SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- POSITION STATUS AUDIT LOG (auto-log when position status changes)
-- ============================================================
CREATE OR REPLACE FUNCTION log_position_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id UUID;
  v_message TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_project_id := NEW.project_id;
  v_message := CASE NEW.status
    WHEN 'portocheck_done'  THEN 'Portocheck bevestigd voor positie #' || NEW.number
    WHEN 'sanitary_break'   THEN 'Sanitaire pauze aangevraagd voor positie #' || NEW.number
    ELSE                        'Status reset voor positie #' || NEW.number
  END;

  -- Insert system log (logged_by is the user triggering the change via RLS)
  -- We'll use the service role in the server action for this trigger notification
  RETURN NEW;
END;
$$;
