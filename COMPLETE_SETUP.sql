-- =============================================
-- COMPLETE SETUP SQL - SMS Gateway SaaS
-- Copiez-collez tout ce fichier dans Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ORGANIZATIONS
-- =============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 2. ORG_MEMBERS (multi-tenant access control)
-- =============================================
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('ORG_ADMIN', 'ORG_AGENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);

-- =============================================
-- 3. PLANS
-- =============================================
CREATE TABLE plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_xof INTEGER NOT NULL,
    sms_quota_month INTEGER NOT NULL,
    max_devices INTEGER NOT NULL,
    rate_limit_per_min INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- 4. SUBSCRIPTIONS
-- =============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'canceled', 'past_due')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    provider TEXT NOT NULL DEFAULT 'payfonte',
    last_payment_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_org_id_status ON subscriptions(org_id, status);

-- =============================================
-- 5. PAYMENTS
-- =============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'XOF',
    payfonte_reference TEXT,
    external_reference TEXT UNIQUE NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_org_id ON payments(org_id);
CREATE INDEX idx_payments_external_reference ON payments(external_reference);

-- =============================================
-- 6. DEVICES
-- =============================================
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    selected_subscription_id TEXT,
    last_seen_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_org_id ON devices(org_id);
CREATE INDEX idx_devices_token_hash ON devices(token_hash);

-- =============================================
-- 7. TEMPLATES
-- =============================================
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_org_id ON templates(org_id);

-- =============================================
-- 8. CONTACTS
-- =============================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_e164 TEXT NOT NULL,
    name TEXT,
    tags TEXT[] DEFAULT '{}',
    opt_in BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, phone_e164)
);

CREATE INDEX idx_contacts_org_id_phone ON contacts(org_id, phone_e164);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- =============================================
-- 9. OPTOUTS (blacklist STOP)
-- =============================================
CREATE TABLE optouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone_e164 TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(org_id, phone_e164)
);

CREATE INDEX idx_optouts_org_id_phone ON optouts(org_id, phone_e164);

-- =============================================
-- 10. CAMPAIGNS
-- =============================================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'paused', 'done', 'canceled')),
    scheduled_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_org_id ON campaigns(org_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- =============================================
-- 11. MESSAGES
-- =============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    to_phone_e164 TEXT NOT NULL,
    body_final TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped_optout')),
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    sim_subscription_id TEXT,
    try_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_org_id_status_created ON messages(org_id, status, created_at);
CREATE INDEX idx_messages_device_id_status ON messages(device_id, status, created_at);
CREATE INDEX idx_messages_campaign_id ON messages(campaign_id);

-- =============================================
-- HELPER FUNCTIONS (dans schéma public)
-- =============================================

CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members 
    WHERE user_id = auth.uid() 
    AND role = 'ORG_ADMIN'
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE optouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: ORGANIZATIONS
-- =============================================

CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (
  id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Org admins can update their organizations"
ON organizations FOR UPDATE
USING (
  id IN (
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid() 
    AND role = 'ORG_ADMIN'
  )
);

-- =============================================
-- RLS POLICIES: ORG_MEMBERS
-- =============================================

CREATE POLICY "Users can view their org members"
ON org_members FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can add themselves as org admin"
ON org_members FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Org admins can manage members"
ON org_members FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid() 
    AND role = 'ORG_ADMIN'
  )
);

-- =============================================
-- RLS POLICIES: PLANS
-- =============================================

CREATE POLICY "Authenticated users can view plans"
ON plans FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- RLS POLICIES: SUBSCRIPTIONS
-- =============================================

CREATE POLICY "Users can view their org subscriptions"
ON subscriptions FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: PAYMENTS
-- =============================================

CREATE POLICY "Users can view their org payments"
ON payments FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: DEVICES
-- =============================================

CREATE POLICY "Users can view their org devices"
ON devices FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: TEMPLATES
-- =============================================

CREATE POLICY "Users can view their org templates"
ON templates FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their org templates"
ON templates FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their org templates"
ON templates FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their org templates"
ON templates FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: CONTACTS
-- =============================================

CREATE POLICY "Users can view their org contacts"
ON contacts FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their org contacts"
ON contacts FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their org contacts"
ON contacts FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their org contacts"
ON contacts FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: OPTOUTS
-- =============================================

CREATE POLICY "Users can view their org optouts"
ON optouts FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their org optouts"
ON optouts FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: CAMPAIGNS
-- =============================================

CREATE POLICY "Users can view their org campaigns"
ON campaigns FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their org campaigns"
ON campaigns FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their org campaigns"
ON campaigns FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can delete their org campaigns"
ON campaigns FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- RLS POLICIES: MESSAGES
-- =============================================

CREATE POLICY "Users can view their org messages"
ON messages FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their org messages"
ON messages FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- =============================================
-- ATOMIC CLAIM FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION claim_messages_atomic(
  p_org_id UUID,
  p_device_id UUID,
  p_sim_subscription_id TEXT,
  p_limit INT,
  p_optout_phones TEXT[]
)
RETURNS TABLE (
  id UUID,
  to_phone_e164 TEXT,
  body_final TEXT
) AS $$
DECLARE
  v_message_id UUID;
BEGIN
  FOR v_message_id IN
    SELECT m.id
    FROM messages m
    WHERE m.org_id = p_org_id
      AND m.status = 'queued'
      AND NOT (m.to_phone_e164 = ANY(p_optout_phones))
    ORDER BY m.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE messages
    SET 
      status = 'sending',
      device_id = p_device_id,
      sim_subscription_id = p_sim_subscription_id
    WHERE messages.id = v_message_id;
    
    RETURN QUERY
    SELECT 
      messages.id,
      messages.to_phone_e164,
      messages.body_final
    FROM messages
    WHERE messages.id = v_message_id;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEED DATA: PLANS
-- =============================================

INSERT INTO plans (id, name, price_xof, sms_quota_month, max_devices, rate_limit_per_min) VALUES
  ('basic', 'Basic', 5000, 1000, 1, 10),
  ('pro', 'Pro', 15000, 5000, 3, 30),
  ('enterprise', 'Enterprise', 50000, 20000, 10, 60)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- DONE! 
-- =============================================
-- Toutes les tables, RLS policies, fonctions et seed data sont créés
-- Vous pouvez maintenant utiliser l'app web !

