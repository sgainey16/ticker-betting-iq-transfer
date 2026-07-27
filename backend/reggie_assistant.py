"""Reggie Assistant — Back Office chat with talk + do.

The user chats with Reggie on the Back Office page. Reggie can:
  - answer app / feature / tier questions
  - proactively surface features they haven't tried
  - PROPOSE actions (set favorites, load fantasy roster, log a bet)
    which the user then taps Confirm on before anything writes to DB.

Actions are never executed autonomously. Reggie emits an
<action_proposal>{json}</action_proposal> block inside his reply; the
backend strips the block, ships a structured proposal to the frontend,
and only executes when the user calls /assistant/reggie/action with the
proposal_id.
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

# Full NHL 3-letter team code set — for parsing user natural language.
VALID_TEAM_CODES = {
    "ANA","ARI","BOS","BUF","CGY","CAR","CHI","COL","CBJ","DAL","DET",
    "EDM","FLA","LAK","MIN","MTL","NSH","NJD","NYI","NYR","OTT","PHI",
    "PIT","SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK","WSH","WPG",
}

# City / nickname → canonical 3-letter code (loose parsing for user input).
TEAM_ALIASES = {
    "edmonton":"EDM","oilers":"EDM","oil":"EDM",
    "colorado":"COL","avalanche":"COL","avs":"COL",
    "toronto":"TOR","maple leafs":"TOR","leafs":"TOR",
    "boston":"BOS","bruins":"BOS","b's":"BOS",
    "tampa":"TBL","tampa bay":"TBL","lightning":"TBL","bolts":"TBL",
    "florida":"FLA","panthers":"FLA","cats":"FLA",
    "carolina":"CAR","hurricanes":"CAR","canes":"CAR",
    "vegas":"VGK","golden knights":"VGK","knights":"VGK",
    "new york rangers":"NYR","rangers":"NYR",
    "new york islanders":"NYI","islanders":"NYI",
    "new jersey":"NJD","devils":"NJD",
    "vancouver":"VAN","canucks":"VAN",
    "dallas":"DAL","stars":"DAL",
    "winnipeg":"WPG","jets":"WPG",
    "minnesota":"MIN","wild":"MIN",
    "seattle":"SEA","kraken":"SEA",
    "los angeles":"LAK","kings":"LAK","la kings":"LAK",
    "san jose":"SJS","sharks":"SJS",
    "anaheim":"ANA","ducks":"ANA",
    "calgary":"CGY","flames":"CGY",
    "chicago":"CHI","blackhawks":"CHI","hawks":"CHI",
    "detroit":"DET","red wings":"DET","wings":"DET",
    "columbus":"CBJ","blue jackets":"CBJ","jackets":"CBJ",
    "st louis":"STL","st. louis":"STL","blues":"STL",
    "nashville":"NSH","predators":"NSH","preds":"NSH",
    "buffalo":"BUF","sabres":"BUF",
    "montreal":"MTL","canadiens":"MTL","habs":"MTL",
    "ottawa":"OTT","senators":"OTT","sens":"OTT",
    "philadelphia":"PHI","flyers":"PHI",
    "pittsburgh":"PIT","penguins":"PIT","pens":"PIT",
    "washington":"WSH","capitals":"WSH","caps":"WSH",
    "utah":"UTA","hockey club":"UTA",
}


def normalize_team_input(text: str) -> Optional[str]:
    """Given a fragment ('Oilers', 'edm', 'Colorado Avalanche') → 'EDM'."""
    if not text:
        return None
    t = text.strip().lower()
    if t.upper() in VALID_TEAM_CODES:
        return t.upper()
    if t in TEAM_ALIASES:
        return TEAM_ALIASES[t]
    # Loose contains-check for phrases with the alias inside
    for alias, code in TEAM_ALIASES.items():
        if alias in t:
            return code
    return None


# ------- Reggie's assistant persona -------

REGGIE_ASSISTANT_SYSTEM = """You are REGGIE BANKS, the lead anchor of The Ticker sports desk.
Right now you're NOT on the broadcast — you're helping this user navigate their Back Office (settings)
page. You're the same personality (warm, funny, ex-player energy, storytelling), but you've stepped
off the desk to help them get set up.

===== YOUR JOB =====
1. Answer questions about how The Ticker works: features, pages, tiers, personalization, data sources.
2. Surface features they haven't tried yet — but nudge, don't nag.
3. Reduce their typing. When they ask you to save/load/log something, you can DO it for them via
   an action proposal (see below), but only THEY can confirm the action executes.
4. If they ask about hockey, players, matchups, or predictions — those are for the BROADCAST or
   PRESSER. Point them there warmly: "That's a presser question, kid — grab me at the presser
   and I'll give it the full room." Do NOT try to answer NHL-analysis questions here.

===== TONE MODES =====
- Casual Q&A: light and bantery, HOCKEY-warm. Keep it 2-4 sentences.
- Explaining mechanics: clearer, more direct. Still in character. No corporate support-bot voice.
- Confirming an action: brief. One line, then propose the action card.

NEVER say "as an AI." NEVER emoji. NEVER sound like a script.

===== APP KNOWLEDGE =====
The Ticker is an AI-powered sports desk. Phase 1 = NHL only.

Pages:
- BROADCAST (Home): 2-host panel show (you + Marc). Real matchup talk, live audio.
- PRESSER: 1-on-1 Q&A with you. User asks anything, you answer with voiced audio.
- STATS: NHL leaders, standings, matchups. Every skater and goalie name is clickable → player detail page.
- FANTASY DESK: user's fantasy roster with a Health Score, Start/Sit calls, Waivers, Injury Watch, and takes.
- BACK OFFICE (where you are now): settings — preferences, voices, Betting IQ log, roster load.

Features:
- Betting IQ: log real bets, track ROI + accuracy with confidence bands. Prediction-only bets supported.
- Fantasy Desk: roster health score, start/sit, waivers.
- Voice picker: swap your voice from the candidates.
- Favorite teams: filters the show.
- Predictions: user picks nightly matchups against you and Marc.

Data status right now: some player stats are mocked while we finalize with data partners.
The panel show and voices are real.

===== ACTION PROPOSALS =====
When the user asks you to save/load/log info, you MUST reply naturally AND emit a JSON action proposal
wrapped in tags like this, at the end of your reply:

<action_proposal>{"kind": "set_favorites", "payload": {"teams": ["EDM","CGY"]}, "summary": "Save Edmonton (EDM) + Calgary (CGY) as your favorites"}</action_proposal>

Valid kinds:
- set_favorites: payload = {"teams": ["<3-letter code>", ...]}
- load_roster: payload = {"players": [{"name": "...", "team": "<3-letter or empty>", "pos": "<C/LW/RW/D/G>"}, ...]}
- log_bet: payload = {"bet_date": "YYYY-MM-DD", "matchup": "AWAY @ HOME", "bet_type": "Spread|Moneyline|Total|Prop", "selection": "...", "odds": "2.10", "stake": 50.0, "result": "Pending|Win|Loss|Push", "profit_loss": 0, "notes": "..."}

CRITICAL:
- If a required field is missing or ambiguous, ASK before proposing (e.g. "What stake did you put down?").
- Never propose an action the user didn't ask for.
- Always confirm the details back in your reply so the user can double-check before tapping Confirm.
- Only ONE action proposal per reply.
- If they just want an answer, no action, don't emit a proposal — just answer.

===== CONTEXT ABOUT THIS USER =====
{user_state}

Their most useful nudges right now (mention naturally if relevant, don't dump them all):
{nudges}
"""


async def build_user_state(db, device_id: str) -> dict:
    """Read what this user has (or hasn't) done — feeds Reggie's system prompt."""
    sub = await db.subscribers.find_one({"device_id": device_id}, {"_id": 0}) or {}
    roster_doc = await db.rosters.find_one({"device_id": device_id}, {"_id": 0}) or {}
    bet_count = await db.bet_log.count_documents({"device_id": device_id})

    roster = roster_doc.get("roster") or []
    favs = roster_doc.get("favorite_teams") or []
    non_empty_roster = [p for p in roster if (p or {}).get("name", "").strip()]

    return {
        "device_id": device_id,
        "is_premium": sub.get("is_premium", False),
        "questions_used": sub.get("questions_used", 0),
        "first_seen": sub.get("created_at") or roster_doc.get("updated_at") or "",
        "favorite_teams": favs,
        "has_favorite_teams": len(favs) > 0,
        "roster_size": len(non_empty_roster),
        "has_roster": len(non_empty_roster) >= 3,
        "bets_logged": bet_count,
        "has_logged_bet": bet_count > 0,
        "league_name": roster_doc.get("league_name", ""),
    }


def build_nudges(state: dict) -> list[dict]:
    """Rotating 2-3 suggested prompts based on what they haven't done yet.
    Frontend renders these as clickable chips above the input field."""
    nudges: list[dict] = []
    if not state["has_favorite_teams"]:
        nudges.append({
            "id": "n-favs",
            "label": "Set my favorite teams",
            "prompt": "Set my favorite teams so the panel show knows what to lead with.",
        })
    if not state["has_roster"]:
        nudges.append({
            "id": "n-roster",
            "label": "Load my fantasy roster",
            "prompt": "Help me load my fantasy roster into the Fantasy Desk.",
        })
    if not state["has_logged_bet"]:
        nudges.append({
            "id": "n-bet",
            "label": "Log my first bet",
            "prompt": "Walk me through logging my first bet in the Betting IQ tab.",
        })
    if state["has_favorite_teams"] and state["has_roster"] and state["has_logged_bet"]:
        nudges.append({
            "id": "n-nav-fantasy",
            "label": "Break down my fantasy team",
            "prompt": "Take me through what my Fantasy Desk is telling me right now.",
        })
    # Always-available "how does X work" chip
    if len(nudges) < 3:
        nudges.append({
            "id": "n-explain-app",
            "label": "How does The Ticker work?",
            "prompt": "Give me the quick tour — what's actually on this app?",
        })
    return nudges[:3]


ACTION_TAG_RE = re.compile(r"<action_proposal>(.*?)</action_proposal>", re.DOTALL)


def extract_action_proposal(text: str) -> tuple[str, Optional[dict]]:
    """Strip the <action_proposal>{json}</action_proposal> block from Reggie's
    reply. Returns (clean_text, proposal_dict_or_None)."""
    m = ACTION_TAG_RE.search(text)
    if not m:
        return text.strip(), None
    raw = m.group(1).strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return text.strip(), None
    proposal_id = str(uuid.uuid4())
    parsed["id"] = proposal_id
    parsed.setdefault("summary", "")
    parsed["created_at"] = datetime.now(timezone.utc).isoformat()
    clean = ACTION_TAG_RE.sub("", text).strip()
    return clean, parsed


def format_state_for_prompt(state: dict) -> str:
    lines = []
    lines.append(f"- Favorite teams saved: {'yes ('+ ', '.join(state['favorite_teams']) +')' if state['has_favorite_teams'] else 'no'}")
    lines.append(f"- Fantasy roster loaded: {'yes ('+str(state['roster_size'])+' players)' if state['has_roster'] else 'no'}")
    lines.append(f"- Bets logged in Betting IQ: {state['bets_logged']}")
    lines.append(f"- Premium tier: {'yes' if state['is_premium'] else 'no (free tier)'}")
    lines.append(f"- Questions asked at the Presser so far: {state['questions_used']}")
    return "\n".join(lines)


async def execute_action(db, device_id: str, kind: str, payload: dict) -> dict:
    """Run a confirmed action. Returns a small result dict for the UI to render."""
    if kind == "set_favorites":
        teams_raw = payload.get("teams") or []
        teams = []
        for t in teams_raw:
            code = normalize_team_input(str(t))
            if code and code not in teams:
                teams.append(code)
        if not teams:
            return {"ok": False, "message": "Couldn't figure out which teams — try codes like EDM, TOR."}
        # Merge into existing roster doc (preserve roster, notes, league_name).
        existing = await db.rosters.find_one({"device_id": device_id}, {"_id": 0}) or {}
        existing["device_id"] = device_id
        existing["favorite_teams"] = teams
        existing["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.rosters.update_one(
            {"device_id": device_id}, {"$set": existing}, upsert=True,
        )
        return {"ok": True, "message": f"Saved {', '.join(teams)} as your favorite teams."}

    if kind == "load_roster":
        players_raw = payload.get("players") or []
        cleaned = []
        for p in players_raw:
            if not isinstance(p, dict):
                continue
            name = str(p.get("name", "")).strip()
            if not name:
                continue
            team_code = normalize_team_input(str(p.get("team", ""))) or (str(p.get("team", "")).upper() if len(str(p.get("team", ""))) <= 3 else "")
            pos = str(p.get("pos", "")).strip().upper()[:2]
            cleaned.append({"name": name, "team": team_code or "", "pos": pos})
        if not cleaned:
            return {"ok": False, "message": "I need at least one player name to load a roster."}
        # Pad/trim to 6 slots to match the UI expectation.
        while len(cleaned) < 6:
            cleaned.append({"name": "", "team": "", "pos": ""})
        cleaned = cleaned[:6]
        existing = await db.rosters.find_one({"device_id": device_id}, {"_id": 0}) or {}
        existing["device_id"] = device_id
        existing["roster"] = cleaned
        existing["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.rosters.update_one(
            {"device_id": device_id}, {"$set": existing}, upsert=True,
        )
        return {"ok": True, "message": f"Loaded {sum(1 for p in cleaned if p['name'])} players onto your Fantasy Desk."}

    if kind == "log_bet":
        try:
            stake = float(payload.get("stake", 0) or 0)
        except (TypeError, ValueError):
            stake = 0.0
        try:
            pl = float(payload.get("profit_loss", 0) or 0)
        except (TypeError, ValueError):
            pl = 0.0
        bet = {
            "id": str(uuid.uuid4()),
            "device_id": device_id,
            "bet_date": (payload.get("bet_date") or datetime.now(timezone.utc).date().isoformat())[:10],
            "matchup": str(payload.get("matchup", "")).strip(),
            "bet_type": str(payload.get("bet_type", "Moneyline")).strip() or "Moneyline",
            "selection": str(payload.get("selection", "")).strip(),
            "odds": str(payload.get("odds", "")).strip(),
            "stake": stake,
            "result": str(payload.get("result", "Pending")).strip() or "Pending",
            "profit_loss": pl,
            "notes": str(payload.get("notes", "")).strip(),
            "prediction_only": bool(payload.get("prediction_only", False)),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if not bet["selection"] and not bet["matchup"]:
            return {"ok": False, "message": "I need at least the matchup or the selection to log a bet."}
        await db.bet_log.insert_one(bet)
        return {"ok": True, "message": f"Logged: {bet['selection'] or bet['matchup']} ({bet['bet_type']}, ${bet['stake']:.2f})."}

    return {"ok": False, "message": f"Unknown action: {kind}"}
