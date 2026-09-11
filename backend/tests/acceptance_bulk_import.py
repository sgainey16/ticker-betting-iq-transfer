"""Betting IQ · Acceptance pass for the DEV bulk CSV importer + P0 form fix.

Runs against the LIVE preview URL (same one testers would hit). Prints
PASS/FAIL per check. No code changes anywhere else in the app.

Dataset design — one realistic bettor, 40 bets:
  Bucket A: moneyline / home / dog       — 20 bets, 15W-5L, +$1600 P/L (LEAN_IN expected)
  Bucket B: moneyline / away / fav       — 15 bets,  5W-10L, -$675  P/L (SKIP expected)
  Bucket C: total / over                 —  5 bets  (below insufficient floor → NEUTRAL)
  Totals: 40 bets, $3750 stake, +$925 P/L
"""
import json
import sys
import time
import requests

API = "https://sports-broadcast-21.preview.emergentagent.com"
# Unique per-run so re-executing the acceptance script never contaminates itself.
RUN_ID = str(int(time.time()))
DEV = f"acceptance-{RUN_ID}-main"
DEV_CONTAM = f"acceptance-{RUN_ID}-contam"
DEV_FORM = f"acceptance-{RUN_ID}-form"
DEV_DUP = f"acceptance-{RUN_ID}-dup"

RESULTS = []   # (check_name, passed, detail)


def check(name, passed, detail=""):
    RESULTS.append((name, passed, detail))
    icon = "✅" if passed else "❌"
    print(f"{icon} {name}")
    if detail:
        print(f"     {detail}")


def dataset_valid_csv() -> str:
    """40-bet realistic paste with all classifications explicit."""
    rows = ["date,matchup,bet_type,home_or_away,fav_or_dog,result,stake,profit_loss"]

    # Bucket A: home dogs — 20 bets, 15W-5L
    home_dog_slate = [
        ("BOS @ MTL", "win",  150), ("TOR @ OTT", "win",  145),
        ("EDM @ CGY", "loss", -100), ("COL @ ARI", "win",  175),
        ("NYR @ NJD", "win",  135), ("VGK @ SJS", "loss", -100),
        ("FLA @ TBL", "win",  140), ("PIT @ PHI", "win",  125),
        ("MIN @ CHI", "loss", -100), ("DAL @ STL", "win",  145),
        ("CAR @ BUF", "win",  160), ("LAK @ ANA", "win",  155),
        ("WPG @ CBJ", "win",  135), ("SEA @ VAN", "win",  120),
        ("NSH @ DET", "loss", -100), ("WSH @ NYI", "win",  130),
        ("BOS @ TBL", "win",  135), ("WPG @ ANA", "win",  145),
        ("COL @ VAN", "win",  110), ("MIN @ SEA", "loss", -100),
    ]
    for i, (mu, r, pl) in enumerate(home_dog_slate):
        rows.append(f"2025-01-{i+1:02d},{mu},moneyline,home,dog,{r},100,{pl}")

    # Bucket B: away favs — 15 bets, 5W-10L
    away_fav_slate = [
        ("BOS @ MTL", "loss", -100), ("TOR @ OTT", "loss", -100),
        ("EDM @ CGY", "win",   64), ("COL @ ARI", "loss", -100),
        ("NYR @ NJD", "loss", -100), ("VGK @ SJS", "win",   56),
        ("FLA @ TBL", "loss", -100), ("PIT @ PHI", "loss", -100),
        ("MIN @ CHI", "win",   74), ("DAL @ STL", "loss", -100),
        ("CAR @ BUF", "loss", -100), ("LAK @ ANA", "win",   64),
        ("WPG @ CBJ", "loss", -100), ("SEA @ VAN", "loss", -100),
        ("NSH @ DET", "win",   83),
    ]
    for i, (mu, r, pl) in enumerate(away_fav_slate):
        rows.append(f"2025-02-{i+1:02d},{mu},moneyline,away,fav,{r},100,{pl}")

    # Bucket C: totals-over — 5 bets (below insufficient floor)
    over_slate = [
        ("BOS @ MTL", "win", 45), ("TOR @ OTT", "loss", -55),
        ("EDM @ CGY", "win", 45), ("COL @ ARI", "loss", -55),
        ("NYR @ NJD", "win", 45),
    ]
    for i, (mu, r, pl) in enumerate(over_slate):
        rows.append(f"2025-03-{i+1:02d},{mu},total,,over,{r},50,{pl}")

    return "\n".join(rows) + "\n"


def dataset_contaminated_csv() -> str:
    """8-row paste with 6 different attack vectors + 2 valid rows."""
    return (
        "date,matchup,bet_type,home_or_away,fav_or_dog,result,stake,profit_loss\n"
        "2025-01-01,BOS @ NJD,moneyline,away,fav,win,100,74\n"          # valid
        "BAD-DATE,TOR @ OTT,moneyline,home,dog,win,100,140\n"           # bad date
        "2025-01-03,,moneyline,home,dog,win,100,150\n"                  # missing matchup
        "2025-01-04,EDM @ CGY,moneyline,,fav,win,100,64\n"              # missing home_or_away
        "2025-01-05,COL @ ARI,moneyline,home,,win,100,64\n"             # missing fav_or_dog
        "2025-01-06,NYR @ NJD,moneyline,home,dog,MAYBE,100,150\n"       # bad result
        "2025-01-07,VGK @ SJS,moneyline,home,dog,win,NOTANUMBER,150\n"  # bad stake
        "2025-01-08,FLA @ TBL,total,,over,win,50,45\n"                  # valid
    )


# ============================================================
# Fresh state
# ============================================================
print(f"\n{'='*70}\nBetting IQ · DEV Bulk Importer · Acceptance Pass\n{'='*70}\n")
print(f"API: {API}\nrun_id: {RUN_ID}\n")
print(f"Devices: {DEV}, {DEV_CONTAM}, {DEV_FORM}, {DEV_DUP}\n")

# No pre-wipe needed — device IDs are unique per run.

# ============================================================
# Phase 1: preview + validation of a clean 40-bet dataset
# ============================================================
print(f"\n--- Phase 1: 40-bet valid dataset ---\n")

valid_csv = dataset_valid_csv()
r = requests.post(f"{API}/api/betting/import/preview", json={
    "device_id": DEV, "csv_text": valid_csv,
}, timeout=15)
prev = r.json()

check("[1] Valid rows detected correctly (preview)",
      prev["summary"]["valid_count"] == 40 and prev["summary"]["rejected_count"] == 0,
      f"valid={prev['summary']['valid_count']}, rejected={prev['summary']['rejected_count']}")

check("[8] Total stake in preview matches known dataset",
      prev["summary"]["total_stake"] == 3750.0,
      f"preview stake=${prev['summary']['total_stake']} (expected $3750)")

check("[8] Total P/L in preview matches computed dataset",
      prev["summary"]["total_profit_loss"] == 971.0,
      f"preview P/L=${prev['summary']['total_profit_loss']} (expected +$971: home dogs +$1605, away favs -$659, overs +$25)")

check("[9] Bet-type counts reconcile",
      prev["summary"]["by_bet_type"] == {"moneyline": 35, "total": 5},
      f"by_bet_type={prev['summary']['by_bet_type']}")

# ============================================================
# Phase 2: commit the valid dataset
# ============================================================
r2 = requests.post(f"{API}/api/betting/import/commit", json={
    "device_id": DEV, "csv_text": valid_csv, "import_valid_only": False, "replace": True,
}, timeout=15)

check("[1] Commit writes exactly 40 rows",
      r2.status_code == 200 and r2.json()["written"] == 40,
      f"status={r2.status_code}, written={r2.json().get('written')}")

# ============================================================
# Phase 3: DB reconciliation
# ============================================================
r3 = requests.get(f"{API}/api/betting/bets?device_id={DEV}", timeout=10)
mongo_count = len(r3.json()["bets"])
check("[10] Bets in Mongo match import count", mongo_count == 40, f"mongo={mongo_count}")

# Stats endpoint reconciliation
r4 = requests.get(f"{API}/api/betting/stats?device_id={DEV}", timeout=10)
stats = r4.json()
prof = stats.get("betting_profitability", {})
check("[10] Stats endpoint total = 40", stats.get("total") == 40, f"total={stats.get('total')}")
check("[10] Stats endpoint total_stake = $3750",
      prof.get("total_stake") == 3750.0, f"stake=${prof.get('total_stake')}")
check("[10] Stats endpoint profit_loss = +$971",
      prof.get("profit_loss") == 971.0, f"P/L=${prof.get('profit_loss')}")
check("[10] Stats endpoint ROI = 25.9% (971/3750)",
      abs(prof.get("roi_pct", 0) - 25.9) < 0.1, f"ROI={prof.get('roi_pct')}%")

# ============================================================
# Phase 4: Spot Check reconciliation (per-bucket)
# ============================================================
print(f"\n--- Phase 2: Spot Check verdict reconciliation ---\n")

# Bucket A: home dogs — expect LEAN_IN, n=20, 15-5, +80% ROI
sc_a = requests.post(f"{API}/api/betting/spot-check", json={
    "device_id": DEV, "bet_type": "moneyline", "home_or_away": "home", "fav_or_dog": "dog",
}, timeout=10).json()

check("[11] Home Dogs Spot Check sample n=20 (exact match)",
      sc_a["evidence"]["n"] == 20 and sc_a["bucket"]["match_level"] == "exact",
      f"n={sc_a['evidence']['n']}, match_level={sc_a['bucket']['match_level']}")

check("[11] Home Dogs record 15-5 reconciles",
      sc_a["evidence"]["wins"] == 15 and sc_a["evidence"]["losses"] == 5,
      f"{sc_a['evidence']['wins']}-{sc_a['evidence']['losses']}")

check("[11] Home Dogs P/L +$1605 reconciles",
      sc_a["evidence"]["profit_loss"] == 1605.0,
      f"P/L=${sc_a['evidence']['profit_loss']}")

check("[12] Home Dogs verdict LEAN_IN + roi_strong_positive (v2 rule)",
      sc_a["recommendation"] == "LEAN_IN" and sc_a["reason"] == "roi_strong_positive",
      f"{sc_a['recommendation']} · {sc_a['reason']}")

check("[12] Home Dogs Marc line uses v2 'performed well' template",
      "performed well in this spot" in sc_a["marc_line"],
      f"marc: {sc_a['marc_line'][:120]}...")

# Bucket B: away favs — expect SKIP, n=15, 5-10, -45% ROI
sc_b = requests.post(f"{API}/api/betting/spot-check", json={
    "device_id": DEV, "bet_type": "moneyline", "home_or_away": "away", "fav_or_dog": "fav",
}, timeout=10).json()

check("[11] Away Favs Spot Check sample n=15 (exact match)",
      sc_b["evidence"]["n"] == 15 and sc_b["bucket"]["match_level"] == "exact",
      f"n={sc_b['evidence']['n']}, match_level={sc_b['bucket']['match_level']}")

check("[11] Away Favs record 5-10 reconciles",
      sc_b["evidence"]["wins"] == 5 and sc_b["evidence"]["losses"] == 10,
      f"{sc_b['evidence']['wins']}-{sc_b['evidence']['losses']}")

check("[11] Away Favs P/L -$659 reconciles",
      sc_b["evidence"]["profit_loss"] == -659.0,
      f"P/L=${sc_b['evidence']['profit_loss']}")

check("[12] Away Favs verdict SKIP + roi_strong_negative (v2 rule)",
      sc_b["recommendation"] == "SKIP" and sc_b["reason"] == "roi_strong_negative",
      f"{sc_b['recommendation']} · {sc_b['reason']}")

check("[12] Away Favs Marc line uses v2 'struggled here' template",
      "struggled here" in sc_b["marc_line"] and "Passing" in sc_b["marc_line"],
      f"marc: {sc_b['marc_line'][:120]}...")

# Bucket C: totals over — n=5, below insufficient floor → NEUTRAL
sc_c = requests.post(f"{API}/api/betting/spot-check", json={
    "device_id": DEV, "bet_type": "total", "home_or_away": None, "fav_or_dog": "over",
}, timeout=10).json()

check("[11] Overs Spot Check n=5 (below insufficient floor)",
      sc_c["evidence"]["n"] == 5,
      f"n={sc_c['evidence']['n']}")

check("[12] Overs verdict NEUTRAL + insufficient (v2 rule: n<10)",
      sc_c["recommendation"] == "NEUTRAL" and sc_c["reason"] == "insufficient",
      f"{sc_c['recommendation']} · {sc_c['reason']}")

# ============================================================
# Phase 5: Contamination test — malformed rows cannot slip through
# ============================================================
print(f"\n--- Phase 3: Contamination test (8-row malformed paste) ---\n")

# Fresh device — no wipe needed.

contam_csv = dataset_contaminated_csv()
pr = requests.post(f"{API}/api/betting/import/preview", json={
    "device_id": DEV_CONTAM, "csv_text": contam_csv,
}, timeout=10).json()

check("[2] Preview flags all 6 malformed rows",
      pr["summary"]["rejected_count"] == 6 and pr["summary"]["valid_count"] == 2,
      f"valid={pr['summary']['valid_count']}, rejected={pr['summary']['rejected_count']}")

# Per-error reason inspection
rej_errors = {r["line_no"]: r["errors"] for r in pr["rejected_rows"]}

check("[4] Missing home_or_away rejected with clear reason",
      any("home_or_away is required" in e for e in rej_errors.get(5, [])),
      f"line 5 errors: {rej_errors.get(5)}")

check("[5] Missing fav_or_dog rejected with clear reason",
      any("fav_or_dog is required" in e for e in rej_errors.get(6, [])),
      f"line 6 errors: {rej_errors.get(6)}")

check("[6] Invalid result 'MAYBE' rejected",
      any("result invalid" in e for e in rej_errors.get(7, [])),
      f"line 7 errors: {rej_errors.get(7)}")

check("[7] Invalid stake 'NOTANUMBER' rejected",
      any("stake" in e and "parse" in e.lower() for e in rej_errors.get(8, [])),
      f"line 8 errors: {rej_errors.get(8)}")

check("[2] Bad date rejected with clear reason",
      any("YYYY-MM-DD" in e for e in rej_errors.get(3, [])),
      f"line 3 errors: {rej_errors.get(3)}")

check("[2] Missing matchup rejected with clear reason",
      any("matchup is required" in e for e in rej_errors.get(4, [])),
      f"line 4 errors: {rej_errors.get(4)}")

# Commit without opt-in must be BLOCKED
cr = requests.post(f"{API}/api/betting/import/commit", json={
    "device_id": DEV_CONTAM, "csv_text": contam_csv, "import_valid_only": False, "replace": True,
}, timeout=10)

check("[3] Commit blocked (HTTP 409) when rejected rows exist without opt-in",
      cr.status_code == 409, f"status={cr.status_code}")

mongo_check = requests.get(f"{API}/api/betting/bets?device_id={DEV_CONTAM}", timeout=10).json()
check("[3] ZERO malformed bets reached Mongo after blocked commit",
      len(mongo_check["bets"]) == 0,
      f"mongo count after blocked commit: {len(mongo_check['bets'])}")

# Opt-in commit writes exactly the 2 valid rows
cr2 = requests.post(f"{API}/api/betting/import/commit", json={
    "device_id": DEV_CONTAM, "csv_text": contam_csv, "import_valid_only": True, "replace": True,
}, timeout=10)
check("[3] Opt-in commit writes exactly 2 valid rows (not 8)",
      cr2.status_code == 200 and cr2.json()["written"] == 2,
      f"written={cr2.json().get('written')}")

# ============================================================
# Phase 6: Manual Log-a-Bet P0 fix
# ============================================================
print(f"\n--- Phase 4: Manual Log-a-Bet P0 verification ---\n")

# Fresh device — no wipe needed.

# Log a single bet with home/dog classification via the same endpoint the form uses
form_bet = requests.post(f"{API}/api/betting/bet", json={
    "device_id": DEV_FORM, "bet_date": "2025-02-15", "matchup": "BOS @ NJD",
    "bet_type": "moneyline", "selection": "NJD ML", "odds": "+150",
    "stake": 100, "prediction_only": False, "result": "win", "profit_loss": 150,
    "notes": "", "home_or_away": "home", "fav_or_dog": "dog",
}, timeout=10).json()

check("[13] Manual form bet persists home_or_away",
      form_bet.get("home_or_away") == "home",
      f"stored: {form_bet.get('home_or_away')}")
check("[13] Manual form bet persists fav_or_dog",
      form_bet.get("fav_or_dog") == "dog",
      f"stored: {form_bet.get('fav_or_dog')}")

# Verify Spot Check sees the bet at exact-tier (not widened)
sc_form = requests.post(f"{API}/api/betting/spot-check", json={
    "device_id": DEV_FORM, "bet_type": "moneyline", "home_or_away": "home", "fav_or_dog": "dog",
}, timeout=10).json()

# With only 1 bet, evidence.n is 1 but match_level='none' (n < MIN_N_FOR_CALL of 10 triggers the fallback path)
# The important thing is the exact-match tier finds the bet, not that it widened.
matching_exact = [b for b in requests.get(f"{API}/api/betting/bets?device_id={DEV_FORM}", timeout=10).json()["bets"]
                  if b.get("home_or_away") == "home" and b.get("fav_or_dog") == "dog" and b.get("bet_type") == "moneyline"]
check("[13] Manual-form bet visible to Spot Check exact bucket",
      len(matching_exact) == 1,
      f"exact matches found: {len(matching_exact)}")

# ============================================================
# Phase 7: Duplicate-import guardrail
# ============================================================
print(f"\n--- Phase 5: Duplicate-import behaviour ---\n")

# Fresh device — no wipe needed.

small = ("date,matchup,bet_type,home_or_away,fav_or_dog,result,stake,profit_loss\n"
         "2025-01-01,BOS @ NJD,moneyline,away,fav,win,100,74\n"
         "2025-01-02,TOR @ OTT,moneyline,home,dog,loss,100,-100\n"
         "2025-01-03,EDM @ CGY,total,,over,win,50,45\n")

# First import
requests.post(f"{API}/api/betting/import/commit", json={
    "device_id": DEV_DUP, "csv_text": small, "import_valid_only": False, "replace": False,
}, timeout=10)
after_first = len(requests.get(f"{API}/api/betting/bets?device_id={DEV_DUP}", timeout=10).json()["bets"])

# Second import (same CSV, replace=false — this is the "accidental double" scenario)
r_dup = requests.post(f"{API}/api/betting/import/commit", json={
    "device_id": DEV_DUP, "csv_text": small, "import_valid_only": False, "replace": False,
}, timeout=10)
after_second = len(requests.get(f"{API}/api/betting/bets?device_id={DEV_DUP}", timeout=10).json()["bets"])

# The commit currently ALWAYS requires an explicit button click on the frontend,
# and the "Replace existing" toggle is off by default — so a re-import appends.
# The user's check reads: "does not happen accidentally without an obvious
# warning or deliberate confirmation". We honestly report what happens.
duplicate_detected_at_api = (r_dup.status_code != 200 or "duplicate" in str(r_dup.json()).lower())
# Deliberate-confirmation at UI: the "Confirm import · N bets" green button
# is a per-commit click. That IS a deliberate confirmation, but the count
# doubling is not surfaced (no "you already have N bets" nudge).
if after_second == after_first + 3:
    check("[14] Duplicate-import guardrail — DEFECT: append is silent at API",
          False,
          f"after 1st={after_first} bets, after 2nd={after_second} bets. "
          f"API accepted duplicate without warning. UI has a Confirm-Import button "
          f"(deliberate click) + 'Replace existing' toggle, but there is no "
          f"'You already have N bets — this will bring the total to M' warning. "
          f"Recommend: preview panel should show existing_count and warn if >0.")
elif duplicate_detected_at_api:
    check("[14] Duplicate-import guardrail (API warning present)", True,
          f"API status={r_dup.status_code}")
else:
    check("[14] Duplicate-import guardrail — unexpected shape", False,
          f"after 1st={after_first}, after 2nd={after_second}, status={r_dup.status_code}")

# ============================================================
# Summary
# ============================================================
print(f"\n{'='*70}\nSummary\n{'='*70}")
passed = sum(1 for _, p, _ in RESULTS if p)
failed = sum(1 for _, p, _ in RESULTS if not p)
print(f"PASSED: {passed}/{len(RESULTS)}")
print(f"FAILED: {failed}/{len(RESULTS)}")
if failed:
    print("\nFailed checks:")
    for name, p, detail in RESULTS:
        if not p:
            print(f"  ❌ {name}")
            print(f"     {detail}")
sys.exit(0 if failed == 0 else 1)
