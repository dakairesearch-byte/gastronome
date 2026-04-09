import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-key'

  return createBrowserClient<Database>(supabaseUrl, supabaseKey)
}
