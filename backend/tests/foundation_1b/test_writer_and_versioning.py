"""Writer + versioning tests.

Covers:
  - v1 insertion + coverage row seeded as 'partial'
  - Correction v2 with materially different payload
  - Correction #1: an identical-payload re-declaration does NOT create v3
"""
import copy
import pytest

from intelligence.game_finals_writer import write_game_final
from intelligence.ingest_1b import parse_boxscore_to_final_payload
from tests.foundation_1b.conftest import load_fixture


async def _v1(db, team_map, correction_reason="initial"):
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")   # EDM home
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=f"tg_{'0' * 26}",
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    return await write_game_final(db, correction_reason=correction_reason, **payload)


@pytest.mark.asyncio
async def test_v1_insert_and_coverage_seeded_partial(db, team_map):
    r = await _v1(db, team_map)
    assert r["write_action"] == "inserted_v1"
    assert r["record_version"] == 1
    assert r["correction_reason"] == "initial"
    # Coverage rows created and MUST be 'partial'
    for tid in (team_map["EDM"], team_map["FLA"]):
        cov = await db["iq_team_season_coverage"].find_one({"ticker_team_id": tid})
        assert cov is not None, f"coverage row missing for {tid}"
        assert cov["coverage_state"] == "partial"
        assert cov["games_recorded"] == 1
        assert cov["expected_games"] is None


@pytest.mark.asyncio
async def test_material_correction_creates_v2_and_no_double_coverage(db, team_map):
    r1 = await _v1(db, team_map)
    assert r1["write_action"] == "inserted_v1"

    # Apply a material correction: one goalie's saves changes.
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    bx = copy.deepcopy(bx)
    starters = [g for g in bx["playerByGameStats"]["homeTeam"]["goalies"] if g.get("starter")]
    assert starters, "test setup: expected a home starter goalie"
    starters[0]["saves"] += 1                # bumped
    starters[0]["shotsAgainst"] += 1
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=r1["ticker_game_id"],
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r2 = await write_game_final(db, correction_reason="goalie_line_correction", **payload)
    assert r2["write_action"] == "inserted_new_version"
    assert r2["record_version"] == 2
    assert r2["supersedes_record_version"] == 1
    assert r2["correction_reason"] == "goalie_line_correction"

    # Coverage MUST NOT double-count on a correction.
    for tid in (team_map["EDM"], team_map["FLA"]):
        cov = await db["iq_team_season_coverage"].find_one({"ticker_team_id": tid})
        assert cov["games_recorded"] == 1, "corrections must not bump coverage"


@pytest.mark.asyncio
async def test_correction_1_identical_payload_is_noop(db, team_map):
    """The centerpiece of build correction #1."""
    r1 = await _v1(db, team_map)
    # Second writer proposes the SAME truth as v1 (identical payload)
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=r1["ticker_game_id"],
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r2 = await write_game_final(db, correction_reason="provider_late_data", **payload)
    assert r2["write_action"] == "noop_identical"
    assert r2["record_version"] == 1
    # No v2 was created
    count = await db["iq_game_finals"].count_documents({"ticker_game_id": r1["ticker_game_id"]})
    assert count == 1

    # And a third writer, still identical → still no v3.
    r3 = await write_game_final(db, correction_reason="official_stat_correction", **payload)
    assert r3["write_action"] == "noop_identical"
    count = await db["iq_game_finals"].count_documents({"ticker_game_id": r1["ticker_game_id"]})
    assert count == 1


@pytest.mark.asyncio
async def test_correction_after_noop_creates_v2_only_when_material(db, team_map):
    """After a no-op, an actually-different correction still results in v2 (not v3)."""
    r1 = await _v1(db, team_map)
    # identical no-op first
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    payload_same = parse_boxscore_to_final_payload(
        bx, ticker_game_id=r1["ticker_game_id"],
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    await write_game_final(db, correction_reason="provider_late_data", **payload_same)

    # now a materially-different correction
    bx2 = copy.deepcopy(bx)
    bx2["awayTeam"]["sog"] += 5
    payload_diff = parse_boxscore_to_final_payload(
        bx2, ticker_game_id=r1["ticker_game_id"],
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r_diff = await write_game_final(db, correction_reason="sog_correction", **payload_diff)
    assert r_diff["record_version"] == 2, "expected v2 after no-op, not v3"
    assert r_diff["write_action"] == "inserted_new_version"
