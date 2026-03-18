-- Legg til utfall-felt for å markere resultat etter behandling i Stortinget
ALTER TABLE saker ADD COLUMN utfall TEXT CHECK (utfall IN ('vedtatt', 'ikke_vedtatt'));
ALTER TABLE saker ADD COLUMN utfall_dato TIMESTAMPTZ;

-- Konverter eksisterende 'avholdende' stemmer til 'ukjent'
UPDATE partistemmer SET stemme = 'ukjent' WHERE stemme = 'avholdende';

-- Oppdater constraint for stemme-feltet (fjern avholdende)
ALTER TABLE partistemmer DROP CONSTRAINT IF EXISTS partistemmer_stemme_check;
ALTER TABLE partistemmer ADD CONSTRAINT partistemmer_stemme_check CHECK (stemme IN ('for', 'mot', 'ukjent'));
