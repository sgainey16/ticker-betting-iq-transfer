# Betting IQ — Input Flow Audit

**Question this audit answers:** *How do we get 30–100 real historical bets from each of 3–5 semi-remote testers into Betting IQ without making the test painful — and without building anything we'll throw away?*

**Scope:** Audit only. No code changes. Everything below reflects the codebase as of v2 Spot Check freeze.

**Reader:** Owner deciding what to ship for a semi-remote self-serve experiment where the goal is:
> Send access → bettor gets real bets in → Spot Check has legitimate signal → bettor explores what Marc knows about them.

---

## 1. Current input flow — as it actually exists today

There are exactly **two ways** a bet enters the system:

### A. The "Log a bet" form (`BetForm` in `BackOffice.jsx`, `POST /api/betting/bet`)

Twelve visible fields, in this order:

| # | Field | Type | Required? | User cost |
|---|---|---|---|---|
| 1 | Date | date picker | yes | 3 sec |
| 2 | Matchup | free text ("BOS @ NJD") | yes | 8 sec (they have to remember/lookup) |
| 3 | Bet Type | dropdown, 9 options | yes | 4 sec |
| 4 | Your Selection | free text ("Devils ML") | yes | 6 sec |
| 5 | Odds | free text ("-135" / "+180") | yes | 8 sec (they have to remember/lookup) |
| 6 | Result | dropdown (pending/win/loss/push) | yes | 2 sec |
| 7 | Prediction-only checkbox | boolean | no | 1 sec |
| 8 | Stake ($) | number | if not prediction-only | 5 sec |
| 9 | Profit/Loss ($) | number, **signed** | if not prediction-only | **12 sec — requires math** |
| 10 | Notes | free text | no | skipped |
| — | *implicit* home_or_away | — | **NEVER ASKED** | — |
| — | *implicit* fav_or_dog | — | **NEVER ASKED** | — |

**Realistic per-bet cost, one hand-logged bet from memory or a screenshot: ~45–60 seconds.**
**For 50 bets that's 40–50 minutes of concentrated data entry.**

### B. The "Seed test data" button (`POST /api/betting/seed-test-bettor`)

Dev-only. Inserts a hand-crafted 86-bet slate designed so Spot Check has meaningful LEAN IN / SKIP / NEUTRAL results across at least 4 buckets. **This is fake data.** Every tester who runs the seeder gets *the same fictional bettor*, which is exactly what we don't want for the experiment — the whole thesis of this test is "does Marc know something about ME."

---

## 2. Critical finding — the form is broken for Spot Check

**Spot Check is bucketed on three fields: `bet_type`, `home_or_away`, `fav_or_dog`.**
(See `betting_coach.py::_matches` and `_find_best_bucket`.)

**The Log-a-bet form captures `bet_type` only. It never asks for home/away or fav/dog.**
(See `BackOffice.jsx::BetForm` — the state object has 10 keys, none of them are `home_or_away` or `fav_or_dog`.)

Consequences if we ship the current form to a tester:

- Every manually-logged bet lands in Mongo with `home_or_away = null` and `fav_or_dog = null`.
- Every Spot Check query the tester runs *with* a home/away or fav/dog filter (i.e. every real query — the whole UI is built around those dropdowns) returns zero matching bets at the exact tier.
- The match-hierarchy fallback in `_find_best_bucket` will widen to `bet_type`-only, so *something* comes back, but it's the wrong bucket — it collapses "home dogs" and "road favourites" into the same pile.
- The tester's own real tendencies are invisible to the coach. Marc's line will read "small sample" or "nothing sharp either way" no matter how many bets they log.

**This alone is a P0 blocker for the 3–5 person experiment.** Whichever import method we choose has to solve this — either by capturing the two fields at input time, or by deriving them from raw sportsbook data.

The seeder does capture them (that's how the seeded LEAN IN / SKIP results work), which is why the DEV surface *feels* fine but real user input silently degrades to noise.

---

## 3. What Spot Check actually needs — the "minimum viable historical bet"

Traced through `betting_coach.py` and `_summarize`, these are the fields the engine reads:

### Load-bearing (Spot Check verdict changes if wrong or missing)
| Field | Used by | Notes |
|---|---|---|
| `bet_type` | `_matches`, `_find_best_bucket` | Must match one of: `moneyline`, `spread`, `total`, `prop` |
| `home_or_away` | `_matches` bucket key | `home` / `away` / null. Null bets are excluded from home/away-specific buckets |
| `fav_or_dog` | `_matches` bucket key | `fav` / `dog` (or `over` / `under` for totals). Null → excluded |
| `result` | `_summarize` | Must be one of `win` / `loss` / `push` / `pending`. Pending & unresolved excluded from record |
| `stake` | ROI numerator/denominator | Float ≥ 0. Zero = treated as prediction-only |
| `profit_loss` | ROI + P/L | Signed float. Negative = loss, positive = net win |
| `prediction_only` | Excludes bet from ROI math | Boolean |

### Not load-bearing for Spot Check (but useful for UI + audit trail)
| Field | Where it matters |
|---|---|
| `bet_date` | UI sort, potential future recency-window slicing |
| `matchup` | UI display only |
| `selection` | UI display only |
| `odds` | UI display only. Spot Check doesn't parse odds — profit_loss already encodes the payout |
| `notes` | UI display only |

**Takeaway:** For a working Spot Check test, we need **exactly 7 fields per bet**. Not 12. And two of the seven (`home_or_away`, `fav_or_dog`) are the ones the form doesn't collect.

An importer that captures those 7 fields — even if `matchup` is literally the string "unknown" — will produce a legitimate coaching experience. This is a much smaller target than "build a sportsbook-quality bet ingestion tool."

---

## 4. Friction points ranked (what would make a tester quit at bet #7 vs bet #50)

**Friction that kills the test entirely** (quit before bet #10):
1. Having to type home/road and fav/dog *if we bolt those onto the form* — that's two more dropdowns on an already 10-field form.
2. Having to hand-compute profit/loss from odds. Ask a casual bettor "you bet $50 at +180 and it won, what's your profit?" — many will freeze. This is the single biggest UX cliff in the current form.
3. Having to look up historical odds. Testers won't remember `-135` vs `-140` from three weeks ago. If we demand exact odds they will either fabricate them or quit.

**Friction that turns 50 bets into 15 bets** (quit around bet #15–20):
4. No bulk paste. Entering bets one at a time behind a modal that resets after save.
5. No "duplicate previous bet" shortcut for parlay/similar slates.
6. Free-text `matchup` — no autocomplete, no team-code validation.

**Friction that erodes data quality even if they finish**:
7. Free-text `selection` — every tester will format it differently. Fine for UI, useless for aggregation.
8. Nothing computes `home_or_away` / `fav_or_dog` from `selection` + `matchup` even though it's derivable in most moneyline cases.

**Friction that only matters at scale (not this experiment)**:
9. No sportsbook-native import formats.
10. No two-way sync / auto-grading of pending bets.

---

## 5. Import methods, compared honestly

Each row is scored for **this 3–5 person experiment**, not long-term.

| # | Method | Est. build (backend) | Est. build (frontend) | Tester friction | Data quality | Verdict for experiment |
|---|---|---|---|---|---|---|
| **a** | Ship current form as-is | 0 | 0 | Very high (see §4). Also **Spot Check silently broken** (§2). | Very low | ❌ Fails the experiment before it starts |
| **b** | Fix current form to capture home/away + fav/dog | ~1h | ~1h | High. Still ~45s/bet. 50 bets = ~40 min. | Medium | ⚠️ Works but painful. Realistically we'd get 15–25 bets, not 50 |
| **c** | DEV bulk-paste textarea (CSV-in-a-box, backend parses) | ~2h | ~1h | **Low** if tester can produce a CSV. Medium if they have to hand-type it. Owner can pre-fill for them. | Medium–High | ✅ Fastest reliable path — see recommendation |
| **d** | Real CSV upload with sportsbook-export presets (DK, FanDuel, Bet365) | ~3h backend + ~1h per sportsbook mapping | ~2h | **Very low** *if* the tester actually has an export. **Very high** if they don't — most casual bettors have never exported. | High when it works | ⚠️ Only worth it if we know the tester uses one of the supported books AND has export enabled |
| **e** | Sportsbook API integration (SharpSports, OddsJam, etc.) | 1–2 weeks + auth flow + $200–800/mo vendor cost | 1 week (OAuth, sync UI) | Near-zero for tester (once linked) | Highest | ❌ Out of scope. Explicitly deferred per your directive |
| **f** | Guided interview — owner sits w/ tester, enters via current form (fixed) | Uses (b) | 0 | Zero for tester, **high for owner** (~40 min per tester) | High (owner enforces consistency) | ⚠️ Great for 1–2 anchor testers, doesn't scale to 5 |

### Notes on (c) — why the DEV bulk-paste wins for this experiment

The bulk-paste flow is the smallest thing that solves all four real problems:

- Fixes the missing home/away + fav/dog fields (they're just columns in the paste).
- Removes the "one bet per modal" friction (all bets in one shot).
- Lets the *owner* pre-fill on behalf of any tester who can't self-serve (matches your "mixed group" reality).
- Lets a self-serve tester hand-build a spreadsheet in Google Sheets or Excel — a format even non-technical people can produce with a template.

A minimal schema (7 columns) fits on a phone screen. Example row a tester can produce:
```
2025-01-14, BOS @ NJD, moneyline, away, fav, win, 100, 74
```
That's date, matchup, bet_type, home_or_away, fav_or_dog, result, stake, profit_loss. Eight fields, one comma each. Order and header row would be defined in the template.

For the ~10% of testers who won't produce a spreadsheet, the owner texts them "send me your last 30 bets however you have them, I'll enter" — then owner pastes into the same DEV tool. One code path, two ergonomics.

### Notes on (d) — why sportsbook-native CSV isn't (yet) worth it

DraftKings and FanDuel *do* offer bet history exports, but:
- The export is behind a "request via email" flow at DK, and it comes as a **PDF** or bulk CSV with sportsbook-internal columns (`selectionId`, `marketId`, `wagerType`) — you still need a mapping layer, and it changes when the sportsbook updates their format.
- FanDuel and Bet365 formats differ from each other in every meaningful column.
- Every hour spent building a DK-specific parser is an hour you're not spending learning whether Marc's coaching lands.

If ONE anchor tester is a DK power user and has an export ready, we can hand-massage that one CSV in a spreadsheet down to our 8-column schema in ~15 minutes. That's cheaper than writing the DK parser for a 3–5 person experiment.

---

## 6. Recommendation

### For THIS experiment (3–5 semi-remote testers, next few weeks)

**Ship a DEV Bulk Import tool.** Nothing else. Not the fixed form. Not sportsbook integrations.

Design characteristics:
1. **Location:** Behind the same DEV gate as the Betting IQ tab — same Back Office, same "Dev" pill.
2. **Interface:** One textarea. Tester pastes CSV. Backend parses, validates, returns a preview ("we saw 47 bets: 32 moneyline, 15 totals; 6 rows failed — see below"), tester confirms, backend writes.
3. **Schema:** 8 columns: `date, matchup, bet_type, home_or_away, fav_or_dog, result, stake, profit_loss`. Header row required. `matchup` accepts free text (we don't parse it). `bet_type` normalized server-side (accepts common synonyms — "ML" → "moneyline", "puckline" → "spread", etc.).
4. **Failure mode:** Row-level errors listed with line numbers. Nothing writes on partial failure unless tester clicks "import valid rows only."
5. **Owner path:** Same tool. Owner can paste on behalf of a tester.
6. **Template:** Ship a Google Sheets template link in the DEV tool + a "download example CSV" button. Both use the same 8 columns.

**Approximate work: ~3–4 hours (backend parser ~2h, frontend textarea + preview ~1.5h, template + copy ~30 min).**

### For long-term real onboarding (post-experiment, if the thesis validates)

**Different problem, don't confuse them.** The 3–5 person test is asking "does the coaching land." Long-term onboarding is asking "how do we get 10,000 people to trust us with their bet history in under 5 minutes."

Long-term almost certainly is *not* CSV paste. Best-guess ranking for later:
1. **SharpSports** or **OddsJam** sportsbook-link integration — one OAuth-style flow, real-time sync, 40+ books supported. Vendor cost is the tradeoff.
2. Native mobile "share to Ticker" from the sportsbook app (iOS/Android share sheet).
3. Screenshot OCR of bet slips (GPT-4V or similar). Charming but error-prone.
4. Manual entry with heavy autocomplete + inferred fields — as a fallback, never as the primary path.

**Do not decide the long-term path yet.** Decide it after we've learned whether personal coaching itself is a product people want.

---

## 7. Open questions before I'd greenlight building the DEV importer

1. **Are all 3–5 testers comfortable producing a Google Sheet or CSV from memory / screenshots / their sportsbook app?** If two of them will realistically send you an unstructured text message, the "owner pastes on their behalf" workflow is the actual primary flow, and we should design the DEV tool for that use case first.

2. **Do we want to accept "prediction-only" bets in the import?** Right now the DB model supports it, but a CSV column for `prediction_only` (or `stake = 0`) adds friction. Recommend: skip prediction-only in the importer for now, add later if the experiment surfaces demand.

3. **Do we want to auto-derive `home_or_away` and `fav_or_dog` when the tester leaves them blank?** For moneyline bets on well-known matchups it's often derivable from `selection` + `matchup`. Cheap to add but risks silent-wrong data. Recommend: **do not auto-derive** for the experiment — a blank cell should force the tester (or you) to fill it in. Wrong data poisons Spot Check faster than missing data.

4. **How do we time-stamp historical bets that don't have real dates?** If a tester sends "here's my last 30 bets" without dates, we still need `bet_date` for future recency-window logic (see backlog P1). Recommend: allow blank dates in import, backfill with `bet_date = today - i days` in reverse order, and flag the tester that dates are approximate.

5. **Cleanup after the experiment.** The DEV importer will accumulate real bettor data. Do we want the same "seed test data → replace: true" wipe behavior for the importer? Or a separate "purge my history" control the tester can hit at the end of the experiment? (Privacy hygiene matters more here because this is real data, not the seeded fictional bettor.)

---

## 8. TL;DR

- The current "Log a bet" form is **silently broken** for Spot Check because it doesn't collect the two fields Spot Check most needs. This is a P0 fix regardless of import path.
- Spot Check only truly needs **7 fields per bet**. Ignore the other 5 for the experiment.
- The fastest reliable way to get 30–100 real bets from a semi-remote tester is a **DEV CSV-paste import tool**, ~3–4 hours of work total.
- Sportsbook CSV parsers, OCR, and vendor integrations are all wrong for this stage. Defer.
- Long-term onboarding is a *different* problem — decide it later.
- Five open questions above worth answering before we build anything.

Ready to build the DEV import tool on your go. Nothing else moves.
