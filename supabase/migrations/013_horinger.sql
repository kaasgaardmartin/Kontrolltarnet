-- Legg til høringsfelt på saker-tabellen
ALTER TABLE saker
  ADD COLUMN IF NOT EXISTS horingsfrist DATE,
  ADD COLUMN IF NOT EXISTS horingsnotat_url TEXT,
  ADD COLUMN IF NOT EXISTS horingssvar_url TEXT;

-- Indeks for høringsfrist (brukes i tidslinje-visning)
CREATE INDEX IF NOT EXISTS idx_saker_horingsfrist ON saker (horingsfrist) WHERE horingsfrist IS NOT NULL;
