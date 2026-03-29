'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (data.user?.user_metadata?.must_change_password) {
    redirect('/change-password')
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function acceptInvite(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const token = formData.get('token') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  // Find the invitation
  const { data: invitation, error: invErr } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (invErr || !invitation) {
    redirect('/invite/invalid')
  }

  // Sign up the user
  const { data: authData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (signUpErr || !authData.user) {
    redirect('/login?error=signup_failed')
  }

  // Update profile name
  await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', authData.user.id)

  // Add to company
  await supabase.from('company_members').insert({
    company_id: invitation.company_id,
    user_id: authData.user.id,
    role: invitation.role,
  })

  // Add to project if specified
  if (invitation.project_id) {
    await supabase.from('project_members').insert({
      project_id: invitation.project_id,
      user_id: authData.user.id,
      role: invitation.role,
    })
  }

  // Mark invitation as accepted
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  redirect('/dashboard')
}
