import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ProjectInfoForm } from '@/components/project/ProjectInfoForm'
import { getServerTranslations } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function SettingsPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()
  const T = await getServerTranslations()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectRes, memberRes] = await Promise.all([
    supabase.from('projects').select('*, companies(name), show_days').eq('id', projectId).single(),
    supabase.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).single(),
  ])

  const project = projectRes.data
  if (!project) notFound()
  if (!memberRes.data) redirect('/dashboard')

  const canAdmin = ['super_admin', 'company_admin', 'centralist'].includes(memberRes.data.role)
  const companyName = (project.companies as unknown as { name: string } | null)?.name || ''

  const settingsNav = [
    { href: 'subjects',  label: T.settings.subjects,  icon: '🏷️', desc: T.settings.subjectsDesc },
    { href: 'areas',     label: T.settings.areas,     icon: '📍', desc: T.settings.areasDesc },
    { href: 'teams',     label: T.settings.teams,     icon: '👥', desc: T.settings.teamsDesc },
    { href: 'positions', label: T.settings.positions, icon: '📌', desc: T.settings.positionsDesc },
    { href: 'members',   label: T.settings.members,   icon: '👤', desc: T.settings.membersDesc },
    { href: 'documents', label: T.settings.documents, icon: '📄', desc: T.settings.documentsDesc },
    { href: 'wristbands', label: T.settings.wristbands, icon: '🩹', desc: T.settings.wristbandsDesc },
  ]

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-5xl w-full mx-auto">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{T.settings.title}</h1>

      {/* Settings nav */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {settingsNav.map(item => (
          <Link
            key={item.href}
            href={`/project/${projectId}/settings/${item.href}`}
            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-sm transition-all group"
          >
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-medium text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {item.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Project info form */}
      {canAdmin && (
        <ProjectInfoForm
          projectId={projectId}
          companyName={companyName}
          project={{
            name: project.name,
            location_name: project.location_name,
            location_address: project.location_address,
            project_leader: project.project_leader,
            start_date: project.start_date,
            end_date: project.end_date,
            show_days: (project.show_days as string[]) || [],
            invoice_details: project.invoice_details as Record<string, unknown> | null,
          }}
        />
      )}
    </main>
  )
}
