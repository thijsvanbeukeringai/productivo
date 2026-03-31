import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCachedMember } from '@/lib/supabase/session'
import { getDashboardStats } from '@/lib/actions/dashboard.actions'
import { ProjectDashboardClient } from '@/components/dashboard/ProjectDashboardClient'
import type { CalibrationPoint } from '@/types/app.types'
interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function DashboardPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [member, projectRes, initialStats] = await Promise.all([
    getCachedMember(projectId, session.user.id),
    supabase.from('projects').select('map_calibration, map_background_url').eq('id', projectId).single(),
    getDashboardStats(projectId),
  ])

  if (!member) redirect('/dashboard')
  if (!projectRes.data) notFound()
  if (!initialStats) notFound()

  return (
    <main className="h-full overflow-y-auto px-6 py-4 w-full">
      <ProjectDashboardClient
        projectId={projectId}
        initialStats={initialStats}
        calibration={(projectRes.data.map_calibration as CalibrationPoint[]) ?? []}
        backgroundUrl={projectRes.data.map_background_url ?? null}
      />
    </main>
  )
}
