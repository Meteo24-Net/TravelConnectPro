'use client'

import { useEffect, useState } from 'react'

interface Flight {
  flight_number: string
  destination:   string
  scheduled:     string   // "HH:MM"
  status:        string
  gate?:         string
}

interface Props {
  iataCode:     string
  airportName:  string
  driveMinutes: number
  accentGold:   string
  flights?:     Flight[]
}

const STATUS_CLASS: Record<string, string> = {
  'On Time':   'color: #2ecc71',
  'Boarding':  'color: #009FE3',
  'Departed':  'color: #555',
  'Delayed':   'color: #ffcc00',
  'Cancelled': 'color: #ff4d4d',
}

function taxiFare(driveMins: number): string {
  if (driveMins <= 15) return 'EST. FARE: 20–30 GEL'
  if (driveMins <= 30) return 'EST. FARE: 30–45 GEL'
  return 'EST. FARE: 45–65 GEL'
}

function smartDeparture(scheduledTime: string, driveMins: number, isDept: boolean): string {
  const [h, m] = scheduledTime.split(':').map(Number)
  const sch    = new Date()
  sch.setHours(h, m, 0, 0)

  let smart: Date
  if (isDept) {
    smart = new Date(sch.getTime() - (driveMins + 120) * 60000)
  } else {
    smart = new Date(sch.getTime() + (45 + driveMins) * 60000)
  }
  return smart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const DEMO_FLIGHTS: Flight[] = [
  { flight_number: 'W6 1234', destination: 'Vienna (VIE)',    scheduled: '09:30', status: 'On Time',  gate: 'A3' },
  { flight_number: 'TK 386',  destination: 'Istanbul (IST)',  scheduled: '10:15', status: 'Boarding', gate: 'B1' },
  { flight_number: 'U6 503',  destination: 'Moscow (SVO)',    scheduled: '11:00', status: 'On Time',  gate: 'A5' },
  { flight_number: 'PC 946',  destination: 'Ankara (ESB)',    scheduled: '12:40', status: 'Delayed',  gate: 'B3' },
  { flight_number: 'GD 401',  destination: 'Tbilisi (TBS)',   scheduled: '14:20', status: 'On Time',  gate: 'A2' },
]

export default function FlightsPanel({ iataCode, airportName, driveMinutes, accentGold, flights }: Props) {
  const [clock, setClock]     = useState('')
  const [isDept, setIsDept]   = useState(true)
  const [page, setPage]       = useState(0)
  const [animKey, setAnimKey] = useState(0)

  const displayFlights = flights?.length ? flights : DEMO_FLIGHTS
  const ROWS = 5
  const totalPages = Math.ceil(displayFlights.length / ROWS)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Rotate pages every 12s
  useEffect(() => {
    const id = setInterval(() => {
      setAnimKey(k => k + 1)
      setTimeout(() => {
        setPage(p => {
          const next = p + 1
          if (next >= totalPages) { setIsDept(d => !d); return 0 }
          return next
        })
      }, 400)
    }, 12000)
    return () => clearInterval(id)
  }, [totalPages])

  const pageFlights = displayFlights.slice(page * ROWS, (page + 1) * ROWS)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Header */}
      <header style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #333', paddingBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>
              {iataCode}{' '}
              <span style={{ color: isDept ? '#009FE3' : '#2ecc71', transition: 'color 0.5s' }}>
                {isDept ? 'DEPARTURES' : 'ARRIVALS'}
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, color: '#ddd' }}>
              ✈️ {airportName}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 5, fontWeight: 'bold' }}>LIVE AIRPORT DATA</div>

          {/* Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginTop: 15 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderRight: '2px solid #333', paddingRight: 15 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: 'white', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1 }}>BATUMI</span>
              <span style={{ fontSize: 10, color: '#009FE3', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 900 }}>LOCAL TIME</span>
            </div>
            <span style={{ fontSize: 34, fontWeight: 300, color: 'white', letterSpacing: 2, lineHeight: 1, fontFamily: '"JetBrains Mono", monospace' }}>
              {clock}
            </span>
          </div>
        </div>

        {/* Drive time + fare */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
          <div style={{ fontSize: 'clamp(30px,4vw,56px)', fontWeight: 'bold', color: accentGold, lineHeight: 1, marginBottom: 5 }}>
            {driveMinutes} min
          </div>
          <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase' }}>Direct Airport Transfer</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#2ecc71', marginTop: 6, letterSpacing: 1 }}>
            {taxiFare(driveMinutes)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.4)', color: '#2ecc71', padding: '5px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900, letterSpacing: 0.5 }}>
              💸 VAT REFUND: 15 MIN
            </div>
            <div style={{ background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.4)', color: accentGold, padding: '5px 8px', borderRadius: 6, fontSize: 9, fontWeight: 900 }}>
              🛍️ DUTY FREE: OPEN
            </div>
          </div>
        </div>
      </header>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {['Flight','Destination','Time','Status','Smart Departure'].map((h, i) => (
                <th key={h} style={{
                  textAlign: 'left', color: 'white', fontSize: 13, fontWeight: 'bold',
                  textTransform: 'uppercase', padding: '0 12px 10px',
                  borderBottom: '2px solid #555', letterSpacing: 0.5,
                  width: ['12%','33%','15%','20%','20%'][i],
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={animKey}>
            {pageFlights.map((f, i) => {
              const smart = smartDeparture(f.scheduled, driveMinutes, isDept)
              const statusStyle = STATUS_CLASS[f.status] ?? 'color: #2ecc71'
              return (
                <tr
                  key={f.flight_number}
                  style={{
                    height: 70,
                    animation: `flipDownIn 0.5s ${i * 0.15}s ease-out backwards`,
                    opacity: f.status === 'Departed' ? 0.45 : 1,
                  }}
                >
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #222', fontSize: 'clamp(12px,1.4vw,17px)', verticalAlign: 'middle' }}>
                    <b style={{ color: isDept ? '#009FE3' : '#2ecc71', fontFamily: '"JetBrains Mono", monospace', fontSize: '110%' }}>{f.flight_number}</b>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #222', verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{f.destination}</div>
                    <div style={{ fontSize: 12, color: accentGold, fontWeight: 'bold' }}>Live Status</div>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #222', verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 'bold', fontFamily: '"JetBrains Mono", monospace' }}>{f.scheduled}</div>
                    {f.gate && <div style={{ fontSize: 11, color: '#666' }}>Gate {f.gate}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #222', verticalAlign: 'middle' }}>
                    <div style={{ textTransform: 'uppercase', fontWeight: 900, fontSize: 12, ...Object.fromEntries([statusStyle.split(': ')]) }}>
                      {f.status}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #222', verticalAlign: 'middle' }}>
                    <div style={{
                      background: isDept ? 'rgba(0,159,227,0.15)' : 'rgba(46,204,113,0.15)',
                      color: isDept ? '#009FE3' : '#2ecc71',
                      fontWeight: 'bold', textAlign: 'center', borderRadius: 8,
                      padding: '8px 12px',
                      border: isDept ? '1px solid rgba(0,159,227,0.3)' : '1px solid rgba(46,204,113,0.3)',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}>
                      {smart}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes flipDownIn {
          0%   { transform: rotateX(-90deg); opacity: 0; }
          100% { transform: rotateX(0deg);  opacity: 1; }
        }
      `}</style>
    </div>
  )
}
