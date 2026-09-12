"""Recent-history views for Foundation 1B.

Stateless projections that read from iq_game_finals and derive per-team
perspectives on demand. Nothing here writes.

Design contracts:

  * Correction #3 — Single source of truth for team goals.
    Team GF/GA in every projection are derived from GameFinal.final_score,
    NOT from any team-facts field. TeamGameFacts intentionally has no
    goals field.

  * Correction #4 — Goalie save percentage is derived from counts.
    save_pct = saves / shots_against when both counts are present and
    shots_against > 0. Otherwise null. Provider-supplied savePct is NOT
    consulted; counts are authoritative.

  * Temporal integrity — *_as_of variants filter iq_game_finals by
    recorded_at <= as_of_iso, ensuring lock-time reads never leak a
    correction that hadn't yet been recorded.

  * Latest-version-per-game selection — Both present-tense and as_of
    reads pick the newest record_version whose recorded_at satisfies the
    time filter. Historical corrections that happened AFTER as_of stay
    invisible.
"""
from __future__ import annotations
from typing import Literal, Optional, Any

SeasonType = Literal["PRE", "REG", "POST"]


# --------------------------------------------------------------------------
# Small helpers — pure functions.
# --------------------------------------------------------------------------
def derive_save_pct(saves: Optional[int], shots_against: Optional[int]) -> Optional[float]:
    """Build correction #4.

    Returns saves / shots_against when both are present and shots_against > 0.
    Returns None when either count is missing or shots_against == 0.
    """
    if saves is None or shots_against is None:
        return None
    if shots_against <= 0:
        return None
    return saves / shots_against


def _team_perspective(final_doc: dict, ticker_team_id: str) -> Optional[dict]:
    """Project one GameFinal record from a given team's point of view.

    Team goals derived from FinalScore only (correction #3).
    """
    if not final_doc:
        return None
    is_home = final_doc["home_team_id"] == ticker_team_id
    is_away = final_doc["away_team_id"] == ticker_team_id
    if not (is_home or is_away):
        return None

    fs = final_doc["final_score"]
    home_g = int(fs["home_goals"])
    away_g = int(fs["away_goals"])
    outcome = fs["outcome"]   # REG / OT / SO

    if is_home:
        gf, ga = home_g, away_g
        opponent_id = final_doc["away_team_id"]
        team_facts = final_doc["home_team_facts"]
        opponent_facts = final_doc["away_team_facts"]
        team_goalies = final_doc.get("home_goalies", [])
        opponent_goalies = final_doc.get("away_goalies", [])
    else:
        gf, ga = away_g, home_g
        opponent_id = final_doc["home_team_id"]
        team_facts = final_doc["away_team_facts"]
        opponent_facts = final_doc["home_team_facts"]
        team_goalies = final_doc.get("away_goalies", [])
        opponent_goalies = final_doc.get("home_goalies", [])

    if gf > ga:
        result = "W"
    elif gf < ga:
        result = "L" if outcome == "REG" else ("OTL" if outcome == "OT" else "SOL")
    else:
        result = "T"  # Should never happen in modern NHL; kept for honesty.

    def _goalie_view(g: dict) -> dict:
        return {
            "ticker_player_id": g.get("ticker_player_id"),
            "provider_player_id_nhl": g.get("provider_player_id_nhl"),
            "display_name": g.get("display_name"),
            "starter": g.get("starter"),
            "toi_seconds": g.get("toi_seconds"),
            "shots_against": g.get("shots_against"),
            "saves": g.get("saves"),
            "goals_against": g.get("goals_against"),
            "save_pct": derive_save_pct(g.get("saves"), g.get("shots_against")),
            "decision": g.get("decision"),
        }

    return {
        "ticker_game_id": final_doc["ticker_game_id"],
        "record_version": final_doc["record_version"],
        "played_at_iso": final_doc["played_at_iso"],
        "recorded_at": final_doc["recorded_at"],
        "season": final_doc["season"],
        "season_type": final_doc["season_type"],
        "team_id": ticker_team_id,
        "opponent_id": opponent_id,
        "is_home": is_home,
        "goals_for": gf,          # derived from final_score
        "goals_against": ga,      # derived from final_score
        "result": result,
        "outcome": outcome,
        "shots_on_goal_for": team_facts.get("shots_on_goal"),
        "shots_on_goal_against": opponent_facts.get("shots_on_goal"),
        "goalies": [_goalie_view(g) for g in team_goalies],
        "opponent_goalies": [_goalie_view(g) for g in opponent_goalies],
    }


# --------------------------------------------------------------------------
# Latest-version selection — the hot path.
#
# For each ticker_game_id we want the row with the highest record_version
# among those whose recorded_at <= as_of_iso (or all rows if as_of_iso is
# None). Mongo aggregation handles this in one pipeline.
# --------------------------------------------------------------------------
def _pipeline_latest_versions(match: dict, as_of_iso: Optional[str],
                              limit: Optional[int] = None) -> list[dict]:
    stages: list[dict] = [{"$match": match}]
    if as_of_iso is not None:
        # BOTH temporal gates must hold. recorded_at prevents a correction
        # that landed after as_of from leaking backward; played_at_iso
        # prevents a future-dated game whose recorded_at happens to sit
        # before as_of from appearing in a historical view.
        stages.append({"$match": {
            "recorded_at":   {"$lte": as_of_iso},
            "played_at_iso": {"$lte": as_of_iso},
        }})
    # Sort by game+version DESC and use $group with $first to pick newest
    # version per game.
    stages.append({"$sort": {"ticker_game_id": 1, "record_version": -1}})
    stages.append({
        "$group": {
            "_id": "$ticker_game_id",
            "doc": {"$first": "$$ROOT"},
        }
    })
    stages.append({"$replaceRoot": {"newRoot": "$doc"}})
    # Chronological order by played_at_iso DESC for Last-N views.
    stages.append({"$sort": {"played_at_iso": -1}})
    if limit is not None:
        stages.append({"$limit": limit})
    return stages


async def _run_latest(db, match: dict, as_of_iso: Optional[str],
                      limit: Optional[int] = None) -> list[dict]:
    pipeline = _pipeline_latest_versions(match, as_of_iso, limit)
    return [d async for d in db["iq_game_finals"].aggregate(pipeline)]


# --------------------------------------------------------------------------
# Public API — Last-N and season baselines, present-tense and as_of.
# --------------------------------------------------------------------------
async def history_for_team_as_of(
    db, *, ticker_team_id: str, as_of_iso: str,
    n: int, season_type: Optional[SeasonType] = None,
) -> list[dict]:
    """Chronologically most-recent N completed games for a team, filtered
    strictly to rows Ticker had already recorded by as_of_iso.

    A game whose only record_version was written AFTER as_of_iso is not
    returned. A game whose v1 was written before as_of_iso but whose v2
    correction landed after as_of_iso returns as v1.
    """
    match: dict[str, Any] = {
        "$or": [
            {"home_team_id": ticker_team_id},
            {"away_team_id": ticker_team_id},
        ],
    }
    if season_type is not None:
        match["season_type"] = season_type
    docs = await _run_latest(db, match, as_of_iso=as_of_iso, limit=n)
    return [p for p in (_team_perspective(d, ticker_team_id) for d in docs) if p]


async def present_history_for_team(
    db, *, ticker_team_id: str, n: int,
    season_type: Optional[SeasonType] = None,
) -> list[dict]:
    """The present-tense, unfiltered Last-N view. Equivalent to
    history_for_team_as_of with as_of_iso = 'now'."""
    match: dict[str, Any] = {
        "$or": [
            {"home_team_id": ticker_team_id},
            {"away_team_id": ticker_team_id},
        ],
    }
    if season_type is not None:
        match["season_type"] = season_type
    docs = await _run_latest(db, match, as_of_iso=None, limit=n)
    return [p for p in (_team_perspective(d, ticker_team_id) for d in docs) if p]


async def season_baseline_for_team(
    db, *, ticker_team_id: str, season: str, season_type: SeasonType,
    as_of_iso: Optional[str] = None,
) -> dict:
    """Aggregate counts across ALL of a team's games in a season/season_type.

    Returns counts, not percentages — projection code computes any ratios
    on the fly. Consistent with correction #3 discipline.

    NOTE: no coverage-state field is returned. Coverage completeness is
    NOT stored anywhere in Foundation 1B. A caller who needs to gate on
    "complete season" must supply positive evidence explicitly at that
    call site — 1B stays honest by refusing to synthesize a completeness
    claim from its own count of ingested games.
    """
    match: dict[str, Any] = {
        "$or": [
            {"home_team_id": ticker_team_id},
            {"away_team_id": ticker_team_id},
        ],
        "season": season, "season_type": season_type,
    }
    docs = await _run_latest(db, match, as_of_iso=as_of_iso, limit=None)
    persps = [p for p in (_team_perspective(d, ticker_team_id) for d in docs) if p]
    w = sum(1 for p in persps if p["result"] == "W")
    reg_l = sum(1 for p in persps if p["result"] == "L")
    otl = sum(1 for p in persps if p["result"] == "OTL")
    sol = sum(1 for p in persps if p["result"] == "SOL")
    gf = sum(p["goals_for"] for p in persps)
    ga = sum(p["goals_against"] for p in persps)

    return {
        "team_id": ticker_team_id,
        "season": season,
        "season_type": season_type,
        "as_of": as_of_iso,
        "games_recorded": len(persps),
        "wins": w,
        "reg_losses": reg_l,
        "ot_losses": otl,
        "so_losses": sol,
        "goals_for": gf,
        "goals_against": ga,
    }


async def game_final_as_of(
    db, *, ticker_game_id: str, as_of_iso: Optional[str] = None,
) -> Optional[dict]:
    """The single game-final record for a game as Ticker knew it at
    as_of_iso (or now, if None). Returns the raw record; callers can
    apply _team_perspective if they want a side view."""
    match = {"ticker_game_id": ticker_game_id}
    docs = await _run_latest(db, match, as_of_iso=as_of_iso, limit=1)
    return docs[0] if docs else None


def project_from_both_sides(final_doc: dict) -> dict:
    """Convenience projection — returns both team perspectives from one
    raw GameFinal document. Useful for tests / QA endpoints."""
    return {
        "home": _team_perspective(final_doc, final_doc["home_team_id"]),
        "away": _team_perspective(final_doc, final_doc["away_team_id"]),
    }
