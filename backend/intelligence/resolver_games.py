"""Canonical game resolver + schedule revision writer.

Rules (Foundation 1A decisions):
  - Postponement never mints a new ticker_game_id automatically.
  - Ambiguity escalates to UnresolvedGameIdentity for human reconciliation.
  - Schedule revisions are the immutable source of truth. The
    iq_canonical_games.current cache is a materialized view; if the
    cache write fails, the revision still wins and the read endpoint
    surfaces cache_inconsistent: true.
  - schedule_release is emitted at first sight ONLY via emit_schedule_release_first_sight(),
    which lives in the snapshotter. This module hooks that call after
    a successful mint.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo.errors import DuplicateKeyError

from intelligence.identity import mint_game_id
from intelligence.errors import AmbiguousGameHint, UnresolvedGameIdentity
from intelligence.models_1a import (
    CanonicalGame, GameCurrent, ProviderIdsGame, ProviderIdSlot,
    ScheduleRevision, Provenance, Venue, now_iso,
)
from intelligence.resolver_teams import resolve_team, TeamHint

ENGINE_VERSION = "1.0.0"
_CLOSE_MATCH_WINDOW = timedelta(hours=72)


class GameHint:
    """Provider payload carrier for game resolution."""
    def __init__(self, provider: str, provider_game_id: Any,
                 season: str, season_type: str,
                 home_hint: TeamHint, away_hint: TeamHint,
                 scheduled_iso: str, status: str = "scheduled",
                 venue: Optional[dict] = None,
                 declares_new_game: bool = False,
                 supporting_evidence: Optional[dict] = None):
        self.provider = provider
        self.provider_game_id = provider_game_id
        self.season = season
        self.season_type = season_type
        self.home_hint = home_hint
        self.away_hint = away_hint
        self.scheduled_iso = scheduled_iso
        self.status = status
        self.venue = venue
        self.declares_new_game = declares_new_game
        self.supporting_evidence = supporting_evidence or {}


def _parse_iso(s: str) -> datetime:
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    return datetime.fromisoformat(s)


def _pid_field(provider: str) -> str:
    return f"provider_ids.{provider}.id"


async def _find_by_provider_id(db, provider: str, pid: Any) -> Optional[dict]:
    return await db["iq_canonical_games"].find_one({_pid_field(provider): pid})


async def _find_natural_close(db, home_id: str, away_id: str, season: str,
                              season_type: str, scheduled_iso: str) -> list[dict]:
    target = _parse_iso(scheduled_iso)
    lo = (target - _CLOSE_MATCH_WINDOW).isoformat().replace("+00:00", "Z")
    hi = (target + _CLOSE_MATCH_WINDOW).isoformat().replace("+00:00", "Z")
    cur = db["iq_canonical_games"].find({
        "competition": "NHL", "season": season, "season_type": season_type,
        "home_team_id": home_id, "away_team_id": away_id,
        "current.scheduled_iso": {"$gte": lo, "$lte": hi},
    })
    return [g async for g in cur]


async def _find_far_candidates(db, home_id: str, away_id: str,
                               season: str, season_type: str) -> list[dict]:
    cur = db["iq_canonical_games"].find({
        "competition": "NHL", "season": season, "season_type": season_type,
        "home_team_id": home_id, "away_team_id": away_id,
        "current.status": {"$in": ["scheduled", "postponed"]},
    })
    return [g async for g in cur]


async def _positive_evidence_of_reschedule(db, candidate: dict, hint: GameHint) -> bool:
    """A far-postponement match is 'positive evidence' only when we can
    tie THIS hint to THIS candidate. Rules (order matters):

      1. If the candidate has previously carried this exact provider_id in
         any prior revision, that is proof.
      2. If the provider's supporting_evidence carries prior_scheduled_iso
         that matches a prior revision on this candidate, that is proof.

    Otherwise, refuse to auto-match.
    """
    tgid = candidate["ticker_game_id"]
    if hint.provider_game_id is not None:
        prior = await db["iq_game_schedule_revisions"].find_one({
            "ticker_game_id": tgid,
            f"provider_ids_at_revision.{hint.provider}.id": hint.provider_game_id,
        })
        if prior:
            return True
    prior_iso = hint.supporting_evidence.get("prior_scheduled_iso")
    if prior_iso:
        prior = await db["iq_game_schedule_revisions"].find_one({
            "ticker_game_id": tgid, "scheduled_iso": prior_iso,
        })
        if prior:
            return True
    return False


async def _record_reconciliation(db, hint: GameHint, reason: str, candidates: list[dict]):
    await db["iq_reconciliation_queue"].insert_one({
        "kind": "unresolved_game_identity",
        "reason": reason,
        "hint": {
            "provider": hint.provider,
            "provider_game_id": hint.provider_game_id,
            "season": hint.season,
            "season_type": hint.season_type,
            "scheduled_iso": hint.scheduled_iso,
            "status": hint.status,
        },
        "candidate_ticker_game_ids": [c["ticker_game_id"] for c in candidates],
        "recorded_at": now_iso(),
    })


async def resolve_game(db, hint: GameHint,
                       *, on_first_sight=None) -> str:
    """Return the ticker_game_id for this hint.

    on_first_sight: optional async callback fired ONCE when a new
    ticker_game_id is minted, AFTER revision 1 has been written. Used by
    the snapshotter to trigger emit_schedule_release_first_sight.
    """
    home_id = await resolve_team(db, hint.home_hint)
    away_id = await resolve_team(db, hint.away_hint)

    # Step 2 — provider-id exact
    if hint.provider_game_id is not None:
        existing = await _find_by_provider_id(db, hint.provider, hint.provider_game_id)
        if existing:
            return existing["ticker_game_id"]

    # Step 3 — natural-key close match
    close = await _find_natural_close(db, home_id, away_id, hint.season,
                                      hint.season_type, hint.scheduled_iso)
    if len(close) == 1:
        await _attach_new_provider_id(db, close[0]["ticker_game_id"], hint)
        return close[0]["ticker_game_id"]
    if len(close) > 1:
        raise AmbiguousGameHint(
            f"{len(close)} canonical games match within 72h of {hint.scheduled_iso}")

    # Step 4 — far candidates (postponement > 72h)
    far = await _find_far_candidates(db, home_id, away_id, hint.season, hint.season_type)
    positive: list[dict] = []
    for cand in far:
        if await _positive_evidence_of_reschedule(db, cand, hint):
            positive.append(cand)
    if len(positive) == 1:
        await _attach_new_provider_id(db, positive[0]["ticker_game_id"], hint)
        return positive[0]["ticker_game_id"]
    if len(positive) > 1:
        await _record_reconciliation(db, hint, "multiple_positive_candidates", positive)
        raise UnresolvedGameIdentity(
            f"multiple candidates with positive reschedule evidence for {hint.provider_game_id}")
    if far and not hint.declares_new_game:
        # Candidates exist without positive evidence, provider isn't
        # asserting this is a new game. Refuse to mint.
        await _record_reconciliation(db, hint, "no_positive_evidence", far)
        raise UnresolvedGameIdentity(
            f"could not tie {hint.provider}:{hint.provider_game_id} to any candidate")

    # Step 5 — positive-evidence mint
    if not (hint.declares_new_game or not far):
        # Belt and suspenders: `not far` means no ambiguous candidates, which
        # itself IS positive evidence of a new game (empty candidate set).
        await _record_reconciliation(db, hint, "unexpected_state", far)
        raise UnresolvedGameIdentity("resolver in unexpected state")

    new_id = mint_game_id()
    provider_ids = ProviderIdsGame()
    setattr(provider_ids, hint.provider, ProviderIdSlot(
        id=hint.provider_game_id, first_seen_at=now_iso(), last_seen_at=now_iso(),
    ))
    venue = Venue(**hint.venue) if hint.venue else None
    doc = CanonicalGame(
        ticker_game_id=new_id,
        competition="NHL",
        season=hint.season,
        season_type=hint.season_type,   # type: ignore[arg-type]
        home_team_id=home_id,
        away_team_id=away_id,
        current=GameCurrent(
            scheduled_iso=hint.scheduled_iso,
            status=hint.status,          # type: ignore[arg-type]
            venue=venue,
            schedule_revision=1,
            as_of=now_iso(),
        ),
        provider_ids=provider_ids,
        provenance=Provenance(
            sources_consulted=[{
                "name": hint.provider, "endpoint": "resolve_game",
                "fetched_at": now_iso(), "http_status": 200,
                "cache_hit": False, "fields_populated": ["ticker_game_id"],
            }],
            written_at=now_iso(), engine_version=ENGINE_VERSION,
        ),
    )
    try:
        await db["iq_canonical_games"].insert_one(doc.model_dump())
    except DuplicateKeyError:
        # Concurrent minter won on a unique provider id — re-run resolve
        return await resolve_game(db, hint, on_first_sight=on_first_sight)

    # Write revision 1 IMMEDIATELY (immutable) — even before the callback
    await write_schedule_revision(
        db, ticker_game_id=new_id,
        scheduled_iso=hint.scheduled_iso, status=hint.status, venue=venue,
        reason="initial_schedule",
        provider_ids_at_revision=provider_ids,
        provenance=doc.provenance,
        _skip_cache_rebuild=True,   # cache already correct on the mint
    )

    if on_first_sight is not None:
        try:
            await on_first_sight(new_id)
        except Exception:
            # Snapshot retry is handled by the snapshotter's backlog; the
            # canonical game and revision are already durable.
            pass

    return new_id


async def _attach_new_provider_id(db, ticker_game_id: str, hint: GameHint) -> None:
    """Attach this hint's provider_game_id to an already-known canonical
    game. Updates last_seen_at; first_seen_at set only if empty."""
    if hint.provider_game_id is None:
        return
    field = f"provider_ids.{hint.provider}"
    ts = now_iso()
    # $setOnInsert semantics for first_seen_at via a two-step conditional
    existing = await db["iq_canonical_games"].find_one(
        {"ticker_game_id": ticker_game_id}, {f"{field}.first_seen_at": 1})
    first_seen = None
    if existing:
        first_seen = (existing.get("provider_ids", {})
                              .get(hint.provider, {})
                              .get("first_seen_at"))
    setters = {
        f"{field}.id": hint.provider_game_id,
        f"{field}.last_seen_at": ts,
        "updated_at": ts,
    }
    if not first_seen:
        setters[f"{field}.first_seen_at"] = ts
    await db["iq_canonical_games"].update_one(
        {"ticker_game_id": ticker_game_id}, {"$set": setters})


# --------------------------------------------------------------------------
# Schedule revision writer — immutable-first, cache-second.
# --------------------------------------------------------------------------
async def write_schedule_revision(
    db, *, ticker_game_id: str, scheduled_iso: str, status: str,
    venue: Optional[Venue], reason: Optional[str],
    provider_ids_at_revision: ProviderIdsGame, provenance: Provenance,
    _skip_cache_rebuild: bool = False,
    _max_retries: int = 5,
) -> int:
    """Insert a new schedule revision (immutable). On success rebuild the
    denormalized cache. Cache-rebuild failure does not roll back the
    revision — the QA endpoint surfaces cache_inconsistent instead."""
    rev_coll = db["iq_game_schedule_revisions"]
    game_coll = db["iq_canonical_games"]

    for _attempt in range(_max_retries):
        latest = await rev_coll.find_one(
            {"ticker_game_id": ticker_game_id}, sort=[("revision_number", -1)])
        latest_n = latest["revision_number"] if latest else 0
        new_n = latest_n + 1
        rev_doc = ScheduleRevision(
            ticker_game_id=ticker_game_id,
            revision_number=new_n,
            supersedes_revision=(latest_n if latest_n > 0 else None),
            scheduled_iso=scheduled_iso,
            status=status,          # type: ignore[arg-type]
            venue=venue,
            reason=reason,
            provider_ids_at_revision=provider_ids_at_revision,
            provenance=provenance,
        )
        try:
            await rev_coll.insert_one(rev_doc.model_dump())
        except DuplicateKeyError:
            # Concurrent writer got new_n. Retry with fresh max.
            continue

        # Immutable revision now exists. Rebuild the cache.
        if _skip_cache_rebuild:
            return new_n
        try:
            await game_coll.update_one(
                {"ticker_game_id": ticker_game_id},
                {"$set": {
                    "current.scheduled_iso": scheduled_iso,
                    "current.status": status,
                    "current.venue": venue.model_dump() if venue else None,
                    "current.schedule_revision": new_n,
                    "current.as_of": now_iso(),
                    "updated_at": now_iso(),
                }},
            )
        except Exception:
            # Cache write failed. Revision is truth; the endpoint will
            # surface cache_inconsistent: true until a reconciler catches up.
            pass
        return new_n
    raise RuntimeError("schedule revision writer exhausted retries")
