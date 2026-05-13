// =============================================================================
// Travel Connect Pro — Edge Function: flights-refresh (v2)
// =============================================================================
// Refined for multi-tenant arrivals/departures support.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

async function fetchAirlabs(iata: string, type: 'arrivals' | 'departures', apiKey: string) {
  const method = type === 'arrivals' ? 'arr_iata' : 'dep_iata'
  const url = `https://airlabs.co/api/v9/schedules?${method}=${iata}&api_key=${apiKey}`
  
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (!data.response) return []
    
    return data.response.slice(0, 15).map((f: any) => ({
      flight_no: f.flight_icao || f.flight_iata,
      location:  type === 'arrivals' ? (f.dep_iata || 'Unknown') : (f.arr_iata || 'Unknown'),
      time:      (type === 'arrivals' ? f.arr_time : f.dep_time)?.split(' ')[1]?.substring(0, 5) || '--:--',
      status:    f.status || 'Active',
      gate:      f.dep_gate || f.arr_gate || '-',
      delayed:   (f.dep_delayed || f.arr_delayed) || 0
    }))
  } catch (e) {
    console.error(`[AirLabs] Failed for ${iata} ${type}:`, e)
    return []
  }
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. Fetch active hotels with flights enabled
    const { data: hotels, error: hotelErr } = await supabase
      .from('hotels')
      .select('id, integration_config')
      .eq('status', 'active')

    if (hotelErr) throw hotelErr

    const updates = []

    for (const hotel of hotels) {
      const cfg = (hotel.integration_config as any)?.flights
      if (!cfg || !cfg.enabled) continue

      const iata = cfg.iata_code || 'BUS' // Fallback to Batumi
      const apiKey = cfg.providers?.airlabs?.api_key
      
      if (!apiKey) {
        console.warn(`[Flights] No AirLabs API key for hotel ${hotel.id}`)
        continue
      }

      console.log(`[Flights] Refreshing ${iata} for hotel ${hotel.id}`)

      // Fetch both Arrivals and Departures in parallel
      const [arrivals, departures] = await Promise.all([
        fetchAirlabs(iata, 'arrivals', apiKey),
        fetchAirlabs(iata, 'departures', apiKey)
      ])

      updates.push({
        hotel_id: hotel.id,
        iata_code: iata,
        airport_name: cfg.airport_name || iata,
        arrivals,
        departures,
        fetched_at: new Date().toISOString(),
        last_success_at: new Date().toISOString()
      })
    }

    if (updates.length > 0) {
      const { error: upsertErr } = await supabase
        .from('flights_cache')
        .upsert(updates, { onConflict: 'hotel_id, iata_code' })
      
      if (upsertErr) throw upsertErr
    }

    return new Response(JSON.stringify({ 
      success: true, 
      count: updates.length,
      timestamp: new Date().toISOString() 
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[Flights] Refresh failed:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
