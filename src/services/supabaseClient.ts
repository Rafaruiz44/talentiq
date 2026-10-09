import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY?.trim()
const isValidSupabaseUrl = (() => {
  if (!supabaseUrl) {
    return false
  }
  try {
    const protocol = new URL(supabaseUrl).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
})()

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY para habilitar el acceso.'
    : !isValidSupabaseUrl
      ? 'SUPABASE_URL debe ser una URL HTTP o HTTPS válida.'
    : null

export const supabaseClient =
  supabaseUrl && supabaseAnonKey && isValidSupabaseUrl
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null
