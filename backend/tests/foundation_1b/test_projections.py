"""Projection tests — team perspectives and single source of truth for goals.

Covers build correction #3: TeamGameFacts has no `goals` field, and team
GF/GA in the projection are derived from final_score.
"""
import pytest

from intelligence.game_finals_writer import write_game_final
from intelligence.ingest_1b import parse_boxscore_to_final_payload
from intelligence.models_1b import TeamGameFacts
from intelligence.recent_history_views import (
    project_from_both_sides, game_final_as_of,
)
from tests.foundation_1b.conftest import load_fixture


async def _seed_stanley_cup_final(db, team_map):
    """FLA @ EDM, EDM home won 4-3 in OT."""
    bx = load_fixture("boxscore_2024030411_FLA_at_EDM.json")
    tgid = "tg_" + "P" * 26   # not a real ULID; validator accepts any tg_ with 26 chars
    # models expect crockford — build one from a fixed string
    tgid = "tg_01H0000000000000000000000A"
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=tgid,
        home_team_id=team_map["EDM"], away_team_id=team_map["FLA"],
    )
    r = await write_game_final(db, correction_reason="initial", **payload)
    return r


@pytest.mark.asyncio
async def test_team_facts_model_forbids_goals_field(team_map):
    """The model itself must reject a 'goals' field on TeamGameFacts."""
    with pytest.raises(Exception):
        TeamGameFacts(
            ticker_team_id=team_map["EDM"], is_home=True,
            shots_on_goal=30, goals=4,  # type: ignore[call-arg]
        )


@pytest.mark.asyncio
async def test_projection_gf_ga_derived_from_final_score(db, team_map):
    doc = await _seed_stanley_cup_final(db, team_map)
    perspectives = project_from_both_sides(doc)
    home = perspectives["home"]
    away = perspectives["away"]
    # Home was EDM winning 4-3 in OT
    assert home["team_id"] == team_map["EDM"]
    assert home["is_home"] is True
    assert home["goals_for"] == 4
    assert home["goals_against"] == 3
    assert home["result"] == "W"
    assert home["outcome"] == "OT"

    assert away["team_id"] == team_map["FLA"]
    assert away["is_home"] is False
    assert away["goals_for"] == 3
    assert away["goals_against"] == 4
    assert away["result"] == "OTL", "regulation was tied → non-winner is OTL, not L"
    assert away["outcome"] == "OT"

    # Symmetry: sum of both perspectives' GF equals total goals scored
    assert home["goals_for"] + away["goals_for"] == \
        doc["final_score"]["home_goals"] + doc["final_score"]["away_goals"]


@pytest.mark.asyncio
async def test_shootout_and_regulation_results_project_correctly(db, team_map):
    # Shootout: home EDM lost 2-3 to away DET
    bx = load_fixture("boxscore_2024020819_shootout.json")
    tgid = "tg_01H0000000000000000000000B"
    payload = parse_boxscore_to_final_payload(
        bx, ticker_game_id=tgid,
        home_team_id=team_map["EDM"], away_team_id=team_map["DET"],
    )
    r = await write_game_final(db, correction_reason="initial", **payload)
    persp = project_from_both_sides(r)
    assert persp["home"]["outcome"] == "SO"
    assert persp["home"]["result"] == "SOL"
    assert persp["away"]["result"] == "W"

    # Regulation loss: home FLA 1-4 away vs (fixture home was BUF, away was NJD)
    reg = load_fixture("boxscore_2024020001_regular.json")
    # Use the fixture's actual teams
    home_tri = reg["homeTeam"]["abbrev"]
    away_tri = reg["awayTeam"]["abbrev"]
    from tests.foundation_1b.conftest import _resolve_tri
    home_tid = await _resolve_tri(db, home_tri)
    away_tid = await _resolve_tri(db, away_tri)
    tgid2 = "tg_01H0000000000000000000000C"
    payload2 = parse_boxscore_to_final_payload(
        reg, ticker_game_id=tgid2, home_team_id=home_tid, away_team_id=away_tid,
    )
    r2 = await write_game_final(db, correction_reason="initial", **payload2)
    persp2 = project_from_both_sides(r2)
    # Regulation → non-winner is 'L', not 'OTL'
    if r2["final_score"]["home_goals"] > r2["final_score"]["away_goals"]:
        assert persp2["home"]["result"] == "W"
        assert persp2["away"]["result"] == "L"
    else:
        assert persp2["away"]["result"] == "W"
        assert persp2["home"]["result"] == "L"
    assert persp2["home"]["outcome"] == "REG"


@pytest.mark.asyncio
async def test_game_final_as_of_returns_raw_doc(db, team_map):
    doc = await _seed_stanley_cup_final(db, team_map)
    fetched = await game_final_as_of(db, ticker_game_id=doc["ticker_game_id"])
    assert fetched is not None
    assert fetched["record_version"] == 1
    assert fetched["ticker_game_id"] == doc["ticker_game_id"]
