'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ThemeConfig {
  logo: {
    url:    string | null
    height: number
    filter: 'none' | 'invert' | 'brightness'
  }
  colors: {
    primary:     string
    accent_gold: string
    accent_blue: string
    background:  string
  }
  fonts: {
    heading: string
    body:    string
    pairing: string
  }
}

interface ActionResult {
  ok:     boolean
  error?: string
}

export async function updateBrandingAction(
  hotelId:     string,
  themeConfig: ThemeConfig,
): Promise<ActionResult> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('role, hotel_id')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.hotel_id !== hotelId || profile.role !== 'super_admin') {
    return { ok: false, error: 'SuperAdmin only' }
  }

  const { error } = await supabase
    .from('hotels')
    .update({ theme_config: themeConfig })
    .eq('id', hotelId)

  if (error) {
    console.error('[TCP branding] Update error:', error)
    return { ok: false, error: error.message }
  }

  revalidatePath('/branding')
  revalidatePath('/dashboard')
  return { ok: true }
}
