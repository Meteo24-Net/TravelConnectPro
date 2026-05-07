'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface WelcomeConfig {
  timing_sec:      number
  highlight_offer: string
  greetings:       Record<string, string>
}

interface ActionResult { ok: boolean; error?: string }

export async function updateWelcomeAction(
  hotelId: string,
  welcome: WelcomeConfig,
): Promise<ActionResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()

  if (!profile || profile.hotel_id !== hotelId) return { ok: false, error: 'Unauthorized' }

  if (welcome.timing_sec < 3 || welcome.timing_sec > 60) {
    return { ok: false, error: 'Duration must be between 3 and 60 seconds' }
  }

  const { error } = await supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, welcome }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/welcome')
  return { ok: true }
}
