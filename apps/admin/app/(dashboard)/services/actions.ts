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

// ── Request status ────────────────────────────────────────────────────────────

export async function updateRequestStatusAction(
  hotelId:   string,
  requestId: string,
  status:    'acknowledged' | 'in_progress' | 'completed' | 'cancelled',
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  const { error } = await ctx.supabase
    .from('service_requests')
    .update({ status })
    .eq('id', requestId)
    .eq('hotel_id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/services')
  return { ok: true }
}

// ── Service catalog ───────────────────────────────────────────────────────────

export async function addCatalogItemAction(
  hotelId: string,
  data: { service_id: string; name: string; emoji: string; priority: string; sla_minutes: number; channel_id: string }
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  if (!data.service_id.trim() || !data.name.trim()) return { ok: false, error: 'ID and name required' }

  const { error } = await ctx.supabase
    .from('service_catalog')
    .insert({ hotel_id: hotelId, enabled: true, ...data })

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Service ID "${data.service_id}" already exists` }
    return { ok: false, error: error.message }
  }
  revalidatePath('/services')
  return { ok: true }
}

export async function updateCatalogItemAction(
  hotelId:   string,
  id:        string,
  data:      Partial<{ name: string; emoji: string; priority: string; sla_minutes: number; channel_id: string; enabled: boolean }>
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  const { error } = await ctx.supabase
    .from('service_catalog')
    .update(data)
    .eq('id', id)
    .eq('hotel_id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/services')
  return { ok: true }
}

export async function deleteCatalogItemAction(hotelId: string, id: string): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx || ctx.role !== 'super_admin') return { ok: false, error: 'SuperAdmin only' }

  const { error } = await ctx.supabase
    .from('service_catalog').delete().eq('id', id).eq('hotel_id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/services')
  return { ok: true }
}

// ── Channels ──────────────────────────────────────────────────────────────────

export async function addChannelAction(
  hotelId: string,
  data: { channel_id: string; name: string; telegram_chat_id?: string; manager_name?: string }
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx || ctx.role !== 'super_admin') return { ok: false, error: 'SuperAdmin only' }

  if (!data.channel_id.trim() || !data.name.trim()) return { ok: false, error: 'ID and name required' }

  const { error } = await ctx.supabase
    .from('service_channels')
    .insert({ hotel_id: hotelId, enabled: true, ...data })

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Channel ID "${data.channel_id}" already exists` }
    return { ok: false, error: error.message }
  }
  revalidatePath('/services')
  return { ok: true }
}

export async function updateChannelAction(
  hotelId: string,
  id:      string,
  data:    Partial<{ name: string; telegram_chat_id: string; manager_name: string; enabled: boolean }>
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx || ctx.role !== 'super_admin') return { ok: false, error: 'SuperAdmin only' }

  const { error } = await ctx.supabase
    .from('service_channels').update(data).eq('id', id).eq('hotel_id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/services')
  return { ok: true }
}
