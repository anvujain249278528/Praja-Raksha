// All calls go to the FastAPI backend. In development Vite proxies /api to localhost:8000;
// in production the backend serves this app, so the same relative path works.
const API = import.meta.env.VITE_API_URL || ''

async function handle(res) {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { msg = (await res.json()).detail || msg } catch { /* not JSON */ }
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return res
}

export async function postJson(path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await handle(res)).json()
}

export async function uploadEvidence(files, context) {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('context', context)
  const res = await fetch(`${API}/api/evidence`, { method: 'POST', body: form })
  return (await handle(res)).json()
}

export async function downloadPdf(text, filename) {
  const res = await fetch(`${API}/api/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title: filename }),
  })
  const blob = await (await handle(res)).blob()
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}.pdf` })
  a.click()
  URL.revokeObjectURL(url)
}
