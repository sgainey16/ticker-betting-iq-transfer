"""Generate ElevenLabs Voice Design previews for all 4 analysts.

Runs the text_to_voice.design API for each character, saves 3 mp3 previews
per character to /app/backend/static/audio/previews/, and prints the URLs +
generated_voice_ids so we can promote the chosen previews later.
"""
import os
import base64
import json
from pathlib import Path
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv(Path(__file__).parent / ".env")

client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

BRIEFS = {
    "doyle": {
        "voice_name": "Doyle",
        "description": (
            "American male, early-to-mid 40s, thick working-class Boston accent. "
            "Gravelly, slightly raspy voice with real wear on it — sounds like a guy "
            "who's talked for a living. Fast, punchy delivery with sharp comedic "
            "timing, quick to interrupt himself for a jab or a laugh. Confident, "
            "opinionated, a little cocky but likeable — like a sports radio host who "
            "used to play the game and never lets you forget it. Warm undertone "
            "beneath the grit, not mean-spirited."
        ),
        "text": (
            "Alright, alright, settle down — I've been watching this league longer "
            "than most of you clowns have been alive, so let me tell you somethin': "
            "that trade? Terrible. Absolutely terrible. But hey, what do I know, "
            "I only played the game."
        ),
    },
    "lindqvist": {
        "voice_name": "Numbers",
        "description": (
            "American male, early 30s, light Upper Midwest (Minnesota) accent — "
            "subtle, not cartoonish. Clear, articulate, even-paced voice with a calm, "
            "almost dry confidence. Sounds smart without sounding like he's showing "
            "off — measured and precise, but with a warm, approachable undertone. "
            "Rarely raises his voice; his confidence comes from being right, not from "
            "volume. Slight deadpan wit underneath the polish."
        ),
        "text": (
            "Look, the eye test says he's struggling. The numbers say something "
            "different — his expected goals are actually up over his last ten games, "
            "it just hasn't bounced his way yet. That's the story nobody's telling."
        ),
    },
    "kovalenko": {
        "voice_name": "Dozer",
        "description": (
            "American male, late 30s, deep and gravelly voice with a subtle Eastern "
            "European family influence layered under a Midwest / Cleveland blue-collar "
            "accent. Slow, deliberate, weighty delivery — doesn't waste words. Sounds "
            "like the quiet, tough guy in the room who commands respect without "
            "needing to raise his voice. Warm and sincere underneath the toughness, "
            "genuine rather than performative."
        ),
        "text": (
            "You wanna talk about heart, you don't need the stat sheet. You watch "
            "how a guy plays in the third period of a back-to-back, on the road, "
            "down a goal. That tells you everything."
        ),
    },
    "marchetti": {
        "voice_name": "Ace",
        "description": (
            "American male, late 20s, thick Rhode Island Italian-American accent. "
            "Fast, loud, high-energy voice that seems to always be one beat from "
            "losing it — excitable, animated, prone to sudden bursts of volume for "
            "comedic effect. Playful and chaotic, talks with his hands even though "
            "you can't see them, constantly ready to jump in and derail the "
            "conversation with a joke or a wild take. Big personality, big laugh, "
            "never boring."
        ),
        "text": (
            "Wait wait wait — hold on, HOLD ON. You're tellin' me they benched him? "
            "Are you outta your mind? I got a cousin in Providence coaches PeeWee "
            "hockey, he wouldn't make that move!"
        ),
    },
}

OUT_DIR = Path(__file__).parent / "static" / "audio" / "previews"
OUT_DIR.mkdir(parents=True, exist_ok=True)

results = {}

for analyst_id, brief in BRIEFS.items():
    print(f"\n=== Designing {brief['voice_name']} ({analyst_id}) ===")
    try:
        resp = client.text_to_voice.design(
            voice_description=brief["description"],
            text=brief["text"],
            model_id="eleven_multilingual_ttv_v2",
        )
        previews = resp.previews if hasattr(resp, "previews") else resp.get("previews", [])
        char_results = []
        for i, p in enumerate(previews[:3], start=1):
            gen_voice_id = getattr(p, "generated_voice_id", None) or p.get("generated_voice_id")
            audio_b64 = getattr(p, "audio_base_64", None) or p.get("audio_base_64")
            if not audio_b64:
                print(f"  preview {i}: NO AUDIO returned")
                continue
            filename = f"{analyst_id}_preview_{i}.mp3"
            filepath = OUT_DIR / filename
            filepath.write_bytes(base64.b64decode(audio_b64))
            url = f"/api/audio/previews/{filename}"
            char_results.append({
                "index": i,
                "generated_voice_id": gen_voice_id,
                "url": url,
                "size_bytes": filepath.stat().st_size,
            })
            print(f"  preview {i}: {url}  ({filepath.stat().st_size} bytes)  vid={gen_voice_id[:12]}...")
        results[analyst_id] = {
            "voice_name": brief["voice_name"],
            "description": brief["description"],
            "previews": char_results,
        }
    except Exception as e:
        print(f"  FAILED: {e}")
        results[analyst_id] = {"error": str(e)}

# Persist results so the frontend/user can look them up later.
manifest_path = OUT_DIR / "manifest.json"
manifest_path.write_text(json.dumps(results, indent=2))
print(f"\nManifest saved: {manifest_path}")
