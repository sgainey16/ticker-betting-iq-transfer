"""ElevenLabs voice service for The Ticker.

Pre-picked voice IDs are ElevenLabs' pre-made library voices chosen to match
each analyst's personality. Audio is cached on disk as mp3 (keyed by hash of
analyst_id + text) so the same line is generated exactly once, ever.
"""
import os
import hashlib
import logging
from pathlib import Path
from typing import Optional

from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings

logger = logging.getLogger("ticker.voice")

# ElevenLabs pre-made voice IDs picked per analyst.
# Mapping — analyst_id → (voice_id, VoiceSettings)
ANALYST_VOICES = {
    # Doyle — mid-40s Boston Irish-American anchor. "Adam" = deep, mature,
    # authoritative American male.
    "doyle": {
        "voice_id": "pNInz6obpgDQGcFmaJgB",  # Adam
        "settings": {"stability": 0.55, "similarity_boost": 0.75, "style": 0.15, "use_speaker_boost": True},
    },
    # Lindqvist — late-20s Minnesota analytics kid. "Josh" = younger clear
    # American male, animated but crisp.
    "lindqvist": {
        "voice_id": "TxGEqnHWrfWFTfGW9XjX",  # Josh
        "settings": {"stability": 0.45, "similarity_boost": 0.75, "style": 0.30, "use_speaker_boost": True},
    },
    # Kovalenko — late-40s/50s Ukrainian-American enforcer. "Clyde" = deep
    # gravelly older male.
    "kovalenko": {
        "voice_id": "2EiwWnXFnvU5JabPnv8n",  # Clyde
        "settings": {"stability": 0.7, "similarity_boost": 0.8, "style": 0.10, "use_speaker_boost": True},
    },
    # Marchetti — early-30s Italian-American wildcard. "Charlie" = younger,
    # energetic, expressive.
    "marchetti": {
        "voice_id": "IKne3meq5aSn9XLyUdCD",  # Charlie
        "settings": {"stability": 0.35, "similarity_boost": 0.75, "style": 0.45, "use_speaker_boost": True},
    },
}

MODEL_ID = "eleven_turbo_v2_5"  # fast, high quality, low latency

_client: Optional[ElevenLabs] = None
_audio_dir = Path(__file__).parent / "static" / "audio"
_audio_dir.mkdir(parents=True, exist_ok=True)


def _get_client() -> Optional[ElevenLabs]:
    global _client
    if _client is not None:
        return _client
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        logger.warning("ELEVENLABS_API_KEY not set — voice generation disabled")
        return None
    _client = ElevenLabs(api_key=key)
    return _client


def _cache_key(analyst_id: str, text: str) -> str:
    h = hashlib.sha1(f"{analyst_id}|{text}".encode("utf-8")).hexdigest()[:20]
    return f"{analyst_id}_{h}.mp3"


def audio_url_for(analyst_id: str, text: str) -> str:
    """Return the public URL the frontend should hit for this line."""
    return f"/api/audio/{_cache_key(analyst_id, text)}"


def ensure_audio(analyst_id: str, text: str) -> Optional[str]:
    """Generate + cache the audio file if it doesn't exist. Returns the public URL,
    or None if generation failed."""
    if analyst_id not in ANALYST_VOICES:
        return None
    filename = _cache_key(analyst_id, text)
    path = _audio_dir / filename
    if path.exists() and path.stat().st_size > 0:
        return f"/api/audio/{filename}"

    client = _get_client()
    if client is None:
        return None

    voice = ANALYST_VOICES[analyst_id]
    try:
        audio_stream = client.text_to_speech.convert(
            voice_id=voice["voice_id"],
            text=text,
            model_id=MODEL_ID,
            voice_settings=VoiceSettings(**voice["settings"]),
            output_format="mp3_44100_128",
        )
        buf = b""
        for chunk in audio_stream:
            if chunk:
                buf += chunk
        if not buf:
            logger.warning("ElevenLabs returned empty audio for %s", analyst_id)
            return None
        # Write atomically.
        tmp = path.with_suffix(".mp3.tmp")
        tmp.write_bytes(buf)
        tmp.replace(path)
        return f"/api/audio/{filename}"
    except Exception as e:
        logger.exception("TTS generation failed for %s: %s", analyst_id, e)
        return None
