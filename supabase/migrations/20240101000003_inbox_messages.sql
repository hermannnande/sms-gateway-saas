-- Table pour les messages reçus (réponses des clients)
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
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

-- Index pour les recherches
CREATE INDEX idx_inbox_org ON inbox_messages(org_id);
CREATE INDEX idx_inbox_device ON inbox_messages(device_id);
CREATE INDEX idx_inbox_phone ON inbox_messages(from_phone_e164);
CREATE INDEX idx_inbox_received ON inbox_messages(received_at DESC);
CREATE INDEX idx_inbox_read ON inbox_messages(read);

-- RLS policies
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's inbox messages"
  ON inbox_messages FOR SELECT
  USING (org_id = public.user_org_id());

CREATE POLICY "Users can insert their org's inbox messages"
  ON inbox_messages FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Users can update their org's inbox messages"
  ON inbox_messages FOR UPDATE
  USING (org_id = public.user_org_id());

CREATE POLICY "Users can delete their org's inbox messages"
  ON inbox_messages FOR DELETE
  USING (org_id = public.user_org_id());

-- Commentaire
COMMENT ON TABLE inbox_messages IS 'Messages SMS reçus par les appareils Gateway (réponses des clients)';

