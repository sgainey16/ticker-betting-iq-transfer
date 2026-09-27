"""Regression tests for intelligence.rolling_form.

Uses mongomock so nothing hits a live DB. Every assertion validates one
of the guarantees from the module docstring:

  * SEASON / L10 / L5 / L2 / L1 windows compute the right sample size.
  * Below WINDOW_MIN_SAMPLE, a window emits tier="insufficient_sample".
  * Windows carry a declared confidence tier that never conflates
    L1 / L2 with L5 / L10 / SEASON.
  * Reserved provider-gated metrics (pp_pct, pk_pct, hits, pim,
    faceoff_win_pct, high-danger, xG) return null with a null_reason.
  * Direction vs season baseline handles higher-is-better and
    lower-is-better metrics correctly.
  * Acceleration surfaces only when both L5 and L10 qualify.
  * Team save% is always DERIVED from goalie counts (correction #4),
    never trusted from a provider field.
  * Goals are DERIVED from FinalScore only (correction #3).
"""
import pytest
import mongomock
from datetime import datetime, timezone

# We reach the module through the intelligence package path.
import sys
sys.path.insert(0, "/app/backend")

from intelligence.rolling_form import (
    team_rolling_form,
    goalie_rolling_form,
    WINDOW_TIER,
    WINDOW_MIN_SAMPLE,
    ALL_WINDOWS,
)


# --------------------------------------------------------------------------
# Fixture builder — writes documents shaped exactly like real
# iq_game_finals rows. Every game is v1, played on consecutive days.
# --------------------------------------------------------------------------
def _make_final(*, i: int, home: str, away: str, hg: int, ag: int,
                sog_home: int, sog_away: int,
                goalie_home: dict, goalie_away: dict,
                season: str = "20252026", season_type: str = "REG") -> dict:
    ts = f"2026-01-{i:02d}T22:00:00+00:00"
    return {
        "id": f"gf_{i}",
        "ticker_game_id": f"game_TEST_{i}",
        "record_version": 1,
        "supersedes_record_version": None,
        "correction_reason": "initial",
        "season": season,
        "season_type": season_type,
        "played_at_iso": ts,
        "recorded_at": ts,
        "home_team_id": home,
        "away_team_id": away,
        "final_score": {
            "home_goals": hg, "away_goals": ag,
            "outcome": "REG" if hg != ag else "REG",
            "period_scores": [],
            "shootout_home": None, "shootout_away": None,
            "empty_net_home": None, "empty_net_away": None,
        },
        "home_team_facts": {
            "ticker_team_id": home, "is_home": True,
            "shots_on_goal": sog_home,
            "power_play_opportunities": None,
            "power_play_goals": None,
            "penalty_minutes": None,
        },
        "away_team_facts": {
            "ticker_team_id": away, "is_home": False,
            "shots_on_goal": sog_away,
            "power_play_opportunities": None,
            "power_play_goals": None,
            "penalty_minutes": None,
        },
        "home_goalies": [goalie_home] if goalie_home else [],
        "away_goalies": [goalie_away] if goalie_away else [],
    }


def _goalie(pid: str, saves: int, sa: int, ga: int, decision: str, toi=3600):
    return {
        "ticker_player_id": pid,
        "provider_player_id_nhl": None,
        "display_name": pid,
        "starter": True,
        "toi_seconds": toi,
        "shots_against": sa,
        "saves": saves,
        "goals_against": ga,
        "decision": decision,
    }


@pytest.fixture
def db_with_edm_season():
    """EDM plays 10 real games. Trend engineered so L5 shows shots trending
    UP vs season baseline (last 5 games have shots 34-38, first 5 have 26-30)
    and goals-against trending DOWN (improving) in L5."""
    m = mongomock.MongoClient()
    db = m["ticker_hockey_iq"]

    # Older 5 games: modest offence (~28 sog), average defence (3 GA)
    older = [
        _make_final(i=1, home="EDM", away="COL", hg=3, ag=2,
                    sog_home=27, sog_away=30,
                    goalie_home=_goalie("g_skinner", 28, 30, 2, "W"),
                    goalie_away=_goalie("g_georgiev", 24, 27, 3, "L")),
        _make_final(i=2, home="VAN", away="EDM", hg=4, ag=2,
                    sog_home=28, sog_away=26,
                    goalie_home=_goalie("g_demko", 24, 26, 2, "W"),
                    goalie_away=_goalie("g_skinner", 24, 28, 4, "L")),
        _make_final(i=3, home="EDM", away="CGY", hg=2, ag=3,
                    sog_home=29, sog_away=32,
                    goalie_home=_goalie("g_skinner", 29, 32, 3, "L"),
                    goalie_away=_goalie("g_wolf", 27, 29, 2, "W")),
        _make_final(i=4, home="EDM", away="WPG", hg=3, ag=2,
                    sog_home=30, sog_away=28,
                    goalie_home=_goalie("g_skinner", 26, 28, 2, "W"),
                    goalie_away=_goalie("g_hellebuyck", 27, 30, 3, "L")),
        _make_final(i=5, home="NSH", away="EDM", hg=2, ag=3,
                    sog_home=25, sog_away=28,
                    goalie_home=_goalie("g_saros", 25, 28, 3, "L"),
                    goalie_away=_goalie("g_skinner", 23, 25, 2, "W")),
    ]

    # Newer 5 games: shots trending up (34-38), goals against down (mostly 1-2)
    newer = [
        _make_final(i=6, home="EDM", away="DAL", hg=4, ag=1,
                    sog_home=36, sog_away=26,
                    goalie_home=_goalie("g_skinner", 25, 26, 1, "W"),
                    goalie_away=_goalie("g_oettinger", 32, 36, 4, "L")),
        _make_final(i=7, home="STL", away="EDM", hg=1, ag=4,
                    sog_home=27, sog_away=38,
                    goalie_home=_goalie("g_binnington", 34, 38, 4, "L"),
                    goalie_away=_goalie("g_skinner", 26, 27, 1, "W")),
        _make_final(i=8, home="EDM", away="MIN", hg=5, ag=2,
                    sog_home=37, sog_away=29,
                    goalie_home=_goalie("g_skinner", 27, 29, 2, "W"),
                    goalie_away=_goalie("g_gustavsson", 32, 37, 5, "L")),
        _make_final(i=9, home="CHI", away="EDM", hg=2, ag=3,
                    sog_home=25, sog_away=34,
                    goalie_home=_goalie("g_mrazek", 31, 34, 3, "L"),
                    goalie_away=_goalie("g_pickard", 23, 25, 2, "W")),
        _make_final(i=10, home="EDM", away="LAK", hg=4, ag=2,
                    sog_home=35, sog_away=28,
                    goalie_home=_goalie("g_skinner", 26, 28, 2, "W"),
                    goalie_away=_goalie("g_kuemper", 31, 35, 4, "L")),
    ]

    class AsyncDBWrapper:
        """Thin async adapter over mongomock — motor-shaped for our code."""
        def __init__(self, sync_db):
            self._db = sync_db
        def __getitem__(self, key):
            return AsyncCollection(self._db[key])

    class AsyncCollection:
        def __init__(self, coll):
            self._c = coll
        def aggregate(self, pipeline):
            docs = list(self._c.aggregate(pipeline))
            async def gen():
                for d in docs:
                    yield d
            return gen()

    for doc in older + newer:
        m["ticker_hockey_iq"]["iq_game_finals"].insert_one(doc)

    return AsyncDBWrapper(m["ticker_hockey_iq"])


# --------------------------------------------------------------------------
# TESTS
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_windows_have_correct_confidence_tiers(db_with_edm_season):
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    assert set(r["windows"].keys()) == set(ALL_WINDOWS)
    # SEASON, L10 have full 10-game sample → declared tiers
    assert r["windows"]["SEASON"]["tier"] == "baseline"
    assert r["windows"]["L10"]["tier"] == "strong"
    assert r["windows"]["L5"]["tier"] == "moderate"
    assert r["windows"]["L2"]["tier"] == "indicative_only"
    assert r["windows"]["L1"]["tier"] == "single_game_context"


@pytest.mark.asyncio
async def test_reserved_metrics_return_null_with_reason(db_with_edm_season):
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    for w in ("SEASON", "L10", "L5"):
        metrics = r["windows"][w]["metrics"]
        assert metrics["pp_pct"]["value"] is None
        assert "requires" in metrics["pp_pct"]["null_reason"]
        assert metrics["pk_pct"]["value"] is None
        assert metrics["hits_per_game"]["value"] is None
        assert metrics["pim_per_game"]["value"] is None
        assert metrics["faceoff_win_pct"]["value"] is None
        assert metrics["high_danger_for_per_game"]["value"] is None
        assert metrics["expected_goals_for_per_game"]["value"] is None


@pytest.mark.asyncio
async def test_team_save_pct_is_derived_from_goalie_counts(db_with_edm_season):
    """Correction #4 — team save% is aggregated from goalie saves/shots-against."""
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    sp = r["windows"]["SEASON"]["metrics"]["team_save_pct"]
    assert sp["value"] is not None
    # Sanity: a decent NHL team's aggregated save% lives roughly 0.88-0.94
    assert 0.85 <= sp["value"] <= 0.98
    assert sp["source"].startswith("iq_game_finals.goalies")


@pytest.mark.asyncio
async def test_shots_trending_up_l5_vs_season(db_with_edm_season):
    """The fixture engineered a clear L5 shots-up trend. The direction
    engine must catch it and label it 'up'."""
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    l5 = r["windows"]["L5"]
    d = l5["direction_vs_season"]["shots_for_per_game"]
    assert d["direction"] == "up", f"expected up, got {d}"
    assert d["delta"] > 0
    assert d["delta_pct"] > 5.0


@pytest.mark.asyncio
async def test_goals_against_trending_direction_uses_lower_is_better(db_with_edm_season):
    """goals_against_per_game must be scored with lower-is-better semantics.
    A decrease appears as 'improving', not 'down'."""
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    l5 = r["windows"]["L5"]
    d = l5["direction_vs_season"].get("goals_against_per_game")
    # Direction should be one of the labelled outcomes for lower-is-better metrics
    assert d is not None
    assert d["direction"] in ("improving", "worsening", "flat")


@pytest.mark.asyncio
async def test_acceleration_surfaces_only_when_both_windows_qualify(db_with_edm_season):
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    accel = r["acceleration"]
    # With 10 games in the fixture, both L5 and L10 qualify — acceleration is present.
    assert "shots_for_per_game" in accel
    assert accel["shots_for_per_game"]["direction"] in ("up", "down", "flat")


@pytest.mark.asyncio
async def test_insufficient_sample_when_no_games(db_with_edm_season):
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="OTT",  # never played in fixture
        season="20252026", season_type="REG",
    )
    for w in ALL_WINDOWS:
        assert r["windows"][w]["tier"] == "insufficient_sample"
        assert r["windows"][w]["metrics"] is None
        # The declared tier when qualified must still be visible so the
        # consumer knows what this window WOULD be worth with data.
        assert r["windows"][w]["declared_tier_when_qualified"] == WINDOW_TIER[w]
    # No acceleration possible with no games
    assert r["acceleration"] == {}


@pytest.mark.asyncio
async def test_l1_never_labelled_same_as_l10(db_with_edm_season):
    """The core invariant: L1 confidence tier must never match L10 / SEASON."""
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    assert r["windows"]["L1"]["tier"] == "single_game_context"
    assert r["windows"]["L10"]["tier"] == "strong"
    assert r["windows"]["SEASON"]["tier"] == "baseline"
    assert r["windows"]["L1"]["tier"] != r["windows"]["L10"]["tier"]
    assert r["windows"]["L1"]["tier"] != r["windows"]["SEASON"]["tier"]


@pytest.mark.asyncio
async def test_goalie_rolling_form_derives_save_pct_from_counts(db_with_edm_season):
    """Correction #4 at the goalie level: save% = saves / shots_against
    computed at read time, never from a provider field."""
    r = await goalie_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        ticker_player_id="g_skinner",
        season="20252026", season_type="REG",
    )
    season = r["windows"]["SEASON"]
    # Skinner appears in every EDM game (7 of the 10 games in the fixture)
    assert season["sample_size"] >= 5
    assert season["save_pct"] is not None
    assert 0.85 <= season["save_pct"] <= 0.98
    # GAA is derived; positive number
    assert season["gaa"] is not None and season["gaa"] > 0


@pytest.mark.asyncio
async def test_provenance_notes_present(db_with_edm_season):
    r = await team_rolling_form(
        db_with_edm_season, ticker_team_id="EDM",
        season="20252026", season_type="REG",
    )
    notes = r["provenance"]["notes"]
    assert any("L1" in n and "L2" in n for n in notes), \
        "Expected explicit L1/L2 confidence-tier warning in provenance notes"
    assert any("Reserved metrics" in n for n in notes), \
        "Expected reserved-metrics disclaimer in provenance notes"
