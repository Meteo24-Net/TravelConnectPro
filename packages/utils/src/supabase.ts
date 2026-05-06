// =============================================================================
// Travel Connect Pro — Supabase Client Factory
// =============================================================================
// Three client variants:
//   createBrowserClient()  — anon key, used by display + PWA (client-side)
//   createServerClient()   — anon key + cookie session, used by admin SSR
//   createServiceClient()  — service_role, used by Edge Functions ONLY
//
// Rule: clients NEVER write directly. All writes go through Edge Functions.
// =============================================================================

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/src/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Check your .env.local file.'
  )
}

/**
 * Browser/display client — anon key only.
 * Safe to instantiate on every render; Supabase SDK memoises internally.
 */
export function createBrowserClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,     // display TVs have no session — they use signed URLs
      autoRefreshToken: false,
    },
  })
}

/**
 * Admin SSR client — anon key + RLS.
 * Manager sees only their hotel_id rows via RLS policies.
 * Do NOT use service_role here — that bypasses all tenant isolation.
 */
export function createAdminClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
}

/**
 * Service client — service_role key.
 * EDGE FUNCTIONS ONLY. Never exposed to browser bundles.
 * Bypasses RLS intentionally for cross-hotel operations.
 */
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for the service client. ' +
      'This client must only be used inside Edge Functions or server-side code.'
    )
  }

  return createClient<Database>(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
