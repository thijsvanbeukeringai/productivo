'use client'

import { useState, useRef, useEffect } from 'react'
import type { Area, Position, MapPoi, MapPoiCategory } from '@/types/app.types'

type SearchResult =
  | { kind: 'area'; item: Area }
  | { kind: 'position'; item: Position }
  | { kind: 'poi'; item: MapPoi }

interface Props {
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories?: MapPoiCategory[]
  onSelectArea?: (area: Area) => void
  onSelectPosition?: (pos: Position) => void
  onSelectPoi?: (poi: MapPoi) => void
  className?: string
}

export function MapSearch({ areas, positions, pois, categories = [], onSelectArea, onSelectPosition, onSelectPoi, className }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const q = query.toLowerCase().trim()
  const results: SearchResult[] = q.length < 1 ? [] : [
    ...areas.filter(a => a.name.toLowerCase().includes(q)).map(a => ({ kind: 'area' as const, item: a })),
    ...positions.filter(p => String(p.number).includes(q) || (p.name?.toLowerCase().includes(q) ?? false)).map(p => ({ kind: 'position' as const, item: p })),
    ...pois.filter(p => {
      const cat = categories.find(c => c.id === p.category_id)
      return p.label.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || (cat?.name.toLowerCase().includes(q) ?? false) || (p.note?.toLowerCase().includes(q) ?? false)
    }).map(p => ({ kind: 'poi' as const, item: p })),
  ].slice(0, 10)

  function select(r: SearchResult) {
    setQuery('')
    setOpen(false)
    if (r.kind === 'area') onSelectArea?.(r.item)
    else if (r.kind === 'position') onSelectPosition?.(r.item)
    else onSelectPoi?.(r.item)
  }

  const kindLabel: Record<SearchResult['kind'], string> = {
    area: 'Area',
    position: 'Positie',
    poi: 'POI',
  }
  const kindColor: Record<SearchResult['kind'], string> = {
    area: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    position: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    poi: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  }

  function getLabel(r: SearchResult) {
    if (r.kind === 'area') return r.item.name
    if (r.kind === 'position') return `Pos. ${r.item.number}${r.item.name ? ` — ${r.item.name}` : ''}`
    const cat = categories.find(c => c.id === r.item.category_id)
    if (cat?.display_style === 'numbered') return `${cat.name} ${r.item.label}`
    return r.item.label
  }

  return (
    <div ref={ref} className={`relative ${className ?? 'w-64'}`}>
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => { if (e.key === 'Enter' && results.length > 0) { e.preventDefault(); select(results[0]) } }}
          placeholder="Zoek area, positie of POI..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl z-30 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => select(r)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
            >
              <span className="text-slate-700 dark:text-slate-200 truncate">{getLabel(r)}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0 ${kindColor[r.kind]}`}>
                {kindLabel[r.kind]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
