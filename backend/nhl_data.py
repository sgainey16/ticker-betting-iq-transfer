"""NHL live data service — SportsData.io wrapper with an in-memory 5-min TTL
cache so we don't burn the free-trial quota. Falls back silently when the
key is missing or the API returns empty, so downstream code can always use
the return value directly.
"""
from __future__ import annotations

import os
import time
import logging
from datetime import datetime
from typing import Any, Callable
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger("ticker.nhl_data")

BASE_URL = "https://api.sportsdata.io/v3/nhl"
CACHE_TTL = 300  # 5 minutes

# Current NHL season parameter — the year the season concludes. Update yearly.
CURRENT_SEASON = "2026"
EASTERN = ZoneInfo("America/New_York")

_cache: dict[str, tuple[float, Any]] = {}


def _api_key() -> str | None:
    return os.environ.get("SPORTSDATA_API_KEY") or None


def _get_json(endpoint: str) -> Any:
    """Hit SportsData.io with the subscription-key header. Cached for 5min.
    Returns None on any failure so callers can gracefully fall back."""
    key = _api_key()
    if not key:
        return None
    now = time.time()
    hit = _cache.get(endpoint)
    if hit and now - hit[0] < CACHE_TTL:
        return hit[1]
    url = f"{BASE_URL}/{endpoint}"
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(url, headers={"Ocp-Apim-Subscription-Key": key})
        if r.status_code != 200:
            logger.warning("SportsData %s → %s", endpoint, r.status_code)
            return None
        data = r.json()
        _cache[endpoint] = (now, data)
        return data
    except Exception as e:
        logger.warning("SportsData %s failed: %s", endpoint, e)
        return None


def is_available() -> bool:
    return _api_key() is not None


# ---- Public read helpers ----

def standings(season: str = CURRENT_SEASON) -> list[dict] | None:
    return _get_json(f"scores/json/Standings/{season}")


def today_games() -> list[dict] | None:
    """Games for today in US Eastern time (which is how SportsData.io slots
    game days)."""
    today = datetime.now(EASTERN).strftime("%Y-%b-%d").upper()
    return _get_json(f"scores/json/GamesByDate/{today}")


def games_by_date(date_str: str) -> list[dict] | None:
    return _get_json(f"scores/json/GamesByDate/{date_str}")


def team_roster(team_code: str) -> list[dict] | None:
    return _get_json(f"scores/json/Players/{team_code.upper()}")


def all_players() -> list[dict] | None:
    return _get_json("scores/json/Players")


# ---- Higher-level composites ----

def _pts(t: dict) -> int:
    """SportsData.io free tier omits the Points field — compute it the
    standard NHL way: 2 for a W, 1 for an OTL."""
    if t.get("Points"):
        return int(t["Points"])
    return int((t.get("Wins") or 0) * 2 + (t.get("OvertimeLosses") or 0))


def ticker_headlines(limit: int = 8) -> list[str]:
    """Punchy one-line stat/story blurbs for the ticker banner. Blends live
    standings with a handful of durable narrative lines so the ticker stays
    alive even when there are no games today."""
    lines: list[str] = []

    st = standings()
    if st:
        # Sort by computed points desc, tie-break by wins.
        sorted_teams = sorted(
            st, key=lambda t: (-_pts(t), -(t.get("Wins") or 0))
        )
        top = sorted_teams[0]
        lines.append(
            f"{(top.get('Name') or '').upper()} lead the NHL — "
            f"{top.get('Wins',0)}-{top.get('Losses',0)}-{top.get('OvertimeLosses',0)}, "
            f"{_pts(top)} pts"
        )
        if len(sorted_teams) >= 2:
            t2 = sorted_teams[1]
            lines.append(
                f"{(t2.get('Name') or '').upper()} sit second — "
                f"{_pts(t2)} pts on {t2.get('Wins',0)}-{t2.get('Losses',0)}-{t2.get('OvertimeLosses',0)}"
            )
        # Best win %
        best_pct = max(st, key=lambda t: t.get("Percentage") or 0)
        lines.append(
            f"{(best_pct.get('Name') or '').upper()} pace the league in win % — "
            f".{int(round((best_pct.get('Percentage') or 0)*1000)):03d}"
        )
        # Most shutout wins
        so_leader = max(st, key=lambda t: t.get("ShutoutWins") or 0)
        if (so_leader.get("ShutoutWins") or 0) > 0:
            lines.append(
                f"{(so_leader.get('Name') or '').upper()} lead the NHL in shutouts "
                f"— {so_leader.get('ShutoutWins',0)}"
            )
        # Bottom
        bottom = sorted_teams[-1]
        lines.append(
            f"{(bottom.get('Name') or '').upper()} bottom of the league — {_pts(bottom)} pts"
        )
        # Clinched division/playoff callouts
        clinched = [t for t in st if t.get("ClinchedPlayoffBerth") or t.get("ClinchedDivision")]
        if clinched:
            names = ", ".join((c.get("Name") or "").upper() for c in clinched[:3])
            lines.append(f"CLINCHED: {names}")

    games = today_games()
    if games:
        for g in games[:2]:
            lines.append(
                f"TONIGHT: {g.get('AwayTeam','?')} @ {g.get('HomeTeam','?')} "
                f"— {g.get('Status') or 'scheduled'}"
            )
    elif st:
        lines.append("No games on the schedule tonight — the desk is still on")

    return lines[:limit]


def league_leaders_context() -> str:
    """A compact stat context block the LLM can quote from. Uses standings
    (which the trial tier reliably serves) rather than player-season-stats
    (which the trial tier does not)."""
    st = standings()
    if not st:
        return "Live NHL data is not available right now."
    sorted_teams = sorted(st, key=lambda t: (-_pts(t), -(t.get("Wins") or 0)))
    lines = [f"Live NHL {CURRENT_SEASON} standings (top 5):"]
    for t in sorted_teams[:5]:
        lines.append(
            f"- {t.get('Name')} ({t.get('Key')}): "
            f"{t.get('Wins',0)}-{t.get('Losses',0)}-{t.get('OvertimeLosses',0)}, "
            f"{_pts(t)} pts, win% .{int(round((t.get('Percentage') or 0)*1000)):03d}"
        )
    return "\n".join(lines)
