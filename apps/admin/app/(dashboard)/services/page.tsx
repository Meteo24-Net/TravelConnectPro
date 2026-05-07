import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import ServicesClient    from './ServicesClient'

export default async function ServicesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const [reqRes, catRes, chRes] = await Promise.all([
    supabase.from('service_requests')
      .select('id, service_id, room_number, status, priority, notes, created_at, device_hash')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('service_catalog')
      .select('id, service_id, name, emoji, priority, sla_minutes, channel_id, enabled')
      .eq('hotel_id', profile.hotel_id)
      .order('name'),
    supabase.from('service_channels')
      .select('id, channel_id, name, telegram_chat_id, manager_name, enabled')
      .eq('hotel_id', profile.hotel_id)
      .order('name'),
  ])

  return (
    <ServicesClient
      hotelId={profile.hotel_id}
      isSuper={profile.role === 'super_admin'}
      requests={reqRes.data ?? []}
      catalog={catRes.data ?? []}
      channels={chRes.data ?? []}
    />
  )
}
