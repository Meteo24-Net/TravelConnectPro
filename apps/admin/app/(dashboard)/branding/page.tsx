import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import BrandingClient    from './BrandingClient'

const DEFAULT_THEME = {
  logo:   { url: null, height: 48, filter: 'none' as const },
  colors: { primary: '#009FE3', accent_gold: '#c9a84c', accent_blue: '#009FE3', background: '#0f0f1e' },
  fonts:  { heading: 'Playfair Display', body: 'Inter', pairing: 'classic' },
}

export default async function BrandingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  const { data: hotel } = await supabase
    .from('hotels')
    .select('brand_name, theme_config')
    .eq('id', profile.hotel_id)
    .single()

  // Merge stored theme with defaults (handles partial/empty theme_config)
  const stored = (hotel?.theme_config ?? {}) as Record<string, unknown>
  const theme  = {
    logo:   { ...DEFAULT_THEME.logo,   ...((stored.logo   as object) ?? {}) },
    colors: { ...DEFAULT_THEME.colors, ...((stored.colors as object) ?? {}) },
    fonts:  { ...DEFAULT_THEME.fonts,  ...((stored.fonts  as object) ?? {}) },
  }

  return (
    <BrandingClient
      hotelId={profile.hotel_id}
      hotelName={hotel?.brand_name ?? 'Hotel'}
      theme={theme}
    />
  )
}
