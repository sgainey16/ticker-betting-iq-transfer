"""Recap Show episode generator.

Builds a fully-produced "morning show" manifest for any past NHL date:
- Cold open: Reggie + Marc welcome the audience
- Per-game segments: host hook → clip → host outro → next
- Close: sign-off + tomorrow tease

Two script tracks:
  1) LLM (Claude 4.5 via Emergent LLM key) — richer 2-3 line hooks with
     insight + joke + character voice. One batched call per episode.
  2) Templated — safety fallback if LLM fails or Emergent key missing.

Data sources
- Game clips: Highlightly (verified + embeddable filtered)
- Team logos: Highlightly team map
- Host voice audio: existing voice_service.ensure_audio() (ElevenLabs)
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone

from highlightly_client import highlightly

log = logging.getLogger(__name__)


# =========================================================================
# HOST CHARACTER PROMPTS — short, personality-first, curated for the desk.
# =========================================================================

REGGIE_VOICE = """REGGIE BANKS — former NHL forward. Fast, confident, streetwise. Loves stars and skill.
Chirps players affectionately. Locker-room humour, family/travel/beer-league references. Emotional, bold hot takes.
Uses "buddy", "kid", "the boys", "that's a real one". NEVER sounds like ChatGPT. NEVER "furthermore/moreover/however."
Talks like he's on a barstool. Drops a hockey insight in the middle of a joke — never just facts, never just comedy.
Sees the human in the play. Ends thoughts with a punch, not a period."""

MARC_VOICE = """MARC COLLINS — former NHL analyst-type defenseman. Calm, respected, laughs BEFORE he speaks.
Protects players from over-criticism. Explains coaching decisions. Redirects Reggie's hot takes with a stat that gives
the story weight — xG, CF%, PDO, save %, zone starts, faceoff wins, blocks, high-danger chances. Warm but sharp.
Never lectures. Uses "look", "here's the thing", "watch the D-pair", "over the sample". Never sounds like ChatGPT.
CADENCE — CRITICAL: Marc speaks in SHORT sentences. Never run-ons. Max 12 words before a period.
If a thought has multiple parts, use TWO short sentences with a period between them — not a comma or a dash.
He breathes at the periods. Long clauses joined by commas make him sound out of breath. Bad: "The Oilers were
sharp, and their power play, which has been struggling all month, finally clicked in the second, which set up
the win." Good: "The Oilers were sharp. Their power play finally clicked. That set up the win."
"""

CE_RULES = """COMMENTARY ENGINE RULES:
- Layer 1: state what happened plainly. Layer 2: instant reaction ("Ooof", "Oh!", "Yikes"). Layer 3: character voice.
- Content mix target: 60% analysis / 20% story / 10% humor / 5% history / 5% prediction.
- NEVER joke during injuries, memorials, tragedies. NO gambling promotion — coach, not casino.
- No repetition of the same comparison across segments. Fresh every game.
- Two, maybe three sentences per host beat. Punchy. Broadcast rhythm."""


def _emergent_llm_key() -> str | None:
    return os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("EMERGENT_API_KEY")


async def _llm_script_all_games(date_str: str, segments: list[dict]) -> dict | None:
    """Batched Claude call → Reggie/Marc lines for all games at once."""
    key = _emergent_llm_key()
    if not key or not segments:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:  # noqa: BLE001
        log.warning("emergentintegrations import failed: %s", e)
        return None

    game_lines = []
    for s in segments:
        away = s["away"].get("name") or s["away"].get("code")
        home = s["home"].get("name") or s["home"].get("code")
        cat = s["clip"].get("category") or "match-highlights"
        title = (s["clip"].get("title") or "").strip()
        game_lines.append(
            f'  {{"match_id": {s["match_id"]}, "away": "{away}", "home": "{home}", '
            f'"category": "{cat}", "clip_title": "{title[:120]}"}}'
        )
    games_json = ",\n".join(game_lines)

    system_message = (
        f"You are the writing staff for THE TICKER, an AI-hosted hockey sports desk. "
        f"You write dialogue for two hosts recapping NHL games from {date_str} — the MORNING AFTER. "
        f"EVERY game on this show has already been played. Reggie and Marc watched them and are now "
        f"reviewing them with the audience.\n\n"
        f"{REGGIE_VOICE}\n\n{MARC_VOICE}\n\n{CE_RULES}\n\n"
        "TENSE RULE — CRITICAL:\n"
        "- All hosts speak in PAST TENSE about the games. The games are DONE. Final score is known.\n"
        "- Say 'McDavid buried it', not 'McDavid will bury it'. Say 'the D-pair got caved in', "
        "  not 'watch the D-pair — they'll get caved in'.\n"
        "- NEVER use 'watch for', 'keep an eye on', 'coming up', 'tonight', 'later', 'expect', "
        "  'look for X to Y', 'will', 'is going to'. Those are pregame phrasings.\n"
        "- Present-tense reactions ARE allowed ('that's a beauty', 'ooof', 'oh my') because "
        "  the host is reacting to a clip we just watched. But the game itself is past.\n\n"
        "OUTPUT STRICT JSON — no prose, no markdown. Schema:\n"
        "{\n"
        '  "cold_open": {"reggie": "...", "marc": "..."},\n'
        '  "segments":  [{"match_id": <int>, "reggie_hook": "...", "marc_outro": "...", "stat_line": "..."}],\n'
        '  "close":     {"marc": "...", "reggie": "..."}\n'
        "}\n\n"
        "GUIDELINES:\n"
        "- Cold open (Reggie): welcomes the audience to the morning-after show and tees up what we're about to review from LAST NIGHT. Marc: grounds it with the night's stakes and how the standings shifted.\n"
        "- Each `reggie_hook`: 2-3 sentences. Recaps the game with a story, a chirp, or a bold take about what already happened. Personality FIRST.\n"
        "- Each `marc_outro`: 2-3 SHORT sentences (max 12 words each). Drops ONE real-sounding advanced stat from the game that already ended, then transitions to the next recap. Marc breathes at the periods — never string clauses with commas.\n"
        "- `stat_line`: 4-8 word standalone stat for a lower-third graphic (e.g. \"McDavid: 3rd multi-point night in a row\").\n"
        "- Every line must sound like a broadcast, never a chatbot. If a line has 'furthermore', 'moreover', or 'in conclusion' — rewrite it.\n"
        "- No two games use the same joke framing.\n"
    )

    user_prompt = (
        f"Date: {date_str} — the games below already happened last night. You are writing "
        f"the morning-after recap show. All hosts speak in PAST TENSE about the games themselves.\n\n"
        f"Games (already played, in order):\n[\n{games_json}\n]\n\n"
        "Return the JSON now."
    )

    try:
        chat = LlmChat(
            api_key=key,
            session_id=f"recap-script-{date_str}",
            system_message=system_message,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=user_prompt))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:  # noqa: BLE001
        log.warning("recap LLM call failed: %s", e)
        return None

    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if m:
        cleaned = m.group(0)
    try:
        payload = json.loads(cleaned)
    except Exception as e:  # noqa: BLE001
        log.warning("recap LLM JSON parse failed: %s | body head: %s", e, cleaned[:200])
        return None

    if not isinstance(payload, dict) or not isinstance(payload.get("segments"), list):
        return None
    segs_by_id = {}
    for row in payload["segments"]:
        try:
            mid = int(row.get("match_id"))
        except Exception:  # noqa: BLE001
            continue
        segs_by_id[mid] = {
            "reggie_hook": (row.get("reggie_hook") or "").strip(),
            "marc_outro": (row.get("marc_outro") or "").strip(),
            "stat_line": (row.get("stat_line") or "").strip(),
        }
    return {
        "cold_open": payload.get("cold_open") or {},
        "segments": segs_by_id,
        "close": payload.get("close") or {},
    }


# =========================================================================
# TEMPLATED FALLBACK — used only if the LLM call fails / key missing.
# =========================================================================

REGGIE_COLD_OPENS = [
    "Welcome to The Ticker. Big night around the league — let's roll the tape.",
    "You're on The Ticker. Coffee's on, tape's cued up, let's get to it.",
]
MARC_COLD_OPENS = [
    "Wildcard math got interesting. Story, tape, stat, next — let's go.",
    "Playoff picture shifted. Same format as always. Let's roll.",
]
REGGIE_HOOKS_BY_CAT = {
    "goals": "{away} at {home} — this one had teeth. Watch what {away_short} did on that rush.",
    "match-highlights": "{away} rolled into {home} last night. Here's how it played out.",
    "hits-fights": "{away} at {home} got chippy. Real hockey. Take a look.",
    "saves": "{home} goalie stood on his head against {away}. Watch this save.",
    "default": "{away} at {home} — one worth going back to. Here's the tape.",
}
MARC_OUTROS_BY_CAT = {
    "goals": "That was the third {away_short} goal like it this month. Habits over hope. Next.",
    "match-highlights": "Special teams told the whole story last night. On we go.",
    "hits-fights": "Momentum shifted after the scrum — you could feel it. Next matchup.",
    "saves": "That save was the game. Difference-maker. To the next one.",
    "default": "Numbers backed it up. Watch the tape twice, you'll see it. Next game.",
}
REGGIE_CLOSES = [
    "That's the tape. Tomorrow: bigger night, tighter races. See you at the desk.",
    "Cards on the table for tomorrow. Coach, not casino.",
]
MARC_CLOSES = [
    "Standings updated on the Stats tab. Take it easy.",
    "Predictions open on the Predict tab. See you tomorrow.",
]


def _pick(bucket: list[str], seed: int) -> str:
    return bucket[seed % len(bucket)]


def _category_bucket(cat: str | None) -> str:
    if not cat:
        return "default"
    if cat in {"goal", "power-play-goal", "shorthanded-goal",
               "overtime-shootout-goal", "hat-trick"}:
        return "goals"
    if cat == "match-highlights":
        return "match-highlights"
    if cat in {"hit-check", "fight"}:
        return "hits-fights"
    if cat == "save":
        return "saves"
    return "default"


def _short_name(team_name: str | None, code: str | None) -> str:
    if not team_name:
        return code or "the visitors"
    parts = team_name.split()
    return parts[-1] if parts else team_name


async def _group_by_game(clips: list[dict], logo_map: dict) -> list[dict]:
    """Fold flat clip list into one segment per game. Skip games with no
    embeddable clip (user rule: 'nobody will know')."""
    by_match: dict[int, dict] = {}
    for c in clips:
        mid = c.get("match_id")
        if mid is None:
            continue
        if mid not in by_match:
            by_match[mid] = {"clips": [], "home": c.get("home_team"), "away": c.get("away_team")}
        by_match[mid]["clips"].append(c)

    segments: list[dict] = []
    for mid, bucket in by_match.items():
        embeddable = [c for c in bucket["clips"] if c.get("embeddable") and c.get("embed_url")]
        if not embeddable:
            continue
        hero = next((c for c in embeddable if c.get("category") == "match-highlights"), embeddable[0])
        home_meta = logo_map.get(bucket["home"] or "") or {}
        away_meta = logo_map.get(bucket["away"] or "") or {}
        segments.append({
            "match_id": mid,
            "home": {
                "code": bucket["home"],
                "name": home_meta.get("name") or bucket["home"],
                "logo_url": home_meta.get("logo_url"),
            },
            "away": {
                "code": bucket["away"],
                "name": away_meta.get("name") or bucket["away"],
                "logo_url": away_meta.get("logo_url"),
            },
            "clip": {
                "id": hero.get("id"),
                "title": hero.get("title"),
                "embed_url": hero.get("embed_url"),
                "source_url": hero.get("source_url"),
                "category": hero.get("category"),
                "channel": hero.get("channel"),
            },
        })
    return segments


def _templated_hook_outro(seg: dict) -> tuple[str, str]:
    cat_bucket = _category_bucket(seg["clip"].get("category"))
    away_short = _short_name(seg["away"].get("name"), seg["away"].get("code"))
    ctx = {
        "away": seg["away"].get("name") or seg["away"].get("code") or "the visitors",
        "home": seg["home"].get("name") or seg["home"].get("code") or "the home team",
        "away_short": away_short,
    }
    hook = REGGIE_HOOKS_BY_CAT.get(cat_bucket, REGGIE_HOOKS_BY_CAT["default"]).format(**ctx)
    outro = MARC_OUTROS_BY_CAT.get(cat_bucket, MARC_OUTROS_BY_CAT["default"]).format(**ctx)
    return hook, outro


async def generate_episode(date_str: str) -> dict:
    """Produce a full recap show episode for a given YYYY-MM-DD date."""
    if not highlightly.is_ready():
        return {"date": date_str, "ready": False, "reason": "Highlightly not enabled", "segments": []}

    clips = await highlightly.get_by_date(date_str, limit=40)
    if not clips:
        return {"date": date_str, "ready": False, "reason": "No clips found for date", "segments": []}

    await highlightly._load_teams_if_stale()
    logo_map: dict[str, dict] = {}
    for t in highlightly._team_by_code.values():
        code = (t.get("abbreviation") or "").upper()
        if code:
            logo_map[code] = {
                "name": t.get("displayName") or t.get("name"),
                "logo_url": t.get("logo"),
            }

    segments = await _group_by_game(clips, logo_map)

    # Fan out concurrent /matches/{id} calls so every segment carries its
    # final score. One call per game — Highlightly caps at 8 games so this
    # is cheap. Fills `segment.final = {home, away, state}`.
    import asyncio as _asyncio
    async def _fetch_score(seg):
        try:
            stats = await highlightly.get_match_stats(seg["match_id"])
            if not stats:
                return
            score = stats.get("score") or {}
            current = score.get("current") or ""
            # Highlightly uses "X - Y" where X is away, Y is home. Normalize.
            parts = [p.strip() for p in current.replace("–", "-").split("-")]
            if len(parts) == 2 and all(p.isdigit() for p in parts):
                seg["final"] = {
                    "away_score": int(parts[0]),
                    "home_score": int(parts[1]),
                    "state": stats.get("state") or "FINAL",
                }
        except Exception:
            pass
    await _asyncio.gather(*[_fetch_score(s) for s in segments])

    # Try LLM script first — richer, better voice. Templated fallback if it fails.
    llm_script = await _llm_script_all_games(date_str, segments)
    used_llm = bool(llm_script)

    seed = int(date_str.replace("-", ""))
    if used_llm:
        for i, seg in enumerate(segments):
            override = llm_script["segments"].get(seg["match_id"])
            if override and override["reggie_hook"] and override["marc_outro"]:
                seg["reggie_hook"] = override["reggie_hook"]
                seg["marc_outro"] = override["marc_outro"]
                seg["stat_line"] = override.get("stat_line") or ""
            else:
                hook, outro = _templated_hook_outro(seg)
                seg["reggie_hook"] = hook
                seg["marc_outro"] = outro
                seg["stat_line"] = ""
            seg["order"] = i + 1
        cold_open = {
            "reggie": (llm_script["cold_open"].get("reggie") or _pick(REGGIE_COLD_OPENS, seed)).strip(),
            "marc":   (llm_script["cold_open"].get("marc")   or _pick(MARC_COLD_OPENS, seed)).strip(),
        }
        close = {
            "marc":   (llm_script["close"].get("marc")   or _pick(MARC_CLOSES, seed)).strip(),
            "reggie": (llm_script["close"].get("reggie") or _pick(REGGIE_CLOSES, seed)).strip(),
        }
    else:
        for i, seg in enumerate(segments):
            hook, outro = _templated_hook_outro(seg)
            seg["reggie_hook"] = hook
            seg["marc_outro"] = outro
            seg["stat_line"] = ""
            seg["order"] = i + 1
        cold_open = {"reggie": _pick(REGGIE_COLD_OPENS, seed), "marc": _pick(MARC_COLD_OPENS, seed)}
        close     = {"marc":   _pick(MARC_CLOSES, seed),      "reggie": _pick(REGGIE_CLOSES, seed)}

    return {
        "date": date_str,
        "ready": True,
        "cold_open": cold_open,
        "segments": segments,
        "close": close,
        "stats": {
            "total_games_covered": len(segments),
            "total_clips_available": len(clips),
            "scripting": "llm" if used_llm else "template",
        },
    }
