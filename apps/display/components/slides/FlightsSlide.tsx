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
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between px-10 pt-8 pb-4">
        <div>
          <div className="text-[10px] font-black tracking-[0.3em] text-[#c5a059] uppercase mb-1">
            Airport Departures
          </div>
          <div className="text-3xl font-serif text-white">
            {airportName}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="bg-white/5 border border-white/10 px-5 py-2 rounded-2xl text-center">
            <div className="text-2xl font-black text-[#009FE3] tracking-tighter">{iataCode}</div>
            {driveMinutes && (
              <div className="text-[9px] font-bold text-white/30 uppercase mt-1">
                {driveMinutes} min drive
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-10 py-3 mx-10 rounded-xl mb-4 bg-white/5 border border-white/5">
        <div className="w-32 text-[10px] font-black text-white/30 uppercase tracking-widest">Flight</div>
        <div className="flex-1 text-[10px] font-black text-white/30 uppercase tracking-widest">Destination</div>
        <div className="w-24 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">Time</div>
        <div className="w-20 text-center text-[10px] font-black text-white/30 uppercase tracking-widest">Gate</div>
        <div className="w-32 text-right text-[10px] font-black text-white/30 uppercase tracking-widest">Status</div>
      </div>

      {/* Flights List */}
      <div className="flex-1 px-10 overflow-hidden">
        {displayFlights.slice(0, 7).map((flight, i) => {
          const statusColor = STATUS_COLOR[flight.status] ?? 'rgba(255,255,255,0.6)'
          return (
            <div
              key={i}
              className="flex items-center py-4 border-b border-white/5 last:border-0"
              style={{ opacity: flight.status === 'Departed' ? 0.3 : 1 }}
            >
              <div className="w-32 font-mono text-lg font-bold text-[#009FE3]">
                {flight.flight_number}
              </div>
              <div className="flex-1 font-serif text-xl text-white font-medium">
                {flight.destination}
              </div>
              <div className="w-24 text-center font-mono text-xl text-white">
                {flight.scheduled}
              </div>
              <div className="w-20 text-center font-mono text-lg text-white/40">
                {flight.gate ?? '—'}
              </div>
              <div className="w-32 text-right">
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: statusColor }}>
                  {flight.status}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
