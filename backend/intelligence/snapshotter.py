"""Snapshot builder + scheduler.

schedule_release: emitted at first-sight via emit_schedule_release_first_sight().
                  Retryable ONLY when the original attempt failed for a
                  technical reason (tracked in _schedule_release_backlog).
                  Never backdated; locked_at is always the actual persistence time.

t_minus_24h / t_minus_60: emitted by the periodic worker inside strict
                          windows. Missed windows stay missed forever.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo.errors import DuplicateKeyError

from intelligence.models_1a import (
    GameContextSnapshot, TeamRecordsEntering, RestAndTravel,
    Provenance, SourceRecord, Venue, now_iso,
)

ENGINE_VERSION = "1.0.0"

SNAPSHOT_WINDOWS = {
    "t_minus_24h": {"target_seconds_before": 86400, "before": 1800, "after": 1800},
    "t_minus_60":  {"target_seconds_before":  3600, "before":  600, "after":  600},
}

# In-process backlog for schedule_release retry after a technical failure.
# Simple set — a durable collection could replace this later if needed.
_schedule_release_backlog: set[str] = set()


def _parse_iso(s: str) -> datetime:
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


async def _next_snapshot_version(db, ticker_game_id: str, kind: str) -> int:
    latest = await db["iq_game_context_snapshots"].find_one(
        {"ticker_game_id": ticker_game_id, "snapshot_kind": kind},
        sort=[("snapshot_version", -1)],
    )
    return (latest["snapshot_version"] + 1) if latest else 1


async def _snapshot_exists(db, ticker_game_id: str, kind: str) -> bool:
    return bool(await db["iq_game_context_snapshots"].find_one(
        {"ticker_game_id": ticker_game_id, "snapshot_kind": kind}
    ))


async def _identity_safe(db, game: dict) -> bool:
    """Both teams resolvable, current schedule valid, not in-progress/final."""
    if not game or not game.get("home_team_id") or not game.get("away_team_id"):
        return False
    if game["current"]["status"] in ("cancelled", "in_progress",
                                     "final", "final_ot", "final_so"):
        return False
    home = await db["iq_canonical_teams"].find_one({"ticker_team_id": game["home_team_id"]})
    away = await db["iq_canonical_teams"].find_one({"ticker_team_id": game["away_team_id"]})
    return bool(home and away)


def _empty_provenance(sources: list[dict], is_retry: bool = False) -> Provenance:
    p = Provenance(
        sources_consulted=[SourceRecord(**s) for s in sources],
        written_at=now_iso(), engine_version=ENGINE_VERSION,
    )
    if is_retry:
        # Retry marker embedded as a source-line so provenance stays typed.
        p.sources_consulted.append(SourceRecord(
            name="sportradar",  # placeholder; the RETRY signal is the endpoint text
            endpoint="__retry_after_technical_failure__",
            fetched_at=now_iso(), http_status=200, cache_hit=False,
            fields_populated=[],
        ))
    return p


async def _build_snapshot(db, game: dict, kind: str,
                          data_sources: list[dict],
                          is_retry: bool = False) -> Optional[dict]:
    """Compose a snapshot from the current canonical game view. Returns
    the model_dump ready for insert; None if identity is unsafe."""
    if not await _identity_safe(db, game):
        return None
    version = await _next_snapshot_version(db, game["ticker_game_id"], kind)
    current = game["current"]
    venue = Venue(**current["venue"]) if current.get("venue") else None
    doc = GameContextSnapshot(
        ticker_game_id=game["ticker_game_id"],
        snapshot_kind=kind,               # type: ignore[arg-type]
        snapshot_version=version,
        scheduled_iso_at_snapshot=current["scheduled_iso"],
        schedule_revision_at_snapshot=current["schedule_revision"],
        status_at_snapshot=current["status"],
        competition=game["competition"],
        season=game["season"],
        season_type=game["season_type"],
        home_team_id=game["home_team_id"],
        away_team_id=game["away_team_id"],
        venue=venue,
        team_records_entering=TeamRecordsEntering(),
        rest_and_travel=RestAndTravel(),
        provenance=_empty_provenance(data_sources, is_retry=is_retry),
    )
    return doc.model_dump()


async def emit_schedule_release_first_sight(db, ticker_game_id: str) -> Optional[str]:
    """Emit the schedule_release snapshot at genuine first sight.

    - Guarded against duplicate emission by the (ticker_game_id, kind,
      version) unique index — a second call is a no-op.
    - If a technical persistence failure occurs, the ticker_game_id is
      enqueued in the in-process backlog for a later retry. Retry writes
      locked_at = server_now() at retry time, NEVER the original mint time.
    - This function refuses to run for games already known (defends
      against later 'fill-in' attempts).
    """
    game = await db["iq_canonical_games"].find_one({"ticker_game_id": ticker_game_id})
    if not game:
        return None
    if await _snapshot_exists(db, ticker_game_id, "schedule_release"):
        return None
    data_sources = [{
        "name": "sportradar", "endpoint": "canonical_game_first_sight",
        "fetched_at": now_iso(), "http_status": 200, "cache_hit": False,
        "fields_populated": [],
    }]
    doc = await _build_snapshot(db, game, "schedule_release", data_sources,
                                is_retry=(ticker_game_id in _schedule_release_backlog))
    if doc is None:
        return None
    try:
        await db["iq_game_context_snapshots"].insert_one(doc)
        _schedule_release_backlog.discard(ticker_game_id)
        return doc["id"]
    except DuplicateKeyError:
        _schedule_release_backlog.discard(ticker_game_id)
        return None
    except Exception:
        # Technical failure: enqueue for retry with a fresh locked_at.
        _schedule_release_backlog.add(ticker_game_id)
        return None


async def retry_schedule_release_backlog(db) -> int:
    """Called periodically. Attempts to persist backlog entries. Each retry
    uses server_now() as locked_at, preserving historical honesty about when
    Betting IQ actually gained lock-time-attachable context."""
    if not _schedule_release_backlog:
        return 0
    n = 0
    for tgid in list(_schedule_release_backlog):
        result = await emit_schedule_release_first_sight(db, tgid)
        if result is not None:
            n += 1
    return n


async def worker_tick(db, now_dt: Optional[datetime] = None) -> dict:
    """One scheduler pass. Emits t_minus_24h and t_minus_60 within their
    strict windows. Retries any pending schedule_release backlog first."""
    now_dt = now_dt or datetime.now(timezone.utc)
    stats = {"schedule_release_retried": 0, "t_minus_24h": 0, "t_minus_60": 0,
             "missed_t_minus_24h": 0, "missed_t_minus_60": 0}
    stats["schedule_release_retried"] = await retry_schedule_release_backlog(db)

    horizon_lo = (now_dt - timedelta(days=1)).isoformat().replace("+00:00", "Z")
    horizon_hi = (now_dt + timedelta(days=8)).isoformat().replace("+00:00", "Z")
    cur = db["iq_canonical_games"].find({
        "current.status": {"$in": ["scheduled", "postponed"]},
        "current.scheduled_iso": {"$gte": horizon_lo, "$lte": horizon_hi},
    })
    async for game in cur:
        sched = _parse_iso(game["current"]["scheduled_iso"])
        for kind, win in SNAPSHOT_WINDOWS.items():
            if await _snapshot_exists(db, game["ticker_game_id"], kind):
                # For postponements, if the CURRENT scheduled_iso yields a
                # new window and no snapshot for that window exists yet, we
                # DO emit a new one — but we key on snapshot presence
                # per-kind, so this simple guard is intentional: we let
                # snapshot_version increment naturally.
                target = sched - timedelta(seconds=win["target_seconds_before"])
                if abs((now_dt - target).total_seconds()) > win["before"] + win["after"]:
                    continue
                # In window and a previous snapshot exists — allow another
                # version if the current scheduled_iso differs from the
                # newest snapshot's scheduled_iso_at_snapshot.
                newest = await db["iq_game_context_snapshots"].find_one(
                    {"ticker_game_id": game["ticker_game_id"], "snapshot_kind": kind},
                    sort=[("snapshot_version", -1)],
                )
                if newest and newest["scheduled_iso_at_snapshot"] == game["current"]["scheduled_iso"]:
                    continue
                # else fall through and emit a new version
            target = sched - timedelta(seconds=win["target_seconds_before"])
            delta = (now_dt - target).total_seconds()
            if delta < -win["before"]:
                continue    # too early
            if delta > win["after"]:
                stats[f"missed_{kind}"] += 1
                continue    # window closed — DO NOT backfill
            data_sources = [{
                "name": "sportradar", "endpoint": f"scheduler_tick/{kind}",
                "fetched_at": now_iso(), "http_status": 200, "cache_hit": False,
                "fields_populated": [],
            }]
            doc = await _build_snapshot(db, game, kind, data_sources)
            if doc is None:
                continue
            try:
                await db["iq_game_context_snapshots"].insert_one(doc)
                stats[kind] += 1
            except DuplicateKeyError:
                pass
    return stats
