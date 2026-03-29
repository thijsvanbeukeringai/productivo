'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AreaCard } from './AreaCard'
import type { Area } from '@/types/app.types'

interface Props {
  projectId: string
  initialAreas: Area[]
}

export function AreasLiveGrid({ projectId, initialAreas }: Props) {
  const [areas, setAreas] = useState<Area[]>(initialAreas)

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`areas-page-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAreas(prev => [...prev, payload.new as Area].sort((a, b) => a.name.localeCompare(b.name)))
          } else if (payload.eventType === 'UPDATE') {
            setAreas(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a))
          } else if (payload.eventType === 'DELETE') {
            setAreas(prev => prev.filter(a => a.id !== payload.old.id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  if (areas.length === 0) {
    return <p className="text-sm text-slate-400">Geen area&apos;s aangemaakt.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {areas.map(area => (
        <AreaCard key={area.id} area={area} projectId={projectId} />
      ))}
    </div>
  )
}
