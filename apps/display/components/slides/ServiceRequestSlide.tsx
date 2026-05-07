'use client'

interface Props {
  hotelName:   string
  colors:      { primary: string; accent_gold: string }
  serviceUrl:  string
}

const SERVICES = [
  { emoji: '🧹', label: 'Housekeeping' },
  { emoji: '🍽️', label: 'Room service' },
  { emoji: '🔧', label: 'Maintenance' },
  { emoji: '🛎️', label: 'Concierge' },
  { emoji: '📶', label: 'Tech support' },
  { emoji: '🚿', label: 'Extra towels' },
]

export default function ServiceRequestSlide({ hotelName, colors, serviceUrl }: Props) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(serviceUrl)}&size=240x240&margin=10&bgcolor=ffffff`

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #0a0808 100%)' }}
    >
      {/* Glow */}
      <div className="absolute" style={{
        width: 500, height: 500,
        background: `radial-gradient(circle, ${colors.accent_gold}12 0%, transparent 70%)`,
        borderRadius: '50%', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }} />

      <div className="flex items-center gap-20 relative z-10">
        {/* Left */}
        <div style={{ maxWidth: 500 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>
            Guest Services
          </div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 52, fontWeight: 600, color: 'white', lineHeight: 1.15, margin: 0 }}>
            How can we<br />help you today?
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 18, color: 'rgba(255,255,255,0.5)', marginTop: 16, fontWeight: 300, lineHeight: 1.6 }}>
            Scan with your phone to request any service. We'll respond within minutes.
          </p>

          {/* Service grid */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {SERVICES.map(svc => (
              <div
                key={svc.label}
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span style={{ fontSize: 18 }}>{svc.emoji}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{svc.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 220, background: 'rgba(255,255,255,0.08)' }} />

        {/* QR */}
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-2xl overflow-hidden" style={{
            padding: 12, background: 'white',
            boxShadow: `0 0 40px ${colors.accent_gold}44`,
          }}>
            <img src={qrUrl} alt="Service QR" style={{ width: 200, height: 200, display: 'block' }} />
          </div>
          <div className="flex items-center gap-2 px-5 py-2 rounded-full"
            style={{ background: `${colors.accent_gold}22`, border: `1px solid ${colors.accent_gold}44` }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, fontWeight: 600 }}>
              Scan to request
            </span>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            No app needed · Works on any phone
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${colors.accent_gold}66, transparent)` }} />
    </div>
  )
}
