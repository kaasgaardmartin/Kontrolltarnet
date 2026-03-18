-- Add stortingssesjon field to saker
ALTER TABLE saker ADD COLUMN sesjon TEXT;

-- Index for filtering by sesjon
CREATE INDEX idx_saker_sesjon ON saker(sesjon) WHERE sesjon IS NOT NULL;
