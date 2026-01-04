-- Fix RLS policies on inbox_messages:
-- Previous policies referenced public.user_org_id() which does not exist.
-- We use public.my_org_ids() (security definer) to avoid recursion and support multi-org.

ALTER TABLE IF EXISTS public.inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can insert their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can update their org's inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Users can delete their org's inbox messages" ON public.inbox_messages;

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


