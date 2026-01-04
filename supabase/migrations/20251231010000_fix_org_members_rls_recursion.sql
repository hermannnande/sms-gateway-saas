-- Fix: infinite recursion in RLS policies on org_members
-- Symptom: "infinite recursion detected in policy for relation \"org_members\""
--
-- Apply this in Supabase SQL editor (Cloud), then re-test:
--   https://<your-vercel-domain>/api/debug/devices

-- 1) Helper functions (SECURITY DEFINER) to avoid self-referencing org_members policies
create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.org_members
  where user_id = auth.uid();
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members
    where user_id = auth.uid()
      and org_id = p_org_id
      and role = 'ORG_ADMIN'
  );
$$;

grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- 2) org_members policies (drop recursive ones, recreate safe ones)
drop policy if exists "Users can view their org members" on public.org_members;
drop policy if exists "Org admins can manage members" on public.org_members;

create policy "Users can view their org members"
on public.org_members for select
using (org_id in (select public.my_org_ids()));

-- Keep existing policy: "Users can add themselves as org admin"
-- but ensure admins can also add other members
drop policy if exists "Org admins can add members" on public.org_members;
create policy "Org admins can add members"
on public.org_members for insert
with check (public.is_org_admin(org_id));

drop policy if exists "Org admins can update members" on public.org_members;
create policy "Org admins can update members"
on public.org_members for update
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Org admins can delete members" on public.org_members;
create policy "Org admins can delete members"
on public.org_members for delete
using (public.is_org_admin(org_id));

-- 3) (Optional but recommended) Update other policies to use public.my_org_ids()
-- This is safe and avoids extra recursion/overhead.

drop policy if exists "Users can view their organizations" on public.organizations;
create policy "Users can view their organizations"
on public.organizations for select
using (id in (select public.my_org_ids()));

drop policy if exists "Users can view their org devices" on public.devices;
create policy "Users can view their org devices"
on public.devices for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org contacts" on public.contacts;
create policy "Users can view their org contacts"
on public.contacts for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org templates" on public.templates;
create policy "Users can view their org templates"
on public.templates for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org optouts" on public.optouts;
create policy "Users can view their org optouts"
on public.optouts for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org campaigns" on public.campaigns;
create policy "Users can view their org campaigns"
on public.campaigns for select
using (org_id in (select public.my_org_ids()));

drop policy if exists "Users can view their org messages" on public.messages;
create policy "Users can view their org messages"
on public.messages for select
using (org_id in (select public.my_org_ids()));






