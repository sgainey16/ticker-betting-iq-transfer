"""Foundation 1A test suite — full coverage of the checkpoint requirements.

Uses mongomock-motor if available (fast, in-process). Falls back to the
real MongoDB test_database with a per-test collection prefix so tests
never touch production data.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError

from intelligence.identity import mint_game_id, mint_team_id
from intelligence.indexes import ensure_indexes
from intelligence.models_1a import (
    CanonicalGame, CanonicalTeam, GameContextSnapshot, GameCurrent,
    ProviderIdsGame, ProviderIdSlot, ProviderIdsTeam, Provenance,
    ScheduleRevision, SourceRecord, TeamRecordsEntering, RestAndTravel,
    Venue, now_iso,
)
from intelligence.errors import (
    AmbiguousGameHint, AmbiguousTeamHint, UnresolvedGameIdentity,
)
from intelligence.resolver_teams import resolve_team, TeamHint
from intelligence.resolver_games import (
    resolve_game, GameHint, write_schedule_revision,
)
from intelligence.snapshotter import (
    emit_schedule_release_first_sight, worker_tick,
    retry_schedule_release_backlog, _schedule_release_backlog,
)
from intelligence.lock_time_attachment import attach, reconcile_pending


ENGINE = "1.0.0"


def _prov(source="sportradar", endpoint="test", status=200) -> Provenance:
    return Provenance(
        sources_consulted=[SourceRecord(
            name=source, endpoint=endpoint, fetched_at=now_iso(),
            http_status=status, cache_hit=False, fields_populated=[]
        )],
        written_at=now_iso(), engine_version=ENGINE,
    )


@pytest.fixture
async def db():
    """Per-test isolated database in the shared MongoDB instance."""
    # Clear the module-level schedule_release backlog between tests so
    # stale ticker_game_ids from prior test databases don't leak forward.
    _schedule_release_backlog.clear()
    client = AsyncIOMotorClient(
        os.environ.get("MONGO_URL", "mongodb://localhost:27017"),
        maxPoolSize=5, serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000, socketTimeoutMS=20000,
    )
    dbname = f"iq1a_test_{uuid.uuid4().hex[:8]}"
    d = client[dbname]
    # Retry index creation on transient AutoReconnect (crowded test runs).
    from pymongo.errors import AutoReconnect
    for attempt in range(3):
        try:
            await ensure_indexes(d)
            break
        except AutoReconnect:
            if attempt == 2:
                raise
            await asyncio.sleep(0.5)
    yield d
    try:
        await client.drop_database(dbname)
    except Exception:
        pass
    client.close()


async def _team_hint(alias: str, market: str = None, provider: str = "sportradar") -> TeamHint:
    return TeamHint(provider=provider,
                    provider_ids={"id": f"sr-{alias.lower()}-{uuid.uuid4().hex[:4]}",
                                  "alias": alias},
                    display_name=f"{market or alias} Test",
                    market=market or alias, canonical_code_fallback=alias)


async def _seed_two_teams(db) -> tuple[str, str]:
    edm = await resolve_team(db, TeamHint("sportradar",
        {"id": "sr-edm-1", "alias": "EDM"}, display_name="Edmonton Oilers",
        market="Edmonton", canonical_code_fallback="EDM"))
    van = await resolve_team(db, TeamHint("sportradar",
        {"id": "sr-van-1", "alias": "VAN"}, display_name="Vancouver Canucks",
        market="Vancouver", canonical_code_fallback="VAN"))
    return edm, van


# ---------------------------------------------------------------------------
# 10i — identity + team resolver
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_sportradar_col_ambiguous_without_market_is_rejected(db):
    with pytest.raises(AmbiguousTeamHint):
        await resolve_team(db, TeamHint("sportradar",
            {"id": "sr-col-x", "alias": "COL"},
            display_name="Colorado", market=None,
            canonical_code_fallback="COL"))
    assert await db["iq_canonical_teams"].count_documents({}) == 0


@pytest.mark.asyncio
async def test_team_resolver_idempotent_and_updates_slot(db):
    tid1 = await resolve_team(db, TeamHint("sportradar",
        {"id": "sr-edm-1", "alias": "EDM"}, display_name="Edmonton Oilers",
        market="Edmonton"))
    tid2 = await resolve_team(db, TeamHint("nhl_public",
        {"tri_code": "EDM"}, display_name="Oilers",
        market="Edmonton", canonical_code_fallback="EDM"))
    assert tid1 == tid2
    doc = await db["iq_canonical_teams"].find_one({"ticker_team_id": tid1})
    assert doc["provider_ids"]["sportradar"]["id"] == "sr-edm-1"
    assert doc["provider_ids"]["nhl_public"]["tri_code"] == "EDM"


# ---------------------------------------------------------------------------
# 10k — partial-unique-index tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_multiple_teams_with_null_provider_ids_do_not_collide(db):
    """Insert 3 teams where highlightly.id is null — no unique-index conflict."""
    for i in range(3):
        t = CanonicalTeam(
            ticker_team_id=mint_team_id(),
            competition="NHL", canonical_code=f"T{i}A",
            display_name=f"Team{i}", market=f"City{i}",
            provider_ids=ProviderIdsTeam(),  # every provider slot null
            provenance=_prov(),
        )
        await db["iq_canonical_teams"].insert_one(t.model_dump())
    assert await db["iq_canonical_teams"].count_documents({}) == 3


@pytest.mark.asyncio
async def test_two_games_cannot_share_a_non_null_current_provider_id(db):
    edm, van = await _seed_two_teams(db)
    # First insert
    doc1 = CanonicalGame(
        ticker_game_id=mint_game_id(), competition="NHL", season="2026",
        season_type="REG", home_team_id=edm, away_team_id=van,
        current=GameCurrent(scheduled_iso=now_iso(), status="scheduled",
                            schedule_revision=1, as_of=now_iso()),
        provider_ids=ProviderIdsGame(sportradar=ProviderIdSlot(id="sr-dup-1")),
        provenance=_prov(),
    )
    await db["iq_canonical_games"].insert_one(doc1.model_dump())
    doc2 = CanonicalGame(
        ticker_game_id=mint_game_id(), competition="NHL", season="2026",
        season_type="REG", home_team_id=van, away_team_id=edm,
        current=GameCurrent(scheduled_iso=now_iso(), status="scheduled",
                            schedule_revision=1, as_of=now_iso()),
        provider_ids=ProviderIdsGame(sportradar=ProviderIdSlot(id="sr-dup-1")),
        provenance=_prov(),
    )
    with pytest.raises(DuplicateKeyError):
        await db["iq_canonical_games"].insert_one(doc2.model_dump())


# ---------------------------------------------------------------------------
# 10c — postponement preserves same ticker_game_id
# 10m — >72h postponement + positive evidence + ambiguous escalation
# ---------------------------------------------------------------------------
def _iso_at(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@pytest.mark.asyncio
async def test_postponement_within_72h_preserves_ticker_game_id(db):
    """The natural-key close match handles Tue→Thu (48h)."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    thu = tue + timedelta(hours=48)
    hint1 = GameHint("sportradar", "sr-g-1", "2026", "REG",
        TeamHint("sportradar", {"id": "sr-edm-1", "alias": "EDM"},
                 display_name="Edmonton", market="Edmonton"),
        TeamHint("sportradar", {"id": "sr-van-1", "alias": "VAN"},
                 display_name="Vancouver", market="Vancouver"),
        _iso_at(tue), declares_new_game=True)
    tgid1 = await resolve_game(db, hint1)
    # Same provider game id, new scheduled_iso within 72h
    hint2 = GameHint("sportradar", "sr-g-1", "2026", "REG",
        hint1.home_hint, hint1.away_hint, _iso_at(thu))
    tgid2 = await resolve_game(db, hint2)
    assert tgid1 == tgid2
    assert await db["iq_canonical_games"].count_documents({}) == 1


@pytest.mark.asyncio
async def test_far_postponement_with_positive_evidence_no_new_mint(db):
    """A 7-day postponement — natural-key close misses. But the provider
    reissues its game id; we still hold the original in revisions, giving
    positive evidence to keep the same ticker_game_id."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    orig_iso = _iso_at(tue)
    hint1 = GameHint("sportradar", "sr-orig", "2026", "REG",
        TeamHint("sportradar", {"id": "sr-edm-1", "alias": "EDM"},
                 display_name="Edmonton", market="Edmonton"),
        TeamHint("sportradar", {"id": "sr-van-1", "alias": "VAN"},
                 display_name="Vancouver", market="Vancouver"),
        orig_iso, declares_new_game=True)
    tgid1 = await resolve_game(db, hint1)
    # Provider reissues id; scheduled_iso far outside 72h.
    hint2 = GameHint("sportradar", "sr-new-after-postpone", "2026", "REG",
        hint1.home_hint, hint1.away_hint,
        _iso_at(tue + timedelta(days=7)),
        supporting_evidence={"prior_scheduled_iso": orig_iso})
    tgid2 = await resolve_game(db, hint2)
    assert tgid1 == tgid2


# ---------------------------------------------------------------------------
# Playoff-series identity — proves the natural-key close-match is skipped for
# POST season. Two distinct playoff games (Games 1 & 2 of a series) played
# within 72h between the same two teams must NEVER collapse into one
# ticker_game_id — playoff games have unique provider IDs and are always
# distinct games.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_playoff_series_games_get_distinct_ticker_game_ids(db):
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    thu = tue + timedelta(hours=48)   # inside the 72h natural-key window
    home = TeamHint("nhl_public", {"tri_code": "FLA"},
                     display_name="Florida Panthers", market="Florida")
    away = TeamHint("nhl_public", {"tri_code": "EDM"},
                     display_name="Edmonton Oilers", market="Edmonton")
    game1 = GameHint("nhl_public", 2024030411, "2024-2025", "POST",
                     home, away, _iso_at(tue), declares_new_game=True)
    tgid1 = await resolve_game(db, game1)
    # Game 2 of the series — distinct NHL id, same teams, 48h later.
    game2 = GameHint("nhl_public", 2024030412, "2024-2025", "POST",
                     home, away, _iso_at(thu), declares_new_game=True)
    tgid2 = await resolve_game(db, game2)
    assert tgid1 != tgid2, \
        "playoff Games 1 and 2 must not collapse into one ticker_game_id"
    assert await db["iq_canonical_games"].count_documents({}) == 2


@pytest.mark.asyncio
async def test_regular_season_postponement_still_uses_natural_key(db):
    """Regression: the POST-only skip must not break regular-season
    postponement handling. A REG game with no provider_game_id match but
    a natural-key close-match within 72h still returns the same tgid."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    thu = tue + timedelta(hours=48)
    home = TeamHint("nhl_public", {"tri_code": "BOS"},
                     display_name="Boston Bruins", market="Boston")
    away = TeamHint("nhl_public", {"tri_code": "TOR"},
                     display_name="Toronto Maple Leafs", market="Toronto")
    # First provider records the game.
    hint1 = GameHint("nhl_public", 111111, "2026-2027", "REG",
                     home, away, _iso_at(tue), declares_new_game=True)
    tgid1 = await resolve_game(db, hint1)
    # Second provider (different provider_game_id) — natural-key close-match
    # applies for REG.
    hint2 = GameHint("sportsdata_io", 999999, "2026-2027", "REG",
                     home, away, _iso_at(thu))
    tgid2 = await resolve_game(db, hint2)
    assert tgid1 == tgid2, "regular-season natural-key close-match must still work"


# ---------------------------------------------------------------------------
# Same-provider identity exclusion — the newly approved 1A patch.
# Prevents distinct games between the same teams inside the ±72h window
# from collapsing when they carry DIFFERENT same-provider IDs. Preserves
# every other legitimate identity path.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_reg_same_teams_consecutive_day_home_and_home_stays_separate(db):
    """T1 — Two REG games between the same teams on consecutive days
    with different nhl_public IDs must mint two canonicals."""
    day = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    home = TeamHint("nhl_public", {"tri_code": "PIT"},
                     display_name="Pittsburgh Penguins", market="Pittsburgh")
    away = TeamHint("nhl_public", {"tri_code": "FLA"},
                     display_name="Florida Panthers", market="Florida")
    hint_a = GameHint("nhl_public", 111, "2026-2027", "REG",
                      home, away, _iso_at(day), declares_new_game=True)
    hint_b = GameHint("nhl_public", 222, "2026-2027", "REG",
                      home, away, _iso_at(day + timedelta(hours=24)),
                      declares_new_game=True)
    tgid_a = await resolve_game(db, hint_a)
    tgid_b = await resolve_game(db, hint_b)
    assert tgid_a != tgid_b
    assert await db["iq_canonical_games"].count_documents({}) == 2


@pytest.mark.asyncio
async def test_reg_pit_fla_real_collision_pattern_stays_separate(db):
    """T2 — Concrete reproduction of the live collision: real NHL IDs
    2025021211 (Apr 4) and 2025021223 (Apr 5), PIT home, FLA away."""
    apr_04 = datetime(2026, 4, 4, 21, 0, 0, tzinfo=timezone.utc)
    apr_05 = datetime(2026, 4, 5, 19, 0, 0, tzinfo=timezone.utc)
    home = TeamHint("nhl_public", {"tri_code": "PIT"},
                     display_name="Pittsburgh Penguins", market="Pittsburgh")
    away = TeamHint("nhl_public", {"tri_code": "FLA"},
                     display_name="Florida Panthers", market="Florida")
    hint_a = GameHint("nhl_public", 2025021211, "2025-2026", "REG",
                      home, away, _iso_at(apr_04), declares_new_game=True)
    hint_b = GameHint("nhl_public", 2025021223, "2025-2026", "REG",
                      home, away, _iso_at(apr_05), declares_new_game=True)
    tgid_a = await resolve_game(db, hint_a)
    tgid_b = await resolve_game(db, hint_b)
    assert tgid_a != tgid_b, "live PIT/FLA collision pattern must not repeat"
    # Each canonical carries its own distinct nhl_public.id
    doc_a = await db["iq_canonical_games"].find_one({"ticker_game_id": tgid_a})
    doc_b = await db["iq_canonical_games"].find_one({"ticker_game_id": tgid_b})
    assert doc_a["provider_ids"]["nhl_public"]["id"] == 2025021211
    assert doc_b["provider_ids"]["nhl_public"]["id"] == 2025021223


@pytest.mark.asyncio
async def test_reg_same_provider_id_postponement_stays_one_canonical(db):
    """T3 — Postponement with SAME provider ID must remain a single
    canonical. Handled by step 2 (provider-id exact); the amendment
    changes nothing here."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    home = TeamHint("nhl_public", {"tri_code": "STL"},
                     display_name="St. Louis Blues", market="St. Louis")
    away = TeamHint("nhl_public", {"tri_code": "DAL"},
                     display_name="Dallas Stars", market="Dallas")
    hint1 = GameHint("nhl_public", 555, "2026-2027", "REG",
                     home, away, _iso_at(tue), declares_new_game=True)
    tgid1 = await resolve_game(db, hint1)
    # Same provider id, reschedule +48h
    hint2 = GameHint("nhl_public", 555, "2026-2027", "REG",
                     home, away, _iso_at(tue + timedelta(hours=48)))
    tgid2 = await resolve_game(db, hint2)
    assert tgid1 == tgid2
    assert await db["iq_canonical_games"].count_documents({}) == 1


@pytest.mark.asyncio
async def test_reg_reissued_id_with_positive_evidence_stays_one_canonical(db):
    """T4 — Rare: provider reissues its own ID for a rescheduled game
    and supplies prior_scheduled_iso as positive evidence. Must resolve
    to the same canonical via step 4's positive-evidence path."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    orig_iso = _iso_at(tue)
    home = TeamHint("sportradar", {"id": "sr-h1", "alias": "EDM"},
                     display_name="Edmonton", market="Edmonton")
    away = TeamHint("sportradar", {"id": "sr-a1", "alias": "VAN"},
                     display_name="Vancouver", market="Vancouver")
    hint1 = GameHint("sportradar", "sr-orig-t4", "2026", "REG",
                     home, away, orig_iso, declares_new_game=True)
    tgid1 = await resolve_game(db, hint1)
    # Reissued id, 7 days later (>72h), with positive evidence.
    hint2 = GameHint("sportradar", "sr-reissued-t4", "2026", "REG",
                     home, away, _iso_at(tue + timedelta(days=7)),
                     supporting_evidence={"prior_scheduled_iso": orig_iso})
    tgid2 = await resolve_game(db, hint2)
    assert tgid1 == tgid2


@pytest.mark.asyncio
async def test_reg_reissued_id_without_evidence_within_72h_now_refuses(db):
    """T5 — Under the amendment, a hint carrying a DIFFERENT
    same-provider ID within ±72h must NOT be silently absorbed via step
    3. It must fall through to step 4, and without positive evidence,
    step 4 refuses. This is the fix for the collision pattern."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    home = TeamHint("sportradar", {"id": "sr-h5", "alias": "EDM"},
                     display_name="Edmonton", market="Edmonton")
    away = TeamHint("sportradar", {"id": "sr-a5", "alias": "VAN"},
                     display_name="Vancouver", market="Vancouver")
    hint1 = GameHint("sportradar", "sr-orig-t5", "2026", "REG",
                     home, away, _iso_at(tue), declares_new_game=True)
    await resolve_game(db, hint1)
    # Different same-provider id, ~48h later, no supporting_evidence.
    hint2 = GameHint("sportradar", "sr-different-t5", "2026", "REG",
                     home, away, _iso_at(tue + timedelta(hours=48)))
    with pytest.raises(UnresolvedGameIdentity):
        await resolve_game(db, hint2)
    # No new canonical minted (step 4 refused; reconciliation queued).
    assert await db["iq_canonical_games"].count_documents({}) == 1


@pytest.mark.asyncio
async def test_cross_provider_first_attachment_still_works(db):
    """T6 — Cross-provider reconciliation must still function. An
    nhl_public canonical exists; a sportsdata_io hint for the same
    game arrives within ±72h. Step 3 attaches sdio to the existing
    canonical because the candidate has no sdio.id."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    home = TeamHint("nhl_public", {"tri_code": "NYR"},
                     display_name="New York Rangers", market="New York")
    away = TeamHint("nhl_public", {"tri_code": "NJD"},
                     display_name="New Jersey Devils", market="New Jersey")
    hint_a = GameHint("nhl_public", 777, "2026-2027", "REG",
                     home, away, _iso_at(tue), declares_new_game=True)
    tgid_a = await resolve_game(db, hint_a)
    # sportsdata_io hint arrives close in time — no sdio id on candidate,
    # so step 3 attaches.
    hint_b = GameHint("sportsdata_io", 888, "2026-2027", "REG",
                     home, away, _iso_at(tue + timedelta(hours=1)))
    tgid_b = await resolve_game(db, hint_b)
    assert tgid_a == tgid_b
    doc = await db["iq_canonical_games"].find_one({"ticker_game_id": tgid_a})
    assert doc["provider_ids"]["nhl_public"]["id"] == 777
    assert doc["provider_ids"]["sportsdata_io"]["id"] == 888


@pytest.mark.asyncio
async def test_pre_same_teams_consecutive_stays_separate(db):
    """T8 — Preseason parity. Two exhibition games between the same
    teams within ±72h with distinct nhl_public IDs must stay separate.
    (T7 = the pre-existing POST test still passes; nothing changes.)"""
    day = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    home = TeamHint("nhl_public", {"tri_code": "BUF"},
                     display_name="Buffalo Sabres", market="Buffalo")
    away = TeamHint("nhl_public", {"tri_code": "OTT"},
                     display_name="Ottawa Senators", market="Ottawa")
    hint_a = GameHint("nhl_public", 12345, "2026-2027", "PRE",
                      home, away, _iso_at(day), declares_new_game=True)
    hint_b = GameHint("nhl_public", 12346, "2026-2027", "PRE",
                      home, away, _iso_at(day + timedelta(hours=30)),
                      declares_new_game=True)
    tgid_a = await resolve_game(db, hint_a)
    tgid_b = await resolve_game(db, hint_b)
    assert tgid_a != tgid_b
    assert await db["iq_canonical_games"].count_documents({}) == 2


@pytest.mark.asyncio
async def test_ambiguity_still_raised_when_multiple_candidates_survive(db):
    """T9 — If, after applying the same-provider exclusion, more than
    one candidate still matches (e.g., two prior canonicals carry no
    same-provider id and both natural-close-match the hint), the
    resolver still raises AmbiguousGameHint."""
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    home = TeamHint("sportradar", {"id": "sr-h9", "alias": "EDM"},
                     display_name="Edmonton", market="Edmonton")
    away = TeamHint("sportradar", {"id": "sr-a9", "alias": "VAN"},
                     display_name="Vancouver", market="Vancouver")
    # Mint two sportradar canonicals for same teams, close in time.
    await resolve_game(db, GameHint(
        "sportradar", "sr-1", "2026", "REG",
        home, away, _iso_at(tue), declares_new_game=True))
    await resolve_game(db, GameHint(
        "sportradar", "sr-2", "2026", "REG",
        home, away, _iso_at(tue + timedelta(hours=24)), declares_new_game=True))
    # Now an nhl_public hint arrives inside 72h. Neither candidate has an
    # nhl_public id, so both survive the same-provider exclusion.
    hint = GameHint(
        "nhl_public", 909090, "2026", "REG",
        TeamHint("nhl_public", {"tri_code": "EDM"},
                 display_name="Edmonton", market="Edmonton"),
        TeamHint("nhl_public", {"tri_code": "VAN"},
                 display_name="Vancouver", market="Vancouver"),
        _iso_at(tue + timedelta(hours=12)),
    )
    with pytest.raises(AmbiguousGameHint):
        await resolve_game(db, hint)


@pytest.mark.asyncio
async def test_far_postponement_without_evidence_raises_unresolved(db):
    tue = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    hint1 = GameHint("sportradar", "sr-orig-2", "2026", "REG",
        TeamHint("sportradar", {"id": "sr-edm-1", "alias": "EDM"},
                 display_name="Edmonton", market="Edmonton"),
        TeamHint("sportradar", {"id": "sr-van-1", "alias": "VAN"},
                 display_name="Vancouver", market="Vancouver"),
        _iso_at(tue), declares_new_game=True)
    await resolve_game(db, hint1)
    # No prior_scheduled_iso, no reused provider id. Refuse to auto-match.
    hint2 = GameHint("sportradar", "sr-different", "2026", "REG",
        hint1.home_hint, hint1.away_hint,
        _iso_at(tue + timedelta(days=10)))
    with pytest.raises(UnresolvedGameIdentity):
        await resolve_game(db, hint2)
    # A reconciliation row was written
    assert await db["iq_reconciliation_queue"].count_documents({}) == 1
    # No new canonical game minted
    assert await db["iq_canonical_games"].count_documents({}) == 1


# ---------------------------------------------------------------------------
# 10n — concurrency-order test
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_concurrent_revision_writers_leave_authoritative_row(db):
    edm, van = await _seed_two_teams(db)
    # Seed one canonical game with revision 1 already written
    tgid = mint_game_id()
    doc = CanonicalGame(
        ticker_game_id=tgid, competition="NHL", season="2026",
        season_type="REG", home_team_id=edm, away_team_id=van,
        current=GameCurrent(scheduled_iso=now_iso(), status="scheduled",
                            schedule_revision=1, as_of=now_iso()),
        provider_ids=ProviderIdsGame(sportradar=ProviderIdSlot(id="sr-race-1")),
        provenance=_prov(),
    )
    await db["iq_canonical_games"].insert_one(doc.model_dump())
    await write_schedule_revision(
        db, ticker_game_id=tgid, scheduled_iso=doc.current.scheduled_iso,
        status="scheduled", venue=None, reason="initial_schedule",
        provider_ids_at_revision=doc.provider_ids, provenance=_prov(),
        _skip_cache_rebuild=True,
    )

    async def one_writer(delta_hours: int):
        new_iso = _iso_at(datetime.now(timezone.utc) + timedelta(hours=delta_hours))
        return await write_schedule_revision(
            db, ticker_game_id=tgid, scheduled_iso=new_iso, status="postponed",
            venue=None, reason=f"postpone_{delta_hours}",
            provider_ids_at_revision=doc.provider_ids, provenance=_prov(),
        )

    results = await asyncio.gather(*[one_writer(i + 24) for i in range(4)])
    # All writers eventually succeeded (retried on DuplicateKeyError)
    assert len(set(results)) == 4
    revs = [r async for r in db["iq_game_schedule_revisions"].find(
        {"ticker_game_id": tgid}).sort("revision_number", 1)]
    # 1 initial + 4 postponements
    assert [r["revision_number"] for r in revs] == [1, 2, 3, 4, 5]
    # Cache advances only after revisions exist — assert current points at
    # the highest revision that exists in the immutable log.
    game = await db["iq_canonical_games"].find_one({"ticker_game_id": tgid})
    assert game["current"]["schedule_revision"] == max(r["revision_number"] for r in revs)


# ---------------------------------------------------------------------------
# 10a/b — snapshot windows & no-backfill
# ---------------------------------------------------------------------------
async def _mint_test_game(db, tue: datetime) -> str:
    hint = GameHint("sportradar", "sr-snap", "2026", "REG",
        TeamHint("sportradar", {"id": "sr-edm-1", "alias": "EDM"},
                 display_name="Edmonton", market="Edmonton"),
        TeamHint("sportradar", {"id": "sr-van-1", "alias": "VAN"},
                 display_name="Vancouver", market="Vancouver"),
        _iso_at(tue), declares_new_game=True)
    return await resolve_game(db, hint,
                              on_first_sight=lambda tgid: emit_schedule_release_first_sight(db, tgid))


@pytest.mark.asyncio
async def test_schedule_release_at_first_sight(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    snaps = [s async for s in db["iq_game_context_snapshots"].find(
        {"ticker_game_id": tgid})]
    assert len(snaps) == 1
    assert snaps[0]["snapshot_kind"] == "schedule_release"
    assert snaps[0]["snapshot_version"] == 1


@pytest.mark.asyncio
async def test_game_discovered_more_than_8_days_ahead_still_gets_schedule_release(db):
    far = datetime.now(timezone.utc) + timedelta(days=30)
    tgid = await _mint_test_game(db, far)
    # Worker's 8-day horizon would exclude it — but schedule_release is
    # first-sight, so it should exist.
    assert await db["iq_game_context_snapshots"].count_documents(
        {"ticker_game_id": tgid, "snapshot_kind": "schedule_release"}) == 1


@pytest.mark.asyncio
async def test_t_minus_24h_created_inside_window(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    # Clock exactly at T-24h
    now = tue - timedelta(hours=24)
    stats = await worker_tick(db, now_dt=now)
    assert stats["t_minus_24h"] >= 1
    assert await db["iq_game_context_snapshots"].count_documents(
        {"ticker_game_id": tgid, "snapshot_kind": "t_minus_24h"}) == 1


@pytest.mark.asyncio
async def test_missed_t_minus_24h_window_does_not_backfill(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    # Simulate worker being down for the T-24h window — first tick at T-23h
    late = tue - timedelta(hours=23)
    stats = await worker_tick(db, now_dt=late)
    assert stats["missed_t_minus_24h"] >= 1
    assert await db["iq_game_context_snapshots"].count_documents(
        {"ticker_game_id": tgid, "snapshot_kind": "t_minus_24h"}) == 0
    # Later ticks still don't create a t_minus_24h snapshot
    much_later = tue - timedelta(hours=2)
    await worker_tick(db, now_dt=much_later)
    assert await db["iq_game_context_snapshots"].count_documents(
        {"ticker_game_id": tgid, "snapshot_kind": "t_minus_24h"}) == 0


@pytest.mark.asyncio
async def test_t_minus_60_created_normally(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    now = tue - timedelta(minutes=60)
    await worker_tick(db, now_dt=now)
    assert await db["iq_game_context_snapshots"].count_documents(
        {"ticker_game_id": tgid, "snapshot_kind": "t_minus_60"}) == 1


@pytest.mark.asyncio
async def test_no_historical_pregame_snapshots_manufactured(db):
    """A game whose scheduled_iso is 14 days in the past: worker writes
    no snapshots at all."""
    past = datetime.now(timezone.utc) - timedelta(days=14)
    tgid = await _mint_test_game(db, past)
    # Only the first-sight schedule_release exists
    stats = await worker_tick(db)
    assert stats["t_minus_24h"] == 0 and stats["t_minus_60"] == 0
    snaps = [s async for s in db["iq_game_context_snapshots"].find(
        {"ticker_game_id": tgid})]
    kinds = [s["snapshot_kind"] for s in snaps]
    assert "t_minus_24h" not in kinds and "t_minus_60" not in kinds


# ---------------------------------------------------------------------------
# 10b/o — lock-time attachment
# ---------------------------------------------------------------------------
async def _seed_locked_call(db, tgid: str, locked_at: str) -> str:
    """Insert a minimal iq_calls row shaped like the existing schema."""
    call_id = f"call-{uuid.uuid4().hex[:10]}"
    user_id = f"user-{uuid.uuid4().hex[:10]}"
    await db["iq_calls"].insert_one({
        "id": call_id, "user_id": user_id, "kind": "game_pick",
        "subject": {"ticker_game_id": tgid},
        "stance": {"pick": "H"}, "first_instinct": None,
        "state": "locked", "visibility": "private",
        "created_at": now_iso(), "locked_at": locked_at,
        "resolved_at": None, "context_snapshot": None,
        "context_snapshot_ref": None, "context_snapshot_state": None,
    })
    return call_id


@pytest.mark.asyncio
async def test_call_at_T_minus_70_attaches_t_minus_24h_not_future_t_minus_60(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    # Emit T-24 snapshot at its window
    await worker_tick(db, now_dt=tue - timedelta(hours=24))
    # Call locked at T-70min (before T-60 window)
    call_id = await _seed_locked_call(db, tgid, _iso_at(tue - timedelta(minutes=70)))
    r = await attach(db, call_id)
    assert r == "attached"
    call = await db["iq_calls"].find_one({"id": call_id})
    assert call["context_snapshot_state"] == "attached"
    snap = await db["iq_game_context_snapshots"].find_one(
        {"id": call["context_snapshot_ref"]})
    assert snap["snapshot_kind"] == "t_minus_24h"


@pytest.mark.asyncio
async def test_call_after_t_minus_60_attaches_t_minus_60(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    await worker_tick(db, now_dt=tue - timedelta(hours=24))
    await worker_tick(db, now_dt=tue - timedelta(minutes=60))
    call_id = await _seed_locked_call(db, tgid, _iso_at(tue - timedelta(minutes=30)))
    await attach(db, call_id)
    call = await db["iq_calls"].find_one({"id": call_id})
    snap = await db["iq_game_context_snapshots"].find_one(
        {"id": call["context_snapshot_ref"]})
    assert snap["snapshot_kind"] == "t_minus_60"


@pytest.mark.asyncio
async def test_call_before_any_snapshot_terminates_no_snapshot_before_lock(db):
    """First-sight schedule_release is at server_now(). A call locked at
    an ISO time earlier than server_now() (simulate: before the game was
    even known to Ticker) terminates as no_snapshot_before_lock."""
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    # Call locked 5 minutes BEFORE the schedule_release snapshot's locked_at
    snap = await db["iq_game_context_snapshots"].find_one(
        {"ticker_game_id": tgid})
    from datetime import datetime as _dt
    sr_locked = _dt.fromisoformat(snap["locked_at"].replace("Z", "+00:00"))
    earlier_iso = _iso_at(sr_locked - timedelta(minutes=5))
    call_id = await _seed_locked_call(db, tgid, earlier_iso)
    r = await attach(db, call_id)
    assert r == "no_snapshot_before_lock"
    call = await db["iq_calls"].find_one({"id": call_id})
    assert call["context_snapshot_ref"] is None
    assert call["context_snapshot_state"] == "no_snapshot_before_lock"


@pytest.mark.asyncio
async def test_reattach_never_overwrites_existing_ref(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    await worker_tick(db, now_dt=tue - timedelta(hours=24))
    call_id = await _seed_locked_call(db, tgid, _iso_at(tue - timedelta(minutes=90)))
    r1 = await attach(db, call_id)
    r2 = await attach(db, call_id)
    assert r1 == "attached"
    assert r2 == "already_terminal"


@pytest.mark.asyncio
async def test_transient_failure_leaves_pending_and_retry_succeeds(db):
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    await worker_tick(db, now_dt=tue - timedelta(hours=24))
    call_id = await _seed_locked_call(db, tgid, _iso_at(tue - timedelta(minutes=90)))

    # Motor collections are re-instantiated per access, so we use a proxy
    # DB that returns a flaky iq_calls collection on the first call.
    class FlakyColl:
        def __init__(self, real, hits):
            self._real, self._hits = real, hits
        def __getattr__(self, name):
            return getattr(self._real, name)
        async def update_one(self, *a, **kw):
            self._hits["n"] += 1
            if self._hits["n"] == 1:
                raise RuntimeError("db hiccup")
            return await self._real.update_one(*a, **kw)

    class ProxyDB:
        def __init__(self, real):
            self._real = real
            self._hits = {"n": 0}
        def __getitem__(self, name):
            if name == "iq_calls":
                return FlakyColl(self._real["iq_calls"], self._hits)
            return self._real[name]

    proxy = ProxyDB(db)
    r1 = await attach(proxy, call_id)
    assert r1 == "transient_failure"
    doc = await db["iq_calls"].find_one({"id": call_id})
    assert doc["context_snapshot_state"] is None

    # Reconciler retries with a fresh (non-flaky) DB — succeeds.
    stats = await reconcile_pending(db)
    assert stats["attached"] == 1
    doc = await db["iq_calls"].find_one({"id": call_id})
    assert doc["context_snapshot_state"] == "attached"


@pytest.mark.asyncio
async def test_retry_never_attaches_snapshot_written_after_call_lock(db):
    """Historical honesty: a snapshot with locked_at AFTER call.locked_at
    must never be attached, even on retry."""
    tue = datetime.now(timezone.utc) + timedelta(days=3)
    tgid = await _mint_test_game(db, tue)
    # Call locked BEFORE any snapshot exists (schedule_release counted).
    from datetime import datetime as _dt
    sr = await db["iq_game_context_snapshots"].find_one({"ticker_game_id": tgid})
    sr_locked = _dt.fromisoformat(sr["locked_at"].replace("Z", "+00:00"))
    early_iso = _iso_at(sr_locked - timedelta(minutes=5))
    call_id = await _seed_locked_call(db, tgid, early_iso)
    await attach(db, call_id)   # terminates no_snapshot_before_lock

    # A T-24 snapshot arrives later
    await worker_tick(db, now_dt=tue - timedelta(hours=24))
    # Reconciler must NOT touch the terminal call
    stats = await reconcile_pending(db)
    assert stats["attached"] == 0
    call = await db["iq_calls"].find_one({"id": call_id})
    assert call["context_snapshot_ref"] is None
    assert call["context_snapshot_state"] == "no_snapshot_before_lock"


# ---------------------------------------------------------------------------
# 10o — model round-trip
# ---------------------------------------------------------------------------
def test_context_snapshot_ref_state_round_trip():
    """Just Pydantic — verify the UserCall shape survives round-trip.
    We inspect the shape via a lightweight schema check because UserCall
    lives in iq_core.py."""
    from iq_core import UserCall
    uc = UserCall(user_id="u", kind="game_pick",
                  context_snapshot_ref="snap-1",
                  context_snapshot_state="attached")
    r = UserCall(**uc.model_dump())
    assert r.context_snapshot_ref == "snap-1"
    assert r.context_snapshot_state == "attached"

    uc2 = UserCall(user_id="u", kind="game_pick",
                   context_snapshot_ref=None,
                   context_snapshot_state="no_snapshot_before_lock")
    r2 = UserCall(**uc2.model_dump())
    assert r2.context_snapshot_ref is None
    assert r2.context_snapshot_state == "no_snapshot_before_lock"


# ---------------------------------------------------------------------------
# 10e — cache-inconsistent + QA endpoint behavior (unit level)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_cache_rebuild_failure_leaves_revision_intact(db):
    edm, van = await _seed_two_teams(db)
    tgid = mint_game_id()
    doc = CanonicalGame(
        ticker_game_id=tgid, competition="NHL", season="2026",
        season_type="REG", home_team_id=edm, away_team_id=van,
        current=GameCurrent(scheduled_iso=now_iso(), status="scheduled",
                            schedule_revision=1, as_of=now_iso()),
        provider_ids=ProviderIdsGame(sportradar=ProviderIdSlot(id="sr-cache-1")),
        provenance=_prov(),
    )
    await db["iq_canonical_games"].insert_one(doc.model_dump())
    await write_schedule_revision(
        db, ticker_game_id=tgid, scheduled_iso=doc.current.scheduled_iso,
        status="scheduled", venue=None, reason="initial_schedule",
        provider_ids_at_revision=doc.provider_ids, provenance=_prov(),
        _skip_cache_rebuild=True,
    )

    class FailingGames:
        def __init__(self, real):
            self._real = real
        def __getattr__(self, name):
            return getattr(self._real, name)
        async def update_one(self, *a, **kw):
            raise RuntimeError("cache write down")

    class ProxyDB:
        def __init__(self, real):
            self._real = real
        def __getitem__(self, name):
            if name == "iq_canonical_games":
                return FailingGames(self._real["iq_canonical_games"])
            return self._real[name]

    new_n = await write_schedule_revision(
        ProxyDB(db), ticker_game_id=tgid,
        scheduled_iso=_iso_at(datetime.now(timezone.utc) + timedelta(days=7)),
        status="postponed", venue=None, reason="postponed_weather",
        provider_ids_at_revision=doc.provider_ids, provenance=_prov(),
    )
    assert new_n == 2
    rev = await db["iq_game_schedule_revisions"].find_one(
        {"ticker_game_id": tgid, "revision_number": 2})
    assert rev is not None
    # Cache is stale — still revision 1 (writer used a broken update path)
    game = await db["iq_canonical_games"].find_one({"ticker_game_id": tgid})
    assert game["current"]["schedule_revision"] == 1
