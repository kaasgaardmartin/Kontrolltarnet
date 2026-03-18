-- ============================================================
-- Stakeholders og Aktiviteter
-- ============================================================

-- 1. Stakeholders (global per organisasjon, gjenbrukbar på tvers av saker)
CREATE TABLE stakeholders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  navn             TEXT NOT NULL,
  type             TEXT CHECK (type IN ('organisasjon', 'politiker', 'enkeltperson', 'media', 'annet')) DEFAULT 'organisasjon',
  kontaktinfo      TEXT,
  created_by       UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2. Sak-stakeholder kobling (per sak/delsak)
CREATE TABLE sak_stakeholders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sak_id           UUID REFERENCES saker(id) ON DELETE CASCADE,
  stakeholder_id   UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  holdning         TEXT CHECK (holdning IN ('for', 'mot', 'nøytral', 'ukjent')) DEFAULT 'ukjent',
  innflytelse      TEXT CHECK (innflytelse IN ('høy', 'middels', 'lav')) DEFAULT 'middels',
  notat            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sak_id, stakeholder_id)
);

-- 3. Aktiviteter / oppfølgingspunkter (per sak/delsak)
CREATE TABLE aktiviteter (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sak_id           UUID REFERENCES saker(id) ON DELETE CASCADE,
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  stakeholder_id   UUID REFERENCES stakeholders(id) ON DELETE SET NULL,
  type             TEXT CHECK (type IN ('møte', 'telefon', 'e-post', 'sosiale medier', 'publisering', 'annet')) DEFAULT 'annet',
  beskrivelse      TEXT NOT NULL,
  ansvarlig_id     UUID REFERENCES brukere(id),
  frist            DATE,
  status           TEXT CHECK (status IN ('planlagt', 'utført', 'avlyst')) DEFAULT 'planlagt',
  created_by       UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_stakeholders_org ON stakeholders(organisasjon_id);
CREATE INDEX idx_sak_stakeholders_sak ON sak_stakeholders(sak_id);
CREATE INDEX idx_aktiviteter_sak ON aktiviteter(sak_id);
CREATE INDEX idx_aktiviteter_frist ON aktiviteter(frist) WHERE status = 'planlagt';

-- Auto-update updated_at on aktiviteter
CREATE TRIGGER aktiviteter_updated_at
  BEFORE UPDATE ON aktiviteter
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sak_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE aktiviteter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stakeholders synlig for org" ON stakeholders
  FOR ALL USING (organisasjon_id IN (
    SELECT organisasjon_id FROM brukere WHERE id = auth.uid()
  ));

CREATE POLICY "Sak-stakeholders synlig for org" ON sak_stakeholders
  FOR ALL USING (organisasjon_id IN (
    SELECT organisasjon_id FROM brukere WHERE id = auth.uid()
  ));

CREATE POLICY "Aktiviteter synlig for org" ON aktiviteter
  FOR ALL USING (organisasjon_id IN (
    SELECT organisasjon_id FROM brukere WHERE id = auth.uid()
  ));
