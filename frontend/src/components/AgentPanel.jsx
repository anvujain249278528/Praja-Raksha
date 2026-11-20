import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react'

export const AGENTS = [
  { id: 'evidence', name: 'Evidence Agent', desc: 'Reads screenshots and recordings, builds a timeline' },
  { id: 'legal', name: 'Legal Analysis Agent', desc: 'Understands any language, finds the laws from a verified database' },
  { id: 'draft', name: 'Drafting Agent', desc: 'Writes your police complaint' },
  { id: 'filing', name: 'Filing Agent', desc: 'Operates the complaint portal in a browser and files for you' },
]

const ICON = {
  waiting: <Circle size={20} className="text-slate-300" />,
  running: <Loader2 size={20} className="animate-spin text-brand-600" />,
  done: <CheckCircle2 size={20} className="text-emerald-600" />,
  skipped: <MinusCircle size={20} className="text-slate-300" />,
  error: <XCircle size={20} className="text-red-500" />,
}

export default function AgentPanel({ status, notes }) {
  return (
    <section aria-label="Agent progress" className="rounded-2xl bg-brand-900 p-5 text-white shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-100">AI agents at work</h2>
      <ol className="mt-4 space-y-3">
        {AGENTS.map((a) => {
          const s = status[a.id] || 'waiting'
          return (
            <li key={a.id} className={`flex items-start gap-3 rounded-xl p-3 transition ${s === 'running' ? 'bg-white/10' : ''}`}>
              <span className="mt-0.5 rounded-full bg-white p-0.5">{ICON[s]}</span>
              <div className="min-w-0">
                <p className={`font-semibold ${s === 'waiting' || s === 'skipped' ? 'text-white/50' : ''}`}>{a.name}</p>
                <p className="text-sm text-white/70">{notes[a.id] || a.desc}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
