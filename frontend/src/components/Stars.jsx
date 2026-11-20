import { Star } from 'lucide-react'

/** Shows a rating (read-only) or lets the user pick one (when onChange is given). */
export default function Stars({ value = 0, onChange, size = 16 }) {
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : 'img'}
      aria-label={onChange ? 'Choose a rating' : `${value || 0} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value || 0)
        const icon = <Star size={size} className={filled ? 'fill-saffron text-saffron' : 'text-slate-300'} />
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)} className="p-0.5">{icon}</button>
        ) : <span key={n}>{icon}</span>
      })}
    </span>
  )
}
