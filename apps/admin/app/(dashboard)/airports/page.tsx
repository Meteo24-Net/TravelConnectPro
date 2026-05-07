import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import AirportsClient    from './AirportsClient'

export default async function AirportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const { data: airports } = await supabase
    .from('property_airports')
    .select('id, iata_code, airport_name, drive_time_minutes, display_order, enabled')
    .eq('hotel_id', profile.hotel_id)
    .order('display_order')

  return (
    <AirportsClient
      initialAirports={airports ?? []}
      isSuper={profile.role === 'super_admin'}
    />
  )
}
