// =============================================================================
// Travel Connect Pro — Edge Function: service-request
// =============================================================================
// POST /functions/v1/service-request
//
// Payload (from guest PWA or lobby TV):
//   { hotel_id, service_id, room_number, notes? }
//
// service_id is a soft FK to service_catalog.service_id  e.g. "clean-room"
// The catalog row tells us: name, emoji, priority, sla_minutes, channel_id.
// The Edge Function looks it up — the client never sends priority or SLA.
//
// Server-driven logic here:
//   • Validate service_id exists in service_catalog for this hotel
//   • Escalate priority to 'urgent' if guest repeated same service within 10 min
//   • Insert service_request with server-assigned priority
//   • Fire Telegram notification (fire-and-forget, non-blocking)
//   • Return { request_id, priority, eta_minutes } — client just displays it
//
// Columns used (post-migration-3):
//   service_requests: hotel_id, service_id, room_number, notes,
//                     device_hash, status, priority, telegram_sent_at
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  corsResponse,
  jsonResponse,
  errorResponse,
  computeDeviceHash,
  sendTelegramMessage,
} from '../_shared/helpers.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN       = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const DEVICE_HASH_SALT         = Deno.env.get('DEVICE_HASH_SALT') ?? 'dev-salt'

// Priority escalation — server decides, client never sends priority
const ESCALATION: Record<string, string> = {
  low:    'normal',
  normal: 'high',
  high:   'urgent',
  urgent: 'urgent',
}

async function resolveEffectivePriority(
  supabase: ReturnType<typeof createClient>,
  hotelId: string,
  serviceId: string,
  deviceHash: string,
  catalogPriority: string,
): Promise<string> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
    .eq('service_id', serviceId)
    .eq('device_hash', deviceHash)
    .gte('created_at', tenMinAgo)

  // If guest already submitted same service in last 10 min → escalate
  if ((count ?? 0) >= 1) return ESCALATION[catalogPriority] ?? catalogPriority
  return catalogPriority
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()
  if (req.method !== 'POST')    return errorResponse('Method not allowed', 405)

  // ── Parse ──────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return errorResponse('Invalid JSON body') }

  const { hotel_id, service_id, room_number, notes } = body as {
    hotel_id?:    string
    service_id?:  string
    room_number?: string
    notes?:       string
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!hotel_id    || typeof hotel_id    !== 'string') return errorResponse('hotel_id is required')
  if (!service_id  || typeof service_id  !== 'string') return errorResponse('service_id is required')
  if (!room_number || typeof room_number !== 'string') return errorResponse('room_number is required')
  if (notes && notes.length > 500) return errorResponse('notes must be ≤ 500 characters')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ── Hotel check ────────────────────────────────────────────────────────────
  const { data: hotel, error: hotelErr } = await supabase
    .from('hotels')
    .select('id, brand_name, status, manager_chat_id, telegram_bot_token')
    .eq('id', hotel_id)
    .single()

  if (hotelErr || !hotel) return errorResponse('Hotel not found', 404)
  if (hotel.status !== 'active') return errorResponse('Hotel is not active', 403)

  // ── Service catalog lookup (priority + SLA come from here) ─────────────────
  const { data: catalog, error: catErr } = await supabase
    .from('service_catalog')
    .select('service_id, name, emoji, priority, sla_minutes, enabled')
    .eq('hotel_id', hotel_id)
    .eq('service_id', service_id)
    .single()

  if (catErr || !catalog) {
    return errorResponse(`service_id '${service_id}' not found for this hotel`, 404)
  }
  if (!catalog.enabled) {
    return errorResponse(`Service '${service_id}' is currently unavailable`, 422)
  }

  // ── Device hash (no PII) ───────────────────────────────────────────────────
  const userAgent  = req.headers.get('user-agent') ?? 'unknown'
  const deviceHash = await computeDeviceHash(userAgent, DEVICE_HASH_SALT, hotel_id)

  // ── Server-assigned priority (client cannot influence this) ────────────────
  const priority = await resolveEffectivePriority(
    supabase, hotel_id, service_id, deviceHash, catalog.priority,
  )

  // ── Insert ─────────────────────────────────────────────────────────────────
  const { data: request, error: insertErr } = await supabase
    .from('service_requests')
    .insert({
      hotel_id,
      service_id,
      room_number,
      notes:       notes?.trim() ?? null,
      status:      'pending',
      priority,
      device_hash: deviceHash,
    })
    .select('id, created_at')
    .single()

  if (insertErr || !request) {
    console.error('[TCP service-request] Insert error:', insertErr)
    return errorResponse('Failed to create service request', 500)
  }

  // ── Telegram (fire-and-forget) ─────────────────────────────────────────────
  const botToken = hotel.telegram_bot_token ?? TELEGRAM_BOT_TOKEN
  const chatId   = hotel.manager_chat_id

  if (chatId) {
    const PRIORITY_EMOJI: Record<string, string> = {
      low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴',
    }
    const message = [
      `${PRIORITY_EMOJI[priority] ?? '⚪'} *New Service Request*`,
      ``,
      `🏨 *${hotel.brand_name}*`,
      `🚪 Room: \`${room_number}\``,
      `${catalog.emoji ?? '📋'} ${catalog.name}`,
      notes ? `📝 ${notes.trim()}` : null,
      ``,
      `⏱️ SLA: ${catalog.sla_minutes} min`,
      `🆔 \`${request.id.slice(0, 8)}\``,
    ].filter(Boolean).join('\n')

    sendTelegramMessage(botToken, chatId, message).then(async (ok) => {
      if (ok) {
        // Mark notification sent for idempotency
        await supabase
          .from('service_requests')
          .update({ telegram_sent_at: new Date().toISOString() })
          .eq('id', request.id)
      }
    }).catch((err) => console.error('[TCP Telegram] Failed:', err))
  } else {
    console.warn('[TCP service-request] No manager_chat_id for hotel:', hotel_id)
  }

  // ── Respond ────────────────────────────────────────────────────────────────
  return jsonResponse({
    request_id:  request.id,
    status:      'pending',
    priority,
    eta_minutes: catalog.sla_minutes,
    service:     `${catalog.emoji ?? ''} ${catalog.name}`.trim(),
    created_at:  request.created_at,
    message:     `Your request has been received. Estimated response: ~${catalog.sla_minutes} min.`,
  })
})
