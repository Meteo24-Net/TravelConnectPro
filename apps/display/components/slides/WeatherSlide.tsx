'use client'

interface WeatherData {
  temp_c:        number
  condition:     string
  icon:          string
  wind_kmh:      number
  precip_mm:     number
  uv_index:      number
  forecast:      { day: string; high: number; low: number; icon: string }[]
}

interface Props {
  city:   string
  colors: { primary: string; accent_gold: string }
  data:   WeatherData | null
}

const CONDITION_ICONS: Record<string, string> = {
  clear: '☀️', sunny: '☀️', cloudy: '☁️', 'partly cloudy': '⛅',
  rain: '🌧️', drizzle: '🌦️', storm: '⛈️', snow: '❄️', fog: '🌫️',
  wind: '💨', hail: '🌨️',
}

function getIcon(condition: string) {
  const lower = condition.toLowerCase()
  for (const [key, icon] of Object.entries(CONDITION_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '🌤️'
}

export default function WeatherSlide({ city, colors, data }: Props) {
  const c = data ? Math.round(data.temp_c) : 0
  const f = Math.round((c * 9/5) + 32)

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        <div className="text-center text-white/30 font-sans">
          <div className="text-6xl mb-6">🌤️</div>
          <div className="text-xl uppercase tracking-widest">Connecting to Meteo24…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-transparent">
      {/* Top bar */}
      <div className="flex items-center justify-between px-10 pt-8 pb-4">
        <div>
          <div className="text-[10px] font-black tracking-[0.3em] text-[#c5a059] uppercase mb-1">
            Local Forecast
          </div>
          <div className="text-3xl font-serif text-white">
            {city}
          </div>
        </div>
      </div>

      {/* Main weather */}
      <div className="flex-1 flex items-center px-10 gap-16">
        {/* Current conditions */}
        <div className="flex items-center gap-8">
          <div className="text-[120px] drop-shadow-2xl">{getIcon(data.condition)}</div>
          <div>
            <div className="flex items-start gap-4">
              <div className="text-[130px] font-serif font-bold text-white leading-none drop-shadow-2xl">
                {c}
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <div className="text-4xl font-bold text-white">°C</div>
                <div className="h-[1px] w-full bg-white/20" />
                <div className="text-2xl font-medium text-white/40">{f}°F</div>
              </div>
            </div>
            <div className="text-2xl font-light text-[#00bcd4] tracking-wide mt-4 uppercase font-bold">
              {data.condition}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4 max-w-md">
          {[
            { icon: '💨', label: 'Wind Speed',    value: `${data.wind_kmh} km/h` },
            { icon: '💧', label: 'Humidity',      value: `${data.uv_index > 5 ? 'High' : 'Moderate'}` },
            { icon: '🌧️', label: 'Precipitation', value: `${data.precip_mm} mm` },
            { icon: '☀️', label: 'UV Index',       value: `${data.uv_index}` },
          ].map(stat => (
            <div key={stat.label} className="glass-panel rounded-2xl p-4 flex items-center gap-4 border-white/5">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">{stat.label}</div>
                <div className="text-lg font-bold text-white">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Forecast */}
        {data.forecast?.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.forecast.slice(0, 3).map((day, i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 flex items-center gap-6 border-white/5">
                <div className="w-10 text-xs font-black text-white/40 uppercase">{day.day}</div>
                <div className="text-3xl">{getIcon(day.icon)}</div>
                <div className="flex flex-col">
                  <div className="text-lg font-bold text-white">{Math.round(day.high)}°</div>
                  <div className="text-[10px] font-bold text-white/30">{Math.round(day.low)}°</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
