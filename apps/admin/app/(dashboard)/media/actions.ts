'use server'

import { createClient }  from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface MediaConfig {
  bgm_label:                string
  bgm_url:                  string
  bgm_volume:               number
  bgm_status:               'online' | 'offline' | 'unchecked'
  bgm_last_checked:         string | null
  use_corporate_video:      boolean
  feratel_cam_id:           string
  corporate_video_label:    string
  corporate_video_url:      string
  cam_popup_interval_min:   number
}

interface ActionResult { ok: boolean; error?: string }

async function getProfile(hotelId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!p || p.hotel_id !== hotelId) return null
  return { supabase, hotelId }
}

export async function updateMediaAction(
  hotelId: string,
  media:   MediaConfig,
): Promise<ActionResult> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, error: 'Unauthorized' }

  if (media.bgm_volume < 0 || media.bgm_volume > 100) {
    return { ok: false, error: 'Volume must be 0–100' }
  }
  if (media.cam_popup_interval_min < 0) {
    return { ok: false, error: 'Popup interval must be ≥ 0' }
  }

  const { error } = await ctx.supabase
    .from('property_configs')
    .upsert({ hotel_id: hotelId, media }, { onConflict: 'hotel_id' })

  if (error) return { ok: false, error: error.message }
  revalidatePath('/media')
  return { ok: true }
}

export async function testStreamAction(
  hotelId: string,
  url:     string,
): Promise<{ ok: boolean; status: 'online' | 'offline'; error?: string }> {
  const ctx = await getProfile(hotelId)
  if (!ctx) return { ok: false, status: 'offline', error: 'Unauthorized' }

  if (!url || !url.startsWith('http')) {
    return { ok: false, status: 'offline', error: 'Invalid URL — must start with http' }
  }

  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'TravelConnectPro/1.0 stream-checker' },
    })
    clearTimeout(timeout)

    const online = res.ok || res.status === 200 || res.status === 206
    return { ok: true, status: online ? 'online' : 'offline' }
  } catch (e) {
    // Some streams don't support HEAD — try GET with range
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 5000)
      await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Range: 'bytes=0-0' },
      })
      return { ok: true, status: 'online' }
    } catch {
      return { ok: true, status: 'offline' }
    }
  }
}
