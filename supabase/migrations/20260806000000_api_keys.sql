-- =============================================
-- API KEYS - Clefs API publiques par organisation
-- Date: 2026-08-06
-- Permet a chaque utilisateur de generer des clefs API
-- pour connecter ses apps/SaaS (e-commerce, relance client, etc.)
-- et envoyer des SMS via la passerelle SMSenvoie.
--
-- SECURITE:
-- - La clef complete n'est JAMAIS stockee en clair.
-- - Seul le hash SHA-256 est conserve (comme les device tokens).
-- - key_prefix sert uniquement a identifier la clef dans le dashboard.
-- =============================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Prefixe visible (ex: sk_live_a1b2c3d4) pour identifier la clef
    key_prefix TEXT NOT NULL,
    -- Hash SHA-256 de la clef complete (jamais la clef en clair)
    key_hash TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Les membres de l'org peuvent voir leurs clefs (sans le hash complet en clair)
CREATE POLICY api_keys_select ON api_keys
    FOR SELECT
    USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Les membres peuvent creer des clefs pour leur org
CREATE POLICY api_keys_insert ON api_keys
    FOR INSERT
    WITH CHECK (
        org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
        AND user_id = auth.uid()
    );

-- Les membres peuvent revoquer (update) leurs clefs
CREATE POLICY api_keys_update ON api_keys
    FOR UPDATE
    USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Les membres peuvent supprimer leurs clefs
CREATE POLICY api_keys_delete ON api_keys
    FOR DELETE
    USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
