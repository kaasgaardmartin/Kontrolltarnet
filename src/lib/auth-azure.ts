/**
 * Azure AD / Microsoft Entra ID Authentication Provider
 *
 * To enable Azure AD authentication:
 * 1. Set up an App Registration in Azure Portal (see spec section 4)
 * 2. Configure Azure provider in Supabase Dashboard → Authentication → Providers
 * 3. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID in .env.local
 * 4. Replace the imports in your components from './auth' to './auth-azure'
 *    Or: swap the active provider in auth.ts
 */

import { createClient } from './supabase'
import type { User } from '@supabase/supabase-js'

export async function signInWithAzure() {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile',
      redirectTo: `${window.location.origin}/auth/callback`,
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
