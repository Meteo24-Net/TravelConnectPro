'use client'

interface Props {
  hotelName:   string
  greeting:    string
  subtext:     string
  highlight:   string
  logoUrl:     string | null
  colors:      { primary: string; accent_gold: string; background: string }
  timeOfDay:   'morning' | 'afternoon' | 'evening' | 'night'
}

const GREETING_DEFAULTS = {
  morning:   'Good morning',
  afternoon: 'Good afternoon',
  evening:   'Good evening',
  night:     'Good night',
}

export default function WelcomeSlide({ hotelName, greeting, subtext, highlight, logoUrl, colors, timeOfDay }: Props) {
  const displayGreeting = greeting || GREETING_DEFAULTS[timeOfDay]

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 30% 50%, ${colors.primary}22 0%, ${colors.background} 60%)` }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent_gold}, transparent)` }} />

      {/* Hotel name / logo */}
      <div className="absolute top-12 left-16 flex items-center gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={hotelName} style={{ height: 48, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        ) : (
          <div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 13, fontWeight: 600, color: colors.accent_gold, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
              {hotelName.split(' ').slice(0, -1).join(' ')}
            </div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              {hotelName.split(' ').slice(-1)[0]}
            </div>
          </div>
        )}
      </div>

      {/* Main content — centred */}
      <div className="flex-1 flex flex-col items-center justify-center px-24 text-center">
        {/* Decorative line */}
        <div className="flex items-center gap-6 mb-10">
          <div style={{ height: 1, width: 80, background: `linear-gradient(90deg, transparent, ${colors.accent_gold})` }} />
          <div style={{ width: 6, height: 6, background: colors.accent_gold, transform: 'rotate(45deg)' }} />
          <div style={{ height: 1, width: 80, background: `linear-gradient(90deg, ${colors.accent_gold}, transparent)` }} />
        </div>

        {/* Greeting */}
        <h1
          style={{
            fontFamily: '"Playfair Display", serif',
            fontSize: 88,
            fontWeight: 500,
            color: 'white',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            textShadow: `0 0 80px ${colors.primary}44`,
            margin: 0,
          }}
        >
          {displayGreeting}
        </h1>

        {subtext && (
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 22,
              fontWeight: 300,
              color: 'rgba(255,255,255,0.55)',
              marginTop: 20,
              letterSpacing: '0.05em',
            }}
          >
            {subtext}
          </p>
        )}

        {/* Decorative line */}
        <div className="flex items-center gap-6 mt-10">
          <div style={{ height: 1, width: 80, background: `linear-gradient(90deg, transparent, ${colors.accent_gold})` }} />
          <div style={{ width: 6, height: 6, background: colors.accent_gold, transform: 'rotate(45deg)' }} />
          <div style={{ height: 1, width: 80, background: `linear-gradient(90deg, ${colors.accent_gold}, transparent)` }} />
        </div>
      </div>

      {/* Highlight offer — bottom strip */}
      {highlight && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-16 py-6"
          style={{ background: `linear-gradient(0deg, ${colors.background} 0%, transparent 100%)` }}
        >
          <div
            className="px-10 py-4 rounded-full text-center"
            style={{
              background: `${colors.primary}18`,
              border: `1px solid ${colors.primary}44`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
              Today's highlight
            </div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 20, color: 'white', fontWeight: 500 }}>
              {highlight}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
