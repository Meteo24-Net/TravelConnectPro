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
  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #050508, #0a0a18)' }}>
        <div className="text-center" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: 48 }}>🌤️</div>
          <div style={{ fontSize: 18, marginTop: 16 }}>Weather data loading…</div>
          <div style={{ fontSize: 13, marginTop: 8, opacity: 0.6 }}>Updates hourly via weather API</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050510 0%, #08081a 60%, #050508 100%)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-16 pt-12 pb-6">
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase' }}>
            Weather
          </div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, color: 'white', marginTop: 4 }}>
            {city}
          </div>
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Updated hourly
        </div>
      </div>

      {/* Main weather */}
      <div className="flex-1 flex items-center px-16 gap-20">
        {/* Current conditions */}
        <div className="flex items-center gap-10">
          <div style={{ fontSize: 100 }}>{getIcon(data.condition)}</div>
          <div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 110, fontWeight: 600, color: 'white', lineHeight: 1, textShadow: `0 0 60px ${colors.primary}55` }}>
              {Math.round(data.temp_c)}°
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 22, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {data.condition}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 160, background: 'rgba(255,255,255,0.1)' }} />

        {/* Stats */}
        <div className="space-y-5">
          {[
            { icon: '💨', label: 'Wind',        value: `${data.wind_kmh} km/h` },
            { icon: '🌧️', label: 'Precipitation', value: `${data.precip_mm} mm` },
            { icon: '☀️', label: 'UV Index',     value: data.uv_index <= 2 ? `${data.uv_index} Low` : data.uv_index <= 5 ? `${data.uv_index} Moderate` : `${data.uv_index} High` },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-4">
              <span style={{ fontSize: 24 }}>{stat.icon}</span>
              <div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{stat.label}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, color: 'white', fontWeight: 500 }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Forecast */}
        {data.forecast?.length > 0 && (
          <>
            <div style={{ width: 1, height: 160, background: 'rgba(255,255,255,0.1)' }} />
            <div className="flex gap-8">
              {data.forecast.slice(0, 3).map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-2"
                  style={{
                    padding: '16px 20px',
                    borderRadius: 12,
                    background: i === 0 ? `${colors.primary}18` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${i === 0 ? colors.primary + '44' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{day.day}</div>
                  <div style={{ fontSize: 32 }}>{getIcon(day.icon)}</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 16, color: 'white', fontWeight: 600 }}>{Math.round(day.high)}°</div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{Math.round(day.low)}°</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}88, transparent)` }} />
    </div>
  )
}
