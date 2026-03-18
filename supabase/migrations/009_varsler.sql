-- ============================================================
-- Varsler (notifications)
-- ============================================================

CREATE TABLE varsler (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bruker_id    UUID NOT NULL REFERENCES brukere(id) ON DELETE CASCADE,
  sak_id       UUID REFERENCES saker(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('notat', 'landing', 'utfall', 'aktivitet', 'frist', 'tildelt')),
  melding      TEXT NOT NULL,
  lest         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_varsler_bruker ON varsler(bruker_id, lest, created_at DESC);

-- ============================================================
-- RLS for varsler
-- ============================================================

ALTER TABLE varsler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "varsler_select" ON varsler
  FOR SELECT USING (bruker_id = auth.uid());

CREATE POLICY "varsler_insert" ON varsler
  FOR INSERT WITH CHECK (true);

CREATE POLICY "varsler_update" ON varsler
  FOR UPDATE USING (bruker_id = auth.uid());

CREATE POLICY "varsler_delete" ON varsler
  FOR DELETE USING (bruker_id = auth.uid());
