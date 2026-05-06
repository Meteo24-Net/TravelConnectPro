import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="font-bold" style={{ fontSize: 22 }}>{title}</h1>
      <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>{subtitle}</p>
    </div>
  )
}

function StatCard({ num, label, trend, trendColor }: {
  num: string | number; label: string; trend: string; trendColor: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-trend" style={{ color: trendColor }}>{trend}</div>
    </div>
  )
}

function ScreenRow({ name, meta, status }: { name: string; meta: string; status: string }) {
  const dotClass = status === 'online' ? 'dot-on' : status === 'warning' ? 'dot-warn' : 'dot-off'
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`dot ${dotClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-tertiary" style={{ fontSize: 11 }}>{meta}</div>
      </div>
    </div>
  )
}

function RequestRow({ emoji, name, room, status, minutesAgo, notes }: {
  emoji: string; name: string; room: string;
  status: string; minutesAgo: number; notes: string | null
}) {
  const statusColor =
    status === 'pending'     ? 'var(--tcp-amber)' :
    status === 'acknowledged'? 'var(--tcp-blue)'  :
    status === 'in_progress' ? '#a855f7'           : 'var(--tcp-green)'

  return (
    <div className="flex items-center gap-3 py-2">
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {name}
          <span className="font-mono text-xs text-tertiary"> · Room {room}</span>
        </div>
        <div className="text-xs text-tertiary">
          {minutesAgo}m ago{notes ? ` · "${notes}"` : ''}
        </div>
      </div>
      <span
        className="tag shrink-0"
        style={{
          background:   `${statusColor}1a`,
          color:         statusColor,
          borderColor:  `${statusColor}55`,
          fontSize: 9,
        }}
      >
        {status.toUpperCase().replace('_', ' ')}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get manager profile
  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('hotel_id, role')
    .eq('user_id', user.id)
    .single()

  const hotelId = profile?.hotel_id
  const role    = profile?.role ?? 'super_admin'

  // Fetch all dashboard data in parallel
  const [screensRes, requestsRes, catalogRes, scansRes] = await Promise.all([
    supabase
      .from('screens')
      .select('id, display_name, screen_type, status, last_heartbeat_at, vendor, resolution')
      .eq('hotel_id', hotelId ?? '')
      .order('screen_type'),

    supabase
      .from('service_requests')
      .select('id, service_id, room_number, status, priority, notes, created_at')
      .eq('hotel_id', hotelId ?? '')
      .in('status', ['pending', 'acknowledged', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(10),

    supabase
      .from('service_catalog')
      .select('service_id, name, emoji')
      .eq('hotel_id', hotelId ?? ''),

    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', hotelId ?? '')
      .gte('scanned_at', new Date(Date.now() - 86400000).toISOString()),
  ])

  const screens  = screensRes.data  ?? []
  const requests = requestsRes.data ?? []
  const catalog  = catalogRes.data  ?? []
  const scanCount = scansRes.count  ?? 0

  const onlineScreens  = screens.filter(s => s.status === 'online').length
  const pendingRequests = requests.filter(r => r.status === 'pending').length

  function getScreenMeta(s: typeof screens[0]) {
    const ago = s.last_heartbeat_at
      ? Math.round((Date.now() - new Date(s.last_heartbeat_at).getTime()) / 1000)
      : null
    const agoStr = ago === null ? 'Never connected'
                 : ago < 60    ? `${ago}s ago`
                 : ago < 3600  ? `${Math.round(ago / 60)}m ago`
                 : `${Math.round(ago / 3600)}h ago`
    return `${s.status === 'online' ? 'Online' : s.status === 'warning' ? 'Warning' : 'Offline'} · ${agoStr}${s.resolution ? ` · ${s.resolution}` : ''}`
  }

  function getRequestDetails(req: typeof requests[0]) {
    const svc       = catalog.find(c => c.service_id === req.service_id)
    const minutesAgo = Math.round((Date.now() - new Date(req.created_at).getTime()) / 60000)
    return { emoji: svc?.emoji ?? '📋', name: svc?.name ?? req.service_id, minutesAgo }
  }

  // No hotel profile yet — SuperAdmin first-time view
  if (!hotelId && role === 'super_admin') {
    return (
      <div className="space-y-5">
        <PageTitle title="Dashboard" subtitle="SuperAdmin overview" />
        <div className="phase-strip">
          <span style={{ fontSize: 18 }}>⚡</span>
          <div className="text-sm text-secondary">
            Welcome to TCP SuperAdmin. No hotel profile linked to your account yet.
            Use the <strong className="text-primary">Client identity</strong> tab to set up your first property.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Dashboard"
        subtitle="Real-time property status. Screen data updates live via Supabase Realtime."
      />

      {/* Welcome strip */}
      <div className="phase-strip">
        <span style={{ fontSize: 18 }}>👋</span>
        <div className="text-sm text-secondary">
          You have{' '}
          <strong className="text-primary">{pendingRequests} pending service requests</strong>
          {' '}and{' '}
          <strong className="text-primary">{onlineScreens} of {screens.length} screens online</strong>.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          num={pendingRequests}
          label="Pending requests"
          trend={pendingRequests > 0 ? 'awaiting action' : 'all clear'}
          trendColor={pendingRequests > 0 ? 'var(--tcp-amber)' : 'var(--tcp-green)'}
        />
        <StatCard
          num={`${onlineScreens}/${screens.length}`}
          label="Screens online"
          trend={onlineScreens === screens.length ? 'all healthy' : `${screens.length - onlineScreens} offline`}
          trendColor={onlineScreens === screens.length ? 'var(--tcp-green)' : 'var(--tcp-amber)'}
        />
        <StatCard
          num={scanCount}
          label="QR scans today"
          trend="last 24 hours"
          trendColor="var(--text-secondary)"
        />
        <StatCard
          num={requests.length}
          label="Active requests"
          trend="pending + in progress"
          trendColor="var(--text-secondary)"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Screen status */}
        <div className="section-card">
          <div className="section-head">
            <div className="section-title">Screen status</div>
            <span className="text-tertiary" style={{ fontSize: 11 }}>live heartbeat</span>
          </div>
          <div className="section-body space-y-1">
            {screens.length === 0 ? (
              <p className="text-sm text-tertiary py-4 text-center">
                No screens registered yet.{' '}
                <a href="/screens" className="text-tcp-blue hover:underline">Add a screen →</a>
              </p>
            ) : (
              screens.map(s => (
                <ScreenRow
                  key={s.id}
                  name={`${s.display_name}${s.vendor ? ` — ${s.vendor}` : ''}`}
                  meta={getScreenMeta(s)}
                  status={s.status}
                />
              ))
            )}
          </div>
        </div>

        {/* Active service requests */}
        <div
          className="section-card"
          style={{ borderLeft: requests.length > 0 ? '3px solid var(--tcp-amber)' : undefined }}
        >
          <div className="section-head">
            <div className="section-title flex items-center gap-2">
              <span style={{ color: 'var(--tcp-amber)' }}>◈</span>
              Active service requests
            </div>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {requests.length} open
            </span>
          </div>
          <div className="section-body space-y-1">
            {requests.length === 0 ? (
              <p className="text-sm text-tertiary py-4 text-center">No active requests.</p>
            ) : (
              requests.slice(0, 5).map(req => {
                const { emoji, name, minutesAgo } = getRequestDetails(req)
                return (
                  <RequestRow
                    key={req.id}
                    emoji={emoji}
                    name={name}
                    room={req.room_number}
                    status={req.status}
                    minutesAgo={minutesAgo}
                    notes={req.notes}
                  />
                )
              })
            )}
            {requests.length > 5 && (
              <div className="text-xs text-tertiary pt-2">
                + {requests.length - 5} more ·{' '}
                <a href="/services" className="text-tcp-blue hover:underline">see Services tab</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
