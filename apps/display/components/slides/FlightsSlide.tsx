'use client'

interface Flight {
  flight_number: string
  destination:   string
  scheduled:     string
  status:        string
  terminal?:     string
  gate?:         string
}

interface Props {
  iataCode:        string
  airportName:     string
  driveMinutes:    number | null
  colors:          { primary: string; accent_gold: string }
  flights:         Flight[]
}

const STATUS_COLOR: Record<string, string> = {
  'On Time':   '#2ecc71',
  'Boarding':  '#009FE3',
  'Departed':  '#71717a',
  'Delayed':   '#f59e0b',
  'Cancelled': '#ef4444',
}

const DEFAULT_FLIGHTS: Flight[] = [
  { flight_number: 'W6 1234', destination: 'Vienna (VIE)',        scheduled: '09:30', status: 'On Time',  gate: 'A3' },
  { flight_number: 'TK 386',  destination: 'Istanbul (IST)',       scheduled: '10:15', status: 'Boarding', gate: 'B1' },
  { flight_number: 'U6 503',  destination: 'Moscow (SVO)',         scheduled: '11:00', status: 'On Time',  gate: 'A5' },
  { flight_number: 'PC 946',  destination: 'Ankara (ESB)',         scheduled: '12:40', status: 'Delayed',  gate: 'B3' },
  { flight_number: 'GD 401',  destination: 'Tbilisi (TBS)',        scheduled: '14:20', status: 'On Time',  gate: 'A2' },
]

export default function FlightsSlide({ iataCode, airportName, driveMinutes, colors, flights }: Props) {
  const displayFlights = flights?.length ? flights : DEFAULT_FLIGHTS

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #08080f 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-16 pt-12 pb-6">
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase' }}>
            Departures
          </div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, color: 'white', marginTop: 4 }}>
            {airportName}
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div
            className="px-6 py-3 rounded-xl text-center"
            style={{ background: `${colors.primary}18`, border: `1px solid ${colors.primary}44` }}
          >
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 700, color: colors.primary }}>{iataCode}</div>
            {driveMinutes && (
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                🚗 {driveMinutes} min drive
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div
        className="flex items-center px-16 py-3 mx-16 rounded-lg mb-2"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div style={{ width: 130, fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Flight</div>
        <div style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Destination</div>
        <div style={{ width: 120, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Time</div>
        <div style={{ width: 80, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Gate</div>
        <div style={{ width: 140, textAlign: 'right', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Status</div>
      </div>

      {/* Flights */}
      <div className="flex-1 flex flex-col justify-center px-16 space-y-1">
        {displayFlights.slice(0, 6).map((flight, i) => {
          const statusColor = STATUS_COLOR[flight.status] ?? 'rgba(255,255,255,0.6)'
          return (
            <div
              key={i}
              className="flex items-center py-4 px-0 rounded-lg"
              style={{
                borderBottom: i < displayFlights.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                opacity: flight.status === 'Departed' ? 0.45 : 1,
              }}
            >
              <div style={{ width: 130, fontFamily: '"JetBrains Mono", monospace', fontSize: 18, color: colors.primary, fontWeight: 500 }}>
                {flight.flight_number}
              </div>
              <div style={{ flex: 1, fontFamily: '"Playfair Display", serif', fontSize: 22, color: 'white', fontWeight: 500 }}>
                {flight.destination}
              </div>
              <div style={{ width: 120, textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 22, color: 'white', fontWeight: 500 }}>
                {flight.scheduled}
              </div>
              <div style={{ width: 80, textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>
                {flight.gate ?? '—'}
              </div>
              <div style={{ width: 140, textAlign: 'right' }}>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    color: statusColor,
                    letterSpacing: '0.05em',
                  }}
                >
                  {flight.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}88, transparent)` }} />
    </div>
  )
}
