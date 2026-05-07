// =============================================================================
// Travel Connect Pro — Edge Function: display-config v2
// =============================================================================
// Changes from v1:
//   - Fetches property_configs (welcome, ticker, media) for slide content
//   - Fetches currency_cache (USD base) → formatted buy/sell rates for exchange slide
//   - Passes wifi, service_url, highlight_offer, promo offers into slide content
//   - Weather still fetched client-side from Open-Meteo (free, real-time, no API key)
//   - ETag 304 caching unchanged
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsResponse, jsonResponse, errorResponse, CORS_HEADERS } from '../_shared/helpers.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const REFRESH_INTERVAL_SECONDS  = 300

const SLIDE_DURATIONS: Record<string, number> = {
  welcome: 8_000, weather: 8_000, flights: 10_000, exchange: 7_000,
  promo: 9_000, wifi: 6_000, service_request: 7_000, alert: 10_000,
}

async function sha256(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function formatExchangeRates(usdRates: Record<string, number>, gelPerUsd: number) {
  const FLAG: Record<string, string> = {
    EUR: '🇪🇺', GBP: '🇬🇧', TRY: '🇹🇷', RUB: '🇷🇺', CNY: '🇨🇳', JPY: '🇯🇵',
  }
  const SPREAD = 0.015
  const ORDER  = ['USD', 'EUR', 'GBP', 'TRY', 'RUB']

  // Add USD itself
  const result: { currency: string; buy: number; sell: number; flag: string }[] = [{
    currency: 'USD',
    buy:  parseFloat((gelPerUsd * (1 - SPREAD)).toFixed(3)),
    sell: parseFloat((gelPerUsd * (1 + SPREAD)).toFixed(3)),
    flag: '🇺🇸',
  }]

  for (const currency of ORDER.filter(c => c !== 'USD')) {
    const rateToUsd = usdRates[currency]
    if (!rateToUsd) continue
    const midGel = (1 / rateToUsd) * gelPerUsd
    result.push({
      currency,
      buy:  parseFloat((midGel * (1 - SPREAD)).toFixed(3)),
      sell: parseFloat((midGel * (1 + SPREAD)).toFixed(3)),
      flag: FLAG[currency] ?? '🏳️',
    })
  }

  return result.slice(0, 5)
}

function buildContent(
  type: string,
  base: Record<string, unknown>,
  lang: string,
  hotelId: string,
  welcome: Record<string, unknown>,
  ticker:  Record<string, unknown>,
  media:   Record<string, unknown>,
  rates:   ReturnType<typeof formatExchangeRates>,
): Record<string, unknown> {
  switch (type) {
    case 'welcome':
      return {
        language:        lang,
        highlight_offer: (welcome.highlight_offer as string) ?? '',
        greeting:        ((welcome.greetings as Record<string, string>) ?? {})[lang] ?? '',
        subtext:         'We hope you enjoy your stay',
      }
    case 'promo':
      return { language: lang, offers: ((ticker.offers as string[]) ?? []).filter(Boolean) }
    case 'exchange':
      return { language: lang, source: 'National Bank of Georgia', rates }
    case 'wifi':
      return { language: lang, url: (media.wifi_url as string) ?? null, ssid: (media.wifi_ssid as string) ?? null }
    case 'service_request':
      return { language: lang, service_url: `https://pjyjblllcllnqsjbvbfc.supabase.co/functions/v1/service-request-pwa?hotel_id=${hotelId}` }
    default:
      return { language: lang, ...base }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()
  if (req.method !== 'GET')    return errorResponse('Method not allowed', 405)

  const url      = new URL(req.url)
  const screenId = url.searchParams.get('screen_id')
  if (!screenId) return errorResponse('screen_id is required')

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(screenId)) return errorResponse('screen_id must be a valid UUID')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const { data: screen, error: screenErr } = await supabase
    .from('screens')
    .select('id, hotel_id, screen_type, display_name, room_number, vendor, resolution, button_map, status')
    .eq('id', screenId).single()

  if (screenErr || !screen) return errorResponse('Screen not found', 404)

  const [hotelRes, configRes, airportsRes, alertsRes, currencyRes] = await Promise.all([
    supabase.from('hotels')
      .select('id, brand_name, short_code, status, theme_config, default_language, timezone, city, country_code')
      .eq('id', screen.hotel_id).single(),
    supabase.from('property_configs')
      .select('carousel, welcome, ticker, games_enabled, verification, media')
      .eq('hotel_id', screen.hotel_id).single(),
    supabase.from('property_airports')
      .select('iata_code, airport_name, drive_time_minutes')
      .eq('hotel_id', screen.hotel_id).eq('enabled', true).order('display_order'),
    supabase.from('alerts')
      .select('id, severity, message, expires_at')
      .eq('hotel_id', screen.hotel_id).eq('active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
    supabase.from('currency_cache')
      .select('rates').eq('base_currency', 'USD').maybeSingle(),
  ])

  const hotel = hotelRes.data
  if (!hotel) return errorResponse('Hotel not found', 404)
  if (hotel.status !== 'active') return errorResponse('Hotel not active', 403)

  // Heartbeat (fire and forget)
  supabase.from('screens').update({ last_heartbeat_at: new Date().toISOString(), status: 'online' })
    .eq('id', screenId).then(() => {})

  const theme   = (hotel.theme_config as Record<string, unknown>) ?? {}
  const colors  = (theme.colors as Record<string, string>) ?? {}
  const fonts   = (theme.fonts  as Record<string, string>) ?? {}
  const logo    = (theme.logo   as Record<string, unknown>) ?? {}

  const cfg     = configRes.data
  const welcome = (cfg?.welcome as Record<string, unknown>) ?? {}
  const ticker  = (cfg?.ticker  as Record<string, unknown>) ?? {}
  const media   = (cfg?.media   as Record<string, unknown>) ?? {}
  const carousel = (cfg?.carousel as { sequence?: { type: string; id: string; label: string; duration: number }[] }) ?? {}

  // Exchange rates
  const usdRates  = (currencyRes.data?.rates as Record<string, number>) ?? {}
  const gelPerUsd = usdRates['GEL'] ?? 2.68
  const rates     = Object.keys(usdRates).length ? formatExchangeRates(usdRates, gelPerUsd) : []

  const lang = hotel.default_language

  // Build playlist
  const DEFAULT_SEQ = [
    { type: 'welcome', duration: 8 }, { type: 'weather', duration: 8 },
    { type: 'flights', duration: 10 }, { type: 'exchange', duration: 7 },
    { type: 'promo', duration: 9 }, { type: 'wifi', duration: 6 },
    { type: 'service_request', duration: 7 },
  ]
  const sequence = carousel.sequence?.length ? carousel.sequence : DEFAULT_SEQ
  const airports = airportsRes.data ?? []

  const playlist: { type: string; duration_ms: number; content: Record<string, unknown> }[] = []

  for (const item of sequence) {
    if (screen.screen_type === 'room_tv' && item.type === 'wifi') continue
    if (item.type === 'flights') {
      for (const ap of airports) {
        playlist.push({
          type: 'flights',
          duration_ms: SLIDE_DURATIONS.flights,
          content: buildContent('flights', { iata_code: ap.iata_code, airport_name: ap.airport_name, drive_time_minutes: ap.drive_time_minutes }, lang, hotel.id, welcome, ticker, media, rates),
        })
      }
      continue
    }
    playlist.push({
      type: item.type,
      duration_ms: ((item as { duration?: number }).duration ?? 0) * 1000 || SLIDE_DURATIONS[item.type] || 8_000,
      content: buildContent(item.type, {}, lang, hotel.id, welcome, ticker, media, rates),
    })
  }

  const config = {
    screen_id: screen.id, hotel_id: screen.hotel_id,
    screen_type: screen.screen_type, display_name: screen.display_name,
    room_number: screen.room_number, vendor: screen.vendor,
    resolution: screen.resolution,
    button_map: (screen.button_map as Record<string, string>) ?? { ok: 'Enter', up: 'ArrowUp', down: 'ArrowDown' },
    branding: {
      hotel_name: hotel.brand_name, short_code: hotel.short_code,
      logo_url: (logo.url as string) ?? null,
      colors: {
        primary:     colors.primary     ?? '#1a1a2e',
        accent_gold: colors.accent_gold ?? '#c9a84c',
        accent_blue: colors.accent_blue ?? '#009FE3',
        background:  colors.background  ?? '#0f0f1e',
      },
      fonts: { heading: fonts.heading ?? 'Playfair Display', body: fonts.body ?? 'Inter' },
      timezone: hotel.timezone, city: hotel.city, country_code: hotel.country_code,
    },
    playlist,
    active_alerts: (alertsRes.data ?? []).map(a => ({ id: a.id, severity: a.severity, message: a.message, expires_at: a.expires_at })),
    games_enabled: (cfg?.games_enabled as Record<string, boolean>) ?? {},
    verification:  (cfg?.verification  as Record<string, unknown>) ?? {},
    refresh_interval_seconds: REFRESH_INTERVAL_SECONDS,
    generated_at: new Date().toISOString(),
  }

  const body        = JSON.stringify(config)
  const etag        = await sha256(body)
  const ifNoneMatch = req.headers.get('if-none-match')

  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: { ...CORS_HEADERS, 'ETag': etag, 'Cache-Control': `max-age=${REFRESH_INTERVAL_SECONDS}` },
    })
  }

  return new Response(JSON.stringify({ ...config, etag }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'ETag': etag, 'Cache-Control': `max-age=${REFRESH_INTERVAL_SECONDS}` },
  })
})
