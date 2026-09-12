"""One-shot repair for Foundation 1A canonical-identity collisions surfaced
by Foundation 1B backfill.

Discipline (per approval):
  - Determine which NHL provider game each existing canonical LEGITIMATELY
    owns from its own append-only revision log (rev 1's
    provider_ids_at_revision is the authoritative source of the original
    identity).
  - Preserve that canonical for its rightful game.
  - Do NOT create a corrective iq_game_finals version merely to label
    the repair. Only append a corrective version if the newest existing
    version is materially different from the rightful game's truth.
  - Older, incorrectly attached versions REMAIN in the append-only audit
    chain. That accurately records what Ticker possessed before the
    identity defect was discovered.
  - Mint a separate canonical for each secondary NHL provider ID that had
    been silently attached, under the amended resolver, and ingest that
    game's proper v1 iq_game_finals record.

Idempotent: safe to re-run. Skips games it has already repaired.
"""
from __future__ import annotations
import asyncio
import os
from typing import Any, Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

from intelligence.game_finals_writer import write_game_final, _truth_view
from intelligence.ingest_1b import parse_boxscore_to_final_payload
from intelligence.resolver_teams import resolve_team, TeamHint
from intelligence.resolver_games import resolve_game, GameHint
from intelligence.season_util import season_type_from_game_type, season_int_to_str
from intelligence.models_1a import now_iso

NHL_BASE = "https://api-web.nhle.com/v1"
UA = {"User-Agent": "Mozilla/5.0 (TickerHockeyIQ/1.0 Foundation1A-repair)"}


async def _fetch_boxscore(client: httpx.AsyncClient, nhl_game_id: int) -> Optional[dict]:
    r = await client.get(
        f"{NHL_BASE}/gamecenter/{nhl_game_id}/boxscore",
        headers=UA, timeout=20, follow_redirects=True,
    )
    if r.status_code != 200:
        return None
    return r.json()


async def _find_collisions(db) -> list[dict]:
    """A collision is any canonical whose rev-1 provider_ids_at_revision
    for nhl_public differs from its current cached provider_ids.nhl_public.id.
    That is the exact fingerprint of the old resolver's mis-attachment
    (before the patch, _attach_new_provider_id overwrote the cached id)."""
    collisions: list[dict] = []
    cur = db["iq_canonical_games"].find({
        "competition": "NHL",
        "provider_ids.nhl_public.id": {"$ne": None},
    })
    async for g in cur:
        rev1 = await db["iq_game_schedule_revisions"].find_one(
            {"ticker_game_id": g["ticker_game_id"], "revision_number": 1})
        if not rev1:
            continue
        rightful = ((rev1.get("provider_ids_at_revision") or {})
                    .get("nhl_public") or {}).get("id")
        current = ((g.get("provider_ids") or {})
                    .get("nhl_public") or {}).get("id")
        if rightful is not None and current is not None and rightful != current:
            collisions.append({
                "ticker_game_id": g["ticker_game_id"],
                "rightful_nhl_id": rightful,
                "wrongly_attached_nhl_id": current,
                "canonical": g,
                "rev1": rev1,
            })
    return collisions


async def _team_tri_map(db) -> dict[str, str]:
    m: dict[str, str] = {}
    async for t in db["iq_canonical_teams"].find({"competition": "NHL"}):
        tri = (t.get("provider_ids", {}).get("nhl_public") or {}).get("tri_code")
        if tri:
            m[tri] = t["ticker_team_id"]
    return m


async def repair_one(db, http: httpx.AsyncClient, collision: dict,
                     tri_to_tid: dict[str, str]) -> dict:
    """Repair a single collided canonical.

    Steps (order matters):
      1. Restore the canonical's cached provider_ids.nhl_public.id to
         its rightful value (from rev 1's provider_ids_at_revision).
      2. Fetch the rightful game's boxscore.
      3. Compare with the newest iq_game_finals version. If the newest
         version already matches rightful truth, do nothing to the chain.
         Otherwise append ONE corrective version tagged
         canonical_identity_repair with the rightful boxscore's truth.
      4. Mint a separate canonical for the wrongly-attached NHL id under
         the AMENDED resolver (which now excludes same-provider-id
         collisions).
      5. Ingest that game's proper v1 iq_game_finals.
    """
    tgid = collision["ticker_game_id"]
    rightful_id = collision["rightful_nhl_id"]
    wrong_id = collision["wrongly_attached_nhl_id"]
    report: dict[str, Any] = {
        "ticker_game_id": tgid,
        "rightful_nhl_id": rightful_id,
        "wrongly_attached_nhl_id": wrong_id,
    }

    # --- Step 1 — restore canonical cache -----------------------------------
    await db["iq_canonical_games"].update_one(
        {"ticker_game_id": tgid},
        {"$set": {
            "provider_ids.nhl_public.id": rightful_id,
            "provider_ids.nhl_public.last_seen_at": now_iso(),
            "updated_at": now_iso(),
        }},
    )
    report["canonical_cache_restored"] = True

    # --- Step 2 — fetch the rightful game's boxscore ------------------------
    rightful_bx = await _fetch_boxscore(http, rightful_id)
    if not rightful_bx:
        report["error"] = f"could not fetch rightful boxscore {rightful_id}"
        return report

    # Rebuild the rightful payload from scratch so a version comparison is
    # apples-to-apples with the writer's own truth-view.
    home_tri = (rightful_bx.get("homeTeam") or {}).get("abbrev")
    away_tri = (rightful_bx.get("awayTeam") or {}).get("abbrev")
    home_tid = tri_to_tid.get(home_tri) or await resolve_team(
        db, TeamHint("nhl_public", {"tri_code": home_tri},
                     display_name=home_tri, market=home_tri))
    away_tid = tri_to_tid.get(away_tri) or await resolve_team(
        db, TeamHint("nhl_public", {"tri_code": away_tri},
                     display_name=away_tri, market=away_tri))
    tri_to_tid[home_tri] = home_tid
    tri_to_tid[away_tri] = away_tid

    rightful_payload = parse_boxscore_to_final_payload(
        rightful_bx,
        ticker_game_id=tgid,
        home_team_id=home_tid, away_team_id=away_tid,
        endpoint=f"gamecenter/{rightful_id}/boxscore",
    )

    # --- Step 3 — inspect newest iq_game_finals version ---------------------
    newest = await db["iq_game_finals"].find_one(
        {"ticker_game_id": tgid}, sort=[("record_version", -1)])
    from intelligence.models_1b import GameFinal
    intended_full = GameFinal(
        ticker_game_id=tgid,
        record_version=(newest["record_version"] + 1 if newest else 1),
        supersedes_record_version=(newest["record_version"] if newest else None),
        correction_reason=("canonical_identity_repair" if newest else "initial"),  # type: ignore[arg-type]
        **{k: v for k, v in rightful_payload.items() if k not in {"ticker_game_id"}},
    ).model_dump()

    if newest and _truth_view(newest) == _truth_view(intended_full):
        report["repair_action_on_original_chain"] = "newest_already_correct_no_op"
    else:
        # Materially wrong newest → append ONE corrective version
        r = await write_game_final(
            db,
            correction_reason="canonical_identity_repair",
            **rightful_payload,
        )
        report["repair_action_on_original_chain"] = r.get("write_action")
        report["corrective_record_version"] = r.get("record_version")

    # --- Step 4 — mint separate canonical for wrongly-attached NHL id -------
    wrong_bx = await _fetch_boxscore(http, wrong_id)
    if not wrong_bx:
        report["error_secondary"] = f"could not fetch wrong-id boxscore {wrong_id}"
        return report
    wrong_home_tri = (wrong_bx.get("homeTeam") or {}).get("abbrev")
    wrong_away_tri = (wrong_bx.get("awayTeam") or {}).get("abbrev")
    wrong_home_tid = tri_to_tid.get(wrong_home_tri) or await resolve_team(
        db, TeamHint("nhl_public", {"tri_code": wrong_home_tri},
                     display_name=wrong_home_tri, market=wrong_home_tri))
    wrong_away_tid = tri_to_tid.get(wrong_away_tri) or await resolve_team(
        db, TeamHint("nhl_public", {"tri_code": wrong_away_tri},
                     display_name=wrong_away_tri, market=wrong_away_tri))
    tri_to_tid[wrong_home_tri] = wrong_home_tid
    tri_to_tid[wrong_away_tri] = wrong_away_tid

    new_hint = GameHint(
        provider="nhl_public",
        provider_game_id=wrong_id,
        season=season_int_to_str(wrong_bx.get("season") or ""),
        season_type=season_type_from_game_type(wrong_bx.get("gameType") or 2),
        home_hint=TeamHint("nhl_public", {"tri_code": wrong_home_tri},
                            display_name=wrong_home_tri, market=wrong_home_tri),
        away_hint=TeamHint("nhl_public", {"tri_code": wrong_away_tri},
                            display_name=wrong_away_tri, market=wrong_away_tri),
        scheduled_iso=wrong_bx.get("startTimeUTC") or now_iso(),
        status="final",
        declares_new_game=True,
    )
    new_tgid = await resolve_game(db, new_hint)
    report["new_ticker_game_id_for_wrong_id"] = new_tgid

    # --- Step 5 — write v1 iq_game_finals for the new canonical -------------
    v1_payload = parse_boxscore_to_final_payload(
        wrong_bx,
        ticker_game_id=new_tgid,
        home_team_id=wrong_home_tid, away_team_id=wrong_away_tid,
        endpoint=f"gamecenter/{wrong_id}/boxscore",
    )
    r_new = await write_game_final(
        db, correction_reason="initial", **v1_payload,
    )
    report["new_canonical_v1_action"] = r_new.get("write_action")
    return report


async def run(mongo_url: Optional[str] = None) -> dict:
    mongo_url = mongo_url or os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get("DB_NAME", "test_database")]

    collisions = await _find_collisions(db)
    tri_to_tid = await _team_tri_map(db)

    reports = []
    async with httpx.AsyncClient() as http:
        for c in collisions:
            reports.append(await repair_one(db, http, c, tri_to_tid))

    result = {
        "started_at": now_iso(),
        "collisions_detected": len(collisions),
        "collisions_repaired": sum(
            1 for r in reports if "new_ticker_game_id_for_wrong_id" in r
            and r.get("new_canonical_v1_action") in ("inserted_v1", "noop_identical",
                                                       "noop_already_present")
        ),
        "reports": reports,
        "finished_at": now_iso(),
    }
    client.close()
    return result


if __name__ == "__main__":
    import json
    print(json.dumps(asyncio.run(run()), indent=2, default=str))
