import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AreasLiveGrid } from '@/components/areas/AreasLiveGrid'
import type { Area } from '@/types/app.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function AreasPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const { data: currentMember } = await supabase
    .from('project_members').select('*, profiles(*)')
    .eq('project_id', projectId).eq('user_id', user.id).single()
  if (!currentMember) redirect('/dashboard')

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
