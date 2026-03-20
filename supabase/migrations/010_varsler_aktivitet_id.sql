-- ============================================================
-- Add aktivitet_id to varsler for cleanup on task completion/deletion
-- ============================================================

ALTER TABLE varsler
  ADD COLUMN aktivitet_id UUID REFERENCES aktiviteter(id) ON DELETE CASCADE;

CREATE INDEX idx_varsler_aktivitet ON varsler(aktivitet_id) WHERE aktivitet_id IS NOT NULL;
