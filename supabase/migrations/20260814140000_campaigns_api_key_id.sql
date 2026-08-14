-- =============================================
-- Lier les campagnes creees via l'API publique a la clef API
-- qui les a generees. Permet d'annuler automatiquement les
-- campagnes en cours quand la clef est revoquee.
-- =============================================

ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_api_key_id
    ON campaigns(api_key_id)
    WHERE api_key_id IS NOT NULL;
