'use client'

import { useEffect, useState } from 'react'

interface HourlyItem { timeStr: string; emoji: string; tempShort: string }
interface DayItem    { day: string; emoji: string; maxC: number; minC: number; maxF: number; minF: number }

interface WeatherState {
  tempC:   number
  tempF:   number
  windKmh: number
  precip:  number
  icon:    string
  aqi:     number
  uv:      number
  hourly:  HourlyItem[]
  days:    DayItem[]
}

interface Props {
  city:     string
  lat:      number
  lon:      number
  timezone: string
}

// Exact match to tbilisi.html getWeatherEmoji
function wmoEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code === 1 || code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code >= 45 && code <= 48) return '🌫️'
  if (code >= 51 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌦️'
  if (code >= 95 && code <= 99) return '⛈️'
  return '⛅'
}

// Exact match to tbilisi.html formatTempShort
function formatTempShort(celsius: number): string {
  if (isNaN(celsius)) return '--°'
  const fahrenheit = Math.round((celsius * 9 / 5) + 32)
  return `${celsius}° / ${fahrenheit}°`
}

function toF(c: number) { return Math.round((c * 9 / 5) + 32) }

// AQI
function aqiColor(v: number)   { if (v <= 20) return '#00e400'; if (v <= 40) return '#ffff00'; if (v <= 60) return '#ff7e00'; if (v <= 80) return '#ff0000'; return '#8f3f97' }
function aqiLabel(v: number)   { if (v <= 20) return 'GOOD'; if (v <= 40) return 'FAIR'; if (v <= 60) return 'MODERATE'; if (v <= 80) return 'POOR'; return 'VERY POOR' }
function aqiComment(v: number) { if (v <= 20) return 'Ideal for outdoors'; if (v <= 40) return 'Acceptable air quality'; if (v <= 60) return 'Sensitive groups affected'; if (v <= 80) return 'Limit time outdoors'; return 'Stay indoors' }
function aqiMarker(v: number)  { return `${Math.min((v / 100) * 100, 96)}%` }

// UV
function uvColor(v: number)    { if (v <= 2) return '#289500'; if (v <= 5) return '#f7e400'; if (v <= 7) return '#f85900'; if (v <= 10) return '#d8001d'; return '#6b49c8' }
function uvLabel(v: number)    { if (v <= 2) return 'LOW'; if (v <= 5) return 'MODERATE'; if (v <= 7) return 'HIGH'; if (v <= 10) return 'VERY HIGH'; return 'EXTREME' }
function uvComment(v: number)  { if (v <= 2) return 'Minimal protection needed'; if (v <= 5) return 'Protection needed'; if (v <= 7) return 'Apply sunscreen'; if (v <= 10) return 'Avoid midday sun'; return 'Stay indoors' }
function uvMarker(v: number)   { return `${Math.min((v / 12) * 100, 96)}%` }

const S = {
  muted:         '#b0b0b0',
  tbc_blue:      '#009FE3',
  widget_bg:     'rgba(255,255,255,0.03)',
  widget_border: 'rgba(255,255,255,0.08)',
}

export default function WeatherWidget({ city, lat, lon, timezone }: Props) {
  const [wx, setWx]       = useState<WeatherState | null>(null)
  const [sideTime, setSideTime] = useState('')

  // Sidebar clock — DD.MM.YYYY HH:MM
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const dd  = String(now.getDate()).padStart(2, '0')
      const mm  = String(now.getMonth() + 1).padStart(2, '0')
      const yy  = now.getFullYear()
      const hh  = String(now.getHours()).padStart(2, '0')
      const mi  = String(now.getMinutes()).padStart(2, '0')
      setSideTime(`${dd}.${mm}.${yy} ${hh}:${mi}`)
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  // Weather fetch — exact same URLs as tbilisi.html
  useEffect(() => {
    async function fetch_() {
      try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,precipitation&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max&timezone=auto&forecast_days=4`
        const aqiUrl     = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`

        const [wRes, aRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)])
        const wd = await wRes.json()
        const ad = await aRes.json()

        const tempC = Math.round(wd.current.temperature_2m)
        const tempF = toF(tempC)
        const aqi   = Math.round(ad.current?.european_aqi ?? 0)
        const uv    = Math.round(wd.daily?.uv_index_max?.[0] ?? 0)

        // Hourly: find index closest to now, show 5 starting from that
        const nowTime  = new Date().getTime()
        let startIndex = (wd.hourly.time as string[]).findIndex((t: string) => new Date(t).getTime() > nowTime)
        if (startIndex === -1) startIndex = 0
        if (startIndex > 0) startIndex -= 1

        const hourly: HourlyItem[] = []
        for (let i = 0; i < 5; i++) {
          const idx = startIndex + i
          if (idx >= (wd.hourly.time as string[]).length) break
          const timeStr = i === 0
            ? 'NOW'
            : new Date(wd.hourly.time[idx]).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
          hourly.push({
            timeStr,
            emoji:    wmoEmoji(wd.hourly.weather_code[idx]),
            tempShort: formatTempShort(Math.round(wd.hourly.temperature_2m[idx])),
          })
        }

        // 3-day forecast
        const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        const days: DayItem[] = (wd.daily.time as string[]).slice(0, 3).map((t: string, i: number) => {
          const maxC = Math.round(wd.daily.temperature_2m_max[i])
          const minC = Math.round(wd.daily.temperature_2m_min[i])
          return {
            day:   i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : DAYS[new Date(t).getDay()].toUpperCase(),
            emoji: wmoEmoji(wd.daily.weather_code[i]),
            maxC, minC,
            maxF: toF(maxC),
            minF: toF(minC),
          }
        })

        setWx({ tempC, tempF, windKmh: Math.round(wd.current.wind_speed_10m), precip: wd.current.precipitation ?? 0, icon: wmoEmoji(wd.current.weather_code), aqi, uv, hourly, days })
      } catch (e) {
        console.warn('[TCP Weather] fetch error', e)
      }
    }
    fetch_()
    const id = setInterval(fetch_, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [lat, lon])

  return (
    <div id="routine-view" style={{ padding: 15, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-evenly', gap: 12 }}>

      {/* Location + sidebar time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, width: '100%' }}>
        <div style={{ fontSize: 10, color: S.tbc_blue, letterSpacing: 2, fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
          📍 LOCATION: {city.toUpperCase()} COAST
        </div>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 'bold', letterSpacing: 1, background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)' }}>
          {sideTime || '--.--.---- --:--'}
        </div>
      </div>

      {/* Weather hero */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Icon */}
          <div style={{ fontSize: 36, lineHeight: 1, filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))' }}>
            {wx?.icon ?? '⛅'}
          </div>
          {/* Temp — exact mbTemp format */}
          <div>
            <div style={{ fontSize: 10, color: S.muted, fontWeight: 800, letterSpacing: 2, marginBottom: 2 }}>°C &nbsp;&nbsp;&nbsp;&nbsp; °F</div>
            <div style={{ fontSize: 28, lineHeight: 1 }}>
              {wx ? (
                <>{wx.tempC}° <span style={{ fontWeight: 300, opacity: 0.3, margin: '0 2px' }}>|</span> {wx.tempF}°</>
              ) : '--° | --°'}
            </div>
            <div style={{ fontSize: 13, color: '#00bcd4', fontWeight: 600 }}>
              {wx ? (wx.tempC >= 30 ? 'Hot' : wx.tempC >= 20 ? 'Warm' : wx.tempC >= 10 ? 'Mild' : 'Cold') : '--'}
            </div>
          </div>
        </div>
        {/* Wind + precip */}
        <div style={{ textAlign: 'right', fontSize: 11, color: S.muted, lineHeight: 1.4 }}>
          <div>Wind: {wx ? `${wx.windKmh} km/h` : '-- km/h'}</div>
          <div>Precip: {wx ? `${wx.precip} mm` : '0 mm'}</div>
        </div>
      </div>

      {/* Hourly wrapper */}
      <div style={{ margin: '5px 0', position: 'relative', padding: '5px 0' }}>
        <div style={{ position: 'absolute', top: 48, left: '5%', width: '90%', height: 1, background: 'rgba(255,255,255,0.2)', zIndex: 0 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {(wx?.hourly ?? Array(5).fill({ timeStr: '--', emoji: '⛅', tempShort: '--°' })).map((h, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative', width: '18%' }}>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, textTransform: 'uppercase' }}>{h.timeStr}</div>
              <div style={{ fontSize: 20, marginTop: 2 }}>{h.emoji}</div>
              <div style={{ width: 8, height: 8, background: S.tbc_blue, borderRadius: '50%', margin: '6px 0', boxShadow: `0 0 8px ${S.tbc_blue}` }} />
              <div style={{ fontSize: 10, fontWeight: 900, color: '#fff', marginTop: 4, textAlign: 'center' }}>{h.tempShort}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Forecast grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {(wx?.days ?? Array(3).fill({ day: '--', emoji: '⛅', maxC: 0, minC: 0, maxF: 0, minF: 0 })).map((d, i) => (
          <div key={i} style={{ background: S.widget_bg, border: `1px solid ${S.widget_border}`, borderRadius: 10, padding: '6px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: S.muted, textTransform: 'uppercase' }}>{d.day}</div>
            <div style={{ fontSize: 18, margin: '2px 0' }}>{d.emoji}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {/* °C row */}
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: '#fff', fontSize: 13 }}>{wx ? `${d.maxC}°` : '--°'}</span>
                <span style={{ color: S.muted, fontSize: 11 }}>{wx ? `${d.minC}°C` : '--°C'}</span>
              </div>
              {/* °F row */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
                <span style={{ color: '#ddd', fontSize: 11 }}>{wx ? `${d.maxF}°` : '--°'}</span>
                <span style={{ color: '#888', fontSize: 10 }}>{wx ? `${d.minF}°F` : '--°F'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AQI + UV art-grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 5 }}>
        {/* AQI */}
        <div style={{ background: S.widget_bg, border: `1px solid ${S.widget_border}`, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 30px rgba(0,228,0,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, letterSpacing: 1, marginBottom: 2 }}>AIR QUALITY</div>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{wx?.aqi ?? '--'}</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: wx ? aqiColor(wx.aqi) : '#00e400', marginBottom: 6 }}>
            {wx ? aqiLabel(wx.aqi) : 'GOOD'}
          </div>
          <div style={{ height: 8, width: '100%', borderRadius: 4, background: 'linear-gradient(to right,#00e400 0%,#ffff00 20%,#ff7e00 40%,#ff0000 60%,#8f3f97 80%,#7e0023 100%)', position: 'relative', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)', marginBottom: 6 }}>
            <div style={{ position: 'absolute', top: -2, left: wx ? aqiMarker(wx.aqi) : '15%', width: 4, height: 12, background: '#fff', border: '1px solid #000', borderRadius: 2, boxShadow: '0 0 5px rgba(0,0,0,0.8)', transition: 'left 1s ease-in-out' }} />
          </div>
          <div style={{ fontSize: 9, color: S.muted, lineHeight: 1.1 }}>{wx ? aqiComment(wx.aqi) : 'Ideal for outdoors'}</div>
        </div>

        {/* UV */}
        <div style={{ background: S.widget_bg, border: `1px solid ${S.widget_border}`, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 30px rgba(247,228,0,0.05)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: S.muted, letterSpacing: 1, marginBottom: 2 }}>UV INDEX</div>
          <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{wx?.uv ?? '--'}</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: wx ? uvColor(wx.uv) : '#f7e400', marginBottom: 6 }}>
            {wx ? uvLabel(wx.uv) : 'MODERATE'}
          </div>
          <div style={{ height: 8, width: '100%', borderRadius: 4, background: 'linear-gradient(to right,#289500 0%,#f7e400 30%,#f85900 50%,#d8001d 75%,#6b49c8 100%)', position: 'relative', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)', marginBottom: 6 }}>
            <div style={{ position: 'absolute', top: -2, left: wx ? uvMarker(wx.uv) : '45%', width: 4, height: 12, background: '#fff', border: '1px solid #000', borderRadius: 2, boxShadow: '0 0 5px rgba(0,0,0,0.8)', transition: 'left 1s ease-in-out' }} />
          </div>
          <div style={{ fontSize: 9, color: S.muted, lineHeight: 1.1 }}>{wx ? uvComment(wx.uv) : 'Protection needed'}</div>
        </div>
      </div>
    </div>
  )
}
