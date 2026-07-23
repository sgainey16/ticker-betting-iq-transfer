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

# ElevenLabs pre-made voice IDs — re-picked to match each analyst's actual
# character history (Boston Irish-American, Minnesota Scandinavian-American,
# Ukrainian-American blue-collar, Italian-American wildcard). Lower stability
# across the board for less robotic delivery, higher style for real character.
# NOTE: pre-made voices don't have exact regional US accents; these are the
# best fits from the standard library. Full accent accuracy needs voice
# cloning (record 60s samples per analyst).
ANALYST_VOICES = {
    # Reggie Banks — lead anchor, ex-NHL. Confident US-broadcast baritone.
    # voice_id may be swapped when user picks a Voice-Design candidate in /voice-lab.
    "reggie": {
        "voice_id": "QFNlGyAI98kVm40cB3ik",  # user's Voice Design draft #1
        "settings": {"stability": 0.35, "similarity_boost": 0.78, "style": 0.45, "use_speaker_boost": True, "speed": 1.10},
    },
    # Marc — 60, analytics co-host. Calm, measured, warm. Placeholder is a
    # mature US male voice ("Bill" from the pre-made ElevenLabs library).
    "marc": {
        "voice_id": "pqHfZKP75CvOlQylNhV4",  # Bill — mature, warm
        "settings": {"stability": 0.55, "similarity_boost": 0.78, "style": 0.25, "use_speaker_boost": True, "speed": 1.02},
    },
}

MODEL_ID = "eleven_multilingual_v2"

_client: Optional[ElevenLabs] = None
_audio_dir = Path(__file__).parent / "static" / "audio"
_audio_dir.mkdir(parents=True, exist_ok=True)


def _load_saved_voice_choices():
    """On import, load any previously-selected voices from voice_choices.json
    and update ANALYST_VOICES so they persist across backend restarts."""
    choices_path = _audio_dir / "voice_choices.json"
    if not choices_path.exists():
        return
    try:
        import json
        data = json.loads(choices_path.read_text())
        for aid, cfg in data.items():
            if aid in ANALYST_VOICES and cfg.get("voice_id"):
                ANALYST_VOICES[aid]["voice_id"] = cfg["voice_id"]
                logger.info("Loaded saved voice for %s: %s", aid, cfg["voice_id"])
    except Exception as e:
        logger.warning("Failed to load voice_choices.json: %s", e)


_load_saved_voice_choices()


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
