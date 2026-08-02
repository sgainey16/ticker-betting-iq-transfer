"""Game Story + Game Control Score — The Ticker's signature "translate data
into meaning" layer. Consumes Highlightly's box-score payload (already
normalized by `highlightly.get_match_stats`) and returns:

    - `derived` — Ticker Model estimates of Expected Goals & High-Danger
      Chances (Highlightly doesn't publish these; we compute proxies).
    - `control` — Game Control Score /100 (zero-sum). A single number
      that summarizes who ran the game, weighted across xG, scoring
      chances, high-danger chances, possession, special teams and
      goaltending.
    - `story`  — Objective plain-English bullets ("Why X Lost" style) plus
      a lead sentence Reggie & Marc can open the recap with.

Design notes
------------
* All numbers are deterministic — same inputs, same outputs. No LLMs in
  this path. The recap needs to be defensible.
* Proxy formulas are tuned to hockey averages (~9% shot conversion,
  ~20% PP conversion). They land in believable NHL-range values.
* Bullets are template-driven with thresholds — a stat only earns a
  bullet if the delta is *meaningful* (not fluff). Max 5 bullets so the
  story stays scannable in seconds.
"""
from __future__ import annotations

from typing import Any


# -- Weightings for Game Control Score (must sum to 1.0) ----------------
# User-specified pillars. These map to observable box-score signals via
# `_component_share` below.
_WEIGHTS = {
    "xg":            0.25,  # Expected Goals (derived)
    "scoring":       0.15,  # Scoring Chances (SoG + Opp Blocks)
    "high_danger":   0.20,  # High-Danger Chances (derived)
    "possession":    0.10,  # Shots-on-goal share
    "special_teams": 0.15,  # PP goals + PK success
    "goaltending":   0.15,  # Save % (of what got through)
}


def _n(v: Any, default: float = 0.0) -> float:
    """Coerce a Highlightly stat value to float, tolerating None/strings."""
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _derive_team(own: dict, opp: dict) -> dict:
    """Compute Ticker Model derived metrics for one team.

    xG proxy    = 0.085 * SoG + 0.25 * PP_Opps
                  (league conversion + PP boost)
    HDC proxy   = round(0.30 * SoG + 1.2 * PP_Opps - 0.15 * Blocked_own)
                  (denser action = more high-danger; own-team blocks
                  drop it slightly because those were the chances we
                  denied at the shot-block level).
    Chances     = SoG + Opp Blocked Shots (attempts on net)
    Saves       = Opp SoG - Own Goals Against
    Sv %        = Saves / Opp SoG
    """
    shots     = _n(own.get("Shots"))
    pp_opps   = _n(own.get("Power Play Opportunities"))
    pp_goals  = _n(own.get("Power Play Goals"))
    blocks    = _n(own.get("Blocked Shots"))
    opp_shots = _n(opp.get("Shots"))
    opp_blocks = _n(opp.get("Blocked Shots"))
    opp_goals = _n(opp.get("Goals"), _n(opp.get("Total Goals")))

    xg  = round(0.085 * shots + 0.25 * pp_opps, 1)
    hdc = max(0, round(0.30 * shots + 1.2 * pp_opps - 0.15 * blocks))
    chances = int(shots + opp_blocks)
    saves = max(0, opp_shots - opp_goals)
    sv_pct = (saves / opp_shots) if opp_shots > 0 else 0.0

    return {
        "xg": xg,
        "hdc": int(hdc),
        "scoring_chances": chances,
        "shots": int(shots),
        "pp_goals": int(pp_goals),
        "pp_opps": int(pp_opps),
        "saves": int(saves),
        "sv_pct": round(sv_pct, 3),
    }


def _share(a: float, b: float) -> float:
    """Team A's share of a zero-sum pillar (0-1). Falls back to 0.5 when
    both sides are zero (no data → treat as even)."""
    total = a + b
    if total <= 0:
        return 0.5
    return a / total


def _component_share(home: dict, away: dict) -> dict:
    """Six pillar shares — home team's slice of each. away = 1 - home."""
    return {
        "xg":            _share(home["xg"],              away["xg"]),
        "scoring":       _share(home["scoring_chances"], away["scoring_chances"]),
        "high_danger":   _share(home["hdc"],             away["hdc"]),
        "possession":    _share(home["shots"],           away["shots"]),
        # Special teams: PP goals matter most. Add 0.5 pseudo-count so a
        # 0-0 PP night lands at 50/50 rather than exploding on a 1-0 fluke.
        "special_teams": _share(home["pp_goals"] + 0.5,  away["pp_goals"] + 0.5),
        # Goaltending: whichever keeper stopped a higher % of what they
        # faced controlled the game defensively.
        "goaltending":   _share(home["sv_pct"],          away["sv_pct"]),
    }


def _control_score(home_derived: dict, away_derived: dict) -> dict:
    """Weighted sum → home & away Game Control Score /100 (zero-sum)."""
    shares = _component_share(home_derived, away_derived)
    home_control = sum(shares[k] * _WEIGHTS[k] for k in _WEIGHTS) * 100
    home_control = round(home_control)
    return {
        "home": home_control,
        "away": 100 - home_control,
        "components": {  # exposed for a future "how it's calculated" drawer
            k: {"home": round(shares[k] * 100), "away": round((1 - shares[k]) * 100)}
            for k in _WEIGHTS
        },
    }


# -- Story bullets ------------------------------------------------------
# Threshold-driven. Each rule inspects the delta and emits a bullet only
# if the gap is meaningful. Bullets are ordered by importance and capped
# at 5 so the story reads in seconds.

def _possessive(name: str) -> str:
    """Grammatical possessive — 'Capitals' vs 'Reggie's'. Team names ending
    in s get just an apostrophe, everything else gets 's."""
    if not name:
        return name
    return f"{name}'" if name.endswith("s") else f"{name}'s"


def _sv_display(sv_pct: float) -> str:
    """Hockey convention: .923 style. A perfect night (1.000) shows
    'a perfect night' rather than the weird .1000 rendering."""
    if sv_pct >= 0.999:
        return "a perfect night"
    return f".{int(round(sv_pct * 1000)):03d} save rate"


def _story_bullets(win: dict, lose: dict, win_derived: dict, lose_derived: dict,
                   win_code: str, lose_code: str) -> list[str]:
    bullets: list[str] = []

    # 1. Scoring chances — the headline "quality" metric.
    ch_diff = win_derived["scoring_chances"] - lose_derived["scoring_chances"]
    if abs(ch_diff) >= 5:
        if ch_diff > 0:
            bullets.append(f"{win_code} generated +{ch_diff} scoring chances.")
        else:
            bullets.append(
                f"{lose_code} outchanced {win_code} {lose_derived['scoring_chances']}–"
                f"{win_derived['scoring_chances']} but lost the finish."
            )

    # 2. Giveaways — self-inflicted damage. Highlightly key: "Giveaways".
    give_lose = int(_n(lose.get("Giveaways")))
    if give_lose >= 15:
        bullets.append(f"{lose_code} committed {give_lose} giveaways.")

    # 3. Power play story.
    win_pp_g   = win_derived["pp_goals"];   win_pp_o  = win_derived["pp_opps"]
    lose_pp_g  = lose_derived["pp_goals"];  lose_pp_o = lose_derived["pp_opps"]
    if win_pp_g == 0 and lose_pp_g == 0 and (win_pp_o + lose_pp_o) >= 2:
        bullets.append("Both power plays were scoreless.")
    elif win_pp_g > lose_pp_g:
        bullets.append(f"{win_code} converted {win_pp_g}/{win_pp_o} on the power play.")
    elif lose_pp_g > win_pp_g and win_pp_o > 0:
        bullets.append(
            f"{_possessive(lose_code)} power play cashed {lose_pp_g}/{lose_pp_o} — {win_code} still won at even strength."
        )

    # 4. High-Danger battle — the Ticker signature line.
    hdc_diff = win_derived["hdc"] - lose_derived["hdc"]
    if abs(hdc_diff) >= 3:
        if hdc_diff > 0:
            bullets.append(
                f"{win_code} won the quality chance battle {win_derived['hdc']}–{lose_derived['hdc']}."
            )
        else:
            bullets.append(
                f"{win_code} were outchanced in high-danger but the goaltending held."
            )

    # 5. Goaltending framing.
    win_sv = win_derived["sv_pct"]
    lose_sv = lose_derived["sv_pct"]
    if win_sv and lose_sv:
        gap = abs(win_sv - lose_sv)
        if gap <= 0.010:
            bullets.append("Goaltending was nearly even.")
        elif win_sv > lose_sv:
            bullets.append(
                f"{_possessive(win_code)} netminder was the difference — {_sv_display(win_sv)}."
            )
        else:
            bullets.append(
                f"{lose_code} got the better goaltending but the shot volume caught up."
            )

    # Cap at 5 for scannability.
    return bullets[:5]


def _lead_sentence(win_code: str, lose_code: str,
                   win_derived: dict, lose_derived: dict,
                   control_home: int, is_home_winner: bool) -> str:
    """One-line opener Reggie & Marc can literally read on air. Honest
    about "stolen" wins — if the winner's Game Control Score is under 50,
    we don't pretend they ran the game."""
    win_control = control_home if is_home_winner else 100 - control_home
    shot_gap = win_derived["shots"] - lose_derived["shots"]

    # Stolen win — winner got outplayed on control (typically goaltending
    # or one hot line). Own it in the lead.
    if win_control < 50:
        gap = 50 - win_control
        if gap >= 5:
            return (
                f"{win_code} stole this one — {lose_code} played the better hockey "
                f"but couldn't beat the goalie."
            )
        return f"{win_code} found a way — the run of play was nearly even."

    # Blowout in control.
    if win_control >= 62:
        return f"{win_code} controlled this game — the numbers weren't close."
    # Won despite being outshot.
    if shot_gap < 0:
        return (
            f"{win_code} controlled this game despite being outshot "
            f"{lose_derived['shots']}–{win_derived['shots']}."
        )
    # Won with a small shot edge.
    if 0 < shot_gap <= 5:
        return (
            f"{win_code} controlled this game despite only outshooting "
            f"{lose_code} by {shot_gap}."
        )
    # Standard win — outshot and outplayed.
    return f"{win_code} controlled this game — outshooting {lose_code} {win_derived['shots']}–{lose_derived['shots']}."


def compute_game_story(stats_payload: dict) -> dict:
    """Main entry. Consumes the payload from `highlightly.get_match_stats`
    and returns the full derived + control + story bundle. Safe on empty
    inputs (returns `{"ready": False}`)."""
    home_block = (stats_payload or {}).get("home") or {}
    away_block = (stats_payload or {}).get("away") or {}
    home = home_block.get("stats") or {}
    away = away_block.get("stats") or {}
    if not home or not away:
        return {"ready": False}

    # Highlightly doesn't include a "Goals" key on the stats block, so
    # pull the score off the state.
    score = (stats_payload.get("score") or {}).get("current") or ""
    # `current` looks like "3 - 2" (away - home per Highlightly convention).
    away_goals = home_goals = 0
    try:
        parts = [p.strip() for p in str(score).split("-")]
        if len(parts) == 2:
            away_goals, home_goals = int(parts[0]), int(parts[1])
    except (ValueError, TypeError):
        pass
    home["Goals"] = home_goals
    away["Goals"] = away_goals

    home_derived = _derive_team(home, away)
    away_derived = _derive_team(away, home)
    control = _control_score(home_derived, away_derived)

    home_code = (home_block.get("team") or {}).get("shortName") or (home_block.get("team") or {}).get("name") or "HOME"
    away_code = (away_block.get("team") or {}).get("shortName") or (away_block.get("team") or {}).get("name") or "AWAY"

    # Winner = higher goal total. If tied (should be rare post-game), fall
    # back to whichever side has the higher Game Control Score.
    if home_goals != away_goals:
        is_home_winner = home_goals > away_goals
    else:
        is_home_winner = control["home"] >= control["away"]

    if is_home_winner:
        win_code, lose_code = home_code, away_code
        win_derived, lose_derived = home_derived, away_derived
        win_raw, lose_raw = home, away
    else:
        win_code, lose_code = away_code, home_code
        win_derived, lose_derived = away_derived, home_derived
        win_raw, lose_raw = away, home

    lead = _lead_sentence(win_code, lose_code, win_derived, lose_derived,
                          control["home"], is_home_winner)
    bullets = _story_bullets(win_raw, lose_raw, win_derived, lose_derived,
                             win_code, lose_code)

    return {
        "ready": True,
        "control": control,
        "derived": {"home": home_derived, "away": away_derived},
        "story": {
            "winner_code": win_code,
            "loser_code": lose_code,
            "headline": f"Why {lose_code} Lost",
            "lead": lead,
            "bullets": bullets,
        },
    }
