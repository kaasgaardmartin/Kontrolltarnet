-- ============================================================
-- 011: Sikkerhetsherding
-- - Splitter FOR ALL-policyer til separate operasjoner med rollekontroll
-- - Legger til manglende DELETE-policyer for noter
-- - Legger til UPDATE-policy for noter (kun forfatter)
-- ============================================================

-- ============================================================
-- 1. Stakeholders — erstatt FOR ALL med separate policyer
-- ============================================================

DROP POLICY IF EXISTS "Stakeholders synlig for org" ON stakeholders;

CREATE POLICY "stakeholders_select" ON stakeholders
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "stakeholders_insert" ON stakeholders
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "stakeholders_update" ON stakeholders
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "stakeholders_delete" ON stakeholders
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() = 'org-admin'
  );

-- ============================================================
-- 2. Sak_stakeholders — erstatt FOR ALL med separate policyer
-- ============================================================

DROP POLICY IF EXISTS "Sak-stakeholders synlig for org" ON sak_stakeholders;

CREATE POLICY "sak_stakeholders_select" ON sak_stakeholders
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "sak_stakeholders_insert" ON sak_stakeholders
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "sak_stakeholders_update" ON sak_stakeholders
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "sak_stakeholders_delete" ON sak_stakeholders
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- 3. Aktiviteter — erstatt FOR ALL med separate policyer
-- ============================================================

DROP POLICY IF EXISTS "Aktiviteter synlig for org" ON aktiviteter;

CREATE POLICY "aktiviteter_select" ON aktiviteter
  FOR SELECT USING (organisasjon_id = auth_organisasjon_id());

CREATE POLICY "aktiviteter_insert" ON aktiviteter
  FOR INSERT WITH CHECK (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "aktiviteter_update" ON aktiviteter
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

CREATE POLICY "aktiviteter_delete" ON aktiviteter
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND auth_rolle() IN ('redaktør', 'org-admin')
  );

-- ============================================================
-- 4. Noter — legge til manglende UPDATE og DELETE policyer
-- ============================================================

-- UPDATE: Kun forfatter kan redigere sine egne notater
CREATE POLICY "noter_update" ON noter
  FOR UPDATE USING (
    organisasjon_id = auth_organisasjon_id()
    AND forfatter_id = auth.uid()
  );

-- DELETE: Forfatter kan slette egne notater, org-admin kan slette alle
CREATE POLICY "noter_delete" ON noter
  FOR DELETE USING (
    organisasjon_id = auth_organisasjon_id()
    AND (
      forfatter_id = auth.uid()
      OR auth_rolle() = 'org-admin'
    )
  );
