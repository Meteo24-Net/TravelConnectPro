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

export async function sendMessageAction(
  hotelId:  string,
  subject:  string,
  body:     string,
  category: string,
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  if (!subject.trim()) return { ok: false, error: 'Subject is required' }
  if (!body.trim())    return { ok: false, error: 'Message body is required' }

  const { error } = await ctx.supabase
    .from('admin_messages')
    .insert({
      hotel_id:     hotelId,
      from_role:    ctx.role,
      from_user_id: ctx.userId,
      subject:      subject.trim(),
      body:         body.trim(),
      category,
    })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/messages')
  return { ok: true }
}

export async function markReadAction(
  hotelId:   string,
  messageId: string,
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  const { error } = await ctx.supabase
    .from('admin_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('hotel_id', hotelId)
    .is('read_at', null)   // only update if not already read

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
