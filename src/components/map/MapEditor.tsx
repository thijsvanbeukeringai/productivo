'use client'

import { useCallback, useRef, useState } from 'react'
import { MapCanvas } from './MapCanvas'
import { saveAreaPolygon, savePositionPoint, saveMapBackground, createPoi, updatePoi, deletePoi, createPoiCategory, updatePoiCategory, deletePoiCategory, renameArea, saveCalibration } from '@/lib/actions/map.actions'
import type { Area, Position, MapPoi, MapPoiCategory, MapPoint, PoiType, CalibrationPoint } from '@/types/app.types'
import { createClient } from '@/lib/supabase/client'
import { createAreaFromMap, deleteAreaFromMap } from '@/lib/actions/map.actions'

const DEFAULT_CATEGORIES = [
  { name: 'Bar',         color: '#f59e0b' },
  { name: 'Food',        color: '#22c55e' },
  { name: 'Merchandise', color: '#8b5cf6' },
  { name: 'Cado',        color: '#ec4899' },
  { name: 'Camera',      color: '#64748b' },
]

const PRESET_COLORS = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6',
  '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899','#f43f5e','#64748b',
  '#78716c','#475569','#0f172a','#ffffff',
]

type EditorMode = 'none' | 'draw' | 'position' | 'poi' | 'calibrate'

interface Props {
  projectId: string
  backgroundUrl: string | null
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories: MapPoiCategory[]
  calibration: CalibrationPoint[]
  canvasWidth: number
  canvasHeight: number
}

export function MapEditor({ projectId, backgroundUrl: initialBgUrl, areas: initialAreas, positions: initialPositions, pois: initialPois, categories: initialCategories, calibration: initialCalibration, canvasWidth, canvasHeight }: Props) {
  const [mode, setMode] = useState<EditorMode>('none')
  const [calibration, setCalibration] = useState<CalibrationPoint[]>(initialCalibration)
  const [pendingCalibPoint, setPendingCalibPoint] = useState<{ x: number; y: number } | null>(null)
  const [calibCoords, setCalibCoords] = useState('')
  const [calibLabel, setCalibLabel] = useState('')
  const [areas, setAreas] = useState<Area[]>(initialAreas)
  const [positions, setPositions] = useState<Position[]>(initialPositions)
  const [pois, setPois] = useState<MapPoi[]>(initialPois)
  const [categories, setCategories] = useState<MapPoiCategory[]>(initialCategories)
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(initialBgUrl)
  const [drawingPolygon, setDrawingPolygon] = useState<MapPoint[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingBg, setSavingBg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // POI form
  const [poiLabel, setPoiLabel] = useState('')
  const [poiCategoryId, setPoiCategoryId] = useState<string>('')
  const [poiNote, setPoiNote] = useState('')
  const [pendingPoiPoint, setPendingPoiPoint] = useState<MapPoint | null>(null)

  // New area form
  const [newAreaName, setNewAreaName] = useState('')

  // Area inline rename
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editAreaName, setEditAreaName] = useState('')

  // POI edit form
  const [editPoiLabel, setEditPoiLabel] = useState('')
  const [editPoiCategoryId, setEditPoiCategoryId] = useState<string>('')
  const [editPoiNote, setEditPoiNote] = useState('')

  // Category form
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [newCatStyle, setNewCatStyle] = useState<'dot' | 'numbered' | 'text'>('dot')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatColor, setEditCatColor] = useState('')
  const [editCatStyle, setEditCatStyle] = useState<'dot' | 'numbered' | 'text'>('dot')

  const fileRef = useRef<HTMLInputElement>(null)

  // All categories visible in editor (always show all)
  const allVisible = new Set(categories.map(c => c.id))

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSavingBg(true); setError(null)
    const supabase = createClient()
    const path = `map-backgrounds/${projectId}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('project-files').upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); setSavingBg(false); return }
    const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(path)
    const res = await saveMapBackground(projectId, urlData.publicUrl)
    if (res.error) { setError(res.error); setSavingBg(false); return }
    setBackgroundUrl(urlData.publicUrl); setSavingBg(false)
  }

  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (mode === 'draw') {
      setDrawingPolygon(prev => [...prev, { x, y }])
    } else if (mode === 'position' && selectedPositionId) {
      handlePositionPlace(selectedPositionId, x, y)
    } else if (mode === 'poi') {
      setPendingPoiPoint({ x, y })
    } else if (mode === 'calibrate') {
      setPendingCalibPoint({ x, y })
      setCalibCoords(''); setCalibLabel('')
    }
  }, [mode, selectedPositionId])

  async function closePolygon() {
    if (drawingPolygon.length < 3 || !selectedAreaId) return
    setSaving(true)
    const res = await saveAreaPolygon(selectedAreaId, projectId, drawingPolygon)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setAreas(prev => prev.map(a => a.id === selectedAreaId ? { ...a, map_polygon: drawingPolygon } : a))
    setDrawingPolygon([]); setMode('none')
  }

  async function handleRenameArea(areaId: string) {
    if (!editAreaName.trim()) return
    setSaving(true)
    const res = await renameArea(areaId, projectId, editAreaName.trim())
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setAreas(prev => prev.map(a => a.id === areaId ? { ...a, name: editAreaName.trim() } : a))
    setEditingAreaId(null)
  }

  async function handleCreateArea() {
    if (!newAreaName.trim()) return
    setSaving(true)
    const res = await createAreaFromMap(projectId, newAreaName.trim())
    setSaving(false)
    if (res.error) { setError(res.error); return }
    if (res.data) {
      setAreas(prev => [...prev, res.data as Area])
      setSelectedAreaId((res.data as Area).id)
      setSelectedPositionId(null); setSelectedPoiId(null)
    }
    setNewAreaName('')
  }

  async function handleDeleteArea(areaId: string) {
    setSaving(true)
    const res = await deleteAreaFromMap(areaId, projectId)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setAreas(prev => prev.filter(a => a.id !== areaId))
    if (selectedAreaId === areaId) setSelectedAreaId(null)
  }

  function parseCalibCoords(raw: string): { lat: number; lng: number } | null {
    // Accepts: "51.28211, 4.83738" or "51.28211467247859, 4.837382559756106"
    const parts = raw.replace(/[()]/g, '').split(/[\s,;]+/).filter(Boolean)
    if (parts.length < 2) return null
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])
    if (isNaN(lat) || isNaN(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    return { lat, lng }
  }

  async function handleAddCalibPoint() {
    if (!pendingCalibPoint) return
    const parsed = parseCalibCoords(calibCoords)
    if (!parsed) return
    const newPoint: CalibrationPoint = { imageX: pendingCalibPoint.x, imageY: pendingCalibPoint.y, ...parsed, label: calibLabel.trim() || undefined }
    const newPoints = [...calibration, newPoint]
    setSaving(true)
    const res = await saveCalibration(projectId, newPoints)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setCalibration(newPoints)
    setPendingCalibPoint(null); setCalibCoords(''); setCalibLabel('')
    setMode('none')
  }

  async function handleRemoveCalibPoint(index: number) {
    const newPoints = calibration.filter((_, i) => i !== index)
    setSaving(true)
    await saveCalibration(projectId, newPoints)
    setSaving(false)
    setCalibration(newPoints)
  }

  async function handlePoiEdit() {
    if (!selectedPoiId || !editPoiLabel.trim()) return
    const poi = pois.find(p => p.id === selectedPoiId)
    if (!poi) return
    setSaving(true)
    const res = await updatePoi(selectedPoiId, projectId, editPoiLabel.trim(), poi.type as PoiType, poi.x, poi.y, editPoiCategoryId || null, editPoiNote || null)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setPois(prev => prev.map(p => p.id === selectedPoiId ? { ...p, label: editPoiLabel.trim(), category_id: editPoiCategoryId || null, note: editPoiNote || null } : p))
    setSelectedPoiId(null)
  }

  async function deleteAreaPolygon(areaId: string) {
    setSaving(true)
    const res = await saveAreaPolygon(areaId, projectId, null)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setAreas(prev => prev.map(a => a.id === areaId ? { ...a, map_polygon: null } : a))
  }

  async function handlePositionPlace(posId: string, x: number, y: number) {
    setSaving(true)
    const res = await savePositionPoint(posId, projectId, { x, y })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setPositions(prev => prev.map(p => p.id === posId ? { ...p, map_point: { x, y } } : p))
    setMode('none')
  }

  async function removePositionFromMap(posId: string) {
    setSaving(true)
    const res = await savePositionPoint(posId, projectId, null)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setPositions(prev => prev.map(p => p.id === posId ? { ...p, map_point: null } : p))
  }

  async function handlePoiSave() {
    if (!pendingPoiPoint || !poiLabel.trim()) return
    setSaving(true)
    const res = await createPoi(projectId, poiLabel.trim(), 'other' as PoiType, pendingPoiPoint.x, pendingPoiPoint.y, poiCategoryId || null, poiNote || null)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    if (res.data) setPois(prev => [...prev, res.data as MapPoi])
    setPendingPoiPoint(null); setPoiLabel(''); setPoiCategoryId(''); setPoiNote(''); setMode('none')
  }

  async function handlePoiDelete(poiId: string) {
    setSaving(true)
    const res = await deletePoi(poiId, projectId)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setPois(prev => prev.filter(p => p.id !== poiId))
    if (selectedPoiId === poiId) setSelectedPoiId(null)
  }

  async function handleAreaDragEnd(areaId: string, newPolygon: MapPoint[]) {
    setAreas(prev => prev.map(a => a.id === areaId ? { ...a, map_polygon: newPolygon } : a))
    await saveAreaPolygon(areaId, projectId, newPolygon)
  }

  async function handlePositionDragEnd(posId: string, x: number, y: number) {
    setPositions(prev => prev.map(p => p.id === posId ? { ...p, map_point: { x, y } } : p))
    await savePositionPoint(posId, projectId, { x, y })
  }

  async function handlePoiDragEnd(poiId: string, x: number, y: number) {
    const poi = pois.find(p => p.id === poiId)
    if (!poi) return
    setPois(prev => prev.map(p => p.id === poiId ? { ...p, x, y } : p))
    await updatePoi(poiId, projectId, poi.label, poi.type as PoiType, x, y, poi.category_id)
  }

  async function handleAddDefaultCategories() {
    setSaving(true)
    const created: MapPoiCategory[] = []
    for (const cat of DEFAULT_CATEGORIES) {
      const res = await createPoiCategory(projectId, cat.name, cat.color)
      if (res.data) created.push(res.data as MapPoiCategory)
    }
    setCategories(prev => [...prev, ...created])
    setSaving(false)
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return
    setSaving(true)
    const res = await createPoiCategory(projectId, newCatName.trim(), newCatColor, newCatStyle)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    if (res.data) setCategories(prev => [...prev, res.data as MapPoiCategory])
    setNewCatName(''); setNewCatColor('#6366f1'); setNewCatStyle('dot')
  }

  async function handleSaveCategory(catId: string) {
    setSaving(true)
    const res = await updatePoiCategory(catId, projectId, editCatName, editCatColor, editCatStyle)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, name: editCatName, color: editCatColor, display_style: editCatStyle } : c))
    setEditingCatId(null)
  }

  async function handleDeleteCategory(catId: string) {
    setSaving(true)
    const res = await deletePoiCategory(catId, projectId)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setCategories(prev => prev.filter(c => c.id !== catId))
  }

  const btnClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${active
      ? 'bg-amber-500 border-amber-500 text-white'
      : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-400'}`

  const sectionLabel = 'text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider'

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left panel */}
      <div className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Kaart Editor</h2>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Mode */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
            <p className={sectionLabel}>Modus</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => { setMode('none'); setDrawingPolygon([]) }} className={btnClass(mode === 'none')}>Selecteren</button>
              <button onClick={() => { setMode('draw'); setDrawingPolygon([]) }} disabled={!selectedAreaId}
                className={btnClass(mode === 'draw') + (selectedAreaId ? '' : ' opacity-40 cursor-not-allowed')}>Tekenen</button>
              <button onClick={() => { setMode('position'); setDrawingPolygon([]) }} disabled={!selectedPositionId}
                className={btnClass(mode === 'position') + (selectedPositionId ? '' : ' opacity-40 cursor-not-allowed')}>Positie</button>
              <button onClick={() => { setMode('poi'); setDrawingPolygon([]) }} className={btnClass(mode === 'poi')}>POI</button>
            </div>
            {mode === 'draw' && (
              <div className="flex gap-1.5">
                <button onClick={closePolygon} disabled={drawingPolygon.length < 3 || saving}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:opacity-40">
                  Sluiten ({drawingPolygon.length} pt)
                </button>
                <button onClick={() => { setDrawingPolygon([]); setMode('none') }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white">✕</button>
              </div>
            )}
          </div>

          {/* Background */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <p className={`${sectionLabel} mb-2`}>Plattegrond</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={savingBg}
              className="w-full py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition-colors disabled:opacity-50">
              {savingBg ? 'Uploaden...' : backgroundUrl ? 'Vervangen' : '+ Afbeelding uploaden'}
            </button>
            {backgroundUrl && (
              <button onClick={async () => { await saveMapBackground(projectId, null); setBackgroundUrl(null) }}
                className="w-full mt-1 py-1 text-xs text-red-500 hover:text-red-600">Verwijderen</button>
            )}
          </div>

          {/* Areas */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <p className={`${sectionLabel} mb-2`}>Area&apos;s</p>
            <div className="space-y-1">
              {areas.map(area => (
                <div key={area.id}>
                  {editingAreaId === area.id ? (
                    <div className="flex gap-1">
                      <input
                        autoFocus
                        value={editAreaName}
                        onChange={e => setEditAreaName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameArea(area.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                        className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-amber-400 text-slate-800 dark:text-white focus:outline-none"
                      />
                      <button onClick={() => handleRenameArea(area.id)} disabled={!editAreaName.trim() || saving}
                        className="px-2 py-1 text-xs rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-40">✓</button>
                      <button onClick={() => setEditingAreaId(null)}
                        className="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">✕</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setSelectedAreaId(area.id === selectedAreaId ? null : area.id); setSelectedPositionId(null); setSelectedPoiId(null) }}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors border group ${selectedAreaId === area.id ? 'bg-amber-50 dark:bg-amber-600/20 border-amber-300 dark:border-amber-500/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'}`}>
                      <span className="text-slate-700 dark:text-slate-200 truncate">{area.name}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {area.map_polygon ? <span className="text-green-500 text-[10px]">✓</span> : <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>}
                        <button onClick={e => { e.stopPropagation(); setEditingAreaId(area.id); setEditAreaName(area.name) }}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-[10px] px-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Naam aanpassen">✎</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteArea(area.id) }}
                          className="text-red-400 hover:text-red-600 text-[10px] px-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Verwijder area">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedAreaId && !areas.find(a => a.id === selectedAreaId)?.map_polygon && (
              <p className="text-[10px] text-amber-500 mt-2">Selecteer &quot;Tekenen&quot; en klik op de kaart.</p>
            )}
            {/* New area form */}
            <div className="flex gap-1 mt-2">
              <input
                value={newAreaName}
                onChange={e => setNewAreaName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateArea()}
                placeholder="Nieuwe area..."
                className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400"
              />
              <button onClick={handleCreateArea} disabled={!newAreaName.trim() || saving}
                className="px-2 py-1 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-40">+</button>
            </div>
          </div>

          {/* Positions */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <p className={`${sectionLabel} mb-2`}>Posities</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {positions.map(pos => (
                <div key={pos.id}
                  onClick={() => { setSelectedPositionId(pos.id === selectedPositionId ? null : pos.id); setSelectedAreaId(null); setSelectedPoiId(null) }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors border ${selectedPositionId === pos.id ? 'bg-amber-50 dark:bg-amber-600/20 border-amber-300 dark:border-amber-500/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent'}`}>
                  <span className="text-slate-700 dark:text-slate-200">Pos. {pos.number}{pos.name ? ` — ${pos.name}` : ''}</span>
                  <div className="flex items-center gap-1">
                    {pos.map_point ? <span className="text-green-500 text-[10px]">✓</span> : <span className="text-slate-300 dark:text-slate-600 text-[10px]">—</span>}
                    {pos.map_point && (
                      <button onClick={e => { e.stopPropagation(); removePositionFromMap(pos.id) }}
                        className="text-red-400 hover:text-red-600 text-[10px] px-1">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* POIs */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <p className={`${sectionLabel} mb-2`}>POI&apos;s</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {pois.map(poi => {
                const cat = categories.find(c => c.id === poi.category_id)
                return (
                  <div key={poi.id} className="flex items-center justify-between px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {cat && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
                      <span className="truncate">{poi.label}</span>
                    </div>
                    <button onClick={() => handlePoiDelete(poi.id)} className="text-red-400 hover:text-red-600 px-1 shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="p-3">
            <p className={`${sectionLabel} mb-2`}>POI Categorieën</p>

            {categories.length === 0 && (
              <button onClick={handleAddDefaultCategories} disabled={saving}
                className="w-full py-1.5 text-xs text-amber-600 hover:text-amber-500 border border-amber-200 dark:border-amber-700/40 rounded-lg mb-2 bg-amber-50 dark:bg-transparent">
                + Standaard categorieën toevoegen
              </button>
            )}

            <div className="space-y-1 mb-2">
              {categories.map(cat => (
                <div key={cat.id}>
                  {editingCatId === cat.id ? (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1.5">
                      <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none" />
                      <div className="flex flex-wrap gap-1">
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setEditCatColor(c)}
                            className={`w-5 h-5 rounded-full border-2 ${editCatColor === c ? 'border-slate-600 dark:border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditCatStyle('dot')}
                          className={`flex-1 py-1 text-[10px] rounded border transition-colors ${editCatStyle === 'dot' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-700 dark:border-slate-200' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                          Punt
                        </button>
                        <button onClick={() => setEditCatStyle('numbered')}
                          className={`flex-1 py-1 text-[10px] rounded border transition-colors ${editCatStyle === 'numbered' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-700 dark:border-slate-200' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                          Nummer
                        </button>
                        <button onClick={() => setEditCatStyle('text')}
                          className={`flex-1 py-1 text-[10px] rounded border transition-colors ${editCatStyle === 'text' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-700 dark:border-slate-200' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                          Tekst
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleSaveCategory(cat.id)} disabled={saving}
                          className="flex-1 py-1 text-[10px] bg-green-600 hover:bg-green-500 text-white rounded">Opslaan</button>
                        <button onClick={() => setEditingCatId(null)}
                          className="px-2 py-1 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-xs group">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-700 dark:text-slate-200">{cat.name}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatColor(cat.color); setEditCatStyle(cat.display_style) }}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-white px-1">✎</button>
                        <button onClick={() => handleDeleteCategory(cat.id)}
                          className="text-red-400 hover:text-red-600 px-1">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* New category form */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1.5">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                placeholder="Nieuwe categorie..."
                className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-slate-400" />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewCatColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${newCatColor === c ? 'border-slate-600 dark:border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setNewCatStyle('dot')}
                  className={`flex-1 py-1 text-[10px] rounded border transition-colors ${newCatStyle === 'dot' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-700 dark:border-slate-200' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                  Punt
                </button>
                <button onClick={() => setNewCatStyle('numbered')}
                  className={`flex-1 py-1 text-[10px] rounded border transition-colors ${newCatStyle === 'numbered' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-700 dark:border-slate-200' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                  Nummer
                </button>
                <button onClick={() => setNewCatStyle('text')}
                  className={`flex-1 py-1 text-[10px] rounded border transition-colors ${newCatStyle === 'text' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-700 dark:border-slate-200' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                  Tekst
                </button>
              </div>
              <button onClick={handleCreateCategory} disabled={!newCatName.trim() || saving}
                className="w-full py-1 text-[10px] font-medium bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white rounded disabled:opacity-40">
                + Toevoegen
              </button>
            </div>
          </div>
          {/* GPS Kalibratie */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <p className={`${sectionLabel} mb-2`}>GPS Kalibratie</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
              Klik op een herkenbaar punt op de plattegrond en voer de GPS-coördinaten in. Minimaal 2 punten nodig.
            </p>

            {calibration.length > 0 && (
              <div className="space-y-1 mb-2">
                {calibration.map((pt, i) => (
                  <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs group">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{pt.label || `Punt ${i + 1}`}</span>
                      <span className="text-slate-400 dark:text-slate-500 ml-1.5">{pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</span>
                    </div>
                    <button onClick={() => handleRemoveCalibPoint(i)}
                      className="text-red-400 hover:text-red-600 px-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            )}

            {calibration.length < 4 && (
              <button
                onClick={() => { setMode(mode === 'calibrate' ? 'none' : 'calibrate'); setPendingCalibPoint(null) }}
                className={btnClass(mode === 'calibrate')}>
                {mode === 'calibrate' ? 'Klik op kaart...' : `+ Punt toevoegen (${calibration.length}/4)`}
              </button>
            )}

            {calibration.length >= 2 && (
              <p className="text-[10px] text-green-600 dark:text-green-400 mt-1.5 font-medium">
                ✓ GPS actief — {calibration.length} kalibratiepunten
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative bg-slate-200 dark:bg-slate-950 flex items-center justify-center">
        <MapCanvas
          projectId={projectId}
          backgroundUrl={backgroundUrl}
          initialAreas={areas}
          initialPositions={positions}
          initialPois={pois}
          categories={categories}
          visibleCategoryIds={allVisible}
          width={canvasWidth}
          height={canvasHeight}
          onCanvasClick={handleCanvasClick}
          selectedAreaId={selectedAreaId}
          selectedPositionId={selectedPositionId}
          selectedPoiId={selectedPoiId}
          onAreaClick={a => { setSelectedAreaId(a.id); setSelectedPositionId(null); setSelectedPoiId(null) }}
          onPositionClick={p => { setSelectedPositionId(p.id); setSelectedAreaId(null); setSelectedPoiId(null) }}
          onPoiClick={p => { setSelectedPoiId(p.id); setEditPoiLabel(p.label); setEditPoiCategoryId(p.category_id ?? ''); setEditPoiNote(p.note ?? ''); setSelectedAreaId(null); setSelectedPositionId(null) }}
          onAreaDragEnd={handleAreaDragEnd}
          onPositionDragEnd={handlePositionDragEnd}
          onPoiDragEnd={handlePoiDragEnd}
          editorMode={mode}
          drawingPolygon={drawingPolygon}
          draggable={mode === 'none'}
        />

        {/* POI placement form */}
        {pendingPoiPoint && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-4 shadow-2xl w-72 z-10">
            <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Nieuw POI plaatsen</p>
            <div className="space-y-2">
              <input autoFocus value={poiLabel} onChange={e => setPoiLabel(e.target.value)}
                placeholder={categories.find(c => c.id === poiCategoryId)?.display_style === 'numbered' ? 'Bijv. 1, A1, B3' : 'Label (bijv. Hoofdbar)'}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <select value={poiCategoryId} onChange={e => setPoiCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="">— Geen categorie —</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <textarea value={poiNote} onChange={e => setPoiNote(e.target.value)}
                placeholder="Notitie (optioneel)..."
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={handlePoiSave} disabled={!poiLabel.trim() || saving}
                  className="flex-1 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-40">
                  Opslaan
                </button>
                <button onClick={() => setPendingPoiPoint(null)}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )}

        {/* POI edit form */}
        {selectedPoiId && !pendingPoiPoint && (() => {
          const poi = pois.find(p => p.id === selectedPoiId)
          if (!poi) return null
          return (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-4 shadow-2xl w-72 z-10">
              <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">POI bewerken</p>
              <div className="space-y-2">
                <input autoFocus value={editPoiLabel} onChange={e => setEditPoiLabel(e.target.value)}
                  placeholder={categories.find(c => c.id === editPoiCategoryId)?.display_style === 'numbered' ? 'Bijv. 1, A1, B3' : 'Label'}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <select value={editPoiCategoryId} onChange={e => setEditPoiCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">— Geen categorie —</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <textarea value={editPoiNote} onChange={e => setEditPoiNote(e.target.value)}
                  placeholder="Notitie (optioneel)..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
                <div className="flex gap-2">
                  <button onClick={handlePoiEdit} disabled={!editPoiLabel.trim() || saving}
                    className="flex-1 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-40">
                    Opslaan
                  </button>
                  <button onClick={() => handlePoiDelete(selectedPoiId)}
                    className="px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white">
                    Verwijder
                  </button>
                  <button onClick={() => setSelectedPoiId(null)}
                    className="px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Calibration point popup */}
        {pendingCalibPoint && mode === 'calibrate' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl p-4 shadow-2xl w-80 z-10">
            <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1">GPS-coördinaten invoeren</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Rechtsklik op het juiste punt in Google Maps → kopieer de coördinaten en plak ze hieronder.
            </p>
            <div className="space-y-2">
              <input value={calibLabel} onChange={e => setCalibLabel(e.target.value)}
                placeholder="Label (bijv. Hoofdingang)"
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <input
                autoFocus
                value={calibCoords}
                onChange={e => setCalibCoords(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCalibPoint()}
                placeholder="51.28211467247859, 4.837382559756106"
                className={`w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-700 border text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 ${calibCoords && !parseCalibCoords(calibCoords) ? 'border-red-400' : 'border-slate-200 dark:border-slate-600'}`}
              />
              {calibCoords && !parseCalibCoords(calibCoords) && (
                <p className="text-xs text-red-500">Ongeldig formaat — plak de coördinaten van Google Maps</p>
              )}
              {calibCoords && parseCalibCoords(calibCoords) && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ {parseCalibCoords(calibCoords)!.lat.toFixed(6)}, {parseCalibCoords(calibCoords)!.lng.toFixed(6)}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={handleAddCalibPoint}
                  disabled={!parseCalibCoords(calibCoords) || saving}
                  className="flex-1 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-40">
                  Opslaan
                </button>
                <button onClick={() => { setPendingCalibPoint(null); setMode('none') }}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="absolute bottom-4 left-4 bg-red-50 dark:bg-red-900/80 border border-red-200 dark:border-transparent text-red-600 dark:text-red-200 text-xs px-3 py-2 rounded-lg">{error}</div>}
        {saving && <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-transparent text-slate-500 dark:text-slate-300 text-xs px-3 py-1.5 rounded-lg shadow">Opslaan...</div>}
      </div>
    </div>
  )
}
