// =============================================================================
// Travel Connect Pro — Edge Function Entry: currency-refresh
// =============================================================================

import { serve } from './currency-refresh.ts';

// Standard Supabase Edge Function Entry Point
Deno.serve(async (req) => {
  return await serve(req);
});

export default serve;
