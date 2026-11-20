"""Voice-over: neural text-to-speech for Indian languages.

Prototype note: uses the `edge-tts` library (Microsoft Edge "Read aloud" voices, an unofficial endpoint).
A production launch would use an official service such as Bhashini (Govt. of India) or Google Cloud TTS.
The browser's own voices are used as a fallback in the frontend.
"""
import asyncio
import hashlib
from collections import OrderedDict

import edge_tts

VOICES = {
    "en-IN": "en-IN-NeerjaNeural", "hi-IN": "hi-IN-SwaraNeural", "kn-IN": "kn-IN-SapnaNeural",
    "ta-IN": "ta-IN-PallaviNeural", "te-IN": "te-IN-ShrutiNeural", "ml-IN": "ml-IN-SobhanaNeural",
    "mr-IN": "mr-IN-AarohiNeural", "bn-IN": "bn-IN-TanishaaNeural", "gu-IN": "gu-IN-DhwaniNeural",
    "ur-IN": "ur-IN-GulNeural",
}
MAX_CHARS = 3000
_cache: "OrderedDict[str, bytes]" = OrderedDict()  # small in-memory cache of recent audio


async def _speak(text: str, voice: str) -> bytes:
    audio = b""
    async for chunk in edge_tts.Communicate(text, voice, rate="-5%").stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return audio


def synthesize(text: str, lang: str) -> bytes | None:
    """MP3 bytes for the text, or None if we have no voice for this language."""
    voice = VOICES.get(lang)
    if not voice:
        return None
    text = text.strip()[:MAX_CHARS]
    key = hashlib.sha256(f"{voice}|{text}".encode()).hexdigest()
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    audio = asyncio.run(_speak(text, voice))
    _cache[key] = audio
    if len(_cache) > 50:
        _cache.popitem(last=False)
    return audio
