'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_SUBJECTS = [
  'Medical', 'Onwelwording', 'Klimmers', 'Reanimatie', 'Toiletten',
  'Ontzegging', 'Sitecrew', 'Vermist persoon', 'Diefstal', 'Schoonmaak',
  'Drone', 'CR geblokkeerd', 'Wapens', 'Reguleren', 'Beveiligingspositie',
  'CADO geblokkeerd', 'Stroomstoring', 'Agressie', 'Overig', 'Weigering',
  'Code Rood', 'Aanhouding', 'Weersomstandigheden',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedDefaultSubjects(projectId: string, supabase: any) {
  // Fetch existing subject names for this project
  const { data: existing } = await supabase
    .from('subjects')
    .select('name')
    .eq('project_id', projectId)

  const existingNames = new Set((existing || []).map((s: { name: string }) => s.name))
  const toInsert = DEFAULT_SUBJECTS
    .filter(name => !existingNames.has(name))
    .map(name => ({ project_id: projectId, name }))

  if (toInsert.length > 0) {
    await supabase.from('subjects').insert(toInsert)
  }
}

export async function addDefaultSubjects(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }
  await seedDefaultSubjects(projectId, supabase)
  revalidatePath(`/project/${projectId}/settings`)
  return { success: true }
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const companyId = formData.get('company_id') as string

  const { data: project, error } = await supabase.from('projects').insert({
    company_id: companyId,
    name: formData.get('name') as string,
    location_name: (formData.get('location_name') as string) || null,
    location_address: (formData.get('location_address') as string) || null,
    start_date: (formData.get('start_date') as string) || null,
    end_date: (formData.get('end_date') as string) || null,
    project_leader: (formData.get('project_leader') as string) || null,
  }).select().single()

  if (error) return { error: error.message }

  // Add creator as project member with company_admin role
  const { data: memberRole } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: user.id,
    role: memberRole?.role || 'company_admin',
  })

  // Auto-create default subjects
  await seedDefaultSubjects(project.id, supabase)

  revalidatePath(`/dashboard`)
  redirect(`/project/${project.id}/settings`)
}

export async function cleanupExpiredProjectMembers(companyId: string) {
  const supabase = await createClient()

  // Find projects in this company whose end_date was more than 3 days ago
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 3)
  const cutoffStr = cutoff.toISOString().split('T')[0] // YYYY-MM-DD

  const { data: expiredProjects } = await supabase
    .from('projects')
    .select('id')
    .eq('company_id', companyId)
    .not('end_date', 'is', null)
    .lt('end_date', cutoffStr)

  if (!expiredProjects?.length) return { success: true }

  const projectIds = expiredProjects.map(p => p.id)

  // Remove all non-admin members from these projects
  await supabase
    .from('project_members')
    .delete()
    .in('project_id', projectIds)
    .not('role', 'in', '("super_admin","company_admin")')

  return { success: true }
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  // Use a SECURITY DEFINER SQL function to bypass RLS
  const { error } = await supabase.rpc('delete_project_cascade', { p_project_id: projectId })
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateProject(projectId: string, updates: {
  name?: string
  location_name?: string
  location_address?: string
  start_date?: string | null
  end_date?: string | null
  show_days?: string[]
  project_leader?: string
  invoice_details?: Record<string, unknown>
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)

  if (error) return { error: error.message }

  revalidatePath(`/project/${projectId}/settings`)
  revalidatePath(`/project/${projectId}/info`)
  return { success: true }
}

export async function getProjects(companyId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function getUserProjects() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, role, projects(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data }
}

export async function inviteUser(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd.' }

  const email = formData.get('email') as string
  const companyId = formData.get('company_id') as string
  const projectId = (formData.get('project_id') as string) || null
  const role = formData.get('role') as string

  // Check if user already exists in profiles
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingProfile) {
    // User exists - add directly
    await supabase.from('company_members').upsert({
      company_id: companyId,
      user_id: existingProfile.id,
      role,
    })

    if (projectId) {
      await supabase.from('project_members').upsert({
        project_id: projectId,
        user_id: existingProfile.id,
        role,
      })
    }
    return { success: true, existing: true }
  }

  // Create invitation
  const { error } = await supabase.from('invitations').insert({
    company_id: companyId,
    project_id: projectId,
    email,
    role,
    invited_by: user.id,
  })

  if (error) return { error: error.message }

  // In production: send invite email via Supabase Auth or email service
  return { success: true, existing: false }
}
