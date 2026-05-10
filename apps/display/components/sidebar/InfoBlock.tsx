'use client'

import { useEffect, useState } from 'react'

interface Props { rates: { currency: string; buy: number; sell: number; flag: string }[] }

function applySpread(rate: number, isBuy: boolean) {
  return isBuy ? (rate * 0.985).toFixed(3) : (rate * 1.015).toFixed(3)
}

interface NBGRate { currency: string; buy: string; sell: string }

function useLiveRates(fallback: Props['rates']) {
  const [rates, setRates] = useState<NBGRate[]>([])

  useEffect(() => {
    async function fetch_() {
      try {
        const res  = await fetch(`https://corsproxy.io/?${encodeURIComponent('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json')}`)
        const data = await res.json()
        const currencies = data[0].currencies as { code: string; rate: number }[]
        const wanted = ['USD', 'EUR', 'TRY']
        const result = wanted.map(code => {
          const c = currencies.find(x => x.code === code)
          return c
            ? { currency: code, buy: applySpread(c.rate, true), sell: applySpread(c.rate, false) }
            : null
        }).filter(Boolean) as NBGRate[]
        setRates(result)
      } catch {
        // Use fallback passed in from display-config
        setRates(fallback.map(r => ({ currency: r.currency, buy: r.buy.toFixed(3), sell: r.sell.toFixed(3) })))
      }
    }
    fetch_()
    const id = setInterval(fetch_, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return rates.length ? rates : fallback.map(r => ({ currency: r.currency, buy: r.buy.toFixed(3), sell: r.sell.toFixed(3) }))
}

function SolarTracker() {
  const [solar, setSolar] = useState<{ sunrise: string; noon: string; sunset: string; dayLen: string; pct: number } | null>(null)

  useEffect(() => {
    async function fetch_() {
      try {
        const res  = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.6546&longitude=41.6384&daily=sunrise,sunset&timezone=auto&forecast_days=1')
        const data = await res.json()
        const rise = new Date(data.daily.sunrise[0])
        const set  = new Date(data.daily.sunset[0])
        const noon = new Date((rise.getTime() + set.getTime()) / 2)
        const now  = new Date()

        const dayLen = set.getTime() - rise.getTime()
        const h   = Math.floor(dayLen / 3600000)
        const m   = Math.round((dayLen % 3600000) / 60000)
        const pct = (now.getHours() * 3600000 + now.getMinutes() * 60000) / 86400000 * 100

        const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        setSolar({ sunrise: fmt(rise), noon: fmt(noon), sunset: fmt(set), dayLen: `${h}h ${m}m`, pct: Math.min(pct, 100) })
      } catch {}
    }
    fetch_()
  }, [])

  const sunrisePct = 22.6
  const sunsetPct  = 80.3
  const pct        = solar?.pct ?? 50

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 15px' }}>
      {/* Solar timeline */}
      <div style={{ width: '100%', borderRadius: 6, overflow: 'hidden', background: '#000', position: 'relative', height: 22 }}>
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <rect x="0%" y="0" width={`${sunrisePct}%`} height="100%" fill="#1a2a42" />
          <rect x={`${sunrisePct}%`} y="0" width="6.5%" height="100%" fill="#d35400" />
          <rect x={`${sunrisePct + 6.5}%`} y="0" width={`${sunsetPct - sunrisePct - 6.5}%`} height="100%" fill="#ffcc00" />
          <rect x={`${sunsetPct}%`} y="0" width="6.5%" height="100%" fill="#d35400" />
          <rect x={`${sunsetPct + 6.5}%`} y="0" width={`${100 - sunsetPct - 6.5}%`} height="100%" fill="#1a2a42" />
          <line x1={`${pct}%`} y1="0" x2={`${pct}%`} y2="100%" stroke="white" strokeWidth="4" />
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b0b0b0', fontSize: 10, fontWeight: 'bold', marginTop: 4, padding: '0 2px' }}>
        {['00:00','06:00','12:00','18:00','24:00'].map(t => <span key={t}>{t}</span>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 5px' }}>
        {[
          { label: 'SUNRISE',    val: solar?.sunrise ?? '--:--', accent: false },
          { label: 'SOLAR NOON', val: solar?.noon    ?? '--:--', accent: true  },
          { label: 'SUNSET',     val: solar?.sunset  ?? '--:--', accent: false },
          { label: 'DAY LENGTH', val: solar?.dayLen  ?? '--h --m', accent: true },
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

export default function InfoBlock({ rates: fallback }: Props) {
  const [showCurrency, setShowCurrency] = useState(true)
  const liveRates = useLiveRates(fallback)

  useEffect(() => {
    const id = setInterval(() => setShowCurrency(s => !s), 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ flexShrink: 0, position: 'relative', height: 145, width: '100%' }}>
      {/* Currency block */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        opacity: showCurrency ? 1 : 0, transition: 'opacity 0.8s ease-in-out',
        zIndex: showCurrency ? 2 : 1, pointerEvents: showCurrency ? 'auto' : 'none',
      }}>
        <div style={{ background: '#111', border: '1px solid #009FE3', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#009FE3', color: 'white', padding: 8, fontSize: 10, fontWeight: 'bold', textAlign: 'center', letterSpacing: 0.5 }}>
            NATIONAL BANK EXCHANGE RATE (GEL)
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', fontSize: 9, padding: '4px 10px', borderBottom: '1px solid #222', textAlign: 'center', color: '#b0b0b0', fontWeight: 'bold' }}>
              <span>CURR</span><span>BUY</span><span>SELL</span>
            </div>
            {liveRates.slice(0, 3).map(r => (
              <div key={r.currency} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #222', textAlign: 'center' }}>
                <span style={{ color: 'white', fontWeight: 700 }}>{r.currency}</span>
                <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>{r.buy}</span>
                <span style={{ color: '#ff4d4d', fontWeight: 'bold' }}>{r.sell}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Solar block */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        opacity: showCurrency ? 0 : 1, transition: 'opacity 0.8s ease-in-out',
        zIndex: showCurrency ? 1 : 2, pointerEvents: showCurrency ? 'none' : 'auto',
      }}>
        <div style={{ background: '#111', border: '1px solid #ffcc00', borderRadius: 12, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#ffcc00', color: '#000', padding: 8, fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>
            SOLAR TRACKER & DAY LENGTH
          </div>
          <SolarTracker />
        </div>
      </div>
    </div>
  )
}
