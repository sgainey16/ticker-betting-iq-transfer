"""Phase 0 unit tests — pure logic in iq_core.

Run: cd /app/backend && python -m pytest tests/test_iq_core.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from iq_core import (
    project_call_from_events, validate_locked_event, accuracy_summary,
    project_legacy_prediction, project_legacy_bet, build_reggie_brief,
    now_iso,
)


# ==================== Projector ====================

def _base_call():
    return {"id": "c1", "user_id": "u1", "kind": "game_pick", "created_at": "2025-02-15T00:00:00+00:00"}


def test_projector_empty_events_stays_draft():
    out = project_call_from_events(_base_call(), [])
    assert out["state"] == "draft"
    assert out["first_instinct"] is None
    assert out["stance"]["pick"] is None


def test_projector_first_instinct_captured_once():
    events = [
        {"kind": "instinct_captured", "ts": "2025-02-15T00:00:01+00:00", "payload": {"pick": "VAN"}, "source": "voice"},
        {"kind": "instinct_captured", "ts": "2025-02-15T00:00:02+00:00", "payload": {"pick": "EDM"}, "source": "voice"},
    ]
    out = project_call_from_events(_base_call(), events)
    # Second instinct does NOT overwrite the first — that's the whole point
    assert out["first_instinct"]["pick"] == "VAN"
    # But stance.pick reflects the latest state? Well, second instinct only
    # updates if stance.pick is None. Since it was set by the first, pick stays VAN.
    assert out["stance"]["pick"] == "VAN"


def test_projector_reasoning_appends_and_tags_dedupe():
    events = [
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "reasoning_added", "ts": "t2", "payload": {"text": "Demko starting", "tags": ["goalie_news"]}},
        {"kind": "reasoning_added", "ts": "t3", "payload": {"text": "Home ice", "tags": ["goalie_news", "home_ice"]}},
    ]
    out = project_call_from_events(_base_call(), events)
    assert "Demko starting" in out["stance"]["reasoning_text"]
    assert "Home ice" in out["stance"]["reasoning_text"]
    assert out["stance"]["reasoning_tags"] == ["goalie_news", "home_ice"]


def test_projector_revision_updates_pick_and_flags_changed_mind():
    events = [
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "revision", "ts": "t2", "payload": {"from_pick": "VAN", "to_pick": "EDM", "reason": "goalies"}},
    ]
    out = project_call_from_events(_base_call(), events)
    assert out["stance"]["pick"] == "EDM"
    assert out["first_instinct"]["pick"] == "VAN"   # first instinct preserved
    assert out["stance"]["changed_mind"] is True


def test_projector_confidence_clamped():
    events = [
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "confidence_set", "ts": "t2", "payload": {"value": 7}},
    ]
    out = project_call_from_events(_base_call(), events)
    assert out["stance"]["confidence_1_10"] == 7

    # out-of-range ignored
    events.append({"kind": "confidence_set", "ts": "t3", "payload": {"value": 99}})
    out = project_call_from_events(_base_call(), events)
    assert out["stance"]["confidence_1_10"] == 7  # not overwritten by invalid value


def test_projector_lock_transitions_state_and_computes_time_to_lock():
    c = _base_call()
    events = [
        {"kind": "instinct_captured", "ts": "2025-02-15T00:00:05+00:00", "payload": {"pick": "VAN"}},
        {"kind": "locked", "ts": "2025-02-15T00:00:35+00:00",
         "payload": {"explicit": True, "confirmation_prompt": "Lock VAN?", "user_response": "yep"}},
    ]
    out = project_call_from_events(c, events)
    assert out["state"] == "locked"
    assert out["locked_at"] == "2025-02-15T00:00:35+00:00"
    assert out["stance"]["time_to_lock_sec"] == 35


def test_projector_abandoned_terminal():
    events = [
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "abandoned", "ts": "t2", "payload": {"reason": "ran out of time"}},
    ]
    out = project_call_from_events(_base_call(), events)
    assert out["state"] == "abandoned"


def test_projector_resolution_transitions_to_resolved():
    events = [
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "locked", "ts": "t2", "payload": {"explicit": True, "ui_action": "lock_button"}},
        {"kind": "resolution_delivered", "ts": "t3", "payload": {}},
    ]
    out = project_call_from_events(_base_call(), events)
    assert out["state"] == "resolved"


def test_projector_events_replayed_in_order_regardless_of_input_order():
    events = [
        {"kind": "locked", "ts": "t3", "payload": {"explicit": True, "ui_action": "lock_button"}},
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "revision", "ts": "t2", "payload": {"to_pick": "EDM"}},
    ]
    out = project_call_from_events(_base_call(), events)
    # Regardless of input order, ts order determines outcome
    assert out["first_instinct"]["pick"] == "VAN"
    assert out["stance"]["pick"] == "EDM"
    assert out["state"] == "locked"


def test_projector_unknown_kind_ignored():
    events = [
        {"kind": "instinct_captured", "ts": "t1", "payload": {"pick": "VAN"}},
        {"kind": "some_future_kind", "ts": "t2", "payload": {"anything": "goes"}},
    ]
    out = project_call_from_events(_base_call(), events)
    assert out["stance"]["pick"] == "VAN"
    assert out["state"] == "draft"


# ==================== Lock strictness ====================

def test_lock_rejects_missing_explicit():
    err = validate_locked_event({"confirmation_prompt": "Lock VAN?"})
    assert err and "explicit=true" in err


def test_lock_rejects_missing_confirmation_context():
    err = validate_locked_event({"explicit": True})
    assert err and "explicit confirmation context" in err


def test_lock_accepts_voice_prompt():
    err = validate_locked_event({"explicit": True, "confirmation_prompt": "Lock VAN?", "user_response": "yep"})
    assert err is None


def test_lock_accepts_ui_button():
    err = validate_locked_event({"explicit": True, "ui_action": "lock_button_pressed"})
    assert err is None


def test_lock_rejects_positive_but_ambiguous_utterance():
    """The example the user called out: 'yeah I like Vancouver' — no explicit
    lock prompt in payload → not locked."""
    err = validate_locked_event({"explicit": True, "user_response": "yeah I like Vancouver"})
    assert err is not None   # rejected — no confirmation_prompt, no ui_action


# ==================== Accuracy summary ====================

def test_accuracy_excludes_draft_and_abandoned():
    calls = [
        {"id": "c1", "kind": "game_pick", "state": "resolved", "stance": {"reasoning_tags": []}, "first_instinct": None},
        {"id": "c2", "kind": "game_pick", "state": "abandoned", "stance": {"reasoning_tags": []}, "first_instinct": None},
        {"id": "c3", "kind": "game_pick", "state": "draft", "stance": {"reasoning_tags": []}, "first_instinct": None},
        {"id": "c4", "kind": "game_pick", "state": "locked", "stance": {"reasoning_tags": []}, "first_instinct": None},
    ]
    resolutions = {"c1": {"correct": True, "actual": {}}}
    s = accuracy_summary(calls, resolutions)
    assert s["total_resolved"] == 1   # abandoned/draft/locked excluded
    assert s["correct"] == 1
    assert s["accuracy_pct"] == 100.0


def test_accuracy_ungradeable_excluded_from_pct():
    calls = [
        {"id": "c1", "kind": "game_pick", "state": "resolved", "stance": {"reasoning_tags": []}, "first_instinct": None},
        {"id": "c2", "kind": "fantasy_lineup", "state": "resolved", "stance": {"reasoning_tags": []}, "first_instinct": None},
    ]
    resolutions = {
        "c1": {"correct": True, "actual": {}},
        "c2": {"correct": None, "actual": {}},   # fantasy ungradeable
    }
    s = accuracy_summary(calls, resolutions)
    assert s["gradeable"] == 1
    assert s["ungradeable"] == 1
    assert s["accuracy_pct"] == 100.0   # denominator excludes ungradeable
    assert s["by_kind"]["fantasy_lineup"]["ungradeable"] == 1


def test_accuracy_first_instinct_and_changed_mind_split():
    """User captured VAN first, revised to EDM. Outcome was VAN.
    - first_instinct hit rate: 1/1
    - changed_mind hit rate: 0/1 (they revised away from the winning pick)"""
    calls = [{
        "id": "c1", "kind": "game_pick", "state": "resolved",
        "stance": {"pick": "EDM", "reasoning_tags": []},
        "first_instinct": {"pick": "VAN", "captured_at": "t1", "source": "voice"},
    }]
    resolutions = {"c1": {"correct": False, "actual": {"pick": "VAN"}}}
    s = accuracy_summary(calls, resolutions)
    assert s["first_instinct_accuracy_pct"] == 100.0
    assert s["changed_mind_accuracy_pct"] == 0.0


# ==================== Legacy projection ====================

def test_legacy_prediction_projects_to_usercall_shape():
    pred = {"id": "p1", "user_name": "steve", "game_id": "g1", "pick": "home",
            "reasoning": "goalies", "resolved": True, "correct": True, "created_at": "t1"}
    out = project_legacy_prediction(pred)
    assert out["call"]["kind"] == "game_pick"
    assert out["call"]["stance"]["pick"] == "home"
    assert out["call"]["stance"]["reasoning_text"] == "goalies"
    assert out["call"]["state"] == "resolved"
    assert out["call"]["legacy_source"] == "predictions"
    assert out["resolution"]["correct"] is True
    assert out["resolution"]["grading_rule"] == "legacy_game_winner_v0"


def test_legacy_bet_prediction_only_yields_no_wager():
    bet = {"id": "b1", "device_id": "d1", "matchup": "BOS @ NJD", "bet_type": "moneyline",
           "selection": "NJD ML", "odds": "+150", "stake": 0, "prediction_only": True,
           "result": "win", "profit_loss": 0, "notes": "", "created_at": "t1",
           "home_or_away": "home", "fav_or_dog": "dog"}
    out = project_legacy_bet(bet)
    assert out["wager"] is None   # prediction-only bets never surface as wagers
    assert out["call"]["kind"] == "game_pick"
    assert out["resolution"]["outcome_status"] == "correct"


def test_legacy_bet_with_money_yields_wager():
    bet = {"id": "b1", "device_id": "d1", "matchup": "BOS @ NJD", "bet_type": "moneyline",
           "selection": "NJD ML", "odds": "+150", "stake": 100, "prediction_only": False,
           "result": "win", "profit_loss": 150, "notes": "", "created_at": "t1",
           "home_or_away": "home", "fav_or_dog": "dog"}
    out = project_legacy_bet(bet)
    assert out["wager"] is not None
    assert out["wager"]["stake"] == 100
    assert out["wager"]["settled"]["profit_loss"] == 150


# ==================== Reggie brief ====================

def test_brief_strips_spot_check_for_non_adult():
    user = {"id": "u1", "nickname": "N", "prefs": {"followed_teams": []},
            "eligibility": {"adult_features_unlocked": False, "attestation": None}}
    b = build_reggie_brief(user, [], {}, [], spot_check_state={"lean_in": 3})
    assert b["adult_features_unlocked"] is False
    assert "spot_check_state" not in b


def test_brief_includes_spot_check_for_adult():
    user = {"id": "u1", "nickname": "N", "prefs": {"followed_teams": []},
            "eligibility": {"adult_features_unlocked": True,
                            "attestation": {"method": "self_attestation_v1", "attested_at": "t",
                                            "policy_version": "v1", "jurisdiction": "CA"}}}
    b = build_reggie_brief(user, [], {}, [], spot_check_state={"lean_in": 3})
    assert b["adult_features_unlocked"] is True
    assert b["spot_check_state"] == {"lean_in": 3}
