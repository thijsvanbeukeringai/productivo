'use client'

import dynamic from 'next/dynamic'
import type { Area, Position, MapPoi, MapPoiCategory, CalibrationPoint } from '@/types/app.types'

const GpsMapInner = dynamic(() => import('./GpsMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="text-sm text-slate-500">Kaart laden...</div>
    </div>
  ),
})

interface Props {
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories: MapPoiCategory[]
  calibration: CalibrationPoint[]
  backgroundUrl: string | null
}

export function GpsMapView(props: Props) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <GpsMapInner {...props} />
    </div>
  )
}
