'use client'

interface Props {
  hotelName: string
  colors:    { primary: string; accent_gold: string }
  wifiQrUrl: string | null
  ssid?:     string
}

export default function WifiSlide({ hotelName, colors, wifiQrUrl, ssid }: Props) {
  const qrCodeUrl = wifiQrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(wifiQrUrl)}&size=280x280&margin=10&bgcolor=ffffff`
    : `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent('https://wifi.' + hotelName.toLowerCase().replace(/\s+/g, '') + '.ge')}&size=280x280&margin=10&bgcolor=ffffff`

  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #08080f 100%)' }}
    >
      {/* Background glow */}
      <div
        className="absolute"
        style={{
          width: 600, height: 600,
          background: `radial-gradient(circle, ${colors.primary}18 0%, transparent 70%)`,
          borderRadius: '50%',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="flex items-center gap-24 relative z-10">
        {/* Left — text */}
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>
            Complimentary Wi-Fi
          </div>
          <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: 56, fontWeight: 600, color: 'white', lineHeight: 1.15, margin: 0 }}>
            Connect to<br />the internet
          </h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 20, color: 'rgba(255,255,255,0.5)', marginTop: 20, fontWeight: 300, lineHeight: 1.6 }}>
            Scan the QR code with your phone's camera to connect instantly — no password needed.
          </p>
          {ssid && (
            <div
              className="flex items-center gap-3 mt-8 px-5 py-3 rounded-xl"
              style={{ background: `${colors.primary}18`, border: `1px solid ${colors.primary}33`, display: 'inline-flex' }}
            >
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Network:</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 16, color: colors.primary, fontWeight: 600 }}>{ssid}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 240, background: 'rgba(255,255,255,0.08)' }} />

        {/* Right — QR */}
        <div className="flex flex-col items-center gap-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ padding: 12, background: 'white', boxShadow: `0 0 40px ${colors.primary}44` }}
          >
            <img src={qrCodeUrl} alt="WiFi QR Code" style={{ width: 220, height: 220, display: 'block' }} />
          </div>
          <div
            className="flex items-center gap-2 px-5 py-2 rounded-full"
            style={{ background: `${colors.primary}22`, border: `1px solid ${colors.primary}44` }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.primary, boxShadow: `0 0 8px ${colors.primary}` }} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.primary, fontWeight: 600 }}>Scan to connect instantly</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${colors.primary}66, transparent)` }} />
    </div>
  )
}
