import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabaseClient } from './supabaseClient'

export const isSupabaseConfigured = supabaseClient !== null

export const getSupabaseAuthErrorMessage = (
  error: unknown,
  fallbackMessage: string,
): string => {
  if (error instanceof Error) {
    return error.message
  }

  return fallbackMessage
}

export const getCurrentSession = async (): Promise<Session | null> => {
  if (!supabaseClient) {
    return null
  }

  const { data, error } = await supabaseClient.auth.getSession()
  if (error) {
    throw error
  }

  return data.session
}

export const signInWithGoogle = async (): Promise<void> => {
  if (!supabaseClient) {
    return
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })

  if (error) {
    throw error
  }
}

export const signOutCurrentUser = async (): Promise<void> => {
  if (!supabaseClient) {
    return
  }

  const { error } = await supabaseClient.auth.signOut()
  if (error) {
    throw error
  }
}

export const subscribeToAuthChanges = (
  onAuthStateChange: (event: AuthChangeEvent, session: Session | null) => void,
) => {
  if (!supabaseClient) {
    return () => {}
  }

  const {
    data: { subscription },
  } = supabaseClient.auth.onAuthStateChange(onAuthStateChange)

  return () => {
    subscription.unsubscribe()
  }
}
