"""Canonical team resolver.

Provider hints (Sportradar alias + market, Highlightly abbrev, NHL tri-code,
SportsData.io key) resolve into a permanent ticker_team_id. First sight
mints; subsequent sights update provider slots.
"""
from __future__ import annotations
from typing import Any, Optional
from pymongo.errors import DuplicateKeyError

from intelligence.identity import mint_team_id
from intelligence.models_1a import CanonicalTeam, ProviderIdsTeam, Provenance, now_iso
from intelligence.errors import AmbiguousTeamHint

ENGINE_VERSION = "1.0.0"

# Sportradar historically aliases both Colorado Avalanche and Columbus Blue
# Jackets as "COL". Any resolve() call with alias="COL" MUST supply market.
_AMBIGUOUS_SR_ALIASES = {"COL"}


class TeamHint:
    """Simple carrier — not a Pydantic model to keep the resolver free of
    schema noise. Callers pass whatever a provider actually gave them."""
    def __init__(self, provider: str, provider_ids: dict[str, Any],
                 display_name: Optional[str] = None, market: Optional[str] = None,
                 canonical_code_fallback: Optional[str] = None):
        self.provider = provider
        self.provider_ids = provider_ids
        self.display_name = display_name
        self.market = market
        self.canonical_code_fallback = canonical_code_fallback


def _empty_provenance(source_name: str, endpoint: str, http_status: int) -> Provenance:
    return Provenance(
        sources_consulted=[{
            "name": source_name, "endpoint": endpoint, "fetched_at": now_iso(),
            "http_status": http_status, "cache_hit": False,
            "fields_populated": ["ticker_team_id"],
        }],
        written_at=now_iso(), engine_version=ENGINE_VERSION,
    )


def _pid_query_key(provider: str, ids: dict[str, Any]) -> Optional[tuple[str, Any]]:
    """Pick the highest-value provider id from a hint to use as the primary
    lookup key. Returns (dotted-path, value) or None."""
    if provider == "sportradar" and ids.get("id"):
        return ("provider_ids.sportradar.id", ids["id"])
    if provider == "highlightly" and ids.get("id"):
        return ("provider_ids.highlightly.id", ids["id"])
    if provider == "nhl_public" and ids.get("tri_code"):
        return ("provider_ids.nhl_public.tri_code", ids["tri_code"])
    if provider == "sportsdata_io" and ids.get("team_id"):
        return ("provider_ids.sportsdata_io.team_id", ids["team_id"])
    return None


async def resolve_team(db, hint: TeamHint) -> str:
    """Return the ticker_team_id for this hint, minting a new one if
    genuinely first-sight. Raises AmbiguousTeamHint on Sportradar COL
    without market."""
    # Ambiguity guard — do this BEFORE any DB lookup
    if hint.provider == "sportradar":
        alias = hint.provider_ids.get("alias")
        if alias in _AMBIGUOUS_SR_ALIASES and not hint.market:
            raise AmbiguousTeamHint(
                f"Sportradar alias {alias!r} requires market to disambiguate")

    coll = db["iq_canonical_teams"]

    # Step 1 — provider-id exact match (uses the partial-unique index)
    pkey = _pid_query_key(hint.provider, hint.provider_ids)
    if pkey:
        existing = await coll.find_one({pkey[0]: pkey[1]})
        if existing:
            await _update_provider_slot(coll, existing["ticker_team_id"], hint)
            return existing["ticker_team_id"]

    # Step 2 — secondary key match (canonical_code + market)
    code = hint.canonical_code_fallback or hint.provider_ids.get("alias") \
        or hint.provider_ids.get("abbreviation") or hint.provider_ids.get("tri_code") \
        or hint.provider_ids.get("key")
    if code:
        query = {"competition": "NHL", "canonical_code": code.upper()}
        if hint.market:
            query["market"] = hint.market
        existing = await coll.find_one(query)
        if existing:
            await _update_provider_slot(coll, existing["ticker_team_id"], hint)
            return existing["ticker_team_id"]

    # Step 3 — mint. We build the initial ProviderIdsTeam with only this
    # provider's slot populated; every other slot stays with None values so
    # the partial indexes don't reject the insert.
    new_id = mint_team_id()
    provider_slot = _build_provider_slot(hint)
    doc = CanonicalTeam(
        ticker_team_id=new_id,
        competition="NHL",
        canonical_code=(code or "UNK").upper(),
        display_name=hint.display_name or (code or "Unknown"),
        market=hint.market or (hint.display_name or "Unknown"),
        provider_ids=provider_slot,
        provenance=_empty_provenance(hint.provider, "resolve_team", 200),
    )
    try:
        await coll.insert_one(doc.model_dump())
    except DuplicateKeyError:
        # Concurrent minter won; re-resolve by the same key
        return await resolve_team(db, hint)
    return new_id


def _build_provider_slot(hint: TeamHint) -> ProviderIdsTeam:
    """Build a ProviderIdsTeam with only this provider's fields populated."""
    kwargs: dict[str, Any] = {}
    if hint.provider == "sportradar":
        kwargs["sportradar"] = {
            "id": hint.provider_ids.get("id"),
            "alias": hint.provider_ids.get("alias"),
        }
    elif hint.provider == "highlightly":
        kwargs["highlightly"] = {
            "id": hint.provider_ids.get("id"),
            "abbreviation": hint.provider_ids.get("abbreviation"),
        }
    elif hint.provider == "nhl_public":
        kwargs["nhl_public"] = {"tri_code": hint.provider_ids.get("tri_code")}
    elif hint.provider == "sportsdata_io":
        kwargs["sportsdata_io"] = {
            "key": hint.provider_ids.get("key"),
            "team_id": hint.provider_ids.get("team_id"),
        }
    return ProviderIdsTeam(**kwargs)


async def _update_provider_slot(coll, ticker_team_id: str, hint: TeamHint) -> None:
    """Attach this provider's IDs to an already-resolved team. Never
    touches the canonical fields; only provider_ids and updated_at."""
    updates: dict[str, Any] = {"updated_at": now_iso()}
    if hint.provider == "sportradar":
        if hint.provider_ids.get("id") is not None:
            updates["provider_ids.sportradar.id"] = hint.provider_ids["id"]
        if hint.provider_ids.get("alias") is not None:
            updates["provider_ids.sportradar.alias"] = hint.provider_ids["alias"]
    elif hint.provider == "highlightly":
        if hint.provider_ids.get("id") is not None:
            updates["provider_ids.highlightly.id"] = hint.provider_ids["id"]
        if hint.provider_ids.get("abbreviation") is not None:
            updates["provider_ids.highlightly.abbreviation"] = hint.provider_ids["abbreviation"]
    elif hint.provider == "nhl_public":
        if hint.provider_ids.get("tri_code") is not None:
            updates["provider_ids.nhl_public.tri_code"] = hint.provider_ids["tri_code"]
    elif hint.provider == "sportsdata_io":
        if hint.provider_ids.get("key") is not None:
            updates["provider_ids.sportsdata_io.key"] = hint.provider_ids["key"]
        if hint.provider_ids.get("team_id") is not None:
            updates["provider_ids.sportsdata_io.team_id"] = hint.provider_ids["team_id"]
    if len(updates) > 1:
        await coll.update_one({"ticker_team_id": ticker_team_id}, {"$set": updates})
