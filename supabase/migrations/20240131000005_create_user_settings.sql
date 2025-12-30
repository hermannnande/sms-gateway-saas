-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'fr',
  
  -- Message settings
  message_delay_seconds INTEGER DEFAULT 2 CHECK (message_delay_seconds >= 0 AND message_delay_seconds <= 120),
  email_notifications BOOLEAN DEFAULT false,
  notification_email TEXT,
  sleep_start_time TIME,
  sleep_end_time TIME,
  request_delivery_receipt BOOLEAN DEFAULT false,
  wait_for_network_confirmation BOOLEAN DEFAULT false,
  auto_retry_failed BOOLEAN DEFAULT false,
  
  -- USSD settings
  ussd_delay_seconds INTEGER DEFAULT 5 CHECK (ussd_delay_seconds >= 0 AND ussd_delay_seconds <= 60),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settings"
  ON user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Trigger for updated_at
CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();



