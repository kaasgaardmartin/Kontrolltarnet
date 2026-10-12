-- ============================================================
-- RPC: Avslutt politisk kvarter i én transaksjon
-- ============================================================
-- Tar inn PK-id og alle endringer samlet.
-- Oppdaterer KR-sannsynligheter, markerer tiltak, oppretter nye tiltak,
-- bekrefter/forkaster ventende statusoppdateringer, og lukker møtet.

CREATE OR REPLACE FUNCTION avslutt_politisk_kvarter(
  p_pk_id              UUID,
  p_organisasjon_id    UUID,
  p_bruker_id          UUID,
  p_sannsynligheter    JSONB DEFAULT '{}',    -- { nokkelresultat_id: ny_verdi }
  p_tiltak_gjort       UUID[] DEFAULT '{}',
  p_tiltak_droppet     UUID[] DEFAULT '{}',
  p_tiltak_utsatt      UUID[] DEFAULT '{}',
  p_nye_tiltak         JSONB DEFAULT '[]',    -- [{ nokkelresultat_id, beskrivelse, ansvarlig_id, frist }]
  p_kommentarer        JSONB DEFAULT '{}',    -- { maal_id: kommentar }
  p_oppsummering       JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kr_id    UUID;
  v_ny_sann  INT;
  v_gml_sann INT;
  v_tiltak   JSONB;
  v_maal_id  TEXT;
  v_kommentar TEXT;
  v_nye_count INT := 0;
  v_gjort_count INT := 0;
  v_droppet_count INT := 0;
  v_utsatt_count INT := 0;
  v_fall_count INT := 0;
BEGIN
  -- Verifiser at PK tilhører riktig org og pågår
  IF NOT EXISTS (
    SELECT 1 FROM politisk_kvarter
    WHERE id = p_pk_id
      AND organisasjon_id = p_organisasjon_id
      AND status = 'pagar'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Møtet finnes ikke eller er allerede avsluttet');
  END IF;

  -- 1. Oppdater KR-sannsynligheter og logg vurderinger
  FOR v_kr_id, v_ny_sann IN
    SELECT (key)::UUID, (value)::INT
    FROM jsonb_each_text(p_sannsynligheter)
  LOOP
    SELECT sannsynlighet INTO v_gml_sann
    FROM nokkelresultater
    WHERE id = v_kr_id AND organisasjon_id = p_organisasjon_id;

    IF v_gml_sann IS NOT NULL THEN
      UPDATE nokkelresultater
      SET sannsynlighet = v_ny_sann
      WHERE id = v_kr_id AND organisasjon_id = p_organisasjon_id;

      INSERT INTO kr_vurderinger (organisasjon_id, nokkelresultat_id, politisk_kvarter_id, sannsynlighet, forrige_sannsynlighet, dato)
      VALUES (p_organisasjon_id, v_kr_id, p_pk_id, v_ny_sann, v_gml_sann, CURRENT_DATE);

      IF v_ny_sann < v_gml_sann THEN
        v_fall_count := v_fall_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Marker tiltak gjort
  UPDATE aktiviteter
  SET status = 'utført', lukket_dato = CURRENT_DATE, updated_by = p_bruker_id
  WHERE id = ANY(p_tiltak_gjort)
    AND organisasjon_id = p_organisasjon_id
    AND status = 'planlagt';
  GET DIAGNOSTICS v_gjort_count = ROW_COUNT;

  -- 3. Marker tiltak droppet
  UPDATE aktiviteter
  SET status = 'avlyst', lukket_dato = CURRENT_DATE, updated_by = p_bruker_id
  WHERE id = ANY(p_tiltak_droppet)
    AND organisasjon_id = p_organisasjon_id
    AND status = 'planlagt';
  GET DIAGNOSTICS v_droppet_count = ROW_COUNT;

  -- 4. Utsett tiltak (+7 dager fra maks(frist, i dag))
  UPDATE aktiviteter
  SET frist = GREATEST(frist, CURRENT_DATE) + INTERVAL '7 days',
      updated_by = p_bruker_id
  WHERE id = ANY(p_tiltak_utsatt)
    AND organisasjon_id = p_organisasjon_id
    AND status = 'planlagt';
  GET DIAGNOSTICS v_utsatt_count = ROW_COUNT;

  -- 5. Opprett nye tiltak
  FOR v_tiltak IN SELECT * FROM jsonb_array_elements(p_nye_tiltak)
  LOOP
    INSERT INTO aktiviteter (
      organisasjon_id, nokkelresultat_id, beskrivelse, ansvarlig_id, frist,
      status, type, created_by
    ) VALUES (
      p_organisasjon_id,
      (v_tiltak->>'nokkelresultat_id')::UUID,
      v_tiltak->>'beskrivelse',
      NULLIF(v_tiltak->>'ansvarlig_id', '')::UUID,
      (v_tiltak->>'frist')::DATE,
      'planlagt',
      'annet',
      p_bruker_id
    );
    v_nye_count := v_nye_count + 1;
  END LOOP;

  -- 6. Oppdater siste_kommentar per mål
  FOR v_maal_id, v_kommentar IN
    SELECT key, value#>>'{}'
    FROM jsonb_each(p_kommentarer)
  LOOP
    IF v_kommentar IS NOT NULL AND v_kommentar != '' THEN
      UPDATE maal
      SET siste_kommentar = v_kommentar
      WHERE id = v_maal_id::UUID AND organisasjon_id = p_organisasjon_id;
    END IF;
  END LOOP;

  -- 7. Bekreft ventende statusoppdateringer for behandlede mål
  UPDATE statusoppdateringer
  SET status = 'bekreftet', updated_at = now()
  WHERE maal_id IN (
    SELECT maal_id FROM politisk_kvarter_maal
    WHERE politisk_kvarter_id = p_pk_id AND behandlet = true
  )
  AND organisasjon_id = p_organisasjon_id
  AND status = 'venter';

  -- 8. Lukk møtet
  UPDATE politisk_kvarter
  SET status = 'avsluttet',
      fase = 'oppsummering',
      oppsummering = COALESCE(p_oppsummering, jsonb_build_object(
        'antall_behandlet', (SELECT COUNT(*) FROM politisk_kvarter_maal WHERE politisk_kvarter_id = p_pk_id AND behandlet = true),
        'antall_hoppet_over', (SELECT COUNT(*) FROM politisk_kvarter_maal WHERE politisk_kvarter_id = p_pk_id AND valgt = true AND behandlet = false),
        'forfalte_tiltak_gjort', v_gjort_count,
        'forfalte_tiltak_totalt', v_gjort_count + v_droppet_count + v_utsatt_count,
        'nye_tiltak', v_nye_count,
        'utsatte_tiltak', v_utsatt_count,
        'fall_i_sannsynlighet', v_fall_count
      ))
  WHERE id = p_pk_id AND organisasjon_id = p_organisasjon_id;

  RETURN jsonb_build_object(
    'success', true,
    'behandlet', (SELECT COUNT(*) FROM politisk_kvarter_maal WHERE politisk_kvarter_id = p_pk_id AND behandlet = true),
    'nye_tiltak', v_nye_count,
    'gjort', v_gjort_count,
    'utsatt', v_utsatt_count,
    'fall', v_fall_count
  );
END;
$$;
