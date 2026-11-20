import { Baby, Brain, Gavel, HeartHandshake, MapPin, Phone, ShieldAlert, ShoppingBag, Siren, Smartphone, UserRound } from 'lucide-react'
import { navigate } from '../router'

const GROUPS = [
  {
    title: 'Emergency', color: 'bg-red-600', items: [
      { icon: Siren, name: 'Police, Ambulance, Fire (ERSS)', number: '112', note: 'Any emergency, anywhere in India, 24x7' },
    ],
  },
  {
    title: 'Women & children', color: 'bg-pink-600', items: [
      { icon: HeartHandshake, name: 'Women Helpline', number: '181', note: 'Violence, harassment, domestic abuse: counselling and rescue' },
      { icon: ShieldAlert, name: 'Women Police Helpline', number: '1091', note: 'Direct line to police for women in distress' },
      { icon: Smartphone, name: 'National Commission for Women (WhatsApp)', number: '7827170170', note: 'Domestic violence complaints' },
      { icon: Baby, name: 'Childline', number: '1098', note: 'Any child in danger or being abused' },
    ],
  },
  {
    title: 'Cyber crime & fraud', color: 'bg-brand-700', items: [
      { icon: Smartphone, name: 'Cyber Crime Helpline', number: '1930', note: 'Call within the first hour of online money fraud: banks can freeze the money', link: 'https://cybercrime.gov.in' },
    ],
  },
  {
    title: 'Legal help', color: 'bg-emerald-700', items: [
      { icon: Gavel, name: 'Free Legal Aid (NALSA / DLSA)', number: '15100', note: 'Free lawyer for women, children, SC/ST, workers and low-income families' },
      { icon: ShoppingBag, name: 'National Consumer Helpline', number: '1915', note: 'Cheated by a shop, company or online seller' },
    ],
  },
  {
    title: 'Support', color: 'bg-violet-700', items: [
      { icon: UserRound, name: 'Elder Line (Senior citizens)', number: '14567', note: 'Abuse, neglect or legal help for elders' },
      { icon: Brain, name: 'Tele-MANAS (Mental health)', number: '14416', note: 'Free, confidential counselling in Kannada and other languages' },
    ],
  },
]

export default function Helplines() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Helplines</h1>
      <p className="mt-1 max-w-2xl text-slate-600">Free, government-run and available 24x7. Tap a number to call. These work even without internet.</p>

      <div className="mt-6 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{g.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((h) => (
                <a key={h.number} href={`tel:${h.number}`} className="group flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-white ${g.color}`}><h.icon size={22} /></span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">{h.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-2xl font-extrabold tracking-wide text-brand-700"><Phone size={18} />{h.number}</span>
                    <span className="mt-1 block text-xs text-slate-500">{h.note}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 grid gap-4 rounded-2xl bg-brand-900 p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="text-xl font-bold">Want to go to a police station in person?</h2>
          <p className="mt-1 text-brand-100">See the nearest stations on a map, with directions and ratings from other citizens.</p>
        </div>
        <button onClick={() => navigate('/nearby')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-saffron px-5 py-3 font-bold text-white">
          <MapPin size={18} /> Find police stations
        </button>
      </section>
    </div>
  )
}
