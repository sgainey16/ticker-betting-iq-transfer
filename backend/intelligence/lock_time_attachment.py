"""Lock-time snapshot attachment for Betting IQ.

Contract:
  - Attachment is idempotent. Terminal states never revisit.
  - Two terminal states: 'attached' (with ref) OR 'no_snapshot_before_lock'
    (ref=None). Everything else is pending/retryable.
  - The query is snapshot.locked_at <= call.locked_at. A retry days later
    can never grant retroactive knowledge because that inequality is
    time-invariant.
"""
from __future__ import annotations
from typing import Any, Literal, Optional

from intelligence.models_1a import now_iso

# CallEvent kinds — must remain compatible with the existing iq_events
# vocabulary and the top-level validators in server.py.
_EVENT_KIND = "reflection"   # existing kind that stores post-lock system notes
_TAG = "context_snapshot_referenced"

Result = Literal["attached", "no_snapshot_before_lock",
                 "not_applicable", "transient_failure", "already_terminal"]


def _extract_ticker_game_id(subject: dict[str, Any]) -> Optional[str]:
    if not subject:
        return None
    tgid = subject.get("ticker_game_id")
    if isinstance(tgid, str) and tgid.startswith("tg_"):
        return tgid
    return None   # existing 2,243 calls fall through here → stay null forever


async def _emit_system_event(db, call_id: str, user_id: str, payload: dict) -> None:
    await db["iq_events"].insert_one({
        "id": f"evt-attach-{now_iso()}",
        "call_id": call_id, "user_id": user_id,
        "ts": now_iso(), "source": "system", "kind": _EVENT_KIND,
        "payload": {"tag": _TAG, **payload},
    })


async def attach(db, call_id: str) -> Result:
    call = await db["iq_calls"].find_one({"id": call_id})
    if not call:
        return "not_applicable"
    if call.get("context_snapshot_state") in ("attached", "no_snapshot_before_lock"):
        return "already_terminal"
    if call.get("state") != "locked":
        return "not_applicable"
    tgid = _extract_ticker_game_id(call.get("subject") or {})
    if tgid is None:
        return "not_applicable"

    lock_ts = call.get("locked_at")
    if not lock_ts:
        return "not_applicable"

    try:
        snap = await db["iq_game_context_snapshots"].find_one(
            {"ticker_game_id": tgid, "locked_at": {"$lte": lock_ts}},
            sort=[("locked_at", -1)],
        )
    except Exception:
        return "transient_failure"

    if snap is None:
        result = await db["iq_calls"].update_one(
            {"id": call_id, "context_snapshot_state": None, "locked_at": lock_ts},
            {"$set": {
                "context_snapshot_state": "no_snapshot_before_lock",
                "context_snapshot_ref": None,
            }},
        )
        if result.matched_count == 0:
            return "already_terminal"
        await _emit_system_event(db, call_id, call["user_id"], {
            "context_snapshot_id": None, "reason": "no_snapshot_before_lock",
        })
        return "no_snapshot_before_lock"

    try:
        result = await db["iq_calls"].update_one(
            {"id": call_id, "context_snapshot_state": None, "locked_at": lock_ts},
            {"$set": {
                "context_snapshot_state": "attached",
                "context_snapshot_ref": snap["id"],
                "context_snapshot_attached_at": now_iso(),
            }},
        )
    except Exception:
        return "transient_failure"

    if result.matched_count == 0:
        return "already_terminal"

    await _emit_system_event(db, call_id, call["user_id"], {
        "context_snapshot_id": snap["id"],
        "snapshot_kind": snap["snapshot_kind"],
        "snapshot_version": snap["snapshot_version"],
    })
    return "attached"


async def reconcile_pending(db, limit: int = 200) -> dict:
    """Periodic pass over calls stuck in pending state. Retries attach()
    for each. Safe because the query condition is time-invariant."""
    stats = {"attached": 0, "no_snapshot_before_lock": 0,
             "transient_failure": 0, "other": 0}
    cur = db["iq_calls"].find(
        {"state": "locked", "context_snapshot_state": None},
    ).limit(limit)
    async for call in cur:
        r = await attach(db, call["id"])
        if r in stats:
            stats[r] += 1
        else:
            stats["other"] += 1
    return stats
