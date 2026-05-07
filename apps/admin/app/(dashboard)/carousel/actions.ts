'use server'

import { createClient } from '@/lib/supabase/server'

interface SlideItem {
  type:     string
  id:       string
  label:    string
  duration: number
  fixed?:   boolean
}

interface ActionResult {
  ok:     boolean
  error?: string
}

export async function updateCarouselAction(
  hotelId:  string,
  sequence: SlideItem[],
): Promise<ActionResult> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  // Verify user is super_admin for this hotel
  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('role, hotel_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.hotel_id !== hotelId || profile.role !== 'super_admin') {
    return { ok: false, error: 'Insufficient permissions' }
  }

  // Strip the 'fixed' flag before storing — it's a UI concern, not data
  const cleanSequence = sequence.map(({ fixed: _fixed, ...rest }) => rest)

  const { error } = await supabase
    .from('property_configs')
    .upsert(
      { hotel_id: hotelId, carousel: { sequence: cleanSequence } },
      { onConflict: 'hotel_id' }
    )

  if (error) {
    console.error('[TCP carousel] Update error:', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function updateGamesAction(
  hotelId:      string,
  gamesEnabled: Record<string, boolean>,
): Promise<ActionResult> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('role, hotel_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.hotel_id !== hotelId) {
    return { ok: false, error: 'Insufficient permissions' }
  }

  const { error } = await supabase
    .from('property_configs')
    .upsert(
      { hotel_id: hotelId, games_enabled: gamesEnabled },
      { onConflict: 'hotel_id' }
    )

  if (error) {
    console.error('[TCP games] Update error:', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
