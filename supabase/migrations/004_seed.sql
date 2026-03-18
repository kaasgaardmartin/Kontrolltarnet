-- ============================================================
-- Seed data for development/testing
-- Run after creating test users in Supabase Auth
-- ============================================================

-- Default Norwegian parliament parties and mandate distribution (2021-2025)
-- This can be inserted per organization after org creation

-- Example: Insert standard stortingssalen mandater for an org
-- Replace 'ORG_ID' with actual organization UUID after creation

/*
INSERT INTO stortingssalen_mandater (organisasjon_id, parti, antall) VALUES
  ('ORG_ID', 'Ap', 48),
  ('ORG_ID', 'H', 36),
  ('ORG_ID', 'SP', 28),
  ('ORG_ID', 'FrP', 21),
  ('ORG_ID', 'SV', 13),
  ('ORG_ID', 'R', 8),
  ('ORG_ID', 'V', 8),
  ('ORG_ID', 'MDG', 3),
  ('ORG_ID', 'KrF', 3),
  ('ORG_ID', 'PF', 1);
*/
