import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { PublicMapView } from './PublicMapView'

interface PageProps {
  params: Promise<{ token: string }>
}

// Plain anon client — no cookies, no auth dependency
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function PublicMapPage({ params }: PageProps) {
  const { token } = await params
  const supabase = createAnonClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, map_background_url')
    .eq('map_share_token', token)
    .single()

  if (!project) notFound()

  const [areasRes, positionsRes, poisRes, categoriesRes] = await Promise.all([
    supabase.from('areas').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('positions').select('*').eq('project_id', project.id).order('number'),
    supabase.from('map_pois').select('*').eq('project_id', project.id).order('created_at'),
    supabase.from('map_poi_categories').select('*').eq('project_id', project.id).order('sort_order'),
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
