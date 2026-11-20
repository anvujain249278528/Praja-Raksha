import { ArrowLeft, MapPin, Scale } from 'lucide-react'
import { useState } from 'react'
import { postJson, uploadEvidence } from '../api'
import AgentPanel from '../components/AgentPanel'
import ComplaintForm, { EMPTY_PERSON } from '../components/ComplaintForm'
import DraftPanel from '../components/DraftPanel'
import FilingPanel from '../components/FilingPanel'
import Results from '../components/Results'
import { navigate } from '../router'

export default function ComplaintPage() {
  const [status, setStatus] = useState({})
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { analysis, evidence, draft, complaint, person, anonymous }

  const mark = (id, s, note) => {
    setStatus((p) => ({ ...p, [id]: s }))
    if (note) setNotes((p) => ({ ...p, [id]: note }))
  }

  // The agent pipeline: Evidence -> Legal Analysis -> Drafting. Each agent's output feeds the next.
  async function run({ text, files, person, anonymous }) {
    setBusy(true); setError(''); setResult(null); setStatus({}); setNotes({})
    window.scrollTo(0, 0)
    let current = 'evidence'
    try {
      let evidence = null
      if (files.length) {
        mark('evidence', 'running', `Reading ${files.length} file(s)...`)
        evidence = await uploadEvidence(files, text)
        mark('evidence', 'done', `${evidence.timeline.length} events found, evidence is ${evidence.strength.split(/[\s,.:-]/)[0]}`)
      } else {
        mark('evidence', 'skipped', 'No files uploaded')
      }

      current = 'legal'
      mark('legal', 'running', 'Matching your facts against the legal database...')
      const analysis = await postJson('/analyze', { complaint: text, evidence_notes: evidence?.notes_for_legal_agent || '' })
      mark('legal', 'done', `${analysis.sections.length} sections found, ${analysis.severity} severity`)
      setResult({ analysis, evidence, complaint: text, person, anonymous, draft: null })

      current = 'draft'
      mark('draft', 'running', 'Writing your FIR complaint...')
      const complainant = Object.fromEntries(Object.entries(person).filter(([, v]) => v.trim()))
      const draft = await postJson('/draft', {
        doc_type: 'fir_complaint', analysis, complainant, complaint: text,
        evidence_summary: evidence?.overall_summary || '',
      })
      mark('draft', 'done', 'FIR complaint ready to download')
      setResult({ analysis, evidence, complaint: text, person, anonymous, draft })
    } catch (e) {
      mark(current, 'error', e.message)
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const started = Object.keys(status).length > 0

  if (!started) {
    return (
      <>
        <section className="bg-brand-900 pb-24 text-white">
          <div className="mx-auto max-w-6xl px-4 pt-10">
            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
              Speak your problem. <span className="text-saffron">Know your rights.</span> Get it filed.
            </h1>
            <p className="mt-4 max-w-2xl text-brand-100 sm:text-lg">
              Tell us in Kannada, Hindi or English. Our AI agents find the laws that protect you, organise your evidence,
              write your police complaint and can file it for you.
            </p>
          </div>
        </section>
        <div className="mx-auto -mt-16 max-w-3xl px-4 pb-16">
          <ComplaintForm onSubmit={run} busy={busy} />
          <p className="mt-4 text-center text-xs text-slate-500">Praja Raksha gives legal information, not legal advice. In an emergency call 112.</p>
        </div>
      </>
    )
  }

  const category = result?.analysis.category

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 pb-16 lg:grid-cols-[1fr_320px]">
      <div className="order-2 space-y-5 lg:order-1">
        {!busy && (
          <button onClick={() => { setStatus({}); setResult(null) }} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
            <ArrowLeft size={16} /> New complaint
          </button>
        )}
        {error && (
          <div className="rounded-2xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200">
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
        {!result && busy && <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />)}</div>}
        {result && <Results analysis={result.analysis} evidence={result.evidence} />}

        {result && (
          <section className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => navigate('/nearby', { tab: 'police', category })}
              className="flex items-start gap-3 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-600">
              <MapPin className="shrink-0 text-emerald-600" />
              <span><span className="block font-bold text-slate-900">Prefer to file in person?</span>
                <span className="text-sm text-slate-600">See the nearest police stations on a map, with directions and citizen ratings.</span></span>
            </button>
            <button onClick={() => navigate('/nearby', { tab: 'lawyers', category })}
              className="flex items-start gap-3 rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-600">
              <Scale className="shrink-0 text-amber-600" />
              <span><span className="block font-bold text-slate-900">Need a lawyer for this case?</span>
                <span className="text-sm text-slate-600">Free legal aid and lawyers who handle {category?.replaceAll('_', ' ')} cases, with reviews.</span></span>
            </button>
          </section>
        )}

        {result && (result.draft || !busy) && (
          <DraftPanel key={result.draft?.text || 'none'} analysis={result.analysis} evidence={result.evidence}
            complaint={result.complaint} person={result.person || EMPTY_PERSON} initialDraft={result.draft} />
        )}
        {result?.draft && (
          <FilingPanel analysis={result.analysis} evidence={result.evidence} complaint={result.complaint}
            person={result.person || EMPTY_PERSON} anonymous={result.anonymous}
            onStatus={(s, note) => mark('filing', s, note)} onTrack={(ack) => navigate('/track', { ack })} />
        )}
      </div>
      <aside className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-20"><AgentPanel status={status} notes={notes} /></div>
      </aside>
    </div>
  )
}
