"""Append-only writer for iq_game_finals.

Build corrections enforced here:

Correction #1 — Concurrent identical corrections do not create an extra version.
  If the newest existing record already reflects the intended payload
  (compared field-by-field on the game-truth fields), the writer no-ops
  and returns the existing record. A new record_version is created only
  when the intent differs from what's already stored.

REV2 discipline — no coverage-management subsystem.
  This writer only touches iq_game_finals. Season completeness (partial
  vs complete) is not stored anywhere in 1B; a caller who needs to gate
  on that must present positive evidence at its own call site.
"""
from __future__ import annotations
from typing import Optional

from pymongo.errors import DuplicateKeyError

from intelligence.models_1b import (
    GameFinal, FinalScore, TeamGameFacts, GoalieLine,
)
from intelligence.models_1a import Provenance, now_iso


# The set of "game truth" fields whose equality determines whether a
# proposed correction is actually novel or just a re-declaration of the
# already-known state. Provenance and recorded_at are excluded — those
# always differ per fetch and are metadata, not truth.
def _truth_view(doc: dict) -> dict:
    """Extract only the game-truth fields for identity comparison."""
    def _pick(d, keys):
        return {k: d.get(k) for k in keys}
    return {
        "final_score": doc.get("final_score"),
        "home_team_facts": doc.get("home_team_facts"),
        "away_team_facts": doc.get("away_team_facts"),
        "home_goalies": doc.get("home_goalies"),
        "away_goalies": doc.get("away_goalies"),
        "played_at_iso": doc.get("played_at_iso"),
        "season": doc.get("season"),
        "season_type": doc.get("season_type"),
        "home_team_id": doc.get("home_team_id"),
        "away_team_id": doc.get("away_team_id"),
    }


async def _newest_final(db, ticker_game_id: str) -> Optional[dict]:
    return await db["iq_game_finals"].find_one(
        {"ticker_game_id": ticker_game_id},
        sort=[("record_version", -1)],
    )


async def write_game_final(
    db,
    *,
    ticker_game_id: str,
    competition: str,
    season: str,
    season_type: str,
    home_team_id: str,
    away_team_id: str,
    played_at_iso: str,
    final_score: FinalScore,
    home_team_facts: TeamGameFacts,
    away_team_facts: TeamGameFacts,
    home_goalies: list[GoalieLine],
    away_goalies: list[GoalieLine],
    correction_reason: str,
    provenance: Provenance,
    _max_retries: int = 5,
) -> dict:
    """Insert (or no-op) the next record_version for this ticker_game_id.

    Returns the resulting record as a dict, plus a 'write_action' key that
    reports what actually happened:

      - 'inserted_v1'           first time this game has a final
      - 'inserted_new_version'  correction that differed from newest
      - 'noop_identical'        proposed correction matched newest → skipped
      - 'noop_already_present'  concurrent writer inserted same intent first
    """
    # Build the *intended* payload once so we can compare truth-views.
    def _payload(record_version: int, supersedes: Optional[int]) -> dict:
        # v1 must always carry 'initial'. For corrections, we honor the
        # caller's reason unless the caller passed 'initial' (which would
        # fail model validation) — in that case, treat this as
        # 'provider_late_data', the honest default when the writer sees a
        # newer payload for an already-recorded game.
        if record_version == 1:
            cr = "initial"
        elif correction_reason == "initial":
            cr = "provider_late_data"
        else:
            cr = correction_reason
        return GameFinal(
            ticker_game_id=ticker_game_id,
            record_version=record_version,
            supersedes_record_version=supersedes,
            correction_reason=cr,   # type: ignore[arg-type]
            competition=competition,  # type: ignore[arg-type]
            season=season,
            season_type=season_type,  # type: ignore[arg-type]
            home_team_id=home_team_id,
            away_team_id=away_team_id,
            played_at_iso=played_at_iso,
            final_score=final_score,
            home_team_facts=home_team_facts,
            away_team_facts=away_team_facts,
            home_goalies=home_goalies,
            away_goalies=away_goalies,
            provenance=provenance,
        ).model_dump()

    for _attempt in range(_max_retries):
        newest = await _newest_final(db, ticker_game_id)
        # First-time insert
        if newest is None:
            doc = _payload(record_version=1, supersedes=None)
            try:
                await db["iq_game_finals"].insert_one(doc)
            except DuplicateKeyError:
                # concurrent writer created v1 first — reread and continue loop
                continue
            doc["write_action"] = "inserted_v1"
            return doc

        # Identity-check: if intent matches newest truth-view exactly,
        # no new version. This is correction #1.
        intended = _payload(record_version=newest["record_version"] + 1,
                            supersedes=newest["record_version"])
        if _truth_view(intended) == _truth_view(newest):
            newest["write_action"] = "noop_identical"
            return newest

        # Distinct correction — attempt to insert the next version.
        try:
            await db["iq_game_finals"].insert_one(intended)
        except DuplicateKeyError:
            # Concurrent writer got this record_version. Re-read newest and
            # re-check truth-view identity. If identical, no-op.
            latest = await _newest_final(db, ticker_game_id)
            if latest and _truth_view(latest) == _truth_view(intended):
                latest["write_action"] = "noop_already_present"
                return latest
            # Different intent from what the concurrent writer put down.
            # Loop and try again with a fresh version number on top of latest.
            continue
        intended["write_action"] = "inserted_new_version"
        return intended

    raise RuntimeError("write_game_final exhausted retries")
