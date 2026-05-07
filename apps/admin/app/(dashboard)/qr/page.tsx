import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import QrClient         from './QrClient'

export default async function QrPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const today = new Date().toISOString().slice(0, 10)

  const [assetsRes, configRes, pinRes, scansRes] = await Promise.all([
    supabase.from('qr_assets')
      .select('id, qr_id, label, tier, category, destination_url, enabled, reward_title, reward_value_gel, fulfillment_mode')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: false }),
    supabase.from('property_configs')
      .select('verification').eq('hotel_id', profile.hotel_id).single(),
    supabase.from('lobby_pins')
      .select('pin_value, expires_at')
      .eq('hotel_id', profile.hotel_id)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('scans')
      .select('asset_id')
      .eq('hotel_id', profile.hotel_id)
      .gte('scanned_at', `${today}T00:00:00Z`),
  ])

  // Count scans per asset
  const scanCounts: Record<string, number> = {}
  for (const s of (scansRes.data ?? [])) {
    scanCounts[s.asset_id] = (scanCounts[s.asset_id] ?? 0) + 1
  }

  const assets = (assetsRes.data ?? []).map(a => ({
    ...a, scans_today: scanCounts[a.id] ?? 0,
  }))

  const verification = (configRes.data?.verification as Record<string, number>) ?? {}

  return (
    <QrClient
      hotelId={profile.hotel_id}
      isSuper={profile.role === 'super_admin'}
      qrAssets={assets}
      geofenceRadius={verification.geofence_radius_m ?? 200}
      pinRotationMin={verification.lobby_pin_rotation_min ?? 5}
      currentPin={pinRes?.pin_value ?? null}
      pinExpiresAt={pinRes?.expires_at ?? null}
    />
  )
}
