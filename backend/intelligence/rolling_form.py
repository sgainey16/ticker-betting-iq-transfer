"""Rolling-form intelligence — SEASON / L10 / L5 / L2 / L1.

Purpose (per user directive 2026-02-14):
  * Preserve this capability inside the shared Ticker analytics layer NOW,
    so it is available to the prediction/accuracy engine, Reggie + Marc
    context builders, and future Premium Hockey IQ.
  * Do NOT wire it into user-facing Team/Player pages in this pass.
  * Never treat L1 / L2 as equally reliable as L5 / L10 / SEASON. Every
    output carries its window, sample size, source and confidence tier so
    downstream consumers can weight it correctly.
  * Never fabricate a metric. If a data field is not populated by
    Foundation 1B, the window returns `null_reason` — not a number.

Data honesty tier (from the Ticker convergence audit availability legend):
  * AVAILABLE NOW:  goals_for, goals_against, goal_diff, shots_for,
                    shots_against, shot_diff, team_save_pct (derived from
                    goalie counts), record, points.
  * REQUIRES SPORTSDATA-TIER OR SPORTRADAR:  pp_pct, pk_pct, hits, pim,
                    faceoff_win_pct. TeamGameFacts already declares these
                    as reserved-None in models_1b.py:114-117 — they will
                    slot in here without a schema change when they light
                    up.
  * REQUIRES SPORTLOGIQ:  high-danger chances, xG, rush chances, entry
                    control. Not modelled here — those live in future
                    intelligence lenses.

Design contracts inherited from Foundation 1B:
  * Reads only through recent_history_views (no direct iq_game_finals
    access). That means correction chains, versioned rows, and the dual
    temporal gate (recorded_at + played_at_iso) are always honoured.
  * Stateless. Recomputable at any as_of_iso. Nothing writes to Mongo.
"""
from __future__ import annotations
from typing import Any, Literal, Optional

from intelligence.recent_history_views import (
    history_for_team_as_of,
    present_history_for_team,
    season_baseline_for_team,
)

WindowKey = Literal["SEASON", "L10", "L5", "L2", "L1"]

# Confidence tiers — the whole point of this module. L1 is a single-game
# context signal; L2 is indicative; L5 is where statistical rolling form
# starts to be meaningful; L10 is strong; SEASON is the baseline. The
# prediction engine and Reggie/Marc context must use these tags to decide
# how much weight to place on a window.
WINDOW_TIER: dict[str, str] = {
    "SEASON": "baseline",
    "L10":    "strong",
    "L5":     "moderate",
    "L2":     "indicative_only",
    "L1":     "single_game_context",
}

# Minimum sample sizes below which a window is emitted with
# tier="insufficient_sample" and metrics returning null. Prevents a
# 2-game season from ranking above a real L10.
WINDOW_MIN_SAMPLE: dict[str, int] = {
    "SEASON": 5,   # season averages meaningless below ~5 games
    "L10":    5,   # honest floor for a "last 10" rate
    "L5":     3,
    "L2":     2,
    "L1":     1,
}

# All windows we compute. Ordered largest → smallest so consumers can
# iterate and see the baseline first.
ALL_WINDOWS: tuple[str, ...] = ("SEASON", "L10", "L5", "L2", "L1")


# --------------------------------------------------------------------------
# Metric registry — every metric declares its source tier and how to
# compute it from a list of per-game team perspectives. Anything gated
# on Sportlogiq / SportsData-tier stays declared here so the layout is
# visible when providers come online.
# --------------------------------------------------------------------------
def _sum(games: list[dict], key: str) -> Optional[int]:
    """Sum an integer field across games; returns None if any game lacks it."""
    if not games:
        return None
    vals = [g.get(key) for g in games]
    if any(v is None for v in vals):
        return None
    return sum(int(v) for v in vals)


def _team_save_pct(games: list[dict]) -> tuple[Optional[float], Optional[int], Optional[int]]:
    """Team save% aggregated across all goalie rows in the window.
    Returns (save_pct, total_saves, total_shots_against)."""
    saves = 0
    sa = 0
    have_any = False
    for g in games:
        for goalie in g.get("goalies", []):
            gs = goalie.get("saves")
            gsa = goalie.get("shots_against")
            if gs is not None and gsa is not None:
                saves += int(gs)
                sa += int(gsa)
                have_any = True
    if not have_any or sa == 0:
        return (None, None, None)
    return (saves / sa, saves, sa)


def _record(games: list[dict]) -> dict:
    w = sum(1 for g in games if g["result"] == "W")
    rl = sum(1 for g in games if g["result"] == "L")
    otl = sum(1 for g in games if g["result"] == "OTL")
    sol = sum(1 for g in games if g["result"] == "SOL")
    return {"w": w, "reg_l": rl, "otl": otl, "sol": sol, "pts": 2 * w + otl + sol}


def _rate_metrics(games: list[dict]) -> dict:
    """Per-game rate metrics computed from AVAILABLE-NOW fields only."""
    n = len(games)
    if n == 0:
        return {}

    gf_total = sum(int(g["goals_for"]) for g in games)
    ga_total = sum(int(g["goals_against"]) for g in games)
    sf_total = _sum(games, "shots_on_goal_for")
    sa_total = _sum(games, "shots_on_goal_against")
    save_pct, saves_total, sa_seen = _team_save_pct(games)

    return {
        "goals_for_per_game":     {"value": round(gf_total / n, 3), "source": "iq_game_finals.final_score", "sample": n, "tier": "available_now"},
        "goals_against_per_game": {"value": round(ga_total / n, 3), "source": "iq_game_finals.final_score", "sample": n, "tier": "available_now"},
        "goal_diff_per_game":     {"value": round((gf_total - ga_total) / n, 3), "source": "iq_game_finals.final_score", "sample": n, "tier": "available_now"},
        "shots_for_per_game": (
            {"value": round(sf_total / n, 2), "source": "iq_game_finals.team_facts.shots_on_goal", "sample": n, "tier": "available_now"}
            if sf_total is not None else
            {"value": None, "null_reason": "shots_on_goal missing in one or more games", "sample": n, "tier": "available_now"}
        ),
        "shots_against_per_game": (
            {"value": round(sa_total / n, 2), "source": "iq_game_finals.team_facts.shots_on_goal", "sample": n, "tier": "available_now"}
            if sa_total is not None else
            {"value": None, "null_reason": "shots_on_goal missing in one or more games", "sample": n, "tier": "available_now"}
        ),
        "shot_diff_per_game": (
            {"value": round((sf_total - sa_total) / n, 2), "source": "iq_game_finals.team_facts.shots_on_goal", "sample": n, "tier": "available_now"}
            if sf_total is not None and sa_total is not None else
            {"value": None, "null_reason": "shots_on_goal missing", "sample": n, "tier": "available_now"}
        ),
        "team_save_pct": (
            {"value": round(save_pct, 4), "source": "iq_game_finals.goalies (derived)", "sample": sa_seen, "tier": "available_now"}
            if save_pct is not None else
            {"value": None, "null_reason": "no goalie shots-against in window", "sample": 0, "tier": "available_now"}
        ),
        # ----------------------------------------------------------------
        # Reserved metrics — architecture visible, data pending providers.
        # Emitting them keeps downstream consumers stable when providers
        # come online. They must NEVER surface as real numbers today.
        # ----------------------------------------------------------------
        "pp_pct":            {"value": None, "null_reason": "requires sportsdata-tier or sportradar", "tier": "requires_provider"},
        "pk_pct":            {"value": None, "null_reason": "requires sportsdata-tier or sportradar", "tier": "requires_provider"},
        "hits_per_game":     {"value": None, "null_reason": "requires sportsdata-tier",              "tier": "requires_provider"},
        "pim_per_game":      {"value": None, "null_reason": "requires sportsdata-tier",              "tier": "requires_provider"},
        "faceoff_win_pct":   {"value": None, "null_reason": "requires sportsdata-tier",              "tier": "requires_provider"},
        "high_danger_for_per_game":     {"value": None, "null_reason": "requires sportlogiq", "tier": "requires_provider"},
        "high_danger_against_per_game": {"value": None, "null_reason": "requires sportlogiq", "tier": "requires_provider"},
        "expected_goals_for_per_game":  {"value": None, "null_reason": "requires sportlogiq", "tier": "requires_provider"},
    }


def _direction(window_value: Optional[float], baseline_value: Optional[float],
               *, higher_is_better: bool = True, min_delta_pct: float = 5.0) -> dict:
    """Direction indicator: up / down / flat / insufficient.

    higher_is_better flips the semantic (e.g. goals_against_per_game where
    a lower window rate is "improving"). min_delta_pct filters noise —
    tiny drifts don't count as a trend.
    """
    if window_value is None or baseline_value is None:
        return {"direction": "insufficient_sample", "delta": None, "delta_pct": None}
    if baseline_value == 0:
        return {"direction": "insufficient_sample", "delta": None, "delta_pct": None}
    delta = window_value - baseline_value
    delta_pct = 100.0 * delta / abs(baseline_value)
    if abs(delta_pct) < min_delta_pct:
        return {"direction": "flat", "delta": round(delta, 4), "delta_pct": round(delta_pct, 2)}
    if higher_is_better:
        direction = "up" if delta > 0 else "down"
    else:
        # Lower baseline is better (e.g. goals against) — inverted labelling
        # for consumer clarity: "improving" / "worsening".
        direction = "improving" if delta < 0 else "worsening"
    return {"direction": direction, "delta": round(delta, 4), "delta_pct": round(delta_pct, 2)}


# --------------------------------------------------------------------------
# Public API — team rolling form.
# --------------------------------------------------------------------------
async def team_rolling_form(
    db, *, ticker_team_id: str, season: str, season_type: str,
    as_of_iso: Optional[str] = None,
) -> dict:
    """Return SEASON / L10 / L5 / L2 / L1 form for one team.

    Args:
      ticker_team_id: canonical id from Foundation 1A.
      season:         e.g. "20252026".
      season_type:    "PRE" | "REG" | "POST" (matches Foundation 1B).
      as_of_iso:      optional temporal gate. When None, uses present-tense
                      reads. When set, feeds into 1B's dual-gate filter so
                      the answer matches what Ticker knew at that instant.

    Output shape (stable contract):
      {
        team_id, season, season_type, as_of_iso,
        windows: {
          SEASON: { window, tier, sample_size, coverage_note, record, metrics, direction_vs_season: null },
          L10:    { window, tier, sample_size, most_recent_played_at, oldest_played_at,
                    record, metrics, direction_vs_season: { <metric>: {direction, delta, delta_pct} } },
          L5:     { ... },
          L2:     { ... },
          L1:     { ... },
        },
        acceleration: {                       # L5 vs L10 movement, only when both windows qualify
           <metric>: { direction, delta, delta_pct }
        },
        provenance: { source, generated_at, notes[] }
      }
    """
    # -------- baseline (season) --------
    season_games = await (
        history_for_team_as_of(db, ticker_team_id=ticker_team_id, as_of_iso=as_of_iso,
                               n=1000, season_type=season_type)
        if as_of_iso is not None else
        present_history_for_team(db, ticker_team_id=ticker_team_id, n=1000, season_type=season_type)
    )
    # Filter to the requested season string. 1B keys season on the games,
    # not on the read helper.
    season_games = [g for g in season_games if g["season"] == season]

    season_metrics = _rate_metrics(season_games)

    windows: dict[str, dict] = {}
    windows["SEASON"] = _build_window("SEASON", season_games, season_metrics_ref=None)

    # -------- Last-N windows, all reading from the same season list --------
    # season_games is already chronological DESC via _pipeline_latest_versions.
    for wkey, wn in (("L10", 10), ("L5", 5), ("L2", 2), ("L1", 1)):
        subset = season_games[:wn]
        windows[wkey] = _build_window(wkey, subset, season_metrics_ref=season_metrics)

    # -------- Acceleration: is form accelerating vs the slower window? --------
    acceleration: dict[str, dict] = {}
    l10 = windows["L10"]
    l5 = windows["L5"]
    if l10.get("tier") != "insufficient_sample" and l5.get("tier") != "insufficient_sample":
        for m_key, m_l5 in l5.get("metrics", {}).items():
            m_l10 = l10.get("metrics", {}).get(m_key) or {}
            if m_l5.get("value") is None or m_l10.get("value") is None:
                continue
            higher_is_better = m_key not in (
                "goals_against_per_game", "shots_against_per_game",
                "high_danger_against_per_game",
            )
            acceleration[m_key] = _direction(
                m_l5["value"], m_l10["value"],
                higher_is_better=higher_is_better,
                min_delta_pct=5.0,
            )

    return {
        "team_id": ticker_team_id,
        "season": season,
        "season_type": season_type,
        "as_of_iso": as_of_iso,
        "windows": windows,
        "acceleration": acceleration,
        "provenance": {
            "source": "intelligence.rolling_form on iq_game_finals via recent_history_views",
            "temporal_integrity": "1B dual-gate (recorded_at + played_at_iso)" if as_of_iso else "present-tense",
            "notes": [
                "Reserved metrics (pp_pct, pk_pct, hits, pim, faceoff_win_pct, high-danger, xG) "
                "are returned as null with null_reason. Do not surface these to users until "
                "their providers are wired.",
                "L1 and L2 are single-game / two-game context. Consumers must respect the "
                "confidence tier — never treat these as equivalent to L5 / L10 / SEASON.",
            ],
        },
    }


def _build_window(window_key: str, games: list[dict],
                  season_metrics_ref: Optional[dict]) -> dict:
    n = len(games)
    min_n = WINDOW_MIN_SAMPLE[window_key]
    if n < min_n:
        return {
            "window": window_key,
            "tier": "insufficient_sample",
            "sample_size": n,
            "min_sample_required": min_n,
            "declared_tier_when_qualified": WINDOW_TIER[window_key],
            "record": None,
            "metrics": None,
            "direction_vs_season": None,
        }
    metrics = _rate_metrics(games)
    directions: dict[str, dict] = {}
    if season_metrics_ref is not None:
        for m_key, m in metrics.items():
            if m.get("value") is None:
                continue
            base = season_metrics_ref.get(m_key) or {}
            if base.get("value") is None:
                continue
            higher_is_better = m_key not in (
                "goals_against_per_game", "shots_against_per_game",
                "high_danger_against_per_game",
            )
            directions[m_key] = _direction(
                m["value"], base["value"],
                higher_is_better=higher_is_better,
                min_delta_pct=5.0,
            )
    return {
        "window": window_key,
        "tier": WINDOW_TIER[window_key],
        "sample_size": n,
        "most_recent_played_at": games[0]["played_at_iso"] if games else None,
        "oldest_played_at": games[-1]["played_at_iso"] if games else None,
        "record": _record(games),
        "metrics": metrics,
        "direction_vs_season": directions,
    }


# --------------------------------------------------------------------------
# Public API — goalie rolling form.
# One goalie (identified by ticker_player_id) across their appearances
# in the same team-perspective stream.
# --------------------------------------------------------------------------
async def goalie_rolling_form(
    db, *, ticker_team_id: str, ticker_player_id: str,
    season: str, season_type: str, as_of_iso: Optional[str] = None,
) -> dict:
    """Rolling form for one goalie by ticker_player_id.

    Uses the same team-perspective stream as team_rolling_form to keep
    Foundation 1B as the sole source. Filters each game's goalie rows
    to the requested player, and only counts games in which the goalie
    actually appeared with counts.
    """
    all_team_games = await (
        history_for_team_as_of(db, ticker_team_id=ticker_team_id, as_of_iso=as_of_iso,
                               n=1000, season_type=season_type)
        if as_of_iso is not None else
        present_history_for_team(db, ticker_team_id=ticker_team_id, n=1000, season_type=season_type)
    )
    season_games = [g for g in all_team_games if g["season"] == season]

    def _extract(game: dict) -> Optional[dict]:
        for g in game.get("goalies", []):
            if g.get("ticker_player_id") == ticker_player_id:
                if g.get("saves") is None or g.get("shots_against") is None:
                    return None
                return {
                    "played_at_iso": game["played_at_iso"],
                    "saves": int(g["saves"]),
                    "shots_against": int(g["shots_against"]),
                    "goals_against": int(g.get("goals_against") or 0),
                    "decision": g.get("decision"),
                    "starter": g.get("starter"),
                    "toi_seconds": g.get("toi_seconds"),
                    "save_pct": g["saves"] / g["shots_against"] if g["shots_against"] > 0 else None,
                }
        return None

    appearances = [a for a in (_extract(gm) for gm in season_games) if a is not None]

    def _agg(sub: list[dict]) -> dict:
        n = len(sub)
        if n == 0:
            return {"sample_size": 0, "save_pct": None, "gaa": None, "record": None}
        saves = sum(a["saves"] for a in sub)
        sa = sum(a["shots_against"] for a in sub)
        ga = sum(a["goals_against"] for a in sub)
        # TOI-derived GAA where possible; fall back to per-appearance approximation.
        toi_seconds = sum((a["toi_seconds"] or 0) for a in sub)
        if toi_seconds > 0:
            gaa = (ga * 60 * 60) / toi_seconds
        else:
            gaa = ga / n
        w = sum(1 for a in sub if a["decision"] == "W")
        l = sum(1 for a in sub if a["decision"] == "L")
        ot = sum(1 for a in sub if a["decision"] == "OT")
        return {
            "sample_size": n,
            "save_pct": round(saves / sa, 4) if sa > 0 else None,
            "gaa": round(gaa, 3),
            "record": {"w": w, "l": l, "otl": ot},
            "shots_against": sa,
            "saves": saves,
            "goals_against": ga,
        }

    windows: dict[str, dict] = {}
    windows["SEASON"] = {"window": "SEASON", "tier": WINDOW_TIER["SEASON"], **_agg(appearances)}
    for wkey, wn in (("L10", 10), ("L5", 5), ("L2", 2), ("L1", 1)):
        sub = appearances[:wn]
        agg = _agg(sub)
        if agg["sample_size"] < WINDOW_MIN_SAMPLE[wkey]:
            windows[wkey] = {
                "window": wkey, "tier": "insufficient_sample",
                "sample_size": agg["sample_size"],
                "min_sample_required": WINDOW_MIN_SAMPLE[wkey],
                "declared_tier_when_qualified": WINDOW_TIER[wkey],
                "save_pct": None, "gaa": None, "record": None,
            }
        else:
            windows[wkey] = {"window": wkey, "tier": WINDOW_TIER[wkey], **agg}

    return {
        "team_id": ticker_team_id,
        "player_id": ticker_player_id,
        "season": season,
        "season_type": season_type,
        "as_of_iso": as_of_iso,
        "windows": windows,
        "provenance": {
            "source": "intelligence.rolling_form.goalie_rolling_form on iq_game_finals.goalies (derived)",
            "notes": [
                "GAA uses TOI when available (from goalie line toi_seconds), otherwise "
                "GA per appearance as a fallback. Save% is always derived from counts "
                "(Foundation 1B correction #4).",
                "Only games in which the goalie has both saves and shots_against counted "
                "as an appearance. Backup cameos with no shots faced are excluded.",
            ],
        },
    }
