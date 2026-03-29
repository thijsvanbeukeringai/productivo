import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DocumentsClient } from '@/components/documents/DocumentsClient'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function DocumentsPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const { data: currentMember } = await supabase
    .from('project_members').select('*, profiles(*)').eq('project_id', projectId).eq('user_id', user.id).single()
  if (!currentMember) redirect('/dashboard')

  const { data: documents } = await supabase
    .from('project_documents')
    .select('*, uploader:profiles(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const canEdit = ['super_admin', 'company_admin'].includes(currentMember.role)

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
