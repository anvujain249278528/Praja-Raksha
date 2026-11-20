import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { postJson, uploadEvidence } from './api'
import AgentPanel from './components/AgentPanel'
import ComplaintForm, { EMPTY_PERSON } from './components/ComplaintForm'
import DraftPanel from './components/DraftPanel'
import FilingPanel from './components/FilingPanel'
import Results from './components/Results'

export default function App() {
  const [status, setStatus] = useState({})
  const [notes, setNotes] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { analysis, evidence, draft, complaint, person }

  const mark = (id, s, note) => {
    setStatus((p) => ({ ...p, [id]: s }))
    if (note) setNotes((p) => ({ ...p, [id]: note }))
  }

  // The agent pipeline: Evidence -> Legal Analysis -> Drafting. Each agent's output feeds the next.
  async function run({ text, files, person, anonymous }) {
    setBusy(true); setError(''); setResult(null); setStatus({}); setNotes({})
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

  return (
    <div className="min-h-screen">
      <header className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <ShieldCheck className="text-saffron" size={30} />
          <div>
            <p className="text-xl font-extrabold tracking-tight">Praja Raksha</p>
            <p className="text-xs text-brand-100">Your AI Legal Shield</p>
          </div>
        </div>
      </header>

      {!started && (
        <section className="bg-brand-900 pb-24 text-white">
          <div className="mx-auto max-w-6xl px-4 pt-6">
            <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">
              Speak your problem. <span className="text-saffron">Know your rights.</span> Get it filed.
            </h1>
            <p className="mt-4 max-w-2xl text-brand-100 sm:text-lg">
              Facing harassment, threats, fraud or abuse? Tell us in Kannada, Hindi or English. Our AI agents find the laws
              that protect you, organise your evidence and write your police complaint in minutes, for free.
            </p>
          </div>
        </section>
      )}

      <main className={`mx-auto max-w-6xl px-4 pb-16 ${started ? 'pt-6' : '-mt-16'}`}>
        {!started ? (
          <div className="mx-auto max-w-3xl">
            <ComplaintForm onSubmit={run} busy={busy} />
            <p className="mt-4 text-center text-xs text-slate-500">
              Praja Raksha gives legal information, not legal advice. In an emergency call 112.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
              {!result && busy && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200" />)}
                </div>
              )}
              {result && <Results analysis={result.analysis} evidence={result.evidence} />}
              {result && (result.draft || !busy) && (
                <DraftPanel key={result.draft?.text || 'none'} analysis={result.analysis} evidence={result.evidence}
                  complaint={result.complaint} person={result.person || EMPTY_PERSON} initialDraft={result.draft} />
              )}
              {result?.draft && (
                <FilingPanel analysis={result.analysis} evidence={result.evidence} complaint={result.complaint}
                  person={result.person || EMPTY_PERSON} anonymous={result.anonymous}
                  onStatus={(s, note) => mark('filing', s, note)} />
              )}
            </div>
            <aside className="order-1 lg:order-2">
              <div className="lg:sticky lg:top-6"><AgentPanel status={status} notes={notes} /></div>
            </aside>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Praja Raksha · Built for IDEA//FORGE 2026 · Powered by Google Gemini · Not a substitute for a lawyer
      </footer>
    </div>
  )
}
