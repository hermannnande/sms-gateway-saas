import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to create a test device for the current user
 * This helps verify that the RLS fix works correctly
 */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  try {
    // 1. Get user's org(s)
    const { data: orgMembers, error: orgError } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (orgError) {
      return NextResponse.json({ ok: false, step: 'org_members', error: orgError.message }, { status: 500 })
    }

    let orgId = orgMembers?.[0]?.org_id

    // 2. If no org, create one (auto-heal)
    if (!orgId) {
      const newOrgId = crypto.randomUUID()
      const { error: orgInsertError } = await supabase
        .from('organizations')
        .insert({ id: newOrgId, name: 'Mon organisation' })

      if (orgInsertError) {
        return NextResponse.json(
          { ok: false, step: 'create_org', error: orgInsertError.message },
          { status: 500 },
        )
      }

      const { error: memberInsertError } = await supabase
        .from('org_members')
        .insert({ org_id: newOrgId, user_id: user.id, role: 'ORG_ADMIN' })

      if (memberInsertError) {
        return NextResponse.json(
          { ok: false, step: 'create_org_member', error: memberInsertError.message },
          { status: 500 },
        )
      }

      orgId = newOrgId
    }

    // 3. Check if user already has devices
    const { data: existingDevices } = await supabase
      .from('devices')
      .select('id, name')
      .eq('org_id', orgId)

    if (existingDevices && existingDevices.length > 0) {
      return NextResponse.json({
        ok: true,
        message: 'User already has devices',
        deviceCount: existingDevices.length,
        devices: existingDevices,
      })
    }

    // 4. Create a test device with a dummy token hash
    const testDeviceId = crypto.randomUUID()
    const testTokenHash = 'test_' + Math.random().toString(36).substring(2, 15)

    const { data: newDevice, error: deviceError } = await supabase
      .from('devices')
      .insert({
        id: testDeviceId,
        org_id: orgId,
        name: 'Test Device (Debug)',
        token_hash: testTokenHash,
        status: 'offline',
      })
      .select()
      .single()

    if (deviceError) {
      return NextResponse.json({ ok: false, step: 'create_device', error: deviceError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Test device created successfully',
      device: newDevice,
      orgId,
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

