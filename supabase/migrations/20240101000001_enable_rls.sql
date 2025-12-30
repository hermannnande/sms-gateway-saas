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

-- Users can view their own organizations
CREATE POLICY "Users can view their organizations"
ON organizations FOR SELECT
USING (
  id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Users can insert organizations (for onboarding)
CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
WITH CHECK (true);

-- Admins can update their organizations
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

-- Users can view members of their org
CREATE POLICY "Users can view their org members"
ON org_members FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Users can insert themselves as first admin (onboarding)
CREATE POLICY "Users can add themselves as org admin"
ON org_members FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- Admins can manage org members
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
-- RLS POLICIES: PLANS (read-only for all authenticated users)
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

-- Only service role can insert/update subscriptions (via Edge Functions)

-- =============================================
-- RLS POLICIES: PAYMENTS
-- =============================================

CREATE POLICY "Users can view their org payments"
ON payments FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Only service role can insert/update payments (via Edge Functions)

-- =============================================
-- RLS POLICIES: DEVICES
-- =============================================

CREATE POLICY "Users can view their org devices"
ON devices FOR SELECT
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Only service role can manage devices (via Edge Functions for pairing)

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

-- Only service role can update messages (via Edge Functions for device status updates)




