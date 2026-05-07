import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import FulfillmentClient  from './FulfillmentClient'

export default async function FulfillmentPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const today = new Date().toISOString().slice(0, 10)

  const [pendingRes, qrRes, configRes, claimedRes] = await Promise.all([
    supabase.from('fulfillment_approvals')
      .select('id, reward_title, reward_value_gel, created_at, qr_asset_id')
      .eq('hotel_id', profile.hotel_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),

    supabase.from('qr_assets')
      .select('id, label, reward_title, reward_value_gel, fulfillment_mode, daily_cap')
      .eq('hotel_id', profile.hotel_id)
      .eq('tier', 'verified')
      .eq('enabled', true),

    supabase.from('property_configs')
      .select('fulfillment').eq('hotel_id', profile.hotel_id).single(),

    supabase.from('fulfillment_approvals')
      .select('qr_asset_id')
      .eq('hotel_id', profile.hotel_id)
      .eq('status', 'approved')
      .gte('created_at', `${today}T00:00:00Z`),
  ])

  // Count claimed today per QR
  const claimedCounts: Record<string, number> = {}
  for (const row of (claimedRes.data ?? [])) {
    if (row.qr_asset_id) claimedCounts[row.qr_asset_id] = (claimedCounts[row.qr_asset_id] ?? 0) + 1
  }

  const verifiedQrs = (qrRes.data ?? []).map(q => ({
    ...q,
    daily_cap:     q.daily_cap ?? 0,
    claimed_today: claimedCounts[q.id] ?? 0,
  }))

  const fulfillment = (configRes.data?.fulfillment as Record<string, unknown>) ?? {}

  return (
    <FulfillmentClient
      hotelId={profile.hotel_id}
      isSuper={profile.role === 'super_admin'}
      pendingApprovals={pendingRes.data ?? []}
      verifiedQrs={verifiedQrs}
      autoThresholdGel={(fulfillment.auto_threshold_gel as number) ?? 30}
      telegramEnabled={(fulfillment.telegram_enabled as boolean) ?? false}
    />
  )
}
