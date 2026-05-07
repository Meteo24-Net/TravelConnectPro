'use client'

interface Props {
  hotelName: string
  colors:    { primary: string; accent_gold: string; background: string }
  offers:    string[]
}

const DEFAULT_OFFERS = [
  'Complimentary welcome drink at Sky Bar — show this screen',
  'Late checkout until 14:00 · Available for loyalty members',
  'Spa & Wellness · 15% off all treatments this week',
]

export default function PromoSlide({ hotelName, colors, offers }: Props) {
  const displayOffers = offers?.filter(Boolean).length ? offers : DEFAULT_OFFERS

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 70% 30%, ${colors.accent_gold}18 0%, ${colors.background} 60%)` }}
    >
      <div className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.accent_gold}, transparent)` }} />

      <div className="px-20 pt-14">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
          Special Offers
        </div>
        <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 40, color: 'white', fontWeight: 500 }}>
          Exclusively for our guests
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-20 gap-6">
        {displayOffers.slice(0, 3).map((offer, i) => (
          <div
            key={i}
            className="flex items-start gap-6 p-6 rounded-2xl"
            style={{
              background: i === 0 ? `${colors.accent_gold}12` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${i === 0 ? colors.accent_gold + '44' : 'rgba(255,255,255,0.07)'}`,
            }}
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-full"
              style={{
                width: 48, height: 48,
                background: i === 0 ? `${colors.accent_gold}22` : 'rgba(255,255,255,0.06)',
                border: `1px solid ${i === 0 ? colors.accent_gold + '55' : 'rgba(255,255,255,0.1)'}`,
                fontFamily: '"Playfair Display", serif',
                fontSize: 20, color: i === 0 ? colors.accent_gold : 'rgba(255,255,255,0.4)', fontWeight: 700,
              }}
            >
              {i + 1}
            </div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 26, color: i === 0 ? 'white' : 'rgba(255,255,255,0.7)', fontWeight: 500, lineHeight: 1.4 }}>
              {offer}
            </div>
          </div>
        ))}
      </div>

      <div className="px-20 pb-12 flex items-center justify-between">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
          Ask at reception for details
        </div>
        <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 14, color: colors.accent_gold, letterSpacing: '0.1em' }}>
          {hotelName}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.accent_gold}66, transparent)` }} />
    </div>
  )
}
