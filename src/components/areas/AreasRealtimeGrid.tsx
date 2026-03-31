'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { AreaCard } from './AreaCard'
import type { Area, CalibrationPoint } from '@/types/app.types'

const MAP_HEIGHT = 576

const MapCanvas = dynamic(
  () => import('@/components/map/MapCanvas').then(m => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: MAP_HEIGHT }} className="flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-sm text-slate-400">
        Kaart laden...
      </div>
    ),
  }
)

interface Props {
  projectId: string
  initialAreas: Area[]
  recentAreaCounts: Record<string, number>
  calibration: CalibrationPoint[]
  backgroundUrl: string | null
}

export function AreasRealtimeGrid({ projectId, initialAreas, recentAreaCounts, backgroundUrl }: Props) {
  const [areas, setAreas] = useState<Area[]>(initialAreas)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [mapWidth, setMapWidth] = useState(0)

  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setMapWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    setMapWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`dashboard-areas-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'areas', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setAreas(prev => [...prev, payload.new as Area])
          else if (payload.eventType === 'UPDATE') setAreas(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a))
          else if (payload.eventType === 'DELETE') setAreas(prev => prev.filter(a => a.id !== payload.old.id))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  if (areas.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 overflow-hidden">
      <div className="flex" style={{ height: MAP_HEIGHT }}>

        {/* Site plan map — 70% */}
        <div ref={mapContainerRef} style={{ flex: '0 0 70%', overflow: 'hidden' }}>
          {mapWidth > 0 && (
            <MapCanvas
              projectId={projectId}
              backgroundUrl={backgroundUrl}
              initialAreas={areas}
              initialPositions={[]}
              initialPois={[]}
              categories={[]}
              visibleCategoryIds={new Set()}
              width={mapWidth}
              height={MAP_HEIGHT}
            />
          )}
        </div>

        {/* Area list — 30% */}
        <div style={{ flex: '0 0 30%' }} className="border-l border-slate-200 dark:border-slate-700 flex flex-col min-w-0">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Area&apos;s</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {areas.map(area => (
              <AreaCard
                key={area.id}
                area={area}
                projectId={projectId}
                readonly
                count={recentAreaCounts[area.id] || 0}
                countDanger={(recentAreaCounts[area.id] || 0) > 4}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
