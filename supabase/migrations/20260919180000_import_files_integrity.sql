-- Bind every archived file to its own tenant's path and campaign.
drop policy if exists "Users can insert their org import files" on public.campaign_import_files;
create policy "Users can insert their org import files"
on public.campaign_import_files for insert to authenticated
with check (
  org_id in (select public.my_org_ids())
  and split_part(storage_path, '/', 1) = org_id::text
  and uploaded_by = auth.uid()
  and size_bytes between 1 and 26214400
  and contact_count >= 0 and invalid_count >= 0
  and (campaign_id is null or exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and c.org_id = campaign_import_files.org_id
  ))
);
-- Metadata is immutable after upload; deletion remains available to members.
drop policy if exists "Users can update their org import files" on public.campaign_import_files;
revoke all on function public.my_org_ids_text() from public;
grant execute on function public.my_org_ids_text() to authenticated;
