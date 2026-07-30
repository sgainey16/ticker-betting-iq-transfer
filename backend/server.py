"""The Ticker — Phase 1 backend."""
import os
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from analysts import (
    ANALYSTS,
    PLAYERS,
    TEAMS,
    GAMES,
    TICKER_ITEMS,
    SUGGESTED_QUESTIONS,
    TOPIC_META,
    get_analyst,
    build_stat_context,
    build_stat_card,
    pick_banter,
    infer_turn_type,
    quick_fallback_line,
)
from voice_service import ensure_audio, audio_url_for, budget_status
from voice_picker import get_picker_state, set_active as picker_set_active, ensure_preview, CANDIDATES
import nhl_data
import sportradar_client as sr
import reggie_assistant as reggie
from highlightly_client import highlightly, TAB_GROUPS
from recap_show import generate_episode as generate_recap_episode

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

STATIC_DIR = ROOT_DIR / "static"
STATIC_DIR.mkdir(exist_ok=True)

app = FastAPI(title="The Ticker API")
api = APIRouter(prefix="/api")

logger = logging.getLogger("ticker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


# ---------- Models ----------
class AskRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    analyst_id: str
    question: str
    session_id: Optional[str] = None


class PredictionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_name: str = Field(min_length=1, max_length=40)
    game_id: str
    pick: str  # 'home' | 'away'
    reasoning: str = Field(default="", max_length=280)


class Prediction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_name: str
    game_id: str
    pick: str
    reasoning: str
    created_at: str
    resolved: bool = False
    correct: Optional[bool] = None


# ---------- Betting IQ — Phase 1: Bet Log ----------
# Follows /app/memory/BETTING_IQ_SPEC.md. Every stat surfaced from this data
# MUST respect the sample-size confidence bands in Section 7 of the spec.
class BetLogCreate(BaseModel):
    """Data captured when a user logs a bet. All fields except device_id and
    result required — result may be 'pending' for future/live bets."""
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=1, max_length=128)
    bet_date: str                          # ISO 'YYYY-MM-DD'
    matchup: str = Field(min_length=1, max_length=80)  # 'BOS @ NJD'
    bet_type: str = Field(min_length=1, max_length=40) # 'moneyline'|'spread'|'total'|'prop'|'first-goal'|'shots'|'saves'|'other'
    selection: str = Field(min_length=1, max_length=120)  # what the user chose
    odds: str = Field(min_length=1, max_length=20)  # '-135' / '+180'
    stake: float = 0.0                     # 0 if prediction_only
    prediction_only: bool = False          # bets w/ no money — spec §9
    result: str = "pending"                # 'win'|'loss'|'push'|'pending'
    profit_loss: float = 0.0
    notes: str = Field(default="", max_length=280)


class BetLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    bet_date: str
    matchup: str
    bet_type: str
    selection: str
    odds: str
    stake: float
    prediction_only: bool
    result: str
    profit_loss: float
    notes: str
    created_at: str


# ---------- Root / meta ----------
@api.get("/")
async def root():
    return {"app": "The Ticker", "phase": 1, "sport": "NHL"}


@api.get("/analysts")
async def list_analysts():
    return [
        {
            "id": a["id"],
            "name": a["name"],
            "short_name": a["short_name"],
            "role": a["role"],
            "accent_color": a["accent_color"],
            "tagline": a["tagline"],
            "loading_lines": a["loading_lines"],
        }
        for a in ANALYSTS.values()
    ]


@api.get("/ticker")
async def ticker():
    """Live NHL headlines via Sportradar; falls back to the durable mock
    lines so the banner always feels alive."""
    live = sr.ticker_lines(limit=6) if sr.is_available() else []
    if not live:
        # Legacy SportsData.io path (kept as secondary fallback if configured)
        live = nhl_data.ticker_headlines(limit=6)
    combined = live + TICKER_ITEMS if live else TICKER_ITEMS
    source = "sportradar" if sr.is_available() and live else ("sportsdata" if live else "mock")
    return {"items": combined, "live": bool(live), "source": source}


@api.get("/nhl/standings")
async def nhl_standings():
    """Live NHL standings (Sportradar 5-min cache; mock fallback)."""
    if sr.is_available():
        data = sr.teams_shape()
        if data:
            return {"season": sr._season_year(), "teams": data, "live": True, "source": "sportradar"}
    # SportsData.io legacy path (usually inactive)
    data = nhl_data.standings() or []
    return {"season": nhl_data.CURRENT_SEASON, "teams": data, "live": nhl_data.is_available(), "source": "sportsdata" if data else "mock"}


@api.get("/nhl/games")
async def nhl_games():
    """Today's NHL games (Sportradar 5-min cache; mock fallback)."""
    if sr.is_available():
        data = sr.games_shape()
        if data is not None:
            return {"games": data, "live": True, "source": "sportradar"}
    data = nhl_data.today_games() or []
    return {"games": data, "live": nhl_data.is_available(), "source": "sportsdata" if data else "mock"}


@api.get("/suggested-questions")
async def suggested_questions():
    return {"questions": SUGGESTED_QUESTIONS}


@api.get("/banter")
async def banter(topic: str = "league_wide"):
    """Return a full multi-turn two-host banter show as a MANIFEST.
    Manifest shape (stable, forward-compatible with future clip-sharing):
      { show_id, topic, generated_at, schema_version,
        turns: [{ turn_id, index, speaker, shot, type, text, audio_url,
                  video_url (null until Highlights lands),
                  start_ms (client-computed), duration_ms (client-computed) }] }
    """
    variant_idx, turns = pick_banter(topic)
    show_id = f"{topic}:v{variant_idx}"
    now_iso = datetime.now(timezone.utc).isoformat()
    enriched = []
    for i, t in enumerate(turns):
        audio_url = ensure_audio(t["speaker"], t["text"])
        enriched.append({
            "turn_id": f"{show_id}#t{i:02d}",
            "index": i,
            "speaker": t.get("speaker", ""),
            "shot": t.get("shot", ""),
            "type": infer_turn_type(t),
            "text": t.get("text", ""),
            "audio_url": audio_url,
            "video_url": None,  # populated when Highlights vendor lands
            "interrupt": bool(t.get("interrupt", False)),
        })
    return {
        "schema_version": 2,
        "show_id": show_id,
        "topic": topic,
        "generated_at": now_iso,
        "turns": enriched,
    }


@api.get("/topics")
async def topics():
    return {"topics": TOPIC_META}


class QuickReplyReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    topic: str = Field(min_length=1, max_length=120)
    analyst_id: Optional[str] = None  # if None, we pick one


@api.post("/banter/quick-reply")
async def quick_reply(req: QuickReplyReq):
    """After the opening banter, the user drops a word/team/player — one analyst
    fires back a quick in-character line + voice audio."""
    import random as _r
    analyst_id = req.analyst_id if req.analyst_id in ANALYSTS else _r.choice(list(ANALYSTS.keys()))
    analyst = ANALYSTS[analyst_id]
    topic = req.topic.strip()

    text = None
    if EMERGENT_LLM_KEY:
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=str(uuid.uuid4()),
                system_message=(
                    f"{analyst['system_prompt']}\n\n"
                    f"--- LIVE NHL DATA ---\n{nhl_data.league_leaders_context()}\n\n"
                    "The user just walked up to the desk mid-broadcast and dropped a "
                    "single word or short phrase — a team, a player, a topic. Fire back "
                    "ONE quick in-character line. Max 22 words. No preamble, no 'great "
                    "topic', no emoji. Land the point. Substance under the joke. Cite "
                    "live standings when relevant."
                ),
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            resp = await chat.send_message(UserMessage(text=topic))
            if isinstance(resp, str) and resp.strip():
                text = resp.strip()
        except Exception as e:
            logger.warning("quick_reply LLM failed: %s", e)
    if not text:
        text = quick_fallback_line(analyst_id, topic)

    audio_url = ensure_audio(analyst_id, text)
    return {"analyst_id": analyst_id, "text": text, "audio_url": audio_url}


@api.get("/voice-lab/manifest")
async def voice_lab_manifest():
    """Return the generated voice-design previews (4 characters × 3 candidates)
    plus any previously-selected preview_index per analyst."""
    manifest_path = STATIC_DIR / "audio" / "previews" / "manifest.json"
    if not manifest_path.exists():
        return {"characters": {}, "selected": {}}
    import json as _json
    chars = _json.loads(manifest_path.read_text())
    selected = {}
    choices_path = STATIC_DIR / "audio" / "voice_choices.json"
    if choices_path.exists():
        try:
            saved = _json.loads(choices_path.read_text())
            for aid, cfg in saved.items():
                if "preview_index" in cfg:
                    selected[aid] = cfg["preview_index"]
        except Exception:
            pass
    return {"characters": chars, "selected": selected}


class VoiceSelectReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    analyst_id: str
    preview_index: int  # 1-based


@api.post("/voice-lab/select")
async def voice_lab_select(req: VoiceSelectReq):
    """Promote a preview to a permanent ElevenLabs voice, update voice_service,
    and clear the cached banter audio so it regenerates with the new voice."""
    from voice_service import ANALYST_VOICES, _get_client
    import json as _json

    manifest_path = STATIC_DIR / "audio" / "previews" / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Previews not generated yet")
    manifest = _json.loads(manifest_path.read_text())
    char = manifest.get(req.analyst_id)
    if not char or "previews" not in char:
        raise HTTPException(status_code=404, detail="Analyst previews not found")
    match = next((p for p in char["previews"] if p["index"] == req.preview_index), None)
    if not match:
        raise HTTPException(status_code=404, detail="Preview index not found")

    client = _get_client()
    if client is None:
        raise HTTPException(status_code=500, detail="ElevenLabs key not set")

    # Save the preview as a real voice. ElevenLabs generated_voice_id tokens are
    # one-shot — calling create() a second time returns a 400. We treat that as
    # success (the voice already exists, reuse it) so the endpoint is idempotent.
    new_voice_id = None
    try:
        voice = client.text_to_voice.create(
            voice_name=f"Ticker · {char['voice_name']}",
            voice_description=char["description"],
            generated_voice_id=match["generated_voice_id"],
        )
        new_voice_id = getattr(voice, "voice_id", None)
        if not new_voice_id and isinstance(voice, dict):
            new_voice_id = voice.get("voice_id")
    except Exception as e:
        # Detect "already been created" and fall back to the generated_voice_id
        # (which is the same string ElevenLabs uses as the permanent voice_id).
        msg = str(e).lower()
        if "already been created" in msg or "already exists" in msg:
            logger.info("Voice already created for %s, reusing", req.analyst_id)
            new_voice_id = match["generated_voice_id"]
        else:
            logger.exception("ElevenLabs create voice failed")
            raise HTTPException(status_code=400, detail=f"ElevenLabs: {e}")

    if not new_voice_id:
        raise HTTPException(status_code=500, detail="ElevenLabs returned no voice_id")

    # Update in-memory config so subsequent /api/banter calls use the new voice.
    ANALYST_VOICES[req.analyst_id]["voice_id"] = new_voice_id

    # Persist the choice to a file so it survives restart.
    choices_path = STATIC_DIR / "audio" / "voice_choices.json"
    existing = {}
    if choices_path.exists():
        try:
            existing = _json.loads(choices_path.read_text())
        except Exception:
            existing = {}
    existing[req.analyst_id] = {
        "voice_id": new_voice_id,
        "voice_name": char["voice_name"],
        "preview_index": req.preview_index,
    }
    choices_path.write_text(_json.dumps(existing, indent=2))

    # Clear any cached banter audio for THIS analyst so next fetch regenerates.
    audio_dir = STATIC_DIR / "audio"
    cleared = 0
    for f in audio_dir.glob(f"{req.analyst_id}_*.mp3"):
        f.unlink(missing_ok=True)
        cleared += 1

    return {
        "analyst_id": req.analyst_id,
        "voice_id": new_voice_id,
        "voice_name": char["voice_name"],
        "cleared_cache_files": cleared,
    }


@api.get("/stats/players")
async def stats_players():
    if sr.is_available():
        data = sr.players_shape()
        if data:
            return {"players": data, "live": True, "source": "sportradar"}
    return {"players": PLAYERS, "live": False, "source": "mock"}


@api.get("/stats/teams")
async def stats_teams():
    if sr.is_available():
        data = sr.teams_shape()
        if data:
            return {"teams": data, "live": True, "source": "sportradar"}
    return {"teams": TEAMS, "live": False, "source": "mock"}


@api.get("/tts/budget")
async def tts_budget():
    """Today's ElevenLabs character usage vs. daily cap. Used by the
    frontend health indicator + as a debugging endpoint after credit
    burns. The cap itself lives in ELEVENLABS_DAILY_CHAR_LIMIT (.env)."""
    return budget_status()


# ---------- Voice Picker (2-host: Reggie + Marc) ----------
@api.get("/voices/picker")
async def voices_picker():
    """Return the candidate voice roster for each host. Preview MP3s are
    generated lazily on the first /voices/preview call — this endpoint stays
    fast so the page opens instantly."""
    return {"hosts": get_picker_state(pregenerate=False)}


@api.post("/voices/preview/{host}/{voice_id}")
async def voices_preview(host: str, voice_id: str):
    """Force-generate the preview clip for a specific candidate (or return
    the cached URL if it already exists)."""
    if host not in CANDIDATES:
        raise HTTPException(status_code=404, detail="unknown host")
    match = next((c for c in CANDIDATES[host] if c["voice_id"] == voice_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="voice_id not a candidate for this host")
    url = ensure_preview(host, match)
    if not url:
        raise HTTPException(status_code=500, detail="preview generation failed (check ElevenLabs quota)")
    return {"preview_url": url}


class VoicePickReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    host: str
    voice_id: str


@api.post("/voices/set-active")
async def voices_set_active(req: VoicePickReq):
    """Make this candidate the active voice for the host + wipe the cached
    banter mp3s so they regenerate with the new voice."""
    try:
        return picker_set_active(req.host, req.voice_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Ask Our Analyst Anything ----------
@api.post("/ask/stream")
async def ask_stream(req: AskRequest):
    analyst = get_analyst(req.analyst_id)
    if not analyst:
        raise HTTPException(status_code=404, detail="Analyst not found")
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is empty")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    stat_context = build_stat_context(req.question)
    stat_card = build_stat_card(req.question)
    live_context = nhl_data.league_leaders_context()
    session_id = req.session_id or str(uuid.uuid4())

    system_message = (
        f"{analyst['system_prompt']}\n\n"
        f"You are answering a viewer question live on The Ticker (NHL desk).\n\n"
        f"--- LIVE DATA (SportsData.io, updated live) ---\n{live_context}\n\n"
        f"--- REFERENCE STATS ---\n{stat_context}\n\n"
        "Use the LIVE data first when relevant — it's from tonight. Use the reference stats "
        "for player-level context. If the numbers don't support a direct answer, acknowledge "
        "that in character and offer the closest angle you'd defend on air."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_message = UserMessage(text=req.question)

    async def event_gen():
        # First, ship the stat card so the frontend can render it immediately.
        import json
        yield f"event: stat_card\ndata: {json.dumps(stat_card)}\n\n"
        full_answer_chars = []
        try:
            async for ev in chat.stream_message(user_message):
                if isinstance(ev, TextDelta):
                    full_answer_chars.append(ev.content)
                    yield f"event: token\ndata: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.exception("LLM stream failed")
            msg = str(e)
            if "Budget has been exceeded" in msg or "budget_exceeded" in msg:
                friendly = (
                    "The Universal LLM Key has $0 balance. Top up under "
                    "Profile → Universal Key → Add Balance and try again."
                )
            else:
                friendly = "Signal lost from the desk. Try again."
            yield f"event: error\ndata: {json.dumps({'message': friendly})}\n\n"
            return

        answer = "".join(full_answer_chars)
        # Log the Q/A.
        doc = {
            "id": str(uuid.uuid4()),
            "analyst_id": analyst["id"],
            "question": req.question,
            "answer": answer,
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await db.qa_log.insert_one(doc)
        except Exception:
            logger.exception("Failed to persist Q/A log")

        # Generate voiced audio and hand back its URL BEFORE the `done`
        # event so the client can auto-play the analyst's reply.
        # Strips stage-direction asterisks and light markdown so TTS doesn't
        # awkwardly read them aloud ("leans forward"). Fails silently — text
        # streaming already succeeded, audio is a bonus.
        import re as _re
        spoken = answer
        spoken = _re.sub(r"\*[^*]+\*", "", spoken)          # *stage directions*
        spoken = _re.sub(r"\*\*([^*]+)\*\*", r"\1", spoken) # **bold**
        spoken = _re.sub(r"_([^_]+)_", r"\1", spoken)       # _italic_
        spoken = _re.sub(r"[`~>]", "", spoken)              # code/quote marks
        spoken = _re.sub(r"\s+", " ", spoken).strip()
        # Hard cap so a runaway LLM answer can't torch the daily budget.
        if len(spoken) > 1200:
            spoken = spoken[:1200].rsplit(" ", 1)[0] + "…"
        try:
            audio_url = ensure_audio(analyst["id"], spoken) if spoken else None
            if audio_url:
                yield f"event: audio\ndata: {json.dumps({'audio_url': audio_url})}\n\n"
        except Exception:
            logger.exception("Failed to generate answer audio")

        yield f"event: done\ndata: {json.dumps({'session_id': session_id})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ---------- Recaps · Highlightly ----------
_recaps_cache: dict = {}  # in-memory, 24h TTL; keyed by (kind, param)
_RECAPS_TTL_SEC = 24 * 60 * 60


def _cache_get(key: tuple):
    row = _recaps_cache.get(key)
    if not row:
        return None
    if (datetime.now(timezone.utc) - row["at"]).total_seconds() > _RECAPS_TTL_SEC:
        _recaps_cache.pop(key, None)
        return None
    return row["value"]


def _cache_set(key: tuple, value):
    _recaps_cache[key] = {"at": datetime.now(timezone.utc), "value": value}


@api.get("/recaps/highlights")
async def recaps_highlights(
    date: Optional[str] = None,
    match_id: Optional[int] = None,
    tab: Optional[str] = None,
    limit: int = 60,
):
    """Verified NHL clips for /recaps page.
    - date: YYYY-MM-DD (mutually exclusive with match_id)
    - match_id: Highlightly match id
    - tab: one of {all, goals, saves, hits, recaps, postgame, viral}
    """
    if not highlightly.is_ready():
        return {"ready": False, "reason": "Highlightly disabled or key missing.", "highlights": []}

    tab_key = (tab or "all").lower()
    if tab_key not in TAB_GROUPS:
        raise HTTPException(status_code=400, detail=f"invalid tab '{tab_key}'")

    cache_key = ("highlights", match_id or "", date or "", tab_key, limit)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"ready": True, "cached": True, **cached}

    if match_id is not None:
        clips = await highlightly.get_by_match(match_id, limit=limit)
        used_date = None
    elif date:
        clips = await highlightly.get_by_date(date, limit=limit)
        used_date = date
    else:
        latest = await highlightly.get_latest_populated(days_back=90, limit=limit)
        clips = latest["highlights"]
        used_date = latest["date"]

    allowed = TAB_GROUPS[tab_key]
    if allowed is not None:
        clips = [c for c in clips if c.get("category") in allowed]

    result = {"date": used_date, "tab": tab_key, "highlights": clips}
    _cache_set(cache_key, result)
    return {"ready": True, "cached": False, **result}


@api.get("/recaps/latest-games")
async def recaps_latest_games():
    """Distinct game headers from the most recent populated date — powers the
    logo-vs-logo picker strip on /recaps."""
    if not highlightly.is_ready():
        return {"ready": False, "games": []}
    cache_key = ("latest-games",)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"ready": True, "cached": True, **cached}

    latest = await highlightly.get_latest_populated(days_back=90, limit=100)
    games = {}
    for c in latest["highlights"]:
        mid = c.get("match_id")
        if not mid or mid in games:
            continue
        games[mid] = {
            "match_id": mid,
            "home": c.get("home_team"),
            "away": c.get("away_team"),
        }

    result = {"date": latest["date"], "games": list(games.values())}
    _cache_set(cache_key, result)
    return {"ready": True, "cached": False, **result}


@api.get("/images/team-logo/{code}")
async def team_logo(code: str):
    """Highlightly team logo URL — fills the Imagn gap for Phase 1."""
    if not highlightly.is_ready():
        return {"ready": False, "logo_url": None}
    meta = await highlightly.get_team_logo(code.upper())
    if not meta or not meta.get("logo_url"):
        return {"ready": True, "logo_url": None, "code": code.upper()}
    return {"ready": True, **meta}


@api.get("/images/team-logos")
async def team_logos_all():
    """All 32 NHL team logos in one call — frontend caches on first load."""
    if not highlightly.is_ready():
        return {"ready": False, "teams": []}
    cache_key = ("team-logos",)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"ready": True, "cached": True, "teams": cached}
    logos = await highlightly.all_team_logos()
    _cache_set(cache_key, logos)
    return {"ready": True, "cached": False, "teams": logos}


@api.get("/recap-show/episode")
async def recap_show_episode(date: str, voice: bool = False):
    """Full recap show episode manifest for a given YYYY-MM-DD.
    - voice=false (default): text-only host lines; frontend fetches audio
      per-segment on demand as segments play.
    - voice=true: pre-renders all Reggie/Marc lines via ElevenLabs. Slow but
      warm-cached — useful for the initial Apr 12 demo pre-warm.
    Cached in-process per (date,voice) so we render each show once.
    """
    cache_key = ("recap-show", date, voice)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"cached": True, **cached}

    ep = await generate_recap_episode(date)

    if voice and ep.get("ready"):
        # Warm host audio for cold open + close (fast wins); per-segment audio
        # streams on demand via /recap-show/line-audio.
        try:
            ep["cold_open"]["reggie_audio_url"] = ensure_audio("reggie", ep["cold_open"]["reggie"])
            ep["cold_open"]["marc_audio_url"]   = ensure_audio("marc",   ep["cold_open"]["marc"])
            ep["close"]["marc_audio_url"]       = ensure_audio("marc",   ep["close"]["marc"])
            ep["close"]["reggie_audio_url"]     = ensure_audio("reggie", ep["close"]["reggie"])
        except Exception as e:  # noqa: BLE001
            logger.warning("recap warm-audio failed: %s", e)

    _cache_set(cache_key, ep)
    return {"cached": False, **ep}


@api.get("/recap-show/line-audio")
async def recap_show_line_audio(speaker: str, text: str):
    """Return audio URL for a specific host line. Frontend requests this
    per-segment as the show plays, so we don't burn 24 ElevenLabs calls on
    initial page load."""
    speaker = (speaker or "").lower()
    if speaker not in ("reggie", "marc"):
        raise HTTPException(status_code=400, detail="speaker must be reggie or marc")
    text = (text or "").strip()
    if not text:
        return {"audio_url": None}
    try:
        url = ensure_audio(speaker, text)
        return {"audio_url": url, "speaker": speaker}
    except Exception as e:  # noqa: BLE001
        logger.warning("recap line audio failed: %s", e)
        return {"audio_url": None, "error": str(e)[:200]}


# ---- Post-game stats ----
# Highlightly's /matches/{id} returns rich per-team box score numbers
# (shots, hits, faceoff %, PP %, blocks, PIM, giveaways/takeaways). We
# normalize to the compact shape the RecapShow panel expects: two team
# blocks with a `stats` object keyed by human-friendly display name.

POSTGAME_STATS_TTL = 6 * 3600  # (informational — uses default cache TTL)


@api.get("/recap-show/post-game-stats")
async def recap_show_post_game_stats(match_id: int):
    """Comparison box score for a completed match. Returns null-safe
    empty payload if Highlightly is disabled or the game has no stats."""
    cache_key = ("postgame-stats", match_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"cached": True, **cached}
    stats = await highlightly.get_match_stats(match_id)
    if not stats:
        return {"ready": False, "match_id": match_id}
    payload = {"ready": True, **stats}
    _cache_set(cache_key, payload)
    return {"cached": False, **payload}



# ---------- Predictions ----------
@api.get("/predictions/games")
async def predictions_games():
    """Games enriched with panel picks, AI consensus, and community vote tally.
    Community tally is a real-time aggregate from stored user picks."""
    pipeline = [
        {"$group": {
            "_id": {"game_id": "$game_id", "pick": "$pick"},
            "count": {"$sum": 1},
        }}
    ]
    tally = {}
    async for row in db.predictions.aggregate(pipeline):
        gid = row["_id"]["game_id"]
        side = row["_id"]["pick"]
        tally.setdefault(gid, {"home": 0, "away": 0})[side] = row["count"]

    out = []
    for g in GAMES:
        votes = tally.get(g["id"], {"home": 0, "away": 0})
        total = votes["home"] + votes["away"]
        out.append({
            **g,
            "community": {
                "home_votes": votes["home"],
                "away_votes": votes["away"],
                "total": total,
                "home_pct": round(100 * votes["home"] / total) if total else None,
                "away_pct": round(100 * votes["away"] / total) if total else None,
            },
        })
    return {"games": out}


def _team(code: str):
    for t in TEAMS:
        if t["code"] == code:
            return t
    return {"code": code, "name": code}


@api.post("/predictions", response_model=Prediction)
async def create_prediction(inp: PredictionCreate):
    game = next((g for g in GAMES if g["id"] == inp.game_id), None)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if inp.pick not in ("home", "away"):
        raise HTTPException(status_code=400, detail="Pick must be 'home' or 'away'")

    pred = Prediction(
        user_name=inp.user_name.strip(),
        game_id=inp.game_id,
        pick=inp.pick,
        reasoning=inp.reasoning.strip(),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    await db.predictions.insert_one(pred.model_dump())
    return pred


@api.get("/predictions")
async def list_predictions(user_name: Optional[str] = None, limit: int = 50):
    q = {}
    if user_name:
        q["user_name"] = user_name
    docs = await db.predictions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    # Enrich with game/team info for frontend.
    for d in docs:
        g = next((x for x in GAMES if x["id"] == d["game_id"]), None)
        if g:
            d["game"] = {
                "home": _team(g["home"]),
                "away": _team(g["away"]),
                "start_iso": g["start_iso"],
            }
    return {"predictions": docs}


@api.get("/predictions/me/{user_name}")
async def my_stats(user_name: str):
    total = await db.predictions.count_documents({"user_name": user_name})
    resolved = await db.predictions.count_documents({"user_name": user_name, "resolved": True})
    correct = await db.predictions.count_documents({"user_name": user_name, "correct": True})
    accuracy = round(100 * correct / resolved, 1) if resolved else 0.0
    # Streak: iterate most recent resolved.
    cursor = db.predictions.find(
        {"user_name": user_name, "resolved": True}, {"_id": 0, "correct": 1, "created_at": 1, "game_id": 1, "pick": 1, "winner": 1}
    ).sort("created_at", -1)
    streak = 0
    beat_reggie = 0
    beat_marc = 0
    tie_reggie = 0
    tie_marc = 0
    streak_broken = False
    async for d in cursor:
        if not streak_broken:
            if d.get("correct"):
                streak += 1
            else:
                streak_broken = True
        # Compare user pick outcome vs Reggie/Marc for resolved games
        g = next((x for x in GAMES if x["id"] == d.get("game_id")), None)
        if g and d.get("winner"):
            winner = d["winner"]
            user_correct = d.get("correct", False)
            reggie_correct = g.get("reggie_pick") == winner
            marc_correct = g.get("marc_pick") == winner
            if user_correct and not reggie_correct:
                beat_reggie += 1
            elif user_correct == reggie_correct:
                tie_reggie += 1
            if user_correct and not marc_correct:
                beat_marc += 1
            elif user_correct == marc_correct:
                tie_marc += 1
    return {
        "user_name": user_name,
        "total": total,
        "resolved": resolved,
        "correct": correct,
        "accuracy": accuracy,
        "streak": streak,
        "vs_panel": {
            "beat_reggie": beat_reggie,
            "tie_reggie": tie_reggie,
            "beat_marc": beat_marc,
            "tie_marc": tie_marc,
        },
    }


@api.get("/predictions/leaderboard")
async def leaderboard():
    pipeline = [
        {
            "$group": {
                "_id": "$user_name",
                "total": {"$sum": 1},
                "correct": {"$sum": {"$cond": [{"$eq": ["$correct", True]}, 1, 0]}},
                "resolved": {"$sum": {"$cond": [{"$eq": ["$resolved", True]}, 1, 0]}},
            }
        },
        {"$sort": {"correct": -1, "total": -1}},
        {"$limit": 20},
    ]
    rows = []
    async for r in db.predictions.aggregate(pipeline):
        acc = round(100 * r["correct"] / r["resolved"], 1) if r["resolved"] else 0.0
        rows.append({
            "user_name": r["_id"],
            "total": r["total"],
            "resolved": r["resolved"],
            "correct": r["correct"],
            "accuracy": acc,
        })
    return {"leaderboard": rows}


# Simulate result resolution (admin-fallback flavor for Phase 1 leaderboard demo).
@api.post("/predictions/simulate-resolve")
async def simulate_resolve():
    """Resolve all currently-unresolved picks with a random-but-deterministic outcome
    based on the game's moneyline. Lets the leaderboard populate for demo purposes."""
    import random
    cursor = db.predictions.find({"resolved": False}, {"_id": 0})
    updates = 0
    async for d in cursor:
        game = next((g for g in GAMES if g["id"] == d["game_id"]), None)
        if not game:
            continue
        # No betting lines in V1 — use a mild home-ice edge for the demo.
        winner = "home" if random.random() < 0.55 else "away"
        correct = (d["pick"] == winner)
        await db.predictions.update_one(
            {"id": d["id"]},
            {"$set": {"resolved": True, "correct": correct, "winner": winner}},
        )
        updates += 1
    return {"resolved_count": updates}


# ---------- Subscription (foundation — mock activation for MVP) ----------
FREE_QUESTION_LIMIT = 3


class DeviceReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=6, max_length=80)


class RosterReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=6, max_length=80)
    league_name: Optional[str] = Field(default="", max_length=80)
    scoring: Optional[str] = Field(default="", max_length=40)   # e.g. points / H2H / roto
    roster: list = Field(default_factory=list)                  # [{name, team, pos}]
    favorite_teams: list = Field(default_factory=list)          # ["TOR","EDM"]
    notes: Optional[str] = Field(default="", max_length=400)


async def _get_sub_doc(device_id: str) -> dict:
    doc = await db.subscribers.find_one({"device_id": device_id}, {"_id": 0})
    if doc:
        return doc
    fresh = {
        "device_id": device_id,
        "is_premium": False,
        "questions_used": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subscribers.insert_one(fresh)
    return fresh


@api.get("/subscription/state")
async def subscription_state(device_id: str):
    doc = await _get_sub_doc(device_id)
    return {
        "device_id": device_id,
        "is_premium": doc.get("is_premium", False),
        "questions_used": doc.get("questions_used", 0),
        "free_limit": FREE_QUESTION_LIMIT,
        "questions_remaining": max(0, FREE_QUESTION_LIMIT - doc.get("questions_used", 0))
            if not doc.get("is_premium") else None,
    }


@api.post("/subscription/increment-question")
async def subscription_increment(req: DeviceReq):
    doc = await _get_sub_doc(req.device_id)
    if doc.get("is_premium"):
        return {"questions_used": doc.get("questions_used", 0), "gated": False, "is_premium": True}
    used = doc.get("questions_used", 0) + 1
    await db.subscribers.update_one({"device_id": req.device_id}, {"$set": {"questions_used": used}})
    return {
        "questions_used": used,
        "gated": used > FREE_QUESTION_LIMIT,
        "is_premium": False,
        "free_limit": FREE_QUESTION_LIMIT,
    }


@api.post("/subscription/activate")
async def subscription_activate(req: DeviceReq):
    """MOCK activation — flips the device to premium. Real Stripe wiring
    lands after user confirms the pricing tier."""
    await _get_sub_doc(req.device_id)
    await db.subscribers.update_one(
        {"device_id": req.device_id},
        {"$set": {"is_premium": True, "activated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"is_premium": True, "device_id": req.device_id}


@api.get("/subscription/roster")
async def subscription_roster(device_id: str):
    doc = await db.rosters.find_one({"device_id": device_id}, {"_id": 0})
    return doc or {"device_id": device_id, "league_name": "", "scoring": "",
                   "roster": [], "favorite_teams": [], "notes": ""}


@api.post("/subscription/roster")
async def subscription_roster_save(req: RosterReq):
    payload = req.model_dump()
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.rosters.update_one(
        {"device_id": req.device_id},
        {"$set": payload},
        upsert=True,
    )
    return {"saved": True, **payload}



# --------------------------------------------------------------------
# Reggie Assistant — Back Office chat with talk + do.
# Reggie can propose actions (set favorites, load roster, log bet) which
# the frontend renders as confirm-cards. Nothing writes to DB without a
# subsequent /assistant/reggie/action call from the user.
# --------------------------------------------------------------------

class AssistantChatReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=6, max_length=80)
    message: str = Field(min_length=1, max_length=1200)


class AssistantActionReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=6, max_length=80)
    proposal_id: str
    kind: str
    payload: dict


@api.get("/assistant/state")
async def assistant_state(device_id: str):
    state = await reggie.build_user_state(db, device_id)
    return {"state": state, "nudges": reggie.build_nudges(state)}


@api.get("/assistant/history")
async def assistant_history(device_id: str):
    doc = await db.assistant_conversations.find_one({"device_id": device_id}, {"_id": 0})
    if not doc:
        return {"messages": []}
    return {"messages": (doc.get("messages") or [])[-40:]}  # last 40 turns


@api.post("/assistant/reggie/chat")
async def assistant_reggie_chat(req: AssistantChatReq):
    """Non-streaming chat — Reggie's replies are short enough that a single
    response is cleaner than SSE for this surface. Returns the assistant's
    reply + optional action_proposal object."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    state = await reggie.build_user_state(db, req.device_id)
    nudges = reggie.build_nudges(state)
    convo = await db.assistant_conversations.find_one({"device_id": req.device_id}, {"_id": 0})
    history: list = (convo or {}).get("messages", [])[-20:]  # keep last 20 turns hot

    system_message = reggie.REGGIE_ASSISTANT_SYSTEM \
        .replace("{user_state}", reggie.format_state_for_prompt(state)) \
        .replace("{nudges}", "\n".join(f"- {n['label']}: {n['prompt']}" for n in nudges))

    session_id = f"reggie-assist-{req.device_id}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    # Rehydrate short conversation history so Reggie has memory of the last
    # few turns even though LlmChat is stateless per-call.
    context_preface = ""
    for turn in history[-8:]:  # last 8 turns = ~4 user+assistant pairs
        role = turn.get("role", "")
        content = turn.get("content", "")
        if not content:
            continue
        if role == "user":
            context_preface += f"\n[Previously the user said]: {content}"
        elif role == "assistant":
            context_preface += f"\n[Previously you replied]: {content}"

    user_text = (context_preface + "\n\n[Now the user says]: " + req.message).strip() \
        if context_preface else req.message

    try:
        resp = await chat.send_message(UserMessage(text=user_text))
    except Exception as e:
        logger.exception("Reggie assistant LLM call failed")
        msg = str(e)
        if "Budget has been exceeded" in msg or "budget_exceeded" in msg:
            friendly = (
                "The Universal LLM Key is out of balance. Top up under "
                "Profile → Universal Key → Add Balance and try me again."
            )
        else:
            friendly = "My headset just cut out — try me again in a second."
        return {"reply": friendly, "action_proposal": None}

    reply_raw = getattr(resp, "text", None) or str(resp)
    clean_text, proposal = reggie.extract_action_proposal(reply_raw)

    # Persist the turn.
    now_iso = datetime.now(timezone.utc).isoformat()
    new_turns = [
        {"role": "user", "content": req.message, "ts": now_iso},
        {"role": "assistant", "content": clean_text, "ts": now_iso,
         **({"action_proposal": proposal} if proposal else {})},
    ]
    await db.assistant_conversations.update_one(
        {"device_id": req.device_id},
        {"$push": {"messages": {"$each": new_turns}},
         "$set": {"updated_at": now_iso}},
        upsert=True,
    )

    return {"reply": clean_text, "action_proposal": proposal}


@api.post("/assistant/reggie/action")
async def assistant_reggie_action(req: AssistantActionReq):
    """Execute a confirmed action proposal. Returns {ok, message}."""
    result = await reggie.execute_action(db, req.device_id, req.kind, req.payload)
    # Append a system confirmation message so it lives in history.
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.assistant_conversations.update_one(
        {"device_id": req.device_id},
        {"$push": {"messages": {
            "role": "system",
            "content": f"[action:{req.kind}:{'ok' if result.get('ok') else 'fail'}] {result.get('message','')}",
            "ts": now_iso,
        }}, "$set": {"updated_at": now_iso}},
        upsert=True,
    )
    return result


@api.delete("/assistant/history")
async def assistant_history_reset(device_id: str):
    """Clear this user's conversation with Reggie (privacy control)."""
    await db.assistant_conversations.delete_one({"device_id": device_id})
    return {"cleared": True}




# --------------------------------------------------------------------
# Betting IQ — Phase 1 endpoints. Bet log CRUD + summary stats.
# Follows /app/memory/BETTING_IQ_SPEC.md:
#   §7 Confidence bands — computed here, enforced at UI as well
#   §8 Prediction skill vs. profitability — separated in stats output
#   §9 User controls — includes DELETE for user data removal
#   §10 Guardrails — no "recommend more bets" language in this layer
# --------------------------------------------------------------------

def _confidence_band(n: int) -> str:
    """Section 7 spec — never claim confidence from small samples."""
    if n < 10:  return "insufficient"
    if n < 25:  return "low"
    if n < 50:  return "moderate"
    return "higher"


@api.post("/betting/bet", response_model=BetLog)
async def log_bet(payload: BetLogCreate):
    """Log a single bet (or prediction-only pick) tied to device_id."""
    now = datetime.now(timezone.utc).isoformat()
    doc = BetLog(
        device_id=payload.device_id,
        bet_date=payload.bet_date,
        matchup=payload.matchup,
        bet_type=payload.bet_type,
        selection=payload.selection,
        odds=payload.odds,
        stake=payload.stake,
        prediction_only=payload.prediction_only,
        result=payload.result,
        profit_loss=payload.profit_loss,
        notes=payload.notes,
        created_at=now,
    )
    await db.bet_log.insert_one(doc.model_dump())
    return doc


@api.get("/betting/bets")
async def list_bets(device_id: str):
    """All bets for a device, newest first."""
    cursor = db.bet_log.find({"device_id": device_id}).sort("bet_date", -1)
    rows = []
    async for r in cursor:
        r.pop("_id", None)
        rows.append(r)
    return {"bets": rows}


@api.delete("/betting/bet/{bet_id}")
async def delete_bet(bet_id: str, device_id: str):
    """User-controls-first: only the device that logged the bet can delete."""
    res = await db.bet_log.delete_one({"id": bet_id, "device_id": device_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bet not found")
    return {"deleted": True}


@api.get("/betting/stats")
async def betting_stats(device_id: str):
    """Aggregate stats respecting Section 7 confidence bands. Splits are
    always paired with sample size + band so the UI can show both."""
    cursor = db.bet_log.find({"device_id": device_id})
    bets = []
    async for r in cursor:
        r.pop("_id", None)
        bets.append(r)

    total = len(bets)
    resolved = [b for b in bets if b.get("result") in ("win", "loss", "push")]
    wins = [b for b in resolved if b["result"] == "win"]
    losses = [b for b in resolved if b["result"] == "loss"]
    money = [b for b in resolved if not b.get("prediction_only")]
    money_wins = [b for b in money if b["result"] == "win"]
    total_stake = sum(b.get("stake", 0.0) for b in money)
    total_pl = sum(b.get("profit_loss", 0.0) for b in money)

    def split(field_fn, label_for):
        """Bucket resolved bets by a computed key, return per-bucket stats."""
        buckets = {}
        for b in resolved:
            k = field_fn(b)
            if k is None:
                continue
            buckets.setdefault(k, []).append(b)
        out = []
        for k, arr in buckets.items():
            w = [b for b in arr if b["result"] == "win"]
            m = [b for b in arr if not b.get("prediction_only")]
            m_w = [b for b in m if b["result"] == "win"]
            stake = sum(b.get("stake", 0.0) for b in m)
            pl = sum(b.get("profit_loss", 0.0) for b in m)
            out.append({
                "key": k,
                "label": label_for(k),
                "n": len(arr),
                "wins": len(w),
                "win_rate_pct": round(len(w) / len(arr) * 100, 1) if arr else 0,
                "money_bets": len(m),
                "money_win_rate_pct": round(len(m_w) / len(m) * 100, 1) if m else None,
                "total_stake": round(stake, 2),
                "profit_loss": round(pl, 2),
                "roi_pct": round((pl / stake) * 100, 1) if stake else None,
                "confidence": _confidence_band(len(arr)),
            })
        out.sort(key=lambda r: r["n"], reverse=True)
        return out

    return {
        "total": total,
        "resolved": len(resolved),
        "pending": total - len(resolved),
        # Section 8 — prediction skill (all resolved) is SEPARATE from
        # betting profitability (money bets only).
        "prediction_accuracy": {
            "n": len(resolved),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate_pct": round(len(wins) / len(resolved) * 100, 1) if resolved else None,
            "confidence": _confidence_band(len(resolved)),
        },
        "betting_profitability": {
            "n": len(money),
            "win_rate_pct": round(len(money_wins) / len(money) * 100, 1) if money else None,
            "total_stake": round(total_stake, 2),
            "profit_loss": round(total_pl, 2),
            "roi_pct": round((total_pl / total_stake) * 100, 1) if total_stake else None,
            "confidence": _confidence_band(len(money)),
        },
        "by_bet_type": split(lambda b: b.get("bet_type"), lambda k: str(k).title()),
        "by_result": split(lambda b: b.get("result"), lambda k: str(k).title()),
        # Team splits parsed loosely from matchup string.
        "by_matchup": split(lambda b: b.get("matchup"), lambda k: str(k)),
    }



app.include_router(api)

# Serve generated audio via /api/audio/* so the ingress routes it correctly
# (Kubernetes ingress only forwards /api/* to the backend). Kept /static as
# well for any local debugging.
app.mount("/api/audio", StaticFiles(directory=str(STATIC_DIR / "audio")), name="api_audio")
app.mount("/api/sprites", StaticFiles(directory=str(STATIC_DIR / "sprites")), name="api_sprites")
app.mount("/api/hosts", StaticFiles(directory=str(STATIC_DIR / "hosts")), name="api_hosts")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
