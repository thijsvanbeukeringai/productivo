'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computeTransform, imageToGPS } from '@/lib/utils/geo-transform'
import type { Area, Position, MapPoi, MapPoiCategory, CalibrationPoint, AreaStatus } from '@/types/app.types'

// Fix Leaflet default icon paths broken by Webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const AREA_STYLE: Record<AreaStatus, { color: string; fillColor: string; label: string }> = {
  open:      { color: '#16a34a', fillColor: '#22c55e', label: 'Open' },
  regulated: { color: '#ea580c', fillColor: '#f97316', label: 'Reguleren' },
  closed:    { color: '#dc2626', fillColor: '#ef4444', label: 'Gesloten' },
}

function positionDivIcon(number: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;background:#3b82f6;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;box-shadow:0 1px 4px rgba(0,0,0,0.4)">${number}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function poiDivIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.35)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// Renders venue image with correct rotation using affine transform on the Leaflet overlayPane
function RotatedVenueOverlay({ imageUrl, calibration }: {
  imageUrl: string
  calibration: CalibrationPoint[]
}) {
  const map = useMap()

  useEffect(() => {
    const transform = computeTransform(calibration)
    if (!transform) return

    const pane = map.getPanes().overlayPane
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.opacity = '0.5'
    container.style.pointerEvents = 'none'
    container.style.transformOrigin = '0 0'

    const imgEl = document.createElement('img')
    imgEl.style.width = '100%'
    imgEl.style.height = '100%'
    imgEl.style.display = 'block'
    container.appendChild(imgEl)
    pane.appendChild(container)

    let W = 0, H = 0

    function reposition() {
      if (W === 0 || H === 0) return

      // GPS of top-left (0,0) and top-right (W,0) image corners
      const g0 = imageToGPS(0, 0, transform!)
      const gW = imageToGPS(W, 0, transform!)

      // Layer-space pixel positions (relative to mapPane — stable during pan)
      const p0 = map.latLngToLayerPoint(L.latLng(g0.lat, g0.lng))
      const pW = map.latLngToLayerPoint(L.latLng(gW.lat, gW.lng))

      const dx = pW.x - p0.x
      const dy = pW.y - p0.y
      const pixelWidth = Math.sqrt(dx * dx + dy * dy)
      const pixelHeight = pixelWidth * (H / W)
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)

      container.style.width = pixelWidth + 'px'
      container.style.height = pixelHeight + 'px'
      // translate3d positions within the pane; rotate applies the map rotation
      container.style.transform = `translate3d(${p0.x}px,${p0.y}px,0) rotate(${angleDeg}deg)`
    }

    imgEl.onload = () => {
      W = imgEl.naturalWidth
      H = imgEl.naturalHeight
      reposition()
    }
    imgEl.src = imageUrl

    map.on('viewreset zoomend', reposition)

    return () => {
      map.off('viewreset zoomend', reposition)
      if (pane.contains(container)) pane.removeChild(container)
    }
  }, [map, imageUrl, calibration])

  return null
}

// Auto-fit map to content bounds once
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    fitted.current = true
    map.fitBounds(L.latLngBounds(positions), { padding: [48, 48] })
  }, [map, positions])
  return null
}

interface Props {
  areas: Area[]
  positions: Position[]
  pois: MapPoi[]
  categories: MapPoiCategory[]
  calibration: CalibrationPoint[]
  backgroundUrl: string | null
}

export default function GpsMapInner({ areas, positions, pois, categories, calibration, backgroundUrl }: Props) {
  const transform = computeTransform(calibration)
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const allGpsPoints: [number, number][] = []
  if (transform) {
    for (const area of areas) {
      if (area.map_polygon) {
        for (const p of area.map_polygon) {
          const g = imageToGPS(p.x, p.y, transform)
          allGpsPoints.push([g.lat, g.lng])
        }
      }
    }
    for (const pos of positions) {
      if (pos.map_point) {
        const g = imageToGPS(pos.map_point.x, pos.map_point.y, transform)
        allGpsPoints.push([g.lat, g.lng])
      }
    }
    for (const poi of pois) {
      const g = imageToGPS(poi.x, poi.y, transform)
      allGpsPoints.push([g.lat, g.lng])
    }
  }

  const center: [number, number] = allGpsPoints.length > 0
    ? [
        allGpsPoints.reduce((s, p) => s + p[0], 0) / allGpsPoints.length,
        allGpsPoints.reduce((s, p) => s + p[1], 0) / allGpsPoints.length,
      ]
    : [52.3676, 4.9041]

  if (!transform) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center max-w-xs px-6">
          <div className="text-4xl mb-3">📍</div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS kalibratie vereist</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ga naar de Editor en stel minimaal 2 kalibratiepunten in om de GPS-kaart te activeren.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={16}
        style={{ width: '100%', height: '100%' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {backgroundUrl && calibration.length >= 2 && (
          <RotatedVenueOverlay imageUrl={backgroundUrl} calibration={calibration} />
        )}

        {areas.filter(a => a.map_polygon && a.map_polygon.length >= 3).map(area => {
          const gpsCoords = area.map_polygon!.map(p => {
            const g = imageToGPS(p.x, p.y, transform)
            return [g.lat, g.lng] as [number, number]
          })
          const style = AREA_STYLE[area.status]
          return (
            <Polygon key={area.id} positions={gpsCoords}
              pathOptions={{ color: style.color, fillColor: style.fillColor, fillOpacity: 0.45, weight: 2 }}>
              <Tooltip className="area-tooltip">{area.name} — {style.label}</Tooltip>
            </Polygon>
          )
        })}

        {positions.filter(p => p.map_point).map(pos => {
          const g = imageToGPS(pos.map_point!.x, pos.map_point!.y, transform)
          return (
            <Marker key={pos.id} position={[g.lat, g.lng]} icon={positionDivIcon(pos.number)}>
              <Tooltip>Pos. {pos.number}{pos.name ? ` — ${pos.name}` : ''}</Tooltip>
            </Marker>
          )
        })}

        {pois.map(poi => {
          const g = imageToGPS(poi.x, poi.y, transform)
          const color = poi.category_id ? (categoryMap.get(poi.category_id)?.color ?? '#6366f1') : '#6366f1'
          return (
            <Marker key={poi.id} position={[g.lat, g.lng]} icon={poiDivIcon(color)}>
              <Tooltip>{poi.label}</Tooltip>
            </Marker>
          )
        })}

        <FitBounds positions={allGpsPoints} />
      </MapContainer>
    </div>
  )
}
