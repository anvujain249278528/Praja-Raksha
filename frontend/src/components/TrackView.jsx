import { AlertTriangle, CheckCircle2, Clock, Download, FlaskConical, Loader2, Radar, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadPdf, postJson } from '../api'

const DECISION_STYLE = {
  none: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-900 ring-emerald-200', title: 'No escalation needed' },
  wait: { icon: Clock, cls: 'bg-sky-50 text-sky-900 ring-sky-200', title: 'Waiting for police action' },
  escalate: { icon: AlertTriangle, cls: 'bg-red-50 text-red-900 ring-red-200', title: 'Escalation needed' },
}

// Demo-only: simulate what the police do after filing, so the agent's decisions can be shown live.
const DEMO_ACTIONS = [
  { label: '15 days pass, no police action', path: (a) => `/portal/api/demo/${a}/age/15` },
  { label: '16 more days pass (SP also silent)', path: (a) => `/portal/api/demo/${a}/age/16` },
  { label: 'Police register the FIR', path: (a) => `/portal/api/demo/${a}/status`, body: { status: 'FIR Registered', note: 'FIR No. 245/2026 registered' } },
  { label: 'Police close the complaint', path: (a) => `/portal/api/demo/${a}/status`, body: { status: 'Closed', note: 'Closed without FIR' } },
]

const API = import.meta.env.VITE_API_URL || ''

export default function TrackView({ initialAck = '' }) {
  const [ack, setAck] = useState(initialAck)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  async function check(a = ack) {
    if (!a.trim()) return
    setBusy(true); setError('')
    try {
      setData(await postJson(`/track/${encodeURIComponent(a.trim())}`, {}))
    } catch (e) {
      setError(e.message); setData(null)
    } finally {
      setBusy(false)
    }
  }

  async function simulate(action) {
    await fetch(API + action.path(encodeURIComponent(ack.trim())), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.body || {}),
    })
    check()
  }

  useEffect(() => { if (initialAck) check(initialAck) }, [initialAck]) // eslint-disable-line react-hooks/exhaustive-deps

  const d = data?.decision
  const style = d && DECISION_STYLE[d.action]

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Radar size={22} className="text-brand-700" />Track your complaint</h2>
        <p className="mt-1 text-sm text-slate-600">
          The Tracking Agent checks the portal for you. If the police do not act in time, it writes the escalation letter the law allows.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); check() }} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={ack} onChange={(e) => setAck(e.target.value)} placeholder="Acknowledgement number, e.g. KA-MYS-20261120-123456"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm outline-none focus:border-brand-600" />
          <button disabled={busy || !ack.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white disabled:bg-slate-300">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} {busy ? 'Agent is checking...' : 'Check status'}
          </button>
        </form>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>

      {data && (
        <>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-slate-500">{data.ack_no}</span>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{data.portal.status}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{d.days} day(s) since filing</span>
            </div>
            <ol className="mt-4 border-l-2 border-brand-100 pl-4">
              {data.portal.history.map((h, i) => (
                <li key={i} className="relative pb-3">
                  <span className="absolute -left-[23px] top-1.5 size-3 rounded-full bg-brand-600" />
                  <p className="text-xs font-semibold text-brand-700">{h.at}</p>
                  <p className="text-sm text-slate-700">{h.event}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={`rounded-2xl p-5 ring-1 sm:p-6 ${style.cls}`}>
            <p className="flex items-center gap-2 font-bold"><style.icon size={20} /> Agent decision: {style.title}</p>
            <p className="mt-2 text-sm">{d.reason}</p>
            <p className="mt-2 text-sm"><span className="font-semibold">Next step: </span>{d.next_step}</p>
          </section>

          {[...data.letters].reverse().map((l) => (
            <section key={l.level} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Escalation level {l.level} · drafted automatically</p>
              <h3 className="mt-1 font-bold text-slate-900">{l.title}</h3>
              <textarea defaultValue={l.text} rows={12} className="mt-3 w-full rounded-xl border border-slate-300 p-4 font-mono text-sm outline-none" id={`letter-${l.level}`} />
              <button onClick={() => downloadPdf(document.getElementById(`letter-${l.level}`).value, `praja-raksha-${l.doc_type}`)}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-saffron px-4 py-2.5 text-sm font-bold text-white">
                <Download size={16} /> Download PDF
              </button>
            </section>
          ))}

          <details className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-slate-600"><FlaskConical size={16} /> Demo: simulate the police response</summary>
            <p className="mt-2 text-xs text-slate-500">In real use the agent checks every hour on its own. These buttons fast-forward time on the demo portal so you can see each decision.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ACTIONS.map((a) => (
                <button key={a.label} onClick={() => simulate(a)} disabled={busy} className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200 disabled:opacity-50">{a.label}</button>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
