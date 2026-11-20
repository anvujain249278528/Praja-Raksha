import { AlertTriangle, BookOpen, Clock, Fingerprint, Phone, Scale, Volume2, VolumeX } from 'lucide-react'
import { useState } from 'react'
import { langCodeFor, speak, stopSpeaking } from '../speech'

const SEVERITY = {
  emergency: { label: 'EMERGENCY', cls: 'bg-red-600 text-white' },
  high: { label: 'High severity', cls: 'bg-red-100 text-red-800' },
  medium: { label: 'Medium severity', cls: 'bg-amber-100 text-amber-800' },
  low: { label: 'Low severity', cls: 'bg-emerald-100 text-emerald-800' },
}

function Card({ icon, title, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">{icon}{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function Results({ analysis, evidence }) {
  const [speaking, setSpeaking] = useState(false)
  const sev = SEVERITY[analysis.severity] || SEVERITY.medium
  const localCode = langCodeFor(analysis.detected_language)
  const isEnglish = localCode === 'en-IN'

  function toggleSpeak() {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    const text = [analysis.summary_local, ...analysis.actions_local].join('. ')
    if (speak(text, localCode)) {
      setSpeaking(true)
      setTimeout(() => setSpeaking(false), Math.min(text.length * 90, 120000))
    }
  }

  return (
    <div className="space-y-5">
      {analysis.severity === 'emergency' && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-600 p-4 text-white">
          <AlertTriangle className="shrink-0" />
          <p className="font-semibold">If you are in danger right now, call <a href="tel:112" className="underline">112</a> immediately.</p>
        </div>
      )}

      <Card icon={<Scale size={20} className="text-brand-700" />} title="What happened, in legal terms">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${sev.cls}`}>{sev.label}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{analysis.category.replaceAll('_', ' ')}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Language: {analysis.detected_language}</span>
        </div>
        <p className="mt-3 leading-relaxed text-slate-700">{analysis.summary}</p>
        {!isEnglish && (
          <div className="mt-3 rounded-xl bg-brand-50 p-4">
            <p className="leading-relaxed text-slate-800">{analysis.summary_local}</p>
          </div>
        )}
        <button onClick={toggleSpeak} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
          {speaking ? 'Stop' : `Listen in ${analysis.detected_language}`}
        </button>
      </Card>

      <Card icon={<BookOpen size={20} className="text-brand-700" />} title={`Laws that protect you (${analysis.sections.length})`}>
        <div className="grid gap-3 md:grid-cols-2">
          {analysis.sections.map((s) => (
            <article key={s.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{s.law}</p>
              <p className="mt-1 font-bold text-slate-900">Section {s.section}: {s.title}</p>
              <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Why it applies: </span>{s.why}</p>
              <p className="mt-2 text-xs text-slate-500">Punishment: {s.punishment}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Sections are chosen only from Praja Raksha's verified legal database. The AI cannot invent laws.</p>
      </Card>

      <Card icon={<Scale size={20} className="text-brand-700" />} title="Legal actions you can take">
        <ol className="space-y-3">
          {analysis.actions.map((a, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-saffron text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-slate-900">{a.action}</p>
                <p className="text-sm text-slate-600">{a.detail}</p>
                {!isEnglish && analysis.actions_local[i] && <p className="mt-1 text-sm text-brand-700">{analysis.actions_local[i]}</p>}
              </div>
            </li>
          ))}
        </ol>
        {analysis.missing_info.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">Keep these details ready for the police:</p>
            <ul className="mt-1 list-disc pl-5 text-amber-900">{analysis.missing_info.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
      </Card>

      {evidence && (
        <Card icon={<Clock size={20} className="text-brand-700" />} title="Evidence timeline">
          <p className="text-sm text-slate-600">{evidence.overall_summary}</p>
          <p className="mt-2 text-sm"><span className="font-semibold">Evidence strength: </span>{evidence.strength}</p>
          {evidence.accused_identifiers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {evidence.accused_identifiers.map((id) => <span key={id} className="rounded-md bg-red-50 px-2 py-1 font-mono text-xs text-red-800">{id}</span>)}
            </div>
          )}
          <ol className="mt-4 border-l-2 border-brand-100 pl-4">
            {evidence.timeline.map((t, i) => (
              <li key={i} className="relative pb-3">
                <span className="absolute -left-[23px] top-1.5 size-3 rounded-full bg-brand-600" />
                <p className="text-xs font-semibold text-brand-700">{t.when}</p>
                <p className="text-sm text-slate-700">{t.event}</p>
              </li>
            ))}
          </ol>
          <details className="mt-2 text-xs text-slate-500">
            <summary className="flex cursor-pointer items-center gap-1"><Fingerprint size={14} /> Tamper-proof fingerprints (SHA-256)</summary>
            <ul className="mt-2 space-y-1">
              {evidence.files.map((f) => <li key={f.index} className="break-all font-mono">{f.name}: {f.sha256}</li>)}
            </ul>
          </details>
        </Card>
      )}

      <Card icon={<Phone size={20} className="text-brand-700" />} title="Helplines (free, 24x7)">
        <div className="grid gap-2 sm:grid-cols-2">
          {analysis.helplines.map((h) => (
            <a key={h.name} href={`tel:${h.contact.split(' ')[0]}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-brand-50">
              <span className="text-slate-700">{h.name}</span>
              <span className="font-bold text-brand-700">{h.contact}</span>
            </a>
          ))}
        </div>
      </Card>
    </div>
  )
}
