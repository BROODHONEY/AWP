import { createClient } from '@supabase/supabase-js'
import 'dotenv'
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not defined in environment variables')
}
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_KEY is not defined in environment variables')
}

export const db = createClient(supabaseUrl, supabaseKey)