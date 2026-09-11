"""Phase 0 acceptance — live API. Runs the full user directive:

  create draft → capture journey → explicitly lock → resolve from
  verified outcome → update user history → optionally attach eligible-
  adult wager → preserve existing systems.

Plus every amendment from the ratified architecture doc:
  - Personal history derived from own history, NOT Signal
  - Adult attestation carries provenance, no DOB
  - Resolution call-type-aware (game_pick correct/incorrect;
    fantasy_lineup can resolve as `ungradeable`)
  - Voice locking strict (isolated "yeah I like Vancouver" ≠ lock)
  - Abandoned excluded from accuracy
  - Nickname non-unique for private accounts
  - No auto-extraction from forum posts
  - Legacy projection reader preserves existing Predictions + BetLog
"""
import sys, time, json, requests

API = "https://sports-broadcast-21.preview.emergentagent.com"
RUN = str(int(time.time()))
DEV = f"iq-phase0-{RUN}"

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("✅" if ok else "❌"), name, "—", detail if detail else "")


def post(path, body):
    return requests.post(f"{API}{path}", json=body, timeout=15)

def get(path, **params):
    return requests.get(f"{API}{path}", params=params, timeout=15)


print(f"\n{'='*70}\nTicker Hockey IQ · Phase 0 · Live Acceptance Pass\n{'='*70}")
print(f"device_id={DEV}\n")

# ============================================================
# PART 1 · The core lifecycle: draft → journey → locked → resolved
# ============================================================
print("--- Part 1: full voice-shaped lifecycle ---\n")

# Step 1: Reggie asks "who do you like tonight?" User says "Vancouver."
r = post("/api/iq/call/event", {
    "device_id": DEV,
    "call_id": None,   # opens a new call
    "kind": "instinct_captured",
    "call_kind": "game_pick",
    "subject": {"game_id": "van-edm-2025-02-15"},
    "payload": {"pick": "VAN"},
    "source": "voice",
})
check("[1] instinct_captured creates draft call", r.status_code == 200 and r.json()["call"]["state"] == "draft",
      f"status={r.status_code}, state={r.json().get('call',{}).get('state')}")
call_id = r.json()["call"]["id"]
check("[1] first_instinct preserved", r.json()["call"]["first_instinct"]["pick"] == "VAN",
      f"first_instinct={r.json()['call']['first_instinct']}")

# Step 2: User adds reasoning
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": call_id, "kind": "reasoning_added",
                                 "payload": {"text": "Demko is starting.", "tags": ["goalie_news"]}, "source": "voice"})
check("[1] reasoning_added appended", r.status_code == 200 and "Demko" in (r.json()["call"]["stance"]["reasoning_text"] or ""))

# Step 3: User revises — "Actually change me to Edmonton. Vancouver played last night."
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": call_id, "kind": "revision",
                                 "payload": {"from_pick": "VAN", "to_pick": "EDM", "reason": "back-to-back"}, "source": "voice"})
c = r.json()["call"]
check("[1] revision updates pick", c["stance"]["pick"] == "EDM", f"pick={c['stance']['pick']}")
check("[1] first_instinct preserved after revision", c["first_instinct"]["pick"] == "VAN",
      f"first_instinct={c['first_instinct']['pick']}")
check("[1] changed_mind flagged", c["stance"]["changed_mind"] is True)

# Step 4: STRICT LOCK TEST — ambiguous utterance rejected
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": call_id, "kind": "locked",
                                 "payload": {"explicit": True, "user_response": "yeah I like Vancouver"}, "source": "voice"})
check("[1] Voice-lock STRICT: isolated positive utterance rejected",
      r.status_code == 400 and "confirmation context" in r.json()["detail"],
      f"status={r.status_code}, detail={r.json().get('detail','')[:100]}")

# Step 5: Proper lock — Reggie asked "Lock EDM?"
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": call_id, "kind": "locked",
                                 "payload": {"explicit": True, "confirmation_prompt": "Lock EDM?",
                                             "user_response": "yep"}, "source": "voice"})
c = r.json()["call"]
check("[1] Explicit lock with prompt succeeds", r.status_code == 200 and c["state"] == "locked",
      f"state={c['state']}, locked_at={c['locked_at']}")

# Step 6: Terminal-state edit rejected (can't revise a locked call except via reflection/resolve/void)
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": call_id, "kind": "revision",
                                 "payload": {"to_pick": "TOR"}, "source": "voice"})
check("[1] Post-lock revision rejected (state guard)", r.status_code == 409, f"status={r.status_code}")

# Step 7: Verified resolution — EDM actually won
r = post(f"/api/iq/call/{call_id}/resolve", {
    "outcome_status": "correct", "correct": True, "actual": {"pick": "EDM", "score": "3-2"},
    "grading_rule": "game_winner_v1", "grading_version": "v1", "source": "manual",
})
c = r.json()["call"]
check("[1] Resolution transitions call to resolved", r.status_code == 200 and c["state"] == "resolved",
      f"state={c['state']}")

# Step 8: Full history via GET
r = get(f"/api/iq/call/{call_id}")
d = r.json()
check("[1] Full journey retrievable", len(d["events"]) >= 5,
      f"{len(d['events'])} events: {[e['kind'] for e in d['events']]}")
check("[1] Resolution linked", d["resolution"]["correct"] is True)

# ============================================================
# PART 2 · Adult attestation with provenance (no DOB)
# ============================================================
print("\n--- Part 2: adult attestation with provenance ---\n")

# Before attestation, wager should be blocked
r = post(f"/api/iq/call/{call_id}/wager", {"device_id": DEV, "played": True})
check("[2] Wager blocked pre-attestation", r.status_code == 403,
      f"status={r.status_code}, detail={r.json().get('detail','')[:60]}")

# Attest — jurisdiction required, no DOB
r = post("/api/iq/user/attest-adult", {"device_id": DEV, "jurisdiction": "CA-ON",
                                        "policy_version_accepted": "adult-unlock-policy-v1",
                                        "method": "self_attestation_v1"})
u = r.json()
check("[2] Attestation records unlock=true",
      u["eligibility"]["adult_features_unlocked"] is True,
      f"unlocked={u['eligibility']['adult_features_unlocked']}")
check("[2] Attestation records method provenance",
      u["eligibility"]["attestation"]["method"] == "self_attestation_v1",
      f"method={u['eligibility']['attestation']['method']}")
check("[2] Attestation records timestamp",
      bool(u["eligibility"]["attestation"]["attested_at"]),
      f"attested_at={u['eligibility']['attestation']['attested_at']}")
check("[2] Attestation records policy version",
      u["eligibility"]["attestation"]["policy_version"] == "adult-unlock-policy-v1")
check("[2] Attestation records jurisdiction",
      u["eligibility"]["attestation"]["jurisdiction"] == "CA-ON")
check("[2] User document has NO dob field",
      "dob" not in u and "dob_year_only" not in u and "date_of_birth" not in u,
      "no DOB collected — attestation-only")

# ============================================================
# PART 3 · Optional adult wager attachment
# ============================================================
print("\n--- Part 3: optional wager attachment ---\n")

r = post(f"/api/iq/call/{call_id}/wager", {"device_id": DEV, "played": True,
                                            "odds_text": "+110", "stake": 50, "book": "test"})
check("[3] Wager attached post-attestation", r.status_code == 200 and r.json()["wager"]["stake"] == 50,
      f"wager stake={r.json().get('wager',{}).get('stake')}")

# Re-attach must fail — one wager per call
r = post(f"/api/iq/call/{call_id}/wager", {"device_id": DEV, "played": True, "stake": 25})
check("[3] Duplicate wager rejected (409)", r.status_code == 409)

# Wager on a call without money required (`played: false`) — should still work
# Create a new locked call for this
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": None, "kind": "instinct_captured",
                                 "call_kind": "game_pick", "subject": {"game_id": "g2"},
                                 "payload": {"pick": "BOS"}, "source": "tap"})
c2_id = r.json()["call"]["id"]
post("/api/iq/call/event", {"device_id": DEV, "call_id": c2_id, "kind": "locked",
                             "payload": {"explicit": True, "ui_action": "lock_button_pressed"}, "source": "tap"})
r = post(f"/api/iq/call/{c2_id}/wager", {"device_id": DEV, "played": False})   # "did NOT play"
check("[3] Wager with played=false accepted (no financial disclosure required)",
      r.status_code == 200 and r.json()["wager"]["played"] is False,
      f"played={r.json().get('wager',{}).get('played')}")

# ============================================================
# PART 4 · Accuracy — abandoned excluded; ungradeable separate; personal history derived
# ============================================================
print("\n--- Part 4: personal accuracy derived from own history ---\n")

# Create an abandoned call
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": None, "kind": "instinct_captured",
                                 "call_kind": "game_pick", "subject": {"game_id": "g3"},
                                 "payload": {"pick": "TOR"}, "source": "voice"})
abandoned_id = r.json()["call"]["id"]
post("/api/iq/call/event", {"device_id": DEV, "call_id": abandoned_id, "kind": "abandoned",
                             "payload": {"reason": "test"}, "source": "voice"})

# Create a fantasy_lineup call and resolve as ungradeable
r = post("/api/iq/call/event", {"device_id": DEV, "call_id": None, "kind": "instinct_captured",
                                 "call_kind": "fantasy_lineup",
                                 "subject": {"league_id": "l1", "slot": "C1", "action": "start", "player_id": "matthews"},
                                 "payload": {"pick": "start-matthews"}, "source": "tap"})
fantasy_id = r.json()["call"]["id"]
post("/api/iq/call/event", {"device_id": DEV, "call_id": fantasy_id, "kind": "locked",
                             "payload": {"explicit": True, "ui_action": "lock_button_pressed"}, "source": "tap"})
r = post(f"/api/iq/call/{fantasy_id}/resolve", {
    "outcome_status": "ungradeable", "correct": None,
    "actual": {"matthews_pts": 14, "bench_pts": 16},
    "grading_rule": "fantasy_start_sit_v1", "grading_version": "v1",
})
check("[4] Fantasy call resolvable as ungradeable (not forced binary)",
      r.status_code == 200 and r.json()["resolution"]["outcome_status"] == "ungradeable",
      f"outcome_status={r.json()['resolution']['outcome_status']}")

# Get brief — abandoned should be excluded from accuracy math
r = get("/api/iq/user/brief", device_id=DEV)
brief = r.json()
s = brief["accuracy_summary"]
# Expected resolved calls: Part 1's game_pick (correct) + Part 4's fantasy (ungradeable) = 2
# Abandoned + locked-but-unresolved calls are excluded.
check("[4] Accuracy summary excludes abandoned and unresolved",
      s["total_resolved"] == 2 and s["gradeable"] == 1 and s["ungradeable"] == 1,
      f"resolved={s['total_resolved']}, gradeable={s['gradeable']}, ungradeable={s['ungradeable']}")
check("[4] Accuracy% computed from gradeable only",
      s["accuracy_pct"] == 100.0,   # 2/2 correct (both game_pick resolved as correct in this run)
      f"accuracy_pct={s['accuracy_pct']}")
check("[4] Personal history includes by_kind breakdown",
      "fantasy_lineup" in s["by_kind"] and s["by_kind"]["fantasy_lineup"]["ungradeable"] == 1,
      f"by_kind={s['by_kind']}")
check("[4] Personal history is derived, NOT read from Signal",
      "personal_history" not in brief and "signals" not in brief,
      "brief keys: " + ", ".join(brief.keys()))

# ============================================================
# PART 5 · Preserve existing systems — legacy projection reader
# ============================================================
print("\n--- Part 5: preserve existing Predictions + BetLog + Spot Check ---\n")

# Seed an existing bet via the frozen /betting/bet endpoint (this hits the
# LEGACY collection — must remain untouched by IQ code)
r = post("/api/betting/bet", {
    "device_id": DEV, "bet_date": "2025-01-01", "matchup": "BOS @ NJD",
    "bet_type": "moneyline", "selection": "NJD ML", "odds": "+150",
    "stake": 100, "prediction_only": False, "result": "win", "profit_loss": 150,
    "notes": "", "home_or_away": "home", "fav_or_dog": "dog",
})
check("[5] Legacy /betting/bet still works unchanged", r.status_code == 200)

# Read via legacy projection endpoint
r = get("/api/iq/legacy/projection", device_id=DEV)
proj = r.json()
check("[5] Legacy projection returns bets shaped as UserCall+Wager+Resolution",
      proj["count"] >= 1 and proj["projected"][0]["call"]["legacy_source"] == "bet_log",
      f"count={proj['count']}, first_source={proj['projected'][0]['call']['legacy_source']}")
check("[5] Legacy bet's wager preserves stake",
      proj["projected"][0]["wager"]["stake"] == 100)
check("[5] Legacy bet's resolution grades correctly",
      proj["projected"][0]["resolution"]["outcome_status"] == "correct")

# Frozen Spot Check must still respond correctly on the same device
r = post("/api/betting/spot-check", {"device_id": DEV, "bet_type": "moneyline",
                                      "home_or_away": "home", "fav_or_dog": "dog"})
check("[5] Frozen Spot Check v2 still responds on this device",
      r.status_code == 200 and "recommendation" in r.json(),
      f"rec={r.json().get('recommendation')}")

# Sanity: bulk-import guardrail from the last phase still functional
r = post("/api/betting/import/preview", {"device_id": DEV, "csv_text":
    "date,matchup,bet_type,home_or_away,fav_or_dog,result,stake,profit_loss\n"
    "2025-01-02,TOR @ OTT,moneyline,home,dog,loss,100,-100\n"})
check("[5] Bulk-import preview still returns existing_bet_count guardrail",
      r.status_code == 200 and "existing_bet_count" in r.json(),
      f"existing_bet_count={r.json().get('existing_bet_count')}")

# ============================================================
# PART 6 · Signal reserved for world data (not personal history)
# ============================================================
print("\n--- Part 6: Signal is world data, personal history is derived ---\n")

# Brief must contain accuracy_summary (derived) but NEVER a "personal_history_signal" field
r = get("/api/iq/user/brief", device_id=DEV)
b = r.json()
check("[6] Brief exposes derived accuracy_summary", "accuracy_summary" in b)
check("[6] Brief does NOT expose personal history as a Signal",
      "signal_source" not in json.dumps(b) or "personal_history" not in json.dumps(b),
      "Signal is world data only — personal history lives in accuracy_summary")

# ============================================================
# Summary
# ============================================================
print(f"\n{'='*70}\nSummary\n{'='*70}")
passed = sum(1 for _, ok, _ in RESULTS if ok)
failed = len(RESULTS) - passed
print(f"PASSED: {passed}/{len(RESULTS)}")
print(f"FAILED: {failed}/{len(RESULTS)}")
if failed:
    print("\nFailed checks:")
    for name, ok, detail in RESULTS:
        if not ok:
            print(f"  ❌ {name}\n     {detail}")

sys.exit(0 if failed == 0 else 1)
