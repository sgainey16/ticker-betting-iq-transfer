"""ElevenLabs voice service for The Ticker.

Pre-picked voice IDs are ElevenLabs' pre-made library voices chosen to match
each analyst's personality. Audio is cached on disk as mp3 (keyed by hash of
analyst_id + text) so the same line is generated exactly once, ever.
"""
import os
import json
import hashlib
import logging
import shutil
import subprocess
from datetime import datetime, timezone
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
        "settings": {"stability": 0.35, "similarity_boost": 0.78, "style": 0.45, "use_speaker_boost": True, "speed": 1.14},
    },
    # Marc — 60, analytics co-host. Calm, measured, warm. Placeholder is a
    # mature US male voice ("Bill" from the pre-made ElevenLabs library).
    "marc": {
        "voice_id": "pqHfZKP75CvOlQylNhV4",  # Bill — mature, warm
        "settings": {"stability": 0.55, "similarity_boost": 0.78, "style": 0.25, "use_speaker_boost": True, "speed": 1.08},
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


# ---------------------------------------------------------------------------
# Daily character-budget alarm.
#
# ElevenLabs charges per character. If a bug loops a generation call, or a
# cache-clear + regeneration burst runs against tens of thousands of lines,
# credits vanish in minutes (this has happened). We track daily character
# usage in a small JSON file and hard-refuse to hit the API once we cross
# the per-day cap. Set ELEVENLABS_DAILY_CHAR_LIMIT in .env to raise/lower;
# default is 20,000 chars/day (about a full show's worth of new script).
# ---------------------------------------------------------------------------

_budget_path = _audio_dir / "elevenlabs_daily_budget.json"
_DEFAULT_DAILY_LIMIT = 20_000


def _daily_limit() -> int:
    try:
        return int(os.environ.get("ELEVENLABS_DAILY_CHAR_LIMIT", _DEFAULT_DAILY_LIMIT))
    except (TypeError, ValueError):
        return _DEFAULT_DAILY_LIMIT


def _budget_read() -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not _budget_path.exists():
        return {"date": today, "chars": 0}
    try:
        data = json.loads(_budget_path.read_text())
        if data.get("date") != today:
            return {"date": today, "chars": 0}
        return {"date": today, "chars": int(data.get("chars", 0))}
    except Exception:
        return {"date": today, "chars": 0}


def _budget_write(state: dict) -> None:
    try:
        _budget_path.write_text(json.dumps(state))
    except Exception as e:
        logger.warning("Failed to persist ElevenLabs budget: %s", e)


def _budget_would_exceed(text: str) -> bool:
    """Return True if generating this line would push us past today's cap."""
    state = _budget_read()
    return (state["chars"] + len(text)) > _daily_limit()


def _budget_charge(text: str) -> None:
    state = _budget_read()
    state["chars"] += len(text)
    _budget_write(state)


def budget_status() -> dict:
    """Public helper so the API can surface today's TTS usage."""
    state = _budget_read()
    limit = _daily_limit()
    return {
        "date": state["date"],
        "chars_used": state["chars"],
        "limit": limit,
        "remaining": max(0, limit - state["chars"]),
        "exhausted": state["chars"] >= limit,
    }


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

    # Budget guard — refuse to hit the paid API if today's char cap is
    # already spent. Prevents runaway loops from draining credits again.
    if _budget_would_exceed(text):
        state = _budget_read()
        logger.warning(
            "ElevenLabs daily budget exhausted (%d/%d chars). Skipping %s.",
            state["chars"], _daily_limit(), analyst_id,
        )
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
        # Only charge the budget once we actually got bytes back — a failed
        # call shouldn't count against today's cap.
        _budget_charge(text)
        # Write raw ElevenLabs mp3 to a temp file, then use ffmpeg to strip
        # leading/trailing silence and any long internal gaps. This is the
        # single biggest lever for "no dead air" — ElevenLabs pads every clip
        # with ~150-400ms of quiet at both ends by default, which stacks up
        # brutally across 30+ turns.
        raw = path.with_suffix(".raw.mp3")
        raw.write_bytes(buf)
        trimmed = _trim_silence(raw, path)
        raw.unlink(missing_ok=True)
        if not trimmed:
            # Fall back to the untrimmed audio if ffmpeg failed for any reason.
            path.write_bytes(buf)
        return f"/api/audio/{filename}"
    except Exception as e:
        logger.exception("TTS generation failed for %s: %s", analyst_id, e)
        return None


def _trim_silence(src: Path, dst: Path) -> bool:
    """Strip silence from both ends of the clip so back-to-back turns have
    zero dead air. Uses ffmpeg's `silenceremove` filter twice — once at the
    start, once (via reverse) at the end. Threshold -40dB, min 80ms.
    Returns True if trimmed file was written to dst."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    try:
        result = subprocess.run(
            [
                ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(src),
                "-af",
                # 1) drop leading silence (>80ms below -40dB)
                # 2) drop trailing silence by reversing/trimming/reversing
                "silenceremove="
                "start_periods=1:start_duration=0.05:start_threshold=-40dB:"
                "stop_periods=-1:stop_duration=0.05:stop_threshold=-40dB",
                "-codec:a", "libmp3lame", "-b:a", "128k",
                str(dst),
            ],
            capture_output=True, timeout=15,
        )
        return result.returncode == 0 and dst.exists() and dst.stat().st_size > 0
    except Exception as e:
        logger.warning("ffmpeg silence-trim failed: %s", e)
        return False
