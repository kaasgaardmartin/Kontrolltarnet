-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Helper function: get current user's org
CREATE OR REPLACE FUNCTION auth_organisasjon_id()
RETURNS UUID AS $$
  SELECT organisasjon_id FROM brukere WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION auth_rolle()
RETURNS TEXT AS $$
  SELECT rolle FROM brukere WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- organisasjoner
-- ============================================================
ALTER TABLE organisasjoner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON organisasjoner
  FOR SELECT USING (id = auth_organisasjon_id());

-- ============================================================
-- brukere
-- ============================================================
ALTER TABLE brukere ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brukere_select" ON brukere
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "brukere_update" ON brukere
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() = 'org-admin'
  );

-- ============================================================
-- saker
-- ============================================================
ALTER TABLE saker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saker_select" ON saker
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "saker_insert" ON saker
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "saker_update" ON saker
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "saker_delete" ON saker
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- partistemmer
-- ============================================================
ALTER TABLE partistemmer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partistemmer_select" ON partistemmer
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "partistemmer_insert" ON partistemmer
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "partistemmer_update" ON partistemmer
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "partistemmer_delete" ON partistemmer
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- komiteer
-- ============================================================
ALTER TABLE komiteer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "komiteer_select" ON komiteer
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "komiteer_insert" ON komiteer
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "komiteer_update" ON komiteer
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "komiteer_delete" ON komiteer
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() = 'org-admin'
  );

-- ============================================================
-- komite_mandater
-- ============================================================
ALTER TABLE komite_mandater ENABLE ROW LEVEL SECURITY;

CREATE POLICY "komite_mandater_select" ON komite_mandater
  FOR SELECT USING (
    komite_id IN (SELECT id FROM komiteer WHERE organisasjon_id = auth_organisasjon_id())
  );

CREATE POLICY "komite_mandater_insert" ON komite_mandater
  FOR INSERT WITH CHECK (
    komite_id IN (SELECT id FROM komiteer WHERE organisasjon_id = auth_organisasjon_id())
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "komite_mandater_update" ON komite_mandater
  FOR UPDATE USING (
    komite_id IN (SELECT id FROM komiteer WHERE organisasjon_id = auth_organisasjon_id())
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "komite_mandater_delete" ON komite_mandater
  FOR DELETE USING (
    komite_id IN (SELECT id FROM komiteer WHERE organisasjon_id = auth_organisasjon_id())
    AND auth_rolle() = 'org-admin'
  );

-- ============================================================
-- stortingssalen_mandater
-- ============================================================
ALTER TABLE stortingssalen_mandater ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stortingssalen_select" ON stortingssalen_mandater
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "stortingssalen_insert" ON stortingssalen_mandater
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "stortingssalen_update" ON stortingssalen_mandater
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- noter
-- ============================================================
ALTER TABLE noter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noter_select" ON noter
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "noter_insert" ON noter
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- lenker
-- ============================================================
ALTER TABLE lenker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lenker_select" ON lenker
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "lenker_insert" ON lenker
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "lenker_delete" ON lenker
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- varsel_innstillinger
-- ============================================================
ALTER TABLE varsel_innstillinger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "varsel_select" ON varsel_innstillinger
  FOR SELECT USING (bruker_id = auth.uid());

CREATE POLICY "varsel_insert" ON varsel_innstillinger
  FOR INSERT WITH CHECK (bruker_id = auth.uid());

CREATE POLICY "varsel_update" ON varsel_innstillinger
  FOR UPDATE USING (bruker_id = auth.uid());

CREATE POLICY "varsel_delete" ON varsel_innstillinger
  FOR DELETE USING (bruker_id = auth.uid());
