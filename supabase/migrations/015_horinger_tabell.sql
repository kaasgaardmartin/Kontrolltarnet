-- ============================================================
-- Høringer — lagrer høringer importert fra Stortingets API
-- ============================================================

CREATE TABLE horinger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sak_id           UUID REFERENCES saker(id) ON DELETE CASCADE NOT NULL,
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  horing_id        TEXT NOT NULL,
  tittel           TEXT,
  skriftlig        BOOLEAN DEFAULT true,
  innspillsfrist   TIMESTAMPTZ,
  anmodningsfrist  TIMESTAMPTZ,   -- null for rene skriftlige høringer
  start_dato       TIMESTAMPTZ,
  status           TEXT,          -- Aktiv, Planlagt, Avholdt, Avlyst
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sak_id, horing_id)
);

-- RLS
ALTER TABLE horinger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_horinger" ON horinger
  FOR SELECT USING (
    organisasjon_id IN (
      SELECT organisasjon_id FROM brukere WHERE id = auth.uid()
    )
  );

CREATE POLICY "org_editors_insert_horinger" ON horinger
  FOR INSERT WITH CHECK (
    organisasjon_id IN (
      SELECT organisasjon_id FROM brukere
      WHERE id = auth.uid() AND rolle IN ('redaktør', 'org-admin')
    )
  );

CREATE POLICY "org_editors_delete_horinger" ON horinger
  FOR DELETE USING (
    organisasjon_id IN (
      SELECT organisasjon_id FROM brukere
      WHERE id = auth.uid() AND rolle IN ('redaktør', 'org-admin')
    )
  );

CREATE INDEX idx_horinger_sak_id ON horinger (sak_id);
CREATE INDEX idx_horinger_innspillsfrist ON horinger (innspillsfrist) WHERE innspillsfrist IS NOT NULL;
