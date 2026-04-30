-- Legg til felt for eDocs-nummer på oversendelsesbrev til lovutvalget
ALTER TABLE offentlige_horinger
  ADD COLUMN IF NOT EXISTS oversendelsesbrev_edocs TEXT;
