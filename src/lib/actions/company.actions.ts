'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function inviteCompanyUser(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const email = formData.get('email') as string
  const companyId = formData.get('company_id') as string
  const role = formData.get('role') as string

  if (!email || !companyId || !role) return { error: 'Vul alle velden in.' }

  // Check if user already exists in profiles
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingProfile) {
    const { error } = await supabase.from('company_members').upsert({
      company_id: companyId,
      user_id: existingProfile.id,
      role,
    }, { onConflict: 'company_id,user_id' })
    if (error) return { error: error.message }
    revalidatePath('/dashboard')
    return { success: true, existing: true }
  }

  // Create invitation
  const { error } = await supabase.from('invitations').insert({
    company_id: companyId,
    email,
    role,
    invited_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true, existing: false }
}

export async function updateMemberRole(userId: string, companyId: string, role: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('company_members')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function assignMemberToProject(userId: string, projectId: string, role: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('project_members').upsert({
    project_id: projectId,
    user_id: userId,
    role,
  }, { onConflict: 'project_id,user_id' })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function removeMemberFromProject(userId: string, projectId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}
