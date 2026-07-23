"""Voice Picker — audition candidate ElevenLabs voices for each host.

Every candidate reads a short signature line so the user can hear the voice
in-character (Reggie's "That's a Wednesday take, Marc.", Marc's "Reggie,
breathe. In through the nose."). Previews are cached on disk exactly like
banter audio.
"""
from __future__ import annotations

import json
import logging
import hashlib
from pathlib import Path
from typing import Optional

from elevenlabs import VoiceSettings

from voice_service import _audio_dir, _get_client, ANALYST_VOICES, MODEL_ID

logger = logging.getLogger("ticker.voice_picker")

# Signature preview lines — in-character so the user can judge voice fit
# against what these guys will actually be saying on air.
PREVIEW_LINE = {
    "reggie": (
        "Alright, alright — welcome back to The Ticker. Marc, that trade last "
        "night? That's a Wednesday take, in a BAD Wednesday. And you know how "
        "I feel about Wednesdays."
    ),
    "marc": (
        "Reggie, breathe. In through the nose. The Kings played back-to-back "
        "on the road — with the numbers I'm looking at, that goal differential "
        "makes a lot more sense. Let's not throw the coach out yet."
    ),
}

# 11 confirmed-working candidates from the ElevenLabs pre-made library plus
# the user's own Voice Design draft.
CANDIDATES = {
    "reggie": [
        {
            "voice_id": "QFNlGyAI98kVm40cB3ik",
            "name": "Your Voice Design #1",
            "vibe": "Chicago blue-collar chirper — your own draft",
            "settings": {"stability": 0.35, "similarity_boost": 0.78, "style": 0.55, "use_speaker_boost": True, "speed": 1.10},
        },
        {
            "voice_id": "pNInz6obpgDQGcFmaJgB",
            "name": "Adam",
            "vibe": "Deep, warm, energetic — classic broadcast",
            "settings": {"stability": 0.35, "similarity_boost": 0.78, "style": 0.55, "use_speaker_boost": True, "speed": 1.10},
        },
        {
            "voice_id": "TxGEqnHWrfWFTfGW9XjX",
            "name": "Josh",
            "vibe": "Deep young American — athletic energy",
            "settings": {"stability": 0.30, "similarity_boost": 0.78, "style": 0.60, "use_speaker_boost": True, "speed": 1.10},
        },
        {
            "voice_id": "yoZ06aMxZJJ28mfd3POQ",
            "name": "Sam",
            "vibe": "Energetic casual — locker-room chirp",
            "settings": {"stability": 0.30, "similarity_boost": 0.75, "style": 0.65, "use_speaker_boost": True, "speed": 1.12},
        },
        {
            "voice_id": "iP95p4xoKVk53GoZ742B",
            "name": "Chris",
            "vibe": "Casual mid-range — Chicago every-guy",
            "settings": {"stability": 0.35, "similarity_boost": 0.78, "style": 0.50, "use_speaker_boost": True, "speed": 1.10},
        },
        {
            "voice_id": "nPczCjzI2devNBz1zQrb",
            "name": "Brian",
            "vibe": "Deep resonant — Wilbon-esque authority",
            "settings": {"stability": 0.40, "similarity_boost": 0.78, "style": 0.45, "use_speaker_boost": True, "speed": 1.08},
        },
    ],
    "marc": [
        {
            "voice_id": "3Mpc52HLMolH3B7bOzgW",
            "name": "Your Voice Design #1",
            "vibe": "Calming 60-year-old with dry wit — your own draft",
            "settings": {"stability": 0.55, "similarity_boost": 0.78, "style": 0.30, "use_speaker_boost": True, "speed": 1.02},
        },
        {
            "voice_id": "pqHfZKP75CvOlQylNhV4",
            "name": "Bill",
            "vibe": "Mature warm — earlier pick",
            "settings": {"stability": 0.55, "similarity_boost": 0.78, "style": 0.25, "use_speaker_boost": True, "speed": 1.02},
        },
        {
            "voice_id": "JBFqnCBsd6RMkjVDRZzb",
            "name": "George",
            "vibe": "Warm mature — Ernie Johnson vibe",
            "settings": {"stability": 0.50, "similarity_boost": 0.78, "style": 0.30, "use_speaker_boost": True, "speed": 1.05},
        },
        {
            "voice_id": "cjVigY5qzO86Huf0OWal",
            "name": "Eric",
            "vibe": "Friendly authoritative — steady moderator",
            "settings": {"stability": 0.50, "similarity_boost": 0.78, "style": 0.35, "use_speaker_boost": True, "speed": 1.05},
        },
        {
            "voice_id": "flq6f7yk4E4fJM5XTYuZ",
            "name": "Michael",
            "vibe": "Orator — measured with gravitas",
            "settings": {"stability": 0.55, "similarity_boost": 0.78, "style": 0.30, "use_speaker_boost": True, "speed": 1.02},
        },
    ],
}

_previews_dir = _audio_dir / "previews"
_previews_dir.mkdir(parents=True, exist_ok=True)


def _preview_filename(host: str, voice_id: str) -> str:
    h = hashlib.sha1(f"{host}|{voice_id}|{PREVIEW_LINE[host]}".encode("utf-8")).hexdigest()[:12]
    return f"{host}_{voice_id[:8]}_{h}.mp3"


def preview_url_for(host: str, voice_id: str) -> str:
    return f"/api/audio/previews/{_preview_filename(host, voice_id)}"


def ensure_preview(host: str, cand: dict) -> Optional[str]:
    """Generate + cache the preview audio for this candidate. Returns URL or None."""
    if host not in PREVIEW_LINE:
        return None
    filename = _preview_filename(host, cand["voice_id"])
    path = _previews_dir / filename
    if path.exists() and path.stat().st_size > 500:
        return f"/api/audio/previews/{filename}"

    client = _get_client()
    if client is None:
        return None

    try:
        stream = client.text_to_speech.convert(
            voice_id=cand["voice_id"],
            text=PREVIEW_LINE[host],
            model_id=MODEL_ID,
            voice_settings=VoiceSettings(**cand["settings"]),
            output_format="mp3_44100_128",
        )
        buf = b"".join(c for c in stream if c)
        if len(buf) < 500:
            return None
        tmp = path.with_suffix(".mp3.tmp")
        tmp.write_bytes(buf)
        tmp.replace(path)
        return f"/api/audio/previews/{filename}"
    except Exception as e:
        logger.warning("Preview generation failed for %s/%s: %s", host, cand["voice_id"], e)
        return None


def get_picker_state(pregenerate: bool = False):
    """Return the current active voice + all candidates + preview URLs."""
    result = {}
    for host, cands in CANDIDATES.items():
        active_id = ANALYST_VOICES.get(host, {}).get("voice_id")
        items = []
        for c in cands:
            preview = preview_url_for(host, c["voice_id"])
            if pregenerate:
                ensure_preview(host, c)
            items.append({
                "voice_id": c["voice_id"],
                "name": c["name"],
                "vibe": c["vibe"],
                "preview_url": preview,
                "is_active": c["voice_id"] == active_id,
            })
        result[host] = items
    return result


def set_active(host: str, voice_id: str):
    """Swap the active voice for a host + clear that host's cached banter mp3s
    so they regenerate with the new voice on the next request."""
    if host not in CANDIDATES:
        raise ValueError(f"Unknown host: {host}")
    match = next((c for c in CANDIDATES[host] if c["voice_id"] == voice_id), None)
    if not match:
        raise ValueError(f"voice_id {voice_id} is not a candidate for {host}")

    # Update in-memory config so /banter uses the new voice immediately.
    ANALYST_VOICES[host]["voice_id"] = match["voice_id"]
    ANALYST_VOICES[host]["settings"] = match["settings"]

    # Persist so it survives a backend restart.
    choices_path = _audio_dir / "voice_choices.json"
    try:
        data = json.loads(choices_path.read_text()) if choices_path.exists() else {}
    except Exception:
        data = {}
    data[host] = {"voice_id": match["voice_id"], "settings": match["settings"]}
    choices_path.write_text(json.dumps(data, indent=2))

    # Clear this host's cached banter mp3s so they regenerate with the new voice.
    cleared = 0
    for mp3 in _audio_dir.glob(f"{host}_*.mp3"):
        try:
            mp3.unlink()
            cleared += 1
        except Exception:
            pass
    logger.info("Swapped %s → %s, cleared %d cached mp3s", host, voice_id, cleared)
    return {"host": host, "voice_id": voice_id, "cleared_cache": cleared}
