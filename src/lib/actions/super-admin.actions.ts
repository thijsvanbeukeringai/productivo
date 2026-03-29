'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let pass = ''
  for (let i = 0; i < 12; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)]
  }
  return pass
}

async function guardSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .single()
  return data ? user : null
}

export async function adminUpdateCompany(companyId: string, data: {
  name?: string
  slug?: string
  admin_name?: string
  admin_email?: string
  address?: string
  kvk_number?: string
  btw_number?: string
}) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin.from('companies').update(data).eq('id', companyId)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function createCompany(formData: FormData) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const name = (formData.get('name') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-')
  if (!name || !slug) return { error: 'Vul naam en slug in.' }

  const admin = createAdminClient()
  const { error } = await admin.from('companies').insert({ name, slug })
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function sendTempPassword(userId: string) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const tempPassword = generatePassword()

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  })

  if (error) return { error: error.message }
  return { password: tempPassword }
}

export async function adminCreateUser(formData: FormData) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const email = (formData.get('email') as string)?.trim()
  const fullName = (formData.get('full_name') as string)?.trim()
  if (!email) return { error: 'Vul een e-mailadres in.' }

  const admin = createAdminClient()
  const tempPassword = generatePassword()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
  })

  if (error) return { error: error.message }

  if (fullName && data.user) {
    await admin.from('profiles').update({ full_name: fullName }).eq('id', data.user.id)
  }

  revalidatePath('/admin')
  return { success: true, password: tempPassword, userId: data.user?.id }
}

export async function adminAssignUserToCompany(userId: string, companyId: string, role: string) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_members').upsert(
    { user_id: userId, company_id: companyId, role },
    { onConflict: 'company_id,user_id' }
  )
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function adminRemoveUserFromCompany(userId: string, companyId: string) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { data: targetUser } = await admin.auth.admin.getUserById(userId)
  if (targetUser?.user?.email === 'thijsvanbeukering@icloud.com') {
    return { error: 'Dit account kan niet worden gewijzigd.' }
  }

  const { error } = await admin.from('company_members')
    .delete().eq('user_id', userId).eq('company_id', companyId)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function adminAssignUserToProject(userId: string, projectId: string, role: string) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin.from('project_members').upsert(
    { user_id: userId, project_id: projectId, role },
    { onConflict: 'project_id,user_id' }
  )
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function adminUpdateUserName(userId: string, fullName: string) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function adminUpdateProjectModules(projectId: string, modules: string[]) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  const { error } = await admin.from('projects').update({ active_modules: modules }).eq('id', projectId)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath(`/project/${projectId}`)
  return { success: true }
}

export async function adminRemoveUserFromProject(userId: string, projectId: string) {
  const user = await guardSuperAdmin()
  if (!user) return { error: 'Geen toegang.' }

  const admin = createAdminClient()
  // Guard: cannot modify the protected super admin account
  const { data: targetUser } = await admin.auth.admin.getUserById(userId)
  if (targetUser?.user?.email === 'thijsvanbeukering@icloud.com') {
    return { error: 'Dit account kan niet worden gewijzigd.' }
  }

  const { error } = await admin.from('project_members')
    .delete().eq('user_id', userId).eq('project_id', projectId)
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}
