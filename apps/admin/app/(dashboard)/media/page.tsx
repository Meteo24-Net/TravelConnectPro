import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import MediaClient      from './MediaClient'

const DEFAULT_MEDIA = {
  bgm_label: '', bgm_url: '', bgm_volume: 30,
  bgm_status: 'unchecked' as const, bgm_last_checked: null,
  use_corporate_video: false, feratel_cam_id: '',
  corporate_video_label: '', corporate_video_url: '',
  cam_popup_interval_min: 15,
}

export default async function MediaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('manager_profiles').select('hotel_id, role').eq('user_id', user.id).single()
  if (!profile) redirect('/dashboard')

  const { data: config } = await supabase
    .from('property_configs').select('media').eq('hotel_id', profile.hotel_id).single()

  const media = { ...DEFAULT_MEDIA, ...((config?.media as object) ?? {}) }

  return <MediaClient hotelId={profile.hotel_id} media={media as typeof DEFAULT_MEDIA} />
}
