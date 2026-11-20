import { Menu, Phone, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import TrackView from './components/TrackView'
import ComplaintPage from './pages/ComplaintPage'
import Helplines from './pages/Helplines'
import Home from './pages/Home'
import Nearby from './pages/Nearby'
import { navigate, useRoute } from './router'

const NAV = [
  ['/', 'Home'], ['/helplines', 'Helplines'], ['/complaint', 'File complaint'], ['/nearby', 'Police & lawyers'], ['/track', 'Track'],
]

export default function App() {
  const { path, params } = useRoute()
  const [menu, setMenu] = useState(false)
  const go = (p) => { setMenu(false); navigate(p) }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[500] border-b border-white/10 bg-brand-900/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => go('/')} className="flex items-center gap-2" aria-label="Praja Raksha home">
            <ShieldCheck className="text-saffron" size={30} />
            <span className="text-left leading-tight">
              <span className="block text-lg font-extrabold tracking-tight">Praja Raksha</span>
              <span className="block text-[11px] text-brand-100">Your AI Legal Shield</span>
            </span>
          </button>
          <nav className="ml-auto hidden items-center gap-1 text-sm font-semibold md:flex">
            {NAV.map(([p, label]) => (
              <button key={p} onClick={() => go(p)}
                className={`rounded-lg px-3 py-2 transition ${path === p ? 'bg-white/15 text-white' : 'text-brand-100 hover:text-white'}`}>{label}</button>
            ))}
            <a href="tel:112" className="ml-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"><Phone size={14} />112</a>
          </nav>
          <a href="tel:112" className="ml-auto inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold md:hidden"><Phone size={14} />112</a>
          <button onClick={() => setMenu(!menu)} className="rounded-lg p-2 md:hidden" aria-label="Menu" aria-expanded={menu}>{menu ? <X /> : <Menu />}</button>
        </div>
        {menu && (
          <nav className="border-t border-white/10 px-4 pb-3 md:hidden">
            {NAV.map(([p, label]) => (
              <button key={p} onClick={() => go(p)} className={`block w-full rounded-lg px-3 py-2.5 text-left font-semibold ${path === p ? 'bg-white/15' : 'text-brand-100'}`}>{label}</button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {path === '/' && <Home />}
        {path === '/helplines' && <Helplines />}
        {/* Kept mounted so results survive a visit to the map and back */}
        <div hidden={path !== '/complaint'}><ComplaintPage /></div>
        {path === '/nearby' && <Nearby key={`${params.tab}-${params.category}`} params={params} />}
        {path === '/track' && <div className="px-4 py-8"><TrackView key={params.ack || ''} initialAck={params.ack || ''} /></div>}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <p>Praja Raksha · Built for IDEA//FORGE 2026 · Powered by Google Gemini, OpenStreetMap</p>
          <p>Legal information, not legal advice. Emergency: 112 · Women: 181 · Cyber: 1930</p>
        </div>
      </footer>
    </div>
  )
}
