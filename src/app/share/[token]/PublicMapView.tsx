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

// Fixed screen-pixel sizes for markers (constant regardless of zoom)
const DOT_R = 5        // dot POI radius in screen px
const NUM_R = 7        // numbered POI radius in screen px (fits 2-char text)
const POS_R = 4.6      // position marker radius in screen px (+15%)
const TAP_R = 22       // invisible tap target radius in screen px

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
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [headerHeight, setHeaderHeight] = useState(96)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const visibleCategoryIds = new Set(categories.map(c => c.id))
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  const headerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null)
  const touchRef = useRef<{ touches: React.Touch[]; tx: number; ty: number; scale: number } | null>(null)
  const zoomRafRef = useRef<number>(0)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Measure header height so map sits exactly below it
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderHeight(el.getBoundingClientRect().height))
    ro.observe(el)
    setHeaderHeight(el.getBoundingClientRect().height)
    return () => ro.disconnect()
  }, [])

  // Auto-clear search highlight after 2.5 s
  useEffect(() => {
    if (!highlightedId) return
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 2500)
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current) }
  }, [highlightedId])

  // Measure container for SVG scale calculation
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) setContainerSize({ w: rect.width, h: rect.height })
    return () => ro.disconnect()
  }, [])

  // Load image natural dimensions for SVG viewBox
  useEffect(() => {
    if (!backgroundUrl) return
    const img = new Image()
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = backgroundUrl
  }, [backgroundUrl])

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

  // Animate zoom to an image-space coordinate
  function zoomToPoint(imgX: number, imgY: number) {
    if (!containerSize || !imgSize) return
    cancelAnimationFrame(zoomRafRef.current)
    const bs = Math.min(containerSize.w / imgSize.w, containerSize.h / imgSize.h)
    const offX = (containerSize.w - imgSize.w * bs) / 2
    const offY = (containerSize.h - imgSize.h * bs) / 2
    const tdX = imgX * bs + offX   // position in transform-div space
    const tdY = imgY * bs + offY
    const targetScale = 7
    const targetX = containerSize.w / 2 - tdX * targetScale
    const targetY = containerSize.h / 2 - tdY * targetScale
    const start = performance.now()
    const duration = 550
    setTransform(cur => {
      const s0 = cur.scale, x0 = cur.x, y0 = cur.y
      function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t }
      function step(now: number) {
        const t = Math.min((now - start) / duration, 1)
        const e = ease(t)
        setTransform({
          scale: s0 + (targetScale - s0) * e,
          x: x0 + (targetX - x0) * e,
          y: y0 + (targetY - y0) * e,
        })
        if (t < 1) zoomRafRef.current = requestAnimationFrame(step)
      }
      zoomRafRef.current = requestAnimationFrame(step)
      return cur // no immediate change; animation handles it
    })
  }

  // SVG scale: ratio between SVG viewBox units and actual screen pixels
  // Used to render markers at constant screen-pixel sizes
  const svgBaseScale = imgSize && containerSize
    ? Math.min(containerSize.w / imgSize.w, containerSize.h / imgSize.h)
    : 1
  const svgScale = svgBaseScale * transform.scale

  // Markers grow 10% per zoom doubling (e.g. 2x zoom → 1.1x bigger, 4x → 1.2x)
  const zoomBoost = 1 + Math.log2(Math.max(1, transform.scale)) * 0.1

  // Convert desired screen px to SVG units
  const px = (screenPx: number) => (screenPx * zoomBoost) / svgScale


  // Wheel zoom
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    setTransform(t => {
      const newScale = Math.max(0.5, Math.min(10, t.scale * factor))
      const rect = mapRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      return { scale: newScale, x: cx - (cx - t.x) * (newScale / t.scale), y: cy - (cy - t.y) * (newScale / t.scale) }
    })
  }

  // Mouse drag
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

  // Touch pan/pinch
  function handleTouchStart(e: React.TouchEvent) {
    touchRef.current = { touches: Array.from(e.touches), tx: transform.x, ty: transform.y, scale: transform.scale }
  }
  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const t0 = touchRef.current
    if (!t0) return
    if (e.touches.length === 1 && t0.touches.length === 1) {
      const dx = e.touches[0].clientX - t0.touches[0].clientX
      const dy = e.touches[0].clientY - t0.touches[0].clientY
      if (Math.hypot(dx, dy) < 4) return // ignore micro-movements so tap clicks still fire
      setTransform(t => ({ ...t, x: t0.tx + dx, y: t0.ty + dy }))
    } else if (e.touches.length === 2 && t0.touches.length >= 2) {
      const prevDist = Math.hypot(t0.touches[0].clientX - t0.touches[1].clientX, t0.touches[0].clientY - t0.touches[1].clientY)
      const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      if (prevDist === 0) return
      const newScale = Math.max(0.5, Math.min(10, t0.scale * (newDist / prevDist)))
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - mapRef.current!.getBoundingClientRect().left
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - mapRef.current!.getBoundingClientRect().top
      setTransform({ scale: newScale, x: cx - (cx - t0.tx) * (newScale / t0.scale), y: cy - (cy - t0.ty) * (newScale / t0.scale) })
    }
  }
  function handleTouchEnd() { touchRef.current = null }

  const selectedArea = areas.find(a => a.id === selectedAreaId)
  const selectedPos = initPositions.find(p => p.id === selectedPositionId)
  const selectedPoi = initPois.find(p => p.id === selectedPoiId)
  const categoryMap = new Map(categories.map(c => [c.id, c]))
  const visiblePois = initPois.filter(p => !p.category_id || visibleCategoryIds.has(p.category_id))

  return (
    <div className="bg-slate-950" style={{ position: 'fixed', inset: 0 }}>
      {/* Top bar — own fixed layer, always on top regardless of map stacking contexts */}
      <div ref={headerRef}
        className="bg-slate-900 border-b border-slate-700 px-3 pb-2 flex flex-col gap-2"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
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
          className="w-full"
          areas={areas} positions={initPositions} pois={initPois} categories={categories}
          onSelectArea={a => {
            setSelectedAreaId(a.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlightedId(a.id)
            const poly = areas.find(ar => ar.id === a.id)?.map_polygon
            if (poly?.length) zoomToPoint(poly.reduce((s, p) => s + p.x, 0) / poly.length, poly.reduce((s, p) => s + p.y, 0) / poly.length)
          }}
          onSelectPosition={p => {
            setSelectedPositionId(p.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlightedId(p.id)
            const pt = initPositions.find(pos => pos.id === p.id)?.map_point
            if (pt) zoomToPoint(pt.x, pt.y)
          }}
          onSelectPoi={p => {
            setSelectedPoiId(p.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlightedId(p.id)
            zoomToPoint(p.x, p.y)
          }}
        />

      </div>

      {/* Map area — fixed layer that starts exactly below the header */}
      <div
        ref={mapRef}
        className="overflow-hidden select-none"
        style={{
          position: 'fixed',
          top: headerHeight,
          left: 0, right: 0, bottom: 0,
          cursor: dragRef.current ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
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
          {[
            ['+', () => setTransform(t => { const ns = Math.min(10, t.scale * 1.25); return { ...t, scale: ns } })],
            ['−', () => setTransform(t => { const ns = Math.max(0.5, t.scale / 1.25); return { ...t, scale: ns } })],
            ['⊡', () => setTransform({ x: 0, y: 0, scale: 1 })],
          ].map(([label, fn]) => (
            <button key={label as string}
              onClick={e => { e.stopPropagation(); (fn as () => void)() }}
              className="w-8 h-8 bg-slate-800/90 hover:bg-slate-700 text-white text-sm rounded border border-slate-600 flex items-center justify-center">
              {label as string}
            </button>
          ))}
        </div>

        {/* Pan/zoom container */}
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}>
          {backgroundUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={backgroundUrl} alt=""
              onLoad={e => { const i = e.currentTarget; setImgSize({ w: i.naturalWidth, h: i.naturalHeight }) }}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
          )}

          {imgSize && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden' }}
              viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
              preserveAspectRatio="xMidYMid meet"
              overflow="hidden">
              <defs>
                {/* Static glow for non-selected */}
                <filter id="pub-glow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation={px(5)} result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                {/* Pulsing glow for selected/highlighted */}
                <filter id="pub-glow-pulse" x="-120%" y="-120%" width="340%" height="340%">
                  <feGaussianBlur result="blur" stdDeviation={px(4)}>
                    <animate attributeName="stdDeviation"
                      values={`${px(4)};${px(18)};${px(4)}`}
                      dur="1.2s" repeatCount="indefinite" />
                  </feGaussianBlur>
                  <feColorMatrix in="blur" type="matrix"
                    values="1 0.8 0 0 0  0.9 0.7 0 0 0  0 0 0 0 0  0 0 0 2.5 0" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Areas */}
              {areas.filter(a => a.map_polygon && a.map_polygon.length >= 3).map(area => {
                const c = AREA_COLORS[area.status]
                const isHL = highlightedId === area.id
                const isSel = selectedAreaId === area.id
                const active = isHL || isSel
                const pts = area.map_polygon!.map(p => `${p.x},${p.y}`).join(' ')
                const cx = area.map_polygon!.reduce((s, p) => s + p.x, 0) / area.map_polygon!.length
                const cy = area.map_polygon!.reduce((s, p) => s + p.y, 0) / area.map_polygon!.length
                return (
                  <g key={area.id} style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedAreaId(area.id); setSelectedPositionId(null); setSelectedPoiId(null); setHighlightedId(null)
                      zoomToPoint(cx, cy)
                    }}>
                    <polygon points={pts} fill={c.fill}
                      stroke={active ? '#fbbf24' : c.stroke}
                      strokeWidth={px(active ? 4 : 2)}
                      filter={active ? 'url(#pub-glow-pulse)' : undefined} />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize={px(13)} fontWeight="bold" fill="white"
                      stroke="black" strokeWidth={px(3)} paintOrder="stroke">
                      {area.name}
                    </text>
                  </g>
                )
              })}

              {/* Positions */}
              {initPositions.filter(p => p.map_point).map(pos => {
                const isHL = highlightedId === pos.id
                const isSel = selectedPositionId === pos.id
                const active = isHL || isSel
                const r = px(POS_R)
                return (
                  <g key={pos.id} transform={`translate(${pos.map_point!.x},${pos.map_point!.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedPositionId(pos.id); setSelectedAreaId(null); setSelectedPoiId(null); setHighlightedId(null)
                      zoomToPoint(pos.map_point!.x, pos.map_point!.y)
                    }}>
                    <circle r={px(TAP_R)} fill="transparent" />
                    <circle r={r} fill={active ? '#fbbf24' : '#3b82f6'}
                      stroke="white" strokeWidth={px(active ? 2 : 1.5)}
                      filter={active ? 'url(#pub-glow-pulse)' : undefined} />
                    <text textAnchor="middle" dominantBaseline="middle"
                      fontSize={px(7)} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
                      {pos.number}
                    </text>
                    {active && (
                      <text y={r + px(12)} textAnchor="middle"
                        fontSize={px(11)} fontWeight="bold" fill="white"
                        stroke="black" strokeWidth={px(3)} paintOrder="stroke"
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
                const active = isHL || isSel
                const cat = poi.category_id ? categoryMap.get(poi.category_id) : null
                const color = cat?.color ?? '#6366f1'
                const isNum = cat?.display_style === 'numbered'
                const r = px(isHL ? (isNum ? NUM_R * 2.2 : DOT_R * 2.5) : (isNum ? NUM_R : DOT_R))
                return (
                  <g key={poi.id} transform={`translate(${poi.x},${poi.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedPoiId(poi.id); setSelectedAreaId(null); setSelectedPositionId(null); setHighlightedId(null)
                      zoomToPoint(poi.x, poi.y)
                    }}>
                    <circle r={px(TAP_R)} fill="transparent" />
                    <circle r={r} fill={active ? '#fbbf24' : color}
                      stroke="white" strokeWidth={px(active ? 2 : 1)}
                      filter={active ? 'url(#pub-glow-pulse)' : undefined} />
                    {isNum && (
                      <text textAnchor="middle" dominantBaseline="middle"
                        fontSize={px(5.5)} fontWeight="bold" fill="white" style={{ pointerEvents: 'none' }}>
                        {poi.label}
                      </text>
                    )}
                    {active && (
                      <text y={r + px(12)} textAnchor="middle"
                        fontSize={px(11)} fontWeight="bold" fill="white"
                        stroke="black" strokeWidth={px(3)} paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}>
                        {poi.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {/* Detail panel — shown on tap/click */}
        {(selectedArea || selectedPos || selectedPoi) && (
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900/97 border-t border-slate-700 p-4 z-20 safe-area-pb"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedAreaId(null); setSelectedPositionId(null); setSelectedPoiId(null) }}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white text-lg leading-none">✕</button>

            {selectedArea && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Area</p>
                <p className="text-white font-semibold text-lg leading-tight">{selectedArea.name}</p>
                <div className={`inline-flex items-center mt-2 px-2.5 py-1 rounded-full text-xs font-medium text-white ${STATUS_BADGE[selectedArea.status]}`}>
                  {STATUS_LABELS[selectedArea.status]}
                </div>
              </div>
            )}
            {selectedPos && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Positie</p>
                <p className="text-white font-semibold text-lg leading-tight">Pos. {selectedPos.number}</p>
                {selectedPos.name && <p className="text-slate-300 text-sm mt-1">{selectedPos.name}</p>}
              </div>
            )}
            {selectedPoi && (
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {categories.find(c => c.id === selectedPoi.category_id)?.name ?? 'POI'}
                </p>
                <p className="text-white font-semibold text-lg leading-tight">{selectedPoi.label}</p>
                {selectedPoi.note && <p className="text-slate-300 text-sm mt-1">{selectedPoi.note}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
