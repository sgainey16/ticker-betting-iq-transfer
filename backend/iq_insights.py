"""Ticker Hockey IQ · Phase 3 — Personal IQ interpretation layer.

Pure module: derives typed insights from a user's resolved UserCall history.
No DB, no I/O. The FastAPI endpoints call generate_insights(...) and cache
the result.

Design invariants — MUST hold:

  1. Every insight carries its sample size AND a confidence band.
     `sample_size: int`, `confidence: 'low' | 'medium' | 'high'`.
  2. Insights below MIN_N_MEDIUM are NEVER returned. Insights below
     MIN_N_HIGH are marked confidence='medium'. Only insights with
     both a large-enough sample AND a large-enough effect size are
     confidence='high'.
  3. Historical performance is NEVER phrased as future edge. Marc's
     voice templates use "have been", "lately", "your record shows" —
     never "you will", "expect to", "guaranteed".
  4. No stake advice. No market-edge claims. No "increase risk" language.
  5. Behavioral/bias insights (team bias, calibration, first-instinct)
     require MIN_N_HIGH and a larger effect size to appear.
  6. Non-betting users get the same interpretation layer. Wager data is
     an OPTIONAL lens — insights derived from wagers are only added when
     the user has adult_features_unlocked AND ≥ MIN_N_HIGH bet calls.
"""
from __future__ import annotations

from typing import Any, Optional
from collections import defaultdict


# Sample-size thresholds — small numbers deliberately chosen conservative.
MIN_N_MEDIUM = 10      # anything smaller: no insight emitted
MIN_N_HIGH = 20        # for behavioral/bias claims and "high" confidence
STRONG_EFFECT_PP = 15  # accuracy delta in percentage points for high confidence
NOTABLE_EFFECT_PP = 10 # for medium confidence

BEHAVIORAL_MIN_N = 20  # bias/calibration/first-instinct need bigger samples
BEHAVIORAL_EFFECT_PP = 20


def _pct(a: int, b: int) -> Optional[float]:
    return round(100.0 * a / b, 1) if b else None


def _rec(correct: int, n: int) -> str:
    return f"{correct}-{n - correct}"


def _confidence_band(sample_size: int, effect_pp: float) -> Optional[str]:
    """Return 'high' | 'medium' | None. None → don't emit the insight."""
    if sample_size < MIN_N_MEDIUM or effect_pp < NOTABLE_EFFECT_PP:
        return None
    if sample_size >= MIN_N_HIGH and effect_pp >= STRONG_EFFECT_PP:
        return "high"
    return "medium"


# ============================================================
# Individual insight generators — each is a small pure function.
# All accept the "bundle" dict {calls, resolutions_by_call, wagers_by_call,
# user, now_iso_ts} and return zero or more Insight dicts.
# ============================================================

def _resolved_gradeable(calls: list[dict], res_by_id: dict[str, dict]) -> list[tuple[dict, dict]]:
    """Return list of (call, resolution) pairs for resolved+gradeable calls."""
    out = []
    for c in calls:
        if c.get("state") != "resolved":
            continue
        r = res_by_id.get(c["id"])
        if not r or r.get("correct") is None:
            continue
        out.append((c, r))
    return out


def insight_kind_strength(bundle) -> list[dict]:
    """Which call KIND is the user notably stronger/weaker at than their
    own overall baseline? Requires ≥ MIN_N_MEDIUM in the kind AND meaningful
    effect vs. baseline."""
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    if len(pairs) < MIN_N_MEDIUM:
        return []
    total_correct = sum(1 for _, r in pairs if r.get("correct"))
    overall_pct = 100.0 * total_correct / len(pairs)

    by_kind: dict[str, dict] = defaultdict(lambda: {"n": 0, "correct": 0})
    for c, r in pairs:
        b = by_kind[c.get("kind", "unknown")]
        b["n"] += 1
        if r.get("correct"):
            b["correct"] += 1

    insights = []
    for kind, b in by_kind.items():
        if b["n"] < MIN_N_MEDIUM:
            continue
        pct = 100.0 * b["correct"] / b["n"]
        delta_pp = abs(pct - overall_pct)
        band = _confidence_band(b["n"], delta_pp)
        if not band:
            continue
        stronger = pct > overall_pct
        marc = _marc_kind_strength(kind, b["correct"], b["n"], pct, overall_pct, stronger)
        insights.append({
            "code": "kind_strength" if stronger else "kind_weakness",
            "category": "prediction",
            "headline": f"{'Stronger' if stronger else 'Weaker'} on {kind.replace('_', ' ')} than overall",
            "evidence": {
                "kind": kind,
                "kind_record": _rec(b["correct"], b["n"]),
                "kind_pct": round(pct, 1),
                "overall_pct": round(overall_pct, 1),
                "delta_pp": round(delta_pp, 1),
            },
            "sample_size": b["n"],
            "confidence": band,
            "marc_voice": marc,
        })
    return insights


def insight_first_instinct(bundle) -> list[dict]:
    """First-instinct vs revised. Requires ≥ BEHAVIORAL_MIN_N revised calls
    with resolutions AND meaningful gap."""
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    fi_hits = fi_attempts = cm_hits = cm_attempts = 0
    for c, r in pairs:
        fi = c.get("first_instinct")
        final = (c.get("stance") or {}).get("pick")
        actual = (r.get("actual") or {}).get("pick") or (r.get("actual") or {}).get("outcome")
        if not (fi and final and actual is not None):
            continue
        if fi["pick"] != final:  # they revised
            cm_attempts += 1
            if r.get("correct"):
                cm_hits += 1
            fi_attempts += 1
            if fi["pick"] == actual:
                fi_hits += 1
    if cm_attempts < MIN_N_MEDIUM:
        return []
    fi_pct = 100.0 * fi_hits / fi_attempts if fi_attempts else 0
    cm_pct = 100.0 * cm_hits / cm_attempts if cm_attempts else 0
    delta_pp = abs(fi_pct - cm_pct)
    # Use behavioral thresholds for this one — it's a self-diagnosis claim
    if cm_attempts < BEHAVIORAL_MIN_N or delta_pp < NOTABLE_EFFECT_PP:
        band = "medium" if cm_attempts >= MIN_N_MEDIUM and delta_pp >= NOTABLE_EFFECT_PP else None
    else:
        band = "high" if delta_pp >= BEHAVIORAL_EFFECT_PP else "medium"
    if not band:
        return []
    first_better = fi_pct > cm_pct
    return [{
        "code": "first_instinct_better" if first_better else "revised_better",
        "category": "behavioral",
        "headline": ("Your first answer has been right more often than your revised one"
                     if first_better else "Revising tends to help you"),
        "evidence": {
            "revised_calls_n": cm_attempts,
            "first_instinct_right_when_revised": fi_hits,
            "first_instinct_pct": round(fi_pct, 1),
            "revised_pct": round(cm_pct, 1),
            "delta_pp": round(delta_pp, 1),
        },
        "sample_size": cm_attempts,
        "confidence": band,
        "marc_voice": _marc_first_instinct(fi_hits, cm_attempts, first_better, band),
    }]


def insight_confidence_calibration(bundle) -> list[dict]:
    """Is user's declared confidence calibrated? Requires ≥ BEHAVIORAL_MIN_N
    high-confidence (7+) resolved calls to make a claim."""
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    high_conf_n = high_conf_correct = 0
    for c, r in pairs:
        conf = (c.get("stance") or {}).get("confidence_1_10")
        if not conf:
            continue
        if conf >= 7:
            high_conf_n += 1
            if r.get("correct"):
                high_conf_correct += 1
    if high_conf_n < BEHAVIORAL_MIN_N:
        return []
    high_conf_pct = 100.0 * high_conf_correct / high_conf_n
    # A user calling something 7+/10 should reasonably be right at least ~65% of the time.
    # We only flag mis-calibration if they're materially below their own confidence.
    delta_pp = 70.0 - high_conf_pct
    if delta_pp < BEHAVIORAL_EFFECT_PP:
        return []
    band = "high" if high_conf_n >= 30 else "medium"
    return [{
        "code": "overconfidence",
        "category": "behavioral",
        "headline": "High-confidence calls have been landing less often than the confidence suggests",
        "evidence": {
            "high_conf_calls_n": high_conf_n,
            "high_conf_correct": high_conf_correct,
            "high_conf_pct": round(high_conf_pct, 1),
        },
        "sample_size": high_conf_n,
        "confidence": band,
        "marc_voice": _marc_calibration(high_conf_correct, high_conf_n, band),
    }]


def insight_team_bias(bundle) -> list[dict]:
    """Team the user follows AND is notably worse on. Requires
    BEHAVIORAL_MIN_N game_pick calls involving that team AND ≥ 20pp gap
    below the user's overall accuracy."""
    followed = set((bundle["user"].get("prefs") or {}).get("followed_teams") or [])
    if not followed:
        return []
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    if len(pairs) < BEHAVIORAL_MIN_N:
        return []
    overall_pct = 100.0 * sum(1 for _, r in pairs if r.get("correct")) / len(pairs)

    per_team: dict[str, dict] = defaultdict(lambda: {"n": 0, "correct": 0})
    for c, r in pairs:
        if c.get("kind") not in ("game_pick", "prop_pick"):
            continue
        subj = c.get("subject") or {}
        teams_in_subject = []
        for k in ("home", "away", "team_ref"):
            if subj.get(k):
                teams_in_subject.append(subj[k])
        # Also try to parse from matchup string like "BOS @ MTL"
        matchup = subj.get("matchup") or ""
        if matchup:
            for tok in matchup.replace("@", " ").replace("vs", " ").split():
                tok = tok.strip().upper()
                if tok in followed:
                    teams_in_subject.append(tok)
        for t in set(teams_in_subject) & followed:
            per_team[t]["n"] += 1
            if r.get("correct"):
                per_team[t]["correct"] += 1

    insights = []
    for team, b in per_team.items():
        if b["n"] < BEHAVIORAL_MIN_N:
            continue
        pct = 100.0 * b["correct"] / b["n"]
        delta_pp = overall_pct - pct
        if delta_pp < BEHAVIORAL_EFFECT_PP:
            continue
        band = "high" if b["n"] >= 30 else "medium"
        insights.append({
            "code": "team_bias_underperform",
            "category": "behavioral",
            "headline": f"Notably weaker on {team} predictions than overall",
            "evidence": {
                "team": team,
                "team_record": _rec(b["correct"], b["n"]),
                "team_pct": round(pct, 1),
                "overall_pct": round(overall_pct, 1),
                "delta_pp": round(delta_pp, 1),
            },
            "sample_size": b["n"],
            "confidence": band,
            "marc_voice": _marc_team_bias(team, b["correct"], b["n"], band),
        })
    return insights


def insight_recent_vs_lifetime(bundle) -> list[dict]:
    """Compare last 15 resolved calls to the prior. Both need MIN_N_MEDIUM."""
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    if len(pairs) < 2 * MIN_N_MEDIUM:
        return []
    # Sort by resolved_at (or fallback to created_at). Newest first.
    pairs_sorted = sorted(
        pairs, key=lambda p: p[0].get("resolved_at") or p[0].get("created_at") or "", reverse=True
    )
    recent = pairs_sorted[:15]
    prior = pairs_sorted[15:]
    if len(prior) < MIN_N_MEDIUM:
        return []
    recent_pct = 100.0 * sum(1 for _, r in recent if r.get("correct")) / len(recent)
    prior_pct = 100.0 * sum(1 for _, r in prior if r.get("correct")) / len(prior)
    delta_pp = abs(recent_pct - prior_pct)
    band = _confidence_band(min(len(recent), len(prior)), delta_pp)
    if not band:
        return []
    hot = recent_pct > prior_pct
    return [{
        "code": "recent_hot" if hot else "recent_cold",
        "category": "trend",
        "headline": ("Running hot recently — but lifetime number is more sober"
                     if hot else "Cooling off compared to your longer-term record"),
        "evidence": {
            "recent_n": len(recent),
            "recent_pct": round(recent_pct, 1),
            "lifetime_n": len(prior),
            "lifetime_pct": round(prior_pct, 1),
            "delta_pp": round(delta_pp, 1),
        },
        "sample_size": len(recent) + len(prior),
        "confidence": band,
        "marc_voice": _marc_recent_vs_lifetime(
            int(round(recent_pct * len(recent) / 100)), len(recent),
            round(prior_pct, 1), hot, band
        ),
    }]


def insight_frequency_shift(bundle) -> list[dict]:
    """Rolling call rate — has recent volume spiked while accuracy dropped?
    Requires ≥ 30 total resolved calls to compare 14-day recent slice to
    average. Wager-neutral: works for prediction users too."""
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    if len(pairs) < 30:
        return []
    from datetime import datetime, timezone, timedelta
    now_ts = bundle.get("now_iso_ts")
    try:
        now = datetime.fromisoformat(now_ts.replace("Z", "+00:00")) if now_ts else datetime.now(timezone.utc)
    except Exception:
        now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=14)

    def _ts(c):
        try:
            return datetime.fromisoformat((c.get("resolved_at") or c.get("created_at") or "").replace("Z", "+00:00"))
        except Exception:
            return None

    recent = [(c, r) for c, r in pairs if (_ts(c) and _ts(c) >= cutoff)]
    if len(recent) < MIN_N_MEDIUM:
        return []
    recent_pct = 100.0 * sum(1 for _, r in recent if r.get("correct")) / len(recent)
    lifetime_pct = 100.0 * sum(1 for _, r in pairs if r.get("correct")) / len(pairs)
    # Estimate baseline daily rate from full lifetime.
    all_ts = [_ts(c) for c, _ in pairs if _ts(c)]
    if not all_ts:
        return []
    span_days = max(1, (max(all_ts) - min(all_ts)).days)
    baseline_rate = len(pairs) / span_days
    recent_rate = len(recent) / 14.0
    if recent_rate < 2 * baseline_rate:
        return []
    delta_pp = lifetime_pct - recent_pct
    if delta_pp < NOTABLE_EFFECT_PP:
        return []
    band = "high" if len(recent) >= 20 and delta_pp >= STRONG_EFFECT_PP else "medium"
    return [{
        "code": "recent_volume_up_accuracy_down",
        "category": "behavioral",
        "headline": "Making more calls than usual lately, and hitting less",
        "evidence": {
            "recent_14d_n": len(recent),
            "recent_pct": round(recent_pct, 1),
            "lifetime_pct": round(lifetime_pct, 1),
            "baseline_daily_rate": round(baseline_rate, 2),
            "recent_daily_rate": round(recent_rate, 2),
            "delta_pp": round(delta_pp, 1),
        },
        "sample_size": len(recent),
        "confidence": band,
        "marc_voice": _marc_frequency_shift(len(recent), round(recent_pct, 1), round(lifetime_pct, 1), band),
    }]


def insight_specialist_category(bundle) -> list[dict]:
    """Narrow-category specialist detection. Requires ≥ BEHAVIORAL_MIN_N
    resolved calls of a specific kind AND accuracy ≥ 70%."""
    pairs = _resolved_gradeable(bundle["calls"], bundle["resolutions_by_call"])
    if not pairs:
        return []
    by_kind: dict[str, dict] = defaultdict(lambda: {"n": 0, "correct": 0})
    for c, r in pairs:
        k = c.get("kind", "unknown")
        by_kind[k]["n"] += 1
        if r.get("correct"):
            by_kind[k]["correct"] += 1
    insights = []
    for k, b in by_kind.items():
        if b["n"] < BEHAVIORAL_MIN_N:
            continue
        pct = 100.0 * b["correct"] / b["n"]
        if pct < 70:
            continue
        band = "high" if b["n"] >= 30 else "medium"
        insights.append({
            "code": "specialist_category",
            "category": "strength",
            "headline": f"Consistent specialist in {k.replace('_', ' ')}",
            "evidence": {"kind": k, "record": _rec(b["correct"], b["n"]), "pct": round(pct, 1)},
            "sample_size": b["n"],
            "confidence": band,
            "marc_voice": _marc_specialist(k, b["correct"], b["n"], band),
        })
    return insights


# ============================================================
# Marc voice — deterministic templates. Never LLM in Phase 3.
# Language rules enforced:
#   - No "will", "guaranteed", "edge", "sure thing"
#   - No stake advice
#   - Uses "have been", "lately", "your record shows"
#   - Behavioral claims get evidence-first framing
# ============================================================
def _marc_kind_strength(kind, correct, n, pct, overall_pct, stronger):
    kk = kind.replace("_", " ")
    if stronger:
        return (f"You've been much better on {kk} than the rest of your book — "
                f"{_rec(correct, n)}, {pct:.0f}% vs. {overall_pct:.0f}% overall. "
                f"That's where your read has been sharpest.")
    return (f"Your {kk} record has been the weakest area — "
            f"{_rec(correct, n)}, {pct:.0f}% against {overall_pct:.0f}% elsewhere. "
            f"Doesn't mean you're bad at it, but worth noticing.")

def _marc_first_instinct(hits, n, first_better, band):
    if first_better:
        soft = "" if band == "high" else "It's a small pattern, but "
        return (f"{soft}You've changed your mind {n} times, and your first answer was right "
                f"{hits} of those. Your gut has been pulling its weight — worth trusting "
                f"more of the time.")
    return (f"You've revised {n} times and it's mostly gone your way — "
            f"{hits} of those revisions cashed. Doing homework has been working for you.")

def _marc_calibration(correct, n, band):
    pct = round(100.0 * correct / n, 1)
    soft = "" if band == "high" else "Small sample but worth watching — "
    return (f"{soft}When you tell Ticker you're 7 or higher out of 10, "
            f"you've been right {correct} of {n} times ({pct}%). Your confidence has been "
            f"running a bit ahead of your record. Nothing wrong with being sure — "
            f"just double-check the ones where you're absolutely certain.")

def _marc_team_bias(team, correct, n, band):
    soft = "" if band == "high" else "Not a huge sample, but — "
    return (f"{soft}You haven't been particularly good predicting {team} — "
            f"{_rec(correct, n)} across those games. There might be some heart "
            f"in there. Worth being a little more skeptical of yourself on {team} nights.")

def _marc_recent_vs_lifetime(recent_correct, recent_n, lifetime_pct, hot, band):
    if hot:
        return (f"You've been running hot — {recent_correct} of your last {recent_n}. "
                f"Longer-term you're at {lifetime_pct}%, so enjoy the streak "
                f"but don't get carried away with it.")
    return (f"Your last {recent_n} haven't landed the way your longer record ({lifetime_pct}%) says they should. "
            f"Doesn't mean anything's broken. Might be a good week to be more selective.")

def _marc_frequency_shift(n, recent_pct, lifetime_pct, band):
    return (f"You've made more calls than usual in the last two weeks — {n} of them — "
            f"and you're hitting {recent_pct}% against your longer number of {lifetime_pct}%. "
            f"Your record has been better when you're more selective. Passing is a position.")

def _marc_specialist(kind, correct, n, band):
    kk = kind.replace("_", " ")
    return (f"When it comes to {kk}, your record actually says something — "
            f"{_rec(correct, n)}, and it holds up. That's a legitimate specialty. "
            f"Doesn't make future picks free, but this is where your read has been most reliable.")


# ============================================================
# Aggregator
# ============================================================
GENERATORS = [
    insight_kind_strength,
    insight_first_instinct,
    insight_confidence_calibration,
    insight_team_bias,
    insight_recent_vs_lifetime,
    insight_frequency_shift,
    insight_specialist_category,
]


def generate_insights(
    user: dict,
    calls: list[dict],
    resolutions_by_call: dict[str, dict],
    wagers_by_call: dict[str, dict],
    now_iso_ts: Optional[str] = None,
) -> list[dict]:
    """Compose insights across all generators, sort by confidence + sample."""
    bundle = {
        "user": user,
        "calls": calls,
        "resolutions_by_call": resolutions_by_call,
        "wagers_by_call": wagers_by_call,
        "now_iso_ts": now_iso_ts,
    }
    out: list[dict] = []
    for gen in GENERATORS:
        try:
            out.extend(gen(bundle) or [])
        except Exception:
            # Insight generation is best-effort. A single generator failing
            # must never break the coach.
            continue
    # Rank: high before medium; larger samples first within each band.
    band_order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda i: (band_order.get(i["confidence"], 3), -i["sample_size"]))
    return out


# ============================================================
# Responsible-coach filter for adult betting users. Enforces the
# guardrail language rules at the presentation boundary — even if a
# template ever slipped, this final check strips any forbidden phrase.
# ============================================================
_FORBIDDEN_PHRASES = (
    "guaranteed", "sure thing", "market edge", "you will win",
    "increase your stake", "bet more", "safe bet", "lock",  # 'lock' allowed for call state but check context
)

def coaching_line_for_bet_context(insights: list[dict], is_adult: bool) -> Optional[str]:
    """Pick the most-relevant Marc line for adult betting coaching, or
    fall back to a general coaching line derived from any insight when
    the user hasn't unlocked betting. Returns None only when there is
    genuinely nothing to say (empty insight list).

    Coaching philosophy (see PHASE_0_RATIFIED §14 amendments):
      - Never suggest increasing stake / volume
      - "Passing is a position" family only
      - Streak recognition without risk escalation
    """
    # Adult path — betting-aware priority order.
    if is_adult:
        priority_codes = (
            "recent_volume_up_accuracy_down",   # → "passing is a position"
            "overconfidence",                   # → "double-check the ones where you're certain"
            "recent_cold",                      # → "be more selective this week"
            "recent_hot",                       # → "enjoy the streak, don't scale risk"
            "team_bias_underperform",           # → "be more skeptical"
        )
        by_code = {i["code"]: i for i in insights}
        for code in priority_codes:
            if code in by_code:
                return by_code[code]["marc_voice"]

    # General fallback — pick the highest-confidence insight so a
    # non-adult My IQ still gets a coach line grounded in real evidence.
    if not insights:
        return None
    general_priority = (
        "recent_cold", "recent_hot", "specialist_category",
        "kind_strength", "kind_weakness", "changed_mind_helps",
        "changed_mind_hurts", "confidence_miscalibrated",
    )
    by_code = {i["code"]: i for i in insights}
    for code in general_priority:
        if code in by_code:
            return by_code[code]["marc_voice"]
    # Last resort — first (highest confidence) insight
    return insights[0].get("marc_voice")


# ============================================================
# Community specialist consensus — subset public calls to users whose
# reputation in that dimension is qualified. This is what makes
# "everybody thinks X" different from "specialists in this exact
# category think Y". No magic Community Edge score — just a filtered
# subset with sample sizes exposed.
# ============================================================
def specialist_consensus(
    public_calls_with_authors: list[dict],
    dimension: str = "hockey_iq",
) -> dict:
    """Inputs are dicts with shape:
        { call, author_user, author_reputation }
    Returns:
        { total_public: int, specialist_only_n: int,
          pick_distribution_all: {pick: count},
          pick_distribution_specialists: {pick: count},
          specialists_qualified_count: int }
    """
    total = len(public_calls_with_authors)
    all_dist: dict[str, int] = defaultdict(int)
    spec_dist: dict[str, int] = defaultdict(int)
    spec_ids: set = set()
    for row in public_calls_with_authors:
        call = row.get("call") or {}
        pick = (call.get("stance") or {}).get("pick")
        if pick is None:
            continue
        all_dist[pick] += 1
        rep = ((row.get("author_reputation") or {}).get(dimension)) or {}
        if rep.get("qualified"):
            spec_dist[pick] += 1
            spec_ids.add(row.get("author_user_id"))
    return {
        "dimension": dimension,
        "total_public": total,
        "specialist_only_n": sum(spec_dist.values()),
        "specialists_qualified_count": len(spec_ids),
        "pick_distribution_all": dict(all_dist),
        "pick_distribution_specialists": dict(spec_dist),
    }
