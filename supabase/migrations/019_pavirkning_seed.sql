-- ============================================================
-- Påvirkning: seed temaer og mål
-- Målene er plassholdere – byttes ut med de ekte 16.
-- ============================================================

-- Sett inn temaer for alle organisasjoner som finnes
-- (i praksis én organisasjon, men koden er generisk)
INSERT INTO tema (organisasjon_id, navn, rekkefolge)
SELECT id, 'Rettshjelp',      1 FROM organisasjoner
UNION ALL
SELECT id, 'Salær',           2 FROM organisasjoner
UNION ALL
SELECT id, 'Rettssikkerhet',  3 FROM organisasjoner
UNION ALL
SELECT id, 'Advokatrollen',   4 FROM organisasjoner;

-- Plassholder-mål (erstattes med ekte mål fra brukeren)
-- Hvert mål kobles til riktig tema via subselect
-- OBS: Disse INSERT-ene kjøres bare hvis temaene allerede finnes

-- Rettshjelp (4 mål)
INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering)
SELECT o.id, t.id, m.tittel, m.formulering
FROM organisasjoner o
CROSS JOIN tema t
CROSS JOIN (VALUES
  ('Styrket rettshjelpsordning', 'Den offentlige rettshjelpsordningen skal utvides til å dekke flere rettsområder og flere personer.'),
  ('Økt inntektsgrense for fri rettshjelp', 'Inntektsgrensene for fri rettshjelp skal heves slik at flere får tilgang.'),
  ('Bedre rettshjelp i asylsaker', 'Rettshjelpen i asylsaker skal styrkes med flere timer og tidligere inngrep.'),
  ('Digital rettshjelp', 'Det skal etableres en digital rettshjelpsportal for enkel tilgang til juridisk bistand.')
) AS m(tittel, formulering)
WHERE t.organisasjon_id = o.id AND t.navn = 'Rettshjelp';

-- Salær (4 mål)
INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering)
SELECT o.id, t.id, m.tittel, m.formulering
FROM organisasjoner o
CROSS JOIN tema t
CROSS JOIN (VALUES
  ('Økt salærsats', 'Salærsatsen skal opp på et bærekraftig nivå som reflekterer kostnads- og lønnsutviklingen.'),
  ('Årlig justering av salærsatsen', 'Salærsatsen skal justeres årlig i takt med lønns- og prisvekst.'),
  ('Reisesalær utenfor rettskrets', 'Reisesalæret skal dekke reelle kostnader ved oppdrag utenfor rettskretsen.'),
  ('Salær for forberedelse', 'Salærsatsen for forberedelsestid skal speile faktisk tidsbruk.')
) AS m(tittel, formulering)
WHERE t.organisasjon_id = o.id AND t.navn = 'Salær';

-- Rettssikkerhet (4 mål)
INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering)
SELECT o.id, t.id, m.tittel, m.formulering
FROM organisasjoner o
CROSS JOIN tema t
CROSS JOIN (VALUES
  ('Styrket kontradiksjon i forvaltningen', 'Partene skal sikres bedre kontradiksjon i forvaltningssaker.'),
  ('Bevare juryordningen', 'Juryordningen i lagmannsretten skal bevares i sin nåværende form.'),
  ('Uavhengig tilsyn med politiet', 'Det skal opprettes et uavhengig organ for tilsyn med politiets maktbruk.'),
  ('Rettssikkerhet i digitaliseringen', 'Rettssikkerhetsgarantier skal ivaretas ved økt bruk av automatiserte vedtak.')
) AS m(tittel, formulering)
WHERE t.organisasjon_id = o.id AND t.navn = 'Rettssikkerhet';

-- Advokatrollen (4 mål)
INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering)
SELECT o.id, t.id, m.tittel, m.formulering
FROM organisasjoner o
CROSS JOIN tema t
CROSS JOIN (VALUES
  ('Styrket taushetsplikt', 'Advokaters taushetsplikt skal vernes mot uthuling i ny lovgivning.'),
  ('Uavhengig advokatstandard', 'Advokatforeningen skal ha en selvstendig rolle i å fastsette etiske standarder.'),
  ('Advokaters innsynsrett', 'Advokaters rett til innsyn i saksdokumenter skal styrkes.'),
  ('Forhindre interessekonflikter', 'Regelverket for interessekonflikter skal tydeliggjøres og håndheves strengere.')
) AS m(tittel, formulering)
WHERE t.organisasjon_id = o.id AND t.navn = 'Advokatrollen';
