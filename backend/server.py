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
from pregame_show import generate_segment as generate_pregame_segment
from live import live_engine
from radio_stations import lookup as radio_lookup, list_all as radio_list_all
import nhl_pbp as pbp_client
import httpx

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
    # Optional dimensions used by Spot Check. Legacy bets left null → simply
    # not counted in the corresponding spot bucket.
    home_or_away: Optional[str] = None     # 'home' | 'away' | null
    fav_or_dog: Optional[str] = None       # 'fav' | 'dog' | 'over' | 'under' | null


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
    home_or_away: Optional[str] = None
    fav_or_dog: Optional[str] = None


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


# NHL's public asset CDN — official SVG logos, no auth, no rate limits, no
# hotlink blocking. This is what the league itself serves to nhl.com. We use
# these as the canonical logo source and fall back to Highlightly only for
# team metadata (name, id). Highlightly's own logo URLs 403 when a browser
# tries to fetch them directly, which is why the app was rendering monogram
# fallbacks for many teams. Never again.
#
# Highlightly uses two-letter codes for some teams (TB/LA/SJ/NJ) while NHL's
# CDN uses the three-letter abbreviations. Map both directions.
_NHL_CDN_CODE = {
    "TB": "TBL", "LA": "LAK", "SJ": "SJS", "NJ": "NJD",
    # Everyone else — the Highlightly code IS the NHL abbreviation.
}


def _nhl_cdn_logo(code: str, variant: str = "light") -> str:
    up = (code or "").upper()
    cdn_code = _NHL_CDN_CODE.get(up, up)
    return f"https://assets.nhle.com/logos/nhl/svg/{cdn_code}_{variant}.svg"


@api.get("/images/team-logo/{code}")
async def team_logo(code: str):
    """Canonical team logo URL. Prefers NHL's official CDN so logos always
    render; falls back to Highlightly metadata for the display name only.
    """
    meta = {}
    if highlightly.is_ready():
        meta = (await highlightly.get_team_logo(code.upper())) or {}
    up = code.upper()
    return {
        "ready": True,
        "code": up,
        "name": meta.get("name") or up,
        "id": meta.get("id"),
        "logo_url": _nhl_cdn_logo(up),
        "logo_url_dark": _nhl_cdn_logo(up, "dark"),
    }


@api.get("/images/team-logos")
async def team_logos_all():
    """All NHL team logos in one call — frontend caches on first load. Uses
    NHL's official CDN for the actual image URLs (no hotlink blocking) but
    pulls the id/name roster from Highlightly so we cover every team the
    rest of the app references.
    """
    cache_key = ("team-logos-v2",)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"ready": True, "cached": True, "teams": cached}

    # Start from Highlightly's roster (gives us the real display names + ids)
    highlightly_teams = []
    if highlightly.is_ready():
        try:
            highlightly_teams = await highlightly.all_team_logos()
        except Exception as e:  # noqa: BLE001
            logger.warning("highlightly.all_team_logos failed: %s", e)
            highlightly_teams = []

    # Override every logo URL with NHL's own CDN. Skip pseudo-teams (division
    # names, all-star groupings) — no CDN logo exists for those.
    pseudo = {"PAC", "MET", "CEN", "ATL", "MCD", "MAC", "MAT", "HUG", "SWE", "CAN", "FIN", "USA"}
    result = []
    for t in highlightly_teams:
        code = (t.get("code") or "").upper()
        if not code:
            continue
        if code in pseudo:
            # Keep pseudo entries but leave logo_url null — the frontend
            # falls back to a monogram, which is fine for these.
            result.append({**t, "logo_url": None})
            continue
        result.append({
            **t,
            "logo_url": _nhl_cdn_logo(code),
            "logo_url_dark": _nhl_cdn_logo(code, "dark"),
        })

    # Belt-and-braces: if Highlightly is unavailable we still ship a
    # canonical 32-team NHL CDN roster so the app never renders monogram
    # boxes for real franchises.
    if not result:
        canonical = [
            "ANA","BOS","BUF","CGY","CAR","CHI","COL","CBJ","DAL","DET","EDM",
            "FLA","LAK","MIN","MTL","NSH","NJD","NYI","NYR","OTT","PHI","PIT",
            "SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK","WSH","WPG",
        ]
        result = [{
            "code": c, "name": c, "id": None,
            "logo_url": _nhl_cdn_logo(c),
            "logo_url_dark": _nhl_cdn_logo(c, "dark"),
        } for c in canonical]

    _cache_set(cache_key, result)
    return {"ready": True, "cached": False, "teams": result}


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


def _team_stat_row(code: str) -> dict:
    """Enrich the flat TEAMS row with derived per-game fields the LLM prompt
    wants. Falls back to zeros if the code isn't in the mock table."""
    row = next((t for t in TEAMS if t["code"] == code), None)
    if not row:
        return {}
    gp = max(1, row.get("gp") or 1)
    return {
        **row,
        "gf_per_game": (row.get("gf") or 0) / gp,
        "ga_per_game": (row.get("ga") or 0) / gp,
        # Not present in TEAMS — leave undefined; LLM prompt handles missing.
    }


@api.get("/tonight/segment")
async def tonight_segment(game_id: str, voice: bool = True):
    """Per-game pregame banter. Returns Reggie + Marc lines specifically
    about THIS matchup so the deep-link at /tonight/:gameId feels like a
    real broadcast segment, not a generic loop.

    Cached in-process (see pregame_show._CACHE) so repeated loads and
    pick-changes don't burn LLM calls. If `voice=true`, we also pre-fetch
    ElevenLabs audio for both lines so the frontend can play them without
    an extra round-trip.
    """
    game = next((g for g in GAMES if g["id"] == game_id), None)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    home_stats = _team_stat_row(game["home"])
    away_stats = _team_stat_row(game["away"])
    segment = await generate_pregame_segment(game, home_stats, away_stats)

    audio = {"reggie_audio_url": None, "marc_audio_url": None}
    if voice:
        try:
            audio["reggie_audio_url"] = ensure_audio("reggie", segment["reggie_hook"])
            audio["marc_audio_url"] = ensure_audio("marc", segment["marc_read"])
        except Exception as e:  # noqa: BLE001
            logger.warning("pregame audio synth failed: %s", e)

    return {**segment, **audio}


# ---- Post-game stats ----
# Highlightly's /matches/{id} returns rich per-team box score numbers
# (shots, hits, faceoff %, PP %, blocks, PIM, giveaways/takeaways). We
# normalize to the compact shape the RecapShow panel expects: two team
# blocks with a `stats` object keyed by human-friendly display name.

POSTGAME_STATS_TTL = 6 * 3600  # (informational — uses default cache TTL)


@api.get("/recap-show/post-game-stats")
async def recap_show_post_game_stats(match_id: int):
    """Comparison box score for a completed match. Returns null-safe
    empty payload if Highlightly is disabled or the game has no stats.

    Also includes the Ticker Model overlay — derived xG / High-Danger
    Chances, the Game Control Score /100, and the objective Game Story
    bullets. All computed deterministically from the box score (no LLM)."""
    cache_key = ("postgame-stats-v4", match_id)
    cached = _cache_get(cache_key)
    if cached is not None:
        return {"cached": True, **cached}
    stats = await highlightly.get_match_stats(match_id)
    if not stats:
        return {"ready": False, "match_id": match_id}
    from game_story import compute_game_story
    story_bundle = compute_game_story(stats)
    payload = {"ready": True, **stats}
    if story_bundle.get("ready"):
        payload["control"] = story_bundle["control"]
        payload["derived"] = story_bundle["derived"]
        payload["story"]   = story_bundle["story"]
    _cache_set(cache_key, payload)
    return {"cached": False, **payload}


# ---------- Fast-reel audition (per-game short-clip preview) ----------

# Ordering priority — most exciting stuff first when Highlightly doesn't give
# us proper game timestamps. Goals up top, then set-piece goals, then saves.
_REEL_CATEGORY_ORDER = [
    "overtime-shootout-goal",
    "hat-trick",
    "goal",
    "power-play-goal",
    "shorthanded-goal",
    "save",
    "hit-check",
    "fight",
    "assist-play",
    "viral-moment",
    "match-highlights",  # last — the long recap is the fallback, not the star
]


@api.get("/audition/fast-reel")
async def audition_fast_reel(match_id: int):
    """Return every clip Highlightly has for a game, sorted for a shorts-
    style auto-advance reel. `short_clips` are the 30-90s cuts (goals,
    saves, hits). `long_clip` is the 7-10min match-highlights fallback.
    Frontend uses this to power the /audition/fast-reel/:matchId preview."""
    clips = await highlightly.get_by_match(match_id, limit=40)
    # Sort by category priority. Within the same category, keep API order.
    def order_key(c):
        cat = c.get("category") or "other"
        try:
            return (_REEL_CATEGORY_ORDER.index(cat), 0)
        except ValueError:
            return (len(_REEL_CATEGORY_ORDER), 0)
    short_clips = [c for c in clips if c.get("category") != "match-highlights" and c.get("embed_url")]
    long_clips  = [c for c in clips if c.get("category") == "match-highlights" and c.get("embed_url")]
    short_clips.sort(key=order_key)
    # Pull matchup metadata from the first clip if available
    matchup = None
    if clips:
        home = clips[0].get("home_team")
        away = clips[0].get("away_team")
        if home and away:
            matchup = f"{away} @ {home}"
    return {
        "match_id": match_id,
        "matchup": matchup,
        "short_clips": [
            {
                "id": c.get("id"),
                "title": c.get("title"),
                "category": c.get("category"),
                "embed_url": c.get("embed_url"),
                "source_url": c.get("source_url"),
                "channel": c.get("channel"),
                "home_team": c.get("home_team"),
                "away_team": c.get("away_team"),
            }
            for c in short_clips
        ],
        "long_clip": (
            {
                "id": long_clips[0].get("id"),
                "title": long_clips[0].get("title"),
                "embed_url": long_clips[0].get("embed_url"),
                "source_url": long_clips[0].get("source_url"),
            }
            if long_clips else None
        ),
    }


@api.get("/audition/play-by-play")
async def audition_play_by_play(match_id: int):
    """Rich per-goal play-by-play for a game.

    Combines two sources:
      - **NHL public API** — every goal event with scorer, both assists,
        exact period+time, score-at-time, situation (EV/PP/SH/EN).
      - **Highlightly** — best-effort video-clip pairing (chronological
        1-to-1 match with NHL goals; leftover goals are stats-only).

    Response shape:
      {
        "match_id": 244354,
        "matchup": "WPG @ CHI",
        "away_team": "WPG", "home_team": "CHI",
        "away_logo": "...", "home_logo": "...",
        "plays": [
          {
            "seq": 1, "period": 1, "time": "10:40",
            "team_code": "CHI", "team_logo": "...",
            "scorer": "Nick Foligno", "assist1": null, "assist2": null,
            "away_score": 0, "home_score": 1,
            "situation": "PP", "shot_type": "snap",
            "clip": { "embed_url": "...", "id": 123 }   // null if no video
          }, ...
        ]
      }
    """
    # 1) Highlightly match metadata (date + team codes)
    ms = await highlightly.get_match_stats(match_id)
    if not ms:
        return {"ready": False, "match_id": match_id}
    home = ms.get("home", {}).get("team", {}) or {}
    away = ms.get("away", {}).get("team", {}) or {}
    home_code = (home.get("abbreviation") or "").upper()
    away_code = (away.get("abbreviation") or "").upper()
    # Highlightly match_stats has no date field — pull it from the /matches endpoint.
    date_str = None
    try:
        async with httpx.AsyncClient(timeout=15) as h:
            r = await h.get(f"{highlightly.base_url}/matches/{match_id}", headers=highlightly._headers())
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list):
                    data = data[0] if data else {}
                date_str = (data.get("date") or "")[:10]  # YYYY-MM-DD prefix
    except Exception:
        pass

    # 2) Highlightly clips for this match (video pairing pool)
    clips = await highlightly.get_by_match(match_id, limit=40)
    goal_clips = [
        c for c in clips
        if c.get("category") in ("goal", "power-play-goal", "shorthanded-goal", "overtime-shootout-goal")
        and c.get("embed_url")
    ]
    # Post-game interviews — presser + player/coach post-match content.
    # Everything Highlightly has, embed-only. Displayed at the tail of the
    # individual-highlights list (broadcast wrap feel).
    interview_clips = [
        {
            "id": c.get("id"),
            "title": c.get("title"),
            "category": c.get("category"),
            "channel": c.get("channel"),
            "embed_url": c.get("embed_url"),
            "source_url": c.get("source_url"),
        }
        for c in clips
        if c.get("category") in ("post-match-content", "press-conference")
        and c.get("embed_url")
    ]

    # 3) NHL play-by-play
    nhl_goals: list[dict] = []
    async with httpx.AsyncClient(timeout=15) as http_client:
        nhl_id = await pbp_client.find_nhl_game_id(http_client, date_str, home_code, away_code)
        if nhl_id:
            nhl_goals = await pbp_client.get_goals_for_game(http_client, nhl_id)

    # 4) Pair NHL goals with Highlightly clips chronologically (best effort).
    #    Skip shootout attempts — they're not really "highlight clips".
    regulation_goals = [g for g in nhl_goals if not g.get("shootout")]
    plays: list[dict] = []
    for i, g in enumerate(regulation_goals):
        clip = goal_clips[i] if i < len(goal_clips) else None
        plays.append({
            "seq": i + 1,
            **g,
            "team_logo": (
                home.get("logo") if g.get("team_code") == home_code
                else away.get("logo") if g.get("team_code") == away_code
                else None
            ),
            "clip": (
                {"id": clip.get("id"), "embed_url": clip.get("embed_url"), "source_url": clip.get("source_url")}
                if clip else None
            ),
        })

    return {
        "ready": True,
        "match_id": match_id,
        "nhl_game_id": nhl_id if nhl_id else None,
        "matchup": f"{away_code} @ {home_code}" if home_code and away_code else None,
        "home_team": home_code, "away_team": away_code,
        "home_logo": home.get("logo"), "away_logo": away.get("logo"),
        "plays": plays,
        "interviews": interview_clips,
    }


# ---------- Live scoreboard (demo mode today, real feed later) ----------

@api.get("/live/state")
async def live_state(since: str | None = None):
    """Current scoreboard snapshot + events (optionally only newer than
    the given ISO timestamp). Frontend polls this every ~5s."""
    live_engine.start()  # idempotent — kicks the demo ticker on first hit
    return live_engine.state(since=since)


@api.post("/live/force-goal")
async def live_force_goal(game_id: str | None = None):
    """Manual trigger — fires a goal on the given game (or any live one).
    Handy for investor demos and QA."""
    return live_engine.force_goal(game_id)


@api.post("/live/reset")
async def live_reset():
    """Rewind the demo back to fresh 0-0 games."""
    live_engine.reset()
    return {"ok": True}


# ---------- Radio stations ----------

@api.get("/radio/station/{team_code}")
async def radio_station(team_code: str):
    """Return the flagship radio station for a team (if seeded)."""
    station = radio_lookup(team_code)
    if not station:
        return {"team_code": team_code.upper(), "available": False}
    return {"team_code": team_code.upper(), "available": True, **station}


@api.get("/radio/stations")
async def radio_stations():
    """All seeded stations, keyed by team code."""
    return {"stations": radio_list_all()}





# ---------- Predictions ----------
def _live_start_iso(base_iso: str, offset_hours: float) -> str:
    """Return the stored start_iso if it's in the future, otherwise return
    a slot on the NEXT upcoming evening so the demo/voting flow stays live.
    Uses `offset_hours` (minutes of variation between games) so tonight's
    slate keeps its 30-minute stagger."""
    try:
        stored = datetime.fromisoformat(base_iso.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if stored > now:
            return base_iso
        # Pick the next 7pm ET (00:00 UTC next day) if it's already past today.
        # Simple and reliable across timezones.
        anchor = now.replace(hour=23, minute=0, second=0, microsecond=0)
        if anchor <= now:
            from datetime import timedelta as _td
            anchor = anchor + _td(days=1)
        from datetime import timedelta as _td
        return (anchor + _td(hours=offset_hours)).isoformat().replace("+00:00", "Z")
    except Exception:
        return base_iso


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
    for idx, g in enumerate(GAMES):
        votes = tally.get(g["id"], {"home": 0, "away": 0})
        total = votes["home"] + votes["away"]
        # Stagger tonight's slate by 30 minutes so kickoffs feel real.
        live_iso = _live_start_iso(g["start_iso"], offset_hours=idx * 0.5)
        out.append({
            **g,
            "start_iso": live_iso,
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

    # Lock picks once the puck drops. Users can change their mind up until
    # game start, but never after. Guards against late-swaps that would
    # game the community tally. We use the LIVE (demo-shifted) start_iso
    # so pick-lock lines up with what /predictions/games returns to the UI.
    try:
        idx = next((i for i, x in enumerate(GAMES) if x["id"] == inp.game_id), 0)
        live_iso = _live_start_iso(game["start_iso"], offset_hours=idx * 0.5)
        start = datetime.fromisoformat(live_iso.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) >= start:
            raise HTTPException(status_code=409, detail="Game already started — picks are locked")
    except HTTPException:
        raise
    except Exception:
        pass

    user_name = inp.user_name.strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Upsert on (user_name, game_id) — allow pick changes until start.
    existing = await db.predictions.find_one({"user_name": user_name, "game_id": inp.game_id})
    if existing:
        await db.predictions.update_one(
            {"user_name": user_name, "game_id": inp.game_id},
            {"$set": {"pick": inp.pick, "reasoning": inp.reasoning.strip(), "updated_at": now_iso}},
        )
        return Prediction(
            id=existing.get("id"),
            user_name=user_name,
            game_id=inp.game_id,
            pick=inp.pick,
            reasoning=inp.reasoning.strip(),
            created_at=existing.get("created_at", now_iso),
        )

    pred = Prediction(
        user_name=user_name,
        game_id=inp.game_id,
        pick=inp.pick,
        reasoning=inp.reasoning.strip(),
        created_at=now_iso,
    )
    await db.predictions.insert_one(pred.model_dump())
    return pred


@api.get("/predictions/mine")
async def my_predictions(user_name: str):
    """Every pick this user has ever made. Frontend uses this to hydrate
    the pick state so a user's calls persist across sessions."""
    q = {"user_name": user_name}
    docs = await db.predictions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"predictions": docs}


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
        home_or_away=payload.home_or_away,
        fav_or_dog=payload.fav_or_dog,
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


# --------------------------------------------------------------------
# Betting IQ — Spot Check (vertical slice).
# See /app/backend/betting_coach.py for recommendation logic + Marc's
# voice templates. This endpoint asks: "given my past, is THIS spot a
# LEAN IN / NEUTRAL / SKIP?" It is the "sometimes the answer is: don't
# bet tonight" muscle of Betting IQ.
# --------------------------------------------------------------------
import betting_coach as _bc  # noqa: E402


class SpotCheckReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=1, max_length=128)
    bet_type: str = Field(min_length=1, max_length=40)
    home_or_away: Optional[str] = None   # 'home' | 'away' | null
    fav_or_dog: Optional[str] = None     # 'fav' | 'dog' | 'over' | 'under' | null


@api.post("/betting/spot-check")
async def betting_spot_check(payload: SpotCheckReq):
    """Given a proposed spot, return LEAN IN / NEUTRAL / SKIP + evidence
    + Marc's line. Uses only THIS device's bet history."""
    cursor = db.bet_log.find({"device_id": payload.device_id})
    bets = []
    async for r in cursor:
        r.pop("_id", None)
        bets.append(r)
    return _bc.spot_check(bets, payload.bet_type, payload.home_or_away, payload.fav_or_dog)


class SeedTestBettorReq(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str = Field(min_length=1, max_length=128)
    replace: bool = True   # wipe existing bets for this device before seeding


@api.post("/betting/seed-test-bettor")
async def betting_seed_test_bettor(payload: SeedTestBettorReq):
    """Dev-only: seed a realistic bet log for one test bettor so Spot Check
    has meaningful signal. Not exposed in production UI. Idempotent when
    replace=True."""
    if payload.replace:
        await db.bet_log.delete_many({"device_id": payload.device_id})
    seeds = _bc.build_seed_bets(payload.device_id)
    if seeds:
        await db.bet_log.insert_many(seeds)
    return {"seeded": len(seeds), "device_id": payload.device_id}



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
