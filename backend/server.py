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
    quick_fallback_line,
)
from voice_service import ensure_audio, audio_url_for

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
    return {"items": TICKER_ITEMS}


@api.get("/suggested-questions")
async def suggested_questions():
    return {"questions": SUGGESTED_QUESTIONS}


@api.get("/banter")
async def banter(topic: str = "league_wide"):
    """Return a full multi-turn desk banter script for the homepage. Each turn
    includes an audio_url (pre-generated + cached on disk via ElevenLabs)."""
    turns = pick_banter(topic)
    enriched = []
    for t in turns:
        audio_url = ensure_audio(t["speaker"], t["text"])
        enriched.append({**t, "audio_url": audio_url})
    return {"topic": topic, "turns": enriched}


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
                    "The user just walked up to the desk mid-broadcast and dropped a "
                    "single word or short phrase — a team, a player, a topic. Fire back "
                    "ONE quick in-character line. Max 22 words. No preamble, no 'great "
                    "topic', no emoji. Land the point. Substance under the joke."
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


@api.get("/stats/players")
async def stats_players():
    return {"players": PLAYERS}


@api.get("/stats/teams")
async def stats_teams():
    return {"teams": TEAMS}


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
    session_id = req.session_id or str(uuid.uuid4())

    system_message = (
        f"{analyst['system_prompt']}\n\n"
        f"You are answering a viewer question live on The Ticker (NHL desk).\n\n"
        f"{stat_context}\n\n"
        "Use these stats when relevant. If the numbers don't support a direct answer, "
        "acknowledge that in character and offer the closest angle you would defend on air."
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

        yield f"event: done\ndata: {json.dumps({'session_id': session_id})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ---------- Predictions ----------
@api.get("/predictions/games")
async def predictions_games():
    return {"games": GAMES}


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
        {"user_name": user_name, "resolved": True}, {"_id": 0, "correct": 1, "created_at": 1}
    ).sort("created_at", -1)
    streak = 0
    async for d in cursor:
        if d.get("correct"):
            streak += 1
        else:
            break
    return {
        "user_name": user_name,
        "total": total,
        "resolved": resolved,
        "correct": correct,
        "accuracy": accuracy,
        "streak": streak,
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


app.include_router(api)

# Serve generated audio via /api/audio/* so the ingress routes it correctly
# (Kubernetes ingress only forwards /api/* to the backend). Kept /static as
# well for any local debugging.
app.mount("/api/audio", StaticFiles(directory=str(STATIC_DIR / "audio")), name="api_audio")
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
