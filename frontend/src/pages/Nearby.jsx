import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BadgeCheck, Building2, Crosshair, Loader2, MapPin, Navigation, Phone, Scale, Shield, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import Reviews from '../components/Reviews'
import Stars from '../components/Stars'
import { navigate } from '../router'

const API = import.meta.env.VITE_API_URL || ''

const CITIES = [
  { name: 'Mysuru', lat: 12.3052, lon: 76.6552 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Mangaluru', lat: 12.9141, lon: 74.856 },
  { name: 'Hubballi-Dharwad', lat: 15.3647, lon: 75.124 },
  { name: 'Kalaburagi', lat: 17.3297, lon: 76.8343 },
  { name: 'Belagavi', lat: 15.8497, lon: 74.4977 },
]

export const CASE_TYPES = [
  ['', 'Any problem'], ['cyber_crime', 'Cyber crime / online fraud'], ['harassment_women', 'Harassment of women'],
  ['domestic_violence', 'Domestic violence / dowry'], ['threat_intimidation', 'Threats'], ['physical_assault', 'Assault'],
  ['fraud_cheating', 'Cheating / fraud'], ['property_theft', 'Theft / property'], ['workplace_harassment', 'Workplace harassment'],
  ['consumer', 'Consumer complaint'],
]

const dot = (color, label) => L.divIcon({
  className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;color:white;font:700 12px Inter,sans-serif">${label}</div>`,
})
const youIcon = L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9],
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2547b8;border:3px solid white;box-shadow:0 0 0 6px rgba(37,71,184,.25)"></div>' })

function FlyTo({ center }) {
  const map = useMap()
  useEffect(() => { map.flyTo(center, 14, { duration: 0.8 }) }, [center, map])
  return null
}

function recommendedPolice(p, category) {
  if (category === 'cyber_crime' && p.is_cyber) return 'Handles cyber crime'
  if (['harassment_women', 'domestic_violence'].includes(category) && p.is_women) return "Women's police station"
  return null
}

export default function Nearby({ params }) {
  const [tab, setTab] = useState(params.tab === 'lawyers' ? 'lawyers' : 'police')
  const [category, setCategory] = useState(params.category || '')
  const [where, setWhere] = useState(null) // { lat, lon, label }
  const [locating, setLocating] = useState(false)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [reviewing, setReviewing] = useState(null)

  function locate() {
    if (!navigator.geolocation) { setWhere({ ...CITIES[0], label: CITIES[0].name }); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setWhere({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' }); setLocating(false) },
      () => { setWhere({ ...CITIES[0], label: CITIES[0].name }); setLocating(false); setError('Location permission denied, showing Mysuru. Pick your city below.') },
      { timeout: 10000 },
    )
  }

  useEffect(locate, [])

  const load = useCallback(async () => {
    if (!where) return
    setItems(null); setError(''); setSelected(null)
    try {
      const url = tab === 'police'
        ? `${API}/api/places/police?lat=${where.lat}&lon=${where.lon}&radius_km=6`
        : `${API}/api/places/lawyers?lat=${where.lat}&lon=${where.lon}&category=${category}`
      const r = await fetch(url)
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      let list = data
      if (tab === 'police') {
        // Stations suited to the case first, then nearest
        list = [...data].sort((a, b) => (!recommendedPolice(a, category)) - (!recommendedPolice(b, category)) || a.distance_km - b.distance_km)
      }
      setItems(list.slice(0, 25))
    } catch (e) {
      setError(e.message || 'Could not load places'); setItems([])
    }
  }, [where, tab, category])

  useEffect(() => { load() }, [load])

  const center = where ? [where.lat, where.lon] : [CITIES[0].lat, CITIES[0].lon]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Find help near you</h1>
      <p className="mt-1 text-slate-600">Want to complain in person, or need a lawyer? See the nearest police stations and legal help, with ratings from citizens.</p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="flex rounded-xl bg-slate-200 p-1" role="tablist">
          {[['police', Shield, 'Police stations'], ['lawyers', Scale, 'Lawyers & legal aid']].map(([id, Icon, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === id ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-slate-500">Your case</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2">
            {CASE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-semibold text-slate-500">Location</span>
          <select value={where?.label === 'Your location' ? '' : where?.label || ''} className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
            onChange={(e) => { const c = CITIES.find((x) => x.name === e.target.value); if (c) setWhere({ ...c, label: c.name }) }}>
            <option value="">{where?.label === 'Your location' ? 'My current location' : 'Choose city'}</option>
            {CITIES.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </label>
        <button onClick={locate} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-slate-300">
          {locating ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />} Use my location
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-[360px] overflow-hidden rounded-2xl ring-1 ring-slate-200 lg:sticky lg:top-20 lg:h-[600px]">
          <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FlyTo center={selected ? [selected.lat, selected.lon] : center} />
            {where && <Marker position={center} icon={youIcon}><Popup>{where.label}</Popup></Marker>}
            {(items || []).map((p, i) => (
              <Marker key={p.id} position={[p.lat, p.lon]} eventHandlers={{ click: () => setSelected(p) }}
                icon={dot(tab === 'police' ? (recommendedPolice(p, category) ? '#16a34a' : '#1e3a8a') : (p.free_legal_aid ? '#16a34a' : '#b45309'), i + 1)}>
                <Popup><b>{p.name}</b><br />{p.distance_km} km away</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <ol className="space-y-3">
          {items === null && <li className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /> Finding places near you...</li>}
          {items?.length === 0 && !error && <li className="text-slate-500">Nothing found nearby. Try another city.</li>}
          {items?.map((p, i) => {
            const rec = tab === 'police' ? recommendedPolice(p, category) : p.free_legal_aid ? 'Free legal aid' : p.matches_case ? 'Fits your case' : null
            return (
              <li key={p.id} onClick={() => setSelected(p)}
                className={`cursor-pointer rounded-2xl bg-white p-4 shadow-sm ring-1 transition hover:ring-brand-600 ${selected?.id === p.id ? 'ring-2 ring-brand-600' : 'ring-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${rec ? 'bg-emerald-600' : tab === 'police' ? 'bg-brand-700' : 'bg-amber-700'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{p.name}</p>
                      {rec && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"><BadgeCheck size={12} />{rec}</span>}
                      {p.demo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Demo data</span>}
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{p.distance_km} km{p.address ? ` · ${p.address}` : ''}</p>
                    {tab === 'lawyers' && (
                      <p className="mt-1 text-xs text-slate-600">{p.specialisations.join(', ')} · {p.languages.join(', ')}{p.experience_years ? ` · ${p.experience_years} yrs` : ''}<br />{p.fee}</p>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setReviewing(p) }} className="mt-2 flex items-center gap-2 text-sm text-slate-600 hover:text-brand-700">
                      <Stars value={p.rating} size={14} />
                      <span className="underline-offset-2 hover:underline">{p.rating ? `${p.rating} (${p.review_count})` : 'No reviews yet'} · Reviews</span>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p.phone && <a onClick={(e) => e.stopPropagation()} href={`tel:${p.phone}`} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"><Phone size={13} />{p.phone}</a>}
                      <a onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white"><Navigation size={13} />Directions</a>
                      <button onClick={(e) => { e.stopPropagation(); setReviewing(p) }} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"><Star size={13} />Rate</button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
          {tab === 'police' && items?.length > 0 && (
            <li className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
              <p className="flex items-center gap-2 font-semibold"><Building2 size={16} /> Your rights at the police station</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>Any station must register your complaint as a <b>Zero FIR</b>, even if the crime happened elsewhere.</li>
                <li>You get a <b>free copy of the FIR</b>.</li>
                <li>If they refuse, Praja Raksha drafts your letter to the SP. <button onClick={() => navigate('/complaint')} className="font-semibold underline">Start here</button></li>
              </ul>
            </li>
          )}
          {tab === 'lawyers' && <li className="text-xs text-slate-400">Advocates marked "Demo data" are sample entries for this prototype. Legal Services Authorities provide real free legal aid: call 15100.</li>}
        </ol>
      </div>

      {reviewing && <Reviews target={reviewing} type={tab === 'police' ? 'police' : 'lawyer'} caseCategory={category}
        onClose={() => setReviewing(null)} onAdded={load} />}
    </div>
  )
}
