import { createClient }         from '@/lib/supabase/server'
import { redirect }             from 'next/navigation'
import IntegrationsClient       from './IntegrationsClient'

const DEFAULT_MAP_CONFIG = {
  primary_provider:  'maplibre_osm',
  fallback_provider: 'maplibre_osm',
  show_traffic:      true,
  default_zoom:      13,
}

export default async function IntegrationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  const { data: hotel } = await supabase
    .from('hotels')
    .select('integration_config')
    .eq('id', profile.hotel_id)
    .single()

  const { data: cacheStatus } = await supabase
    .from('currency_cache')
    .select('source, date, fetched_at, last_success_at')
    .eq('hotel_id', profile.hotel_id)
    .single()

  const config = (hotel?.integration_config as any) ?? {}

  return (
    <IntegrationsClient
      hotelId={profile.hotel_id}
      initialConfig={config}
    />
  )
}
