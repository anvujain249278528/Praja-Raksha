import { Loader2, MessageSquare, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { postJson } from '../api'
import Stars from './Stars'

const API = import.meta.env.VITE_API_URL || ''

/** Side sheet with citizen reviews of a police station or lawyer, plus a form to add one. */
export default function Reviews({ target, type, caseCategory, onClose, onAdded }) {
  const [list, setList] = useState(null)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetch(`${API}/api/reviews/${type}/${encodeURIComponent(target.id)}`).then((r) => r.json()).then(setList).catch(() => setList([]))
  }, [target.id, type])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const r = await postJson('/reviews', { target_type: type, target_id: target.id, rating, text, case_category: caseCategory || '' })
      setList((l) => [r, ...(l || [])]); setText(''); setRating(0)
      setMsg({ ok: true, text: 'Thank you. Your review is published.' })
      onAdded?.()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/40" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()} aria-label={`Reviews of ${target.name}`}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{type === 'police' ? 'Police station' : 'Legal help'}</p>
            <h2 className="text-lg font-bold text-slate-900">{target.name}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Stars value={target.rating} /> {target.rating ? `${target.rating} · ${target.review_count} review(s)` : 'No reviews yet'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close"><X /></button>
        </header>

        <form onSubmit={submit} className="border-b border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-800">Share your experience</p>
          <div className="mt-2"><Stars value={rating} onChange={setRating} size={24} /></div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1500}
            placeholder={type === 'police' ? 'Did they register your complaint? Were they respectful and quick?' : 'Were they helpful, clear about fees, and responsive?'}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-brand-600" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={14} /> Checked by our Moderation Agent. No names or phone numbers.</p>
            <button disabled={busy || !rating || text.trim().length < 10} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
              {busy && <Loader2 size={14} className="animate-spin" />} Post
            </button>
          </div>
          {msg && <p className={`mt-2 rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
        </form>

        <div className="flex-1 overflow-y-auto p-5">
          {list === null ? <Loader2 className="mx-auto animate-spin text-slate-400" /> : list.length === 0 ? (
            <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-slate-500"><MessageSquare /> Be the first to review. Your experience helps the next person.</p>
          ) : (
            <ul className="space-y-4">
              {list.map((r) => (
                <li key={r.id} className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between"><Stars value={r.rating} size={14} /><span className="text-xs text-slate-400">{r.created_at.slice(0, 10)}</span></div>
                  <p className="mt-1 text-sm text-slate-700">{r.text}</p>
                  {r.case_category && <p className="mt-1 text-xs text-slate-400">Case type: {r.case_category.replaceAll('_', ' ')}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
