'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ActionResult { ok: boolean; error?: string }

async function getSuperAdmin(hotelId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!p || p.hotel_id !== hotelId || p.role !== 'super_admin') return null
  return { supabase, hotelId }
}

export async function saveIntegrationKeysAction(
  hotelId: string,
  keys: Record<string, string>,
): Promise<ActionResult> {
  const ctx = await getSuperAdmin(hotelId)
  if (!ctx) return { ok: false, error: 'SuperAdmin only' }

  // Sanitise — only allow known key names, strip whitespace
  const ALLOWED_KEYS = [
    'mapbox_token', 'tomtom_key', 'sports_api_key',
    'aviation_key', 'openweather_key', 'exchange_rate_key',
  ]
  const sanitised: Record<string, string> = {}
  for (const k of ALLOWED_KEYS) {
    if (keys[k] !== undefined) sanitised[k] = keys[k].trim()
  }

  const { error } = await ctx.supabase
    .from('hotels')
    .update({ integration_keys: sanitised })
    .eq('id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/integrations')
  return { ok: true }
}

export async function saveMapConfigAction(
  hotelId: string,
  mapConfig: {
    primary_provider:  string
    fallback_provider: string
    show_traffic:      boolean
    default_zoom:      number
  },
): Promise<ActionResult> {
  const ctx = await getSuperAdmin(hotelId)
  if (!ctx) return { ok: false, error: 'SuperAdmin only' }

  if (mapConfig.default_zoom < 8 || mapConfig.default_zoom > 20) {
    return { ok: false, error: 'Zoom must be between 8 and 20' }
  }

  // Fetch current map_config to preserve center coordinates
  const { data: hotel } = await ctx.supabase
    .from('hotels')
    .select('map_config, location')
    .eq('id', hotelId)
    .single()

  const existingConfig = (hotel?.map_config as Record<string, unknown>) ?? {}

  const { error } = await ctx.supabase
    .from('hotels')
    .update({
      map_config: {
        ...existingConfig,
        ...mapConfig,
      }
    })
    .eq('id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/integrations')
  return { ok: true }
}
