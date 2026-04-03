'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { MapSearch } from '@/components/map/MapSearch'
import type { Area, Position, MapPoi, MapPoiCategory, AreaStatus } from '@/types/app.types'

const MapCanvas = dynamic(
  () => import('@/components/map/MapCanvas').then(m => m.MapCanvas),
  { ssr: false }
)

const STATUS_COLORS: Record<AreaStatus, string> = {
  open: 'bg-green-500',
  regulated: 'bg-orange-500',
  closed: 'bg-red-500',
}
const STATUS_LABELS: Record<AreaStatus, string> = {
  open: 'Vrij',
  regulated: 'Gereguleerd',
  closed: 'Bezet',
}

interface Props {
  projectId: string
  projectName: string
  backgroundUrl: string | null
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories: MapPoiCategory[]
}

export function PublicMapView({ projectId, projectName, backgroundUrl, areas, positions, pois, categories }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map(c => c.id))
  )

  // Measure the canvas container using ResizeObserver
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      if (r.width > 0 && r.height > 0) {
        setSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
      }
    })
    ro.observe(el)
    // Also set immediately in case ResizeObserver fires synchronously
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) })
    }
    return () => ro.disconnect()
  }, [])

  function toggleCategory(id: string) {
    setVisibleCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedArea = areas.find(a => a.id === selectedAreaId)
  const selectedPos = positions.find(p => p.id === selectedPositionId)
  const selectedPoi = pois.find(p => p.id === selectedPoiId)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#020617',
      }}
    >
      {/* Top bar */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-700 px-3 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-sm truncate">{projectName}</span>
          <div className="flex items-center gap-2.5 shrink-0 ml-3">
            {(Object.entries(STATUS_LABELS) as [AreaStatus, string][]).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${STATUS_COLORS[status]}`} />
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <MapSearch
          areas={areas}
          positions={positions}
          pois={pois}
          categories={categories}
          onSelectArea={a => { setSelectedAreaId(a.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlightedId(a.id) }}
          onSelectPosition={p => { setSelectedPositionId(p.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlightedId(p.id) }}
          onSelectPoi={p => { setSelectedPoiId(p.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlightedId(p.id) }}
        />

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map(cat => {
              const on = visibleCategoryIds.has(cat.id)
              return (
                <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${on ? 'text-white' : 'text-slate-500 bg-slate-800'}`}
                  style={on ? { backgroundColor: cat.color } : {}}>
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Canvas container — fills remaining space */}
      <div
        ref={canvasRef}
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
        onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}
      >
        {size && (
          <MapCanvas
            projectId={projectId}
            backgroundUrl={backgroundUrl}
            initialAreas={areas}
            initialPositions={positions}
            initialPois={pois}
            categories={categories}
            visibleCategoryIds={visibleCategoryIds}
            width={size.w}
            height={size.h}
            selectedAreaId={selectedAreaId}
            selectedPositionId={selectedPositionId}
            selectedPoiId={selectedPoiId}
            onAreaClick={a => { setSelectedAreaId(a.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlightedId(null) }}
            onPositionClick={p => { setSelectedPositionId(p.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlightedId(null) }}
            onPoiClick={p => { setSelectedPoiId(p.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlightedId(null) }}
            highlightedId={highlightedId}
          />
        )}

        {/* Detail panel */}
        {(selectedArea || selectedPos || selectedPoi) && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-sm"
            >✕</button>

            {selectedArea && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Area</p>
                <p className="text-white font-semibold text-lg">{selectedArea.name}</p>
                <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${STATUS_COLORS[selectedArea.status]}`}>
                  {STATUS_LABELS[selectedArea.status]}
                </div>
              </div>
            )}

            {selectedPos && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Positie</p>
                <p className="text-white font-semibold text-lg">Pos. {selectedPos.number}</p>
                {selectedPos.name && <p className="text-slate-400 text-sm">{selectedPos.name}</p>}
              </div>
            )}

            {selectedPoi && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {categories.find(c => c.id === selectedPoi.category_id)?.name ?? 'POI'}
                </p>
                <p className="text-white font-semibold text-lg">{selectedPoi.label}</p>
                {selectedPoi.note && <p className="text-slate-400 text-sm mt-1">{selectedPoi.note}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
