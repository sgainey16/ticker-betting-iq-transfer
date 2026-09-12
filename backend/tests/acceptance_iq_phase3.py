"""Phase 3 acceptance — five personas, five different Reggie reads.

Seeding via direct Mongo writes for speed (~2s vs ~2 min via HTTP).
Reading through the LIVE /api/iq/user/brief and /api/iq/user/insights
endpoints — those are what we're testing.
"""
import sys, time, uuid, requests, os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from pymongo import MongoClient

API = "https://sports-broadcast-21.preview.emergentagent.com"
RUN = str(int(time.time()))

MC = MongoClient(os.environ["MONGO_URL"])
DB = MC[os.environ["DB_NAME"]]

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(("✅" if ok else "❌"), name, "—", detail[:180])

def get(p, **params): return requests.get(f"{API}{p}", params=params, timeout=20)


def now_iso(offset_days=0):
    return (datetime.now(timezone.utc) - timedelta(days=offset_days)).isoformat()


def seed_user(device_id, nickname="Guest", adult=False, jurisdiction="US", followed_teams=None):
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id, "device_ids": [device_id], "nickname": nickname,
        "created_at": now_iso(60),
        "eligibility": {
            "adult_features_unlocked": adult,
            "attestation": {
                "method": "self_attestation_v1", "attested_at": now_iso(),
                "policy_version": "adult-unlock-policy-v1", "jurisdiction": jurisdiction,
                "revoked_at": None,
            } if adult else None,
        },
        "prefs": {
            "followed_teams": followed_teams or [], "followed_players": [],
            "voice_persona": "reggie", "public_nickname": None,
        },
    }
    DB.iq_users.insert_one(doc)
    return user_id


def seed_call(user_id, subject, first_pick, final_pick=None, confidence=None,
              tags=None, kind="game_pick", correct=None, actual_pick=None, days_ago=0):
    """Seed one resolved call + its events + its resolution — directly."""
    call_id = str(uuid.uuid4())
    ts = now_iso(days_ago)
    changed_mind = bool(final_pick and final_pick != first_pick)
    pick = final_pick if changed_mind else first_pick

    call_doc = {
        "id": call_id, "user_id": user_id, "kind": kind, "subject": subject,
        "stance": {
            "pick": pick, "confidence_1_10": confidence,
            "reasoning_text": None, "reasoning_tags": tags or [],
            "changed_mind": changed_mind, "time_to_lock_sec": 30,
        },
        "first_instinct": {"pick": first_pick, "captured_at": ts, "source": "tap"},
        "state": "resolved" if correct is not None else "locked",
        "visibility": "private", "published_at": None,
        "created_at": ts, "locked_at": ts,
        "resolved_at": ts if correct is not None else None,
        "context_snapshot": None, "wager_id": None,
    }
    DB.iq_calls.insert_one(call_doc)

    # Minimal event log — enough for the projector but we skip re-projecting since
    # we've written the final stance directly.
    events = [
        {"id": str(uuid.uuid4()), "call_id": call_id, "user_id": user_id, "ts": ts,
         "source": "tap", "kind": "instinct_captured", "payload": {"pick": first_pick}},
    ]
    if changed_mind:
        events.append({"id": str(uuid.uuid4()), "call_id": call_id, "user_id": user_id, "ts": ts,
                       "source": "tap", "kind": "revision", "payload": {"to_pick": final_pick}})
    if confidence:
        events.append({"id": str(uuid.uuid4()), "call_id": call_id, "user_id": user_id, "ts": ts,
                       "source": "tap", "kind": "confidence_set", "payload": {"value": confidence}})
    events.append({"id": str(uuid.uuid4()), "call_id": call_id, "user_id": user_id, "ts": ts,
                   "source": "tap", "kind": "locked",
                   "payload": {"explicit": True, "ui_action": "seed"}})
    if correct is not None:
        events.append({"id": str(uuid.uuid4()), "call_id": call_id, "user_id": user_id, "ts": ts,
                       "source": "system", "kind": "resolution_delivered",
                       "payload": {"outcome_status": "correct" if correct else "incorrect"}})
    DB.iq_events.insert_many(events)

    if correct is not None:
        DB.iq_resolutions.insert_one({
            "id": str(uuid.uuid4()), "call_id": call_id,
            "outcome_status": "correct" if correct else "incorrect",
            "correct": correct, "actual": {"pick": actual_pick or pick},
            "grading_rule": "game_winner_v1", "grading_version": "v1",
            "source": "seed", "resolved_at": ts, "raw_evidence": None,
        })
    return call_id


print(f"\n{'='*70}\nPhase 3 · Interpretation Layer · Five-Persona Acceptance\n{'='*70}\n")

t0 = time.time()

# ---- Persona A — first-instinct hero (revises frequently; first was right)
A = f"persona-a-{RUN}"
uid_a = seed_user(A)
for i in range(25):
    actual = "H" if i < 20 else "A"    # 20/25 landed with the first instinct
    seed_call(uid_a, {"game_id": f"a-{i}"}, first_pick="H", final_pick="A",
              confidence=5, correct=(actual == "A"), actual_pick=actual, days_ago=15 - (i % 15))

# ---- Persona B — kind split: strong props, weak game_picks
B = f"persona-b-{RUN}"
uid_b = seed_user(B)
for i in range(22):
    seed_call(uid_b, {"game_id": f"b-p-{i}"}, first_pick="over", kind="prop_pick",
              confidence=5, correct=(i < 17), actual_pick="over" if i < 17 else "under")
for i in range(22):
    seed_call(uid_b, {"game_id": f"b-g-{i}"}, first_pick="H", kind="game_pick",
              confidence=5, correct=(i < 9), actual_pick="H" if i < 9 else "A")

# ---- Persona C — overconfident: 25 high-conf calls, 40% accuracy
C = f"persona-c-{RUN}"
uid_c = seed_user(C)
for i in range(25):
    seed_call(uid_c, {"game_id": f"c-{i}"}, first_pick="H", confidence=9,
              correct=(i < 10), actual_pick="H" if i < 10 else "A")

# ---- Persona D — adult, recent volume spike + accuracy drop
D = f"persona-d-{RUN}"
uid_d = seed_user(D, adult=True)
# Old base: 30 calls spread over 90 days (~0.33/day baseline), 67% accuracy
for i in range(30):
    seed_call(uid_d, {"game_id": f"d-old-{i}"}, first_pick="H", confidence=5,
              correct=(i < 20), actual_pick="H" if i < 20 else "A",
              days_ago=90 - i * 3)   # 90, 87, 84 ... down to 3
# Recent burst: 20 calls in the last 6 days (~3.3/day = 10x baseline), 25% accuracy
for i in range(20):
    seed_call(uid_d, {"game_id": f"d-new-{i}"}, first_pick="H", confidence=5,
              correct=(i < 5), actual_pick="H" if i < 5 else "A",
              days_ago=(i % 6))

# ---- Persona E — MTL prop specialist
E = f"persona-e-{RUN}"
uid_e = seed_user(E)
for i in range(15):    # background at ~53%
    seed_call(uid_e, {"game_id": f"e-bg-{i}"}, first_pick="H", confidence=5,
              correct=(i < 8), actual_pick="H" if i < 8 else "A")
for i in range(25):    # specialty at 84%
    seed_call(uid_e, {"game_id": f"e-sp-{i}", "team_ref": "MTL"}, first_pick="over",
              kind="prop_pick", confidence=6,
              correct=(i < 21), actual_pick="over" if i < 21 else "under")

print(f"Seeded 5 personas in {time.time() - t0:.1f}s")

# ============================================================
# Read each persona's brief + insights
# ============================================================
briefs = {}
for name, dev in [("A", A), ("B", B), ("C", C), ("D", D), ("E", E)]:
    r = get("/api/iq/user/brief", device_id=dev)
    briefs[name] = r.json()

codes_by_persona = {n: [i["code"] for i in b.get("insights", [])] for n, b in briefs.items()}
print("\nInsight codes per persona:")
for n, codes in codes_by_persona.items():
    print(f"  {n}: {codes}")

# ============================================================
# Assertions
# ============================================================
check("[A] first_instinct_better surfaces (first-instinct hero)",
      "first_instinct_better" in codes_by_persona["A"],
      f"codes: {codes_by_persona['A']}")

check("[B] kind_strength AND kind_weakness both surface (kind split)",
      "kind_strength" in codes_by_persona["B"] and "kind_weakness" in codes_by_persona["B"],
      f"codes: {codes_by_persona['B']}")

check("[C] overconfidence surfaces (high-conf + low accuracy)",
      "overconfidence" in codes_by_persona["C"],
      f"codes: {codes_by_persona['C']}")

check("[D] recent_volume_up_accuracy_down surfaces",
      "recent_volume_up_accuracy_down" in codes_by_persona["D"],
      f"codes: {codes_by_persona['D']}")

d_coach = briefs["D"].get("coaching_line") or ""
check("[D] Adult coaching line uses 'passing is a position' family",
      ("passing" in d_coach.lower() or "selective" in d_coach.lower()),
      f"coaching: {d_coach[:200]}")

check("[E] specialist_category surfaces (narrow specialty)",
      "specialist_category" in codes_by_persona["E"],
      f"codes: {codes_by_persona['E']}")

check("[non-adult] A/B/C/E still get a coaching_line grounded in their own evidence",
      all((briefs[n].get("coaching_line") or "").strip() for n in ("A", "B", "C", "E")),
      f"coach values: " + ", ".join(f"{n}={briefs[n].get('coaching_line')!r}" for n in "ABCE"))

sets = {n: tuple(sorted(codes_by_persona[n])) for n in ("A", "B", "C", "D", "E")}
dupes = [(n1, n2) for n1 in sets for n2 in sets if n1 < n2 and sets[n1] == sets[n2]]
check("[qualitative] All five personas have DIFFERENT insight code sets",
      not dupes, f"duplicate pairs: {dupes}")

all_insights = [i for b in briefs.values() for i in b.get("insights", [])]
under = [i for i in all_insights if i["sample_size"] < 10]
check("[safety] No insight ever surfaces with sample_size < 10",
      not under, f"under: {[i['code'] for i in under]}")

bad_conf = [i for i in all_insights if i["confidence"] not in ("high", "medium")]
check("[safety] Every insight carries confidence in {high, medium}",
      not bad_conf, f"bad: {bad_conf}")

forbidden = ("guaranteed", "sure thing", "market edge", "you will win",
             "increase your stake", "bet more", "safe bet")
leaks = []
for i in all_insights:
    m = (i.get("marc_voice") or "").lower()
    for phrase in forbidden:
        if phrase in m:
            leaks.append((i["code"], phrase))
for n in ("A", "B", "C", "D", "E"):
    coach = (briefs[n].get("coaching_line") or "").lower()
    for phrase in forbidden:
        if phrase in coach:
            leaks.append((f"{n}_coaching", phrase))
check("[safety] No forbidden phrases in any Marc voice output",
      not leaks, f"leaks: {leaks}")

# Marc voice examples
print("\n--- Marc voice samples ---")
for n in ("A", "B", "C", "D", "E"):
    print(f"\n{n}:")
    for i in briefs[n].get("insights", [])[:2]:
        print(f"  · [{i['confidence']} · n={i['sample_size']}] {i['marc_voice']}")
    if briefs[n].get("coaching_line"):
        print(f"  ★ coach: {briefs[n]['coaching_line']}")

# Standalone endpoint parity
r = get("/api/iq/user/insights", device_id=B)
check("[endpoint] /iq/user/insights returns same insight set",
      set(i["code"] for i in r.json()["insights"]) == set(codes_by_persona["B"]))

# Community specialist consensus — publish E's specialty calls, then read
r = get("/api/iq/user", device_id=E)
e_uid = r.json()["id"]
DB.iq_calls.update_many({"user_id": e_uid, "kind": "prop_pick"},
                        {"$set": {"visibility": "public", "published_at": now_iso()}})
r = get("/api/iq/community/specialist-consensus", kind="prop_pick", dimension="hockey_iq")
sc = r.json()
check("[community] Specialist consensus exposes both distributions",
      "pick_distribution_all" in sc and "pick_distribution_specialists" in sc,
      f"all={sc.get('pick_distribution_all')}, spec={sc.get('pick_distribution_specialists')}")
check("[community] Specialists count exposed (evidence, not magic score)",
      "specialists_qualified_count" in sc,
      f"qualified_users={sc.get('specialists_qualified_count')}, spec_n={sc.get('specialist_only_n')}")

print(f"\n{'='*70}\nSummary\n{'='*70}")
passed = sum(1 for _, ok, _ in RESULTS if ok)
failed = len(RESULTS) - passed
print(f"PASSED: {passed}/{len(RESULTS)}")
print(f"FAILED: {failed}/{len(RESULTS)}")
if failed:
    print("\nFailed:")
    for n, ok, d in RESULTS:
        if not ok:
            print(f"  ❌ {n}\n     {d}")
sys.exit(0 if failed == 0 else 1)
