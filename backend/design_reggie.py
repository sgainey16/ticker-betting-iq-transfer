"""Generate 3 ElevenLabs Voice Design candidates for Reggie Banks."""
import os, base64, json
from pathlib import Path
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv(Path(__file__).parent / ".env")
client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])

DESCRIPTION = (
    "American male, mid-to-late 30s, neutral all-American broadcast voice — no fixed regional "
    "accent. Confident, bold, fast, sharp-witted, lippy sports-show anchor delivery. Full "
    "energy at all times, never flat, never a stats-dump. Ex-NHL player turned analyst — you "
    "hear the athlete's authority behind the mic. Warm undertone under the swagger, "
    "classy not cheesy, respected because it's earned. Quick to punch a joke, quick to "
    "praise a good play, quick to rip a bad one — all in the same energetic voice."
)

TEXT = (
    "Let's get real, kid — puck drops in three, two, one, and here's what's happening in "
    "hockey tonight. We got trades brewing, we got contracts nobody can explain, and we got "
    "one goalie playing like he wants to be paid in real estate. Stick on the ice — let's ride."
)

OUT_DIR = Path(__file__).parent / "static" / "audio" / "previews"
OUT_DIR.mkdir(parents=True, exist_ok=True)

print("Designing Reggie Banks (3 candidates)...")
resp = client.text_to_voice.design(
    voice_description=DESCRIPTION,
    text=TEXT,
    model_id="eleven_multilingual_ttv_v2",
)
previews = getattr(resp, "previews", None) or resp.get("previews", [])

results = []
for i, p in enumerate(previews[:3], start=1):
    gvi = getattr(p, "generated_voice_id", None) or p.get("generated_voice_id")
    b64 = getattr(p, "audio_base_64", None) or p.get("audio_base_64")
    if not b64:
        print(f"  {i}: no audio"); continue
    fn = f"reggie_preview_{i}.mp3"
    fp = OUT_DIR / fn
    fp.write_bytes(base64.b64decode(b64))
    results.append({"index": i, "generated_voice_id": gvi, "url": f"/api/audio/previews/{fn}", "size_bytes": fp.stat().st_size})
    print(f"  {i}: {fp.stat().st_size} bytes, vid={gvi[:12]}...")

# Merge into existing manifest.
manifest_path = OUT_DIR / "manifest.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
manifest["reggie"] = {
    "voice_name": "Reggie",
    "description": DESCRIPTION,
    "previews": results,
}
manifest_path.write_text(json.dumps(manifest, indent=2))
print(f"Manifest updated: {manifest_path}")
