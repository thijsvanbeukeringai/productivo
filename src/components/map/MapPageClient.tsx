'use client'

import { useEffect, useRef, useState } from 'react'
import { MapView } from './MapView'
import { MapEditor } from './MapEditor'
import { GpsMapView } from './GpsMapView'
import type { Area, Position, MapPoi, MapPoiCategory, CalibrationPoint } from '@/types/app.types'

type Tab = 'live' | 'editor' | 'gps'

interface Props {
  projectId: string
  backgroundUrl: string | null
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories: MapPoiCategory[]
  calibration: CalibrationPoint[]
  canAdmin: boolean
}

export function MapPageClient({ projectId, backgroundUrl, areas, positions, pois, categories, calibration, canAdmin }: Props) {
  const [tab, setTab] = useState<Tab>(canAdmin ? 'editor' : 'live')
  const containerRef = useRef<HTMLDivElement>(null)
  const [editorSize, setEditorSize] = useState({ w: 1000, h: 700 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      setEditorSize({ w: Math.max(400, e.contentRect.width - 256), h: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${tab === t ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
    >
      {label}
    </button>
  )

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {tabBtn('live', 'Live kaart')}
        {tabBtn('gps', 'GPS kaart')}
        {canAdmin && tabBtn('editor', 'Editor')}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'editor' && canAdmin ? (
          <MapEditor
            projectId={projectId}
            backgroundUrl={backgroundUrl}
            areas={areas}
            positions={positions}
            pois={pois}
            categories={categories}
            calibration={calibration}
            canvasWidth={editorSize.w}
            canvasHeight={editorSize.h}
          />
        ) : tab === 'gps' ? (
          <GpsMapView
            areas={areas}
            positions={positions}
            pois={pois}
            categories={categories}
            calibration={calibration}
            backgroundUrl={backgroundUrl}
          />
        ) : (
          <MapView
            projectId={projectId}
            backgroundUrl={backgroundUrl}
            areas={areas}
            positions={positions}
            pois={pois}
            categories={categories}
          />
        )}
      </div>
    </div>
  )
}
