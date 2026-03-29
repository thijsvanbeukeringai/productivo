'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computeTransform, imageToGPS } from '@/lib/utils/geo-transform'
import type { Area, CalibrationPoint, AreaStatus } from '@/types/app.types'

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

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    fitted.current = true
    map.fitBounds(L.latLngBounds(positions), { padding: [32, 32] })
  }, [map, positions])
  return null
}

function RotatedVenueOverlay({ imageUrl, calibration, opacity }: {
  imageUrl: string
  calibration: CalibrationPoint[]
  opacity: number
}) {
  const map = useMap()

  useEffect(() => {
    const transform = computeTransform(calibration)
    if (!transform) return

    const pane = map.getPanes().overlayPane
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.opacity = String(opacity)
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
      const g0 = imageToGPS(0, 0, transform!)
      const gW = imageToGPS(W, 0, transform!)
      const p0 = map.latLngToLayerPoint(L.latLng(g0.lat, g0.lng))
      const pW = map.latLngToLayerPoint(L.latLng(gW.lat, gW.lng))
      const dx = pW.x - p0.x
      const dy = pW.y - p0.y
      const pixelWidth = Math.sqrt(dx * dx + dy * dy)
      const pixelHeight = pixelWidth * (H / W)
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI)
      container.style.width = pixelWidth + 'px'
      container.style.height = pixelHeight + 'px'
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
  }, [map, imageUrl, calibration, opacity])

  return null
}

interface Props {
  areas: Area[]
  calibration: CalibrationPoint[]
  backgroundUrl: string | null
  height: number
}

export default function DashboardGpsMap({ areas, calibration, backgroundUrl, height }: Props) {
  const transform = computeTransform(calibration)

  const gpsPoints: [number, number][] = []
  if (transform) {
    for (const area of areas) {
      if (area.map_polygon) {
        for (const p of area.map_polygon) {
          const g = imageToGPS(p.x, p.y, transform)
          gpsPoints.push([g.lat, g.lng])
        }
      }
    }
  }

  const center: [number, number] = gpsPoints.length > 0
    ? [
        gpsPoints.reduce((s, p) => s + p[0], 0) / gpsPoints.length,
        gpsPoints.reduce((s, p) => s + p[1], 0) / gpsPoints.length,
      ]
    : [52.3676, 4.9041]

  return (
    <MapContainer
      center={center}
      zoom={16}
      style={{ width: '100%', height }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {backgroundUrl && calibration.length >= 2 && (
        <RotatedVenueOverlay imageUrl={backgroundUrl} calibration={calibration} opacity={0.5} />
      )}

      {transform && areas.filter(a => a.map_polygon && a.map_polygon.length >= 3).map(area => {
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

      <FitBounds positions={gpsPoints} />
    </MapContainer>
  )
}
