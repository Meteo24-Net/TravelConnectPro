'use client'

import { useEffect, useState, useMemo } from 'react'
import SunCalc from 'suncalc'

interface Rate { currency: string; buy: number; sell: number; flag: string }

interface Props {
  rates: Rate[]
  lat: number
  lon: number
}

/* ─── Solar Tracker (matches tbilisi.html exactly) ───────────────────────── */

function SolarTracker({ lat, lon }: { lat: number; lon: number }) {
  const solar = useMemo(() => {
    const now = new Date()
    const times = SunCalc.getTimes(now, lat, lon)

    const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    const dayLenMs = times.sunset.getTime() - times.sunrise.getTime()
    const h = Math.floor(dayLenMs / 3600000)
    const m = Math.round((dayLenMs % 3600000) / 60000)

    // Current position in the 24-hour timeline (0-100%)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const pct = ((now.getTime() - dayStart) / 86400000) * 100

    return {
      sunrise: fmt(times.sunrise),
      noon: fmt(times.solarNoon),
      sunset: fmt(times.sunset),
      dayLen: `${h}h ${m}m`,
      pct: Math.min(Math.max(pct, 0), 100),
    }
  }, [lat, lon])

  return (
    <div style={{ padding: '12px 15px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Timeline bar — exact match to tbilisi.html */}
      <div style={{ width: '100%', borderRadius: 6, overflow: 'hidden', background: '#000', position: 'relative', height: 22 }}>
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <rect x="0%"     y="0" width="22.6%" height="100%" fill="#1a2a42" />
          <rect x="22.6%"  y="0" width="6.5%"  height="100%" fill="#d35400" />
          <rect x="29.1%"  y="0" width="51.2%" height="100%" fill="#ffcc00" />
          <rect x="80.3%"  y="0" width="6.5%"  height="100%" fill="#d35400" />
          <rect x="86.8%"  y="0" width="13.2%" height="100%" fill="#1a2a42" />
          <line x1={`${solar.pct}%`} y1="0" x2={`${solar.pct}%`} y2="100%" stroke="white" strokeWidth="4" />
        </svg>
      </div>
      {/* Time labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b0b0b0', fontSize: 10, fontWeight: 'bold', marginTop: 4, padding: '0 2px' }}>
        {['00:00', '06:00', '12:00', '18:00', '24:00'].map(t => <span key={t}>{t}</span>)}
      </div>
      {/* Sun data grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 5px' }}>
        {[
          { label: 'SUNRISE',    val: solar.sunrise, accent: false },
          { label: 'SOLAR NOON', val: solar.noon,    accent: true  },
          { label: 'SUNSET',     val: solar.sunset,  accent: false },
          { label: 'DAY LENGTH', val: solar.dayLen,  accent: true  },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#b0b0b0', textTransform: 'uppercase', marginBottom: 2, fontWeight: 800 }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: s.accent ? '#ffcc00' : '#fff', lineHeight: 1 }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── InfoBlock: Currency ↔ Solar slider ─────────────────────────────────── */

export default function InfoBlock({ rates, lat, lon }: Props) {
  const [showCurrency, setShowCurrency] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setShowCurrency(s => !s), 8000)
    return () => clearInterval(id)
  }, [])

  const displayRates = rates.slice(0, 3)

  return (
    <div style={{ flexShrink: 0, position: 'relative', height: 145, width: '100%' }}>

      {/* ── Currency block ─────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        opacity: showCurrency ? 1 : 0,
        transition: 'opacity 0.8s ease-in-out',
        zIndex: showCurrency ? 2 : 1,
        pointerEvents: showCurrency ? 'auto' : 'none',
      }}>
        <div style={{
          background: '#111', border: '1px solid #009FE3', borderRadius: 12,
          overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            background: '#009FE3', color: 'white', padding: 8,
            fontSize: 10, fontWeight: 'bold', textAlign: 'center', flexShrink: 0, letterSpacing: 0.5,
          }}>
            NATIONAL BANK EXCHANGE RATE (GEL)
          </div>
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 5,
              fontSize: 9, padding: '6px 10px', borderBottom: '1px solid #222',
              textAlign: 'center', color: '#b0b0b0',
            }}>
              <span>CURR</span><span>BUY</span><span>SELL</span>
            </div>
            {displayRates.length > 0 ? displayRates.map(r => (
              <div key={r.currency} style={{
                display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 5,
                fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #222',
                textAlign: 'center',
              }}>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{r.currency}</span>
                <span style={{ color: '#2ecc71', fontWeight: 'bold', transition: 'color 0.3s' }}>{r.buy?.toFixed(3) ?? '--'}</span>
                <span style={{ color: '#ff4d4d', fontWeight: 'bold', transition: 'color 0.3s' }}>{r.sell?.toFixed(3) ?? '--'}</span>
              </div>
            )) : (
              <>
                {['USD', 'EUR', 'TRY'].map(c => (
                  <div key={c} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 5,
                    fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #222',
                    textAlign: 'center',
                  }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{c}</span>
                    <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>--</span>
                    <span style={{ color: '#ff4d4d', fontWeight: 'bold' }}>--</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Solar block ────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        opacity: showCurrency ? 0 : 1,
        transition: 'opacity 0.8s ease-in-out',
        zIndex: showCurrency ? 1 : 2,
        pointerEvents: showCurrency ? 'none' : 'auto',
      }}>
        <div style={{
          background: '#111', border: '1px solid #ffcc00', borderRadius: 12,
          overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            background: '#ffcc00', color: '#000', padding: 8,
            fontSize: 10, fontWeight: 'bold', textAlign: 'center', flexShrink: 0,
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            Solar Tracker & Day Length
          </div>
          <SolarTracker lat={lat} lon={lon} />
        </div>
      </div>
    </div>
  )
}
