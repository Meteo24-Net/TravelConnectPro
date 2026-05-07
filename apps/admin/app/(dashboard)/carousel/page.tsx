import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import CarouselClient   from './CarouselClient'

const DEFAULT_SEQUENCE = [
  { type: 'welcome',         id: 'welcome',         label: 'Welcome',            duration: 8,  fixed: true },
  { type: 'weather',         id: 'weather',         label: 'Weather & Forecast', duration: 8,  fixed: true },
  { type: 'exchange',        id: 'exchange',        label: 'Exchange Rates',     duration: 7,  fixed: true },
  { type: 'wifi',            id: 'wifi',            label: 'Guest Wi-Fi',        duration: 6,  fixed: true },
  { type: 'service_request', id: 'service_request', label: 'Service Request',    duration: 7,  fixed: true },
]

export default async function CarouselPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const [configRes, airportsRes] = await Promise.all([
    supabase
      .from('property_configs')
      .select('carousel, games_enabled')
      .eq('hotel_id', profile.hotel_id)
      .single(),

    supabase
      .from('property_airports')
      .select('iata_code, airport_name')
      .eq('hotel_id', profile.hotel_id)
      .eq('enabled', true)
      .order('display_order'),
  ])

  const storedSeq    = (configRes.data?.carousel as { sequence?: { type: string; id: string; label: string; duration: number }[] })?.sequence ?? []
  const variableItems = storedSeq.filter((s: { type: string }) =>
    !['welcome', 'weather', 'exchange', 'wifi', 'service_request'].includes(s.type)
  )
  const fullSequence  = [...DEFAULT_SEQUENCE, ...variableItems]
  const gamesEnabled  = (configRes.data?.games_enabled as Record<string, boolean>) ?? {}
  const airports      = airportsRes.data ?? []

  return (
    <CarouselClient
      hotelId={profile.hotel_id}
      role={profile.role}
      initialSeq={fullSequence}
      initialGames={gamesEnabled}
      airports={airports}
    />
  )
}
