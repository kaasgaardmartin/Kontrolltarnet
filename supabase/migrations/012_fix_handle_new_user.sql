-- ============================================================
-- 012: Fiks handle_new_user() — mer robust feilhåndtering
-- Feilen "Database error saving new user" oppstår når triggeren kaster exception.
-- Denne versjonen har TRY/CATCH og bedre logging.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_domain TEXT;
  org_id UUID;
  user_navn TEXT;
BEGIN
  -- Extract domain from email
  user_domain := lower(split_part(NEW.email, '@', 2));

  -- Get user name from metadata (set during signup)
  user_navn := COALESCE(
    NEW.raw_user_meta_data->>'navn',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Look up organization by domain
  -- NB: Må bruke public. prefix — triggeren kjører som supabase_auth_admin
  -- som ikke har public i sin search_path
  SELECT id INTO org_id
  FROM public.organisasjoner
  WHERE lower(domene) = user_domain;

  -- If org found, auto-assign user
  IF org_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.brukere (id, organisasjon_id, navn, epost, rolle)
      VALUES (NEW.id, org_id, user_navn, NEW.email, 'redaktør')
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user INSERT feilet for %: %', NEW.email, SQLERRM;
    END;
  END IF;

  RETURN NEW;

-- Ytre exception-blokk: fanger ALLE feil slik at auth.users-INSERT aldri blokkeres
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user YTRE EXCEPTION for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
