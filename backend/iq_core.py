"""Ticker Hockey IQ — Phase 0 core.

Pure module: Pydantic models + business logic. No DB, no I/O — the FastAPI
endpoints in server.py do the persistence. Keeps this trivially unit-testable.

Six durable objects:
  User        — durable identity (device_id spine, provenance-tracked adult attestation)
  UserCall    — the committed decision/opinion object
  CallEvent   — append-only decision journey (voice/tap/import all write here)
  Signal      — external/world intelligence ONLY (never personal history)
  Wager       — optional eligible-adult attachment to a locked UserCall
  Resolution  — verified grading with call-type-aware semantics

Design invariants — MUST hold:
  1. Personal history is derived from UserCall/CallEvent/Resolution.
     It is NEVER stored as a Signal. Signal is world data.
  2. `adult_features_unlocked` is derived from attestation provenance,
     never a bare boolean without an origin.
  3. UserCall.stance is a projection of the event log — not the truth.
     The event log is truth. project_call_from_events() is the projector.
  4. Locking requires explicit confirmation context. Isolated positive
     utterances DO NOT lock. See validate_locked_event().
  5. Abandoned calls are excluded from accuracy math. See accuracy_summary().
  6. Resolution is call-type-aware via grading_rule + grading_version.
     Fantasy resolution is legitimately allowed to be `ungradeable` today.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
import uuid


# ============================================================
# ISO timestamp helper — everything Phase 0 writes uses UTC ISO.
# ============================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================
# User — durable identity + adult-eligibility provenance
# ============================================================
class Attestation(BaseModel):
    """Provenance for how an adult unlock was obtained.

    `method` is intentionally versioned so we can upgrade from
    self-attestation to id-verified without changing the schema.
    We do NOT collect DOB — year-only cannot reliably determine
    whether someone is currently 18, so it fails the "minimum
    information genuinely required" test.
    """
    method: Literal[
        "self_attestation_v1",   # checkbox + jurisdiction, today's baseline
        "id_verified_v1",        # future partner KYC
        "partner_verified_v1",   # future sportsbook-linked
    ] = "self_attestation_v1"
    attested_at: str
    policy_version: str = "adult-unlock-policy-v1"
    jurisdiction: str = Field(min_length=2, max_length=8)  # ISO-3166 country code or "US-CA" region
    revoked_at: Optional[str] = None


class Eligibility(BaseModel):
    """Runtime permission derived from attestation. `adult_features_unlocked`
    is TRUE iff an unrevoked attestation exists. Never set directly."""
    adult_features_unlocked: bool = False
    attestation: Optional[Attestation] = None


class UserPrefs(BaseModel):
    model_config = ConfigDict(extra="allow")
    followed_teams: list[str] = Field(default_factory=list)
    followed_players: list[str] = Field(default_factory=list)
    voice_persona: str = "reggie"
    public_nickname: Optional[str] = None   # only set on opt-in to public profile


class User(BaseModel):
    """Durable identity. `id` is stable; `device_ids` grows over time.
    `nickname` is display-only, non-unique for private accounts. Public
    handle uniqueness lives in `prefs.public_nickname` (reserved when set)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_ids: list[str] = Field(default_factory=list)
    nickname: str = "Guest"
    created_at: str = Field(default_factory=now_iso)
    eligibility: Eligibility = Field(default_factory=Eligibility)
    prefs: UserPrefs = Field(default_factory=UserPrefs)


# ============================================================
# CallEvent — append-only journey. Closed vocabulary at Phase 0.
# ============================================================
CallEventKind = Literal[
    "draft_created",           # explicit "start a call for tonight's BOS game"
    "instinct_captured",       # first opinion Reggie hears
    "reasoning_added",         # "because Demko is in net"
    "signal_consumed",         # user was shown/heard a market/community signal
    "revision",                # picked A, changing to B
    "confidence_set",          # 1..10
    "locked",                  # transition to locked — STRICT validation
    "abandoned",               # user walked away
    "wager_attached",          # 18+ only, optional
    "resolution_delivered",    # system wrote a Resolution
    "voided",                  # bad grade retracted
    "reflection",              # post-game user note
    "visibility_changed",      # private ↔ public ↔ anonymous_aggregate (Phase 2)
]


class CallEvent(BaseModel):
    """The truth. UserCall.stance is a projection of these."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    call_id: str
    user_id: str
    ts: str = Field(default_factory=now_iso)
    source: Literal["voice", "tap", "imported", "reggie", "system"] = "tap"
    kind: str  # one of CallEventKind — validated at endpoint layer
    payload: dict[str, Any] = Field(default_factory=dict)


# ============================================================
# UserCall — the committed decision/opinion object
# ============================================================
class CallStance(BaseModel):
    """Projected from the event log. NEVER edited directly."""
    pick: Optional[str] = None
    confidence_1_10: Optional[int] = None
    reasoning_text: Optional[str] = None
    reasoning_tags: list[str] = Field(default_factory=list)
    changed_mind: bool = False
    time_to_lock_sec: Optional[int] = None


class FirstInstinct(BaseModel):
    pick: str
    captured_at: str
    source: str = "voice"


CallState = Literal["draft", "locked", "resolved", "abandoned", "voided"]

# Call kinds — extensible. Phase 0 supports game_pick end-to-end; others
# are storable but may be `ungradeable` at resolution time.
CallKind = Literal[
    "game_pick",           # who wins tonight's game
    "prop_pick",           # player-to-score, shots, saves, totals, etc.
    "pick10_entry",        # daily 10-question board entry
    "fantasy_lineup",      # start/sit
    "series_pick",         # who wins a playoff series
    "community_take",      # explicitly-locked forum call (never auto-extracted)
]


# Visibility axis (Phase 2) — ORTHOGONAL to lifecycle state. A call can be
# locked+private (fantasy user protecting their edge), locked+public
# (published to community feed with identity), or locked+anonymous_aggregate
# (contributes to community stats but user identity not shown).
CallVisibility = Literal["private", "public", "anonymous_aggregate"]


class UserCall(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    kind: str  # one of CallKind
    subject: dict[str, Any] = Field(default_factory=dict)
    stance: CallStance = Field(default_factory=CallStance)
    first_instinct: Optional[FirstInstinct] = None
    state: str = "draft"  # one of CallState
    visibility: str = "private"  # Phase 2 — private by default, opt-in publish
    published_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    locked_at: Optional[str] = None
    resolved_at: Optional[str] = None
    context_snapshot: Optional[dict[str, Any]] = None
    wager_id: Optional[str] = None


# ============================================================
# Signal — external/world intelligence ONLY.
# Personal history is NOT a Signal. It is derived at read time.
# ============================================================
SignalSource = Literal[
    "market_line",
    "ticker_model",
    "community_consensus",
    "specialist_pick",
    "forum_observation",
    "injury_report",
    "goalie_confirmed",
    "schedule_context",
]

FactTier = Literal["verified", "reported", "rumor"]


class Signal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str  # one of SignalSource
    subject: dict[str, Any]  # game_id/player_id/market etc — mirrors UserCall.subject shape
    value: str
    confidence: Optional[float] = None
    provenance: dict[str, Any]  # origin_id?, ingested_at, fact_tier
    valid_from: str = Field(default_factory=now_iso)
    valid_to: Optional[str] = None


# ============================================================
# Wager — optional adult-only attachment
# ============================================================
class Wager(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    call_id: str
    played: bool  # the only required field
    odds_text: Optional[str] = None
    stake: Optional[float] = None
    units: Optional[float] = None
    book: Optional[str] = None
    settled: Optional[dict[str, Any]] = None
    created_at: str = Field(default_factory=now_iso)


# ============================================================
# Resolution — call-type-aware grading
# ============================================================
OutcomeStatus = Literal[
    "correct",       # boolean-gradeable, user was right
    "incorrect",     # boolean-gradeable, user was wrong
    "push",          # e.g. total landed on the number
    "void",          # bet voided by book / game postponed
    "ungradeable",   # call type doesn't map to a clean binary (e.g. fantasy)
    "partial",       # e.g. multi-leg where some legs hit
]


class Resolution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    call_id: str
    outcome_status: str  # one of OutcomeStatus
    correct: Optional[bool] = None  # null for ungradeable/partial; convenience for accuracy math
    actual: dict[str, Any] = Field(default_factory=dict)
    grading_rule: str  # e.g. 'game_winner_v1', 'fantasy_start_sit_v1'
    grading_version: str = "v1"
    source: str = "manual"  # 'nhl_api' | 'sportradar' | 'manual' | 'import' | 'system'
    resolved_at: str = Field(default_factory=now_iso)
    raw_evidence: Optional[dict[str, Any]] = None


# ============================================================
# The projector — replays events → derives UserCall stance + state.
# Pure function. Called on every write, and by tests directly.
# ============================================================
def project_call_from_events(call_doc: dict, events: list[dict]) -> dict:
    """Replays events in ts order and returns call_doc with:
      - stance (pick, confidence, reasoning_text, reasoning_tags, changed_mind, time_to_lock_sec)
      - first_instinct (captured once, never overwritten)
      - state transitions (draft → locked → resolved/voided/abandoned)
      - locked_at, resolved_at timestamps

    NEVER mutates events. Copies of the input dict pattern.
    """
    stance = {
        "pick": None,
        "confidence_1_10": None,
        "reasoning_text": None,
        "reasoning_tags": [],
        "changed_mind": False,
        "time_to_lock_sec": None,
    }
    first_instinct = None
    state = "draft"
    locked_at = None
    resolved_at = None
    revision_count = 0

    # Events must be replayed in ts order — caller responsibility, but we sort defensively.
    for e in sorted(events, key=lambda x: x.get("ts", "")):
        k = e.get("kind")
        p = e.get("payload") or {}

        if k == "draft_created":
            # A no-op event — just marks that a call exists. Useful when a
            # tap-flow user starts a call before uttering an instinct.
            continue

        elif k == "instinct_captured":
            # Only the FIRST instinct ever counts. Never overwritten.
            if first_instinct is None and p.get("pick"):
                first_instinct = {
                    "pick": p["pick"],
                    "captured_at": e["ts"],
                    "source": e.get("source", "unknown"),
                }
                # Seed the working pick with the first instinct.
                if stance["pick"] is None:
                    stance["pick"] = p["pick"]

        elif k == "reasoning_added":
            if p.get("text"):
                stance["reasoning_text"] = (
                    (stance["reasoning_text"] + "\n" + p["text"])
                    if stance["reasoning_text"]
                    else p["text"]
                )
            for tag in (p.get("tags") or []):
                if tag and tag not in stance["reasoning_tags"]:
                    stance["reasoning_tags"].append(tag)

        elif k == "signal_consumed":
            # Recorded in the log for future "did the user follow the market"
            # analysis, but doesn't alter stance directly.
            pass

        elif k == "revision":
            revision_count += 1
            new_pick = p.get("to_pick")
            if new_pick:
                stance["pick"] = new_pick

        elif k == "confidence_set":
            v = p.get("value")
            if isinstance(v, (int, float)) and 1 <= v <= 10:
                stance["confidence_1_10"] = int(v)

        elif k == "locked":
            # Endpoint layer already validated explicit=true + confirmation_prompt.
            # Here we just transition state.
            state = "locked"
            locked_at = e["ts"]

        elif k == "abandoned":
            state = "abandoned"

        elif k == "voided":
            state = "voided"

        elif k == "resolution_delivered":
            state = "resolved"
            resolved_at = e["ts"]

        elif k == "wager_attached":
            # No stance change — wager lives as a sibling record.
            pass

        elif k == "reflection":
            # Post-game reflection — doesn't alter stance. Reflections
            # are surfaced separately in the personal history view.
            pass

        # Unknown kinds are ignored on purpose — forward-compatibility.

    # Derived flags
    stance["changed_mind"] = revision_count > 0

    # time_to_lock_sec
    if locked_at and call_doc.get("created_at"):
        try:
            t0 = datetime.fromisoformat(call_doc["created_at"].replace("Z", "+00:00"))
            t1 = datetime.fromisoformat(locked_at.replace("Z", "+00:00"))
            stance["time_to_lock_sec"] = max(0, int((t1 - t0).total_seconds()))
        except Exception:
            pass

    out = {**call_doc}
    out["stance"] = stance
    out["first_instinct"] = first_instinct
    out["state"] = state
    out["locked_at"] = locked_at
    out["resolved_at"] = resolved_at
    return out


# ============================================================
# Locking strictness — validated at endpoint layer, tested here.
# ============================================================
def validate_locked_event(payload: dict, most_recent_prompt_ts: Optional[str] = None) -> Optional[str]:
    """Return an error string if the locked event is not sufficiently
    confirmed, else None.

    Strict Phase 0 rules:
      - payload.explicit MUST be true
      - AND EITHER payload.confirmation_prompt is a non-empty string
        (Reggie asked "Lock Vancouver?" verbatim)
      - OR payload.ui_action is a non-empty string (user pressed a lock button)
    """
    if not isinstance(payload, dict):
        return "locked event requires a payload"
    if payload.get("explicit") is not True:
        return "locked event requires payload.explicit=true"
    has_prompt = isinstance(payload.get("confirmation_prompt"), str) and payload["confirmation_prompt"].strip()
    has_action = isinstance(payload.get("ui_action"), str) and payload["ui_action"].strip()
    if not (has_prompt or has_action):
        return (
            "locked event requires explicit confirmation context — either "
            "payload.confirmation_prompt (voice) or payload.ui_action (UI). "
            "Isolated positive utterances do not lock."
        )
    return None


# ============================================================
# Accuracy summary — DERIVES personal history from UserCall + Resolution.
# NEVER reads from Signal. Abandoned calls are excluded.
# ============================================================
def accuracy_summary(calls: list[dict], resolutions_by_call: dict[str, dict]) -> dict:
    """Compute derived personal accuracy from the user's own history.

    Rules:
      - Only counts calls in state='resolved'.
      - Uses Resolution.correct when non-null. `ungradeable`/`partial` are
        excluded from the overall correctness rate but surfaced separately.
      - Abandoned/voided/draft/locked-but-unresolved calls do NOT count.
      - Breakouts by kind and by reasoning_tag are also derived.

    Returns a small dict — caller formats for UI/Reggie brief.
    """
    total_resolved = 0
    gradeable = 0
    correct = 0
    ungradeable = 0
    by_kind: dict[str, dict] = {}
    by_tag: dict[str, dict] = {}
    first_instinct_hits = 0
    first_instinct_attempts = 0
    changed_mind_hits = 0
    changed_mind_attempts = 0

    for c in calls:
        if c.get("state") != "resolved":
            continue
        total_resolved += 1
        res = resolutions_by_call.get(c["id"])
        if not res:
            continue

        # Overall gradeable rate
        if res.get("correct") is None:
            ungradeable += 1
        else:
            gradeable += 1
            if res["correct"]:
                correct += 1

        # By kind
        k = c.get("kind", "unknown")
        by_kind.setdefault(k, {"n": 0, "correct": 0, "ungradeable": 0})
        by_kind[k]["n"] += 1
        if res.get("correct") is True:
            by_kind[k]["correct"] += 1
        elif res.get("correct") is None:
            by_kind[k]["ungradeable"] += 1

        # By reasoning tag
        for tag in (c.get("stance", {}).get("reasoning_tags") or []):
            by_tag.setdefault(tag, {"n": 0, "correct": 0})
            by_tag[tag]["n"] += 1
            if res.get("correct") is True:
                by_tag[tag]["correct"] += 1

        # First-instinct vs final
        fi = c.get("first_instinct")
        final_pick = (c.get("stance") or {}).get("pick")
        if fi and final_pick and res.get("correct") is not None:
            # Did the first instinct match the actual outcome?
            actual = (res.get("actual") or {}).get("pick") or (res.get("actual") or {}).get("outcome")
            if actual is not None:
                first_instinct_attempts += 1
                if fi["pick"] == actual:
                    first_instinct_hits += 1
                if fi["pick"] != final_pick:
                    changed_mind_attempts += 1
                    if res.get("correct"):
                        changed_mind_hits += 1

    def _pct(a, b):
        return round(100.0 * a / b, 1) if b else None

    return {
        "total_resolved": total_resolved,
        "gradeable": gradeable,
        "ungradeable": ungradeable,
        "correct": correct,
        "accuracy_pct": _pct(correct, gradeable),
        "first_instinct_accuracy_pct": _pct(first_instinct_hits, first_instinct_attempts),
        "changed_mind_accuracy_pct": _pct(changed_mind_hits, changed_mind_attempts),
        "by_kind": by_kind,
        "by_reasoning_tag": by_tag,
    }


# ============================================================
# Legacy projection — maps existing Prediction and BetLog records
# into UserCall/Wager/Resolution shape WITHOUT modifying them.
# Read-only. Called by /api/iq/legacy/projection endpoint.
# ============================================================
def project_legacy_prediction(pred_doc: dict) -> dict:
    """Legacy Prediction → UserCall + optional Resolution.

    Legacy predictions have no CallEvent journey — that's fine, the whole
    point of "zero destructive migration" is that new data gets rich
    journey; old data is readable but flat.
    """
    call = {
        "id": pred_doc.get("id"),
        "user_id_legacy_nickname": pred_doc.get("user_name"),  # explicitly-legacy field name
        "kind": "game_pick",
        "subject": {"game_id": pred_doc.get("game_id")},
        "stance": {
            "pick": pred_doc.get("pick"),
            "confidence_1_10": None,
            "reasoning_text": pred_doc.get("reasoning") or None,
            "reasoning_tags": [],
            "changed_mind": False,
            "time_to_lock_sec": None,
        },
        "first_instinct": None,   # never captured for legacy
        "state": "resolved" if pred_doc.get("resolved") else "locked",
        "created_at": pred_doc.get("created_at"),
        "locked_at": pred_doc.get("created_at"),  # legacy: lock == create
        "resolved_at": pred_doc.get("created_at") if pred_doc.get("resolved") else None,
        "legacy_source": "predictions",
    }
    resolution = None
    if pred_doc.get("resolved"):
        resolution = {
            "call_id": pred_doc.get("id"),
            "outcome_status": "correct" if pred_doc.get("correct") else "incorrect",
            "correct": bool(pred_doc.get("correct")),
            "actual": {},
            "grading_rule": "legacy_game_winner_v0",
            "grading_version": "v0",
            "source": "legacy_import",
            "resolved_at": pred_doc.get("created_at"),
        }
    return {"call": call, "resolution": resolution, "events": []}


def project_legacy_bet(bet_doc: dict) -> dict:
    """Legacy BetLog → UserCall + Wager + optional Resolution.

    Betting IQ / Spot Check keeps reading `bet_log` directly. This projection
    is one-way for new IQ read surfaces to see the same bets as UserCalls.
    """
    call = {
        "id": bet_doc.get("id"),
        "user_id_legacy_device": bet_doc.get("device_id"),
        "kind": _bet_type_to_call_kind(bet_doc.get("bet_type")),
        "subject": {
            "matchup": bet_doc.get("matchup"),
            "bet_type": bet_doc.get("bet_type"),
            "home_or_away": bet_doc.get("home_or_away"),
            "fav_or_dog": bet_doc.get("fav_or_dog"),
        },
        "stance": {
            "pick": bet_doc.get("selection"),
            "confidence_1_10": None,
            "reasoning_text": bet_doc.get("notes") or None,
            "reasoning_tags": [],
            "changed_mind": False,
            "time_to_lock_sec": None,
        },
        "first_instinct": None,
        "state": "resolved" if bet_doc.get("result") in ("win", "loss", "push") else "locked",
        "created_at": bet_doc.get("created_at"),
        "locked_at": bet_doc.get("created_at"),
        "resolved_at": bet_doc.get("created_at") if bet_doc.get("result") in ("win", "loss", "push") else None,
        "legacy_source": "bet_log",
    }
    wager = None
    if not bet_doc.get("prediction_only", False):
        wager = {
            "user_id_legacy_device": bet_doc.get("device_id"),
            "call_id": bet_doc.get("id"),
            "played": True,
            "odds_text": bet_doc.get("odds"),
            "stake": bet_doc.get("stake"),
            "settled": {
                "profit_loss": bet_doc.get("profit_loss"),
                "settled_at": bet_doc.get("created_at"),
            },
            "created_at": bet_doc.get("created_at"),
            "legacy_source": "bet_log",
        }
    resolution = None
    result = bet_doc.get("result")
    if result in ("win", "loss", "push"):
        resolution = {
            "call_id": bet_doc.get("id"),
            "outcome_status": {"win": "correct", "loss": "incorrect", "push": "push"}[result],
            "correct": True if result == "win" else (False if result == "loss" else None),
            "actual": {},
            "grading_rule": "legacy_bet_result_v0",
            "grading_version": "v0",
            "source": "legacy_import",
            "resolved_at": bet_doc.get("created_at"),
        }
    return {"call": call, "wager": wager, "resolution": resolution, "events": []}


def _bet_type_to_call_kind(bt: Optional[str]) -> str:
    if not bt:
        return "game_pick"
    b = bt.lower()
    if b in ("moneyline", "spread"):
        return "game_pick"
    if b == "total":
        return "prop_pick"   # totals are a market prop
    return "prop_pick"


# ============================================================
# Reggie brief — the "pre-loaded user context" the MOAT roadmap called
# out as the single highest-leverage change. Composes User + recent
# calls + accuracy summary + adult state. NEVER includes wager data
# if user is not adult-eligible.
# ============================================================
def build_reggie_brief(
    user: dict,
    recent_calls: list[dict],
    resolutions_by_call: dict[str, dict],
    open_calls: list[dict],
    spot_check_state: Optional[dict] = None,
) -> dict:
    """Small dict Reggie's system prompt consumes. Called on session start."""
    is_adult = bool((user.get("eligibility") or {}).get("adult_features_unlocked"))
    summary = accuracy_summary(recent_calls, resolutions_by_call)
    brief = {
        "user": {
            "id": user.get("id"),
            "nickname": user.get("nickname"),
            "followed_teams": (user.get("prefs") or {}).get("followed_teams", []),
            "followed_players": (user.get("prefs") or {}).get("followed_players", []),
        },
        "accuracy_summary": summary,
        "open_calls_count": len(open_calls),
        "recent_calls_count": len(recent_calls),
        "adult_features_unlocked": is_adult,
    }
    # Wager / spot-check info is stripped for non-adult users.
    if is_adult and spot_check_state:
        brief["spot_check_state"] = spot_check_state
    return brief


# ============================================================
# Phase 2 — Community & Reputation
# ============================================================

# Post kinds — closed vocabulary, extensible. NO "wager_talk" here — that
# lives inside the adult 18+ Betting section, never in the Hockey IQ
# Community feed. Youth surfaces never touch either.
PostKind = Literal[
    "discussion",     # open hockey conversation
    "observation",    # "eyes at the rink" style
    "question",       # ask the room
    "call_share",     # attached to a publicly-locked UserCall
]


class CultureMeta(BaseModel):
    """Structured metadata captured at write-time so a future cultural layer
    can mine language safely. NOT fed to Reggie/Marc raw — Phase 2 only
    captures. Filtering + approval into character bibles is a later phase.
    """
    language_marker: Optional[str] = None    # user's UI locale, e.g. 'en-CA'
    team_refs: list[str] = Field(default_factory=list)  # ['BOS','MTL']
    player_refs: list[str] = Field(default_factory=list)
    region: Optional[str] = None              # from attestation jurisdiction if adult; else None
    culture_layer_status: str = "raw"         # 'raw' | 'filtered' | 'approved_for_persona'


class CommunityPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    kind: str  # one of PostKind
    body: str = Field(min_length=1, max_length=4000)
    call_id: Optional[str] = None             # if attached to a publicly-locked UserCall
    target: dict[str, Any] = Field(default_factory=dict)  # {game_id?, team_ref?, player_id?}
    culture_meta: CultureMeta = Field(default_factory=CultureMeta)
    created_at: str = Field(default_factory=now_iso)
    parent_post_id: Optional[str] = None      # replies use the same object for simplicity


# ============================================================
# Reputation — derived at read time from Phase 0 data.
# Five dimensions kept SEPARATE per user directive: don't collapse into
# a single meaningless score.
# ============================================================
def compute_reputation(
    calls: list[dict],
    resolutions_by_call: dict[str, dict],
    wagers_by_call: dict[str, dict],
    posts: list[dict],
) -> dict:
    """Compute per-dimension reputation scores. All values are derived —
    no reputation is materialized in Mongo. Recomputable on demand.

    Dimensions (kept separate on purpose):
      - hockey_iq          general prediction accuracy across game_pick/prop_pick/series_pick/pick10_entry
      - betting_iq         accuracy on UserCalls with a wager attached (adult-only)
      - fantasy_iq         count + gradeable rate on fantasy_lineup calls
      - accuracy_overall   raw record across everything gradeable
      - community_cred     publicly-locked calls that resolved correctly

    Each dimension carries a `qualified` flag — minimum sample size before
    the score should appear on a leaderboard. Prevents 1-of-1 flukes from
    ranking above 43-of-60 track records.
    """
    MIN_QUAL = 10

    hockey_kinds = {"game_pick", "prop_pick", "series_pick", "pick10_entry"}

    def _init():
        return {"n": 0, "correct": 0, "ungradeable": 0, "accuracy_pct": None, "qualified": False}

    hockey = _init()
    betting = _init()
    fantasy = _init()
    overall = _init()
    community = _init()

    for c in calls:
        if c.get("state") != "resolved":
            continue
        res = resolutions_by_call.get(c["id"]) or {}
        correct = res.get("correct")
        kind = c.get("kind")

        # Overall
        if correct is None:
            overall["ungradeable"] += 1
        else:
            overall["n"] += 1
            if correct:
                overall["correct"] += 1

        # Hockey IQ (general prediction)
        if kind in hockey_kinds:
            if correct is None:
                hockey["ungradeable"] += 1
            else:
                hockey["n"] += 1
                if correct:
                    hockey["correct"] += 1

        # Betting IQ (only calls with wagers)
        if c["id"] in wagers_by_call:
            if correct is None:
                betting["ungradeable"] += 1
            else:
                betting["n"] += 1
                if correct:
                    betting["correct"] += 1

        # Fantasy IQ
        if kind == "fantasy_lineup":
            if correct is None:
                fantasy["ungradeable"] += 1
            else:
                fantasy["n"] += 1
                if correct:
                    fantasy["correct"] += 1

        # Community credibility — publicly-locked calls that resolved.
        # NEVER counts private calls. Volume without accuracy doesn't move
        # this — see leaderboard: qualified only past MIN_QUAL sample size.
        if c.get("visibility") == "public":
            if correct is None:
                community["ungradeable"] += 1
            else:
                community["n"] += 1
                if correct:
                    community["correct"] += 1

    def _finalize(d):
        if d["n"] > 0:
            d["accuracy_pct"] = round(100.0 * d["correct"] / d["n"], 1)
        d["qualified"] = d["n"] >= MIN_QUAL
        return d

    return {
        "hockey_iq": _finalize(hockey),
        "betting_iq": _finalize(betting),
        "fantasy_iq": _finalize(fantasy),
        "accuracy_overall": _finalize(overall),
        "community_cred": _finalize(community),
        # Post volume surfaced as info, NOT as a rank driver
        "posts_count": len(posts),
    }


def leaderboard_from_user_reps(
    user_reps: list[dict], dimension: str, limit: int = 25
) -> list[dict]:
    """Given a list of {user_id, nickname, reputation} rows, produce a ranked
    leaderboard for one dimension. Only `qualified` users appear (>= MIN_QUAL
    graded calls in that dimension) — this is what "reward verified
    performance not posting frequency" means at the query layer.
    """
    valid = ("hockey_iq", "betting_iq", "fantasy_iq", "accuracy_overall", "community_cred")
    if dimension not in valid:
        return []
    rows = []
    for u in user_reps:
        d = (u.get("reputation") or {}).get(dimension) or {}
        if not d.get("qualified"):
            continue
        rows.append({
            "user_id": u.get("user_id"),
            "nickname": u.get("nickname"),
            "n": d["n"],
            "correct": d["correct"],
            "accuracy_pct": d["accuracy_pct"] or 0,
        })
    rows.sort(key=lambda r: (r["accuracy_pct"], r["n"]), reverse=True)
    return rows[:limit]


def public_call_feed_item(call: dict, user: dict, resolution: Optional[dict]) -> dict:
    """Shape a UserCall for the public community feed. Never leaks wager info.
    Anonymises the user for `anonymous_aggregate` visibility."""
    is_anon = call.get("visibility") == "anonymous_aggregate"
    return {
        "call_id": call["id"],
        "kind": call.get("kind"),
        "subject": call.get("subject", {}),
        "pick": (call.get("stance") or {}).get("pick"),
        "confidence": (call.get("stance") or {}).get("confidence_1_10"),
        "reasoning_tags": (call.get("stance") or {}).get("reasoning_tags", []),
        "first_instinct": call.get("first_instinct"),   # publish the whole journey
        "state": call.get("state"),
        "locked_at": call.get("locked_at"),
        "resolved_at": call.get("resolved_at"),
        "published_at": call.get("published_at"),
        "author": {
            "user_id": None if is_anon else user.get("id"),
            "nickname": "Anonymous" if is_anon else user.get("nickname", "Guest"),
            "anonymous": is_anon,
        },
        "outcome": None if not resolution else {
            "status": resolution.get("outcome_status"),
            "correct": resolution.get("correct"),
        },
    }
