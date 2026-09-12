"""Recent-history + temporal `as_of` tests.

Covers:
  - Last-N chronological ordering (played_at_iso DESC)
  - as_of returns the record_version that Ticker had at that moment
  - as_of predating a correction returns v1 truth, not v2
  - Session baseline stays 'partial' after Last-N seed (never 'complete')
"""
import copy
from datetime import datetime, timedelta, timezone

import pytest

from intelligence.game_finals_writer import write_game_final
from intelligence.ingest_1b import parse_boxscore_to_final_payload
from intelligence.recent_history_views import (
    history_for_team_as_of, present_history_for_team,
    season_baseline_for_team,
)
from intelligence.models_1a import now_iso
from tests.foundation_1b.conftest import load_fixture


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


async def _seed_three_edm_games(db, team_map):
    """EDM had three games recorded, played earliest → latest.
    Adjust played_at_iso and recorded_at manually so temporal ordering
    is deterministic."""
    fixtures = [
        ("boxscore_2024020056_overtime.json", "PHI", 0),   # oldest
        ("boxscore_2024020819_shootout.json", "DET", 1),
        ("boxscore_2024030411_FLA_at_EDM.json", "FLA", 2),  # newest
    ]
    base = datetime(2026, 3, 1, tzinfo=timezone.utc)
    results = []
    for idx, (fname, opp_tri, offset) in enumerate(fixtures):
        bx = copy.deepcopy(load_fixture(fname))
        # Anchor played_at_iso deterministically
        played = base + timedelta(days=offset)
        bx["startTimeUTC"] = _iso(played)
        # All three fixtures have EDM as home; make sure we resolve opp correctly
        # by forcing the away tri to match the fixture's actual away side.
        away_tri_in_fx = bx["awayTeam"]["abbrev"]
        # Resolve away team
        from tests.foundation_1b.conftest import _resolve_tri
        opp_tid = await _resolve_tri(db, away_tri_in_fx)
        tgid = f"tg_01H000000000000000000000{idx:02d}"
        payload = parse_boxscore_to_final_payload(
            bx, ticker_game_id=tgid,
            home_team_id=team_map["EDM"], away_team_id=opp_tid,
        )
        r = await write_game_final(db, correction_reason="initial", **payload)
        # Force recorded_at to a deterministic value — recorded shortly after played
        recorded = played + timedelta(hours=6)
        await db["iq_game_finals"].update_one(
            {"id": r["id"]}, {"$set": {"recorded_at": _iso(recorded)}}
        )
        results.append({"tgid": tgid, "played": _iso(played), "recorded": _iso(recorded)})
    return results


@pytest.mark.asyncio
async def test_last_3_returns_newest_first(db, team_map):
    await _seed_three_edm_games(db, team_map)
    view = await present_history_for_team(db, ticker_team_id=team_map["EDM"], n=3)
    assert len(view) == 3
    # Ordered newest → oldest
    played = [v["played_at_iso"] for v in view]
    assert played == sorted(played, reverse=True)


@pytest.mark.asyncio
async def test_last_5_returns_all_available_when_fewer_exist(db, team_map):
    await _seed_three_edm_games(db, team_map)
    view = await present_history_for_team(db, ticker_team_id=team_map["EDM"], n=5)
    assert len(view) == 3   # only three exist


@pytest.mark.asyncio
async def test_as_of_before_any_recording_returns_empty(db, team_map):
    seeded = await _seed_three_edm_games(db, team_map)
    earliest_recorded = seeded[0]["recorded"]
    as_of = _iso(datetime.fromisoformat(earliest_recorded.replace("Z", "+00:00"))
                 - timedelta(minutes=1))
    view = await history_for_team_as_of(
        db, ticker_team_id=team_map["EDM"], as_of_iso=as_of, n=5,
    )
    assert view == []


@pytest.mark.asyncio
async def test_as_of_returns_v1_when_correction_landed_later(db, team_map):
    """Historical `as_of` proof (build evidence requirement)."""
    seeded = await _seed_three_edm_games(db, team_map)
    newest = seeded[-1]

    # Apply a material correction to the newest game LATER (recorded_at moves forward)
    bx = copy.deepcopy(load_fixture("boxscore_2024030411_FLA_at_EDM.json"))
    starters = [g for g in bx["playerByGameStats"]["homeTeam"]["goalies"] if g.get("starter")]
    starters[0]["saves"] += 3
    starters[0]["shotsAgainst"] += 3
    bx["startTimeUTC"] = newest["played"]
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=newest["tgid"],
        home_team_id=team_map["EDM"],
        away_team_id=(await db["iq_canonical_teams"].find_one(
            {"provider_ids.nhl_public.tri_code": "FLA"}))["ticker_team_id"],
    )
    r2 = await write_game_final(
        db, correction_reason="goalie_line_correction", **payload,
    )
    assert r2["record_version"] == 2
    # Force the correction to land AFTER newest["recorded"]
    correction_recorded_at = _iso(
        datetime.fromisoformat(newest["recorded"].replace("Z", "+00:00"))
        + timedelta(hours=12))
    await db["iq_game_finals"].update_one(
        {"id": r2["id"]}, {"$set": {"recorded_at": correction_recorded_at}}
    )

    # as_of = 1 minute BEFORE the correction → must see v1 numbers
    just_before = _iso(datetime.fromisoformat(correction_recorded_at.replace("Z", "+00:00"))
                       - timedelta(minutes=1))
    view = await history_for_team_as_of(
        db, ticker_team_id=team_map["EDM"], as_of_iso=just_before, n=1,
    )
    assert len(view) == 1
    assert view[0]["record_version"] == 1

    # as_of = 1 minute AFTER the correction → v2
    just_after = _iso(datetime.fromisoformat(correction_recorded_at.replace("Z", "+00:00"))
                      + timedelta(minutes=1))
    view2 = await history_for_team_as_of(
        db, ticker_team_id=team_map["EDM"], as_of_iso=just_after, n=1,
    )
    assert len(view2) == 1
    assert view2[0]["record_version"] == 2


@pytest.mark.asyncio
async def test_season_baseline_stays_partial(db, team_map):
    """Correction #2 — after a minimum-history seed, coverage_state must
    remain 'partial'. The writer never promotes to 'complete' on its own."""
    await _seed_three_edm_games(db, team_map)
    baseline = await season_baseline_for_team(
        db, ticker_team_id=team_map["EDM"],
        season="2024-2025", season_type="REG",
    )
    # baseline_state carries the coverage row's state
    assert baseline["coverage_state"] == "partial"
    assert baseline["expected_games"] is None


@pytest.mark.asyncio
async def test_correction_2_promote_requires_positive_evidence(db, team_map):
    """promote_coverage_to_complete refuses when games_recorded != expected_games."""
    from intelligence.game_finals_writer import promote_coverage_to_complete

    await _seed_three_edm_games(db, team_map)
    # EDM's seeded games split 2 REG + 1 POST across the 2024-2025 season.
    # No: expected_games=10 while games_recorded=2 for REG
    promoted = await promote_coverage_to_complete(
        db, ticker_team_id=team_map["EDM"],
        season="2024-2025", season_type="REG",
        expected_games=10, evidence_note="wrong count",
    )
    assert promoted is False
    cov = await db["iq_team_season_coverage"].find_one(
        {"ticker_team_id": team_map["EDM"], "season_type": "REG"})
    assert cov["coverage_state"] == "partial"

    # Yes: expected_games=2, matches recorded REG count
    promoted = await promote_coverage_to_complete(
        db, ticker_team_id=team_map["EDM"],
        season="2024-2025", season_type="REG",
        expected_games=2, evidence_note="verified game universe of 2 REG",
    )
    assert promoted is True
    cov = await db["iq_team_season_coverage"].find_one(
        {"ticker_team_id": team_map["EDM"], "season_type": "REG"})
    assert cov["coverage_state"] == "complete"
    assert cov["expected_games"] == 2
    assert cov["coverage_evidence_note"] == "verified game universe of 2 REG"


@pytest.mark.asyncio
async def test_present_history_matches_as_of_now(db, team_map):
    """Present-tense and as_of=now should agree."""
    await _seed_three_edm_games(db, team_map)
    present = await present_history_for_team(db, ticker_team_id=team_map["EDM"], n=5)
    future = _iso(datetime.now(timezone.utc) + timedelta(days=365))
    as_of_now = await history_for_team_as_of(
        db, ticker_team_id=team_map["EDM"], as_of_iso=future, n=5,
    )
    assert [g["ticker_game_id"] for g in present] == [g["ticker_game_id"] for g in as_of_now]
