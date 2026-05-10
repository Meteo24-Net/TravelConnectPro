import DisplayDashboard from '@/components/DisplayDashboard'

interface Props { params: { screen_id: string } }

export default function ScreenPage({ params }: Props) {
  return (
    <DisplayDashboard
      screenId={params.screen_id}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      displayConfigUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/display-config`}
    />
  )
}

export function generateStaticParams() { return [] }