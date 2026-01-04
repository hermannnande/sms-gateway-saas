-- Fix RLS policies on inbox_messages:
-- Previous policies referenced public.user_org_id() which does not exist.
-- We use public.my_org_ids() (security definer) to avoid recursion and support multi-org.

-- Ensure table exists (some projects didn't run the inbox_messages migration yet)
CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  from_phone_e164 TEXT NOT NULL,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,
  replied BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_org ON public.inbox_messages(org_id);
CREATE INDEX IF NOT EXISTS idx_inbox_device ON public.inbox_messages(device_id);
CREATE INDEX IF NOT EXISTS idx_inbox_phone ON public.inbox_messages(from_phone_e164);
CREATE INDEX IF NOT EXISTS idx_inbox_received ON public.inbox_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_read ON public.inbox_messages(read);

ALTER TABLE IF EXISTS public.inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can insert their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can update their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can delete their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can view their org inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can insert their org inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can update their org inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can delete their org inbox messages" ON public.inbox_messages;

CREATE POLICY "Users can view their org inbox messages"
ON public.inbox_messages FOR SELECT
USING (org_id IN (SELECT public.my_org_ids()));

CREATE POLICY "Users can insert their org inbox messages"
ON public.inbox_messages FOR INSERT
WITH CHECK (org_id IN (SELECT public.my_org_ids()));

CREATE POLICY "Users can update their org inbox messages"
ON public.inbox_messages FOR UPDATE
USING (org_id IN (SELECT public.my_org_ids()))
WITH CHECK (org_id IN (SELECT public.my_org_ids()));

CREATE POLICY "Users can delete their org inbox messages"
ON public.inbox_messages FOR DELETE
USING (org_id IN (SELECT public.my_org_ids()));


