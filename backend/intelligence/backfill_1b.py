"""Foundation 1B minimum-history backfill.

User's rule (approved for build):

  For each seeded NHL team, ingest only enough completed historical games
  to produce a truthful Last 10, then deduplicate those game IDs
  league-wide before fetching/storing finals.

  - Walk backward from the most recent completed NHL game per team until
    10 completed games are found for that team.
  - Union those game IDs across all seeded teams.
  - Deduplicate by NHL Public game id BEFORE any boxscore fetch.
  - Store actual season and season_type on every game.
  - If obtaining 10 games requires crossing a season boundary, cross it.
  - Do NOT backfill the rest of a season merely because it is available.
  - All season baselines remain coverage_state='partial' after this seed.

This module is safe to re-run: writes go through write_game_final(),
which no-ops on identical corrections.
"""
from __future__ import annotations
import asyncio
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

from intelligence.indexes import ensure_indexes
from intelligence.indexes_1b import ensure_indexes_1b
from intelligence.ingest_1b import parse_boxscore_to_final_payload
from intelligence.game_finals_writer import write_game_final
from intelligence.resolver_teams import resolve_team, TeamHint
from intelligence.resolver_games import resolve_game, GameHint
from intelligence.season_util import (
    current_nhl_season, previous_nhl_season,
    season_int_from_str, season_int_to_str, season_type_from_game_type,
)
from intelligence.models_1a import now_iso

NHL_BASE = "https://api-web.nhle.com/v1"
UA = {"User-Agent": "Mozilla/5.0 (TickerHockeyIQ/1.0 Foundation1B-backfill)"}

COMPLETED_STATES = {"OFF", "FINAL"}

# How far back we're willing to walk. In practice ten completed games
# from mid-Sep 2026 means we'll dip into the 2024-2025 season for the
# preseason-lag teams; going further than two seasons back is a bug.
_MAX_SEASONS_BACK = 2


async def _fetch_club_season(client: httpx.AsyncClient, tri: str, season_int: int) -> list[dict]:
    """Fetch one team's season schedule. Returns [] on non-200."""
    url = f"{NHL_BASE}/club-schedule-season/{tri}/{season_int}"
    r = await client.get(url, headers=UA, timeout=20, follow_redirects=True)
    if r.status_code != 200:
        return []
    return (r.json() or {}).get("games") or []


async def _fetch_boxscore(client: httpx.AsyncClient, nhl_game_id: int) -> Optional[dict]:
    url = f"{NHL_BASE}/gamecenter/{nhl_game_id}/boxscore"
    r = await client.get(url, headers=UA, timeout=20, follow_redirects=True)
    if r.status_code != 200:
        return None
    return r.json()


async def _team_last_n_game_ids(
    client: httpx.AsyncClient, tri: str, n: int,
    now_utc: Optional[datetime] = None,
) -> list[dict]:
    """Walk backward across seasons until `n` completed games for `tri`
    are found. Returns list of {nhl_game_id, played_at_iso, season, gameType}.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    now_iso_s = now_utc.isoformat().replace("+00:00", "Z")
    season = current_nhl_season(now_utc)
    seasons_walked = 0
    collected: list[dict] = []

    while len(collected) < n and seasons_walked < _MAX_SEASONS_BACK + 1:
        season_int = season_int_from_str(season)
        games = await _fetch_club_season(client, tri, season_int)
        # Include only games that (a) have finished per gameState and
        # (b) started at or before now (belt-and-suspenders; the API
        # sometimes reports OFF for a game whose startTimeUTC is future
        # in edge cases).
        completed = [
            g for g in games
            if g.get("gameState") in COMPLETED_STATES
            and (g.get("startTimeUTC") or "") <= now_iso_s
        ]
        # Sort DESC by startTimeUTC so we pick the most recent first.
        completed.sort(key=lambda g: g.get("startTimeUTC") or "", reverse=True)
        for g in completed:
            if len(collected) >= n:
                break
            collected.append({
                "nhl_game_id": g["id"],
                "played_at_iso": g.get("startTimeUTC") or g.get("gameDate"),
                "season": season_int_to_str(g.get("season", season_int)),
                "game_type": g.get("gameType", 2),
                "home_tri": (g.get("homeTeam") or {}).get("abbrev"),
                "away_tri": (g.get("awayTeam") or {}).get("abbrev"),
            })
        seasons_walked += 1
        if len(collected) < n:
            season = previous_nhl_season(season)
    return collected


async def _resolve_team_from_tri(db, tri: str, common_name: str = "") -> str:
    """Wrap TeamHint construction for NHL Public tri codes."""
    return await resolve_team(db, TeamHint(
        provider="nhl_public",
        provider_ids={"tri_code": tri},
        display_name=common_name or tri,
        market=tri,
        canonical_code_fallback=tri,
    ))


async def _resolve_game(db, meta: dict, home_tid: str, away_tid: str,
                        boxscore: dict) -> str:
    """Ensure a ticker_game_id exists for this NHL game (idempotent)."""
    hint = GameHint(
        provider="nhl_public",
        provider_game_id=meta["nhl_game_id"],
        season=meta["season"],
        season_type=season_type_from_game_type(meta["game_type"]),
        home_hint=TeamHint(provider="nhl_public",
                           provider_ids={"tri_code": (boxscore.get("homeTeam") or {}).get("abbrev")},
                           market=(boxscore.get("homeTeam") or {}).get("abbrev")),
        away_hint=TeamHint(provider="nhl_public",
                           provider_ids={"tri_code": (boxscore.get("awayTeam") or {}).get("abbrev")},
                           market=(boxscore.get("awayTeam") or {}).get("abbrev")),
        scheduled_iso=boxscore.get("startTimeUTC") or meta["played_at_iso"],
        status="final",
        declares_new_game=True,
    )
    return await resolve_game(db, hint)


async def _team_tri_map(db) -> dict[str, str]:
    """Map of tri_code → ticker_team_id for currently seeded teams."""
    m: dict[str, str] = {}
    cur = db["iq_canonical_teams"].find({"competition": "NHL"})
    async for t in cur:
        tri = (t.get("provider_ids", {}).get("nhl_public") or {}).get("tri_code")
        if tri:
            m[tri] = t["ticker_team_id"]
    return m


async def run_minimum_history_backfill(
    mongo_url: Optional[str] = None,
    per_team_n: int = 10,
    now_utc: Optional[datetime] = None,
) -> dict:
    """Execute the minimum-history Last-N seed. Idempotent + safe to re-run."""
    mongo_url = mongo_url or os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get("DB_NAME", "test_database")]
    await ensure_indexes(db)
    await ensure_indexes_1b(db)

    now_utc = now_utc or datetime.now(timezone.utc)
    stats: dict[str, Any] = {
        "started_at": now_iso(),
        "per_team_n": per_team_n,
        "as_of_utc": now_utc.isoformat().replace("+00:00", "Z"),
        "teams_seen": 0,
        "unique_nhl_game_ids": 0,
        "boxscore_fetches": 0,
        "finals_written_v1": 0,
        "finals_noop_identical": 0,
        "seasons_touched": set(),
        "errors": [],
    }

    tri_to_tid = await _team_tri_map(db)
    if not tri_to_tid:
        client.close()
        stats["seasons_touched"] = []
        stats["finished_at"] = now_iso()
        stats["error"] = "no NHL teams seeded — run Foundation 1A activation first"
        return stats

    async with httpx.AsyncClient() as http:
        # Phase 1 — Per-team Last-N walk-back collector.
        per_team_meta: dict[str, list[dict]] = {}
        for tri in sorted(tri_to_tid.keys()):
            try:
                metas = await _team_last_n_game_ids(http, tri, per_team_n, now_utc=now_utc)
            except Exception as e:
                stats["errors"].append({"stage": "walkback", "tri": tri, "error": str(e)})
                continue
            per_team_meta[tri] = metas
            stats["teams_seen"] += 1

        # Phase 2 — League-wide dedup by nhl_game_id.
        dedup: dict[int, dict] = {}
        for tri, metas in per_team_meta.items():
            for m in metas:
                gid = m["nhl_game_id"]
                if gid not in dedup:
                    dedup[gid] = m
        stats["unique_nhl_game_ids"] = len(dedup)

        # Phase 3 — For each unique game, fetch boxscore + write final.
        for gid, meta in dedup.items():
            try:
                bx = await _fetch_boxscore(http, gid)
                if not bx:
                    stats["errors"].append({"stage": "boxscore", "nhl_game_id": gid,
                                            "error": "non-200"})
                    continue
                stats["boxscore_fetches"] += 1
                stats["seasons_touched"].add(meta["season"])
                home_tri = (bx.get("homeTeam") or {}).get("abbrev")
                away_tri = (bx.get("awayTeam") or {}).get("abbrev")
                # Ensure both teams exist (should from Phase 1 activation).
                home_tid = tri_to_tid.get(home_tri) or await _resolve_team_from_tri(
                    db, home_tri, (bx["homeTeam"].get("commonName") or {}).get("default", ""))
                away_tid = tri_to_tid.get(away_tri) or await _resolve_team_from_tri(
                    db, away_tri, (bx["awayTeam"].get("commonName") or {}).get("default", ""))
                tri_to_tid[home_tri] = home_tid
                tri_to_tid[away_tri] = away_tid

                tgid = await _resolve_game(db, meta, home_tid, away_tid, bx)
                payload = parse_boxscore_to_final_payload(
                    bx,
                    ticker_game_id=tgid,
                    home_team_id=home_tid,
                    away_team_id=away_tid,
                    endpoint=f"gamecenter/{gid}/boxscore",
                )
                result = await write_game_final(db, correction_reason="initial", **payload)
                if result.get("write_action") == "inserted_v1":
                    stats["finals_written_v1"] += 1
                elif result.get("write_action") in ("noop_identical", "noop_already_present"):
                    stats["finals_noop_identical"] += 1
            except Exception as e:
                stats["errors"].append({"stage": "final_write", "nhl_game_id": gid,
                                        "error": str(e)})

    stats["seasons_touched"] = sorted(stats["seasons_touched"])
    stats["finished_at"] = now_iso()
    client.close()
    return stats


if __name__ == "__main__":
    import json
    result = asyncio.run(run_minimum_history_backfill(
        per_team_n=int(os.environ.get("PER_TEAM_N", "10"))))
    print(json.dumps(result, indent=2, default=str))
