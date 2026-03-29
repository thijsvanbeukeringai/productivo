import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { AreasLiveGrid } from '@/components/areas/AreasLiveGrid'
import type { Area } from '@/types/app.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function AreasPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const userId = session.user.id

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const member = await getCachedMember(projectId, userId)
  if (!member) redirect('/dashboard')

  const { data: areas } = await supabase
    .from('areas').select('*').eq('project_id', projectId).order('name')

  return (
    <main className="h-full overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Area&apos;s</h1>
        <AreasLiveGrid projectId={projectId} initialAreas={(areas ?? []) as Area[]} />
      </div>
    </main>
  )
}
