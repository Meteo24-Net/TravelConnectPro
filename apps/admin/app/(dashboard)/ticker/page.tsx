import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import TickerClient     from './TickerClient'

const DEFAULT_SPORTS = {
  football: false, basketball: false, tennis: false,
  formula1: false, rugby: false, cricket: false, volleyball: false, mma: false,
}

export default async function TickerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const { data: config } = await supabase
    .from('property_configs').select('ticker').eq('hotel_id', profile.hotel_id).single()

  const ticker = (config?.ticker as Record<string, unknown>) ?? {}

  return (
    <TickerClient
      hotelId={profile.hotel_id}
      role={profile.role}
      announcements={(ticker.announcements as string[]) ?? []}
      events={(ticker.events as string[]) ?? []}
      offers={(ticker.offers as string[]) ?? []}
      sports={{ ...DEFAULT_SPORTS, ...((ticker.sports as Record<string, boolean>) ?? {}) }}
    />
  )
}
