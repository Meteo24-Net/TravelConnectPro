'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ActionResult { ok: boolean; error?: string }

async function getProfile(hotelId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!p || p.hotel_id !== hotelId) return null
  return { supabase, hotelId, role: p.role as string }
}

export async function addQrAction(
  hotelId: string,
  data: {
    qr_id:           string
    label:           string
    tier:            'open' | 'verified'
    category:        string
    destination_url: string
    reward_title?:   string
    reward_value_gel?: number
    fulfillment_mode?: string
  }
): Promise<ActionResult & { id?: string }> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  if (!data.label.trim()) return { ok: false, error: 'Label is required' }
  if (!data.destination_url.startsWith('http')) return { ok: false, error: 'URL must start with http' }
  if (!/^[a-z0-9_-]+$/.test(data.qr_id)) return { ok: false, error: 'QR ID must be lowercase letters, numbers, hyphens only' }

  const { data: row, error } = await ctx.supabase
    .from('qr_assets')
    .insert({ hotel_id: hotelId, enabled: true, ...data })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: `QR ID "${data.qr_id}" already exists for this hotel` }
    return { ok: false, error: error.message }
  }

  revalidatePath('/qr')
  return { ok: true, id: row.id }
}

export async function updateQrAction(
  hotelId: string,
  id:      string,
  data:    Partial<{
    label:           string
    destination_url: string
    category:        string
    enabled:         boolean
    reward_title:    string
    reward_value_gel: number
    fulfillment_mode: string
  }>
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  if (data.destination_url && !data.destination_url.startsWith('http')) {
    return { ok: false, error: 'URL must start with http' }
  }

  const { error } = await ctx.supabase
    .from('qr_assets')
    .update(data)
    .eq('id', id)
    .eq('hotel_id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/qr')
  return { ok: true }
}

export async function deleteQrAction(hotelId: string, id: string): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  const { error } = await ctx.supabase
    .from('qr_assets').delete().eq('id', id).eq('hotel_id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/qr')
  return { ok: true }
}

export async function updateVerificationAction(
  hotelId: string,
  verification: { geofence_radius_m: number; lobby_pin_rotation_min: number }
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx || ctx.role !== 'super_admin') return { ok: false, error: 'SuperAdmin only' }

  if (verification.geofence_radius_m < 50 || verification.geofence_radius_m > 2000) {
    return { ok: false, error: 'Geofence radius must be 50–2000m' }
  }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, verification }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/qr')
  return { ok: true }
}
