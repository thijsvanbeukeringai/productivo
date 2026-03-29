import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { DocumentsClient } from '@/components/documents/DocumentsClient'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function DocumentsPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const { data: documents } = await supabase
    .from('project_documents')
    .select('*, uploader:profiles(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const canEdit = ['super_admin', 'company_admin'].includes(member.role)

  return (
    <main className="h-full overflow-y-auto px-4 py-4 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href={`/project/${projectId}/settings`} className="text-slate-400 hover:text-slate-600 text-sm">← Instellingen</a>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Documenten</h1>
        </div>

        <DocumentsClient
          projectId={projectId}
          documents={(documents || []).map(d => ({
            id: d.id,
            name: d.name,
            file_url: d.file_url,
            file_size: d.file_size,
            mime_type: d.mime_type,
            created_at: d.created_at,
            uploader_name: (d.uploader as { full_name: string | null } | null)?.full_name ?? null,
          }))}
          canEdit={canEdit}
        />
    </main>
  )
}
