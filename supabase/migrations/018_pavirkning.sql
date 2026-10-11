-- ============================================================
-- Påvirkning-modulen: tabeller, utvidelser, indekser og RLS
-- ============================================================

-- 1. Tema
CREATE TABLE tema (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  navn             TEXT NOT NULL,
  rekkefolge       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER tema_updated_at
  BEFORE UPDATE ON tema
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. Mål
CREATE TABLE maal (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  tema_id          UUID REFERENCES tema(id) NOT NULL,
  tittel           TEXT NOT NULL,
  formulering      TEXT,
  status_tekst     TEXT,
  siste_kommentar  TEXT,
  arkivert         BOOLEAN DEFAULT false,
  arkivert_dato    TIMESTAMPTZ,
  utfall           TEXT CHECK (utfall IN ('oppnadd', 'delvis', 'ikke', 'avbrutt')),
  oppsummering     TEXT,
  created_by       UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER maal_updated_at
  BEFORE UPDATE ON maal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 3. Nøkkelresultater
CREATE TABLE nokkelresultater (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  maal_id          UUID REFERENCES maal(id) ON DELETE CASCADE NOT NULL,
  tekst            TEXT NOT NULL,
  type             TEXT CHECK (type IN ('gjennomslag', 'tall', 'milepael')) NOT NULL DEFAULT 'gjennomslag',
  verdi            TEXT,
  tall_naa         INT,
  tall_maal        INT,
  gjennomslag      TEXT CHECK (gjennomslag IN ('ukjent', 'ikke', 'delvis', 'fullt')) DEFAULT 'ukjent',
  oppnadd          BOOLEAN DEFAULT false,
  sannsynlighet    INT CHECK (sannsynlighet >= 1 AND sannsynlighet <= 10) DEFAULT 5,
  frist_tekst      TEXT,
  rekkefolge       INT NOT NULL DEFAULT 0,
  sist_endret_tekst TEXT,
  created_by       UUID REFERENCES brukere(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER nokkelresultater_updated_at
  BEFORE UPDATE ON nokkelresultater
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 4. Utvid aktiviteter med tiltak-kolonner
ALTER TABLE aktiviteter
  ADD COLUMN nokkelresultat_id UUID REFERENCES nokkelresultater(id) ON DELETE CASCADE,
  ADD COLUMN lukket_dato       DATE,
  ADD COLUMN updated_by        UUID REFERENCES brukere(id);

CREATE INDEX idx_aktiviteter_nokkelresultat ON aktiviteter(nokkelresultat_id) WHERE nokkelresultat_id IS NOT NULL;
CREATE INDEX idx_aktiviteter_tiltak_forfaller ON aktiviteter(organisasjon_id, status, frist) WHERE nokkelresultat_id IS NOT NULL AND status = 'planlagt';

-- 5. Politisk kvarter
CREATE TABLE politisk_kvarter (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  dato             DATE NOT NULL DEFAULT CURRENT_DATE,
  uke              INT NOT NULL DEFAULT EXTRACT(WEEK FROM CURRENT_DATE)::INT,
  status           TEXT CHECK (status IN ('pagar', 'avsluttet', 'forkastet')) NOT NULL DEFAULT 'pagar',
  fase             TEXT CHECK (fase IN ('dagsorden', 'gjennomgang', 'oppsummering')) NOT NULL DEFAULT 'dagsorden',
  ordstyrer_id     UUID REFERENCES brukere(id),
  aktivt_maal_id   UUID REFERENCES maal(id),
  oppsummering     JSONB,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER politisk_kvarter_updated_at
  BEFORE UPDATE ON politisk_kvarter
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Bare ett pågående møte per organisasjon
CREATE UNIQUE INDEX idx_politisk_kvarter_pagar
  ON politisk_kvarter(organisasjon_id)
  WHERE status = 'pagar';

-- 6. Politisk kvarter – mål (dagsorden og utkast)
CREATE TABLE politisk_kvarter_maal (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politisk_kvarter_id   UUID REFERENCES politisk_kvarter(id) ON DELETE CASCADE NOT NULL,
  maal_id               UUID REFERENCES maal(id) ON DELETE CASCADE NOT NULL,
  rekkefolge            INT NOT NULL DEFAULT 0,
  valgt                 BOOLEAN DEFAULT false,
  behandlet             BOOLEAN DEFAULT false,
  kommentar             TEXT,
  utkast                JSONB,
  sist_endret_av        UUID REFERENCES brukere(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (politisk_kvarter_id, maal_id)
);

CREATE TRIGGER politisk_kvarter_maal_updated_at
  BEFORE UPDATE ON politisk_kvarter_maal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 7. KR-vurderinger (historikk per politisk kvarter)
CREATE TABLE kr_vurderinger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id       UUID REFERENCES organisasjoner(id) NOT NULL,
  nokkelresultat_id     UUID REFERENCES nokkelresultater(id) ON DELETE CASCADE NOT NULL,
  politisk_kvarter_id   UUID REFERENCES politisk_kvarter(id) ON DELETE CASCADE NOT NULL,
  sannsynlighet         INT NOT NULL,
  forrige_sannsynlighet INT,
  kommentar             TEXT,
  dato                  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- 8. Statusoppdateringer (utenfor møtet)
CREATE TABLE statusoppdateringer (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id  UUID REFERENCES organisasjoner(id) NOT NULL,
  maal_id          UUID REFERENCES maal(id) ON DELETE CASCADE NOT NULL,
  av_bruker_id     UUID REFERENCES brukere(id),
  kommentar        TEXT,
  data             JSONB,
  status           TEXT CHECK (status IN ('venter', 'bekreftet', 'forkastet')) NOT NULL DEFAULT 'venter',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER statusoppdateringer_updated_at
  BEFORE UPDATE ON statusoppdateringer
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 9. Mål-koblinger (saker og høringer)
CREATE TABLE maal_koblinger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id       UUID REFERENCES organisasjoner(id) NOT NULL,
  maal_id               UUID REFERENCES maal(id) ON DELETE CASCADE NOT NULL,
  sak_id                UUID REFERENCES saker(id) ON DELETE CASCADE,
  offentlig_horing_id   UUID REFERENCES offentlige_horinger(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  CHECK ((sak_id IS NOT NULL) != (offentlig_horing_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_maal_koblinger_sak ON maal_koblinger(maal_id, sak_id) WHERE sak_id IS NOT NULL;
CREATE UNIQUE INDEX idx_maal_koblinger_horing ON maal_koblinger(maal_id, offentlig_horing_id) WHERE offentlig_horing_id IS NOT NULL;

-- 10. Gjennomslag
CREATE TABLE gjennomslag (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisasjon_id   UUID REFERENCES organisasjoner(id) NOT NULL,
  maal_id           UUID REFERENCES maal(id) ON DELETE CASCADE NOT NULL,
  nokkelresultat_id UUID REFERENCES nokkelresultater(id) ON DELETE SET NULL,
  dato              DATE NOT NULL DEFAULT CURRENT_DATE,
  kilde_type        TEXT CHECK (kilde_type IN ('innstilling', 'proposisjon', 'vedtak', 'stortingsdebatt', 'horingssvar', 'motereferat', 'media')) NOT NULL,
  tekst             TEXT NOT NULL,
  vurdering         TEXT CHECK (vurdering IN ('bidrar', 'delvis', 'fullt', 'ikke')) NOT NULL DEFAULT 'bidrar',
  url               TEXT,
  created_by        UUID REFERENCES brukere(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 11. Utvid lenker med maal_id
ALTER TABLE lenker
  ADD COLUMN maal_id UUID REFERENCES maal(id) ON DELETE CASCADE;

-- Minst én av sak_id eller maal_id må være satt
ALTER TABLE lenker
  ADD CONSTRAINT lenker_sak_eller_maal CHECK (sak_id IS NOT NULL OR maal_id IS NOT NULL);

-- ============================================================
-- Indekser
-- ============================================================

CREATE INDEX idx_tema_org ON tema(organisasjon_id);
CREATE INDEX idx_maal_tema ON maal(tema_id);
CREATE INDEX idx_maal_org ON maal(organisasjon_id);
CREATE INDEX idx_maal_arkivert ON maal(organisasjon_id) WHERE arkivert = false;
CREATE INDEX idx_nokkelresultater_maal ON nokkelresultater(maal_id);
CREATE INDEX idx_kr_vurderinger_kr ON kr_vurderinger(nokkelresultat_id);
CREATE INDEX idx_kr_vurderinger_pk ON kr_vurderinger(politisk_kvarter_id);
CREATE INDEX idx_statusoppdateringer_maal ON statusoppdateringer(maal_id) WHERE status = 'venter';
CREATE INDEX idx_politisk_kvarter_org ON politisk_kvarter(organisasjon_id);
CREATE INDEX idx_maal_koblinger_maal ON maal_koblinger(maal_id);
CREATE INDEX idx_gjennomslag_maal ON gjennomslag(maal_id);
CREATE INDEX idx_lenker_maal ON lenker(maal_id) WHERE maal_id IS NOT NULL;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE tema ENABLE ROW LEVEL SECURITY;
ALTER TABLE maal ENABLE ROW LEVEL SECURITY;
ALTER TABLE nokkelresultater ENABLE ROW LEVEL SECURITY;
ALTER TABLE kr_vurderinger ENABLE ROW LEVEL SECURITY;
ALTER TABLE statusoppdateringer ENABLE ROW LEVEL SECURITY;
ALTER TABLE politisk_kvarter ENABLE ROW LEVEL SECURITY;
ALTER TABLE politisk_kvarter_maal ENABLE ROW LEVEL SECURITY;
ALTER TABLE maal_koblinger ENABLE ROW LEVEL SECURITY;
ALTER TABLE gjennomslag ENABLE ROW LEVEL SECURITY;

-- Tema
CREATE POLICY "tema_select" ON tema
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "tema_insert" ON tema
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "tema_update" ON tema
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "tema_delete" ON tema
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() = 'org-admin'
  );

-- Mål
CREATE POLICY "maal_select" ON maal
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "maal_insert" ON maal
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "maal_update" ON maal
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "maal_delete" ON maal
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() = 'org-admin'
  );

-- Nøkkelresultater
CREATE POLICY "nokkelresultater_select" ON nokkelresultater
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "nokkelresultater_insert" ON nokkelresultater
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "nokkelresultater_update" ON nokkelresultater
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "nokkelresultater_delete" ON nokkelresultater
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- KR-vurderinger
CREATE POLICY "kr_vurderinger_select" ON kr_vurderinger
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "kr_vurderinger_insert" ON kr_vurderinger
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- Statusoppdateringer
CREATE POLICY "statusoppdateringer_select" ON statusoppdateringer
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "statusoppdateringer_insert" ON statusoppdateringer
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "statusoppdateringer_update" ON statusoppdateringer
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- Politisk kvarter
CREATE POLICY "politisk_kvarter_select" ON politisk_kvarter
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "politisk_kvarter_insert" ON politisk_kvarter
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "politisk_kvarter_update" ON politisk_kvarter
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- Politisk kvarter – mål
CREATE POLICY "pk_maal_select" ON politisk_kvarter_maal
  FOR SELECT USING (
    politisk_kvarter_id IN (
      SELECT id FROM politisk_kvarter WHERE organisasjon_id = auth_organisasjon_id()
    )
  );

CREATE POLICY "pk_maal_insert" ON politisk_kvarter_maal
  FOR INSERT WITH CHECK (
    politisk_kvarter_id IN (
      SELECT id FROM politisk_kvarter WHERE organisasjon_id = auth_organisasjon_id()
    )
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "pk_maal_update" ON politisk_kvarter_maal
  FOR UPDATE USING (
    politisk_kvarter_id IN (
      SELECT id FROM politisk_kvarter WHERE organisasjon_id = auth_organisasjon_id()
    )
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- Mål-koblinger
CREATE POLICY "maal_koblinger_select" ON maal_koblinger
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "maal_koblinger_insert" ON maal_koblinger
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "maal_koblinger_delete" ON maal_koblinger
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- Gjennomslag
CREATE POLICY "gjennomslag_select" ON gjennomslag
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "gjennomslag_insert" ON gjennomslag
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "gjennomslag_update" ON gjennomslag
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "gjennomslag_delete" ON gjennomslag
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );
