"""Azure Speech text-to-speech via REST (no SDK, works on any Python version)."""

import asyncio
import base64
import os
import re
from xml.sax.saxutils import escape, quoteattr

import httpx

from app import hinglish, plivo_tts
from app.errors import ProviderUnavailable

DEVANAGARI = re.compile(r"[ऀ-ॿ]")  # Hindi (and Marathi, Nepali) script
_cache: dict[str, str] = {}
MAX_CACHED = 200
_http: tuple[asyncio.AbstractEventLoop, httpx.AsyncClient] | None = None


def _client() -> httpx.AsyncClient:
    """One shared connection pool, so each reply skips a fresh connection and TLS handshake to Azure."""
    global _http
    loop = asyncio.get_running_loop()
    if _http is None or _http[0] is not loop:
        _http = (loop, httpx.AsyncClient(timeout=30))
    return _http[1]


def _credentials() -> tuple[str, str]:
    key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")
    if not key or not region:
        raise ProviderUnavailable("Speech is not configured (set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION).")
    return key, region


def ssml(text: str) -> str:
    # HD voices ("name:DragonHD...") ignore <prosody>; standard voices take AZURE_TTS_RATE (e.g. "+10%").
    voice = os.environ.get("AZURE_TTS_VOICE", "en-IN-AartiNeural")
    lang = "en-IN"
    # Standard English voices can't read Hindi script (they return silence), so text with Devanagari goes to a
    # Hindi voice, which also reads the English words in it. HD voices are multilingual and handle both.
    if DEVANAGARI.search(text) and ":DragonHD" not in voice:
        voice, lang = os.environ.get("AZURE_TTS_VOICE_HINDI", "hi-IN-SwaraNeural"), "hi-IN"
    rate = os.environ.get("AZURE_TTS_RATE", "")
    body = escape(text)
    if rate and ":DragonHD" not in voice:
        body = f"<prosody rate={quoteattr(rate)}>{body}</prosody>"
    return (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang={quoteattr(lang)}>"
            f"<voice name={quoteattr(voice)}>{body}</voice></speak>")


async def speak(text: str) -> str | None:
    """Text-to-speech; returns base64 MP3, or None so callers can still show the text if TTS fails.

    TTS_PROVIDER=plivo (default) tries Plivo Koyal first and falls back to Azure if it fails; azure skips Plivo.
    """
    text = await hinglish.for_speech(text)  # Roman Hindi words in Hindi script, so both voices pronounce them as Hindi
    if os.environ.get("TTS_PROVIDER", "plivo").strip().lower() == "plivo":
        audio = await plivo_tts.speak(_client(), text)
        if audio:
            return audio
    try:
        key, region = _credentials()
    except ProviderUnavailable:
        return None
    headers = {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",  # half the download; plenty for speech
        "User-Agent": "english-learning-app",
    }
    try:
        response = await _client().post(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
                                        headers=headers, content=ssml(text).encode())
    except httpx.HTTPError:
        return None
    return base64.b64encode(response.content).decode() if response.status_code == 200 else None


async def speak_for(user: dict, text: str, shared: bool = False) -> str | None:
    """Audio for this user, or None: free users hear the browser's built-in voice instead (no cost).

    `shared` marks text many users hear (Daily Word, fixed replies): it is generated once and reused.
    """
    if not user["plan"]["azure_voice"]:
        return None
    if not shared:
        return await speak(text)
    if text not in _cache:
        audio = await speak(text)
        if audio is None:
            return None  # don't cache failures
        if len(_cache) >= MAX_CACHED:
            _cache.clear()
        _cache[text] = audio
    return _cache[text]
