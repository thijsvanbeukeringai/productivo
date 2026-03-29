import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MapPageClient } from '@/components/map/MapPageClient'

interface PageProps {
  params: Promise<{ projectId: string }>
}

export default async function MapPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectRes, memberRes, areasRes, positionsRes, poisRes, categoriesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('project_members').select('role').eq('project_id', projectId).eq('user_id', user.id).single(),
    supabase.from('areas').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('positions').select('*').eq('project_id', projectId).order('number'),
    supabase.from('map_pois').select('*').eq('project_id', projectId).order('created_at'),
    supabase.from('map_poi_categories').select('*').eq('project_id', projectId).order('sort_order'),
  ])

  const project = projectRes.data
  if (!project) notFound()
  if (!memberRes.data) redirect('/dashboard')

  const canAdmin = ['super_admin', 'company_admin'].includes(memberRes.data.role)

  return (
    <main className="h-full overflow-hidden">
      <MapPageClient
        projectId={projectId}
        backgroundUrl={project.map_background_url ?? null}
        areas={areasRes.data ?? []}
        positions={positionsRes.data ?? []}
        pois={poisRes.data ?? []}
        categories={categoriesRes.data ?? []}
        calibration={(project.map_calibration as import('@/types/app.types').CalibrationPoint[]) ?? []}
        canAdmin={canAdmin}
      />
    </main>
  )
}
