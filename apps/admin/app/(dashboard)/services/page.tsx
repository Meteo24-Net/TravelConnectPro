import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  pending:      'var(--tcp-amber)',
  acknowledged: 'var(--tcp-blue)',
  in_progress:  '#a855f7',
  completed:    'var(--tcp-green)',
  cancelled:    'var(--text-tertiary)',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:    'var(--text-tertiary)',
  normal: 'var(--text-secondary)',
  high:   'var(--tcp-amber)',
  urgent: 'var(--tcp-red)',
}

export default async function ServicesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id')
    .eq('user_id', user.id)
    .single()

  const [requestsRes, catalogRes] = await Promise.all([
    supabase
      .from('service_requests')
      .select('*')
      .eq('hotel_id', profile?.hotel_id ?? '')
      .order('created_at', { ascending: false })
      .limit(50),

    supabase
      .from('service_catalog')
      .select('service_id, name, emoji, priority, sla_minutes')
      .eq('hotel_id', profile?.hotel_id ?? ''),
  ])

  const requests = requestsRes.data ?? []
  const catalog  = catalogRes.data  ?? []

  function getCatalog(serviceId: string) {
    return catalog.find(c => c.service_id === serviceId)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const activeRequests    = requests.filter(r => !['completed', 'cancelled'].includes(r.status))
  const completedRequests = requests.filter(r =>  ['completed', 'cancelled'].includes(r.status))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>Service Requests</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
          {activeRequests.length} active · {completedRequests.length} completed today
        </p>
      </div>

      {/* Active requests */}
      <div
        className="section-card"
        style={{ borderLeft: activeRequests.length > 0 ? '3px solid var(--tcp-amber)' : undefined }}
      >
        <div className="section-head">
          <div className="section-title">Active requests</div>
          <span className="text-tertiary" style={{ fontSize: 11 }}>{activeRequests.length} open</span>
        </div>
        <div className="section-body p-0">
          {activeRequests.length === 0 ? (
            <div className="p-6 text-center text-sm text-tertiary">All clear — no active requests.</div>
          ) : (
            <table className="w-full" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel-2)' }}>
                  {['Service', 'Room', 'Priority', 'Status', 'Notes', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-tertiary font-medium" style={{ fontSize: 11 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRequests.map((req, i) => {
                  const svc = getCatalog(req.service_id)
                  const statusColor   = STATUS_COLORS[req.status]   ?? 'var(--text-secondary)'
                  const priorityColor = PRIORITY_COLORS[req.priority] ?? 'var(--text-secondary)'
                  return (
                    <tr
                      key={req.id}
                      style={{ borderBottom: i < activeRequests.length - 1 ? '1px solid var(--border-subtle)' : undefined }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 18 }}>{svc?.emoji ?? '📋'}</span>
                          <span className="font-medium">{svc?.name ?? req.service_id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium">{req.room_number}</td>
                      <td className="px-4 py-3">
                        <span className="tag" style={{
                          color: priorityColor,
                          background: `${priorityColor}1a`,
                          borderColor: `${priorityColor}44`,
                        }}>
                          {req.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="tag" style={{
                          color: statusColor,
                          background: `${statusColor}1a`,
                          borderColor: `${statusColor}44`,
                        }}>
                          {req.status.toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary" style={{ maxWidth: 200, fontSize: 12 }}>
                        {req.notes ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-tertiary" style={{ fontSize: 11 }}>
                        {formatTime(req.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Completed */}
      {completedRequests.length > 0 && (
        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Completed today</div>
            <span className="text-tertiary" style={{ fontSize: 11 }}>{completedRequests.length}</span>
          </div>
          <div className="section-body p-0">
            <table className="w-full" style={{ fontSize: 13 }}>
              <tbody>
                {completedRequests.slice(0, 10).map((req, i) => {
                  const svc = getCatalog(req.service_id)
                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: i < Math.min(completedRequests.length, 10) - 1 ? '1px solid var(--border-subtle)' : undefined,
                        opacity: 0.6,
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <span style={{ fontSize: 16 }}>{svc?.emoji ?? '📋'}</span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{svc?.name ?? req.service_id}</td>
                      <td className="px-4 py-2.5 font-mono text-secondary">Rm {req.room_number}</td>
                      <td className="px-4 py-2.5 font-mono text-tertiary" style={{ fontSize: 11 }}>
                        {formatDate(req.created_at)} {formatTime(req.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
