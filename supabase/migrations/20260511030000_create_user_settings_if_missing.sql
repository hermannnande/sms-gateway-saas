-- Create the user_settings table. The original migration
-- (20240131000005_create_user_settings.sql) was never actually applied to
-- production -> the profile page errored with "Could not find the table
-- 'public.user_settings' in the schema cache".
--
-- This migration is self-contained (no dependency on update_updated_at()) and
-- idempotent (everything uses IF NOT EXISTS / OR REPLACE).
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'fr',
  message_delay_seconds INTEGER DEFAULT 2 CHECK (message_delay_seconds >= 0 AND message_delay_seconds <= 120),
  email_notifications BOOLEAN DEFAULT false,
  notification_email TEXT,
  sleep_start_time TIME,
  sleep_end_time TIME,
  request_delivery_receipt BOOLEAN DEFAULT false,
  wait_for_network_confirmation BOOLEAN DEFAULT false,
  auto_retry_failed BOOLEAN DEFAULT false,
  ussd_delay_seconds INTEGER DEFAULT 5 CHECK (ussd_delay_seconds >= 0 AND ussd_delay_seconds <= 60),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
