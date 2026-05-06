// =============================================================================
// Travel Connect Pro — Edge Function: display-config
// =============================================================================
// GET /functions/v1/display-config?screen_id=<uuid>
//
// Called by: lobby TVs, room TVs — on startup and every 5 minutes
// Auth: none (TVs are anonymous devices — no session)
//
// What it does:
//   1. Look up screen → verify it exists and hotel is active
//   2. Update last_heartbeat_at + set status = 'online' (write path ✅)
//   3. Pull hotel branding, property_configs, airports, active alerts
//   4. Build a typed slide playlist (server decides order/content)
//   5. Return signed config JSON with ETag + cache headers
//
// The TV never decides what to show — server builds the entire playlist.
// TV just renders what it receives. Server-driven display logic.
//
// ETag: SHA-256 of the response body — TV sends If-None-Match header
//       on subsequent polls. Returns 304 if nothing changed → saves bandwidth.
//
// Realtime: TV also subscribes to channel `display:${screen_id}` for
//           instant push updates (alerts, live events). Config poll is the
//           fallback/sync mechanism; Realtime is the low-latency path.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsResponse, jsonResponse, errorResponse, CORS_HEADERS } from '../_shared/helpers.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Playlist refresh interval — how often the TV re-polls this endpoint
const REFRESH_INTERVAL_SECONDS = 300  // 5 minutes

// Slide durations (ms) — server authoritative, not configured per-TV
const SLIDE_DURATIONS: Record<string, number> = {
  welcome:         8_000,
  weather:         8_000,
  flights:        10_000,
  exchange:        7_000,
  sports:         10_000,
  promo:           8_000,
  wifi:            6_000,
  service_request: 7_000,
  alert:          10_000,  // alerts always rendered, duration independent of playlist
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlideConfig {
  type:        string
  duration_ms: number
  content:     Record<string, unknown>
}

interface DisplayConfig {
  screen_id:                string
  hotel_id:                 string
  screen_type:              string
  display_name:             string
  room_number:              string | null
  vendor:                   string | null
  resolution:               string | null
  button_map:               Record<string, string>
  branding: {
    hotel_name:   string
    short_code:   string
    logo_url:     string | null
    colors:       Record<string, string>
    fonts:        Record<string, string>
    timezone:     string
    city:         string | null
    country_code: string | null
  }
  playlist:                 SlideConfig[]
  active_alerts:            AlertConfig[]
  games_enabled:            Record<string, boolean>
  verification:             Record<string, unknown>
  refresh_interval_seconds: number
  generated_at:             string
  etag:                     string
}

interface AlertConfig {
  id:         string
  severity:   string
  message:    string
  expires_at: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Build the slide playlist from property_configs.carousel + enabled airports
function buildPlaylist(
  carousel: { sequence?: string[] },
  airports: { iata_code: string; airport_name: string; drive_time_minutes: number | null }[],
  screenType: string,
  defaultLanguage: string,
): SlideConfig[] {
  const playlist: SlideConfig[] = []

  // Default sequence if manager hasn't configured one
  const sequence = carousel.sequence?.length
    ? carousel.sequence
    : ['welcome', 'weather', 'flights', 'exchange', 'promo', 'wifi', 'service_request']

  for (const slideType of sequence) {
    // Room TVs skip the service_request slide (they show it inline) and wifi (implicit)
    if (screenType === 'room_tv' && slideType === 'wifi') continue

    if (slideType === 'flights') {
      // One slide per airport
      for (const airport of airports) {
        playlist.push({
          type:        'flights',
          duration_ms: SLIDE_DURATIONS.flights,
          content: {
            iata_code:          airport.iata_code,
            airport_name:       airport.airport_name,
            drive_time_minutes: airport.drive_time_minutes,
          },
        })
      }
      continue
    }

    playlist.push({
      type:        slideType,
      duration_ms: SLIDE_DURATIONS[slideType] ?? 8_000,
      content: {
        language: defaultLanguage,
      },
    })
  }

  return playlist
}

// Parse theme_config JSONB — fill in TCP defaults for any missing values
function parseTheme(themeConfig: Record<string, unknown>) {
  const colors  = (themeConfig.colors  as Record<string, string>)  ?? {}
  const fonts   = (themeConfig.fonts   as Record<string, string>)  ?? {}
  const logo    = (themeConfig.logo    as Record<string, unknown>) ?? {}

  return {
    logo_url:    (logo.url as string) ?? null,
    colors: {
      primary:    colors.primary    ?? '#1a1a2e',
      accent_gold: colors.accent_gold ?? '#c9a84c',
      accent_blue: colors.accent_blue ?? '#009FE3',
      background:  colors.background  ?? '#0f0f1e',
    },
    fonts: {
      heading:    fonts.heading ?? 'Playfair Display',
      body:       fonts.body    ?? 'Inter',
    },
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()
  if (req.method !== 'GET')    return errorResponse('Method not allowed', 405)

  const url      = new URL(req.url)
  const screenId = url.searchParams.get('screen_id')

  if (!screenId) return errorResponse('screen_id query parameter is required')

  // Basic UUID format check
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(screenId)) return errorResponse('screen_id must be a valid UUID')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ── 1. Fetch screen ────────────────────────────────────────────────────────
  const { data: screen, error: screenErr } = await supabase
    .from('screens')
    .select(`
      id, hotel_id, screen_type, display_name, room_number,
      vendor, resolution, button_map, status
    `)
    .eq('id', screenId)
    .single()

  if (screenErr || !screen) return errorResponse('Screen not found', 404)

  // ── 2. Fetch hotel ─────────────────────────────────────────────────────────
  const { data: hotel, error: hotelErr } = await supabase
    .from('hotels')
    .select(`
      id, brand_name, short_code, status, tier,
      theme_config, default_language, timezone, city, country_code
    `)
    .eq('id', screen.hotel_id)
    .single()

  if (hotelErr || !hotel) return errorResponse('Hotel not found', 404)
  if (hotel.status !== 'active') return errorResponse('Hotel is not active', 403)

  // ── 3. Heartbeat update (write path — correct to be in Edge Function) ──────
  await supabase
    .from('screens')
    .update({
      last_heartbeat_at: new Date().toISOString(),
      status:            'online',
    })
    .eq('id', screenId)
  // Fire-and-forget — don't block config response on this

  // ── 4. Fetch property config ───────────────────────────────────────────────
  const { data: propConfig } = await supabase
    .from('property_configs')
    .select('carousel, welcome, games_enabled, slot_config, verification, media')
    .eq('hotel_id', screen.hotel_id)
    .single()

  const carousel      = (propConfig?.carousel     as { sequence?: string[] }) ?? { sequence: [] }
  const gamesEnabled  = (propConfig?.games_enabled as Record<string, boolean>) ?? {}
  const verification  = (propConfig?.verification  as Record<string, unknown>) ?? {}

  // ── 5. Fetch airports (for flights slides) ─────────────────────────────────
  const { data: airports } = await supabase
    .from('property_airports')
    .select('iata_code, airport_name, drive_time_minutes')
    .eq('hotel_id', screen.hotel_id)
    .eq('enabled', true)
    .order('display_order', { ascending: true })

  // ── 6. Fetch active alerts ─────────────────────────────────────────────────
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, severity, message, expires_at')
    .eq('hotel_id', screen.hotel_id)
    .eq('active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('severity', { ascending: false })  // critical first

  // ── 7. Build config ────────────────────────────────────────────────────────
  const theme    = parseTheme((hotel.theme_config as Record<string, unknown>) ?? {})
  const playlist = buildPlaylist(
    carousel,
    airports ?? [],
    screen.screen_type,
    hotel.default_language,
  )

  const config: Omit<DisplayConfig, 'etag'> = {
    screen_id:    screen.id,
    hotel_id:     screen.hotel_id,
    screen_type:  screen.screen_type,
    display_name: screen.display_name,
    room_number:  screen.room_number,
    vendor:       screen.vendor,
    resolution:   screen.resolution,
    button_map:   (screen.button_map as Record<string, string>) ?? { ok: 'Enter', up: 'ArrowUp', down: 'ArrowDown' },
    branding: {
      hotel_name:   hotel.brand_name,
      short_code:   hotel.short_code,
      logo_url:     theme.logo_url,
      colors:       theme.colors,
      fonts:        theme.fonts,
      timezone:     hotel.timezone,
      city:         hotel.city,
      country_code: hotel.country_code,
    },
    playlist,
    active_alerts: (alerts ?? []).map(a => ({
      id:         a.id,
      severity:   a.severity,
      message:    a.message,
      expires_at: a.expires_at,
    })),
    games_enabled:            gamesEnabled,
    verification,
    refresh_interval_seconds: REFRESH_INTERVAL_SECONDS,
    generated_at:             new Date().toISOString(),
  }

  // ── 8. ETag for conditional GET ────────────────────────────────────────────
  const body   = JSON.stringify(config)
  const etag   = await sha256(body)
  const ifNoneMatch = req.headers.get('if-none-match')

  if (ifNoneMatch === etag) {
    // Config hasn't changed — save bandwidth
    return new Response(null, {
      status: 304,
      headers: {
        ...CORS_HEADERS,
        'ETag':          etag,
        'Cache-Control': `max-age=${REFRESH_INTERVAL_SECONDS}`,
      },
    })
  }

  const finalBody = JSON.stringify({ ...config, etag })

  return new Response(finalBody, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type':  'application/json',
      'ETag':          etag,
      'Cache-Control': `max-age=${REFRESH_INTERVAL_SECONDS}`,
    },
  })
})
