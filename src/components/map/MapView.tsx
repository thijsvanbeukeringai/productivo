'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapCanvas } from './MapCanvas'
import { MapSearch } from './MapSearch'
import type { Area, Position, MapPoi, MapPoiCategory, AreaStatus } from '@/types/app.types'

const STATUS_LABELS: Record<AreaStatus, string> = {
  open: 'Vrij',
  regulated: 'Gereguleerd',
  closed: 'Bezet',
}
const STATUS_COLORS: Record<AreaStatus, string> = {
  open: 'bg-green-500',
  regulated: 'bg-orange-500',
  closed: 'bg-red-500',
}

interface Props {
  projectId: string
  backgroundUrl: string | null
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories: MapPoiCategory[]
}

export function MapView({ projectId, backgroundUrl, areas, positions, pois, categories }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // Auto-clear highlight after 2.5s so glow animation stops
  const setHighlight = useCallback((id: string | null) => {
    setHighlightedId(id)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    if (id) highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 2500)
  }, [])
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map(c => c.id))
  )

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  function toggleCategory(id: string) {
    setVisibleCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Direct canvas click — select item, clear any search highlight
  function handleSelectArea(area: Area) { setSelectedAreaId(area.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlightedId(null) }
  function handleSelectPosition(pos: Position) { setSelectedPositionId(pos.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlightedId(null) }
  function handleSelectPoi(poi: MapPoi) { setSelectedPoiId(poi.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlightedId(null) }

  const selectedArea = areas.find(a => a.id === selectedAreaId)
  const selectedPos = positions.find(p => p.id === selectedPositionId)
  const selectedPoi = pois.find(p => p.id === selectedPoiId)

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0 flex-wrap">
        <MapSearch
          areas={areas}
          positions={positions}
          pois={pois}
          categories={categories}
          onSelectArea={a => { setSelectedAreaId(a.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlight(a.id) }}
          onSelectPosition={p => { setSelectedPositionId(p.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlight(p.id) }}
          onSelectPoi={p => { setSelectedPoiId(p.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlight(p.id) }}
        />

        {/* Layer toggles */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Layers</span>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            {categories.map(cat => {
              const on = visibleCategoryIds.has(cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  title={on ? `${cat.name} verbergen` : `${cat.name} tonen`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none ${
                    on
                      ? 'text-white shadow-sm'
                      : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  style={on ? { backgroundColor: cat.color } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                    style={{ backgroundColor: cat.color, opacity: on ? 0 : 1, width: on ? 0 : undefined, marginRight: on ? 0 : undefined }}
                  />
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Area status legend */}
        <div className="flex items-center gap-3 ml-auto">
          {(Object.entries(STATUS_LABELS) as [AreaStatus, string][]).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLORS[status]}`} />
              <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Positie</span>
          </div>
        </div>
      </div>

      {/* Canvas + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-hidden"
          onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}>
          {size.w > 0 && (
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
              onAreaClick={handleSelectArea}
              onPositionClick={handleSelectPosition}
              onPoiClick={handleSelectPoi}
              highlightedId={highlightedId}
            />
          )}
        </div>

        {/* Detail panel */}
        {(selectedArea || selectedPos || selectedPoi) && (
          <div className="w-56 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 p-4 overflow-y-auto">
            <button onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}
              className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white text-xs mb-3">← Sluiten</button>

            {selectedArea && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Area</p>
                <p className="text-slate-900 dark:text-white font-semibold text-lg">{selectedArea.name}</p>
                <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${STATUS_COLORS[selectedArea.status]}`}>
                  {STATUS_LABELS[selectedArea.status]}
                </div>
              </div>
            )}

            {selectedPos && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Positie</p>
                <p className="text-slate-900 dark:text-white font-semibold text-lg">Pos. {selectedPos.number}</p>
                {selectedPos.name && <p className="text-slate-500 dark:text-slate-400 text-sm">{selectedPos.name}</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Status: <span className="text-slate-700 dark:text-slate-200 capitalize">{selectedPos.status.replace('_', ' ')}</span></p>
              </div>
            )}

            {selectedPoi && (
              <div>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Point of Interest</p>
                <p className="text-slate-900 dark:text-white font-semibold text-lg">{selectedPoi.label}</p>
                {selectedPoi.category_id && (() => {
                  const cat = categories.find(c => c.id === selectedPoi.category_id)
                  return cat ? (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-500 dark:text-slate-400 text-sm">{cat.name}</span>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
