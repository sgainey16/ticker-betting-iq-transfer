"""Backend regression + new-endpoint tests for the Hockey IQ Product Integration Pass.

Covers:
- New: /iq/community/feed-enriched, /iq/community/specialists, /iq/dev/mode, /iq/dev/simulate-resolve
- Existing (regression): /iq/user/brief, /iq/reputation, /iq/leaderboard,
  /iq/community/public-calls, /iq/community/post, /iq/call/event,
  /iq/call/{id}/resolve, /iq/user/attest-adult
- End-to-end return-loop: seed 24 game_picks + 20 prop_picks -> resolve -> insights populated
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def fresh_device():
    return f"test-iq-{uuid.uuid4().hex[:10]}"


# ------------------------------------------------------------------
# NEW endpoints
# ------------------------------------------------------------------
class TestNewEndpoints:
    def test_dev_mode_enabled(self, s):
        r = s.get(f"{API}/iq/dev/mode")
        assert r.status_code == 200
        assert r.json().get("enabled") is True

    def test_feed_enriched_shape(self, s):
        r = s.get(f"{API}/iq/community/feed-enriched?limit=10")
        assert r.status_code == 200
        data = r.json()
        assert "feed" in data
        assert isinstance(data["feed"], list)
        # If any items exist, verify enrichment shape
        for item in data["feed"][:3]:
            assert "author" in item
            assert "specialty" in item["author"]  # may be None but key must exist
            assert "reputation_summary" in item["author"]

    def test_specialists_hockey_iq(self, s):
        r = s.get(f"{API}/iq/community/specialists?dimension=hockey_iq&limit=6")
        assert r.status_code == 200
        d = r.json()
        assert d["dimension"] == "hockey_iq"
        assert isinstance(d["specialists"], list)

    def test_specialists_invalid_dimension(self, s):
        r = s.get(f"{API}/iq/community/specialists?dimension=bogus")
        assert r.status_code == 400

    def test_specialists_all_dimensions(self, s):
        for dim in ["hockey_iq", "accuracy_overall", "community_cred", "fantasy_iq"]:
            r = s.get(f"{API}/iq/community/specialists?dimension={dim}")
            assert r.status_code == 200, f"{dim} failed"


# ------------------------------------------------------------------
# Existing endpoints regression
# ------------------------------------------------------------------
class TestExistingRegression:
    def test_user_brief(self, s, fresh_device):
        r = s.get(f"{API}/iq/user/brief?device_id={fresh_device}")
        assert r.status_code == 200
        d = r.json()
        assert "accuracy_summary" in d

    def test_reputation(self, s, fresh_device):
        r = s.get(f"{API}/iq/reputation?device_id={fresh_device}")
        assert r.status_code == 200
        assert "reputation" in r.json()

    def test_leaderboard(self, s):
        r = s.get(f"{API}/iq/leaderboard?dimension=hockey_iq")
        assert r.status_code == 200
        assert "leaderboard" in r.json()

    def test_public_calls(self, s):
        r = s.get(f"{API}/iq/community/public-calls?limit=5")
        assert r.status_code == 200

    def test_community_post_and_list(self, s, fresh_device):
        body = f"TEST_ post {uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/iq/community/post", json={
            "device_id": fresh_device, "kind": "discussion", "body": body,
        })
        assert r.status_code == 200
        r2 = s.get(f"{API}/iq/community/posts?limit=20")
        assert r2.status_code == 200

    def test_attest_adult(self, s, fresh_device):
        r = s.post(f"{API}/iq/user/attest-adult", json={
            "device_id": fresh_device,
            "jurisdiction": "US",
            "policy_version_accepted": "adult-unlock-policy-v1",
            "method": "self_attestation_v1",
        })
        assert r.status_code == 200


# ------------------------------------------------------------------
# End-to-end return loop
# ------------------------------------------------------------------
class TestReturnLoop:
    def _make_call(self, s, device_id, kind, pick, subject):
        """Create instinct -> confidence -> lock, return call_id."""
        r = s.post(f"{API}/iq/call/event", json={
            "device_id": device_id, "call_id": None, "kind": "instinct_captured",
            "call_kind": kind,
            "subject": subject,
            "payload": {"pick": pick}, "source": "tap",
        })
        assert r.status_code == 200, r.text
        cid = r.json()["call"]["id"]
        s.post(f"{API}/iq/call/event", json={
            "device_id": device_id, "call_id": cid, "kind": "confidence_set",
            "payload": {"value": 6}, "source": "tap",
        })
        s.post(f"{API}/iq/call/event", json={
            "device_id": device_id, "call_id": cid, "kind": "locked",
            "payload": {"explicit": True, "ui_action": "test",
                        "confirmation_prompt": "?", "user_response": "confirmed"},
            "source": "tap",
        })
        return cid

    def test_full_loop(self, s):
        device_id = f"test-loop-{uuid.uuid4().hex[:10]}"

        # Seed 24 game_picks (20 correct, 4 wrong)
        game_cids = []
        for i in range(24):
            cid = self._make_call(s, device_id, "game_pick",
                                  pick="HOME",
                                  subject={"game_id": f"g{i}", "home": "MTL", "away": "TOR"})
            game_cids.append(cid)

        # Seed 20 prop_picks (7 correct, 13 wrong)
        prop_cids = []
        for i in range(20):
            cid = self._make_call(s, device_id, "prop_pick",
                                  pick="OVER",
                                  subject={"prop_id": f"p{i}", "player": "TEST_player"})
            prop_cids.append(cid)

        # Resolve directly via /iq/call/{id}/resolve
        for i, cid in enumerate(game_cids):
            correct = i < 20  # first 20 correct
            r = s.post(f"{API}/iq/call/{cid}/resolve", json={
                "outcome_status": "correct" if correct else "incorrect",
                "correct": correct,
                "actual": {"final_score": "3-2"},
                "grading_rule": "test",
                "grading_version": "test-v1",
                "source": "test",
                "raw_evidence": {},
            })
            assert r.status_code == 200, f"resolve game {i} failed: {r.text}"

        for i, cid in enumerate(prop_cids):
            correct = i < 7  # first 7 correct
            r = s.post(f"{API}/iq/call/{cid}/resolve", json={
                "outcome_status": "correct" if correct else "incorrect",
                "correct": correct,
                "actual": {},
                "grading_rule": "test",
                "grading_version": "test-v1",
                "source": "test",
                "raw_evidence": {},
            })
            assert r.status_code == 200

        # Verify brief
        r = s.get(f"{API}/iq/user/brief?device_id={device_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["accuracy_summary"]["total_resolved"] >= 44
        assert d.get("insights"), f"Expected insights, got {d.get('insights')}"
        # coaching_line only populates in adult-betting context or specific priority codes;
        # here we require the key to exist. Frontend has fallbacks when None.
        assert "coaching_line" in d

    def test_simulate_resolve_endpoint(self, s):
        """Ensure /iq/dev/simulate-resolve resolves locked calls."""
        device_id = f"test-sim-{uuid.uuid4().hex[:10]}"
        # Create 3 locked calls
        for i in range(3):
            self._make_call(s, device_id, "game_pick", pick="HOME",
                            subject={"game_id": f"sim{i}", "home": "MTL", "away": "TOR"})
        r = s.post(f"{API}/iq/dev/simulate-resolve?device_id={device_id}")
        assert r.status_code == 200
        assert r.json()["resolved"] == 3
        # Verify user brief now has resolved calls
        r2 = s.get(f"{API}/iq/user/brief?device_id={device_id}")
        assert r2.json()["accuracy_summary"]["total_resolved"] == 3
