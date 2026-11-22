import { ChevronDown, EyeOff, FileAudio, ImageIcon, Languages, Mic, Send, Square, Upload, User, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { LANGUAGES, useVoiceInput, voiceSupported } from '../speech'

const EXAMPLES = [
  'ಟೆಲಿಗ್ರಾಮ್‌ನಲ್ಲಿ ಪಾರ್ಟ್-ಟೈಮ್ ಕೆಲಸ ಕೊಡುತ್ತೇವೆ ಎಂದು ಹೇಳಿ, ಟಾಸ್ಕ್‌ಗಳ ಹೆಸರಿನಲ್ಲಿ ನನ್ನಿಂದ UPI ಮೂಲಕ 45,000 ರೂಪಾಯಿ ಕಟ್ಟಿಸಿಕೊಂಡು ಈಗ ಉತ್ತರಿಸುತ್ತಿಲ್ಲ.',
  'யாரோ என் இன்ஸ்டாகிராம் கணக்கை ஹேக் செய்து, என் பெயரில் என் நண்பர்களுக்கு ஆபாசமான செய்திகளை அனுப்புகிறார்கள்.',
  'मेरे पति और सास दहेज के लिए रोज़ मारते-पीटते हैं और घर से निकालने की धमकी देते हैं।',
  'I got a video call from someone in police uniform saying I am under "digital arrest" and I paid Rs 1.2 lakh to their account.',
]

export const EMPTY_PERSON = { name: '', address: '', phone: '', email: '', police_station: '', district: '' }

export default function ComplaintForm({ onSubmit, busy }) {
  const [text, setText] = useState('')
  const [lang, setLang] = useState('kn-IN')
  const [files, setFiles] = useState([])
  const [person, setPerson] = useState(EMPTY_PERSON)
  const [showPerson, setShowPerson] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const fileInput = useRef(null)
  const voice = useVoiceInput(lang, (t) => setText((prev) => (prev ? `${prev} ${t}` : t)))

  function addFiles(list) {
    const ok = [...list].filter((f) => /^(image|audio)\//.test(f.type) && f.size <= 10 * 1024 * 1024)
    setFiles((prev) => [...prev, ...ok].slice(0, 6))
  }

  function submit(e) {
    e.preventDefault()
    if (voice.listening) voice.stop()
    onSubmit({ text: text.trim(), files, person, anonymous, language: LANGUAGES.find((l) => l.code === lang).name })
  }

  const canSubmit = text.trim().length >= 10 && !busy

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Tell us what happened</h2>
        <label className="flex items-center gap-2 text-sm">
          <Languages size={18} className="text-brand-700" />
          <span className="sr-only">Your language</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 outline-none focus:border-brand-600">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}{l.label !== l.name ? ` · ${l.name}` : ''}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1 text-sm text-slate-500">Speak or type in 12 Indian languages. We answer in the language you choose, and can read it aloud.</p>

      <div className="relative mt-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
          placeholder="Example: Someone is sending me threatening messages and asking for money..."
          className="w-full resize-y rounded-xl border border-slate-300 p-4 pr-16 text-base leading-relaxed outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100" />
        {voiceSupported && (
          <button type="button" onClick={voice.listening ? voice.stop : voice.start}
            title={voice.listening ? 'Stop recording' : 'Speak your complaint'}
            className={`absolute right-3 top-3 grid size-11 place-items-center rounded-full text-white transition ${voice.listening ? 'recording bg-red-500' : 'bg-brand-700 hover:bg-brand-600'}`}>
            {voice.listening ? <Square size={18} fill="white" /> : <Mic size={20} />}
          </button>
        )}
      </div>
      {voice.listening && <p className="mt-1 text-sm font-medium text-red-600">Listening... speak now</p>}
      {voice.error && <p className="mt-1 text-sm text-amber-700">{voice.error}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="text-xs text-slate-400">Try:</span>
        {EXAMPLES.map((ex, i) => (
          <button key={i} type="button" onClick={() => setText(ex)}
            className="max-w-full truncate rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700 sm:max-w-64">
            {ex}
          </button>
        ))}
      </div>

      {/* Evidence upload */}
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        onClick={() => fileInput.current.click()}
        className="mt-5 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-4 text-center transition hover:border-brand-600 hover:bg-brand-50">
        <Upload className="mx-auto text-slate-400" size={22} />
        <p className="mt-1 text-sm font-medium text-slate-700">Add evidence (optional)</p>
        <p className="text-xs text-slate-500">Screenshots, photos or call recordings, up to 6 files, 10 MB each</p>
        <input ref={fileInput} type="file" multiple accept="image/*,audio/*" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-100 py-1 pl-2 pr-1 text-sm">
              {f.type.startsWith('image') ? <ImageIcon size={15} /> : <FileAudio size={15} />}
              <span className="max-w-40 truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-slate-200" aria-label={`Remove ${f.name}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Public or anonymous complaint */}
      <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Complaint type">
        {[[false, User, 'Public complaint', 'Filed in your name'], [true, EyeOff, 'Anonymous', 'Your identity stays hidden']].map(([val, Icon, title, sub]) => (
          <button key={title} type="button" role="radio" aria-checked={anonymous === val} onClick={() => setAnonymous(val)}
            className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${anonymous === val ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <Icon size={20} className={anonymous === val ? 'text-brand-700' : 'text-slate-400'} />
            <span><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{sub}</span></span>
          </button>
        ))}
      </div>

      {/* Complainant details for the drafted complaint */}
      <button type="button" onClick={() => setShowPerson(!showPerson)} className="mt-5 flex items-center gap-1 text-sm font-semibold text-brand-700">
        <ChevronDown size={16} className={`transition ${showPerson ? 'rotate-180' : ''}`} />
        {anonymous ? 'Your district (needed even for anonymous complaints)' : 'Your details for the complaint (name, phone, address)'}
      </button>
      {showPerson && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[['name', 'Full name'], ['phone', 'Phone'], ['address', 'Address'], ['email', 'Email'], ['police_station', 'Nearest police station'], ['district', 'District']].filter(([k]) => !anonymous || ['police_station', 'district'].includes(k)).map(([k, label]) => (
            <label key={k} className="text-sm">
              <span className="text-slate-600">{label}</span>
              <input value={person[k]} onChange={(e) => setPerson({ ...person, [k]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-600" />
            </label>
          ))}
        </div>
      )}

      <button type="submit" disabled={!canSubmit}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-slate-300">
        <Send size={18} /> {busy ? 'Agents are working...' : 'Get legal help'}
      </button>
    </form>
  )
}
