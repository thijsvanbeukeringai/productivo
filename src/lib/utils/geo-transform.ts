import type { CalibrationPoint } from '@/types/app.types'

// Complex-number similarity transform in *normalized* coordinates:
//   w_norm = A * z + B
// where z = imageX + i*imageY
//   and w_norm = lat + i*(lng * cosLat)
// Normalizing lng by cosLat makes both axes have equal physical scale (~degrees north),
// which is required for the rotation+uniform-scale (similarity) transform to be correct.
export interface GeoTransform {
  Ar: number    // Re(A)
  Ai: number    // Im(A)
  Br: number    // lat offset
  Bi: number    // lng*cosLat offset
  cosLat: number // cos(reference latitude) — used to denormalize lng
}

export function computeTransform(points: CalibrationPoint[]): GeoTransform | null {
  if (points.length < 2) return null

  const p1 = points[0], p2 = points[1]
  const latRef = (p1.lat + p2.lat) / 2
  const cosLat = Math.cos(latRef * Math.PI / 180)

  const dzr = p2.imageX - p1.imageX
  const dzi = p2.imageY - p1.imageY
  const dwr = p2.lat - p1.lat
  const dwi = (p2.lng - p1.lng) * cosLat   // normalize lng so axes have equal scale
  const dz2 = dzr * dzr + dzi * dzi

  if (dz2 < 1e-10) return null

  const Ar = (dwr * dzr + dwi * dzi) / dz2
  const Ai = (dwi * dzr - dwr * dzi) / dz2
  const Br = p1.lat - (Ar * p1.imageX - Ai * p1.imageY)
  const Bi = p1.lng * cosLat - (Ai * p1.imageX + Ar * p1.imageY)

  return { Ar, Ai, Br, Bi, cosLat }
}

export function imageToGPS(x: number, y: number, t: GeoTransform): { lat: number; lng: number } {
  return {
    lat: t.Ar * x - t.Ai * y + t.Br,
    lng: (t.Ai * x + t.Ar * y + t.Bi) / t.cosLat,  // denormalize
  }
}

export function gpsToImage(lat: number, lng: number, t: GeoTransform): { x: number; y: number } {
  const wr = lat - t.Br
  const wi = lng * t.cosLat - t.Bi
  const A2 = t.Ar * t.Ar + t.Ai * t.Ai
  return {
    x: (t.Ar * wr + t.Ai * wi) / A2,
    y: (t.Ar * wi - t.Ai * wr) / A2,
  }
}
