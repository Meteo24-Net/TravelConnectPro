import { redirect } from 'next/navigation'

// In production the TV navigates directly to /[screen_id]
// In dev, redirect to the seed screen
export default function RootPage() {
  redirect('/bcdecdd3-758e-4ebc-bd1c-fa2f937f3537')
}
