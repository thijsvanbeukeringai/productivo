'use client'

import { useEffect, useRef, useState } from 'react'
import { MapView } from './MapView'
import { MapEditor } from './MapEditor'
import { GpsMapView } from './GpsMapView'
import { generateMapShareToken, revokeMapShareToken } from '@/lib/actions/map.actions'
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
  shareToken: string | null
}

export function MapPageClient({ projectId, backgroundUrl, areas, positions, pois, categories, calibration, canAdmin, shareToken: initialShareToken }: Props) {
  const [tab, setTab] = useState<Tab>('gps')
  const containerRef = useRef<HTMLDivElement>(null)
  const [editorSize, setEditorSize] = useState({ w: 1000, h: 700 })
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareSaving, setShareSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = shareToken ? `${window?.location?.origin}/share/${shareToken}` : null

  async function handleGenerate() {
    setShareSaving(true)
    const res = await generateMapShareToken(projectId)
    if (res.token) setShareToken(res.token)
    setShareSaving(false)
  }

  async function handleRevoke() {
    setShareSaving(true)
    await revokeMapShareToken(projectId)
    setShareToken(null)
    setShareOpen(false)
    setShareSaving(false)
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        {tabBtn('gps', 'GPS kaart')}
        {tabBtn('live', 'Live kaart')}
        {canAdmin && tabBtn('editor', 'Editor')}

        {/* Share button */}
        {canAdmin && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShareOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${shareToken ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {shareToken ? 'Gedeeld' : 'Delen'}
            </button>

            {shareOpen && (
              <div className="absolute top-full right-0 mt-1 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl z-50 p-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-white mb-1">Publieke kaartlink</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Iedereen met de link kan de live kaart bekijken zonder in te loggen.
                </p>

                {shareToken ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input readOnly value={shareUrl ?? ''} className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 focus:outline-none" />
                      <button onClick={handleCopy}
                        className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white'}`}>
                        {copied ? 'Gekopieerd!' : 'Kopieer'}
                      </button>
                    </div>
                    <button onClick={handleRevoke} disabled={shareSaving}
                      className="w-full py-1.5 text-xs text-red-500 hover:text-red-600 disabled:opacity-40">
                      Link intrekken
                    </button>
                  </div>
                ) : (
                  <button onClick={handleGenerate} disabled={shareSaving}
                    className="w-full py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-white disabled:opacity-40">
                    {shareSaving ? 'Aanmaken...' : 'Link aanmaken'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* All tabs rendered simultaneously — GPS map (Leaflet) loads immediately */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={tab === 'gps' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
          <GpsMapView
            areas={areas}
            positions={positions}
            pois={pois}
            categories={categories}
            calibration={calibration}
            backgroundUrl={backgroundUrl}
          />
        </div>
        <div className={tab === 'live' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
          <MapView
            projectId={projectId}
            backgroundUrl={backgroundUrl}
            areas={areas}
            positions={positions}
            pois={pois}
            categories={categories}
          />
        </div>
        {canAdmin && (
          <div className={tab === 'editor' ? 'flex-1 overflow-hidden flex flex-col' : 'hidden'}>
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
          </div>
        )}
      </div>
    </div>
  )
}
