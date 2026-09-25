-- Legg til 'påvirkning' som gyldig niva-verdi
ALTER TABLE saker DROP CONSTRAINT IF EXISTS saker_niva_check;
ALTER TABLE saker ADD CONSTRAINT saker_niva_check
  CHECK (niva IN ('storting', 'departement', 'intern', 'påvirkning'));

-- Nye kolonner for påvirkningssaker
ALTER TABLE saker ADD COLUMN IF NOT EXISTS fase TEXT;
ALTER TABLE saker ADD COLUMN IF NOT EXISTS malsetting TEXT;
