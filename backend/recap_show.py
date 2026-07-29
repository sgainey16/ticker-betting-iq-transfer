"""Recap Show episode generator.

Builds a fully-produced "morning show" manifest for any past NHL date:
- Cold open: Reggie + Marc welcome the audience
- Per-game segments: host hook → clip → host outro → stat pop → next
- Close: sign-off + tomorrow tease

Data sources
- Game clips: Highlightly (verified + embeddable filtered)
- Team logos: Highlightly team map (unblocks the Imagn wait)
- Host voice audio: existing voice_service.ensure_audio() (ElevenLabs)

Manifest is cached in Mongo per-date so we only generate each show once.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from highlightly_client import highlightly

log = logging.getLogger(__name__)


# --- Templated hook lines. Kept short, personality-first. LLM-scripted lines
# can layer on top later — this is the MVP that ships with the show.

REGGIE_COLD_OPENS = [
    "Welcome to The Ticker. Big night around the league — let's roll the tape.",
    "You're on The Ticker. Coffee's on, tape's cued up, let's get to it.",
    "Ticker's live. Let's see what happened out there last night.",
]

MARC_COLD_OPENS = [
    "Wildcard math got interesting. We'll walk you through every game — story, stat, highlight, next.",
    "Playoff picture shifted. Same format as always — story, tape, number, on we go.",
    "Some real hockey played last night. Story, clip, stat, next game — let's go.",
]

REGGIE_HOOKS_BY_CATEGORY = {
    "goals": "{away} at {home} — this one had teeth. Watch what {away_short} did on that rush.",
    "match-highlights": "{away} rolls into {home}. Full recap coming — you're gonna wanna see the third.",
    "hits-fights": "{away} at {home} got chippy. Real hockey. Roll it.",
    "saves": "{home} goalie stood on his head against {away}. Let it play.",
    "default": "{away} at {home} — worth your time. Watch this.",
}

MARC_OUTROS_BY_CATEGORY = {
    "goals": "That's the third {away_short} goal like it this month. Habits over hope. Next.",
    "match-highlights": "Special teams told the whole story there. On we go.",
    "hits-fights": "Momentum shifted right after the scrum — you could feel it. Next matchup.",
    "saves": "That save changes the game. That's your difference-maker. Coming up next.",
    "default": "Numbers back it up. Watch the tape twice, you'll see it. Next game.",
}

REGGIE_CLOSES = [
    "That's the tape. Tomorrow: bigger night, tighter races. See you at the desk.",
    "Cards on the table for tomorrow. We'll be here. Coach, not casino.",
    "Rest up. Big card tomorrow. Ticker signing off.",
]

MARC_CLOSES = [
    "Standings updated on the Stats tab if you want the full picture. Take it easy.",
    "Predictions open on the Predict tab — don't sleep on tomorrow's Vegas game. Later.",
    "Full stats on the Stats tab. See you tomorrow.",
]


def _pick(bucket: list[str], seed: int) -> str:
    return bucket[seed % len(bucket)]


def _category_bucket(cat: str) -> str:
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


def _short_name(team_name: str | None, code: str) -> str:
    if not team_name:
        return code or "the visitors"
    parts = team_name.split()
    return parts[-1] if parts else team_name


async def _group_by_game(clips: list[dict], logo_map: dict) -> list[dict]:
    """Fold the flat clip list into one segment per game.

    We pick ONE hero clip per game — priority order:
      1. match-highlights (full recap) with embed
      2. any embeddable verified clip
    Games with zero embeddable clips are skipped entirely (user's call — no
    fallback UI, "nobody will know").
    """
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
            continue  # skip — user said nobody will know
        # Prefer match-highlights, else first embeddable.
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


def _build_hook_and_outro(seg: dict, idx: int) -> tuple[str, str]:
    """Templated host lines using team metadata. Personality first, brevity always."""
    cat_bucket = _category_bucket(seg["clip"].get("category"))
    away_short = _short_name(seg["away"].get("name"), seg["away"].get("code"))
    ctx = {
        "away": seg["away"].get("name") or seg["away"].get("code") or "the visitors",
        "home": seg["home"].get("name") or seg["home"].get("code") or "the home team",
        "away_short": away_short,
    }
    hook_tmpl = REGGIE_HOOKS_BY_CATEGORY.get(cat_bucket, REGGIE_HOOKS_BY_CATEGORY["default"])
    outro_tmpl = MARC_OUTROS_BY_CATEGORY.get(cat_bucket, MARC_OUTROS_BY_CATEGORY["default"])
    return hook_tmpl.format(**ctx), outro_tmpl.format(**ctx)


async def generate_episode(date_str: str) -> dict:
    """Produce a full recap show episode for a given YYYY-MM-DD date.
    Returns { date, ready, segments, cold_open, close, stats }.
    """
    if not highlightly.is_ready():
        return {"date": date_str, "ready": False, "reason": "Highlightly not enabled", "segments": []}

    # 1) Pull clips for the date (verified only, up to 40 per Highlightly max)
    clips = await highlightly.get_by_date(date_str, limit=40)
    if not clips:
        return {"date": date_str, "ready": False, "reason": "No clips found for date", "segments": []}

    # 2) Team logo map (uses in-memory client cache)
    await highlightly._load_teams_if_stale()
    logo_map: dict[str, dict] = {}
    for t in highlightly._team_by_code.values():
        code = (t.get("abbreviation") or "").upper()
        if code:
            logo_map[code] = {
                "name": t.get("displayName") or t.get("name"),
                "logo_url": t.get("logo"),
            }

    # 3) Group clips → per-game segments (only games with embeddable clips)
    segments = await _group_by_game(clips, logo_map)

    # 4) Layer host hook + outro on each segment
    for i, seg in enumerate(segments):
        hook, outro = _build_hook_and_outro(seg, i)
        seg["reggie_hook"] = hook
        seg["marc_outro"] = outro
        seg["order"] = i + 1

    # 5) Cold open + close (deterministic by date so same day = same lines)
    seed = int(date_str.replace("-", ""))
    cold_open = {
        "reggie": _pick(REGGIE_COLD_OPENS, seed),
        "marc":   _pick(MARC_COLD_OPENS, seed),
    }
    close = {
        "marc":   _pick(MARC_CLOSES, seed),
        "reggie": _pick(REGGIE_CLOSES, seed),
    }

    return {
        "date": date_str,
        "ready": True,
        "cold_open": cold_open,
        "segments": segments,
        "close": close,
        "stats": {
            "total_games_covered": len(segments),
            "total_clips_available": len(clips),
        },
    }
