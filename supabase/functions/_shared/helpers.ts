// =============================================================================
// Travel Connect Pro — Edge Function Shared Helpers
// =============================================================================
// Imported by every Edge Function via:  import { ... } from '../_shared/helpers.ts'
// Deno runtime — no npm imports here, use esm.sh or Supabase built-ins only.
// =============================================================================

// ─── CORS ────────────────────────────────────────────────────────────────────

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function corsResponse(status = 200) {
  return new Response(null, { status, headers: CORS_HEADERS })
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

// ─── Device Hash ─────────────────────────────────────────────────────────────

/**
 * SHA-256 device fingerprint: no PII stored.
 * Format: SHA256(userAgent + "|" + daySalt + "|" + hotelId)
 * daySalt is stored in Supabase Vault and rotates via pg_cron daily.
 */
export async function computeDeviceHash(
  userAgent: string,
  daySalt: string,
  hotelId: string,
): Promise<string> {
  const raw = `${userAgent}|${daySalt}|${hotelId}`
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(raw),
  )
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Telegram ────────────────────────────────────────────────────────────────

/**
 * Send a Telegram message to a hotel's manager chat.
 * Bot token comes from env (set per-deployment in Supabase secrets).
 * chat_id is stored per-hotel in the DB — never hard-coded.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[TCP Telegram] Send failed:', err)
      return false
    }

    return true
  } catch (e) {
    console.error('[TCP Telegram] Network error:', e)
    return false
  }
}

/**
 * Format a service-request notification for Telegram.
 * Keep it short — managers read on mobile.
 */
export function formatServiceRequestNotification(opts: {
  hotelName: string
  roomNumber: string
  category: string
  description: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  requestId: string
}): string {
  const PRIORITY_EMOJI = { low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴' }
  const emoji = PRIORITY_EMOJI[opts.priority]

  return [
    `${emoji} *New Service Request*`,
    ``,
    `🏨 *${opts.hotelName}*`,
    `🚪 Room: \`${opts.roomNumber}\``,
    `📋 Category: ${opts.category}`,
    `📝 ${opts.description}`,
    ``,
    `🆔 \`${opts.requestId.slice(0, 8)}\``,
    `⏰ ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
  ].join('\n')
}

// ─── HMAC token (Tier-2 QR) ──────────────────────────────────────────────────

/**
 * Sign a Tier-2 QR token with HMAC-SHA256.
 * Payload: { asset_id, hotel_id, exp }
 * Secret: SUPABASE_JWT_SECRET (from env)
 */
export async function signTier2Token(
  payload: { asset_id: string; hotel_id: string; exp: number },
  secret: string,
): Promise<string> {
  const data = JSON.stringify(payload)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return btoa(`${data}.${sigHex}`)
}

export async function verifyTier2Token(
  token: string,
  secret: string,
): Promise<{ asset_id: string; hotel_id: string; exp: number } | null> {
  try {
    const decoded = atob(token)
    const lastDot = decoded.lastIndexOf('.')
    const data = decoded.slice(0, lastDot)
    const sigHex = decoded.slice(lastDot + 1)

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(data),
    )
    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (sigHex !== expectedHex) return null

    const payload = JSON.parse(data)
    if (payload.exp < Date.now() / 1000) return null   // expired

    return payload
  } catch {
    return null
  }
}
