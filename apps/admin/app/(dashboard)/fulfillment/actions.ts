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
  return { supabase, userId: user.id, hotelId, role: p.role as string }
}

export async function approveRewardAction(
  hotelId:       string,
  approvalId:    string,
  notes?:        string,
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  const { error } = await ctx.supabase
    .from('fulfillment_approvals')
    .update({
      status:         'approved',
      decided_by:     ctx.userId,
      decided_at:     new Date().toISOString(),
      decision_notes: notes ?? null,
    })
    .eq('id', approvalId)
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')

  if (error) return { ok: false, error: error.message }
  revalidatePath('/fulfillment')
  return { ok: true }
}

export async function rejectRewardAction(
  hotelId:    string,
  approvalId: string,
  notes?:     string,
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  const { error } = await ctx.supabase
    .from('fulfillment_approvals')
    .update({
      status:         'rejected',
      decided_by:     ctx.userId,
      decided_at:     new Date().toISOString(),
      decision_notes: notes ?? null,
    })
    .eq('id', approvalId)
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')

  if (error) return { ok: false, error: error.message }
  revalidatePath('/fulfillment')
  return { ok: true }
}

export async function updateFulfillmentConfigAction(
  hotelId: string,
  config:  { auto_threshold_gel: number; telegram_enabled: boolean },
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx || ctx.role !== 'super_admin') return { ok: false, error: 'SuperAdmin only' }

  if (config.auto_threshold_gel < 0) return { ok: false, error: 'Threshold must be ≥ 0' }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, fulfillment: config }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/fulfillment')
  return { ok: true }
}
