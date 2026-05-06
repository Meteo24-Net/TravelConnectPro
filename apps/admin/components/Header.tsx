'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  role:      'super_admin' | 'property_manager'
  hotelName: string
  hotelTier: string
  userEmail: string
}

export default function Header({ role, hotelName, hotelTier, userEmail }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const tierColor = hotelTier === 'enterprise' ? 'var(--tcp-gold)'
                  : hotelTier === 'premium'    ? 'var(--tcp-blue)'
                  : 'var(--text-tertiary)'

  return (
    <header
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        height: 60,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel)',
      }}
    >
      {/* Hotel identity */}
      <div className="flex items-center gap-3">
        <div>
          <div className="font-semibold" style={{ fontSize: 14 }}>{hotelName}</div>
          <div style={{ fontSize: 11, color: tierColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {hotelTier}
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span
          style={{
            background: role === 'super_admin' ? 'rgba(197, 160, 89, 0.15)' : 'rgba(0,159,227,0.12)',
            color:      role === 'super_admin' ? 'var(--tcp-gold)'          : 'var(--tcp-blue)',
            border:     `1px solid ${role === 'super_admin' ? 'rgba(197,160,89,0.3)' : 'rgba(0,159,227,0.2)'}`,
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.06em',
          }}
        >
          {role === 'super_admin' ? 'SUPERADMIN' : 'property_manager'}
        </span>

        {/* Email */}
        <span className="text-tertiary font-mono" style={{ fontSize: 11 }}>
          {userEmail}
        </span>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="btn-ghost"
          style={{ padding: '5px 10px', fontSize: 11 }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
