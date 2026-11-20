// Tiny hash router: #/path?key=value. Works on any static host without server config.
import { useEffect, useState } from 'react'

function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, query = ''] = raw.split('?')
  return { path, params: Object.fromEntries(new URLSearchParams(query)) }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => { setRoute(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
  window.location.hash = path + (q ? `?${q}` : '')
}
