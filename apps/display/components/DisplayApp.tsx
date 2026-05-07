'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import WelcomeSlide        from './slides/WelcomeSlide'
import WeatherSlide        from './slides/WeatherSlide'
import ExchangeSlide       from './slides/ExchangeSlide'
import FlightsSlide        from './slides/FlightsSlide'
import WifiSlide           from './slides/WifiSlide'
import ServiceRequestSlide from './slides/ServiceRequestSlide'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branding {
  hotel_name:   string
  short_code:   string
  logo_url:     string | null
  colors:       { primary: string; accent_gold: string; accent_blue: string; background: string }
  fonts:        { heading: string; body: string }
  timezone:     string
  city:         string | null
  country_code: string | null
}

interface SlideConfig {
  type:        string
  duration_ms: number
  content:     Record<string, unknown>
}

interface Alert {
  id:         string
  severity:   string
  message:    string
  expires_at: string | null
}

interface DisplayConfig {
  screen_id:   string
  hotel_id:    string
  screen_type: string
  branding:    Branding
  playlist:    SlideConfig[]
  active_alerts: Alert[]
  refresh_interval_seconds: number
  etag:        string
}

interface Props {
  screenId:         string
  supabaseUrl:      string
  supabaseAnonKey:  string
  displayConfigUrl: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

function formatTime(tz: string) {
  try {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  } catch {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
}

function formatDate(tz: string) {
  try {
    return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  } catch {
    return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }
}

// ─── Slide renderer ───────────────────────────────────────────────────────────

function renderSlide(slide: SlideConfig, config: DisplayConfig) {
  const { branding } = config
  const colors = branding.colors
  const content = slide.content

  switch (slide.type) {
    case 'welcome':
      return (
        <WelcomeSlide
          hotelName={branding.hotel_name}
          greeting={(content.greeting as string) ?? ''}
          subtext={(content.subtext as string) ?? 'We hope you enjoy your stay'}
          highlight={(content.highlight_offer as string) ?? ''}
          logoUrl={branding.logo_url}
          colors={colors}
          timeOfDay={getTimeOfDay()}
        />
      )

    case 'weather':
      return (
        <WeatherSlide
          city={branding.city ?? 'Batumi'}
          colors={colors}
          data={(content.weather_data as Parameters<typeof WeatherSlide>[0]['data']) ?? null}
        />
      )

    case 'exchange':
      return (
        <ExchangeSlide
          colors={colors}
          rates={(content.rates as Parameters<typeof ExchangeSlide>[0]['rates']) ?? []}
          sourceName={(content.source as string) ?? 'National Bank of Georgia'}
        />
      )

    case 'flights':
      return (
        <FlightsSlide
          iataCode={(content.iata_code as string) ?? 'BUS'}
          airportName={(content.airport_name as string) ?? 'Batumi International Airport'}
          driveMinutes={(content.drive_time_minutes as number) ?? null}
          colors={colors}
          flights={(content.flights as Parameters<typeof FlightsSlide>[0]['flights']) ?? []}
        />
      )

    case 'wifi':
      return (
        <WifiSlide
          hotelName={branding.hotel_name}
          colors={colors}
          wifiQrUrl={(content.url as string) ?? null}
          ssid={(content.ssid as string) ?? undefined}
        />
      )

    case 'service_request':
      return (
        <ServiceRequestSlide
          hotelName={branding.hotel_name}
          colors={colors}
          serviceUrl={(content.service_url as string) ?? `https://pwa.${branding.short_code}.ge`}
        />
      )

    default:
      // Unknown slide type — show placeholder
      return (
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: colors.background }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>
            {slide.type}
          </div>
        </div>
      )
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DisplayApp({ screenId, supabaseUrl, supabaseAnonKey, displayConfigUrl }: Props) {
  const [config, setConfig]           = useState<DisplayConfig | null>(null)
  const [slideIndex, setSlideIndex]   = useState(0)
  const [visible, setVisible]         = useState(true)
  const [currentTime, setCurrentTime] = useState('')
  const [currentDate, setCurrentDate] = useState('')
  const [alerts, setAlerts]           = useState<Alert[]>([])
  const [showAlert, setShowAlert]     = useState(false)
  const etag                          = useRef<string>('')
  const timerRef                      = useRef<ReturnType<typeof setTimeout>>()

  // ── Fetch display config ───────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      }
      if (etag.current) headers['If-None-Match'] = etag.current

      const res = await fetch(`${displayConfigUrl}?screen_id=${screenId}`, { headers })

      if (res.status === 304) return  // nothing changed

      if (res.ok) {
        const data: DisplayConfig = await res.json()
        etag.current = data.etag
        setConfig(data)
        if (data.active_alerts?.length) {
          setAlerts(data.active_alerts)
        }
      }
    } catch (e) {
      console.error('[TCP Display] Config fetch error:', e)
    }
  }, [screenId, supabaseAnonKey, displayConfigUrl])

  // ── Initial load + polling ─────────────────────────────────────────────────
  useEffect(() => {
    fetchConfig()
    const interval = setInterval(fetchConfig, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchConfig])

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tz = config?.branding.timezone ?? 'Asia/Tbilisi'
    const tick = () => {
      setCurrentTime(formatTime(tz))
      setCurrentDate(formatDate(tz))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [config?.branding.timezone])

  // ── Supabase Realtime — instant alerts ────────────────────────────────────
  useEffect(() => {
    if (!config?.hotel_id) return
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const channel = supabase
      .channel(`display:${screenId}`)
      .on('broadcast', { event: 'alert' }, ({ payload }) => {
        setAlerts(a => [payload as Alert, ...a])
        setShowAlert(true)
        setTimeout(() => setShowAlert(false), 10000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [config?.hotel_id, screenId, supabaseUrl, supabaseAnonKey])

  // ── Slide cycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!config?.playlist?.length) return

    const playlist = config.playlist
    const duration = playlist[slideIndex]?.duration_ms ?? 8000

    timerRef.current = setTimeout(() => {
      // Fade out
      setVisible(false)
      setTimeout(() => {
        setSlideIndex(i => (i + 1) % playlist.length)
        setVisible(true)
      }, 600)
    }, duration)

    return () => clearTimeout(timerRef.current)
  }, [config, slideIndex])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!config) {
    return (
      <div className="w-screen h-screen flex items-center justify-center"
        style={{ background: '#050508' }}>
        <div className="text-center">
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 32, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
            Connecting…
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.15)' }}>
            Travel Connect Pro
          </div>
        </div>
      </div>
    )
  }

  const { branding, playlist } = config
  const currentSlide           = playlist[slideIndex]

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: branding.colors.background }}>

      {/* ── Current slide ─────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(1.02)' }}
      >
        {currentSlide && renderSlide(currentSlide, config)}
      </div>

      {/* ── Top overlay bar ───────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-10 py-3 z-20"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      >
        {/* Hotel name */}
        <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 14, color: `${branding.colors.accent_gold}cc`, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          {branding.hotel_name}
        </div>

        {/* Clock */}
        <div className="text-right">
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 22, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            {currentTime}
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
            {currentDate}
          </div>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20" style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div
          key={`${slideIndex}-${visible}`}
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${branding.colors.primary}, ${branding.colors.accent_gold})`,
            transformOrigin: 'left',
            animation: visible ? `progress ${(currentSlide?.duration_ms ?? 8000) / 1000}s linear forwards` : 'none',
          }}
        />
      </div>

      {/* ── Slide dots ────────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2 z-20"
        style={{ pointerEvents: 'none' }}
      >
        {playlist.map((_, i) => (
          <div
            key={i}
            style={{
              width:        i === slideIndex ? 20 : 6,
              height:       6,
              borderRadius: 3,
              background:   i === slideIndex ? branding.colors.primary : 'rgba(255,255,255,0.2)',
              transition:   'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* ── Ticker bar ────────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 overflow-hidden z-30"
        style={{ height: 40, background: 'rgba(0,0,0,0.7)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            animation: 'ticker-scroll 60s linear infinite',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', paddingRight: 80 }}>
            {branding.hotel_name} · Travel Connect Pro · Welcome to {branding.city ?? 'Batumi'}
          </span>
        </div>
      </div>

      {/* ── Alert overlay ─────────────────────────────────────────────────── */}
      {showAlert && alerts[0] && (
        <div
          className="absolute inset-x-0 top-20 flex justify-center z-50"
          style={{ animation: 'alert-pulse 2s ease-in-out infinite' }}
        >
          <div
            className="px-10 py-5 rounded-2xl"
            style={{
              background: alerts[0].severity === 'critical' ? 'rgba(239,68,68,0.95)' : 'rgba(245,158,11,0.95)',
              backdropFilter: 'blur(12px)',
              maxWidth: 700,
              boxShadow: `0 20px 60px rgba(0,0,0,0.6)`,
            }}
          >
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>
              {alerts[0].severity === 'critical' ? '⚠️ URGENT ALERT' : '📢 NOTICE'}
            </div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, color: 'white', fontWeight: 500 }}>
              {alerts[0].message}
            </div>
          </div>
        </div>
      )}

      {/* ── TCP watermark ─────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-12 right-6 z-20"
        style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.1em', pointerEvents: 'none' }}
      >
        TCP v1
      </div>
    </div>
  )
}
