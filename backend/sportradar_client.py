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
    return _cached(f"seasons/{yr}/{st}/leaders/statistics.json", TTL_LEADERS)


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

    Shape (matches analysts.TEAMS):
      {code, name, conf, div, gp, w, l, otl, pts, gf, ga}
    """
    st = season_standings()
    if not st:
        return None
    tmap = _team_alias_map()
    out: list[dict] = []
    for conf in st.get("conferences", []) or []:
        cname = conf.get("name") or conf.get("alias") or ""
        conf_short = "East" if "East" in cname else ("West" if "West" in cname else cname)
        for div in conf.get("divisions", []) or []:
            dname = div.get("name") or div.get("alias") or ""
            for team in div.get("teams", []) or []:
                rec = team.get("statistics", {}).get("standings", {}) or team.get("statistics", {}) or {}
                # Sportradar sometimes nests under 'record' or top-level; try both
                stats = team.get("statistics", {}) or {}
                w = stats.get("wins") or rec.get("wins") or 0
                l = stats.get("losses") or rec.get("losses") or 0
                otl = stats.get("overtime_losses") or rec.get("overtime_losses") or 0
                gp = stats.get("games_played") or (w + l + otl)
                pts = stats.get("points") or (2 * w + otl)
                gf = stats.get("goals_for") or 0
                ga = stats.get("goals_against") or 0
                alias = team.get("alias") or tmap.get(team.get("id", ""), {}).get("alias") or ""
                name = team.get("name") or team.get("market") or tmap.get(team.get("id", ""), {}).get("name") or ""
                out.append({
                    "code": alias,
                    "name": name,
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

    Sportradar's leaders payload varies — we map best-effort. If unavailable,
    return None so caller falls back to mock.

    Shape (skaters): {id, name, team, pos, gp, g, a, pts, plus_minus, toi, s, s_pct}
    Shape (goalies): {id, name, team, pos, gp, w, l, sv_pct, gaa, so, sa, sv}
    """
    leaders = season_leaders()
    if not leaders:
        return None
    tmap = _team_alias_map()

    def _mk_skater(p: dict) -> dict:
        stats = p.get("statistics", {}) or {}
        total = stats.get("total", stats) or {}
        team = p.get("team") or {}
        return {
            "id": p.get("id", ""),
            "name": p.get("full_name") or p.get("name", ""),
            "team": team.get("alias") or tmap.get(team.get("id", ""), {}).get("alias") or "",
            "pos": p.get("primary_position") or p.get("position", "") or "",
            "gp": total.get("games_played", 0),
            "g": total.get("goals", 0),
            "a": total.get("assists", 0),
            "pts": total.get("points", 0),
            "plus_minus": total.get("plus_minus", 0),
            "toi": total.get("time_on_ice_avg", "") or "",
            "s": total.get("shots", 0),
            "s_pct": total.get("shooting_pct", 0),
            "ppg": total.get("powerplay_goals", 0),
            "shg": total.get("shorthanded_goals", 0),
            "gwg": total.get("game_winning_goals", 0),
            "pim": total.get("penalty_minutes", 0),
            "hits": total.get("hits", 0),
            "blocks": total.get("blocked_shots", 0),
        }

    def _mk_goalie(p: dict) -> dict:
        stats = p.get("statistics", {}) or {}
        total = stats.get("total", stats) or {}
        team = p.get("team") or {}
        return {
            "id": p.get("id", ""),
            "name": p.get("full_name") or p.get("name", ""),
            "team": team.get("alias") or tmap.get(team.get("id", ""), {}).get("alias") or "",
            "pos": "G",
            "gp": total.get("games_played", 0),
            "w": total.get("wins", 0),
            "l": total.get("losses", 0),
            "sv_pct": total.get("save_pct", 0),
            "gaa": total.get("goals_against_avg", 0),
            "so": total.get("shutouts", 0),
            "sa": total.get("shots_against", 0),
            "sv": total.get("saves", 0),
        }

    out: list[dict] = []

    # Sportradar leaders response typically has 'categories' or top-level lists
    # per stat category. We flatten the union.
    seen_ids: set[str] = set()

    def _push(entry: dict, is_goalie: bool):
        pid = entry.get("id", "")
        if pid and pid in seen_ids:
            return
        seen_ids.add(pid)
        out.append(_mk_goalie(entry) if is_goalie else _mk_skater(entry))

    # Try common shapes
    for cat_key in ("categories", "leaders"):
        cats = leaders.get(cat_key)
        if not isinstance(cats, list):
            continue
        for cat in cats:
            cat_name = (cat.get("name") or cat.get("category") or "").lower()
            is_goalie_cat = "goalie" in cat_name or "save" in cat_name or "shutout" in cat_name
            for item in cat.get("players", []) or cat.get("leaders", []) or []:
                _push(item, is_goalie_cat)

    return out or None


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
