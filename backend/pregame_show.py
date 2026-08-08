"""Pregame segment generator — a single game's Reggie/Marc script.

The Tonight game hub deep-link (`/tonight/:gameId`) fetches this so the
banter on-screen ALWAYS matches the game the user tapped into. Uses the
same Emergent LLM key + Claude Sonnet as the Recap show, but the tense is
present/future ("Watch the D-pair tonight…") and the ask is short: one
Reggie hook + one Marc analytical read.

Cached in-process per (game_id, home, away, panel picks) tuple so repeat
loads and pick-changes don't burn LLM calls.
"""
from __future__ import annotations

import json
import logging
import os
import re

log = logging.getLogger(__name__)

# Character voices — same as recap_show but tense-flipped for pregame.
REGGIE_VOICE = (
    "REGGIE BANKS — former NHL forward, lead anchor. Fast, confident, "
    "streetwise. Loves stars and skill. Locker-room humour and family/"
    "travel references. Talks like he's on a barstool. Ends thoughts with a "
    "punch, not a period. NEVER 'furthermore/moreover/however'. Never sounds "
    "like ChatGPT.\n\n"
    "REGGIE MOVIE-QUOTE RULE: Reggie MAY drop a single iconic movie quote "
    "straight-faced, uncredited, no impersonation — but ONLY if the on-ice "
    "moment genuinely calls for exactly those words. This is a once-a-year "
    "bit at product scale. Default to silence. If in doubt, do not use one. "
    "Never reference the source film."
)
MARC_VOICE = (
    "MARC COLLINS — former NHL analyst-type defenseman, calm co-host. Laughs "
    "BEFORE he speaks. Protects players. Explains coaching choices. Redirects "
    "Reggie's hot takes with a stat that gives the story weight. SHORT "
    "sentences — max 12 words before a period. Uses 'look', 'here's the "
    "thing', 'watch the D-pair'. Never sounds like ChatGPT."
)

# In-memory cache. Key includes panel picks so pick-changes retrigger a
# fresh script. Live-updates are rare enough that a dict works fine.
_CACHE: dict[str, dict] = {}


def _emergent_llm_key() -> str | None:
    return os.environ.get("EMERGENT_LLM_KEY") or os.environ.get("EMERGENT_API_KEY")


def _cache_key(game: dict) -> str:
    return "|".join([
        str(game.get("id")),
        str(game.get("home")),
        str(game.get("away")),
        str(game.get("reggie_pick")),
        str(game.get("marc_pick")),
    ])


def _fallback(game: dict, home_stats: dict | None, away_stats: dict | None) -> dict:
    """Deterministic template — used when the LLM key is missing or the call
    fails. Keeps the deep-link feeling alive even offline."""
    home = game.get("home") or "HOME"
    away = game.get("away") or "AWAY"
    reggie_pick_code = home if game.get("reggie_pick") == "home" else away
    marc_pick_code = home if game.get("marc_pick") == "home" else away
    reggie_hook = (
        f"Alright — {away} in on {home} tonight. This is one I've had circled. "
        f"I like {reggie_pick_code} in this spot — they play the game the way I "
        f"want to watch it."
    )
    stat_bits = []
    if home_stats and home_stats.get("gf_per_game") is not None:
        stat_bits.append(f"{home} at {home_stats['gf_per_game']:.2f} goals for a game")
    if away_stats and away_stats.get("pk_pct") is not None:
        stat_bits.append(f"{away} penalty kill at {away_stats['pk_pct']:.1f}%")
    stat_str = ". ".join(stat_bits) or "The numbers cut both ways"
    marc_read = (
        f"Look. {stat_str}. I've got {marc_pick_code}. Watch the special "
        f"teams. That's the game."
    )
    return {
        "reggie_hook": reggie_hook,
        "marc_read": marc_read,
        "stat_line": f"{home} vs {away} · Puck-drop preview",
        "source": "template",
    }


async def _llm_script(game: dict, home_stats: dict | None, away_stats: dict | None) -> dict | None:
    """Batched Claude call → per-game reggie_hook + marc_read."""
    key = _emergent_llm_key()
    if not key:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:  # noqa: BLE001
        log.warning("emergentintegrations import failed: %s", e)
        return None

    home = game.get("home") or "HOME"
    away = game.get("away") or "AWAY"
    reggie_pick_code = home if game.get("reggie_pick") == "home" else away
    marc_pick_code = home if game.get("marc_pick") == "home" else away

    def _stat_block(code: str, s: dict | None) -> str:
        if not s:
            return f"{code}: (stats unavailable)"
        return (
            f"{code}: {s.get('w', '?')}-{s.get('l', '?')}-{s.get('otl', '?')} · "
            f"{s.get('gf_per_game', 0):.2f} GF/GP · {s.get('ga_per_game', 0):.2f} GA/GP · "
            f"PP {s.get('pp_pct', 0):.1f}% · PK {s.get('pk_pct', 0):.1f}% · "
            f"L10 {s.get('last_10', '?')}"
        )

    system_message = (
        "You are the writing staff for THE TICKER, an AI-hosted hockey desk. "
        "You are writing a PREGAME segment — the game has NOT happened yet. "
        "Reggie and Marc are prepping the audience for tonight's puck-drop.\n\n"
        f"{REGGIE_VOICE}\n\n{MARC_VOICE}\n\n"
        "TENSE — CRITICAL: PREGAME. Say 'watch for', 'I like', 'the edge is', "
        "'tonight'. NEVER past tense — the game hasn't happened yet.\n\n"
        "COACH-NOT-CASINO: reference picks and stats but never gambling odds "
        "or lines. Reggie and Marc give reads, not bet slips.\n\n"
        "OUTPUT STRICT JSON — no prose, no markdown. Schema:\n"
        "{\n"
        '  "reggie_hook": "2-3 sentences. Reggie sets the game up with a story, chirp, or bold take. Names his pick. Personality first.",\n'
        '  "marc_read":   "2-3 SHORT sentences. Marc gives the analytical read grounded in a real-sounding stat from the block below. Names his pick. Max 12 words per sentence.",\n'
        '  "stat_line":   "4-8 word standalone stat for a chyron (e.g. \'MacKinnon: 12-game point streak on road\')"\n'
        "}\n\n"
        "GUIDELINES:\n"
        "- Both hosts must reference the specific matchup ({away} at {home}) by team name or city.\n"
        "- Reggie's pick is preset — do NOT flip it.\n"
        "- Marc's pick is preset — do NOT flip it. Marc's stat should support his pick.\n"
        "- Never mention 'AI', 'model', or gambling lines.\n"
    )

    user_prompt = (
        f"MATCHUP: {away} @ {home}\n"
        f"REGGIE'S PICK: {reggie_pick_code}\n"
        f"MARC'S PICK: {marc_pick_code}\n\n"
        f"TEAM SNAPSHOT:\n"
        f"  {_stat_block(home, home_stats)}\n"
        f"  {_stat_block(away, away_stats)}\n\n"
        "Write the pregame segment for THIS specific matchup. Return JSON only."
    )

    try:
        chat = LlmChat(
            api_key=key,
            session_id=f"pregame-{game.get('id')}",
            system_message=system_message,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=user_prompt))
        text = resp if isinstance(resp, str) else str(resp)
    except Exception as e:  # noqa: BLE001
        log.warning("pregame LLM call failed for %s: %s", game.get("id"), e)
        return None

    cleaned = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if m:
        cleaned = m.group(0)
    try:
        payload = json.loads(cleaned)
    except Exception as e:  # noqa: BLE001
        log.warning("pregame LLM JSON parse failed: %s | body head: %s", e, cleaned[:200])
        return None

    hook = (payload.get("reggie_hook") or "").strip()
    read = (payload.get("marc_read") or "").strip()
    if not hook or not read:
        return None
    return {
        "reggie_hook": hook,
        "marc_read": read,
        "stat_line": (payload.get("stat_line") or "").strip(),
        "source": "llm",
    }


async def generate_segment(game: dict, home_stats: dict | None, away_stats: dict | None) -> dict:
    """Produce a pregame segment for the given game. Cached per game+picks."""
    key = _cache_key(game)
    if key in _CACHE:
        return _CACHE[key]
    llm = await _llm_script(game, home_stats, away_stats)
    result = llm or _fallback(game, home_stats, away_stats)
    result["home"] = game.get("home")
    result["away"] = game.get("away")
    result["game_id"] = game.get("id")
    result["reggie_pick"] = game.get("reggie_pick")
    result["marc_pick"] = game.get("marc_pick")
    _CACHE[key] = result
    return result
