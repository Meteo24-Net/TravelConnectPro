import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import MessagesClient    from './MessagesClient'

export default async function MessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const { data: messages } = await supabase
    .from('admin_messages')
    .select('id, from_role, subject, body, category, read_at, created_at')
    .eq('hotel_id', profile.hotel_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <MessagesClient
      hotelId={profile.hotel_id}
      role={profile.role}
      messages={messages ?? []}
    />
  )
}
