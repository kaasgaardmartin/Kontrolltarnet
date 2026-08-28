-- ============================================================
-- Organisasjonsovervåking via Brreg
-- ============================================================

-- 1. Utvid varsler-type til å inkludere 'organisasjon'
ALTER TABLE varsler DROP CONSTRAINT varsler_type_check;
ALTER TABLE varsler ADD CONSTRAINT varsler_type_check
  CHECK (type IN ('notat', 'landing', 'utfall', 'aktivitet', 'frist', 'tildelt', 'organisasjon'));

-- 2. Overvåkede organisasjoner (Brreg-enheter som spores)
CREATE TABLE overvakede_organisasjoner (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id UUID NOT NULL REFERENCES organisasjoner(id) ON DELETE CASCADE,
  orgnr           TEXT NOT NULL,
  navn            TEXT NOT NULL,
  beskrivelse     TEXT,
  aktiv           BOOLEAN DEFAULT true,
  created_by      UUID REFERENCES brukere(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisasjon_id, orgnr)
);

CREATE INDEX idx_overvakede_org ON overvakede_organisasjoner(organisasjon_id);

-- 3. Siste rolleoversikt fra Brreg (én rad per overvåket org, upsert)
CREATE TABLE brreg_roller_snapshot (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overvaket_org_id UUID NOT NULL REFERENCES overvakede_organisasjoner(id) ON DELETE CASCADE UNIQUE,
  organisasjon_id  UUID NOT NULL REFERENCES organisasjoner(id) ON DELETE CASCADE,
  roller           JSONB NOT NULL DEFAULT '[]',
  hentet_dato      TIMESTAMPTZ DEFAULT now()
);

-- 4. Endringslogg
CREATE TABLE brreg_endringer (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overvaket_org_id UUID NOT NULL REFERENCES overvakede_organisasjoner(id) ON DELETE CASCADE,
  organisasjon_id  UUID NOT NULL REFERENCES organisasjoner(id) ON DELETE CASCADE,
  orgnr            TEXT NOT NULL,
  org_navn         TEXT NOT NULL,
  endring_type     TEXT NOT NULL CHECK (endring_type IN ('ny_rolle', 'fjernet_rolle', 'endring')),
  rolle_type       TEXT NOT NULL,
  person_navn      TEXT,
  beskrivelse      TEXT NOT NULL,
  oppdaget_dato    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brreg_endringer_org ON brreg_endringer(organisasjon_id, oppdaget_dato DESC);

-- 5. RLS
ALTER TABLE overvakede_organisasjoner ENABLE ROW LEVEL SECURITY;
ALTER TABLE brreg_roller_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE brreg_endringer ENABLE ROW LEVEL SECURITY;

-- Overvåkede organisasjoner
CREATE POLICY "overvakede_org_select" ON overvakede_organisasjoner
  FOR SELECT USING (
    organisasjon_id IN (SELECT organisasjon_id FROM brukere WHERE id = auth.uid())
  );

CREATE POLICY "overvakede_org_insert" ON overvakede_organisasjoner
  FOR INSERT WITH CHECK (
    organisasjon_id IN (
      SELECT organisasjon_id FROM brukere
      WHERE id = auth.uid() AND rolle IN ('org-admin', 'redaktør')
    )
  );

CREATE POLICY "overvakede_org_update" ON overvakede_organisasjoner
  FOR UPDATE USING (
    organisasjon_id IN (
      SELECT organisasjon_id FROM brukere
      WHERE id = auth.uid() AND rolle IN ('org-admin', 'redaktør')
    )
  );

CREATE POLICY "overvakede_org_delete" ON overvakede_organisasjoner
  FOR DELETE USING (
    organisasjon_id IN (
      SELECT organisasjon_id FROM brukere
      WHERE id = auth.uid() AND rolle = 'org-admin'
    )
  );

-- Roller-snapshot
CREATE POLICY "brreg_snapshot_select" ON brreg_roller_snapshot
  FOR SELECT USING (
    organisasjon_id IN (SELECT organisasjon_id FROM brukere WHERE id = auth.uid())
  );

CREATE POLICY "brreg_snapshot_insert" ON brreg_roller_snapshot
  FOR INSERT WITH CHECK (
    organisasjon_id IN (SELECT organisasjon_id FROM brukere WHERE id = auth.uid())
  );

CREATE POLICY "brreg_snapshot_update" ON brreg_roller_snapshot
  FOR UPDATE USING (
    organisasjon_id IN (SELECT organisasjon_id FROM brukere WHERE id = auth.uid())
  );

-- Endringer
CREATE POLICY "brreg_endringer_select" ON brreg_endringer
  FOR SELECT USING (
    organisasjon_id IN (SELECT organisasjon_id FROM brukere WHERE id = auth.uid())
  );

CREATE POLICY "brreg_endringer_insert" ON brreg_endringer
  FOR INSERT WITH CHECK (true);
