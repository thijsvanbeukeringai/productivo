import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectInfoForm } from '@/components/project/ProjectInfoForm'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function ProjectInfoPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*, companies(name)')
    .eq('id', projectId)
    .single()
  if (!project) notFound()

  const { data: currentMember } = await supabase
    .from('project_members').select('*, profiles(*)')
    .eq('project_id', projectId).eq('user_id', user.id).single()
  if (!currentMember) redirect('/dashboard')

  const companyName = (project.companies as unknown as { name: string } | null)?.name || ''

  return (
    <main className="h-full overflow-y-auto p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Project informatie</h1>
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
      </div>
    </main>
  )
}
