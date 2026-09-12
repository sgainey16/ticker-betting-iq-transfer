"""NHL Public API → GameFinal ingester.

Given a boxscore payload for a completed game, build the ingredients to
call write_game_final(). Never touches HTTP directly — pure translation.
"""
from __future__ import annotations
from typing import Optional

from intelligence.models_1a import Provenance, SourceRecord, now_iso
from intelligence.models_1b import (
    FinalScore, TeamGameFacts, GoalieLine,
)
from intelligence.season_util import (
    season_int_to_str, season_type_from_game_type,
)

ENGINE_VERSION = "1.0.0"


def _toi_to_seconds(toi: Optional[str]) -> Optional[int]:
    """Convert 'MM:SS' → total seconds. Returns None on empty/invalid."""
    if not toi or not isinstance(toi, str):
        return None
    parts = toi.split(":")
    if len(parts) != 2:
        return None
    try:
        m, s = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    return m * 60 + s


def _game_outcome_kind(gameOutcome: Optional[dict], reg_periods: Optional[int]) -> str:
    """Map NHL Public API's gameOutcome.lastPeriodType → REG/OT/SO."""
    if not gameOutcome:
        return "REG"
    lp = (gameOutcome.get("lastPeriodType") or "").upper()
    if lp in ("REG", ""):
        return "REG"
    if lp == "OT":
        return "OT"
    if lp == "SO":
        return "SO"
    return "REG"


def parse_boxscore_to_final_payload(
    boxscore: dict,
    *,
    ticker_game_id: str,
    home_team_id: str,
    away_team_id: str,
    home_goalie_resolutions: Optional[dict[int, str]] = None,
    away_goalie_resolutions: Optional[dict[int, str]] = None,
    endpoint: str = "gamecenter/{gameId}/boxscore",
    http_status: int = 200,
    cache_hit: bool = False,
) -> dict:
    """Return kwargs ready to pass to write_game_final().

    Ticker team IDs must be resolved by the caller before invocation —
    this function does not touch the team resolver.
    Goalie player-id resolutions are also optional (goalies-only rule from
    Foundation 1B REV2: skater identity is not resolved in 1B).
    """
    home_goalie_resolutions = home_goalie_resolutions or {}
    away_goalie_resolutions = away_goalie_resolutions or {}

    season_int = boxscore.get("season")
    season = season_int_to_str(season_int) if season_int is not None else "unknown"
    season_type = season_type_from_game_type(boxscore.get("gameType", 2))

    home = boxscore.get("homeTeam", {}) or {}
    away = boxscore.get("awayTeam", {}) or {}
    game_outcome = boxscore.get("gameOutcome") or {}
    outcome_kind = _game_outcome_kind(game_outcome, boxscore.get("regPeriods"))

    final_score = FinalScore(
        home_goals=int(home.get("score", 0)),
        away_goals=int(away.get("score", 0)),
        outcome=outcome_kind,   # type: ignore[arg-type]
        ot_periods=int(game_outcome.get("otPeriods")) if game_outcome.get("otPeriods") is not None else None,
        reg_periods=int(boxscore["regPeriods"]) if boxscore.get("regPeriods") is not None else None,
    )

    def _team_facts(is_home: bool, team_block: dict, team_id: str) -> TeamGameFacts:
        return TeamGameFacts(
            ticker_team_id=team_id,
            is_home=is_home,
            shots_on_goal=int(team_block["sog"]) if team_block.get("sog") is not None else None,
        )

    def _goalie(g: dict, res_map: dict[int, str]) -> GoalieLine:
        pid = g.get("playerId")
        return GoalieLine(
            ticker_player_id=res_map.get(pid),
            provider_player_id_nhl=int(pid) if pid is not None else None,
            display_name=(g.get("name") or {}).get("default", "Unknown"),
            starter=bool(g.get("starter")) if g.get("starter") is not None else None,
            toi_seconds=_toi_to_seconds(g.get("toi")),
            shots_against=(int(g["shotsAgainst"]) if g.get("shotsAgainst") is not None else None),
            saves=(int(g["saves"]) if g.get("saves") is not None else None),
            goals_against=(int(g["goalsAgainst"]) if g.get("goalsAgainst") is not None else None),
        )

    pbs = boxscore.get("playerByGameStats", {}) or {}
    home_goalies = [_goalie(g, home_goalie_resolutions)
                    for g in (pbs.get("homeTeam", {}) or {}).get("goalies", [])]
    away_goalies = [_goalie(g, away_goalie_resolutions)
                    for g in (pbs.get("awayTeam", {}) or {}).get("goalies", [])]

    populated_fields = ["final_score", "home_team_facts", "away_team_facts",
                        "home_goalies", "away_goalies"]
    if not home_goalies and not away_goalies:
        populated_fields = ["final_score", "home_team_facts", "away_team_facts"]

    prov = Provenance(
        sources_consulted=[SourceRecord(
            name="nhl_public",
            endpoint=endpoint,
            fetched_at=now_iso(),
            http_status=http_status,
            cache_hit=cache_hit,
            fields_populated=populated_fields,
        )],
        written_at=now_iso(),
        engine_version=ENGINE_VERSION,
    )

    return {
        "ticker_game_id": ticker_game_id,
        "competition": "NHL",
        "season": season,
        "season_type": season_type,
        "home_team_id": home_team_id,
        "away_team_id": away_team_id,
        "played_at_iso": boxscore.get("startTimeUTC") or boxscore.get("gameDate") or now_iso(),
        "final_score": final_score,
        "home_team_facts": _team_facts(True, home, home_team_id),
        "away_team_facts": _team_facts(False, away, away_team_id),
        "home_goalies": home_goalies,
        "away_goalies": away_goalies,
        "provenance": prov,
    }
