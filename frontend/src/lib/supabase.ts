import { createClient } from '@supabase/supabase-js'

// These are read from .env.local (never commit that file).
// Vite exposes env vars that start with VITE_ to the browser.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly so a missing variable is obvious during development
  throw new Error(
    'Missing Supabase env vars. Copy frontend/.env.example to frontend/.env.local and fill in your values.',
  )
}

// A single shared Supabase client for the whole app.
// Import this wherever you need to query the database or auth.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
