-- =============================================
-- Admin & Analytics Platform (v1)
-- Tables:
--  - app_users: miroir de auth.users (pour stats & admin)
--  - admin_users: liste des admins (SUPER_ADMIN / SUPPORT)
--  - analytics_events: événements (downloads, web ping, device heartbeat, etc.)
-- =============================================

-- Ensure pgcrypto is available (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Mirror table for auth.users (public schema)
CREATE TABLE IF NOT EXISTS public.app_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  last_web_seen_at TIMESTAMPTZ,
  last_mobile_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_users_created_at ON public.app_users(created_at);

-- Trigger: when a new auth user is created, mirror to public.app_users
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.app_users (user_id, email, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.created_at, NOW()))
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.on_auth_user_created();

-- 2) Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'SUPPORT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- 3) Analytics events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform TEXT NOT NULL CHECK (platform IN ('web', 'mobile', 'server')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON public.analytics_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON public.analytics_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_time ON public.analytics_events(org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_device_time ON public.analytics_events(device_id, occurred_at DESC);

-- 4) Enable RLS (we keep it locked; server uses service role)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- app_users: user can read own row (optional)
DROP POLICY IF EXISTS "Users can view own app_users row" ON public.app_users;
CREATE POLICY "Users can view own app_users row"
ON public.app_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- app_users: nobody can write from client (server/service role only)
DROP POLICY IF EXISTS "No client writes to app_users" ON public.app_users;
CREATE POLICY "No client writes to app_users"
ON public.app_users FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- admin_users: only service role (no client access)
DROP POLICY IF EXISTS "No client access to admin_users" ON public.admin_users;
CREATE POLICY "No client access to admin_users"
ON public.admin_users FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- analytics_events: block client writes by default (we log server-side)
DROP POLICY IF EXISTS "No client access to analytics_events" ON public.analytics_events;
CREATE POLICY "No client access to analytics_events"
ON public.analytics_events FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- 5) Backfill existing users (for older projects)
INSERT INTO public.app_users (user_id, email, created_at)
SELECT u.id, u.email, COALESCE(u.created_at, NOW())
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email;


