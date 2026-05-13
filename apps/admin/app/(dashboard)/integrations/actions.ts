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

export async function triggerRefreshAction(hotelId: string): Promise<ActionResult> {
  const ctx = await getSuperAdmin(hotelId)
  if (!ctx) return { ok: false, error: 'SuperAdmin only' }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/currency-refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    })
    if (!res.ok) throw new Error(await res.text())
    revalidatePath('/integrations')
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function saveIntegrationConfigAction(
  hotelId: string,
  config: any,
): Promise<ActionResult> {
  const ctx = await getSuperAdmin(hotelId)
  if (!ctx) return { ok: false, error: 'SuperAdmin only' }

  const { error } = await ctx.supabase
    .from('hotels')
    .update({ integration_config: config })
    .eq('id', hotelId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/integrations')
  return { ok: true }
}
