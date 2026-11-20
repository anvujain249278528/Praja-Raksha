import { Bug, Heart, Lightbulb, Loader2, MessageCircleHeart, X } from 'lucide-react'
import { useState } from 'react'
import { postJson } from '../api'
import Stars from './Stars'

const KINDS = [
  { id: 'praise', icon: Heart, label: 'I liked it' },
  { id: 'idea', icon: Lightbulb, label: 'Idea' },
  { id: 'problem', icon: Bug, label: 'Problem' },
]

/** Floating button + dialog to rate Praja Raksha itself. */
export default function Feedback({ page }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [kind, setKind] = useState('praise')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      await postJson('/feedback', { rating, kind, text, page })
      setMsg({ ok: true, text: 'Thank you! Your feedback helps us improve Praja Raksha.' })
      setText(''); setRating(0)
      window.dispatchEvent(new Event('feedback-added'))
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button onClick={() => { setOpen(true); setMsg(null) }}
        className="fixed bottom-5 right-5 z-[900] inline-flex items-center gap-2 rounded-full bg-saffron px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition hover:brightness-110">
        <MessageCircleHeart size={18} /> Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Give feedback"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">How was Praja Raksha?</h2>
                <p className="text-sm text-slate-500">Rate your experience and tell us what to improve.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close"><X /></button>
            </div>

            <div className="mt-4"><Stars value={rating} onChange={setRating} size={30} /></div>

            <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Feedback type">
              {KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-xs font-semibold transition ${kind === k.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                  <k.icon size={18} />{k.label}
                </button>
              ))}
            </div>

            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1500}
              placeholder={kind === 'problem' ? 'What went wrong? Which page?' : kind === 'idea' ? 'What should we add or change?' : 'What did you find useful?'}
              className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-600" />

            <button disabled={busy || !rating || text.trim().length < 5}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-semibold text-white disabled:bg-slate-300">
              {busy && <Loader2 size={16} className="animate-spin" />} Send feedback
            </button>
            {msg && <p className={`mt-3 rounded-lg p-3 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
          </form>
        </div>
      )}
    </>
  )
}
