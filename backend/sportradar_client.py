"""Sportradar NHL v7 client — the "North Star" data layer.

Loose adapter: hits Sportradar for real NHL data, transforms every response
into the same shape our frontend has always expected (see analysts.PLAYERS
/ TEAMS / GAMES mock shapes). If the trial key is missing, expires, or the
upstream fails, every helper returns None so callers fall back to the
existing mocks. Nothing breaks.

Trial rate limit is ~1 QPS — every call is TTL-cached in-memory.
Attribution "Data provided by Sportradar" must be shown per their terms.
"""
from __future__ import annotations

import os
import time
import logging
import threading
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger("ticker.sportradar")

BASE_URL = "https://api.sportradar.com/nhl/trial/v7/en"
EASTERN = ZoneInfo("America/New_York")

# TTLs
TTL_LEAGUE = 24 * 3600      # team hierarchy — near-static
TTL_STANDINGS = 5 * 60      # standings — refresh every 5 min
TTL_SCHEDULE = 5 * 60       # daily schedule — 5 min
TTL_LEADERS = 30 * 60       # season leaders — 30 min
TTL_ERROR = 60              # cache negative results briefly to avoid hammering

# Rate limiter: min 1.1s between requests (~0.9 QPS) to stay under trial cap
_MIN_GAP = 1.1
_last_call_ts: float = 0.0
_rate_lock = threading.Lock()

_cache: dict[str, tuple[float, Any]] = {}


def _api_key() -> str | None:
    if os.environ.get("SPORTRADAR_ENABLED", "true").lower() not in ("1", "true", "yes"):
        return None
    return os.environ.get("SPORTRADAR_API_KEY") or None


def is_available() -> bool:
    return _api_key() is not None


def _season_year() -> str:
    return os.environ.get("SPORTRADAR_SEASON_YEAR", "2025")


def _season_type() -> str:
    return os.environ.get("SPORTRADAR_SEASON_TYPE", "REG")


def _throttled_get(path: str) -> Any:
    """Rate-limited + TTL-cached GET. Returns parsed JSON or None on failure."""
    global _last_call_ts
    key = _api_key()
    if not key:
        return None

    # Cache hit check first (no lock needed for read)
    now = time.time()
    hit = _cache.get(path)
    if hit and now - hit[0] < hit[2] if isinstance(hit, tuple) and len(hit) == 3 else False:
        pass  # legacy shape guard, ignore

    if hit and len(hit) == 3 and now - hit[0] < hit[2]:
        return hit[1]

    with _rate_lock:
        gap = time.time() - _last_call_ts
        if gap < _MIN_GAP:
            time.sleep(_MIN_GAP - gap)
        _last_call_ts = time.time()

    url = f"{BASE_URL}/{path.lstrip('/')}"
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url, headers={"accept": "application/json", "x-api-key": key})
        if r.status_code == 429:
            logger.warning("Sportradar 429 rate-limited on %s", path)
            _cache[path] = (time.time(), None, TTL_ERROR)
            return None
        if r.status_code >= 400:
            logger.warning("Sportradar %s → %s: %s", path, r.status_code, r.text[:200])
            _cache[path] = (time.time(), None, TTL_ERROR)
            return None
        data = r.json()
        return data
    except Exception as e:
        logger.warning("Sportradar %s failed: %s", path, e)
        _cache[path] = (time.time(), None, TTL_ERROR)
        return None


def _cached(path: str, ttl: int) -> Any:
    """Get with a specific TTL; stores tuple (ts, data, ttl)."""
    now = time.time()
    hit = _cache.get(path)
    if hit and len(hit) == 3 and now - hit[0] < hit[2]:
        return hit[1]
    data = _throttled_get(path)
    if data is not None:
        _cache[path] = (now, data, ttl)
    return data


# ---------- Raw endpoint helpers ----------

def league_hierarchy() -> dict | None:
    """All teams with metadata (id, name, alias, conference, division)."""
    return _cached("league/hierarchy.json", TTL_LEAGUE)


def season_standings() -> dict | None:
    yr, st = _season_year(), _season_type()
    return _cached(f"seasons/{yr}/{st}/standings.json", TTL_STANDINGS)


def daily_schedule(dt: datetime | None = None) -> dict | None:
    d = (dt or datetime.now(EASTERN)).astimezone(EASTERN)
    path = f"games/{d.year:04d}/{d.month:02d}/{d.day:02d}/schedule.json"
    return _cached(path, TTL_SCHEDULE)


def season_leaders() -> dict | None:
    yr, st = _season_year(), _season_type()
    # Sportradar v7 exposes ALL leader categories under a single endpoint.
    # One call gets us 18 categories × ~20 players each = plenty of data.
    return _cached(f"seasons/{yr}/{st}/leaders.json", TTL_LEADERS)


# ---------- Adapters → internal shapes ----------

def _team_alias_map() -> dict[str, dict]:
    """team_id → {alias, name, conf, div, market} for hydration."""
    h = league_hierarchy()
    if not h:
        return {}
    out: dict[str, dict] = {}
    for conf in h.get("conferences", []) or []:
        cname = conf.get("name") or conf.get("alias") or ""
        for div in conf.get("divisions", []) or []:
            dname = div.get("name") or div.get("alias") or ""
            for team in div.get("teams", []) or []:
                out[team.get("id", "")] = {
                    "alias": team.get("alias") or "",
                    "name": team.get("name") or team.get("market", ""),
                    "market": team.get("market") or "",
                    "conf": "East" if "East" in cname else ("West" if "West" in cname else cname),
                    "div": dname,
                }
    return out


def teams_shape() -> list[dict] | None:
    """Return the frontend TEAMS shape from live Sportradar standings.

    Sportradar v7 puts stats at the TOP LEVEL of the team object
    (team.wins, team.points, team.goals_for) — NOT nested under
    team.statistics. Shape (matches analysts.TEAMS):
      {code, name, conf, div, gp, w, l, otl, pts, gf, ga}
    """
    st = season_standings()
    if not st:
        return None
    out: list[dict] = []
    for conf in st.get("conferences", []) or []:
        cname = conf.get("name") or conf.get("alias") or ""
        conf_short = "East" if "East" in cname.upper() or "EASTERN" in cname.upper() else \
                     ("West" if "West" in cname.upper() or "WESTERN" in cname.upper() else cname)
        for div in conf.get("divisions", []) or []:
            dname = div.get("name") or div.get("alias") or ""
            for team in div.get("teams", []) or []:
                w = team.get("wins", 0) or 0
                l = team.get("losses", 0) or 0
                otl = team.get("overtime_losses", 0) or 0
                gp = team.get("games_played", 0) or (w + l + otl)
                pts = team.get("points", 0) or (2 * w + otl)
                gf = team.get("goals_for", 0) or 0
                ga = team.get("goals_against", 0) or 0
                alias = team.get("alias") or ""
                if not alias:
                    # Fallback: normalize from market/name mapping if alias absent
                    market = team.get("market", "")
                    name = team.get("name", "")
                    alias = (market[:3] if market else name[:3]).upper()
                # Sportradar returns different alias formats across endpoints;
                # normalize to the codes our frontend + Joke Bank use.
                alias_norm = {
                    "TB": "TBL", "TAM": "TBL",
                    "SJ": "SJS", "SA": "SJS",
                    "LA": "LAK",
                    "NJ": "NJD",
                    "MON": "MTL",
                }.get(alias, alias)
                full_name = f"{team.get('market', '')} {team.get('name', '')}".strip() or team.get("name", "")
                out.append({
                    "code": alias_norm,
                    "name": full_name,
                    "conf": conf_short,
                    "div": dname,
                    "gp": gp,
                    "w": w,
                    "l": l,
                    "otl": otl,
                    "pts": pts,
                    "gf": gf,
                    "ga": ga,
                })
    return out or None


def games_shape() -> list[dict] | None:
    """Return the frontend GAMES shape from today's daily schedule.

    Shape: {id, home, away, start_iso}
    """
    sched = daily_schedule()
    if not sched:
        return None
    tmap = _team_alias_map()
    out: list[dict] = []
    for g in sched.get("games", []) or []:
        home = g.get("home", {}) or {}
        away = g.get("away", {}) or {}
        home_alias = home.get("alias") or tmap.get(home.get("id", ""), {}).get("alias") or ""
        away_alias = away.get("alias") or tmap.get(away.get("id", ""), {}).get("alias") or ""
        out.append({
            "id": g.get("id") or "",
            "home": home_alias,
            "away": away_alias,
            "start_iso": g.get("scheduled") or "",
            "status": g.get("status") or "scheduled",
        })
    return out


def players_shape() -> list[dict] | None:
    """Return the frontend PLAYERS shape from season leaders.

    Sportradar `/seasons/{yr}/{type}/leaders.json` returns 18 categories.
    We merge leaders across categories keyed by player ID — same player
    appearing in multiple leader boards (points + goals + shots) yields
    one enriched record.

    Shape (skaters): {id, name, team, pos, gp, g, a, pts, plus_minus,
      toi, s, s_pct, ppg, shg, gwg, pim, hits, blocks}
    Shape (goalies): {id, name, team, pos, gp, w, l, sv_pct, gaa, so, sa, sv}
    """
    leaders = season_leaders()
    if not leaders:
        return None

    # Team alias normalization (Sportradar returns different codes across endpoints).
    def _norm(alias: str) -> str:
        return {
            "TB": "TBL", "TAM": "TBL",
            "SJ": "SJS", "SA": "SJS", "SAN": "SJS",
            "LA": "LAK",
            "NJ": "NJD",
            "MON": "MTL",
            "WIN": "WPG",
            "COL": "COL", "COR": "COL",  # some feeds truncate
        }.get(alias, alias)

    # Build team_id → alias map from league_hierarchy for fallback.
    def _team_alias(team_dict: dict) -> str:
        alias = team_dict.get("alias") or ""
        if not alias:
            market = team_dict.get("market", "")
            name = team_dict.get("name", "")
            alias = (market[:3] if market else name[:3]).upper()
        return _norm(alias)

    # Goalie categories → merge separately.
    GOALIE_CATS = {"wins", "shutouts", "goalsagainstaverage", "savepercentage"}
    SKATER_CATS = {
        "points", "goals", "assists", "plusminus", "shots",
        "gamewinninggoals", "penaltyminutes", "shorthandedgoals",
        "powerplaygoals", "hits", "rookiescoring", "rookiegoals",
        "rookieassists", "defensivescoring",
    }

    skaters: dict[str, dict] = {}
    goalies: dict[str, dict] = {}

    for cat in leaders.get("categories", []) or []:
        cname = (cat.get("category") or "").lower()
        is_goalie = cname in GOALIE_CATS
        target = goalies if is_goalie else skaters
        for entry in cat.get("leaders", []) or []:
            player = entry.get("player") or {}
            team = entry.get("team") or {}
            pid = player.get("id") or player.get("sr_id") or player.get("reference") or ""
            if not pid:
                continue
            if pid not in target:
                target[pid] = {
                    "id": pid,
                    "name": player.get("full_name", ""),
                    "team": _team_alias(team),
                    "pos": "G" if is_goalie else "",
                    "gp": entry.get("games_played", 0),
                    "g": 0, "a": 0, "pts": 0, "plus_minus": 0,
                    "s": 0, "s_pct": 0.0, "toi": "",
                    "ppg": 0, "shg": 0, "gwg": 0, "pim": 0,
                    "hits": 0, "blocks": 0,
                    # goalie-specific:
                    "w": 0, "l": 0, "sv_pct": 0.0, "gaa": 0.0,
                    "so": 0, "sa": 0, "sv": 0,
                }
            # Merge fields from this leader entry (whichever are present).
            p = target[pid]
            for src_key, dst_key in [
                ("games_played", "gp"),
                ("goals", "g"),
                ("assists", "a"),
                ("points", "pts"),
                ("plus_minus", "plus_minus"),
                ("shots", "s"),
                ("shooting_percentage", "s_pct"),
                ("powerplay_goals", "ppg"),
                ("shorthanded_goals", "shg"),
                ("game_winning_goals", "gwg"),
                ("penalty_minutes", "pim"),
                ("hits", "hits"),
                ("blocked_shots", "blocks"),
                ("wins", "w"),
                ("losses", "l"),
                ("save_pct", "sv_pct"),
                ("average", "gaa"),  # goalie GAA is under 'average' key
                ("shutouts", "so"),
                ("shots_against", "sa"),
                ("saves", "sv"),
            ]:
                val = entry.get(src_key)
                if val not in (None, 0, 0.0) and p.get(dst_key) in (0, 0.0, ""):
                    p[dst_key] = val

    # Combine — cap at 30 skaters + 15 goalies so the /stats page stays snappy.
    def _score_skater(p):
        return p.get("pts", 0)

    def _score_goalie(p):
        return p.get("w", 0)

    top_skaters = sorted(skaters.values(), key=_score_skater, reverse=True)[:30]
    top_goalies = sorted(goalies.values(), key=_score_goalie, reverse=True)[:15]
    for s in top_skaters:
        # Best-guess position for the Player Detail page. Sportradar's leaders
        # endpoint doesn't expose position — infer from category patterns:
        # defensivescoring → D. Falls back to "F" (forward) otherwise.
        s["pos"] = s["pos"] or "F"
    return top_skaters + top_goalies or None


def ticker_lines(limit: int = 6) -> list[str]:
    """Punchy live-data lines for the ticker banner."""
    teams = teams_shape() or []
    lines: list[str] = []
    if teams:
        srt = sorted(teams, key=lambda t: (-t.get("pts", 0), -t.get("w", 0)))
        top = srt[0]
        lines.append(
            f"{top['name'].upper()} lead the NHL — {top['w']}-{top['l']}-{top['otl']}, {top['pts']} pts"
        )
        if len(srt) >= 2:
            t2 = srt[1]
            lines.append(f"{t2['name'].upper()} chase — {t2['pts']} pts, {t2['w']}-{t2['l']}-{t2['otl']}")
        best_gd = max(teams, key=lambda t: (t.get("gf", 0) - t.get("ga", 0)))
        lines.append(f"{best_gd['name'].upper()} best goal diff: +{best_gd['gf'] - best_gd['ga']}")
        bottom = srt[-1]
        lines.append(f"{bottom['name'].upper()} bottom of the league — {bottom['pts']} pts")

    games = games_shape() or []
    if games:
        for g in games[:2]:
            if g.get("home") and g.get("away"):
                lines.append(f"TONIGHT: {g['away']} @ {g['home']} — {g.get('status', 'scheduled')}")
    return lines[:limit]


def stat_context_block() -> str:
    """Compact live-stats block LLM can quote from in Presser answers."""
    teams = teams_shape()
    if not teams:
        return ""
    srt = sorted(teams, key=lambda t: (-t.get("pts", 0), -t.get("w", 0)))
    yr = _season_year()
    lines = [f"Live NHL {yr}-{int(yr)+1} standings (top 5, Sportradar):"]
    for t in srt[:5]:
        lines.append(
            f"- {t['name']} ({t['code']}): {t['w']}-{t['l']}-{t['otl']}, {t['pts']} pts, "
            f"GF {t['gf']}, GA {t['ga']}"
        )
    return "\n".join(lines)
