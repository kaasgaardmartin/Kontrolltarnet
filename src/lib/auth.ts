import { createClient } from './supabase'
import type { User } from '@supabase/supabase-js'

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signUp(email: string, password: string, navn: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { navn },
    },
  })
  return { data, error }
}

export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getUser(): Promise<User | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getBruker(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('brukere')
    .select('*, organisasjoner(navn, domene)')
    .eq('id', userId)
    .single()
  return { data, error }
}
