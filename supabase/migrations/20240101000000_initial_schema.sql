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
    price_xof INTEGER NOT NULL, -- Prix en francs XOF
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
    amount_minor INTEGER NOT NULL, -- Montant en plus petite unité (centimes si applicable)
    currency TEXT NOT NULL DEFAULT 'XOF',
    payfonte_reference TEXT, -- Référence Payfonte
    external_reference TEXT UNIQUE NOT NULL, -- Notre référence interne
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
    token_hash TEXT NOT NULL UNIQUE, -- Hash du token device
    selected_subscription_id TEXT, -- SIM choisie (subscriptionId Android)
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
    phone_e164 TEXT NOT NULL, -- Format E.164: +225...
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
-- HELPER FUNCTIONS
-- =============================================

-- Function to get user's org_id
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if user is org admin
CREATE OR REPLACE FUNCTION auth.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members 
    WHERE user_id = auth.uid() 
    AND role = 'ORG_ADMIN'
  );
$$ LANGUAGE SQL SECURITY DEFINER;




