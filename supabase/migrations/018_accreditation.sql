-- Accreditation Module

CREATE TABLE IF NOT EXISTS accreditation_zones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#6366f1',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accreditation_item_types (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  total_available int,
  sort_order      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accreditation_groups (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  contact_name  text,
  contact_email text,
  type          text        NOT NULL DEFAULT 'supplier' CHECK (type IN ('crew','artist','supplier','press','vip','other')),
  invite_token  text        UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accreditation_persons (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  group_id       uuid        REFERENCES accreditation_groups(id) ON DELETE SET NULL,
  first_name     text        NOT NULL,
  last_name      text        NOT NULL,
  email          text,
  role           text        NOT NULL DEFAULT 'crew' CHECK (role IN ('crew','artist','guest','supplier','press','vip','other')),
  status         text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','checked_in','checked_out')),
  qr_token       text        UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  checked_in_at  timestamptz,
  checked_out_at timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accreditation_person_zones (
  person_id  uuid NOT NULL REFERENCES accreditation_persons(id) ON DELETE CASCADE,
  zone_id    uuid NOT NULL REFERENCES accreditation_zones(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, zone_id)
);

CREATE TABLE IF NOT EXISTS accreditation_person_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    uuid        NOT NULL REFERENCES accreditation_persons(id) ON DELETE CASCADE,
  item_type_id uuid        NOT NULL REFERENCES accreditation_item_types(id) ON DELETE CASCADE,
  quantity     int         NOT NULL DEFAULT 1,
  issued       boolean     NOT NULL DEFAULT false,
  issued_at    timestamptz,
  UNIQUE(person_id, item_type_id)
);

CREATE INDEX IF NOT EXISTS acc_zones_project_idx   ON accreditation_zones(project_id);
CREATE INDEX IF NOT EXISTS acc_items_project_idx   ON accreditation_item_types(project_id);
CREATE INDEX IF NOT EXISTS acc_groups_project_idx  ON accreditation_groups(project_id);
CREATE INDEX IF NOT EXISTS acc_persons_project_idx ON accreditation_persons(project_id);
CREATE INDEX IF NOT EXISTS acc_persons_group_idx   ON accreditation_persons(group_id);
CREATE INDEX IF NOT EXISTS acc_persons_status_idx  ON accreditation_persons(status);
CREATE INDEX IF NOT EXISTS acc_pzones_idx          ON accreditation_person_zones(person_id);
CREATE INDEX IF NOT EXISTS acc_pitems_idx          ON accreditation_person_items(person_id);

ALTER TABLE accreditation_zones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_item_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_persons      ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_person_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_person_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accreditation_zones' AND policyname='Members view zones') THEN
    CREATE POLICY "Members view zones" ON accreditation_zones FOR SELECT
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_id=accreditation_zones.project_id AND user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accreditation_item_types' AND policyname='Members view item types') THEN
    CREATE POLICY "Members view item types" ON accreditation_item_types FOR SELECT
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_id=accreditation_item_types.project_id AND user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accreditation_groups' AND policyname='Members view groups') THEN
    CREATE POLICY "Members view groups" ON accreditation_groups FOR SELECT
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_id=accreditation_groups.project_id AND user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accreditation_persons' AND policyname='Members view persons') THEN
    CREATE POLICY "Members view persons" ON accreditation_persons FOR SELECT
      USING (EXISTS (SELECT 1 FROM project_members WHERE project_id=accreditation_persons.project_id AND user_id=auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accreditation_person_zones' AND policyname='Members view person zones') THEN
    CREATE POLICY "Members view person zones" ON accreditation_person_zones FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM accreditation_persons p JOIN project_members pm ON pm.project_id=p.project_id
        WHERE p.id=accreditation_person_zones.person_id AND pm.user_id=auth.uid()
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accreditation_person_items' AND policyname='Members view person items') THEN
    CREATE POLICY "Members view person items" ON accreditation_person_items FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM accreditation_persons p JOIN project_members pm ON pm.project_id=p.project_id
        WHERE p.id=accreditation_person_items.person_id AND pm.user_id=auth.uid()
      ));
  END IF;
END $$;
