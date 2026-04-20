-- ============================================================
-- Komité-mandatfordeling 2025-2026 (Stortinget 2025-2029)
-- Kilde: stortinget.no, hentet 2026-04-20
-- ============================================================
-- Setter inn/oppdaterer partifordeling for alle 12 faste komiteer.
-- Bruker ILIKE-navn-oppslag slik at det fungerer uavhengig av UUID.
-- ============================================================

DO $$
DECLARE
  v_komite_id UUID;
BEGIN

  -- 1. Finanskomiteen (17 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Finanskomit%' LOOP
    UPDATE komiteer SET totalt_antall = 17 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  5),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'V',   1)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 2. Arbeids- og sosialkomiteen (12 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Arbeids%sosial%' LOOP
    UPDATE komiteer SET totalt_antall = 12 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  4),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'SP',  0),
      (v_komite_id, 'MDG', 0),
      (v_komite_id, 'KrF', 0),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 3. Energi- og miljøkomiteen (16 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Energi%milj%' LOOP
    UPDATE komiteer SET totalt_antall = 16 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  5),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'V',   1),
      (v_komite_id, 'KrF', 0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 4. Familie- og kulturkomiteen (11 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Familie%kultur%' LOOP
    UPDATE komiteer SET totalt_antall = 11 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  3),
      (v_komite_id, 'FrP', 3),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'SP',  0),
      (v_komite_id, 'R',   0),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 5. Helse- og omsorgskomiteen (15 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Helse%omsorg%' LOOP
    UPDATE komiteer SET totalt_antall = 15 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  5),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'MDG', 0),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 6. Justiskomiteen (13 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Justis%' LOOP
    UPDATE komiteer SET totalt_antall = 13 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  4),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'SV',  0),
      (v_komite_id, 'R',   0),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 7. Kommunal- og forvaltningskomiteen (14 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Kommunal%forvaltning%' LOOP
    UPDATE komiteer SET totalt_antall = 14 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  4),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'KrF', 0),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 8. Kontroll- og konstitusjonskomiteen (14 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Kontroll%konstitusjon%' LOOP
    UPDATE komiteer SET totalt_antall = 14 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  4),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   1),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 9. Næringskomiteen (16 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Nærings%' LOOP
    UPDATE komiteer SET totalt_antall = 16 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  5),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 10. Transport- og kommunikasjonskomiteen (14 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Transport%kommunikasjon%' LOOP
    UPDATE komiteer SET totalt_antall = 14 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  4),
      (v_komite_id, 'FrP', 5),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'SV',  0),
      (v_komite_id, 'KrF', 0),
      (v_komite_id, 'V',   0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 11. Utdannings- og forskningskomiteen (15 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Utdanning%forskning%' LOOP
    UPDATE komiteer SET totalt_antall = 15 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  4),
      (v_komite_id, 'FrP', 4),
      (v_komite_id, 'H',   2),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'V',   1),
      (v_komite_id, 'MDG', 0)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

  -- 12. Utenriks- og forsvarskomiteen (17 medlemmer)
  FOR v_komite_id IN SELECT id FROM komiteer WHERE navn ILIKE '%Utenriks%forsvar%' LOOP
    UPDATE komiteer SET totalt_antall = 17 WHERE id = v_komite_id;
    INSERT INTO komite_mandater (komite_id, parti, antall) VALUES
      (v_komite_id, 'Ap',  5),
      (v_komite_id, 'FrP', 3),
      (v_komite_id, 'H',   3),
      (v_komite_id, 'SV',  1),
      (v_komite_id, 'SP',  1),
      (v_komite_id, 'R',   1),
      (v_komite_id, 'MDG', 1),
      (v_komite_id, 'KrF', 1),
      (v_komite_id, 'V',   1)
    ON CONFLICT (komite_id, parti) DO UPDATE SET antall = EXCLUDED.antall;
  END LOOP;

END $$;
