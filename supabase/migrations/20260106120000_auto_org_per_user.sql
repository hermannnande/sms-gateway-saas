-- Auto-create an organization + membership for every new auth user.
-- Goal: users shouldn't have to think about "organisation" during signup,
-- and we avoid accounts existing without org_members (which breaks onboarding/admin flows).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Function: create default org + membership (idempotent)
CREATE OR REPLACE FUNCTION public.create_default_org_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
  v_name TEXT;
BEGIN
  -- If already has at least one membership, do nothing.
  IF EXISTS (SELECT 1 FROM public.org_members om WHERE om.user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_org_id := gen_random_uuid();
  v_name := COALESCE(NULLIF(split_part(NEW.email, '@', 1), ''), 'Mon organisation');
  v_name := 'Organisation ' || v_name;

  INSERT INTO public.organizations (id, name, created_at)
  VALUES (v_org_id, v_name, NOW())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.org_members (org_id, user_id, role, created_at)
  VALUES (v_org_id, NEW.id, 'ORG_ADMIN', NOW())
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2) Trigger on auth.users
DROP TRIGGER IF EXISTS trg_create_default_org_for_new_user ON auth.users;
CREATE TRIGGER trg_create_default_org_for_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_default_org_for_new_user();

-- 3) Backfill: existing users with no org_members
DO $$
DECLARE
  r RECORD;
  v_org_id UUID;
  v_name TEXT;
BEGIN
  FOR r IN
    SELECT u.id, u.email
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.org_members om WHERE om.user_id = u.id)
  LOOP
    v_org_id := gen_random_uuid();
    v_name := COALESCE(NULLIF(split_part(r.email, '@', 1), ''), 'Mon organisation');
    v_name := 'Organisation ' || v_name;

    INSERT INTO public.organizations (id, name, created_at)
    VALUES (v_org_id, v_name, NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.org_members (org_id, user_id, role, created_at)
    VALUES (v_org_id, r.id, 'ORG_ADMIN', NOW())
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END LOOP;
END $$;


