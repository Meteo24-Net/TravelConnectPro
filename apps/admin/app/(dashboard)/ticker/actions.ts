'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ActionResult { ok: boolean; error?: string }

async function getManagerProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) return null
  return { supabase, hotelId: profile.hotel_id as string, role: profile.role as string }
}

export async function updateTickerListAction(
  hotelId:  string,
  key:      'announcements' | 'events' | 'offers',
  items:    string[],
): Promise<ActionResult> {
  const ctx = await getManagerProfile()
  if (!ctx || ctx.hotelId !== hotelId) return { ok: false, error: 'Unauthorized' }

  const { data: existing } = await ctx.supabase
    .from('property_configs').select('ticker').eq('hotel_id', hotelId).single()

  const currentTicker = (existing?.ticker as Record<string, unknown>) ?? {}
  const updated = { ...currentTicker, [key]: items.filter(s => s.trim()) }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, ticker: updated }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/ticker')
  return { ok: true }
}

export async function updateSportsAction(
  hotelId: string,
  sports:  Record<string, boolean>,
): Promise<ActionResult> {
  const ctx = await getManagerProfile()
  if (!ctx || ctx.hotelId !== hotelId || ctx.role !== 'super_admin') {
    return { ok: false, error: 'SuperAdmin only' }
  }

  const { data: existing } = await ctx.supabase
    .from('property_configs').select('ticker').eq('hotel_id', hotelId).single()

  const currentTicker = (existing?.ticker as Record<string, unknown>) ?? {}
  const updated = { ...currentTicker, sports }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, ticker: updated }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/ticker')
  return { ok: true }
}
