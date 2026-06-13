import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials.\n' +
    'Copy .env.example → .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

/**
 * Shared Supabase client used everywhere in the frontend.
 *
 * Configured with the **anon** key, so every query is subject to Row Level
 * Security. Service-role operations live exclusively in edge functions
 * (`supabase/functions/*`) and must never be performed from the browser.
 *
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabase = createClient(supabaseUrl, supabaseKey)
