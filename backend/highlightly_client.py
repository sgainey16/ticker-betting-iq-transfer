"""Highlightly NHL adapter — normalizes the third-party highlight aggregation
API into the shape our /api/recaps + team-logo endpoints expect.

Auth: single header `x-rapidapi-key`. Base URL from HIGHLIGHTLY_BASE_URL env.

Caching philosophy
- Highlight lists cache in Mongo (24h TTL) — highlights don't change once
  verified, and the 7,500 req/day Pro quota disappears fast without a cache.
- Team-id→logo map is fetched once on first call and held in-process.
- Geo-restriction lookups are per-clip. We only run them when we can't
  otherwise decide (i.e., embedUrl present but state unknown). To conserve
  quota, un-embeddable clips just fall through to source_url without a
  geo check.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

log = logging.getLogger(__name__)

# Highlightly canonical NHL category names — organizes clips into the tabs
# the /recaps page exposes to users.
CATEGORIES = {
    "match-highlights",
    "goal",
    "power-play-goal",
    "shorthanded-goal",
    "overtime-shootout-goal",
    "hat-trick",
    "save",
    "fight",
    "hit-check",
    "assist-play",
    "injury",
    "viral-moment",
    "pre-match-content",
    "post-match-content",
    "press-conference",
    "other",
}

# Public-facing tab groupings — several categories fold into one bucket
# (goals include ppg/shg/otg/hat-trick, etc.) so the /recaps UI stays tidy.
TAB_GROUPS = {
    "all": None,  # no filter
    "goals": {"goal", "power-play-goal", "shorthanded-goal", "overtime-shootout-goal", "hat-trick"},
    "saves": {"save"},
    "hits": {"hit-check", "fight"},
    "recaps": {"match-highlights"},
    "postgame": {"post-match-content", "press-conference"},
    "viral": {"viral-moment"},
}


class HighlightlyClient:
    def __init__(self):
        self._team_by_id: dict[int, dict] = {}
        self._team_by_code: dict[str, dict] = {}
        self._teams_loaded_at: datetime | None = None
        # Shared "most recent date that has verified clips" cache — persists
        # in-process for 6h so /latest-games and /highlights don't each burn
        # a full 40-day walk on cold start.
        self._latest_date_cache: dict | None = None

    @property
    def enabled(self) -> bool:
        return os.environ.get("HIGHLIGHTLY_ENABLED", "false").lower() == "true"

    @property
    def api_key(self) -> str:
        return os.environ.get("HIGHLIGHTLY_API_KEY", "")

    @property
    def base_url(self) -> str:
        return os.environ.get(
            "HIGHLIGHTLY_BASE_URL", "https://nhl.highlightly.net"
        ).rstrip("/")

    def is_ready(self) -> bool:
        return self.enabled and bool(self.api_key)

    def _headers(self) -> dict:
        return {"x-rapidapi-key": self.api_key, "accept": "application/json"}

    # -------- Team logos --------

    async def _load_teams_if_stale(self) -> None:
        """Fetch the NHL team roster once (or every 24h) and index by id + code."""
        if self._teams_loaded_at:
            age = datetime.now(timezone.utc) - self._teams_loaded_at
            if age < timedelta(hours=24) and self._team_by_id:
                return
        try:
            async with httpx.AsyncClient(timeout=15) as http:
                r = await http.get(
                    f"{self.base_url}/teams",
                    headers=self._headers(),
                    params={"league": "NHL"},
                )
            r.raise_for_status()
            payload = r.json()
            # /teams returns a bare array; other endpoints wrap in {"data": [...]}.
            data = payload if isinstance(payload, list) else (payload.get("data") or [])
            self._team_by_id = {}
            self._team_by_code = {}
            for t in data:
                tid = t.get("id")
                code = (t.get("abbreviation") or "").upper()
                if tid is not None:
                    self._team_by_id[tid] = t
                if code:
                    self._team_by_code[code] = t
            self._teams_loaded_at = datetime.now(timezone.utc)
            log.info("highlightly: teams loaded (%d)", len(self._team_by_id))
        except Exception as e:  # noqa: BLE001
            log.warning("highlightly teams load failed: %s", e)

    async def get_team_logo(self, code: str) -> dict | None:
        """Return {code, name, logo_url, id} for a team code, or None."""
        if not self.is_ready():
            return None
        await self._load_teams_if_stale()
        t = self._team_by_code.get(code.upper())
        if not t:
            return None
        return {
            "id": t.get("id"),
            "code": (t.get("abbreviation") or "").upper(),
            "name": t.get("displayName") or t.get("name") or code,
            "logo_url": t.get("logo"),
        }

    async def all_team_logos(self) -> list[dict]:
        if not self.is_ready():
            return []
        await self._load_teams_if_stale()
        return [
            {
                "id": t.get("id"),
                "code": (t.get("abbreviation") or "").upper(),
                "name": t.get("displayName") or t.get("name"),
                "logo_url": t.get("logo"),
            }
            for t in self._team_by_id.values()
        ]

    # -------- Highlights --------

    async def _fetch_highlights(self, params: dict) -> list[dict]:
        # Highlightly caps `limit` at 40 per page. Clamp defensively so callers
        # don't have to know the vendor quirk.
        if "limit" in params:
            try:
                params["limit"] = min(int(params["limit"]), 40)
            except Exception:  # noqa: BLE001
                params["limit"] = 40
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.get(
                f"{self.base_url}/highlights",
                headers=self._headers(),
                params=params,
            )
        if r.status_code >= 400:
            log.warning("highlightly /highlights %s params=%s body=%s",
                        r.status_code, params, r.text[:200])
            return []
        payload = r.json()
        return payload.get("data", []) or []

    def _normalize(self, raw: dict) -> dict:
        """Shape a raw Highlightly highlight into our public schema."""
        embed_url = raw.get("embedUrl") or None
        return {
            "id": raw.get("id"),
            "title": (raw.get("title") or "").strip() or None,
            "description": raw.get("description"),
            "category": raw.get("category") or "other",
            "type": raw.get("type") or "UNVERIFIED",
            "channel": raw.get("channel"),
            "source": raw.get("source"),
            "source_url": raw.get("url"),
            "embed_url": embed_url,
            "embeddable": bool(embed_url),
            "match_id": (raw.get("match") or {}).get("id"),
            "home_team": ((raw.get("match") or {}).get("homeTeam") or {}).get("abbreviation"),
            "away_team": ((raw.get("match") or {}).get("awayTeam") or {}).get("abbreviation"),
        }

    async def get_by_date(self, date_str: str, limit: int = 40) -> list[dict]:
        """All verified highlights on a given date (YYYY-MM-DD). Filters to
        VERIFIED-only server-side (Highlightly returns mixed by default)."""
        if not self.is_ready():
            return []
        raw = await self._fetch_highlights({"date": date_str, "limit": limit})
        return [self._normalize(h) for h in raw if h.get("type") == "VERIFIED"]

    async def get_by_match(self, match_id: int, limit: int = 40) -> list[dict]:
        if not self.is_ready():
            return []
        raw = await self._fetch_highlights({"matchId": match_id, "limit": limit})
        return [self._normalize(h) for h in raw if h.get("type") == "VERIFIED"]

    async def get_match_stats(self, match_id: int) -> dict | None:
        """Fetches the /matches/{id} endpoint and normalizes each team's
        `overallStatistics` into a flat comparison map. Returns:
            {
              "match_id": 12345,
              "home": {"team": {...}, "stats": {"shots": 32, ...}},
              "away": {"team": {...}, "stats": {"shots": 28, ...}},
            }
        Returns None if not available or the API is disabled.
        """
        if not self.is_ready():
            return None
        url = f"{self.base_url}/matches/{match_id}"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(url, headers=self._headers())
                if r.status_code != 200:
                    return None
                data = r.json()
        except Exception as e:  # noqa: BLE001
            log.warning("highlightly match stats failed for %s: %s", match_id, e)
            return None
        # Highlightly returns a list wrapping a single match; unwrap.
        if isinstance(data, list):
            data = data[0] if data else {}
        if not isinstance(data, dict):
            return None
        home_team = data.get("homeTeam") or {}
        away_team = data.get("awayTeam") or {}
        stats_by_team = {}
        for block in (data.get("overallStatistics") or []):
            team = block.get("team") or {}
            tid = team.get("id")
            flat = {}
            for row in block.get("data") or []:
                name = (row.get("displayName") or "").strip()
                if not name:
                    continue
                # Convert numeric strings to floats where possible.
                val = row.get("value")
                try:
                    if val is not None and str(val).replace(".", "", 1).replace("-", "", 1).isdigit():
                        val = float(val) if "." in str(val) else int(val)
                except Exception:
                    pass
                flat[name] = val
            stats_by_team[tid] = flat
        return {
            "match_id": match_id,
            "home": {"team": home_team, "stats": stats_by_team.get(home_team.get("id")) or {}},
            "away": {"team": away_team, "stats": stats_by_team.get(away_team.get("id")) or {}},
            "score": (data.get("state") or {}).get("score", {}),
            "state": (data.get("state") or {}).get("description"),
        }

    async def get_latest_populated(self, days_back: int = 90, limit: int = 40) -> dict:
        """Walk backwards day by day until we find a date with verified clips.
        Returns { date, highlights[] }. Bounded scan so we don't burn quota
        during a full off-season."""
        if not self.is_ready():
            return {"date": None, "highlights": []}
        # Fast path: reuse the most recent discovered date if it still has
        # clips cached. Saves ~40+ API calls on cold navigation.
        if self._latest_date_cache and self._latest_date_cache["at"]:
            age = (datetime.now(timezone.utc) - self._latest_date_cache["at"]).total_seconds()
            if age < 6 * 3600:  # trust for 6 hours
                cached_date = self._latest_date_cache["date"]
                clips = await self.get_by_date(cached_date, limit=limit)
                if clips:
                    return {"date": cached_date, "highlights": clips}

        today = datetime.now(timezone.utc).date()
        for i in range(days_back):
            d = today - timedelta(days=i)
            date_str = d.isoformat()
            clips = await self.get_by_date(date_str, limit=limit)
            if clips:
                self._latest_date_cache = {
                    "date": date_str,
                    "at": datetime.now(timezone.utc),
                }
                return {"date": date_str, "highlights": clips}
        return {"date": None, "highlights": []}


# Singleton — one instance for the whole app.
highlightly = HighlightlyClient()
