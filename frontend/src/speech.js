// Voice input/output using the browser's built-in Web Speech API (works best in Chrome/Edge).
import { useEffect, useRef, useState } from 'react'

export const LANGUAGES = [
  { code: 'kn-IN', label: 'ಕನ್ನಡ', name: 'Kannada' },
  { code: 'hi-IN', label: 'हिन्दी', name: 'Hindi' },
  { code: 'en-IN', label: 'English', name: 'English' },
]

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const voiceSupported = Boolean(Recognition)

/** Hook: start/stop speech recognition; calls onText with each finished sentence. */
export function useVoiceInput(lang, onText) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const onTextRef = useRef(onText)
  useEffect(() => { onTextRef.current = onText }, [onText])

  function start() {
    if (!Recognition) return
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
    rec.onerror = () => setListening(false)
    rec.start()
    recRef.current = rec
    setListening(true)
  }

  function stop() {
    recRef.current?.stop()
    setListening(false)
  }

  useEffect(() => () => recRef.current?.abort(), [])
  return { listening, start, stop }
}

/** Read text aloud in the chosen language, if the device has such a voice. */
export function speak(text, langCode) {
  if (!window.speechSynthesis) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = langCode
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === langCode)
  if (voice) u.voice = voice
  u.rate = 0.95
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel()
}

export function langCodeFor(detectedLanguage = '') {
  const l = detectedLanguage.toLowerCase()
  if (l.includes('kannada')) return 'kn-IN'
  if (l.includes('hindi')) return 'hi-IN'
  return 'en-IN'
}
