'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import WelcomeOverlay   from './main/WelcomeOverlay'
import LandscapeLayout  from './layouts/LandscapeLayout'

interface DisplayConfig {
  screen_id:   string
  hotel_id:    string
  screen_type: string
  branding: {
    hotel_name:  string
    logo_url:    string | null
    colors:      { primary: string; accent_gold: string; background: string }
    fonts:       { heading: string; body: string }
    timezone:    string
    city:        string
    lat?:        number
    lon?:        number
  }
  playlist:    { type: string; duration_ms: number; content: Record<string, unknown> }[]
  sidebar_qrs: { qr_id: string; label: string; sidebar_label: string | null; category: string; destination_url: string; tier: string }[]
  rates:       { currency: string; buy: number; sell: number; flag: string }[]
  ticker:      { announcements: string[]; events: string[]; offers: string[] }
  map_config:  { primary_provider: 'maplibre_osm' | 'mapbox' | 'tomtom'; fallback_provider: string; show_traffic: boolean; default_zoom: number; center?: [number, number]; mapbox_token?: string }
  airports:    { iata_code: string; airport_name: string; drive_time_minutes: number | null }[]
  welcome:     { timing_sec: number; highlight_offer: string; greeting: string; subtext: string }
  content: {
    carousel: any[]
    welcome: any
    ticker: any
    media: any
    games: any
    currency: { source: string; rates: any[] }
    flights: Record<string, any[]>
  }
  etag:        string
  refresh_interval_seconds: number
}

interface Props {
  screenId:         string
  supabaseUrl:      string
  supabaseAnonKey:  string
  displayConfigUrl: string
}

// Types that render as panels in the left area
const PANEL_TYPES = new Set(['flights', 'map', 'neon_slots', 'dice', 'roulette', 'memory', 'shell'])

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

const GREETING_MAP = {
  morning: 'Good morning', afternoon: 'Good afternoon',
  evening: 'Good evening', night: 'Good night',
}

function formatTime(tz: string) {
  try { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz }) }
  catch { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
}
function formatDate(tz: string) {
  try { return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }) }
  catch { return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) }
}

// City → approximate coordinates (for hotels without PostGIS coords yet)
const CITY_COORDS: Record<string, [number, number]> = {
  'batumi':    [41.6464, 41.6168],
  'tbilisi':   [41.6938, 44.8015],
  'kutaisi':   [42.2679, 42.6946],
  'amsterdam': [52.3676, 4.9041],
  'berlin':    [52.5200, 13.4050],
}

function getCityCoords(city: string): [number, number] {
  const key = city.toLowerCase()
  return CITY_COORDS[key] ?? CITY_COORDS['batumi']
}

export default function DisplayDashboard({ screenId, supabaseUrl, supabaseAnonKey, displayConfigUrl }: Props) {
  const [config, setConfig]           = useState<DisplayConfig | null>(null)
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [clock, setClock]             = useState('')
  const [date, setDate]               = useState('')
  const [mainView, setMainView]       = useState<string>('flights')
  const [slideIdx, setSlideIdx]       = useState(0)
  const etag     = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // ── Config fetch ──────────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${supabaseAnonKey}` }
      if (etag.current) headers['If-None-Match'] = etag.current
      const res = await fetch(`${displayConfigUrl}?screen_id=${screenId}`, { headers })
      if (res.status === 304) return
      if (res.ok) {
        const data: DisplayConfig = await res.json()
        etag.current = data.etag
        setConfig(data)
      }
    } catch (e) { console.error('[TCP] Config fetch error', e) }
  }, [screenId, supabaseAnonKey, displayConfigUrl])

  useEffect(() => {
    fetchConfig()
    const id = setInterval(fetchConfig, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchConfig])

  // ── Clock (isolated state — doesn't affect carousel) ─────────────────────
  useEffect(() => {
    const tz = config?.branding.timezone ?? 'Asia/Tbilisi'
    const tick = () => { setClock(formatTime(tz)); setDate(formatDate(tz)) }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [config?.branding.timezone])

  // ── Carousel (only panel-type slides rotate in left area) ─────────────────
  useEffect(() => {
    if (!config?.playlist?.length || !welcomeDone) return

    // Filter to only slides that render as main panels
    const panels = config.playlist.filter(s => PANEL_TYPES.has(s.type))

    // If no panel slides configured, default to flights
    if (panels.length === 0) { setMainView('flights'); return }

    const current = panels[slideIdx % panels.length]
    setMainView(current.type)

    timerRef.current = setTimeout(() => {
      setSlideIdx(i => (i + 1) % panels.length)
    }, current.duration_ms ?? 10000)

    return () => clearTimeout(timerRef.current)
  }, [config, slideIdx, welcomeDone])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.hotel_id) return
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const ch = supabase.channel(`display:${screenId}`)
      .on('broadcast', { event: 'alert' }, ({ payload }) => console.log('[TCP Alert]', payload))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [config?.hotel_id, screenId, supabaseUrl, supabaseAnonKey])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!config) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 32, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>Connecting…</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.15)', fontFamily: 'Inter, sans-serif' }}>Travel Connect Pro</div>
        </div>
      </div>
    )
  }

  const { branding, welcome, sidebar_qrs, ticker, map_config, airports, content } = config
  const rates = content.currency?.rates ?? []
  const colors = branding.colors
  const tod    = getTimeOfDay()

  // Resolve coordinates — from config or city lookup
  const [lat, lon] = branding.lat && branding.lon
    ? [branding.lat, branding.lon]
    : getCityCoords(branding.city ?? 'batumi')

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: colors.background }}>

      {/* Welcome overlay */}
      {!welcomeDone && (
        <WelcomeOverlay
          hotelName={branding.hotel_name}
          greeting={welcome?.greeting || GREETING_MAP[tod]}
          subtext={welcome?.subtext || 'We hope you enjoy your stay'}
          highlight={welcome?.highlight_offer || ''}
          logoUrl={branding.logo_url}
          accentGold={colors.accent_gold}
          primaryColor={colors.primary}
          timingSec={welcome?.timing_sec ?? 8}
          onDismiss={() => setWelcomeDone(true)}
        />
      )}

      {/* Persistent dashboard — always rendered */}
      <LandscapeLayout
        hotelName={branding.hotel_name}
        logoUrl={branding.logo_url}
        accentGold={colors.accent_gold}
        primaryColor={colors.primary}
        bgColor={colors.background}
        timezone={branding.timezone}
        city={branding.city ?? 'Batumi'}
        lat={lat}
        lon={lon}
        mainPanelView={mainView}
        airports={airports ?? []}
        flights={config.content.flights ?? {}}
        mapConfig={map_config ?? { primary_provider: 'maplibre_osm', fallback_provider: 'maplibre_osm', show_traffic: false, default_zoom: 13 }}
        rates={rates ?? []}
        sidebarQrs={sidebar_qrs ?? []}
        announcements={ticker?.announcements ?? []}
        events={ticker?.events ?? []}
        offers={ticker?.offers ?? []}
        clock={clock}
        date={date}
      />
    </div>
  )
}
