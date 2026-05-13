import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, if-none-match',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const screen_id = url.searchParams.get('screen_id')

  if (!screen_id) {
    return new Response(JSON.stringify({ error: 'Missing screen_id' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  try {
    const { data: config, error } = await supabase.rpc('resolve_display_integration_view', {
      p_screen_id: screen_id
    })

    if (error) throw error
    if (!config) throw new Error('Screen not found')

    // Handle overrides
    const baseOverride = url.searchParams.get('base')
    const symbolsOverride = url.searchParams.get('symbols')?.split(',')
    if (baseOverride) config.content.currency.base = baseOverride.toUpperCase()
    if (symbolsOverride && config.content.currency.rates) {
      config.content.currency.rates = config.content.currency.rates.filter((r: any) => 
        symbolsOverride.includes(r.currency)
      )
    }

    const etag = crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(config)))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''))

    return new Response(JSON.stringify({ ...config, etag: await etag }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'ETag': await etag
      }
    })

  } catch (err: any) {
    console.error('[display-config] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
      status: err.message === 'Screen not found' ? 404 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
