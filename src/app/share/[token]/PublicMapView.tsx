'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MapSearch } from '@/components/map/MapSearch'
import type { Area, Position, MapPoi, MapPoiCategory, AreaStatus } from '@/types/app.types'

const AREA_COLORS: Record<AreaStatus, { fill: string; stroke: string }> = {
  open:      { fill: 'rgba(34,197,94,0.75)',  stroke: '#16a34a' },
  regulated: { fill: 'rgba(249,115,22,0.75)', stroke: '#ea580c' },
  closed:    { fill: 'rgba(239,68,68,0.75)',  stroke: '#dc2626' },
}
const STATUS_LABELS: Record<AreaStatus, string> = {
  open: 'Vrij', regulated: 'Gereguleerd', closed: 'Bezet',
}
const STATUS_BADGE: Record<AreaStatus, string> = {
  open: 'bg-green-500', regulated: 'bg-orange-500', closed: 'bg-red-500',
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

export function PublicMapView({ projectId, projectName, backgroundUrl, areas: initAreas, positions: initPositions, pois: initPois, categories }: Props) {
  const [areas, setAreas] = useState(initAreas)
  const [positions] = useState(initPositions)
  const [pois] = useState(initPois)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<Set<string>>(
    () => new Set(categories.map(c => c.id))
  )

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  // Realtime area status updates
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`public-areas-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'areas', filter: `project_id=eq.${projectId}` },
        p => setAreas(prev => prev.map(a => a.id === p.new.id ? { ...a, ...p.new } as Area : a)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  // Load image to get natural dimensions for SVG viewBox
  useEffect(() => {
    if (!backgroundUrl) return
    const img = new Image()
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = backgroundUrl
  }, [backgroundUrl])

  function toggleCategory(id: string) {
    setVisibleCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Zoom with wheel
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setTransform(t => {
      const newScale = Math.max(0.5, Math.min(10, t.scale * factor))
      const rect = mapRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      return {
        scale: newScale,
        x: cx - (cx - t.x) * (newScale / t.scale),
        y: cy - (cy - t.y) * (newScale / t.scale),
      }
    })
  }

  // Drag to pan (mouse)
  function handleMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y }
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setTransform(t => ({ ...t, x: dragRef.current!.tx + dx, y: dragRef.current!.ty + dy }))
  }
  function handleMouseUp() { dragRef.current = null }

  // Touch pinch/pan
  const touchRef = useRef<{ touches: React.Touch[]; tx: number; ty: number; scale: number } | null>(null)
  function handleTouchStart(e: React.TouchEvent) {
    touchRef.current = {
      touches: Array.from(e.touches) as unknown as React.Touch[],
      tx: transform.x, ty: transform.y, scale: transform.scale,
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const t0 = touchRef.current
    if (!t0) return
    if (e.touches.length === 1 && t0.touches.length === 1) {
      const dx = e.touches[0].clientX - t0.touches[0].clientX
      const dy = e.touches[0].clientY - t0.touches[0].clientY
      setTransform(t => ({ ...t, x: t0.tx + dx, y: t0.ty + dy }))
    } else if (e.touches.length === 2 && t0.touches.length === 2) {
      const prevDist = Math.hypot(t0.touches[0].clientX - t0.touches[1].clientX, t0.touches[0].clientY - t0.touches[1].clientY)
      const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      if (prevDist === 0) return
      const factor = newDist / prevDist
      const newScale = Math.max(0.5, Math.min(10, t0.scale * factor))
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const rect = mapRef.current!.getBoundingClientRect()
      const px = cx - rect.left
      const py = cy - rect.top
      setTransform({
        scale: newScale,
        x: px - (px - t0.tx) * (newScale / t0.scale),
        y: py - (py - t0.ty) * (newScale / t0.scale),
      })
    }
  }
  function handleTouchEnd() { touchRef.current = null }

  const selectedArea = areas.find(a => a.id === selectedAreaId)
  const selectedPos = positions.find(p => p.id === selectedPositionId)
  const selectedPoi = pois.find(p => p.id === selectedPoiId)
  const categoryMap = new Map(categories.map(c => [c.id, c]))
  const visiblePois = pois.filter(p => !p.category_id || visibleCategoryIds.has(p.category_id))

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950">
      {/* Top bar */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-700 px-3 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-sm truncate">{projectName}</span>
          <div className="flex items-center gap-2.5 shrink-0 ml-3">
            {(Object.entries(STATUS_LABELS) as [AreaStatus, string][]).map(([s, l]) => (
              <div key={s} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${STATUS_BADGE[s as AreaStatus]}`} />
                <span className="text-[10px] text-slate-400">{l}</span>
              </div>
            ))}
          </div>
        </div>

        <MapSearch
          areas={areas} positions={positions} pois={pois} categories={categories}
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
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${on ? 'text-white' : 'text-slate-500 bg-slate-800'}`}
                  style={on ? { backgroundColor: cat.color } : {}}>
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Map area */}
      <div
        ref={mapRef}
        className="flex-1 min-h-0 overflow-hidden relative select-none"
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}
      >
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 pointer-events-auto">
          <button onClick={e => { e.stopPropagation(); setTransform(t => ({ ...t, scale: Math.min(10, t.scale * 1.25) })) }}
            className="w-7 h-7 bg-slate-800/90 hover:bg-slate-700 text-white text-sm rounded border border-slate-600 flex items-center justify-center">+</button>
          <button onClick={e => { e.stopPropagation(); setTransform(t => ({ ...t, scale: Math.max(0.5, t.scale / 1.25) })) }}
            className="w-7 h-7 bg-slate-800/90 hover:bg-slate-700 text-white text-sm rounded border border-slate-600 flex items-center justify-center">−</button>
          <button onClick={e => { e.stopPropagation(); setTransform({ x: 0, y: 0, scale: 1 }) }}
            className="w-7 h-7 bg-slate-800/90 hover:bg-slate-700 text-white text-[10px] rounded border border-slate-600 flex items-center justify-center">⊡</button>
        </div>

        {/* Pan/zoom container */}
        <div
          style={{
            position: 'absolute', inset: 0,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {backgroundUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={backgroundUrl}
              alt=""
              onLoad={e => {
                const img = e.currentTarget
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
              }}
              style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}

          {imgSize && (
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
              viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <filter id="pub-glow">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Areas */}
              {areas.filter(a => a.map_polygon && a.map_polygon.length >= 3).map(area => {
                const c = AREA_COLORS[area.status]
                const isHL = highlightedId === area.id
                const isSel = selectedAreaId === area.id
                const pts = area.map_polygon!.map(p => `${p.x},${p.y}`).join(' ')
                const cx = area.map_polygon!.reduce((s, p) => s + p.x, 0) / area.map_polygon!.length
                const cy = area.map_polygon!.reduce((s, p) => s + p.y, 0) / area.map_polygon!.length
                const fs = Math.round(imgSize.w / 80)
                return (
                  <g key={area.id} style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setSelectedAreaId(area.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlightedId(null) }}>
                    <polygon points={pts} fill={c.fill}
                      stroke={isHL ? '#fbbf24' : isSel ? '#f59e0b' : c.stroke}
                      strokeWidth={isHL ? 4 : isSel ? 3 : 2}
                      filter={isHL ? 'url(#pub-glow)' : undefined} />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize={fs} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}
                      filter="url(#pub-text-shadow)">
                      {area.name}
                    </text>
                  </g>
                )
              })}

              {/* Positions */}
              {positions.filter(p => p.map_point).map(pos => {
                const isHL = highlightedId === pos.id
                const isSel = selectedPositionId === pos.id
                const r = Math.round(imgSize.w / 120)
                const fs = Math.round(r * 0.9)
                return (
                  <g key={pos.id} transform={`translate(${pos.map_point!.x},${pos.map_point!.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setSelectedPositionId(pos.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlightedId(null) }}>
                    <circle r={r} fill={isHL ? '#fbbf24' : isSel ? '#f59e0b' : '#3b82f6'}
                      stroke="white" strokeWidth={2}
                      filter={isHL ? 'url(#pub-glow)' : undefined} />
                    <text textAnchor="middle" dominantBaseline="middle"
                      fontSize={fs} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
                      {pos.number}
                    </text>
                    {(isHL || isSel) && (
                      <text y={r + Math.round(imgSize.w / 90)} textAnchor="middle"
                        fontSize={Math.round(imgSize.w / 100)} fontWeight="bold" fill="white"
                        stroke="black" strokeWidth={3} paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}>
                        Pos. {pos.number}{pos.name ? ` — ${pos.name}` : ''}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* POIs */}
              {visiblePois.map(poi => {
                const isHL = highlightedId === poi.id
                const isSel = selectedPoiId === poi.id
                const cat = poi.category_id ? categoryMap.get(poi.category_id) : null
                const color = cat?.color ?? '#6366f1'
                const isNum = cat?.display_style === 'numbered'
                const r = Math.round(imgSize.w / (isNum ? 100 : 160))
                const fs = Math.round(r * 0.85)
                return (
                  <g key={poi.id} transform={`translate(${poi.x},${poi.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setSelectedPoiId(poi.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlightedId(null) }}>
                    <circle r={r} fill={isHL ? '#fbbf24' : isSel ? '#f59e0b' : color}
                      stroke="white" strokeWidth={isSel || isHL ? 2.5 : 1.5}
                      filter={isHL ? 'url(#pub-glow)' : undefined} />
                    {isNum && (
                      <text textAnchor="middle" dominantBaseline="middle"
                        fontSize={fs} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
                        {poi.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {/* Detail panel */}
        {(selectedArea || selectedPos || selectedPoi) && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4 z-20"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}
              className="absolute top-3 right-3 text-slate-400 hover:text-white text-sm">✕</button>

            {selectedArea && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Area</p>
                <p className="text-white font-semibold text-lg">{selectedArea.name}</p>
                <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white ${STATUS_BADGE[selectedArea.status]}`}>
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
