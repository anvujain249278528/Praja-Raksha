import { Download, FileText, Loader2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { downloadPdf, postJson } from '../api'

const DOC_TYPES = [
  { id: 'fir_complaint', label: 'Police complaint (FIR)', hint: 'Submit at any police station. Zero FIR is your right.' },
  { id: 'sp_escalation', label: 'Letter to SP', hint: 'Use if the police station refuses to register your FIR (BNSS 173(4)).' },
  { id: 'magistrate_application', label: 'Application to Magistrate', hint: 'Use if police and SP do not act (BNSS 175(3)).' },
]

export default function DraftPanel({ analysis, evidence, complaint, person, initialDraft }) {
  const [docType, setDocType] = useState('fir_complaint')
  const [text, setText] = useState(initialDraft?.text || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate(type) {
    setDocType(type)
    setBusy(true)
    setError('')
    try {
      const complainant = Object.fromEntries(Object.entries(person).filter(([, v]) => v.trim()))
      const d = await postJson('/draft', {
        doc_type: type, analysis, complainant, complaint,
        evidence_summary: evidence?.overall_summary || '',
      })
      setText(d.text)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><FileText size={20} className="text-brand-700" />Your complaint, ready to file</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {DOC_TYPES.map((t) => (
          <button key={t.id} onClick={() => generate(t.id)} disabled={busy}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${docType === t.id ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-500">{DOC_TYPES.find((t) => t.id === docType).hint}</p>

      {busy ? (
        <div className="mt-4 flex h-64 items-center justify-center gap-2 rounded-xl bg-slate-50 text-slate-500">
          <Loader2 className="animate-spin" size={18} /> Drafting Agent is writing...
        </div>
      ) : text ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18}
            className="mt-4 w-full rounded-xl border border-slate-300 p-4 font-mono text-sm leading-relaxed outline-none focus:border-brand-600" />
          <p className="mt-1 text-xs text-slate-400">You can edit anything above before downloading. Fill the [placeholders] with your details.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => downloadPdf(text, `praja-raksha-${docType}`).catch((e) => setError(e.message))}
              className="inline-flex items-center gap-2 rounded-lg bg-saffron px-4 py-2.5 text-sm font-bold text-white hover:brightness-95">
              <Download size={16} /> Download PDF
            </button>
            <button onClick={() => generate(docType)} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              <RefreshCw size={16} /> Rewrite
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => generate(docType)} className="mt-4 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">Write my complaint</button>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  )
}
