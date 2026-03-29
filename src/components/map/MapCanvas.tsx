'use client'

import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Group, Rect } from 'react-konva'
import Konva from 'konva'
import { createClient } from '@/lib/supabase/client'
import type { Area, Position, MapPoi, MapPoiCategory, AreaStatus } from '@/types/app.types'

const AREA_COLORS: Record<AreaStatus, { fill: string; stroke: string }> = {
  open:      { fill: 'rgba(34,197,94,0.80)',  stroke: '#16a34a' },
  regulated: { fill: 'rgba(249,115,22,0.80)', stroke: '#ea580c' },
  closed:    { fill: 'rgba(239,68,68,0.80)',  stroke: '#dc2626' },
}

const AREA_STATUS_LABELS: Record<AreaStatus, string> = {
  open:      'Open',
  regulated: 'Reguleren',
  closed:    'Gesloten',
}

interface Props {
  projectId: string
  backgroundUrl: string | null
  initialAreas: Area[]
  initialPositions: Position[]
  initialPois: MapPoi[]
  categories: MapPoiCategory[]
  visibleCategoryIds: Set<string>
  width: number
  height: number
  onCanvasClick?: (x: number, y: number) => void
  selectedAreaId?: string | null
  selectedPositionId?: string | null
  selectedPoiId?: string | null
  onAreaClick?: (area: Area) => void
  onPositionClick?: (pos: Position) => void
  onPoiClick?: (poi: MapPoi) => void
  onAreaDragEnd?: (areaId: string, newPolygon: {x:number;y:number}[]) => void
  onPositionDragEnd?: (posId: string, x: number, y: number) => void
  onPoiDragEnd?: (poiId: string, x: number, y: number) => void
  editorMode?: 'none' | 'draw' | 'position' | 'poi' | 'calibrate'
  drawingPolygon?: {x:number;y:number}[]
  draggable?: boolean
  highlightedId?: string | null
}

export function MapCanvas({
  projectId,
  backgroundUrl,
  initialAreas,
  initialPositions,
  initialPois,
  categories,
  visibleCategoryIds,
  width,
  height,
  onCanvasClick,
  selectedAreaId,
  selectedPositionId,
  selectedPoiId,
  onAreaClick,
  onPositionClick,
  onPoiClick,
  onAreaDragEnd,
  onPositionDragEnd,
  onPoiDragEnd,
  editorMode = 'none',
  drawingPolygon = [],
  draggable = false,
  highlightedId = null,
}: Props) {
  const [areas, setAreas] = useState<Area[]>(initialAreas)
  const [positions, setPositions] = useState<Position[]>(initialPositions)
  const [pois, setPois] = useState<MapPoi[]>(initialPois)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null)
  const stageRef = useRef<Konva.Stage>(null)

  // Sync props → state (editor saves)
  useEffect(() => { setAreas(initialAreas) }, [initialAreas])
  useEffect(() => { setPositions(initialPositions) }, [initialPositions])
  useEffect(() => { setPois(initialPois) }, [initialPois])

  // Load background image
  useEffect(() => {
    if (!backgroundUrl) { setBgImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setBgImage(img)
    img.src = backgroundUrl
  }, [backgroundUrl])

  // Realtime: area status changes
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`map-areas-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'areas', filter: `project_id=eq.${projectId}` },
        (p) => setAreas(prev => prev.map(a => a.id === p.new.id ? { ...a, ...p.new } : a)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  // Realtime: position changes
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel(`map-pos-${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'positions', filter: `project_id=eq.${projectId}` },
        (p) => setPositions(prev => prev.map(x => x.id === p.new.id ? { ...x, ...p.new } : x)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  // Background scale/offset (image fits canvas)
  const bgScale = bgImage ? Math.min(width / bgImage.width, height / bgImage.height) : 1
  const bgW = bgImage ? bgImage.width * bgScale : width
  const bgH = bgImage ? bgImage.height * bgScale : height
  const bgX = (width - bgW) / 2
  const bgY = (height - bgH) / 2

  // Coordinate helpers: image space ↔ stage space
  function toImg(sx: number, sy: number) {
    return { x: (sx - bgX) / bgScale, y: (sy - bgY) / bgScale }
  }
  function toStage(ix: number, iy: number) {
    return { x: ix * bgScale + bgX, y: iy * bgScale + bgY }
  }

  // Convert container pointer → stage coords (accounting for zoom/pan)
  function pointerToStage(pointerPos: { x: number; y: number }) {
    const stage = stageRef.current
    if (!stage) return pointerPos
    const scale = stage.scaleX()
    return {
      x: (pointerPos.x - stage.x()) / scale,
      y: (pointerPos.y - stage.y()) / scale,
    }
  }

  // Zoom with mouse wheel
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const scaleBy = 1.12
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const direction = e.evt.deltaY < 0 ? 1 : -1
    const newScale = Math.max(0.2, Math.min(10, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy))
    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!onCanvasClick) return
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    // Convert container → stage → image space
    const stageCoord = pointerToStage(pointer)
    const img = toImg(stageCoord.x, stageCoord.y)
    onCanvasClick(img.x, img.y)
  }

  function resetZoom() {
    const stage = stageRef.current
    if (!stage) return
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
  }

  // Category lookup
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  // Filter POIs by visible categories
  const visiblePois = pois.filter(poi => {
    if (!poi.category_id) return true // uncategorised always visible
    return visibleCategoryIds.has(poi.category_id)
  })

  return (
    <div className="relative" style={{ width, height }}>
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button
          onClick={() => { const s = stageRef.current; if (s) { const ns = Math.min(10, s.scaleX() * 1.25); const cx = width/2; const cy = height/2; const mp = { x: (cx - s.x()) / s.scaleX(), y: (cy - s.y()) / s.scaleX() }; s.scale({x:ns,y:ns}); s.position({x: cx - mp.x*ns, y: cy - mp.y*ns}) } }}
          className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center"
        >+</button>
        <button
          onClick={() => { const s = stageRef.current; if (s) { const ns = Math.max(0.2, s.scaleX() / 1.25); const cx = width/2; const cy = height/2; const mp = { x: (cx - s.x()) / s.scaleX(), y: (cy - s.y()) / s.scaleX() }; s.scale({x:ns,y:ns}); s.position({x: cx - mp.x*ns, y: cy - mp.y*ns}) } }}
          className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-sm rounded border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center"
        >−</button>
        <button
          onClick={resetZoom}
          className="w-7 h-7 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-[10px] rounded border border-slate-300 dark:border-slate-600 shadow-sm flex items-center justify-center"
          title="Reset zoom"
        >⊡</button>
      </div>

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={editorMode === 'none'}
        onWheel={handleWheel}
        onClick={handleStageClick}
        style={{ cursor: editorMode !== 'none' ? 'crosshair' : 'grab' }}
      >
        <Layer>
          {/* Background */}
          {bgImage
            ? <KonvaImage image={bgImage} x={bgX} y={bgY} width={bgW} height={bgH} listening={false} />
            : <Rect x={0} y={0} width={width} height={height} fill="#1e293b" listening={false} />
          }

          {/* Area polygons */}
          {areas.filter(a => a.map_polygon && a.map_polygon.length >= 3).map(area => {
            const colors = AREA_COLORS[area.status]
            const pts = area.map_polygon!.flatMap(p => { const c = toStage(p.x, p.y); return [c.x, c.y] })
            const isSelected = selectedAreaId === area.id
            const isHighlighted = highlightedId === area.id
            const cx = pts.filter((_, i) => i % 2 === 0).reduce((s, v) => s + v, 0) / area.map_polygon!.length
            const cy = pts.filter((_, i) => i % 2 === 1).reduce((s, v) => s + v, 0) / area.map_polygon!.length
            return (
              <Group key={area.id}>
                <Line
                  points={pts}
                  closed
                  fill={colors.fill}
                  stroke={isHighlighted ? '#fbbf24' : isSelected ? '#f59e0b' : colors.stroke}
                  strokeWidth={isHighlighted ? 5 : isSelected ? 3 : 2}
                  shadowColor={isHighlighted ? '#fbbf24' : undefined}
                  shadowBlur={isHighlighted ? 20 : 0}
                  shadowEnabled={isHighlighted}
                  draggable={draggable}
                  onClick={e => { e.cancelBubble = true; onAreaClick?.(area) }}
                  onMouseEnter={() => setHoveredAreaId(area.id)}
                  onMouseLeave={() => setHoveredAreaId(null)}
                  onDragEnd={e => {
                    if (!onAreaDragEnd) return
                    const dx = e.target.x(); const dy = e.target.y()
                    const newPolygon = area.map_polygon!.map(p => ({ x: p.x + dx / bgScale, y: p.y + dy / bgScale }))
                    e.target.x(0); e.target.y(0)
                    onAreaDragEnd(area.id, newPolygon)
                  }}
                />
                {hoveredAreaId === area.id ? (
                  // Hover: grote naam + status
                  <Group listening={false}>
                    <Text x={cx - 60} y={cy - 16} width={120} text={area.name}
                      fontSize={15} fontStyle="bold" fill="white" align="center"
                      shadowColor="black" shadowBlur={6} shadowOpacity={1} />
                    <Text x={cx - 50} y={cy + 4} width={100} text={AREA_STATUS_LABELS[area.status]}
                      fontSize={11} fill="white" align="center"
                      shadowColor="black" shadowBlur={4} shadowOpacity={0.9} />
                  </Group>
                ) : (
                  // Standaard: kleine naam
                  <Text x={cx - 40} y={cy - 7} width={80} text={area.name}
                    fontSize={11} fontStyle="bold" fill="white" align="center"
                    shadowColor="black" shadowBlur={4} shadowOpacity={0.8} listening={false} />
                )}
              </Group>
            )
          })}

          {/* In-progress polygon */}
          {drawingPolygon.length >= 2 && (
            <Line
              points={drawingPolygon.flatMap(p => { const c = toStage(p.x, p.y); return [c.x, c.y] })}
              stroke="#f59e0b" strokeWidth={2} dash={[6, 4]} listening={false}
            />
          )}
          {drawingPolygon.map((pt, i) => {
            const c = toStage(pt.x, pt.y)
            return <Circle key={i} x={c.x} y={c.y} radius={4} fill="#f59e0b" listening={false} />
          })}

          {/* Position markers */}
          {positions.filter(p => p.map_point).map(pos => {
            const isSelected = selectedPositionId === pos.id
            const isHighlighted = highlightedId === pos.id
            const cp = toStage(pos.map_point!.x, pos.map_point!.y)
            return (
              <Group key={pos.id} x={cp.x} y={cp.y} draggable={draggable}
                onClick={e => { e.cancelBubble = true; onPositionClick?.(pos) }}
                onMouseEnter={() => setTooltip({ x: cp.x, y: cp.y - 20, text: `Pos. ${pos.number}${pos.name ? ` — ${pos.name}` : ''}` })}
                onMouseLeave={() => setTooltip(null)}
                onDragEnd={e => { const img = toImg(e.target.x(), e.target.y()); onPositionDragEnd?.(pos.id, img.x, img.y) }}
              >
                <Circle radius={12} fill={isHighlighted ? '#fbbf24' : isSelected ? '#f59e0b' : '#3b82f6'}
                  stroke="white" strokeWidth={2}
                  shadowColor={isHighlighted ? '#fbbf24' : undefined} shadowBlur={isHighlighted ? 18 : 0} shadowEnabled={isHighlighted} />
                <Text text={String(pos.number)} fontSize={9} fontStyle="bold" fill="white"
                  align="center" width={24} x={-12} y={-5} listening={false} />
              </Group>
            )
          })}

          {/* POI markers — small circle, tooltip on hover */}
          {visiblePois.map(poi => {
            const isSelected = selectedPoiId === poi.id
            const isHighlighted = highlightedId === poi.id
            const cat = poi.category_id ? categoryMap.get(poi.category_id) : null
            const color = cat?.color ?? '#6366f1'
            const cp = toStage(poi.x, poi.y)
            return (
              <Group key={poi.id} x={cp.x} y={cp.y} draggable={draggable}
                onClick={e => { e.cancelBubble = true; onPoiClick?.(poi) }}
                onMouseEnter={() => setTooltip({ x: cp.x, y: cp.y - 18, text: poi.label })}
                onMouseLeave={() => setTooltip(null)}
                onDragEnd={e => { const img = toImg(e.target.x(), e.target.y()); onPoiDragEnd?.(poi.id, img.x, img.y) }}
              >
                <Circle radius={7} fill={isHighlighted ? '#fbbf24' : isSelected ? '#f59e0b' : color}
                  stroke="white" strokeWidth={isSelected || isHighlighted ? 2 : 1.5}
                  shadowColor={isHighlighted ? '#fbbf24' : undefined} shadowBlur={isHighlighted ? 16 : 0} shadowEnabled={isHighlighted} />
              </Group>
            )
          })}

          {/* Tooltip */}
          {tooltip && (
            <Group x={tooltip.x} y={tooltip.y} listening={false}>
              <Rect x={-4} y={-4} width={tooltip.text.length * 7 + 8} height={20}
                fill="rgba(0,0,0,0.8)" cornerRadius={4} />
              <Text text={tooltip.text} fontSize={11} fill="white" />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  )
}
