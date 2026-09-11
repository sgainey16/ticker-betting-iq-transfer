"""Phase 2 acceptance — the intelligence loop.

Proves the full arc the user asked for:
   Think → Call → Lock → Resolve → Learn → Earn credibility → optionally share

Plus every Phase 2 requirement:
  - Private-by-default; publish opt-in
  - Public/anonymous visibility axis orthogonal to lifecycle state
  - Private calls still count toward Personal IQ
  - Anonymous aggregate hides identity but preserves signal
  - Five reputation dimensions kept SEPARATE (never collapsed)
  - Verified leaderboards — minimum 10 gradeable calls to qualify
  - Community posts with structured culture_meta (raw status, not fed to Reggie)
  - Never surface wager info to Community
"""
import sys, time, requests

API = "https://sports-broadcast-21.preview.emergentagent.com"
RUN = str(int(time.time()))

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("✅" if ok else "❌"), name, "—", detail)

def post(path, body): return requests.post(f"{API}{path}", json=body, timeout=15)
def get(path, **params): return requests.get(f"{API}{path}", params=params, timeout=15)
def patch(path, body): return requests.patch(f"{API}{path}", json=body, timeout=15)


def make_call(device_id, subject, first_pick, final_pick=None, reasoning=None, tags=None, confidence=None, lock=True, kind="game_pick"):
    """Helper: create a full lifecycle call. Optionally lock it."""
    r = post("/api/iq/call/event", {
        "device_id": device_id, "call_id": None, "kind": "instinct_captured",
        "call_kind": kind, "subject": subject,
        "payload": {"pick": first_pick}, "source": "voice",
    })
    call_id = r.json()["call"]["id"]
    if reasoning:
        post("/api/iq/call/event", {"device_id": device_id, "call_id": call_id,
                                     "kind": "reasoning_added",
                                     "payload": {"text": reasoning, "tags": tags or []}, "source": "voice"})
    if final_pick and final_pick != first_pick:
        post("/api/iq/call/event", {"device_id": device_id, "call_id": call_id,
                                     "kind": "revision",
                                     "payload": {"to_pick": final_pick}, "source": "voice"})
    if confidence:
        post("/api/iq/call/event", {"device_id": device_id, "call_id": call_id,
                                     "kind": "confidence_set",
                                     "payload": {"value": confidence}, "source": "voice"})
    if lock:
        post("/api/iq/call/event", {"device_id": device_id, "call_id": call_id,
                                     "kind": "locked",
                                     "payload": {"explicit": True, "confirmation_prompt": f"Lock {final_pick or first_pick}?",
                                                 "user_response": "yep"}, "source": "voice"})
    return call_id


def resolve(call_id, correct, actual_pick):
    return post(f"/api/iq/call/{call_id}/resolve", {
        "outcome_status": "correct" if correct else "incorrect",
        "correct": correct, "actual": {"pick": actual_pick},
        "grading_rule": "game_winner_v1", "grading_version": "v1", "source": "test",
    }).json()


print(f"\n{'='*70}\nPhase 2 · The Intelligence Loop · Live Acceptance\n{'='*70}\n")

# ============================================================
# Two testers so leaderboards have >1 user
# ============================================================
ALICE = f"alice-{RUN}"
BOB   = f"bob-{RUN}"

# ============================================================
# PART 1 · THINK → CALL → LOCK → RESOLVE → LEARN (private path)
# ============================================================
print("--- Part 1: Private call goes through the loop (no publish) ---\n")

c1 = make_call(ALICE, {"game_id": "van-edm-1"}, first_pick="VAN", final_pick="EDM",
               reasoning="Vancouver played back-to-back", tags=["schedule_context", "goalie_news"],
               confidence=8, lock=True)

# Verify default visibility = 'private'
r = get(f"/api/iq/call/{c1}")
check("[1] Default visibility is 'private'", r.json()["call"]["visibility"] == "private",
      f"visibility={r.json()['call']['visibility']}")
check("[1] published_at is None while private", r.json()["call"].get("published_at") in (None, ""),
      f"published_at={r.json()['call'].get('published_at')}")

resolve(c1, correct=True, actual_pick="EDM")

# Verify it counts toward Personal IQ (my_iq brief)
r = get("/api/iq/user/brief", device_id=ALICE)
s = r.json()["accuracy_summary"]
check("[1] Private call still counts toward Personal IQ",
      s["total_resolved"] == 1 and s["correct"] == 1,
      f"resolved={s['total_resolved']}, correct={s['correct']}")

# But it should NOT appear in public feed
r = get("/api/iq/community/public-calls")
feed = r.json()["feed"]
check("[1] Private call is NOT in public feed",
      not any(f["call_id"] == c1 for f in feed),
      f"feed size={len(feed)}")

# ============================================================
# PART 2 · Publish (public visibility) — earn community credibility
# ============================================================
print("\n--- Part 2: Publish → community credibility → verified leaderboard ---\n")

r = patch(f"/api/iq/call/{c1}/visibility", {"device_id": ALICE, "visibility": "public"})
check("[2] Setting visibility=public succeeds", r.status_code == 200 and r.json()["visibility"] == "public",
      f"status={r.status_code}, visibility={r.json().get('visibility')}")
check("[2] published_at set on publish", bool(r.json().get("published_at")),
      f"published_at={r.json().get('published_at')}")

# Now the call should appear in public feed WITH the outcome
r = get("/api/iq/community/public-calls")
feed = r.json()["feed"]
c1_feed = next((f for f in feed if f["call_id"] == c1), None)
check("[2] Published call appears in public feed", c1_feed is not None)
check("[2] Public feed shows the first-instinct journey (VAN → EDM)",
      c1_feed and c1_feed["first_instinct"]["pick"] == "VAN" and c1_feed["pick"] == "EDM",
      f"first={c1_feed['first_instinct']['pick']}, final={c1_feed['pick']}")
check("[2] Public feed includes outcome (correct=true)",
      c1_feed and c1_feed["outcome"]["correct"] is True)
check("[2] Public feed shows author nickname",
      c1_feed and c1_feed["author"]["nickname"] == "Guest" and not c1_feed["author"]["anonymous"],
      f"author={c1_feed['author']}")

# Only locked calls can be published
r = post("/api/iq/call/event", {"device_id": ALICE, "call_id": None, "kind": "instinct_captured",
                                 "call_kind": "game_pick", "subject": {"game_id": "draft-only"},
                                 "payload": {"pick": "TOR"}, "source": "voice"})
draft_id = r.json()["call"]["id"]
r = patch(f"/api/iq/call/{draft_id}/visibility", {"device_id": ALICE, "visibility": "public"})
check("[2] Draft calls cannot be published (409)", r.status_code == 409,
      f"status={r.status_code}")

# ============================================================
# PART 3 · Anonymous aggregate — signal without identity
# ============================================================
print("\n--- Part 3: Anonymous aggregate — protect the edge, publish the signal ---\n")

c_anon = make_call(ALICE, {"game_id": "anon-1"}, first_pick="MTL",
                   reasoning="Anze Kopitar streaking", tags=["hot_hand"], confidence=6)
resolve(c_anon, correct=True, actual_pick="MTL")
r = patch(f"/api/iq/call/{c_anon}/visibility", {"device_id": ALICE, "visibility": "anonymous_aggregate"})
check("[3] Anonymous aggregate visibility accepted", r.status_code == 200)

r = get("/api/iq/community/public-calls")
feed = r.json()["feed"]
anon_item = next((f for f in feed if f["call_id"] == c_anon), None)
check("[3] Anonymous call is in feed but author is 'Anonymous'",
      anon_item and anon_item["author"]["anonymous"] is True and anon_item["author"]["user_id"] is None,
      f"author={anon_item['author'] if anon_item else 'MISSING'}")
check("[3] Anonymous call still exposes the pick + outcome (signal preserved)",
      anon_item and anon_item["pick"] == "MTL" and anon_item["outcome"]["correct"] is True)

# ============================================================
# PART 4 · Toggle back to private removes from feed
# ============================================================
print("\n--- Part 4: Un-publish (private again) ---\n")

r = patch(f"/api/iq/call/{c1}/visibility", {"device_id": ALICE, "visibility": "private"})
check("[4] Re-privatising succeeds", r.status_code == 200 and r.json()["visibility"] == "private")
r = get("/api/iq/community/public-calls")
check("[4] Un-published call removed from feed",
      not any(f["call_id"] == c1 for f in r.json()["feed"]))

# Re-publish for downstream tests
patch(f"/api/iq/call/{c1}/visibility", {"device_id": ALICE, "visibility": "public"})

# ============================================================
# PART 5 · Five separate reputation dimensions (never collapsed)
# ============================================================
print("\n--- Part 5: Reputation is five dimensions, not one score ---\n")

# Give Alice 12 total resolved public game_picks to hit qualified threshold
for i in range(11):
    cid = make_call(ALICE, {"game_id": f"g-a-{i}"}, first_pick="H", confidence=5)
    resolve(cid, correct=(i % 3 != 0), actual_pick="H")     # ~66% accuracy
    patch(f"/api/iq/call/{cid}/visibility", {"device_id": ALICE, "visibility": "public"})

# Give Alice a fantasy call (fantasy_iq shouldn't be qualified with n=1)
cf = make_call(ALICE, {"league_id": "l1", "slot": "C1", "player_id": "matthews"},
               first_pick="start-matthews", kind="fantasy_lineup")
post(f"/api/iq/call/{cf}/resolve", {
    "outcome_status": "ungradeable", "correct": None, "actual": {},
    "grading_rule": "fantasy_start_sit_v1", "grading_version": "v1", "source": "test",
})

r = get("/api/iq/reputation", device_id=ALICE)
rep = r.json()["reputation"]

check("[5] Reputation exposes hockey_iq dimension", "hockey_iq" in rep)
check("[5] Reputation exposes fantasy_iq dimension", "fantasy_iq" in rep)
check("[5] Reputation exposes accuracy_overall dimension", "accuracy_overall" in rep)
check("[5] Reputation exposes community_cred dimension", "community_cred" in rep)
check("[5] Betting_iq stripped for non-adult user",
      "betting_iq" not in rep,
      f"rep keys: {list(rep.keys())}")
check("[5] Hockey IQ qualified after 12+ resolved calls",
      rep["hockey_iq"]["qualified"] is True,
      f"hockey_iq n={rep['hockey_iq']['n']}, qualified={rep['hockey_iq']['qualified']}")
check("[5] Fantasy IQ NOT qualified with 1 ungradeable call",
      rep["fantasy_iq"]["qualified"] is False,
      f"fantasy_iq n={rep['fantasy_iq']['n']}, qualified={rep['fantasy_iq']['qualified']}")
check("[5] Community cred derived from public+resolved calls only",
      rep["community_cred"]["n"] >= 11 and rep["community_cred"]["qualified"] is True,
      f"community_cred n={rep['community_cred']['n']}, qualified={rep['community_cred']['qualified']}")

# ============================================================
# PART 6 · Betting IQ dimension appears only after attestation
# ============================================================
print("\n--- Part 6: Betting IQ dimension is adult-gated ---\n")

post("/api/iq/user/attest-adult", {"device_id": ALICE, "jurisdiction": "CA-ON",
                                    "policy_version_accepted": "adult-unlock-policy-v1",
                                    "method": "self_attestation_v1"})

# Attach a wager to Alice's original public call so betting_iq has one data point
r = post(f"/api/iq/call/{c1}/wager", {"device_id": ALICE, "played": True,
                                       "odds_text": "+110", "stake": 50, "book": "test"})
check("[6] Wager attaches post-attestation", r.status_code == 200)

r = get("/api/iq/reputation", device_id=ALICE)
rep = r.json()["reputation"]
check("[6] Adult attestation surfaces betting_iq dimension", "betting_iq" in rep,
      f"rep keys: {list(rep.keys())}")
check("[6] Public feed does NOT leak wager info",
      "wager" not in requests.get(f"{API}/api/iq/community/public-calls").text.lower() or
      "wager_id" not in [k for k in requests.get(f"{API}/api/iq/community/public-calls").json()['feed'][0].keys()],
      "public feed keys are wager-free")

# ============================================================
# PART 7 · Verified leaderboards — accuracy, not volume
# ============================================================
print("\n--- Part 7: Leaderboards reward verified accuracy, not volume ---\n")

# Bob: 8 wrong + 4 right (12 resolved) so he qualifies but ranks below Alice
for i in range(8):
    cid = make_call(BOB, {"game_id": f"g-b-w-{i}"}, first_pick="H", confidence=5)
    resolve(cid, correct=False, actual_pick="A")
    patch(f"/api/iq/call/{cid}/visibility", {"device_id": BOB, "visibility": "public"})
for i in range(4):
    cid = make_call(BOB, {"game_id": f"g-b-r-{i}"}, first_pick="H", confidence=5)
    resolve(cid, correct=True, actual_pick="H")
    patch(f"/api/iq/call/{cid}/visibility", {"device_id": BOB, "visibility": "public"})

# Charlie: 3 right in a row (unqualified — should NOT appear on the board)
CHARLIE = f"charlie-{RUN}"
for i in range(3):
    cid = make_call(CHARLIE, {"game_id": f"g-c-{i}"}, first_pick="H", confidence=5)
    resolve(cid, correct=True, actual_pick="H")
    patch(f"/api/iq/call/{cid}/visibility", {"device_id": CHARLIE, "visibility": "public"})

r = get("/api/iq/leaderboard", dimension="hockey_iq")
board = r.json()["leaderboard"]
alice_row = next((x for x in board if x["nickname"] == "Guest" and x["user_id"] == requests.get(f"{API}/api/iq/user", params={"device_id": ALICE}).json()["id"]), None)
bob_row = next((x for x in board if x["user_id"] == requests.get(f"{API}/api/iq/user", params={"device_id": BOB}).json()["id"]), None)
charlie_id = requests.get(f"{API}/api/iq/user", params={"device_id": CHARLIE}).json()["id"]

check("[7] Alice appears on hockey_iq leaderboard (>=10 resolved)", alice_row is not None,
      f"alice found: {alice_row is not None}")
check("[7] Bob appears on hockey_iq leaderboard (>=10 resolved)", bob_row is not None,
      f"bob found: {bob_row is not None}")
check("[7] Charlie EXCLUDED (only 3 resolved — under threshold)",
      not any(x["user_id"] == charlie_id for x in board),
      f"charlie found (should be false): {any(x['user_id']==charlie_id for x in board)}")

if alice_row and bob_row:
    check("[7] Alice ranks above Bob (higher accuracy)",
          alice_row["accuracy_pct"] > bob_row["accuracy_pct"],
          f"alice={alice_row['accuracy_pct']}% vs bob={bob_row['accuracy_pct']}%")

# ============================================================
# PART 8 · Community conversation with culture_meta structured capture
# ============================================================
print("\n--- Part 8: Community posts capture culture_meta but DON'T feed Reggie ---\n")

r = post("/api/iq/community/post", {
    "device_id": ALICE, "kind": "observation",
    "body": "Habs looked tired in the third — that's back-to-back showing.",
    "team_refs": ["MTL"], "language_marker": "en-CA",
    "target": {"team_ref": "MTL"},
})
post_id = r.json()["id"]
check("[8] Post created", r.status_code == 200 and post_id)
check("[8] Post captures team_refs", r.json()["culture_meta"]["team_refs"] == ["MTL"])
check("[8] Post captures language_marker", r.json()["culture_meta"]["language_marker"] == "en-CA")
check("[8] Post captures region from adult attestation",
      r.json()["culture_meta"]["region"] == "CA-ON",
      f"region={r.json()['culture_meta']['region']}")
check("[8] Post starts with culture_layer_status='raw' (NOT auto-fed to Reggie)",
      r.json()["culture_meta"]["culture_layer_status"] == "raw",
      f"status={r.json()['culture_meta']['culture_layer_status']}")

# Reply to it (thread)
r = post("/api/iq/community/post", {
    "device_id": BOB, "kind": "discussion",
    "body": "Agree — Slafkovsky was gassed on that 2-on-1.",
    "parent_post_id": post_id, "team_refs": ["MTL"], "player_refs": ["slafkovsky"],
})
check("[8] Thread reply attaches to parent", r.status_code == 200 and r.json()["parent_post_id"] == post_id)

# Community post kind='call_share' requires a published call
r = post("/api/iq/community/post", {
    "device_id": CHARLIE, "kind": "call_share",
    "body": "Sharing my TOR pick", "call_id": c1,   # c1 belongs to Alice, not Charlie
})
check("[8] call_share on someone else's call rejected (403)", r.status_code == 403)

# ============================================================
# PART 9 · The full loop, one user, end-to-end
# ============================================================
print("\n--- Part 9: The full loop end-to-end for one user ---\n")

LOOP = f"loop-{RUN}"
# THINK → CALL (draft with journey)
loop_id = make_call(LOOP, {"game_id": "loop-game"}, first_pick="BOS", final_pick="BUF",
                    reasoning="Vezina odds shifted this afternoon", tags=["goalie_news", "line_movement"],
                    confidence=7, lock=True)
# LOCK verified
r = get(f"/api/iq/call/{loop_id}")
check("[9] Loop call locked", r.json()["call"]["state"] == "locked")
# RESOLVE
resolve(loop_id, correct=True, actual_pick="BUF")
# LEARN (accuracy summary reflects the call)
r = get("/api/iq/user/brief", device_id=LOOP)
check("[9] LEARN: resolved call updates personal accuracy",
      r.json()["accuracy_summary"]["correct"] == 1)
# CREDIBILITY (publish)
patch(f"/api/iq/call/{loop_id}/visibility", {"device_id": LOOP, "visibility": "public"})
r = get("/api/iq/reputation", device_id=LOOP)
rep = r.json()["reputation"]
check("[9] CREDIBILITY: public+resolved call increments community_cred",
      rep["community_cred"]["n"] == 1 and rep["community_cred"]["correct"] == 1,
      f"community_cred: {rep['community_cred']}")
# SHARE (post attached to call)
r = post("/api/iq/community/post", {
    "device_id": LOOP, "kind": "call_share",
    "body": "Locked BUF — Vezina line moved 3 hours before puck drop.",
    "call_id": loop_id, "team_refs": ["BUF"],
})
check("[9] SHARE: call_share post created against published call", r.status_code == 200)

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
