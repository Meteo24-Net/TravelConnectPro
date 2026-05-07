import DisplayApp from '@/components/DisplayApp'

interface Props {
  params: { screen_id: string }
}

export default function ScreenPage({ params }: Props) {
  return (
    <DisplayApp
      screenId={params.screen_id}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      displayConfigUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/display-config`}
    />
  )
}

export function generateStaticParams() {
  return [] // dynamic — no static generation for TV screens
}
