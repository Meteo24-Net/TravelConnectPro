'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ActionResult {
  ok:     boolean
  error?: string
}

async function getSuperAdminHotel() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') return null
  return { supabase, hotelId: profile.hotel_id as string }
}

export async function addAirportAction(data: {
  iata_code:          string
  airport_name:       string
  drive_time_minutes: number
  display_order:      number
}): Promise<ActionResult> {
  const ctx = await getSuperAdminHotel()
  if (!ctx) return { ok: false, error: 'Insufficient permissions' }

  const iata = data.iata_code.toUpperCase().trim()
  if (!/^[A-Z]{3}$/.test(iata)) return { ok: false, error: 'IATA code must be exactly 3 letters' }
  if (!data.airport_name.trim()) return { ok: false, error: 'Airport name is required' }

  const { error } = await ctx.supabase
    .from('property_airports')
    .insert({ ...data, iata_code: iata, hotel_id: ctx.hotelId })

  if (error) {
    if (error.code === '23505') return { ok: false, error: `${iata} is already added` }
    return { ok: false, error: error.message }
  }

  revalidatePath('/airports')
  revalidatePath('/carousel')
  return { ok: true }
}

export async function updateAirportAction(
  id:   string,
  data: Partial<{ airport_name: string; drive_time_minutes: number; enabled: boolean; display_order: number }>
): Promise<ActionResult> {
  const ctx = await getSuperAdminHotel()
  if (!ctx) return { ok: false, error: 'Insufficient permissions' }

  const { error } = await ctx.supabase
    .from('property_airports')
    .update(data)
    .eq('id', id)
    .eq('hotel_id', ctx.hotelId)   // RLS safety belt

  if (error) return { ok: false, error: error.message }

  revalidatePath('/airports')
  revalidatePath('/carousel')
  return { ok: true }
}

export async function deleteAirportAction(id: string): Promise<ActionResult> {
  const ctx = await getSuperAdminHotel()
  if (!ctx) return { ok: false, error: 'Insufficient permissions' }

  const { error } = await ctx.supabase
    .from('property_airports')
    .delete()
    .eq('id', id)
    .eq('hotel_id', ctx.hotelId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/airports')
  revalidatePath('/carousel')
  return { ok: true }
}
