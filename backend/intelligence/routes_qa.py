"""Dev-gated QA endpoints for Foundation 1A.

Both endpoints return 403 unless IQ_DEV_MODE=1. Cache inconsistency
between iq_canonical_games.current and iq_game_schedule_revisions is
surfaced as cache_inconsistent: true — never a hard failure.
"""
from __future__ import annotations
import os
from typing import Any

from fastapi import APIRouter, HTTPException


def _dev_ok() -> bool:
    return os.environ.get("IQ_DEV_MODE", "0") == "1"


def build_router(db) -> APIRouter:
    router = APIRouter()

    def _clean(doc):
        if not doc:
            return None
        # Strip Mongo ObjectId and return a plain dict — never embed the
        # raw find_one() result into a FastAPI response.
        return {k: v for k, v in doc.items() if k != "_id"}

    async def _cache_inconsistent(tgid: str, canonical: dict) -> tuple[bool, dict]:
        latest_rev = await db["iq_game_schedule_revisions"].find_one(
            {"ticker_game_id": tgid}, sort=[("revision_number", -1)])
        if not latest_rev:
            return True, None
        cur_rev = (canonical.get("current") or {}).get("schedule_revision")
        return (cur_rev != latest_rev["revision_number"]), latest_rev

    @router.get("/iq/game-context/{ticker_game_id}")
    async def get_context(ticker_game_id: str):
        if not _dev_ok():
            raise HTTPException(status_code=403, detail="dev mode disabled")
        canonical_raw = await db["iq_canonical_games"].find_one(
            {"ticker_game_id": ticker_game_id})
        if not canonical_raw:
            raise HTTPException(status_code=404, detail="ticker_game_id not found")
        canonical = _clean(canonical_raw)
        inconsistent, latest_rev_raw = await _cache_inconsistent(ticker_game_id, canonical)
        latest_rev = _clean(latest_rev_raw)
        newest_snap = _clean(await db["iq_game_context_snapshots"].find_one(
            {"ticker_game_id": ticker_game_id}, sort=[("locked_at", -1)]))
        available: dict[str, Any] = {}
        for kind in ("schedule_release", "t_minus_24h", "t_minus_60"):
            latest = await db["iq_game_context_snapshots"].find_one(
                {"ticker_game_id": ticker_game_id, "snapshot_kind": kind},
                sort=[("snapshot_version", -1)])
            if latest:
                count = await db["iq_game_context_snapshots"].count_documents(
                    {"ticker_game_id": ticker_game_id, "snapshot_kind": kind})
                available[kind] = {"count": count,
                                   "latest_version": latest["snapshot_version"]}
            else:
                available[kind] = None
        return {
            "ticker_game_id": ticker_game_id,
            "canonical": canonical,
            "latest_schedule_revision": latest_rev,
            "newest_snapshot": newest_snap,
            "newest_snapshot_kind": (newest_snap or {}).get("snapshot_kind"),
            "snapshots_available": available,
            "cache_inconsistent": inconsistent,
        }

    @router.get("/iq/game-context/{ticker_game_id}/history")
    async def get_history(ticker_game_id: str):
        if not _dev_ok():
            raise HTTPException(status_code=403, detail="dev mode disabled")
        canonical_raw = await db["iq_canonical_games"].find_one(
            {"ticker_game_id": ticker_game_id})
        if not canonical_raw:
            raise HTTPException(status_code=404, detail="ticker_game_id not found")
        canonical = _clean(canonical_raw)
        revs = [
            _clean(r)
            async for r in db["iq_game_schedule_revisions"].find(
                {"ticker_game_id": ticker_game_id}
            ).sort("revision_number", 1)
        ]
        snaps = [
            _clean(s)
            async for s in db["iq_game_context_snapshots"].find(
                {"ticker_game_id": ticker_game_id}
            ).sort([("locked_at", 1), ("snapshot_kind", 1)])
        ]
        inconsistent, _ = await _cache_inconsistent(ticker_game_id, canonical)
        return {
            "ticker_game_id": ticker_game_id,
            "canonical": canonical,
            "schedule_revisions": revs,
            "snapshots": snaps,
            "cache_inconsistent": inconsistent,
        }

    return router
