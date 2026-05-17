import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `Missing Supabase credentials in .env\n` +
    `SUPABASE_URL: ${supabaseUrl ? 'set ✓' : 'MISSING ✗'}\n` +
    `SUPABASE_SERVICE_KEY: ${supabaseKey ? 'set ✓' : 'MISSING ✗'}`
  )
}

export const db = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
})