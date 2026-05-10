'use client'

interface Props {
  announcements: string[]
  events:        string[]
  offers:        string[]
  accentGold:    string
}

export default function TickerBar({ announcements, events, offers, accentGold }: Props) {
  const all = [
    ...announcements.map(t => ({ text: t, cat: 'NOTICE', color: '#ff4d4d' })),
    ...events.map(t =>        ({ text: t, cat: 'EVENT',  color: '#2ecc71' })),
    ...offers.map(t =>        ({ text: t, cat: 'OFFER',  color: accentGold })),
  ]

  if (all.length === 0) all.push({ text: 'Welcome to Radisson Blu Batumi · Enjoy your stay', cat: 'INFO', color: accentGold })

  // Duplicate for seamless loop
  const items = [...all, ...all]

  return (
    <div style={{
      flexShrink: 0,
      background: `rgba(197,160,89,0.05)`,
      borderTop: '1px solid #333',
      borderRadius: 8,
      overflow: 'hidden',
      marginTop: 15,
      height: 55,
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
    }}>
      {/* Label */}
      <div style={{
        background: accentGold, color: '#000',
        padding: '0 20px', height: '100%',
        display: 'flex', alignItems: 'center',
        fontWeight: 900, fontSize: 13,
        zIndex: 10, letterSpacing: 1, boxShadow: '10px 0 20px rgba(0,0,0,0.5)',
        flexShrink: 0, textTransform: 'uppercase',
      }}>
        LIVE
      </div>

      {/* Scrolling track */}
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          whiteSpace: 'nowrap', willChange: 'transform',
          animation: 'scroll-left 45s linear infinite',
        }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingRight: 60 }}>
              <span style={{
                background: item.color + '22',
                color: item.color,
                border: `1px solid ${item.color}44`,
                borderRadius: 4, padding: '2px 8px',
                fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
              }}>
                {item.cat}
              </span>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                {item.text}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 20 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll-left {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
