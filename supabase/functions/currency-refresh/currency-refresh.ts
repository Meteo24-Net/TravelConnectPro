// =============================================================================
// Travel Connect Pro — Edge Function Core: currency-refresh
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fetchOXR } from './global-adapter.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OXR_API_KEY               = Deno.env.get('OXR_API_KEY')

export async function serve(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!OXR_API_KEY) {
    return new Response(JSON.stringify({ error: 'OXR_API_KEY secret is missing' }), { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { rates: globalRates, date, base } = await fetchOXR(OXR_API_KEY, 'USD')

    const { data: hotels, error: hotelErr } = await supabase
      .from('hotels')
      .select('id, integration_config')
      .eq('status', 'active')

    if (hotelErr) throw hotelErr

    const updates = []

    for (const hotel of hotels) {
      const cfg = (hotel.integration_config as any)?.currency
      if (!cfg || !cfg.enabled) continue

      const baseCurrency = cfg.base_currency || 'GEL'
      const spread       = cfg.spread_pct || 0.015
      const codes        = cfg.display_codes || ['USD', 'EUR', 'TRY']

      const hotelRates: Record<string, any> = {}
      const baseToUSD = 1 / globalRates[baseCurrency]

      for (const code of codes) {
        if (!globalRates[code]) continue
        const mid = globalRates[code] * baseToUSD
        hotelRates[code] = {
          buy:  Number((mid * (1 - spread)).toFixed(4)),
          sell: Number((mid * (1 + spread)).toFixed(4)),
          mid:  Number(mid.toFixed(4))
        }
      }

      updates.push({
        hotel_id: hotel.id,
        date: date,           // Matches new schema
        base: baseCurrency,   // Matches new schema
        rates: hotelRates,    // Matches new schema
        source: 'Open Exchange Rates',
        fetched_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        applied_spread_pct: spread
      })
    }

    if (updates.length > 0) {
      const { error: upsertErr } = await supabase
        .from('currency_cache')
        .upsert(updates, { onConflict: 'hotel_id' })
      if (upsertErr) throw upsertErr
    }

    return new Response(JSON.stringify({ 
      success: true, 
      updates: updates.length,
      source: 'OXR' 
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Currency refresh failed:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
