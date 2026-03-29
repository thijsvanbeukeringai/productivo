import { createClient } from '@/lib/supabase/server'
import { AdminClient, type AdminCompany, type AdminProject, type AdminUser } from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()

  const [companiesRes, projectsRes, usersRes] = await Promise.all([
    supabase.from('companies').select('*, projects(id)').order('name'),
    supabase.from('projects').select('*, companies(id, name), project_members(id)').order('name'),
    supabase.from('profiles').select(`
      *,
      company_members(role, company_id, companies(name)),
      project_members(role, project_id, projects(name))
    `).order('full_name'),
  ])

  const companies: AdminCompany[] = (companiesRes.data || []).map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    admin_name: c.admin_name ?? null,
    admin_email: c.admin_email ?? null,
    address: c.address ?? null,
    kvk_number: c.kvk_number ?? null,
    btw_number: c.btw_number ?? null,
    created_at: c.created_at,
    project_count: (c.projects as unknown[])?.length || 0,
  }))

  const projects: AdminProject[] = (projectsRes.data || []).map(p => {
    const co = p.companies as { id: string; name: string } | null
    return {
      id: p.id,
      name: p.name,
      company_id: co?.id || '',
      company_name: co?.name || '—',
      start_date: p.start_date,
      end_date: p.end_date,
      is_active: p.is_active,
      active_modules: (p.active_modules as string[]) ?? [],
      member_count: (p.project_members as unknown[])?.length || 0,
    }
  })

  const users: AdminUser[] = (usersRes.data || []).map(u => {
    type CmRaw = { role: string; company_id: string; companies: { name: string } | null }
    type PmRaw = { role: string; project_id: string; projects: { name: string } | null }
    const cms = (u.company_members as unknown as CmRaw[]) || []
    const pms = (u.project_members as unknown as PmRaw[]) || []
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      created_at: u.created_at,
      company_members: cms.map(m => ({
        company_id: m.company_id,
        company_name: m.companies?.name || '—',
        role: m.role,
      })),
      project_members: pms.map(m => ({
        project_id: m.project_id,
        project_name: m.projects?.name || '—',
        role: m.role,
      })),
    }
  })

  return <AdminClient companies={companies} projects={projects} users={users} />
}
