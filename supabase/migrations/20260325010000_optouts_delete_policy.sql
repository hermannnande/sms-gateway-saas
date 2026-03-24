-- Allow users to delete optouts from their own organization
CREATE POLICY "Users can delete their org optouts"
ON optouts FOR DELETE
USING (
  org_id IN (SELECT public.my_org_ids())
);
