'use client'

import { useEffect, useRef, useState } from 'react'

interface QrItem {
  qr_id:         string
  label:         string
  sidebar_label: string | null
  category:      string
  destination_url: string
  tier:          string
}

interface Props {
  items: QrItem[]
}

const CATEGORY_THEME: Record<string, { color: string; emoji: string }> = {
  wifi:     { color: '#009FE3', emoji: '📶' },
  reward:   { color: '#c5a059', emoji: '🎁' },
  info:     { color: '#2ecc71', emoji: 'ℹ️' },
  social:   { color: '#a855f7', emoji: '📱' },
  quest_node: { color: '#f59e0b', emoji: '🗺️' },
  game_prize: { color: '#c5a059', emoji: '🎰' },
}

function QrCode({ url, size = 100 }: { url: string; size?: number }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=${size * 2}x${size * 2}&margin=5&bgcolor=ffffff`
  return (
    <div style={{ background: 'white', padding: 5, borderRadius: 8, width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <img src={qrUrl} alt="QR" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}

export default function QrCarousel({ items }: Props) {
  const [active, setActive] = useState(0)
  const [prev, setPrev]     = useState<number | null>(null)
  const timer               = useRef<ReturnType<typeof setInterval>>()

  const displayItems = items.length > 0 ? items : [{
    qr_id: 'wifi-default', label: 'Guest Wi-Fi', sidebar_label: 'GUEST WI-FI',
    category: 'wifi', destination_url: 'https://wifi.hotel.ge', tier: 'open',
  }]

  useEffect(() => {
    if (displayItems.length <= 1) return
    timer.current = setInterval(() => {
      setActive(a => {
        setPrev(a)
        return (a + 1) % displayItems.length
      })
    }, 6000)
    return () => clearInterval(timer.current)
  }, [displayItems.length])

  const item  = displayItems[active]
  const theme = CATEGORY_THEME[item.category] ?? { color: '#009FE3', emoji: '📱' }
  const label = item.sidebar_label ?? item.label.toUpperCase()

  return (
    <div style={{
      flexShrink: 0, height: 145, width: '100%',
      background: 'rgba(197,160,89,0.05)',
      border: '1px solid rgba(197,160,89,0.4)',
      borderRadius: 12, position: 'relative', overflow: 'hidden',
    }}>
      {displayItems.map((it, i) => {
        const th = CATEGORY_THEME[it.category] ?? { color: '#009FE3', emoji: '📱' }
        const lb = it.sidebar_label ?? it.label.toUpperCase()
        const isActive = i === active
        const isExit   = i === prev && i !== active

        return (
          <div
            key={it.qr_id}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px',
              transform: isActive ? 'translateX(0)' : isExit ? 'translateX(-100%)' : 'translateX(100%)',
              transition: 'transform 0.8s ease-in-out',
              background: 'rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '55%' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'white', letterSpacing: 1, lineHeight: 1.1, marginBottom: 6 }}>
                {lb}
              </div>
              <div style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', color: th.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{th.emoji}</span>
                <span>Scan to {it.category === 'wifi' ? 'connect instantly' : 'access'}</span>
              </div>
              {it.tier === 'verified' && (
                <div style={{ fontSize: 10, color: 'rgba(197,160,89,0.8)', marginTop: 4, fontWeight: 700 }}>
                  🛡 Verified reward
                </div>
              )}
            </div>
            <QrCode url={it.destination_url} size={110} />
          </div>
        )
      })}

      {/* Dot indicators */}
      {displayItems.length > 1 && (
        <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4, zIndex: 10 }}>
          {displayItems.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === active ? 16 : 5, height: 5, borderRadius: 2.5,
                background: i === active ? theme.color : 'rgba(255,255,255,0.25)',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
