"""NHL play-by-play enrichment.

Highlightly gives us clips (video). NHL's free public API gives us the
rich event-level data (scorer, assists, time, score-at-time, situation).
This module ties them together so the Recap Show can render a
Play-By-Play panel that reads like a real box score.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

log = logging.getLogger(__name__)

_NHL_BASE = "https://api-web.nhle.com/v1"

# In-process cache: play-by-play is immutable once a game is FINAL, so we
# can cache aggressively. Keyed by NHL gameId → dict of parsed goals.
_pbp_cache: dict[int, dict] = {}


async def _schedule_for_date(client: httpx.AsyncClient, date_str: str) -> list[dict]:
    """Return all NHL games on a given YYYY-MM-DD from NHL's /schedule."""
    try:
        r = await client.get(f"{_NHL_BASE}/schedule/{date_str}")
        r.raise_for_status()
        data = r.json()
    except Exception as e:  # noqa: BLE001
        log.warning("nhl schedule fetch failed for %s: %s", date_str, e)
        return []
    games: list[dict] = []
    for wk in data.get("gameWeek") or []:
        for g in wk.get("games") or []:
            games.append(g)
    return games


async def find_nhl_game_id(client: httpx.AsyncClient, date_str: str, home_code: str, away_code: str) -> int | None:
    """Given YYYY-MM-DD + team abbrevs, return the NHL gameId or None."""
    if not (date_str and home_code and away_code):
        return None
    home = home_code.upper()
    away = away_code.upper()
    games = await _schedule_for_date(client, date_str)
    # Team-code aliases (Highlightly vs NHL sometimes differ).
    ALIASES = {"TB": "TBL", "SJ": "SJS", "NJ": "NJD", "LA": "LAK", "MON": "MTL", "WAS": "WSH"}
    home = ALIASES.get(home, home)
    away = ALIASES.get(away, away)
    for g in games:
        h = (g.get("homeTeam", {}) or {}).get("abbrev", "").upper()
        a = (g.get("awayTeam", {}) or {}).get("abbrev", "").upper()
        h = ALIASES.get(h, h); a = ALIASES.get(a, a)
        if h == home and a == away:
            return g.get("id")
    return None


def _label_situation(code: str) -> str:
    """Turn NHL's 4-digit situationCode into a human label.

    Format: 4 digits = away_goalie | away_skaters | home_skaters | home_goalie.
    Actually per NHL docs it's home_goalie | home_skaters | away_skaters | away_goalie.
    Practically: 1551 = 5v5 (both goalies + 5-a-side), 1541 = home PP,
    1451 = away PP, etc. We compute strength by comparing skater counts.
    """
    if not code or len(code) < 4:
        return "EV"
    try:
        _hg, hs, as_, _ag = int(code[0]), int(code[1]), int(code[2]), int(code[3])
    except ValueError:
        return "EV"
    # Empty-net if a goalie is pulled
    if _hg == 0 or _ag == 0:
        return "EN"
    if hs == as_:
        return "EV"
    return "PP" if hs > as_ else "SH"


def _build_name_map(pbp: dict) -> dict[int, str]:
    names: dict[int, str] = {}
    for r in pbp.get("rosterSpots") or []:
        pid = r.get("playerId")
        first = (r.get("firstName") or {}).get("default", "") or ""
        last = (r.get("lastName") or {}).get("default", "") or ""
        full = f"{first} {last}".strip()
        if pid and full:
            names[pid] = full
    return names


def _build_team_map(pbp: dict) -> dict[int, str]:
    return {
        (pbp.get("homeTeam") or {}).get("id"): (pbp.get("homeTeam") or {}).get("abbrev"),
        (pbp.get("awayTeam") or {}).get("id"): (pbp.get("awayTeam") or {}).get("abbrev"),
    }


async def get_goals_for_game(client: httpx.AsyncClient, nhl_game_id: int) -> list[dict]:
    """Return a list of parsed goal events for the given NHL gameId."""
    if not nhl_game_id:
        return []
    if nhl_game_id in _pbp_cache:
        return _pbp_cache[nhl_game_id]
    try:
        r = await client.get(f"{_NHL_BASE}/gamecenter/{nhl_game_id}/play-by-play")
        r.raise_for_status()
        pbp = r.json()
    except Exception as e:  # noqa: BLE001
        log.warning("nhl pbp fetch failed for %s: %s", nhl_game_id, e)
        return []
    names = _build_name_map(pbp)
    teams = _build_team_map(pbp)
    goals: list[dict] = []
    for p in pbp.get("plays") or []:
        if p.get("typeDescKey") != "goal":
            continue
        d = p.get("details") or {}
        # Skip shootout attempts (period > regulation OT format, or
        # explicit shootout period). Period 5 in NHL = shootout in reg season.
        period_num = (p.get("periodDescriptor") or {}).get("number")
        period_type = (p.get("periodDescriptor") or {}).get("periodType", "")
        is_shootout = period_type == "SO"
        team_id = d.get("eventOwnerTeamId")
        goals.append({
            "period": period_num,
            "period_type": period_type,
            "shootout": is_shootout,
            "time": p.get("timeInPeriod"),
            "away_score": d.get("awayScore"),
            "home_score": d.get("homeScore"),
            "team_code": teams.get(team_id),
            "scorer": names.get(d.get("scoringPlayerId")),
            "assist1": names.get(d.get("assist1PlayerId")) if d.get("assist1PlayerId") else None,
            "assist2": names.get(d.get("assist2PlayerId")) if d.get("assist2PlayerId") else None,
            "situation": _label_situation(p.get("situationCode") or ""),
            "shot_type": d.get("shotType"),
        })
    _pbp_cache[nhl_game_id] = goals
    return goals
