"""
Betting IQ — Spot Check coach.

Vertical-slice implementation of the "Can we tell a bettor when NOT to bet?"
question. Given a user's existing bet log and a proposed spot
(bet_type + home/away + fav/dog), return one of:

    LEAN IN  — this is one of your stronger situations
    NEUTRAL  — insufficient evidence either way
    SKIP     — your history says this is a weak spot — passing is a position

Rules of this file:
- Deterministic templates ONLY. No LLM in this layer.
- Marc's voice: veteran analyst helping you recognize your OWN tendencies.
  Never touty. Never "manufacture action." Sometimes the right move is
  no move.
- Recommendation math is transparent — the /spot-check response includes
  the exact evidence bucket that fired.

Companion doc: /app/memory/BETTING_IQ_SPEC.md §4 (Skip recommendation)
Voice canon:   /app/memory/CHARACTER_STYLE_GUIDE.md §5.11 (Marcisms)
"""

from typing import Any


# --- Recommendation thresholds -----------------------------------------
# These are starting values chosen to feel right at small sample sizes.
# Tune once we have real 5-10 bettor data.
MIN_N_FOR_CALL = 10           # below this → NEUTRAL / insufficient
LEAN_IN_MIN_WIN_RATE = 55.0   # win-rate % gate for LEAN IN
LEAN_IN_MIN_ROI      = 10.0   # ROI % gate for LEAN IN (money bets)
SKIP_MAX_WIN_RATE    = 40.0   # win-rate % gate for SKIP
SKIP_MIN_LOSS_ROI    = -10.0  # ROI % (negative) gate for SKIP


# --- Human names for spot buckets --------------------------------------
def bucket_label(bet_type: str, home_or_away: str | None, fav_or_dog: str | None) -> str:
    bt = (bet_type or "").lower().strip()
    ha = (home_or_away or "").lower().strip() or None
    fd = (fav_or_dog or "").lower().strip() or None

    if bt == "moneyline":
        if fd == "fav" and ha == "home":  return "home favourites"
        if fd == "fav" and ha == "away":  return "road favourites"
        if fd == "dog" and ha == "home":  return "home dogs"
        if fd == "dog" and ha == "away":  return "road dogs"
        if fd == "fav":                   return "favourites (moneyline)"
        if fd == "dog":                   return "dogs (moneyline)"
        return "moneyline plays"

    if bt == "spread":
        if fd == "fav": return "puck-line favourites"
        if fd == "dog": return "puck-line dogs"
        return "puck-line plays"

    if bt == "total":
        # For totals we reuse fav/dog as "over"/"under" (client passes it that way)
        if fd == "over":  return "overs"
        if fd == "under": return "unders"
        return "totals"

    if bt in ("prop", "shots", "saves", "first-goal"):
        return f"{bt.replace('-', ' ')} bets"

    return "this spot"


# --- Match a bucket against the user's bet log -------------------------
def _matches(bet: dict, bet_type: str, home_or_away: str | None, fav_or_dog: str | None) -> bool:
    if (bet.get("bet_type") or "").lower() != bet_type.lower():
        return False
    if home_or_away and (bet.get("home_or_away") or "").lower() != home_or_away.lower():
        return False
    if fav_or_dog and (bet.get("fav_or_dog") or "").lower() != fav_or_dog.lower():
        return False
    return True


def _summarize(matching: list[dict]) -> dict:
    """Compute the numbers we'll show as evidence + drive the recommendation."""
    n = len(matching)
    resolved = [b for b in matching if (b.get("result") or "pending").lower() in ("win", "loss", "push")]
    wins   = sum(1 for b in resolved if b["result"].lower() == "win")
    losses = sum(1 for b in resolved if b["result"].lower() == "loss")
    pushes = sum(1 for b in resolved if b["result"].lower() == "push")
    graded = wins + losses  # pushes don't count either way
    win_rate_pct = round(100 * wins / graded, 1) if graded else None

    money = [b for b in resolved if not b.get("prediction_only")]
    total_stake = sum(float(b.get("stake") or 0.0) for b in money)
    total_pl    = sum(float(b.get("profit_loss") or 0.0) for b in money)
    roi_pct     = round(100 * total_pl / total_stake, 1) if total_stake > 0 else None

    return {
        "n": n,
        "resolved": len(resolved),
        "wins": wins,
        "losses": losses,
        "pushes": pushes,
        "win_rate_pct": win_rate_pct,
        "roi_pct": roi_pct,
        "profit_loss": round(total_pl, 2),
        "stake_total": round(total_stake, 2),
        "money_bet_count": len(money),
    }


# --- Match hierarchy: try tight first, widen if not enough sample ------
def _find_best_bucket(bets: list[dict], bet_type: str, home_or_away: str | None, fav_or_dog: str | None):
    """Returns (matching_bets, match_level).
    match_level ∈ {'exact', 'bet_type+fav_dog', 'bet_type+home_away', 'bet_type', 'none'}
    Highest specificity that clears MIN_N_FOR_CALL wins.
    """
    tiers = [
        ("exact",              bet_type, home_or_away, fav_or_dog),
        ("bet_type+fav_dog",   bet_type, None,         fav_or_dog),
        ("bet_type+home_away", bet_type, home_or_away, None),
        ("bet_type",           bet_type, None,         None),
    ]
    for level, bt, ha, fd in tiers:
        if not bt:
            continue
        m = [b for b in bets if _matches(b, bt, ha, fd)]
        if len(m) >= MIN_N_FOR_CALL:
            return m, level
    # Nothing hit sample threshold — return the exact-tier matches (may be empty)
    exact_matches = [b for b in bets if _matches(b, bet_type, home_or_away, fav_or_dog)]
    return exact_matches, "none"


# --- The decision function ---------------------------------------------
def _decide(summary: dict) -> str:
    n         = summary["n"]
    win_rate  = summary["win_rate_pct"]
    roi       = summary["roi_pct"]

    if n < MIN_N_FOR_CALL:
        return "NEUTRAL"

    # SKIP if the losing evidence is clear on either dimension
    if (win_rate is not None and win_rate <= SKIP_MAX_WIN_RATE):
        return "SKIP"
    if (roi is not None and roi <= SKIP_MIN_LOSS_ROI):
        return "SKIP"

    # LEAN IN needs BOTH win-rate and (if we have money bets) ROI to clear
    if (win_rate is not None and win_rate >= LEAN_IN_MIN_WIN_RATE):
        if roi is None or roi >= LEAN_IN_MIN_ROI:
            return "LEAN_IN"

    return "NEUTRAL"


# --- Marc's voice templates --------------------------------------------
# Marc is a veteran analyst. He helps you recognize your OWN tendencies.
# He never says "you should bet this" or "great value tonight." Sometimes
# the right move is no move. When numbers are big enough to matter, he
# tells you. When they aren't, he says so.
def _marc_line(recommendation: str, summary: dict, bucket_name: str, match_level: str) -> str:
    n         = summary["n"]
    wins      = summary["wins"]
    losses    = summary["losses"]
    win_rate  = summary["win_rate_pct"]
    roi       = summary["roi_pct"]
    profit    = summary["profit_loss"]
    money_n   = summary["money_bet_count"]

    # Insufficient sample gets Marc's "small sample" register — spec §7 canon.
    if recommendation == "NEUTRAL" and n < MIN_N_FOR_CALL:
        if n == 0:
            return (
                "You haven't logged bets like this yet. "
                "Log a few and I'll have something worth telling you."
            )
        return (
            f"Small sample — you've got {n} bet{'s' if n != 1 else ''} on {bucket_name}. "
            "Don't convince yourself you've found something that isn't there yet. "
            "Log more of these before either of us calls it a pattern."
        )

    # NEUTRAL with enough sample — sample is real but the numbers don't clearly point either way
    if recommendation == "NEUTRAL":
        parts = [f"You've got {n} bets on {bucket_name}"]
        if win_rate is not None:
            parts.append(f"({wins}–{losses}, {win_rate}%)")
        parts.append("— sample's there, but nothing sharp either way.")
        return " ".join(parts) + " No edge to lean on, no reason to run from it. Bet it if the read is right; don't bet it if it isn't."

    if recommendation == "SKIP":
        # Choose the phrasing that matches WHY it fired
        lead = f"You've struggled with {bucket_name}."
        record = f"You're {wins}–{losses} in this spot"
        rate_bit = f" — {win_rate}%" if win_rate is not None else ""
        roi_bit = ""
        if roi is not None and money_n >= 5:
            sign = "+" if profit >= 0 else ""
            roi_bit = f" · {sign}{roi}% ROI, {sign}${profit:.0f} P/L over {money_n} money bets"

        # Rotate closer based on match specificity — more specific match → more definitive close
        if match_level == "exact":
            closer = "Passing is a position. You don't need action on every game."
        elif match_level in ("bet_type+fav_dog", "bet_type+home_away"):
            closer = "The pattern's clear enough. Leave it alone tonight."
        else:
            closer = "The tape's telling you something. Don't force it."

        return f"{lead} {record}{rate_bit}{roi_bit}. {closer}"

    if recommendation == "LEAN_IN":
        lead = f"{bucket_name.capitalize()} has actually been one of your better spots."
        record = f"{wins}–{losses}"
        rate_bit = f" ({win_rate}%)" if win_rate is not None else ""
        roi_bit = ""
        if roi is not None and money_n >= 5:
            sign = "+" if roi >= 0 else ""
            roi_bit = f", {sign}{roi}% ROI"

        closer = (
            "Doesn't guarantee tonight — but you've earned the right to look closer. "
            "Now find the shot worth taking."
        )
        return f"{lead} {record}{rate_bit}{roi_bit} on {bucket_name}. {closer}"

    return "No read yet."


# --- Public entry point ------------------------------------------------
def spot_check(bets: list[dict], bet_type: str, home_or_away: str | None, fav_or_dog: str | None) -> dict[str, Any]:
    """Given a user's bet log + a proposed spot, return the recommendation + evidence.

    Response contract (frontend depends on this shape):
    {
      "recommendation": "LEAN_IN" | "NEUTRAL" | "SKIP",
      "bucket": {
         "label": "road favourites",
         "bet_type": "moneyline",
         "home_or_away": "away",
         "fav_or_dog": "fav",
         "match_level": "exact" | "bet_type+fav_dog" | "bet_type+home_away" | "bet_type" | "none",
      },
      "evidence": { n, resolved, wins, losses, pushes, win_rate_pct, roi_pct, profit_loss, stake_total, money_bet_count },
      "marc_line": "You've struggled with road favourites…",
      "headline": "SKIP",
      "sub_headline": "Your history says this is a weak situation for you. Passing is a position."
    }
    """
    label = bucket_label(bet_type, home_or_away, fav_or_dog)
    matching, match_level = _find_best_bucket(bets, bet_type, home_or_away, fav_or_dog)
    summary = _summarize(matching)
    rec = _decide(summary)

    sub_headlines = {
        "LEAN_IN": "Historical data suggests this is one of your stronger situations.",
        "NEUTRAL": "You don't have enough evidence of an edge here yet.",
        "SKIP":    "Your history says this is a weak situation for you. Passing is a position.",
    }

    return {
        "recommendation": rec,
        "headline": rec.replace("_", " "),
        "sub_headline": sub_headlines[rec],
        "bucket": {
            "label": label,
            "bet_type": bet_type,
            "home_or_away": home_or_away,
            "fav_or_dog": fav_or_dog,
            "match_level": match_level,
        },
        "evidence": summary,
        "marc_line": _marc_line(rec, summary, label, match_level),
    }


# --- Seed data for dev testing -----------------------------------------
# One realistic-looking bet log for a single test bettor. The distribution
# is intentionally uneven so Spot Check has clear LEAN IN / SKIP / NEUTRAL
# results across at least three different bucket queries.
def build_seed_bets(device_id: str) -> list[dict]:
    """~60 historical bets for a single test bettor.

    Designed so:
    - moneyline / away / fav       →  SKIP    (bad spot: 5-13, -$420, -35% ROI)
    - moneyline / home / dog       →  LEAN_IN (best spot: 13-4, +$240, +25% ROI)
    - moneyline / home / fav       →  NEUTRAL (real sample but middling: 9-8, ~0% ROI)
    - total     / over             →  SKIP    (18 bets, 6-12, -20% ROI)
    - total     / under            →  LEAN_IN (10 bets, 7-3, +18% ROI)
    - prop                         →  NEUTRAL insufficient (< 10 bets)
    """
    from datetime import datetime, timedelta
    import uuid
    seeds = []

    def add(day_offset, matchup, bet_type, selection, home_or_away, fav_or_dog,
            odds, stake, result, profit_loss, notes="", prediction_only=False):
        dt = (datetime.now() - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        seeds.append({
            "id": str(uuid.uuid4()),
            "device_id": device_id,
            "bet_date": dt,
            "matchup": matchup,
            "bet_type": bet_type,
            "selection": selection,
            "home_or_away": home_or_away,
            "fav_or_dog": fav_or_dog,
            "odds": odds,
            "stake": stake,
            "prediction_only": prediction_only,
            "result": result,
            "profit_loss": profit_loss,
            "notes": notes,
            "created_at": (datetime.now() - timedelta(days=day_offset)).isoformat(),
        })

    # --- SKIP spot: road favourites on moneyline (5W-13L) ---
    road_fav_slate = [
        ("BOS @ MTL", "BOS ML", "-140", 100, "loss", -100),
        ("TOR @ OTT", "TOR ML", "-135", 100, "loss", -100),
        ("EDM @ CGY", "EDM ML", "-155", 100, "win",   64),
        ("COL @ ARI", "COL ML", "-170", 100, "loss", -100),
        ("NYR @ NJD", "NYR ML", "-130", 100, "loss", -100),
        ("VGK @ SJS", "VGK ML", "-180", 100, "win",   56),
        ("FLA @ TBL", "FLA ML", "-145", 100, "loss", -100),
        ("PIT @ PHI", "PIT ML", "-125", 100, "loss", -100),
        ("MIN @ CHI", "MIN ML", "-135", 100, "win",   74),
        ("DAL @ STL", "DAL ML", "-150", 100, "loss", -100),
        ("CAR @ BUF", "CAR ML", "-165", 100, "loss", -100),
        ("LAK @ ANA", "LAK ML", "-155", 100, "win",   64),
        ("WPG @ CBJ", "WPG ML", "-140", 100, "loss", -100),
        ("SEA @ VAN", "SEA ML", "-115", 100, "loss", -100),
        ("NSH @ DET", "NSH ML", "-120", 100, "win",   83),
        ("WSH @ NYI", "WSH ML", "-130", 100, "loss", -100),
        ("WSH @ NYR", "WSH ML", "-125", 100, "loss", -100),
        ("BOS @ TBL", "BOS ML", "-140", 100, "loss", -100),
    ]
    for i, (m, s, o, st, r, pl) in enumerate(road_fav_slate):
        add(120 - i * 4, m, "moneyline", s, "away", "fav", o, st, r, pl)

    # --- LEAN_IN spot: home dogs on moneyline (13W-4L) ---
    home_dog_slate = [
        ("BOS @ MTL", "MTL ML", "+150", 100, "win",  150),
        ("TOR @ OTT", "OTT ML", "+145", 100, "win",  145),
        ("EDM @ CGY", "CGY ML", "+160", 100, "loss", -100),
        ("COL @ ARI", "ARI ML", "+175", 100, "win",  175),
        ("NYR @ NJD", "NJD ML", "+135", 100, "win",  135),
        ("VGK @ SJS", "SJS ML", "+180", 100, "loss", -100),
        ("FLA @ TBL", "TBL ML", "+140", 100, "win",  140),
        ("PIT @ PHI", "PHI ML", "+125", 100, "win",  125),
        ("MIN @ CHI", "CHI ML", "+140", 100, "loss", -100),
        ("DAL @ STL", "STL ML", "+145", 100, "win",  145),
        ("CAR @ BUF", "BUF ML", "+160", 100, "win",  160),
        ("LAK @ ANA", "ANA ML", "+155", 100, "win",  155),
        ("WPG @ CBJ", "CBJ ML", "+135", 100, "win",  135),
        ("SEA @ VAN", "VAN ML", "+120", 100, "win",  120),
        ("NSH @ DET", "DET ML", "+125", 100, "loss", -100),
        ("WSH @ NYI", "NYI ML", "+130", 100, "win",  130),
        ("BOS @ TBL", "TBL ML", "+135", 100, "win",  135),
    ]
    for i, (m, s, o, st, r, pl) in enumerate(home_dog_slate):
        add(115 - i * 4, m, "moneyline", s, "home", "dog", o, st, r, pl)

    # --- NEUTRAL spot: home favourites on moneyline (9W-8L) ---
    home_fav_slate = [
        ("BOS @ MTL", "MTL ML", "-135", 100, "win",   74),
        ("TOR @ OTT", "OTT ML", "-145", 100, "loss", -100),
        ("EDM @ CGY", "CGY ML", "-155", 100, "win",   64),
        ("COL @ ARI", "ARI ML", "-165", 100, "loss", -100),
        ("NYR @ NJD", "NJD ML", "-140", 100, "win",   71),
        ("VGK @ SJS", "SJS ML", "-125", 100, "loss", -100),
        ("FLA @ TBL", "TBL ML", "-150", 100, "win",   66),
        ("PIT @ PHI", "PHI ML", "-135", 100, "loss", -100),
        ("MIN @ CHI", "CHI ML", "-130", 100, "win",   77),
        ("DAL @ STL", "STL ML", "-140", 100, "loss", -100),
        ("CAR @ BUF", "BUF ML", "-160", 100, "win",   62),
        ("LAK @ ANA", "ANA ML", "-155", 100, "loss", -100),
        ("WPG @ CBJ", "CBJ ML", "-125", 100, "win",   80),
        ("SEA @ VAN", "VAN ML", "-115", 100, "loss", -100),
        ("NSH @ DET", "DET ML", "-135", 100, "win",   74),
        ("WSH @ NYI", "NYI ML", "-140", 100, "loss", -100),
        ("BOS @ TBL", "TBL ML", "-130", 100, "win",   77),
    ]
    for i, (m, s, o, st, r, pl) in enumerate(home_fav_slate):
        add(110 - i * 4, m, "moneyline", s, "home", "fav", o, st, r, pl)

    # --- SKIP spot: overs (6W-12L, -20% ROI) ---
    overs_slate = [
        ("BOS @ MTL", "Over 6.5", "-110", 110, "loss", -110),
        ("TOR @ OTT", "Over 6.0", "-105", 105, "win",  100),
        ("EDM @ CGY", "Over 6.5", "-115", 115, "loss", -115),
        ("COL @ ARI", "Over 6.0", "-110", 110, "loss", -110),
        ("NYR @ NJD", "Over 5.5", "-125", 125, "win",  100),
        ("VGK @ SJS", "Over 6.5", "-105", 105, "loss", -105),
        ("FLA @ TBL", "Over 6.0", "-110", 110, "loss", -110),
        ("PIT @ PHI", "Over 6.5", "-115", 115, "loss", -115),
        ("MIN @ CHI", "Over 6.0", "-110", 110, "win",  100),
        ("DAL @ STL", "Over 6.5", "-105", 105, "loss", -105),
        ("CAR @ BUF", "Over 6.0", "-110", 110, "loss", -110),
        ("LAK @ ANA", "Over 6.5", "-115", 115, "win",  100),
        ("WPG @ CBJ", "Over 6.0", "-110", 110, "loss", -110),
        ("SEA @ VAN", "Over 6.5", "-105", 105, "win",  100),
        ("NSH @ DET", "Over 6.0", "-110", 110, "loss", -110),
        ("WSH @ NYI", "Over 6.5", "-115", 115, "loss", -115),
        ("BOS @ TBL", "Over 6.0", "-110", 110, "win",  100),
        ("EDM @ COL", "Over 6.5", "-105", 105, "loss", -105),
    ]
    for i, (m, s, o, st, r, pl) in enumerate(overs_slate):
        add(90 - i * 3, m, "total", s, None, "over", o, st, r, pl)

    # --- LEAN_IN spot: unders (7W-3L, +18% ROI) ---
    unders_slate = [
        ("BOS @ MTL", "Under 6.0", "-105", 105, "win",  100),
        ("TOR @ OTT", "Under 6.5", "-110", 110, "win",  100),
        ("EDM @ CGY", "Under 6.0", "-115", 115, "loss", -115),
        ("COL @ ARI", "Under 6.5", "-105", 105, "win",  100),
        ("NYR @ NJD", "Under 5.5", "-125", 125, "win",  100),
        ("VGK @ SJS", "Under 6.0", "-110", 110, "loss", -110),
        ("FLA @ TBL", "Under 6.5", "-115", 115, "win",  100),
        ("PIT @ PHI", "Under 6.0", "-105", 105, "win",  100),
        ("MIN @ CHI", "Under 6.5", "-110", 110, "loss", -110),
        ("DAL @ STL", "Under 6.0", "-115", 115, "win",  100),
    ]
    for i, (m, s, o, st, r, pl) in enumerate(unders_slate):
        add(60 - i * 3, m, "total", s, None, "under", o, st, r, pl)

    # --- Insufficient sample: 6 prop bets (< MIN_N_FOR_CALL of 10) ---
    prop_slate = [
        ("MTL vs BOS", "Suzuki Over 0.5 goals", "+130", 50, "loss", -50),
        ("EDM vs COL", "McDavid Over 4.5 shots", "-115", 50, "win",  43),
        ("TOR vs OTT", "Matthews Over 1.5 pts", "+110", 50, "win",   55),
        ("NYR vs NJD", "Panarin Over 3.5 shots", "-105", 50, "loss", -50),
        ("VGK vs SJS", "Eichel Over 1.5 pts",   "+125", 50, "loss", -50),
        ("FLA vs TBL", "Kucherov Over 1.5 pts", "-110", 50, "win",   45),
    ]
    for i, (m, s, o, st, r, pl) in enumerate(prop_slate):
        add(30 - i * 3, m, "prop", s, None, None, o, st, r, pl)

    return seeds
