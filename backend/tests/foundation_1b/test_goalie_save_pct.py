"""Goalie save-percentage derivation tests (build correction #4).

save_pct = saves / shots_against when both counts present and shots_against > 0.
Otherwise null. Provider's savePct field is not consulted.
"""
import copy
import pytest

from intelligence.game_finals_writer import write_game_final
from intelligence.ingest_1b import parse_boxscore_to_final_payload
from intelligence.recent_history_views import (
    derive_save_pct, project_from_both_sides,
)
from tests.foundation_1b.conftest import load_fixture


def test_derive_save_pct_from_counts():
    assert derive_save_pct(29, 32) == pytest.approx(29 / 32)
    assert derive_save_pct(0, 5) == 0.0                 # shutout-for-them scenario
    assert derive_save_pct(25, 25) == 1.0                # perfect game
    # Missing counts → null
    assert derive_save_pct(None, 32) is None
    assert derive_save_pct(29, None) is None
    # shots_against == 0 → null (division by zero would be dishonest)
    assert derive_save_pct(0, 0) is None
    # Negative-shots guard (shouldn't happen; models block, but keep honest)
    assert derive_save_pct(5, -1) is None


@pytest.mark.asyncio
async def test_projection_derives_starter_goalie_save_pct(db, team_map):
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    tgid = "tg_01H0000000000000000000000D"
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=tgid,
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r = await write_game_final(db, correction_reason="initial", **payload)
    persp = project_from_both_sides(r)
    home_starter = [g for g in persp["home"]["goalies"] if g["starter"]]
    assert home_starter, "starter goalie missing on home side"
    g = home_starter[0]
    # counts came from the real API: Skinner faced 32, saved 29
    assert g["shots_against"] == 32
    assert g["saves"] == 29
    assert g["save_pct"] == pytest.approx(29 / 32)


@pytest.mark.asyncio
async def test_projection_returns_null_save_pct_when_shots_against_is_zero(db, team_map):
    """The 'C. Pickard didn't play' case — 0 shots faced → null save_pct."""
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    tgid = "tg_01H0000000000000000000000E"
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=tgid,
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r = await write_game_final(db, correction_reason="initial", **payload)
    persp = project_from_both_sides(r)
    non_starters = [g for g in persp["home"]["goalies"]
                    if g["shots_against"] == 0]
    assert non_starters, "expected the backup with 0 shots faced"
    for g in non_starters:
        assert g["save_pct"] is None


@pytest.mark.asyncio
async def test_projection_derives_pct_even_when_provider_omits_savePct(db, team_map):
    """The core of correction #4 — the provider does NOT send savePct on
    this endpoint, yet we still project a derived percentage when counts
    are present. If the underlying counts exist, we compute."""
    bx = copy.deepcopy(load_fixture("boxscore_2024030411_FLA_at_EDM.json"))
    # Ensure absent (NHL Public boxscore already omits it — this asserts the invariant)
    for g in bx["playerByGameStats"]["homeTeam"]["goalies"] + bx["playerByGameStats"]["awayTeam"]["goalies"]:
        g.pop("savePctg", None)
        g.pop("savePct", None)
    tgid = "tg_01H0000000000000000000000F"
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=tgid,
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r = await write_game_final(db, correction_reason="initial", **payload)
    persp = project_from_both_sides(r)
    playing_goalies = [g for g in persp["home"]["goalies"] + persp["away"]["goalies"]
                       if (g["shots_against"] or 0) > 0]
    assert playing_goalies, "expected at least one playing goalie"
    for g in playing_goalies:
        assert g["save_pct"] is not None, \
            f"save_pct must be derived from counts; got null for {g['display_name']}"
        assert g["save_pct"] == pytest.approx(g["saves"] / g["shots_against"])
