-- ============================================================
-- Kontrolltårnet / PolitiskTracker - Database Schema
-- ============================================================

-- 1. Organisasjoner
CREATE TABLE organisasjoner (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navn          TEXT NOT NULL,
  domene        TEXT UNIQUE,
  logo_url      TEXT,
  opprettet_av  UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Brukere
CREATE TABLE brukere (
  id               UUID PRIMARY KEY REFERENCES auth.users(id),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  navn             TEXT NOT NULL,
  epost            TEXT NOT NULL,
  rolle            TEXT CHECK (rolle IN ('leser', 'redaktør', 'org-admin')) DEFAULT 'leser',
  aktiv            BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 3. Komiteer (must be created before saker due to FK)
CREATE TABLE komiteer (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  navn             TEXT NOT NULL,
  totalt_antall    INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE komite_mandater (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  komite_id UUID REFERENCES komiteer(id) ON DELETE CASCADE,
  parti     TEXT NOT NULL,
  antall    INTEGER DEFAULT 0,
  UNIQUE (komite_id, parti)
);

-- 4. Saker
CREATE TABLE saker (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  tittel           TEXT NOT NULL,
  beskrivelse      TEXT,
  niva             TEXT CHECK (niva IN ('storting', 'departement', 'intern')),
  status           TEXT,
  landing          TEXT CHECK (landing IN ('vedtas', 'faller', 'usikkert', 'ukjent', 'vedtatt')),
  komite_id        UUID REFERENCES komiteer(id),
  stortingssak_ref TEXT,
  behandles_av     TEXT,
  eier_id          UUID REFERENCES brukere(id),
  komite_dato      DATE,
  stortings_dato   DATE,
  arkivert         BOOLEAN DEFAULT false,
  arkivert_dato    TIMESTAMPTZ,
  created_by       UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 5. Partistemmer
CREATE TABLE partistemmer (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sak_id           UUID REFERENCES saker(id) ON DELETE CASCADE,
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  parti            TEXT NOT NULL,
  stemme           TEXT CHECK (stemme IN ('for', 'mot', 'avholdende', 'ukjent')),
  updated_by       UUID REFERENCES brukere(id),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sak_id, parti)
);

-- 6. Stortingssalen mandater
CREATE TABLE stortingssalen_mandater (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  parti            TEXT NOT NULL,
  antall           INTEGER DEFAULT 0,
  UNIQUE (organisasjon_id, parti)
);

-- 7. Noter
CREATE TABLE noter (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sak_id           UUID REFERENCES saker(id) ON DELETE CASCADE,
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  tekst            TEXT NOT NULL,
  forfatter_id     UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 8. Lenker
CREATE TABLE lenker (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sak_id           UUID REFERENCES saker(id) ON DELETE CASCADE,
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  tittel           TEXT NOT NULL,
  url              TEXT NOT NULL,
  type             TEXT CHECK (type IN ('offisiell', 'eget dokument', 'media', 'sosiale medier')),
  lagt_til_av      UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 9. Varsel-innstillinger
CREATE TABLE varsel_innstillinger (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bruker_id UUID REFERENCES brukere(id) ON DELETE CASCADE,
  sak_id    UUID REFERENCES saker(id) ON DELETE CASCADE,
  aktiv     BOOLEAN DEFAULT true,
  UNIQUE (bruker_id, sak_id)
);

-- Auto-update updated_at on saker
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saker_updated_at
  BEFORE UPDATE ON saker
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
