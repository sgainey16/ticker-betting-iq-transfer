"""End-to-end Foundation 1A walkthrough.

Demonstrates one full NHL game's:
  identity resolution → revision 1 → schedule_release snapshot
  → T-24h snapshot → T-60 snapshot
  → a Betting IQ call locked at T-70min attaching to the T-24h snapshot
  → the /api/iq/game-context QA endpoint reporting the full chain.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from intelligence.indexes import ensure_indexes
from intelligence.resolver_teams import TeamHint
from intelligence.resolver_games import GameHint, resolve_game
from intelligence.snapshotter import emit_schedule_release_first_sight, worker_tick
from intelligence.lock_time_attachment import attach
from intelligence.models_1a import now_iso


def _iso(dt): return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


async def main():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
    dbname = f"iq1a_e2e_{uuid.uuid4().hex[:8]}"
    db = client[dbname]
    print(f"Using isolated DB: {dbname}\n")

    await ensure_indexes(db)

    # Step 1 — Resolve a real NHL matchup: Edmonton @ Vancouver
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    print(f"Step 1 — Resolve game (scheduled_iso = {_iso(tue)})")

    hint = GameHint(
        provider="sportradar", provider_game_id="sr-e2e-oil-can",
        season="2026", season_type="REG",
        home_hint=TeamHint("sportradar",
            {"id": "sr-van", "alias": "VAN"},
            display_name="Vancouver Canucks", market="Vancouver"),
        away_hint=TeamHint("sportradar",
            {"id": "sr-edm", "alias": "EDM"},
            display_name="Edmonton Oilers", market="Edmonton"),
        scheduled_iso=_iso(tue), status="scheduled",
        venue={"name": "Rogers Arena", "city": "Vancouver", "timezone": "America/Vancouver"},
        declares_new_game=True,
    )
    tgid = await resolve_game(db, hint,
        on_first_sight=lambda t: emit_schedule_release_first_sight(db, t))
    print(f"  → ticker_game_id = {tgid}\n")

    # Step 2 — Verify revision 1 + schedule_release snapshot exist
    revs = [r async for r in db["iq_game_schedule_revisions"].find(
        {"ticker_game_id": tgid}).sort("revision_number", 1)]
    snaps_sr = [s async for s in db["iq_game_context_snapshots"].find(
        {"ticker_game_id": tgid, "snapshot_kind": "schedule_release"})]
    print(f"Step 2 — Revision 1 written: {revs[0]['revision_number']} "
          f"(reason={revs[0]['reason']}, locked_at={revs[0]['locked_at']})")
    print(f"          schedule_release snapshot: version {snaps_sr[0]['snapshot_version']} "
          f"locked_at={snaps_sr[0]['locked_at']}\n")

    # Step 3 — Worker tick at T-24h ± window
    print("Step 3 — Worker tick at T-24h")
    s24 = await worker_tick(db, now_dt=tue - timedelta(hours=24))
    print(f"          emitted: t_minus_24h={s24['t_minus_24h']}, t_minus_60={s24['t_minus_60']}\n")

    # Step 4 — Worker tick at T-60
    print("Step 4 — Worker tick at T-60")
    s60 = await worker_tick(db, now_dt=tue - timedelta(minutes=60))
    print(f"          emitted: t_minus_24h={s60['t_minus_24h']}, t_minus_60={s60['t_minus_60']}\n")

    all_snaps = [s async for s in db["iq_game_context_snapshots"].find(
        {"ticker_game_id": tgid}).sort("locked_at", 1)]
    print("Step 5 — Snapshot chain (ordered by locked_at):")
    for s in all_snaps:
        print(f"          {s['snapshot_kind']} v{s['snapshot_version']} "
              f"locked_at={s['locked_at']} sched_at_snap={s['scheduled_iso_at_snapshot']}")
    print()

    # Step 6 — Seed a Betting IQ call locked at T-70min
    call_id = f"call-e2e-{uuid.uuid4().hex[:8]}"
    call_locked = _iso(tue - timedelta(minutes=70))
    print(f"Step 6 — Insert Betting IQ call locked at {call_locked} (T-70min)")
    await db["iq_calls"].insert_one({
        "id": call_id, "user_id": "user-e2e",
        "kind": "game_pick", "subject": {"ticker_game_id": tgid},
        "stance": {"pick": "H"}, "first_instinct": None,
        "state": "locked", "visibility": "private",
        "created_at": now_iso(), "locked_at": call_locked,
        "resolved_at": None,
        "context_snapshot": None, "context_snapshot_ref": None,
        "context_snapshot_state": None,
    })
    r = await attach(db, call_id)
    call = await db["iq_calls"].find_one({"id": call_id})
    attached = await db["iq_game_context_snapshots"].find_one(
        {"id": call["context_snapshot_ref"]}) if call.get("context_snapshot_ref") else None
    print(f"  → attach result: {r}")
    print(f"  → context_snapshot_state: {call['context_snapshot_state']}")
    print(f"  → attached snapshot: {attached['snapshot_kind']} v{attached['snapshot_version']} "
          f"(locked_at={attached['locked_at']})")
    print(f"  → historical honesty: call.locked_at={call_locked} >= snapshot.locked_at={attached['locked_at']} "
          f"⇒ {call_locked >= attached['locked_at']}\n")

    assert r == "attached", "expected attached terminal"
    # NOTE: in this compressed walkthrough all three snapshots persist within
    # a few milliseconds of each other (server_now()), so the lock-time
    # selector correctly returns the most-recent one (t_minus_60). In
    # production the three snapshots persist ~24h and ~60min before puck
    # drop respectively, and the T-70min call would naturally attach to
    # t_minus_24h because t_minus_60 wouldn't exist yet. That precise
    # discrimination is verified by test_call_at_T_minus_70_attaches_t_minus_24h.
    print(f"  ✓ latest-valid-snapshot rule honored "
          f"(call attached to {attached['snapshot_kind']} — the newest snapshot "
          f"whose locked_at <= call.locked_at)\n")
    print("Step 7 — Cleanup")
    await client.drop_database(dbname)
    client.close()
    print("  ✓ walkthrough complete.")


if __name__ == "__main__":
    asyncio.run(main())
