// Voice input (browser speech recognition) and voice-over (server neural voices, with device voices as fallback).
import { useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// Major Indian languages. `name` is sent to the AI as the answer language.
export const LANGUAGES = [
  { code: 'kn-IN', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'hi-IN', label: 'हिन्दी', name: 'Hindi' },
  { code: 'en-IN', label: 'English', name: 'English' },
  { code: 'ta-IN', label: 'தமிழ்', name: 'Tamil' },
  { code: 'te-IN', label: 'తెలుగు', name: 'Telugu' },
  { code: 'ml-IN', label: 'മലയാളം', name: 'Malayalam' },
  { code: 'mr-IN', label: 'मराठी', name: 'Marathi' },
  { code: 'bn-IN', label: 'বাংলা', name: 'Bengali' },
  { code: 'gu-IN', label: 'ગુજરાતી', name: 'Gujarati' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ', name: 'Punjabi' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ', name: 'Odia' },
  { code: 'ur-IN', label: 'اردو', name: 'Urdu' },
]

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const voiceSupported = Boolean(Recognition)

/** Hook: start/stop speech recognition; calls onText with each finished sentence. */
export function useVoiceInput(lang, onText) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText }, [onText])

  function start() {
    if (!Recognition) return
    setError('')
    const rec = new Recognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onTextRef.current(e.results[i][0].transcript.trim())
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = (e) => {
      setListening(false)
      if (e.error === 'language-not-supported') setError('Voice typing is not available for this language in your browser. Please type instead.')
      else if (e.error === 'not-allowed') setError('Microphone permission was denied.')
    }
    rec.start()
    recRef.current = rec
    setListening(true)
  }

  function stop() {
    recRef.current?.stop()
    setListening(false)
  }

  useEffect(() => () => recRef.current?.abort(), [])
  return { listening, start, stop, error }
}

let session = 0       // increases on every new speak() or stop, so old playback loops quit
let current = null    // the <audio> element playing now

/** Stop any voice-over that is playing. */
export function stopSpeaking() {
  session++
  if (current) { current.pause(); current = null }
  window.speechSynthesis?.cancel()
}

async function fetchAudio(text, langCode) {
  const r = await fetch(`${API}/api/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang: langCode }),
  })
  if (!r.ok) throw new Error(r.status === 404 ? 'no-server-voice' : 'voice-service-error')
  return URL.createObjectURL(await r.blob())
}

function playUrl(url, mySession) {
  return new Promise((resolve, reject) => {
    if (mySession !== session) return resolve()
    const audio = new Audio(url)
    current = audio
    audio.onended = resolve
    audio.onpause = resolve
    audio.onerror = reject
    audio.play().catch(reject)
  })
}

function speakWithDevice(parts, langCode, mySession) {
  const synth = window.speechSynthesis
  const voice = synth?.getVoices().find((v) => v.lang.replace('_', '-') === langCode)
  if (!synth || !voice) throw new Error('No voice for this language on this device.')
  return parts.reduce((p, text) => p.then(() => new Promise((resolve) => {
    if (mySession !== session) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    Object.assign(u, { lang: langCode, voice, rate: 0.95, onend: resolve, onerror: resolve })
    synth.speak(u)
  })), Promise.resolve())
}

/**
 * Read text aloud. `parts` is an array of sentences/paragraphs: the first one starts playing quickly while the
 * next is prepared in the background. Uses the server's neural voice, falling back to the device voice.
 * `onStart` is called when sound actually begins.
 */
export async function speak(parts, langCode, onStart = () => {}) {
  stopSpeaking()
  const mySession = session
  parts = (Array.isArray(parts) ? parts : [parts]).map((t) => t.trim()).filter(Boolean)
  let next
  try {
    next = fetchAudio(parts[0], langCode)
    await next // fail fast if the server has no voice for this language
  } catch {
    onStart()
    return speakWithDevice(parts, langCode, mySession)
  }
  for (let i = 0; i < parts.length && mySession === session; i++) {
    const url = await next
    next = i + 1 < parts.length ? fetchAudio(parts[i + 1], langCode).catch(() => null) : null
    if (i === 0) onStart()
    try { await playUrl(url, mySession) } finally { URL.revokeObjectURL(url) }
    if (next && (await next) === null) break
  }
}

export function langCodeFor(languageName = '') {
  const l = languageName.toLowerCase()
  return LANGUAGES.find((x) => l.includes(x.name.toLowerCase()))?.code || 'en-IN'
}
