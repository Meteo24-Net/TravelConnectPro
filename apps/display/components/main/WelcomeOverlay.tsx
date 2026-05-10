'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  hotelName:    string
  greeting:     string
  subtext:      string
  highlight:    string
  logoUrl:      string | null
  accentGold:   string
  primaryColor: string
  timingSec:    number
  onDismiss:    () => void
}

export default function WelcomeOverlay({
  hotelName, greeting, subtext, highlight, logoUrl,
  accentGold, timingSec, onDismiss,
}: Props) {
  const [visible, setVisible] = useState(true)
  const dismissRef = useRef(onDismiss)
  useEffect(() => { dismissRef.current = onDismiss }, [onDismiss])

  // Stable timer — not affected by parent re-renders
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => dismissRef.current(), 1950)
    }, timingSec * 1000)
    return () => clearTimeout(t)
  }, [timingSec]) // intentionally excludes onDismiss

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(12,12,18,0.98)',
      backdropFilter: 'blur(25px)',
      padding: '80px 100px',
      display: 'flex', flexDirection: 'column',
      transform: visible ? 'translateX(0)' : 'translateX(-100%)',
      opacity:   visible ? 1 : 0,
      transition: 'transform 1.95s cubic-bezier(0.77,0,0.175,1), opacity 1.2s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {/* Hotel name / logo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {logoUrl ? (
          <img src={logoUrl} alt={hotelName} style={{ height: 60, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        ) : (
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 42, fontWeight: 700, letterSpacing: 3, lineHeight: 1.05 }}>
            {hotelName.split(' ').slice(0, -1).join(' ')}{' '}
            <span style={{ color: accentGold }}>{hotelName.split(' ').slice(-1)[0]}</span>
          </div>
        )}
      </div>

      {/* Greeting */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontSize: 108, lineHeight: 1, fontWeight: 700,
          color: accentGold,
          textShadow: `0 6px 40px ${accentGold}4d`,
        }}>
          {greeting || 'Welcome'}
        </div>
        {subtext && (
          <div style={{ fontSize: 27, color: '#b0b0b0', fontWeight: 300, maxWidth: 580, marginTop: 16 }}>
            {subtext}
          </div>
        )}
      </div>

      {/* Highlight offer */}
      {highlight && (
        <div style={{
          marginTop: 'auto',
          background: 'rgba(255,255,255,0.035)',
          padding: '30px 34px',
          borderLeft: `6px solid ${accentGold}`,
        }}>
          <div style={{ fontSize: 13, letterSpacing: 4, textTransform: 'uppercase', color: accentGold, fontWeight: 600, marginBottom: 8 }}>
            Today's Highlight
          </div>
          <div style={{ fontSize: 23, lineHeight: 1.45, fontWeight: 300, color: 'white' }}>
            {highlight}
          </div>
        </div>
      )}

      <AmbientClock />
    </div>
  )
}

function AmbientClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{
      position: 'absolute', bottom: 70, right: 90,
      fontSize: 62, fontWeight: 100,
      color: 'rgba(255,255,255,0.12)',
      letterSpacing: -2,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {time}
    </div>
  )
}
