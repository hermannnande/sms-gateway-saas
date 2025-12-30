-- Seed data for development
-- This file runs after migrations

-- Insert default plans
INSERT INTO plans (id, name, price_xof, sms_quota_month, max_devices, rate_limit_per_min) VALUES
  ('basic', 'Basic', 500000, 1000, 1, 10),
  ('pro', 'Pro', 1500000, 5000, 3, 30),
  ('enterprise', 'Enterprise', 5000000, 20000, 10, 60)
ON CONFLICT (id) DO NOTHING;

-- Note: User accounts will be created via Supabase Auth
-- Organizations and subscriptions will be created via the app




