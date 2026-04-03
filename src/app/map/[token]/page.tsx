import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { PublicMapView } from './PublicMapView'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PublicMapPage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects')
    .select('id, name, map_background_url')
    .eq('map_share_token', token)
    .single()

  if (!project) notFound()

  const [areasRes, positionsRes, poisRes, categoriesRes] = await Promise.all([
    admin.from('areas').select('*').eq('project_id', project.id).order('sort_order'),
    admin.from('positions').select('*').eq('project_id', project.id).order('number'),
    admin.from('map_pois').select('*').eq('project_id', project.id).order('created_at'),
    admin.from('map_poi_categories').select('*').eq('project_id', project.id).order('sort_order'),
  ])

  return (
    <PublicMapView
      projectId={project.id}
      projectName={project.name}
      backgroundUrl={project.map_background_url ?? null}
      areas={areasRes.data ?? []}
      positions={positionsRes.data ?? []}
      pois={poisRes.data ?? []}
      categories={categoriesRes.data ?? []}
    />
  )
}
