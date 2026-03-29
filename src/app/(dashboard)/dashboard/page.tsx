import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { cleanupExpiredProjectMembers } from '@/lib/actions/project.actions'

interface ProjectRow {
  id: string
  name: string
  location_name: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  companies?: { name: string }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Company memberships for current user
  const { data: companyMemberships } = await supabase
    .from('company_members')
    .select('role, company_id, companies(*)')
    .eq('user_id', user.id)

  const isAdmin = companyMemberships?.some(c => ['super_admin', 'company_admin'].includes(c.role)) ?? false
  const isSuperAdmin = companyMemberships?.some(c => c.role === 'super_admin') ?? false
  const firstCompany = companyMemberships?.[0]
  const companyId = (firstCompany?.companies as unknown as { id: string } | null)?.id ?? firstCompany?.company_id ?? ''

  // Auto-cleanup: remove non-admin members from projects expired > 3 days ago
  if (companyId) await cleanupExpiredProjectMembers(companyId)

  // Projects the current user belongs to (for non-admins)
  const { data: projectMemberships } = await supabase
    .from('project_members')
    .select('projects(id, name, location_name, start_date, end_date, is_active, companies(name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const userProjects: ProjectRow[] = (projectMemberships || [])
    .map(m => m.projects as unknown as ProjectRow | null)
    .filter((p): p is ProjectRow => p !== null)

  // Admin-only: all company projects + all company members
  let allProjects: ProjectRow[] = []
  let members: {
    user_id: string
    role: string
    email: string
    full_name: string | null
    projectMemberships: { project_id: string; role: string; project_name: string }[]
  }[] = []

  if (isAdmin && companyId) {
    const { data: projectsData } = await supabase
      .from('projects')
      .select('id, name, location_name, start_date, end_date, is_active')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    allProjects = (projectsData || []) as ProjectRow[]

    // Fetch all company members with their profiles
    const { data: companyMembers } = await supabase
      .from('company_members')
      .select('user_id, role, profiles(id, email, full_name)')
      .eq('company_id', companyId)

    // Fetch all project memberships for members in this company
    const projectIds = allProjects.map((p: ProjectRow) => p.id)
    const memberUserIds = (companyMembers || []).map(m => m.user_id)

    let projectMemberMap: Record<string, { project_id: string; role: string; project_name: string }[]> = {}

    if (projectIds.length > 0 && memberUserIds.length > 0) {
      const { data: allProjMembers } = await supabase
        .from('project_members')
        .select('user_id, project_id, role')
        .in('project_id', projectIds)
        .in('user_id', memberUserIds)

      const projectNameMap = Object.fromEntries(allProjects.map((p: ProjectRow) => [p.id, p.name]))

      for (const pm of allProjMembers || []) {
        if (!projectMemberMap[pm.user_id]) projectMemberMap[pm.user_id] = []
        projectMemberMap[pm.user_id].push({
          project_id: pm.project_id,
          role: pm.role,
          project_name: projectNameMap[pm.project_id] || '',
        })
      }
    }

    members = (companyMembers || []).map(m => {
      const profile = m.profiles as unknown as { email: string; full_name: string | null } | null
      return {
        user_id: m.user_id,
        role: m.role,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        projectMemberships: projectMemberMap[m.user_id] || [],
      }
    })
  }

  return (
    <DashboardClient
      companyId={companyId}
      isAdmin={isAdmin}
      isSuperAdmin={isSuperAdmin}
      projects={allProjects}
      members={members}
      userProjects={userProjects}
    />
  )
}
