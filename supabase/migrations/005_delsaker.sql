-- Add forelder_id to saker for parent-child (delsaker) relationship
ALTER TABLE saker ADD COLUMN forelder_id UUID REFERENCES saker(id) ON DELETE CASCADE;

-- Index for fast lookup of children
CREATE INDEX idx_saker_forelder_id ON saker(forelder_id) WHERE forelder_id IS NOT NULL;
