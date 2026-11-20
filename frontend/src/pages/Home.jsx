import { ArrowRight, Bot, ExternalLink, FileSearch, FileText, Gavel, MapPin, Newspaper, Phone, Radar, Scale, ShieldCheck, Siren, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { navigate } from '../router'

const API = import.meta.env.VITE_API_URL || ''
const WORDS = ['Harassment?', 'Online fraud?', 'Threats?', 'Domestic violence?', 'Stalking?', 'ಕಿರುಕುಳ?', 'धोखाधड़ी?']

// Official figures: National Crime Records Bureau, "Crime in India 2022" report.
const NCRB = [
  { value: 445256, label: 'Crimes against women registered in India', sub: 'NCRB 2022' },
  { value: 65893, label: 'Cyber crime cases in India, up 24.4% in a year', sub: 'NCRB 2022' },
  { value: 12556, label: 'Cyber crime cases in Karnataka alone', sub: 'NCRB 2022' },
]

const AGENTS = [
  { icon: FileSearch, name: 'Evidence Agent', text: 'Reads screenshots and call recordings, builds a timeline with tamper-proof fingerprints.' },
  { icon: Scale, name: 'Legal Analysis Agent', text: 'Understands Kannada, Hindi and English and finds the exact laws, only from a verified legal database.' },
  { icon: FileText, name: 'Drafting Agent', text: 'Writes your FIR complaint, SP letter or Magistrate application as a ready-to-sign PDF.' },
  { icon: Bot, name: 'Filing Agent', text: 'Opens the complaint portal in a browser, fills every page and brings back your acknowledgement number.' },
  { icon: Radar, name: 'Tracking Agent', text: 'Watches your complaint. If police do not act within the legal time, it escalates for you.' },
  { icon: ShieldCheck, name: 'Moderation Agent', text: 'Keeps police and lawyer reviews honest, free of abuse and personal details.' },
]

function CountUp({ to, duration = 1600 }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    let raf
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      obs.disconnect()
      const start = performance.now()
      const tick = (t) => { const p = Math.min((t - start) / duration, 1); setN(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(tick) }
      raf = requestAnimationFrame(tick)
    })
    if (ref.current) obs.observe(ref.current)
    return () => { obs.disconnect(); cancelAnimationFrame(raf) }
  }, [to, duration])
  return <span ref={ref}>{n.toLocaleString('en-IN')}</span>
}

function timeAgo(iso) {
  if (!iso) return ''
  const h = Math.round((Date.now() - new Date(iso)) / 3.6e6)
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

function HeroScene() {
  const chips = [
    { text: 'BNS Section 78: Stalking', cls: 'left-0 top-6', delay: '0s' },
    { text: '✓ FIR filed: KA-MYS-…', cls: 'right-0 top-16', delay: '1.2s' },
    { text: 'ಕನ್ನಡ · हिन्दी · English', cls: 'left-4 bottom-10', delay: '2.1s' },
    { text: 'Cyber helpline 1930', cls: 'right-2 bottom-4', delay: '.6s' },
  ]
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm" aria-hidden="true">
      <div className="absolute inset-[18%]">
        {[0, 1, 2].map((i) => <span key={i} className="radar-ring" style={{ animationDelay: `${i}s` }} />)}
      </div>
      <div className="absolute inset-[26%] grid place-items-center overflow-hidden rounded-[2rem] bg-white/10 ring-1 ring-white/20 backdrop-blur">
        <ShieldCheck size={96} strokeWidth={1.4} className="text-saffron drop-shadow-[0_0_25px_rgba(245,158,11,.6)]" />
        <span className="scan-line" />
      </div>
      {chips.map((c) => (
        <span key={c.text} className={`float-chip absolute rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-900 shadow-lg ${c.cls}`} style={{ animationDelay: c.delay }}>
          {c.text}
        </span>
      ))}
    </div>
  )
}

export default function Home() {
  const [word, setWord] = useState(0)
  const [news, setNews] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2500)
    fetch(`${API}/api/news`).then((r) => r.json()).then(setNews).catch(() => setNews([]))
    fetch(`${API}/api/stats`).then((r) => r.json()).then(setStats).catch(() => {})
    return () => clearInterval(t)
  }, [])

  const OPTIONS = [
    { icon: Phone, title: 'Emergency helplines', text: 'Women, cyber, child and legal aid numbers. One tap to call, works offline.', to: '/helplines', cls: 'from-red-500 to-rose-600' },
    { icon: Sparkles, title: 'File a complaint with AI', text: 'Speak your problem. Get the laws, a drafted FIR, and let our agent file it.', to: '/complaint', cls: 'from-brand-600 to-brand-900' },
    { icon: MapPin, title: 'Police & lawyers near you', text: 'Map of nearby stations and lawyers matched to your case, with citizen ratings.', to: '/nearby', cls: 'from-emerald-500 to-emerald-700' },
    { icon: Radar, title: 'Track your complaint', text: 'Check status. If police ignore it, we draft the escalation letter.', to: '/track', cls: 'from-amber-500 to-orange-600' },
  ]

  return (
    <>
      {/* Animated hero */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="hero-grid" />
        <span className="hero-blob left-[-6rem] top-[-6rem] size-80 bg-brand-600" />
        <span className="hero-blob right-[-4rem] top-1/3 size-72 bg-saffron" style={{ animationDelay: '-5s' }} />
        <span className="hero-blob bottom-[-8rem] left-1/3 size-96 bg-violet-600" style={{ animationDelay: '-9s' }} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
          <div className="rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
              <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> 6 AI agents · Kannada · हिन्दी · English
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-6xl">
              Facing <span key={word} className="word-cycle inline-block text-saffron">{WORDS[word]}</span>
              <br />You are not alone.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">
              Praja Raksha is your AI legal shield. Tell us what happened in your own language. Our agents find the laws
              that protect you, write your complaint, file it, and follow up until the police act.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate('/complaint')} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-6 py-3.5 font-bold text-white shadow-lg shadow-amber-500/30 transition hover:brightness-110">
                File a complaint <ArrowRight size={18} />
              </button>
              <a href="tel:112" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3.5 font-bold ring-1 ring-white/30 hover:bg-white/20">
                <Siren size={18} /> Emergency 112
              </a>
            </div>
          </div>
          <HeroScene />
        </div>

        {/* Live news ticker */}
        {news?.length > 0 && (
          <div className="relative flex items-center border-t border-white/10 bg-black/20 text-sm">
            <span className="z-10 flex shrink-0 items-center gap-1.5 bg-red-600 px-4 py-2.5 font-bold"><span className="size-2 animate-pulse rounded-full bg-white" />LIVE</span>
            <div className="overflow-hidden">
              <div className="ticker-track flex w-max gap-10 whitespace-nowrap px-4">
                {[...news, ...news].map((n, i) => (
                  <a key={i} href={n.link} target="_blank" rel="noreferrer" className="text-brand-100 hover:text-white">
                    <span className="font-semibold text-saffron">{n.source}</span> · {n.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Options */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold text-slate-900">How can we help you today?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OPTIONS.map((o, i) => (
            <button key={o.to} onClick={() => navigate(o.to)} style={{ animationDelay: `${i * 0.08}s` }}
              className="rise group flex flex-col rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg">
              <span className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br text-white ${o.cls}`}><o.icon size={22} /></span>
              <span className="mt-4 font-bold text-slate-900">{o.title}</span>
              <span className="mt-1 flex-1 text-sm text-slate-600">{o.text}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Open <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
            </button>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold text-slate-900">Why this matters</h2>
          <p className="mt-1 text-slate-600">Most victims never complain: they do not know the law, fear the police station, or give up when nothing happens.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {NCRB.map((s) => (
              <div key={s.label} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <p className="text-3xl font-extrabold text-brand-700 sm:text-4xl"><CountUp to={s.value} /></p>
                <p className="mt-1 text-sm text-slate-700">{s.label}</p>
                <p className="mt-1 text-xs text-slate-400">Source: {s.sub}, Crime in India report</p>
              </div>
            ))}
          </div>
          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-brand-900 p-5 text-white sm:grid-cols-4">
              {[[stats.complaints_filed, 'Complaints filed by our agent'], [stats.anonymous, 'Filed anonymously'],
                [stats.escalations, 'Escalation letters auto-drafted'], [stats.reviews, 'Citizen reviews']].map(([v, l]) => (
                <div key={l}><p className="text-3xl font-extrabold text-saffron"><CountUp to={v} duration={900} /></p><p className="text-xs text-brand-100">{l}</p></div>
              ))}
              <p className="col-span-full text-xs text-brand-100/70">Live numbers from Praja Raksha (prototype)</p>
            </div>
          )}
        </div>
      </section>

      {/* Agents */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-extrabold text-slate-900">Six AI agents work for you</h2>
        <p className="mt-1 text-slate-600">Not a chatbot. Each agent does a real job, from reading evidence to filing and following up.</p>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((a, i) => (
            <li key={a.name} className="relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <span className="absolute right-4 top-4 text-4xl font-extrabold text-slate-100">{i + 1}</span>
              <a.icon className="text-brand-700" size={26} />
              <p className="mt-3 font-bold text-slate-900">{a.name}</p>
              <p className="mt-1 text-sm text-slate-600">{a.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* News */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900"><Newspaper className="text-brand-700" /> Latest crime & safety news</h2>
          <p className="mt-1 text-slate-600">From Karnataka, updated automatically.</p>
          {news === null ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          ) : news.length === 0 ? (
            <p className="mt-6 text-slate-500">News is unavailable right now.</p>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {news.map((n) => (
                <li key={n.link}>
                  <a href={n.link} target="_blank" rel="noreferrer" className="group block h-full rounded-2xl p-4 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-brand-600">
                    <p className="text-xs font-semibold text-brand-600">{n.source} · {timeAgo(n.published)}</p>
                    <p className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700">{n.title}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">Read on {n.source} <ExternalLink size={12} /></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-8 text-white sm:flex-row sm:items-center">
          <Gavel size={40} className="text-saffron" />
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold">Know your rights. Use them.</h2>
            <p className="mt-1 text-brand-100">It takes 2 minutes to understand what the law says about your problem.</p>
          </div>
          <button onClick={() => navigate('/complaint')} className="rounded-xl bg-saffron px-6 py-3 font-bold">Start now</button>
        </div>
      </section>
    </>
  )
}
