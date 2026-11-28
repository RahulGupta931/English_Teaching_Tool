"""Plivo Koyal text-to-speech (Batch HTTP API). Azure stays as the fallback in azure_speech.speak."""

import base64
import logging
import os
import re

import httpx

log = logging.getLogger("uvicorn.error")
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
# Female voices, like the Azure defaults; GET /v1/Account/{id}/TTS/Voices/ lists the rest.
VOICE = "3gVUACYdS3ibtu8qPruB"  # Prerna, en-IN
VOICE_HINDI = "6uWzc4xFj31t4jNJUaED"  # Meera, hi
MP3 = {"container": "mp3", "encoding": "mp3", "sample_rate": 24000}  # the apps play base64 MP3


async def speak(client: httpx.AsyncClient, text: str) -> str | None:
    """Base64 MP3, or None (logged) so the caller can fall back to Azure."""
    auth_id, token = os.environ.get("PLIVO_AUTH_ID"), os.environ.get("PLIVO_AUTH_TOKEN")
    if not auth_id or not token:
        log.warning("Plivo TTS: PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN not set; using Azure.")
        return None
    voice = os.environ.get("PLIVO_TTS_VOICE_HINDI", VOICE_HINDI) if DEVANAGARI.search(text) \
        else os.environ.get("PLIVO_TTS_VOICE", VOICE)
    body = {"text": text, "model_id": "koyal-v1", "voice_id": voice, "language": "auto", "output_format": MP3}
    try:
        # Short timeout: a slow Plivo call still leaves time for the Azure fallback.
        r = await client.post(f"https://api.plivo.com/v1/Account/{auth_id}/TTS/", json=body, auth=(auth_id, token), timeout=10)
    except httpx.HTTPError as e:
        log.error("Plivo TTS failed (%s); using Azure.", type(e).__name__)
        return None
    if r.status_code != 200:
        log.error("Plivo TTS failed (%s %s); using Azure.", r.status_code, r.text[:200])
        return None
    return base64.b64encode(r.content).decode()
