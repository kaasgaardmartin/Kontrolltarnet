-- ============================================================
-- Auto-assign user to organization based on email domain
-- Triggered on new user signup via Supabase Auth
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_domain TEXT;
  org_id UUID;
  user_navn TEXT;
BEGIN
  -- Extract domain from email
  user_domain := split_part(NEW.email, '@', 2);

  -- Get user name from metadata (set during signup)
  user_navn := COALESCE(
    NEW.raw_user_meta_data->>'navn',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Look up organization by domain
  SELECT id INTO org_id
  FROM organisasjoner
  WHERE domene = user_domain;

  -- If org found, auto-assign user as 'leser'
  IF org_id IS NOT NULL THEN
    INSERT INTO brukere (id, organisasjon_id, navn, epost, rolle)
    VALUES (NEW.id, org_id, user_navn, NEW.email, 'leser');
  END IF;

  -- If no org found, user will land on the waiting list page
  -- An admin must manually assign them to an org

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
