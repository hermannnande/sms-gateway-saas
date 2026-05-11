-- Auto-update updated_at on every UPDATE of user_settings.
-- Reuses the set_timestamp() function created in 20250201000006.
DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE PROCEDURE set_timestamp();
