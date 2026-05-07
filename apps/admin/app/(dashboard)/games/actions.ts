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

export async function updateGamesEnabledAction(
  hotelId:      string,
  gamesEnabled: Record<string, boolean>,
): Promise<ActionResult> {
  const ctx = await getSuperAdmin(hotelId)
  if (!ctx) return { ok: false, error: 'SuperAdmin only' }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, games_enabled: gamesEnabled }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/games')
  return { ok: true }
}

export async function updateSlotConfigAction(
  hotelId:    string,
  slotConfig: Record<string, unknown>,
): Promise<ActionResult> {
  const ctx = await getSuperAdmin(hotelId)
  if (!ctx) return { ok: false, error: 'SuperAdmin only' }

  // Validate critical ranges — server decides, client never circumvents
  const wr = slotConfig.win_rates as Record<string, number> | undefined
  if (wr) {
    if (wr.jackpot_pct < 0 || wr.jackpot_pct > 20) return { ok: false, error: 'Jackpot % must be 0–20' }
    if (wr.free_spins_pct < 0 || wr.free_spins_pct > 50) return { ok: false, error: 'Free spins % must be 0–50' }
  }

  const caps = slotConfig.daily_caps as Record<string, number> | undefined
  if (caps && caps.jackpot_wins < 0) return { ok: false, error: 'Daily jackpot cap must be ≥ 0' }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, slot_config: slotConfig }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/games')
  return { ok: true }
}
