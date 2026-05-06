'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SUPER_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',        ico: '⬡',  path: '/dashboard' },
  { id: 'client',      label: 'Client identity',  ico: '🏨',  path: '/client',     superOnly: true },
  { id: 'airports',    label: 'Airports',          ico: '✈',  path: '/airports',   superOnly: true },
  { id: 'branding',    label: 'Branding',          ico: '🎨',  path: '/branding',   superOnly: true },
  { id: 'carousel',    label: 'Carousel',          ico: '▶',  path: '/carousel' },
  { id: 'ticker',      label: 'Ticker',            ico: '📢',  path: '/ticker' },
  { id: 'qr',          label: 'QR codes',          ico: '⬛',  path: '/qr' },
  { id: 'games',       label: 'Games',             ico: '🎰',  path: '/games' },
  { id: 'services',    label: 'Services',          ico: '🛎',  path: '/services' },
  { id: 'fulfillment', label: 'Fulfillment',       ico: '✅',  path: '/fulfillment' },
  { id: 'welcome',     label: 'Welcome',           ico: '👋',  path: '/welcome' },
  { id: 'media',       label: 'Media',             ico: '🎬',  path: '/media' },
  { id: 'screens',     label: 'Screens',           ico: '📺',  path: '/screens' },
  { id: 'messages',    label: 'Messages',          ico: '✉',  path: '/messages' },
]

const MANAGER_ITEMS = SUPER_ITEMS.filter(i => !i.superOnly)

interface Props {
  role:            'super_admin' | 'property_manager'
  unreadMessages:  number
  pendingRequests: number
}

export default function Sidebar({ role, unreadMessages, pendingRequests }: Props) {
  const pathname = usePathname()
  const items    = role === 'super_admin' ? SUPER_ITEMS : MANAGER_ITEMS

  return (
    <aside
      className="flex flex-col shrink-0 border-r"
      style={{
        width: 220,
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 shrink-0"
        style={{ height: 60, borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span style={{ color: 'var(--tcp-blue)', fontSize: 18, fontWeight: 800 }}>TCP</span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.06em' }}>
          {role === 'super_admin' ? 'SUPERADMIN' : 'property_manager'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {items.map(item => {
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
          const badge = item.id === 'messages'    ? unreadMessages
                      : item.id === 'services'    ? pendingRequests
                      : item.id === 'fulfillment' ? pendingRequests
                      : 0

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.ico}</span>
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className="shrink-0 font-mono"
                  style={{
                    background: item.id === 'services' || item.id === 'fulfillment'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(0, 159, 227, 0.2)',
                    color: item.id === 'services' || item.id === 'fulfillment'
                      ? 'var(--tcp-amber)'
                      : 'var(--tcp-blue)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 4,
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        className="p-3 shrink-0"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center' }}>
          TCP v1.0 · pjyjblllcllnqsjbvbfc
        </div>
      </div>
    </aside>
  )
}
