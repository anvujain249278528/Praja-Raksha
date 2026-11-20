import { Bot, CheckCircle2, ExternalLink, EyeOff, Loader2, Send, ShieldAlert, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { postJson } from '../api'

const API = import.meta.env.VITE_API_URL || ''

export default function FilingPanel({ analysis, evidence, complaint, person, anonymous, onStatus, onTrack }) {
  const [confirmed, setConfirmed] = useState(false)
  const [job, setJob] = useState(null)
  const [extra, setExtra] = useState('')
  const [error, setError] = useState('')
  const timer = useRef(null)

  useEffect(() => () => clearInterval(timer.current), [])

  async function start(extraInfo = '') {
    setError('')
    clearInterval(timer.current)
    try {
      const complainant = Object.fromEntries(Object.entries(person).filter(([, v]) => v.trim()))
      const { job_id } = await postJson('/file', {
        user_confirmed: confirmed, anonymous, complaint, complainant, analysis, evidence, extra_info: extraInfo,
      })
      setJob({ id: job_id, status: 'running', steps: [] })
      onStatus('running', 'Opening the complaint portal...')
      timer.current = setInterval(async () => {
        try {
          const j = await (await fetch(`${API}/api/file/${job_id}`)).json()
          setJob(j)
          const last = j.steps.at(-1)?.text
          if (j.status === 'running') onStatus('running', last)
          else {
            clearInterval(timer.current)
            if (j.status === 'done') onStatus('done', `Filed. Ack no. ${j.ack_no}`)
            else if (j.status === 'blocked') onStatus('error', 'Waiting for your input')
            else onStatus('error', j.error)
          }
        } catch { /* temporary network issue: keep polling */ }
      }, 1500)
    } catch (e) {
      setError(e.message)
    }
  }

  const lastShot = job?.steps.filter((s) => s.shot !== null).at(-1)
  const running = job?.status === 'running'

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><Bot size={20} className="text-brand-700" />Let the AI agent file it for you</h3>
      <p className="mt-1 text-sm text-slate-600">
        Our Filing Agent opens the online complaint portal in a browser, fills every page from your case, fixes any errors
        the portal shows, and brings back your acknowledgement number.
      </p>

      {!job && (
        <div className="mt-4 space-y-3">
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${anonymous ? 'bg-violet-50 text-violet-900' : 'bg-slate-50 text-slate-700'}`}>
            {anonymous ? <EyeOff size={18} /> : <User size={18} />}
            {anonymous ? 'Filing anonymously: your name and phone will not be shared.' : `Filing in your name${person.name ? ` (${person.name})` : ''}.`}
          </div>
          {!anonymous && (!person.name || !person.phone) && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert size={18} className="shrink-0" />
              Your name and phone are missing. The agent will ask for them, or go back and choose to report anonymously.
            </p>
          )}
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4" />
            <span>I confirm the information I gave is true, and I authorise Praja Raksha's agent to submit this complaint on my behalf.</span>
          </label>
          <button onClick={() => start()} disabled={!confirmed}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">
            <Send size={18} /> File my complaint
          </button>
          <p className="text-xs text-slate-400">Prototype: files on a demo portal that simulates a government e-complaint website.</p>
        </div>
      )}

      {job && (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <ol className="space-y-2 text-sm">
            {job.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-12 shrink-0 text-right font-mono text-xs text-slate-400">{s.t}s</span>
                <span className="text-slate-700">{s.text}</span>
              </li>
            ))}
            {running && <li className="flex items-center gap-2 pl-14 text-brand-700"><Loader2 size={14} className="animate-spin" /> Agent is thinking...</li>}
          </ol>
          <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
            <div className="flex items-center gap-1.5 border-b border-slate-300 bg-slate-200 px-3 py-1.5">
              <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 truncate text-xs text-slate-500">Agent's browser: e-Complaint Portal</span>
            </div>
            {lastShot
              ? <img src={`${API}/api/file/${job.id}/shot/${lastShot.shot}`} alt={`Agent's browser: ${lastShot.text}`} className="max-h-[420px] w-full object-cover object-top" />
              : <div className="grid h-60 place-items-center text-sm text-slate-400">Starting browser...</div>}
          </div>
        </div>
      )}

      {job?.status === 'done' && (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <p className="flex items-center gap-2 font-semibold text-emerald-900"><CheckCircle2 size={20} /> Complaint filed successfully</p>
          <p className="mt-2 text-sm text-emerald-800">Acknowledgement number</p>
          <p className="font-mono text-2xl font-bold tracking-wide text-emerald-900">{job.ack_no}</p>
          <a href={`${API}/portal/receipt/${encodeURIComponent(job.ack_no)}`} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline">
            View receipt on the portal <ExternalLink size={14} />
          </a>
          <p className="mt-2 text-xs text-emerald-700">Save this number. The Tracking Agent will watch this complaint and escalate if police do not act.</p>
          <button onClick={() => onTrack(job.ack_no)} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            Track this complaint
          </button>
        </div>
      )}

      {job?.status === 'blocked' && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <p className="font-semibold text-amber-900">The agent needs one more detail</p>
          <p className="mt-1 text-sm text-amber-900">{job.blocked_reason}</p>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Type the missing details here"
            className="mt-3 w-full rounded-lg border border-amber-300 bg-white p-3 text-sm outline-none" />
          <button onClick={() => start(extra)} disabled={!extra.trim()}
            className="mt-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Continue filing</button>
        </div>
      )}

      {(job?.status === 'error' || error) && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <p>{error || job.error}</p>
          <button onClick={() => start(extra)} className="mt-2 font-semibold underline">Try again</button>
        </div>
      )}
    </section>
  )
}
