import { notFound, redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCachedMember } from '@/lib/supabase/session'
import { MapPageClient } from '@/components/map/MapPageClient'
import type { CalibrationPoint } from '@/types/app.types'

interface PageProps {
  params: Promise<{ projectId: string }>
}

const getCachedMapData = unstable_cache(
  async (projectId: string) => {
    const admin = createAdminClient()
    const [areasRes, positionsRes, poisRes, categoriesRes] = await Promise.all([
      admin.from('areas').select('*').eq('project_id', projectId).order('sort_order'),
      admin.from('positions').select('*').eq('project_id', projectId).order('number'),
      admin.from('map_pois').select('*').eq('project_id', projectId).order('created_at'),
      admin.from('map_poi_categories').select('*').eq('project_id', projectId).order('sort_order'),
    ])
    return {
      areas: areasRes.data ?? [],
      positions: positionsRes.data ?? [],
      pois: poisRes.data ?? [],
      categories: categoriesRes.data ?? [],
    }
  },
  ['map-data'],
  { revalidate: 10, tags: ['map-data'] }
)

export default async function MapPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const [member, projectRes, mapData] = await Promise.all([
    getCachedMember(projectId, session.user.id),
    admin.from('projects').select('map_background_url, map_calibration').eq('id', projectId).single(),
    getCachedMapData(projectId),
  ])

  if (!member) redirect('/dashboard')
  if (!projectRes.data) notFound()

  const canAdmin = ['super_admin', 'company_admin'].includes(member.role)

  return (
    <main className="h-full overflow-hidden">
      <MapPageClient
        projectId={projectId}
        backgroundUrl={projectRes.data.map_background_url ?? null}
        areas={mapData.areas}
        positions={mapData.positions}
        pois={mapData.pois}
        categories={mapData.categories}
        calibration={(projectRes.data.map_calibration as CalibrationPoint[]) ?? []}
        canAdmin={canAdmin}
      />
    </main>
  )
}
