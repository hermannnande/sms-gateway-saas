-- Add DELETE policy for devices table
-- This was missing in the initial RLS setup, preventing users from deleting devices

-- Drop the comment-only policy if it exists
DROP POLICY IF EXISTS "Users can delete their org devices" ON devices;

-- Create DELETE policy for devices
CREATE POLICY "Users can delete their org devices"
ON devices FOR DELETE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

-- Also add INSERT and UPDATE policies for devices (currently only service role can do this)
-- This allows users to manage their devices directly from the web app

DROP POLICY IF EXISTS "Users can insert their org devices" ON devices;
CREATE POLICY "Users can insert their org devices"
ON devices FOR INSERT
WITH CHECK (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their org devices" ON devices;
CREATE POLICY "Users can update their org devices"
ON devices FOR UPDATE
USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);





