-- ============================================================
-- Rydd opp duplikater og sett inn ekte politiske mål
-- ============================================================
-- Seed-migrasjonen (019) ble kjørt to ganger mot to organisasjoner,
-- noe som ga duplikate temaer og plassholder-mål.
-- Denne migrasjonen rydder opp og erstatter med
-- Advokatforeningens 16 ekte politiske mål.
--
-- Kategorisering:
--   Rettshjelp (3):  Førstelinjetjeneste, Mva, Barn
--   Salær (2):       Salærsats, Forskuddsbetaling
--   Rettssikkerhet (5): Straffeprosessutvalget, Adm. sanksjoner,
--                       Rettsstatsmelding, Rekonstruksjon, Offentleglova
--   Advokatrollen (6): Vold/trusler, Taushetsplikt, Hvitvaskingstilsyn,
--                       Advokattilsynet, Digitalt, Forsikringsadvokater

BEGIN;

-- 1. Slett all testdata (i riktig rekkefølge for FK)
DELETE FROM kr_vurderinger;
DELETE FROM politisk_kvarter_maal;
DELETE FROM politisk_kvarter;
DELETE FROM statusoppdateringer;
DELETE FROM maal_koblinger;
DELETE FROM gjennomslag;
DELETE FROM aktiviteter WHERE nokkelresultat_id IS NOT NULL;
DELETE FROM nokkelresultater;
DELETE FROM maal;

-- 2. Fjern temaer som tilhører feil organisasjon (duplikat fra dobbel seed)
DELETE FROM tema
WHERE organisasjon_id != '4370920e-4a84-4750-bde1-6ada5dc38c3e';

-- 3. Sett inn de 16 ekte målene
DO $$
DECLARE
  v_org_id UUID := '4370920e-4a84-4750-bde1-6ada5dc38c3e';
  v_rettshjelp UUID;
  v_salaer UUID;
  v_rettssikkerhet UUID;
  v_advokatrollen UUID;
BEGIN
  SELECT id INTO v_rettshjelp FROM tema WHERE organisasjon_id = v_org_id AND navn = 'Rettshjelp';
  SELECT id INTO v_salaer FROM tema WHERE organisasjon_id = v_org_id AND navn = 'Salær';
  SELECT id INTO v_rettssikkerhet FROM tema WHERE organisasjon_id = v_org_id AND navn = 'Rettssikkerhet';
  SELECT id INTO v_advokatrollen FROM tema WHERE organisasjon_id = v_org_id AND navn = 'Advokatrollen';

  -- Rettshjelp (3 mål)
  INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering) VALUES
    (v_org_id, v_rettshjelp,
     'Førstelinjetjeneste for rettshjelp',
     'Alle skal ha tilgang til en gratis førstelinjetjeneste for rettshjelp, gitt av privatpraktiserende advokater, slik at juridiske problemer blir avklart tidlig'),
    (v_org_id, v_rettshjelp,
     'Fjerne mva på advokattjenester',
     'Merverdiavgiften på advokattjenester til privatpersoner skal fjernes, slik at staten ikke tjener penger på å være i konflikt med borgerne'),
    (v_org_id, v_rettshjelp,
     'Straffeprosessuelle regler for barn',
     'Mistenkte barn skal ha en rettssikker straffeprosess, med ubetinget rett til forsvarer og egne regler i loven');

  -- Salær (2 mål)
  INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering) VALUES
    (v_org_id, v_salaer,
     'Økt salærsats',
     'Salærsatsen skal opp på et bærekraftig nivå gjennom en forpliktende opptrappingsplan og en uavhengig, formalisert reguleringsmodell'),
    (v_org_id, v_salaer,
     'Forskuddsbetaling',
     'Advokater i offentlige salærsaker skal ha rett til forskudd eller løpende a konto-utbetaling i lange saker, slik at de ikke selv må finansiere arbeidet til saken er ferdig');

  -- Rettssikkerhet (5 mål)
  INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering) VALUES
    (v_org_id, v_rettssikkerhet,
     'Skjev oppfølging av Straffeprosessutvalget',
     'Oppfølgingen av NOU 2016: 24 skal være balansert, slik at forslagene som styrker mistenktes og siktedes rettssikkerhet gjennomføres, ikke bare effektiviseringstiltakene'),
    (v_org_id, v_rettssikkerhet,
     'Administrative sanksjoner',
     'Forvaltningsloven skal få et eget kapittel om administrative sanksjoner som sikrer rettssikkerhetsgarantiene etter EMK artikkel 6, før nye sanksjonshjemler innføres'),
    (v_org_id, v_rettssikkerhet,
     'Rettsstatsmelding',
     'Regjeringen skal legge fram en egen stortingsmelding om rettsstatens tilstand, slik at rettsstaten får en samlet og jevnlig politisk behandling'),
    (v_org_id, v_rettssikkerhet,
     'Rekonstruksjon, konkurs og fortrinnsrett',
     'Det offentliges fortrinnsrett for skatte- og avgiftskrav skal ikke stå i veien for rekonstruksjon'),
    (v_org_id, v_rettssikkerhet,
     'Advokatkorrespondanse og offentleglova',
     'Offentlige organer skal kunne unnta advokatkorrespondanse fra innsyn etter offentleglova i samme utstrekning som bevisforbudet verner den, slik Advokatlovutvalget foreslo i NOU 2015: 3');

  -- Advokatrollen (6 mål)
  INSERT INTO maal (organisasjon_id, tema_id, tittel, formulering) VALUES
    (v_org_id, v_advokatrollen,
     'Vold og trusler mot advokater',
     'Advokater skal ha et særskilt strafferettslig vern mot vold, trusler og press i all advokatvirksomhet, ikke bare når saken går for retten'),
    (v_org_id, v_advokatrollen,
     'Taushetsplikt i nye hvitvaskingsregler',
     'Den nye antihvitvaskingsloven skal ikke svekke advokaters taushetsplikt: all rettslig rådgivning skal fortsatt være unntatt fra rapporteringsplikten, i samsvar med bevisforbudene i prosesslovgivningen'),
    (v_org_id, v_advokatrollen,
     'Hvitvaskingstilsyn med advokater',
     'Tilsynet med advokaters etterlevelse av hvitvaskingsreglene skal legges til Advokattilsynet, slik at advokater har ett uavhengig tilsyn med kompetanse på advokatvirksomhet'),
    (v_org_id, v_advokatrollen,
     'Advokattilsynets uavhengighet',
     'Advokattilsynet skal være reelt uavhengig av staten: ute av statsbudsjettet, uten tildelingsbrev, og bare styrt gjennom lov og forskrift'),
    (v_org_id, v_advokatrollen,
     'Advokater i det digitale rommet',
     'Advokater skal kunne identifisere seg digitalt som advokat overfor offentlige aktører, slik at generalfullmakten kan brukes også i digitale løsninger'),
    (v_org_id, v_advokatrollen,
     'Forsikringsadvokater',
     'Den kommende forskriften om forsikringsadvokater skal sikre at de primært bistår private klienter, og at de er underlagt Regler for god advokatskikk og Advokatnemnda som klageinstans, ikke Finansklagenemnda');
END $$;

COMMIT;
