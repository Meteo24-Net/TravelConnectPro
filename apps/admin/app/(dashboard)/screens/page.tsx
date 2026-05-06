import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

export default async function ScreensPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id')
    .eq('user_id', user.id)
    .single()

  const { data: screens } = await supabase
    .from('screens')
    .select('*')
    .eq('hotel_id', profile?.hotel_id ?? '')
    .order('screen_type')
    .order('display_name')

  const rows = screens ?? []
  const onlineCount = rows.filter(s => s.status === 'online').length

  function formatAgo(ts: string | null) {
    if (!ts) return 'never'
    const secs = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
    if (secs < 60)   return `${secs}s ago`
    if (secs < 3600) return `${Math.round(secs / 60)}m ago`
    return `${Math.round(secs / 3600)}h ago`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Screens</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          {onlineCount} of {rows.length} screens online · heartbeat every 30s
        </p>
      </div>

      <div className="section-card">
        <div className="section-head">
          <div className="section-title">Registered screens</div>
          <span className="text-tertiary" style={{ fontSize: 11 }}>{rows.length} total</span>
        </div>
        <div className="section-body p-0">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-tertiary">
              No screens registered. Screens auto-register when they first call the display-config function.
            </div>
          ) : (
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel-2)' }}>
                  {['Status', 'Name', 'Type', 'Vendor', 'Resolution', 'Last seen', 'ID'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-tertiary font-medium" style={{ fontSize: 11 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const dotClass = s.status === 'online' ? 'dot-on' : s.status === 'warning' ? 'dot-warn' : 'dot-off'
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: i < rows.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className={`dot ${dotClass}`} />
                      </td>
                      <td className="px-4 py-3 font-medium">{s.display_name}</td>
                      <td className="px-4 py-3 text-secondary font-mono" style={{ fontSize: 11 }}>
                        {s.screen_type}
                      </td>
                      <td className="px-4 py-3 text-secondary">{s.vendor ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-secondary" style={{ fontSize: 11 }}>
                        {s.resolution ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {formatAgo(s.last_heartbeat_at)}
                      </td>
                      <td className="px-4 py-3 font-mono text-tertiary" style={{ fontSize: 10 }}>
                        {s.id.slice(0, 8)}…
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
