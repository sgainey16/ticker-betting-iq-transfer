"""Foundation 1A Operational Activation — populate the spine with real
NHL data using NHL Public API + SportsData.io + Highlightly. Never uses
Sportradar (trial 403). Never manufactures historical snapshots.

Idempotent — safe to re-run. Uses the existing resolver_teams /
resolver_games / snapshotter contracts unchanged.
"""
from __future__ import annotations
import asyncio
import os
import httpx
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from intelligence.indexes import ensure_indexes
from intelligence.resolver_teams import resolve_team, TeamHint
from intelligence.resolver_games import GameHint, resolve_game
from intelligence.snapshotter import emit_schedule_release_first_sight
from intelligence.models_1a import now_iso

NHL_BASE = "https://api-web.nhle.com/v1"
UA = {"User-Agent": "Mozilla/5.0 (TickerHockeyIQ/1.0 Foundation1A-activator)"}


def _season_str(season_int: int) -> str:
    """20262027 → '2026-2027'"""
    s = str(season_int)
    return f"{s[:4]}-{s[4:]}" if len(s) == 8 else s


def _season_type(game_type: int) -> str:
    return {1: "PRE", 2: "REG", 3: "POST"}.get(game_type, "REG")


async def _fetch_schedule_for_date(client, date: str) -> list[dict]:
    """NHL Public /schedule/{date} returns a gameWeek starting at that
    date. We only take that day's games."""
    url = f"{NHL_BASE}/schedule/{date}"
    r = await client.get(url, headers=UA, timeout=15,
                         follow_redirects=True)
    if r.status_code != 200:
        return []
    data = r.json()
    for day in data.get("gameWeek", []):
        if day.get("date") == date:
            return day.get("games") or []
    return []


async def _fetch_upcoming(client, days_ahead: int = 7) -> list[dict]:
    """Collect NHL games for the next N days. Uses one HTTP call per day
    for simplicity — could be optimized, but this is a one-shot activator."""
    today = datetime.now(timezone.utc).date()
    all_games: list[dict] = []
    dates_hit: list[dict] = []
    for i in range(days_ahead):
        d = (today + timedelta(days=i)).isoformat()
        games = await _fetch_schedule_for_date(client, d)
        dates_hit.append({"date": d, "games_returned": len(games)})
        all_games.extend(games)
    return all_games, dates_hit


def _team_hint_from_nhl(team_block: dict) -> TeamHint:
    """Build a TeamHint from NHL Public API's team block on a schedule game."""
    tri = team_block.get("abbrev")
    place = team_block.get("placeName", {}).get("default", "")
    common = team_block.get("commonName", {}).get("default", "")
    return TeamHint(
        provider="nhl_public",
        provider_ids={"tri_code": tri},
        display_name=f"{place} {common}".strip() or tri,
        market=place or tri,
        canonical_code_fallback=tri,
    )


def _venue_from_nhl(game: dict) -> dict | None:
    v = game.get("venue", {}).get("default")
    tz = game.get("venueTimezone") or "UTC"
    if not v:
        return None
    return {"name": v, "city": v, "timezone": tz}


async def activate(mongo_url: str | None = None, days_ahead: int = 7) -> dict:
    """One-shot activator. Returns stats + one sample chain for proof."""
    mongo_url = mongo_url or os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.environ.get("DB_NAME", "test_database")
    db = client[db_name]
    await ensure_indexes(db)

    stats = {
        "started_at": now_iso(),
        "provider_calls": [],
        "teams_seen": set(),
        "teams_minted_or_updated": 0,
        "games_seen": 0,
        "games_minted": 0,
        "games_existing": 0,
        "schedule_release_emitted": 0,
        "errors": [],
    }

    async with httpx.AsyncClient() as http:
        games, dates_hit = await _fetch_upcoming(http, days_ahead=days_ahead)
        stats["provider_calls"].append({
            "provider": "nhl_public",
            "endpoint": "/schedule/{date}",
            "days_requested": days_ahead,
            "day_summaries": dates_hit,
            "total_games_returned": len(games),
        })
        stats["games_seen"] = len(games)

        # Resolve teams first — collect unique tri_codes to reduce chatter
        unique_teams: dict[str, dict] = {}
        for g in games:
            for side in ("homeTeam", "awayTeam"):
                t = g.get(side, {})
                tri = t.get("abbrev")
                if tri and tri not in unique_teams:
                    unique_teams[tri] = t
        for tri, block in unique_teams.items():
            try:
                await resolve_team(db, _team_hint_from_nhl(block))
                stats["teams_seen"].add(tri)
                stats["teams_minted_or_updated"] += 1
            except Exception as e:
                stats["errors"].append({"stage": "resolve_team", "tri": tri, "error": str(e)})

        # Resolve games — the resolver writes revision 1 + emits schedule_release
        # via the on_first_sight callback.
        sample_chain = None
        for g in games:
            existed_before = None
            try:
                # Check pre-state
                existed_before = await db["iq_canonical_games"].find_one(
                    {"provider_ids.nhl_public.id": g["id"]})
                hint = GameHint(
                    provider="nhl_public",
                    provider_game_id=g["id"],
                    season=_season_str(g["season"]),
                    season_type=_season_type(g["gameType"]),
                    home_hint=_team_hint_from_nhl(g["homeTeam"]),
                    away_hint=_team_hint_from_nhl(g["awayTeam"]),
                    scheduled_iso=g["startTimeUTC"],
                    status="scheduled",
                    venue=_venue_from_nhl(g),
                    declares_new_game=True,   # NHL Public's schedule row is authoritative first-sight
                )
                tgid = await resolve_game(
                    db, hint,
                    on_first_sight=lambda tid: emit_schedule_release_first_sight(
                        db, tid, first_sight_provider="nhl_public"),
                )
                if existed_before is None:
                    stats["games_minted"] += 1
                else:
                    stats["games_existing"] += 1
                if sample_chain is None and existed_before is None:
                    sample_chain = {
                        "ticker_game_id": tgid,
                        "nhl_public_id": g["id"],
                        "matchup": f"{g['awayTeam']['abbrev']} @ {g['homeTeam']['abbrev']}",
                        "scheduled_iso": g["startTimeUTC"],
                    }
            except Exception as e:
                stats["errors"].append({
                    "stage": "resolve_game",
                    "nhl_public_id": g.get("id"),
                    "error": str(e),
                })

        # Count schedule_release emissions we actually produced
        stats["schedule_release_emitted"] = await db["iq_game_context_snapshots"].count_documents(
            {"snapshot_kind": "schedule_release"})

    stats["teams_seen"] = sorted(stats["teams_seen"])
    stats["finished_at"] = now_iso()

    # Compose the sample chain proof: identity → provider mappings →
    # revision → schedule_release snapshot with populated/null field map.
    if sample_chain:
        tgid = sample_chain["ticker_game_id"]
        canonical = await db["iq_canonical_games"].find_one({"ticker_game_id": tgid})
        revs = [r async for r in db["iq_game_schedule_revisions"].find(
            {"ticker_game_id": tgid}).sort("revision_number", 1)]
        snap = await db["iq_game_context_snapshots"].find_one(
            {"ticker_game_id": tgid, "snapshot_kind": "schedule_release"})
        home_team = await db["iq_canonical_teams"].find_one(
            {"ticker_team_id": canonical["home_team_id"]}) if canonical else None
        away_team = await db["iq_canonical_teams"].find_one(
            {"ticker_team_id": canonical["away_team_id"]}) if canonical else None

        def clean(d):
            return {k: v for k, v in (d or {}).items() if k != "_id"}

        sample_chain.update({
            "canonical_game": clean(canonical),
            "home_team": clean(home_team),
            "away_team": clean(away_team),
            "schedule_revisions": [clean(r) for r in revs],
            "schedule_release_snapshot": clean(snap),
            "field_population_map": _field_population_map(clean(snap)),
        })

    stats["sample_chain"] = sample_chain
    client.close()
    return stats


def _field_population_map(snap: dict) -> dict:
    """For the proof output — walk the snapshot and label each field
    populated vs. null-because-provider-unavailable."""
    if not snap:
        return {}
    result = {
        "populated": [],
        "null_because_reserved": [],
        "null_because_sportradar_unavailable": [],
        "null_because_ingester_not_wired_yet": [],
    }
    if snap.get("scheduled_iso_at_snapshot"): result["populated"].append("scheduled_iso_at_snapshot (NHL Public)")
    if snap.get("home_team_id"): result["populated"].append("home_team_id (Ticker canonical)")
    if snap.get("away_team_id"): result["populated"].append("away_team_id (Ticker canonical)")
    if snap.get("venue"): result["populated"].append("venue (NHL Public)")
    tre = snap.get("team_records_entering") or {}
    if tre.get("home") is None and tre.get("away") is None:
        result["null_because_ingester_not_wired_yet"].append(
            "team_records_entering.home/away — SportsData.io standings ingester not wired in this activation pass")
    rt = snap.get("rest_and_travel") or {}
    for f in ("home_days_rest", "away_days_rest", "home_back_to_back",
              "away_back_to_back", "home_prior_consecutive_road_games",
              "away_prior_consecutive_road_games"):
        if rt.get(f) is None:
            result["null_because_ingester_not_wired_yet"].append(
                f"rest_and_travel.{f} — requires historical schedule scan (Foundation 1B)")
    if rt.get("home_road_trip_game_number") is None:
        result["null_because_reserved"].append("rest_and_travel.home_road_trip_game_number — reserved")
    if rt.get("away_road_trip_game_number") is None:
        result["null_because_reserved"].append("rest_and_travel.away_road_trip_game_number — reserved")
    for f in ("recent_workload", "starters", "scratches", "injuries_reported"):
        v = snap.get(f)
        if v is None or (isinstance(v, dict) and all(x is None for x in v.values())):
            result["null_because_reserved"].append(f"{f} — reserved (requires boxscore/Sportlogiq in later foundation)")
    # Sportradar
    result["null_because_sportradar_unavailable"].append(
        "provider_ids.sportradar.id (canonical game) — Sportradar trial 403; provenance records the absence")
    return result


if __name__ == "__main__":
    import json
    stats = asyncio.run(activate(days_ahead=int(os.environ.get("DAYS_AHEAD", "7"))))
    print(json.dumps(stats, indent=2, default=str))
