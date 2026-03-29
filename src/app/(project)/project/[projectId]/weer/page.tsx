import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ projectId: string }>
}

interface GeoResult {
  lat: string
  lon: string
  display_name: string
}

interface OpenMeteoResponse {
  current_weather: {
    temperature: number
    windspeed: number
    winddirection: number
    weathercode: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    windspeed_10m_max: number[]
    windgusts_10m_max: number[]
    winddirection_10m_dominant: number[]
    sunshine_duration: number[]
    sunrise: string[]
    sunset: string[]
  }
}

async function geocode(location: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'IMS-App/1.0' },
      next: { revalidate: 3600 },
    })
    const data: GeoResult[] = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] }
  } catch {
    return null
  }
}

async function fetchWeather(lat: number, lon: number): Promise<OpenMeteoResponse | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant,sunshine_duration,sunrise,sunset&timezone=Europe%2FAmsterdam&forecast_days=2`
    const res = await fetch(url, { next: { revalidate: 900 } })
    return await res.json()
  } catch {
    return null
  }
}

function windDirection(deg: number): string {
  const dirs = ['N', 'NNO', 'NO', 'ONO', 'O', 'OZO', 'ZO', 'ZZO', 'Z', 'ZZW', 'ZW', 'WZW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function beaufort(kmh: number): number {
  const scale = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117]
  return scale.findIndex(v => kmh <= v) + (kmh > 117 ? 12 : 0)
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

const windyLayers = [
  { label: 'Wind',   icon: '🌬️', overlay: 'wind' },
  { label: 'Regen',  icon: '🌧️', overlay: 'rain' },
  { label: 'Onweer', icon: '⛈️', overlay: 'thunder' },
]

export default async function WeerPage({ params }: PageProps) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single()
  if (!project) notFound()

  const { data: currentMember } = await supabase
    .from('project_members').select('*, profiles(*)')
    .eq('project_id', projectId).eq('user_id', user.id).single()
  if (!currentMember) redirect('/dashboard')

  // Geocode project location
  const locationQuery = project.location_address || project.location_name || 'Eindhoven'
  const geo = await geocode(locationQuery) ?? { lat: 51.4416, lon: 5.4697, name: 'Eindhoven' }

  const weather = await fetchWeather(geo.lat, geo.lon)
  const today = weather?.daily

  const maxTemp = today ? Math.round(today.temperature_2m_max[0]) : null
  const minTemp = today ? Math.round(today.temperature_2m_min[0]) : null
  const maxWind = today ? Math.round(today.windspeed_10m_max[0]) : null
  const maxGusts = today ? Math.round(today.windgusts_10m_max[0]) : null
  const windDir = today ? windDirection(today.winddirection_10m_dominant[0]) : null
  const bft = maxWind ? beaufort(maxWind) : null
  const sunHours = today ? (today.sunshine_duration[0] / 3600).toFixed(1) : null
  const sunrise = today ? formatTime(today.sunrise[0]) : null
  const sunset = today ? formatTime(today.sunset[0]) : null
  const precip = today ? today.precipitation_sum[0] : null

  const windyBase = `https://embed.windy.com/embed2.html?lat=${geo.lat.toFixed(2)}&lon=${geo.lon.toFixed(2)}&detailLat=${geo.lat.toFixed(2)}&detailLon=${geo.lon.toFixed(2)}&zoom=9&level=surface&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`

  const todayLabel = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: '2-digit', month: '2-digit' })

  // Wind warning based on max gusts (Bft scale)
  const gustBft = maxGusts ? beaufort(maxGusts) : 0
  const windWarning =
    gustBft >= 11 ? { level: 'rood',   bg: 'bg-red-600',    border: 'border-red-700',    text: `Extreme storm verwacht — windstoten tot ${maxGusts} km/u (kracht ${gustBft} Bft). Overweeg annulering van het evenement.` } :
    gustBft >= 9  ? { level: 'oranje', bg: 'bg-orange-500', border: 'border-orange-600', text: `Zware storm verwacht — windstoten tot ${maxGusts} km/u (kracht ${gustBft} Bft). Controleer constructies en beperk buitenactiviteiten.` } :
    gustBft >= 7  ? { level: 'geel',   bg: 'bg-yellow-400', border: 'border-yellow-500', text: `Harde wind verwacht — windstoten tot ${maxGusts} km/u (kracht ${gustBft} Bft). Wees alert op losliggende objecten.` } :
    gustBft >= 6  ? { level: 'let op', bg: 'bg-amber-400',  border: 'border-amber-500',  text: `Verhoogde wind verwacht — windstoten tot ${maxGusts} km/u (kracht ${gustBft} Bft). Extra aandacht vereist.` } :
    null

  return (
    <main className="h-full overflow-y-auto p-4">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Wind warning banner */}
        {windWarning && (
          <div className={`${windWarning.bg} ${windWarning.border} border rounded-xl px-5 py-4 flex items-start gap-3`}>
            <svg className="w-6 h-6 text-white shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className={`text-sm font-bold uppercase tracking-wide mb-0.5 ${windWarning.level === 'geel' || windWarning.level === 'let op' ? 'text-slate-900' : 'text-white'}`}>
                Windwaarschuwing — code {windWarning.level}
              </p>
              <p className={`text-sm ${windWarning.level === 'geel' || windWarning.level === 'let op' ? 'text-slate-800' : 'text-white/90'}`}>
                {windWarning.text}
              </p>
            </div>
          </div>
        )}

        {/* Windy maps */}
        <div className="grid grid-cols-3 gap-4">
          {windyLayers.map(({ label, icon, overlay }) => (
            <div key={overlay} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 px-3 py-2 text-center border-b border-slate-100 dark:border-slate-700">
                {icon} {label}
              </p>
              <iframe
                src={`${windyBase}&overlay=${overlay}`}
                className="w-full"
                style={{ height: 320, border: 'none' }}
                loading="lazy"
                title={`Windy ${label}`}
              />
            </div>
          ))}
        </div>

        {/* Forecast */}
        {weather && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h2 className="text-sm font-semibold text-blue-600 dark:text-blue-400 text-center mb-4">
              Voorspelling komende 24 uur
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{todayLabel}</p>
            <p className="font-semibold text-slate-800 dark:text-white mb-3">Locatie: {geo.name}</p>

            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {minTemp !== null && maxTemp !== null && (
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Temperatuur tussen <strong>{minTemp}°C</strong> en <strong>{maxTemp}°C</strong>.</span>
                </li>
              )}
              {maxWind !== null && windDir && bft !== null && (
                <li className="flex gap-2">
                  <span>•</span>
                  <span>
                    Wind {windDir}, gemiddeld <strong>{maxWind} km/u</strong> (kracht {bft} Bft)
                    {maxGusts ? <>, uitschieters tot <strong>{maxGusts} km/u</strong></> : ''}.
                  </span>
                </li>
              )}
              {precip !== null && (
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Neerslag: <strong>{precip.toFixed(1)} mm</strong> verwacht.</span>
                </li>
              )}
              {sunHours !== null && (
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Zonuren: ongeveer <strong>{sunHours} uur</strong> in de komende 24 uur.</span>
                </li>
              )}
              {sunrise && sunset && (
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Volgende zonsopkomst: <strong>{sunrise}</strong>, zonsondergang: <strong>{sunset}</strong>.</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
