import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectHeader } from '@/components/layout/ProjectHeader'
import { ProjectSidebar } from '@/components/layout/ProjectSidebar'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { DEFAULT_LANG, type Lang } from '@/lib/i18n/translations'
import type { Profile } from '@/types/app.types'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}

export default async function ProjectLayout({ children, params }: LayoutProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectRes, memberRes, standbyRes, companyMemberRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_members').select('*, profiles(*)').eq('project_id', projectId).eq('user_id', user.id).single(),
    supabase.from('teams').select('*').eq('project_id', projectId).eq('is_standby', true).eq('is_active', true),
    supabase.from('company_members').select('role').eq('user_id', user.id).eq('role', 'super_admin').maybeSingle(),
  ])

  const project = projectRes.data
  if (!project) notFound()

  const currentMember = memberRes.data
  if (!currentMember) redirect('/dashboard')

  const standbyTeams = standbyRes.data || []
  const canAdmin = ['super_admin', 'company_admin'].includes(currentMember.role)
  const isSuperAdmin = !!companyMemberRes.data
  const activeModules: string[] = project.active_modules || ['logbook']

  const profile = currentMember.profiles as Profile | null
  const userLang = ((profile?.language) || DEFAULT_LANG) as Lang

  return (
    <LanguageProvider initialLang={userLang}>
    <div className="flex flex-col h-screen">
      <ProjectHeader
        project={project}
        projectId={projectId}
        standbyTeams={standbyTeams}
        currentMember={currentMember}
        userEmail={user.email || ''}
        canAdmin={canAdmin}
        isSuperAdmin={isSuperAdmin}
        userId={user.id}
      />
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          projectId={projectId}
          activeModules={activeModules}
          canAdmin={canAdmin}
        />
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
    </LanguageProvider>
  )
}
