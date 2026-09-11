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


# --- Recommendation thresholds (v2) ------------------------------------
# Guiding principle: ROI is the trust signal. Win-rate is a corroborator
# / shape-indicator, never a first-class gate. This eliminates the two
# hard errors from the v1 stress test (profitable low-win-rate dog
# bettors incorrectly told to SKIP).
MIN_N_FOR_ROI_CALL       = 15    # min money bets for ROI-driven verdict
MIN_N_FOR_WINRATE_CALL   = 20    # min resolved bets for win-rate fallback
MIN_N_INSUFFICIENT       = 10    # below this → always insufficient / thin

LEAN_IN_ROI_STRONG       = 15.0  # ≥ this at n≥15 money bets → LEAN_IN
LEAN_IN_ROI_MODERATE     =  5.0  # ≥ this at n≥30 money bets → LEAN_IN
LEAN_IN_N_FOR_MODERATE   = 30

SKIP_ROI_STRONG          = -15.0 # ≤ this at n≥15 → SKIP
SKIP_ROI_MODERATE        =  -5.0 # ≤ this at n≥30 → SKIP
SKIP_N_FOR_MODERATE      = 30

CROSSED_WIN_RATE_HIGH    = 60.0  # 60%+ win rate + negative ROI → crossed SKIP
CROSSED_WIN_RATE_LOW     = 45.0  # ≤45% win rate + positive ROI → crossed LEAN_IN

# Win-rate-only fallback (used ONLY when money bets are too thin).
# Conservative bands so we don't claim edge from picks alone.
WINRATE_FALLBACK_LEAN_IN = 62.0
WINRATE_FALLBACK_SKIP    = 35.0

# Match hierarchy still uses this floor for widening.
MIN_N_FOR_CALL = MIN_N_INSUFFICIENT  # retained for _find_best_bucket()


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


# --- The decision function (v2) ----------------------------------------
# Returns (recommendation, reason_code). Recommendation is one of the
# three user-facing verdicts. reason_code is an internal shape label that
# drives Marc's language.
def _decide(summary: dict) -> tuple[str, str]:
    n         = summary["n"]
    resolved  = summary["resolved"]
    win_rate  = summary["win_rate_pct"]
    roi       = summary["roi_pct"]
    money_n   = summary["money_bet_count"]

    # -- Insufficient-sample protection (unchanged) --
    if n < MIN_N_INSUFFICIENT:
        return "NEUTRAL", "insufficient"

    # -- Primary path: ROI drives when money-bet sample is enough --
    if money_n >= MIN_N_FOR_ROI_CALL and roi is not None:
        # Strong positive → LEAN_IN
        if roi >= LEAN_IN_ROI_STRONG:
            # Crossed signal: profitable despite low win rate
            if win_rate is not None and win_rate <= CROSSED_WIN_RATE_LOW:
                return "LEAN_IN", "crossed_signal_positive"
            return "LEAN_IN", "roi_strong_positive"
        # Moderate positive on larger sample → LEAN_IN
        if roi >= LEAN_IN_ROI_MODERATE and money_n >= LEAN_IN_N_FOR_MODERATE:
            return "LEAN_IN", "roi_moderate_positive"
        # Strong negative → SKIP
        if roi <= SKIP_ROI_STRONG:
            if win_rate is not None and win_rate >= CROSSED_WIN_RATE_HIGH:
                return "SKIP", "crossed_signal_negative"
            return "SKIP", "roi_strong_negative"
        # Moderate negative on larger sample → SKIP
        if roi <= SKIP_ROI_MODERATE and money_n >= SKIP_N_FOR_MODERATE:
            return "SKIP", "roi_moderate_negative"
        # Between the bands but crossed shapes still warrant naming.
        # These slot into NEUTRAL but Marc calls out the shape.
        if win_rate is not None:
            if win_rate >= CROSSED_WIN_RATE_HIGH and roi < 0:
                return "NEUTRAL", "crossed_signal_flat_negative"
            if win_rate <= CROSSED_WIN_RATE_LOW and roi > 0:
                return "NEUTRAL", "crossed_signal_flat_positive"
        return "NEUTRAL", "flat_no_signal"

    # -- Win-rate-only fallback (prediction-only history or thin money) --
    # Conservative bands. Never claim edge from picks alone.
    if resolved >= MIN_N_FOR_WINRATE_CALL and win_rate is not None:
        if win_rate <= WINRATE_FALLBACK_SKIP:
            return "SKIP", "winrate_fallback_skip"
        if win_rate >= WINRATE_FALLBACK_LEAN_IN:
            return "LEAN_IN", "winrate_fallback_lean_in"
        return "NEUTRAL", "winrate_fallback_flat"

    # Have sample but neither ROI-driven nor win-rate-driven verdict fits.
    return "NEUTRAL", "thin_for_call"


# --- Marc's voice templates (v2) ---------------------------------------
# Marc is a veteran analyst. He helps you recognize your OWN tendencies.
# He never says "you should bet this" or "you have an edge." Personal
# historical performance ≠ market edge — without odds parsing + CLV we
# do not have evidence of edge, we have evidence of past outcomes.
# Templates are keyed on the internal reason_code from _decide().
def _marc_line(recommendation: str, reason: str, summary: dict, bucket_name: str, match_level: str) -> str:
    n         = summary["n"]
    wins      = summary["wins"]
    losses    = summary["losses"]
    win_rate  = summary["win_rate_pct"]
    roi       = summary["roi_pct"]
    profit    = summary["profit_loss"]
    money_n   = summary["money_bet_count"]

    def _record_snippet() -> str:
        rate_bit = f", {win_rate}%" if win_rate is not None else ""
        return f"{wins}\u2013{losses}{rate_bit}"

    def _roi_snippet() -> str:
        if roi is None or money_n < 5:
            return ""
        sign = "+" if profit >= 0 else ""
        return f", {sign}{roi}% ROI, {sign}${profit:.0f} over {money_n} money bets"

    # ---- INSUFFICIENT (n < 10) ----
    if reason == "insufficient":
        if n == 0:
            return ("You haven't logged bets like this yet. "
                    "Log a few and I'll have something worth telling you.")
        return (f"Small sample \u2014 you've got {n} bet{'s' if n != 1 else ''} on {bucket_name}. "
                "Don't convince yourself you've found something that isn't there yet. "
                "Log more of these before either of us calls it a pattern.")

    # ---- CROSSED SIGNAL — LEAN_IN flavor (low win rate + positive ROI) ----
    if reason == "crossed_signal_positive":
        return (f"This one's counterintuitive. You're {_record_snippet()} on {bucket_name} "
                f"\u2014 which looks bad on paper. But the wallet says otherwise{_roi_snippet()}. "
                f"When the underdogs cash in this spot, they cash big. "
                f"Your record looks bad; your bankroll doesn't. That's a green flag, not a green light "
                f"\u2014 it means your process here has been sound, not that tonight's price is right.")

    # ---- CROSSED SIGNAL — SKIP flavor (high win rate + negative ROI) ----
    if reason == "crossed_signal_negative":
        return (f"You're winning often here \u2014 {_record_snippet()} on {bucket_name} \u2014 "
                f"but you're still losing money{_roi_snippet()}. "
                f"The wins are cheap and the losses are expensive. "
                f"Winning often and making money aren't the same thing. "
                f"If tonight's number is short again, you're chasing the pattern that hurts you.")

    # ---- CROSSED SIGNAL FLAT — sits in NEUTRAL but Marc names the shape ----
    if reason == "crossed_signal_flat_negative":
        return (f"Tricky shape here. You're {_record_snippet()} on {bucket_name} \u2014 "
                f"but that record hasn't translated to profit{_roi_snippet()}. "
                f"Winning often isn't the same as making money. "
                f"Not enough of a gap yet to call it a bad spot, but be honest with yourself "
                f"about whether the price ever gives you enough.")

    if reason == "crossed_signal_flat_positive":
        return (f"Interesting shape. You're only {_record_snippet()} on {bucket_name}, "
                f"but you've made money on it{_roi_snippet()}. "
                f"The wins cash big when they cash. "
                f"Not enough sample to call it a strength yet, but there's something to keep watching.")

    # ---- LEAN_IN — strong positive ROI, ordinary win rate ----
    if reason == "roi_strong_positive":
        return (f"Historically, you've performed well in this spot. {_record_snippet()} on {bucket_name}"
                f"{_roi_snippet()}. That's your track record \u2014 not proof of a market edge. "
                f"It doesn't tell us whether tonight's price offers real value; that's a separate read. "
                f"But your process here has been sound. Look closer.")

    # ---- LEAN_IN — moderate positive on larger sample ----
    if reason == "roi_moderate_positive":
        n_bit = f"over {money_n} bets" if money_n else f"over {n} bets"
        return (f"You've quietly built something here. {_record_snippet()} {n_bit} on {bucket_name}"
                f"{_roi_snippet()}. {n_bit.capitalize()}, that's enough history to take the pattern "
                f"seriously. It still doesn't tell us whether tonight's line is good \u2014 "
                f"that's a separate read \u2014 but the track record is real, not variance.")

    # ---- SKIP — strong negative ROI ----
    if reason == "roi_strong_negative":
        return (f"You've struggled here. {_record_snippet()} on {bucket_name}{_roi_snippet()}. "
                f"Sample's big enough, hole's deep enough \u2014 that's not a slump, it's a pattern. "
                f"Passing tonight isn't quitting. It's a position. "
                f"You don't need action on every game to be a good bettor.")

    # ---- SKIP — moderate negative on larger sample ----
    if reason == "roi_moderate_negative":
        return (f"The evidence isn't loud, but it's consistent. {_record_snippet()} on {bucket_name} "
                f"over {money_n} money bets{_roi_snippet()}. "
                f"You're not getting blown out \u2014 you're steadily leaking. "
                f"Long-term, that's the harder pattern to catch. "
                f"Passing is a position.")

    # ---- Win-rate fallback (prediction-only history) ----
    if reason == "winrate_fallback_lean_in":
        return (f"On your picks alone \u2014 no money at risk \u2014 you've been {_record_snippet()} "
                f"on {bucket_name}. That's a strong personal record, but picks and priced bets "
                f"aren't the same game. Log a few with real stakes before we call it more than that.")

    if reason == "winrate_fallback_skip":
        return (f"On picks alone you're {_record_snippet()} on {bucket_name}. "
                f"That's a lot of misses. "
                f"Even without money on the line, that's your read of this spot missing more than hitting. "
                f"Not a great starting point for a real bet.")

    if reason == "winrate_fallback_flat":
        return (f"On picks alone you're {_record_snippet()} on {bucket_name}. "
                f"Sample's there, but no clear read either way. "
                f"Nothing to lean on, nothing to run from.")

    # ---- NEUTRAL — flat, no signal (large enough sample, mid range) ----
    if reason == "flat_no_signal":
        parts = [f"You've got {n} bets on {bucket_name}"]
        if win_rate is not None:
            parts.append(f"({wins}\u2013{losses}, {win_rate}%)")
        parts.append("\u2014 sample's there, but nothing sharp either way.")
        return " ".join(parts) + (
            " No edge to lean on, no reason to run from it. "
            "Bet it if the read is right; don't bet it if it isn't."
        )

    if reason == "thin_for_call":
        return (f"You've logged {n} bet{'s' if n != 1 else ''} on {bucket_name} "
                f"but only {money_n} with real stakes. "
                f"Sample's technically there, but the money-bet sample's still too thin for a call. "
                f"Play it by the read; let the log build.")

    # Fallback (should never hit)
    return "No read yet."


# --- Public entry point ------------------------------------------------
def spot_check(bets: list[dict], bet_type: str, home_or_away: str | None, fav_or_dog: str | None) -> dict[str, Any]:
    """Given a user's bet log + a proposed spot, return the recommendation + evidence.

    v2 contract:
    {
      "recommendation": "LEAN_IN" | "NEUTRAL" | "SKIP",
      "reason": internal shape label (drives Marc's language),
      "bucket": {...},
      "evidence": {...},
      "marc_line": "...",
      "headline": "LEAN IN" | "NEUTRAL" | "SKIP",
      "sub_headline": "...",
    }
    """
    label = bucket_label(bet_type, home_or_away, fav_or_dog)
    matching, match_level = _find_best_bucket(bets, bet_type, home_or_away, fav_or_dog)
    summary = _summarize(matching)
    rec, reason = _decide(summary)

    sub_headlines = {
        "LEAN_IN": "Historical data suggests this is one of your stronger situations.",
        "NEUTRAL": "You don't have enough evidence of an edge here yet.",
        "SKIP":    "Your history says this is a weak situation for you. Passing is a position.",
    }

    return {
        "recommendation": rec,
        "reason": reason,
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
        "marc_line": _marc_line(rec, reason, summary, label, match_level),
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
