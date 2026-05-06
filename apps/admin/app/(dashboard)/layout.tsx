import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Header  from '@/components/Header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch manager profile + hotel — determines role and which hotel to show
  const { data: profile } = await supabase
    .from('manager_profiles')
    .select('role, hotel_id, hotels(brand_name, short_code, status, tier)')
    .eq('user_id', user.id)
    .single()

  // SuperAdmin check — in v.1 SuperAdmin is indicated by role = 'super_admin'
  // If no profile exists yet, treat as super (first-time setup)
  const role     = (profile?.role as 'super_admin' | 'property_manager') ?? 'super_admin'
  const hotel    = profile?.hotels as { brand_name: string; short_code: string; status: string; tier: string } | null

  // Unread messages + pending counts for sidebar badges
  const { count: unreadMessages } = await supabase
    .from('admin_messages')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', profile?.hotel_id ?? '')
    .is('read_at', null)

  const { count: pendingRequests } = await supabase
    .from('service_requests')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', profile?.hotel_id ?? '')
    .eq('status', 'pending')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <Sidebar
        role={role}
        unreadMessages={unreadMessages ?? 0}
        pendingRequests={pendingRequests ?? 0}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          role={role}
          hotelName={hotel?.brand_name ?? 'Travel Connect Pro'}
          hotelTier={hotel?.tier ?? 'enterprise'}
          userEmail={user.email ?? ''}
        />
        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {children}
        </main>
      </div>
    </div>
  )
}
