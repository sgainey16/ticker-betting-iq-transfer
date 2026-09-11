# SPOT CHECK — LOGIC AUDIT & STRESS TEST
### Read-Only. No Code Changes. Waiting for Approval Before v2.

> **Purpose.** The vertical slice ships. Before we expand, verify the
> engine's coaching logic is honest. Ten adversarial scenarios were
> constructed to break Spot Check, run against the CURRENT
> `betting_coach.spot_check()`. Every scenario was chosen to test a
> specific way that "good record" or "bad record" can mislead a bettor.
>
> **Date:** Feb 19, 2026
> **Scope.** Audit only. No code was modified. Stress test executed
> against the live module in memory.

---

## 1. CURRENT SPOT CHECK DECISION RULES (as shipped)

Location: `/app/backend/betting_coach.py`

### 1.1 Constants
```python
MIN_N_FOR_CALL       = 10     # below this → NEUTRAL / insufficient
LEAN_IN_MIN_WIN_RATE = 55.0   # win-rate % gate for LEAN IN
LEAN_IN_MIN_ROI      = 10.0   # ROI % gate for LEAN IN
SKIP_MAX_WIN_RATE    = 40.0   # win-rate % ceiling for SKIP
SKIP_MIN_LOSS_ROI    = -10.0  # ROI % floor for SKIP (negative)
```

### 1.2 Match hierarchy (specificity-first)
Attempted in order; first bucket whose `n ≥ 10` wins:
1. `exact` — bet_type + home_or_away + fav_or_dog
2. `bet_type + fav_or_dog`
3. `bet_type + home_or_away`
4. `bet_type` only
5. Fallback: exact-tier matches (may be empty)

### 1.3 Decision function (the whole engine)
```
if n < 10:                          → NEUTRAL (thin sample)
if win_rate ≤ 40%:                  → SKIP
if roi     ≤ -10%:                  → SKIP
if win_rate ≥ 55% AND (roi ≥ 10% OR roi is None):  → LEAN_IN
otherwise:                          → NEUTRAL
```

### 1.4 Structural properties of the current rules
- **Win-rate is a first-class gate.** Both LEAN_IN and SKIP can fire on win-rate alone.
- **ROI is a co-equal gate.** Either dimension can override the other.
- **The two axes are independent.** No cross-check between them.
- **Odds are ignored.** Stored as free-text string; not parsed anywhere in the coach.
- **No time-window awareness.** Lifetime aggregate only.
- **Pushes are correctly excluded** from wins/losses/win-rate. They ARE included in `n` (sample count).

---

## 2. STRESS-TEST RESULTS

**10 scenarios × 11 queries (scenario 7 has two queries). Empirical output from the live module. Verdicts marked ✅ CORRECT, ⚠️ MISLEADING, or ❌ WRONG.**

### Scenario 1 · Strong ROI + weak win rate (profitable dog bettor)
- 20 bets, all +200 home dogs, 8W-12L
- **Reality:** +$400 P/L, +20% ROI on $2000 stake — a *profitable* bettor
- **Engine:** `SKIP · You've struggled with home dogs. Passing is a position.`
- **Verdict:** ❌ **WRONG.** Dog bettors thrive at sub-50% win rates. SKIP is bad advice; this bettor is making money.

### Scenario 2 · Weak ROI + strong win rate (heavy-fav bleed)
- 20 bets, all -200 home favs, 12W-8L
- **Reality:** -$200 P/L, -10% ROI — losing money while "winning most"
- **Engine:** `SKIP · You've struggled with home favourites. You're 12–8… -10.0% ROI.`
- **Verdict:** ⚠️ **CORRECT RECOMMENDATION, MISLEADING LANGUAGE.** SKIP is right. But *"You've struggled — 12-8"* is oxymoronic. The record says "you've won these"; the language contradicts the numbers.

### Scenario 3 · Tiny sample, huge ROI
- 5 prop bets, 5-0, +$1500 P/L, +300% ROI
- **Engine:** `NEUTRAL · Small sample — you've got 5 bets on prop bets. Don't convince yourself you've found something that isn't there yet.`
- **Verdict:** ✅ **CORRECT.** Right verdict, right language. The single line that most reliably protects users.

### Scenario 4 · Large sample, modest positive edge (55% at -110)
- 100 bets, 55-45, +$505 P/L, +5% ROI
- **Reality:** Over 100 bets at -110, +5% ROI is genuinely strong performance. Break-even at -110 is ~52.4%.
- **Engine:** `NEUTRAL · sample's there, but nothing sharp either way.`
- **Verdict:** ⚠️ **UNDERSELLS.** The rule requires ROI ≥ 10% for LEAN_IN, but at flat odds a 5% ROI over n=100 is real signal. Getting called "nothing sharp" contradicts the visible record.

### Scenario 5 · Hot short-term inside cold long-term
- 60 bets long-term (23-37, -27% ROI). Last 10 bets: 8-2 hot.
- **Engine:** `SKIP · You've struggled with road favourites. -26.8% ROI.`
- **Verdict:** ✅ **CORRECT VERDICT** (long sample dominates a hot streak). But the response has ⚠️ **BLIND-SPOT LANGUAGE** — Marc doesn't tell the user "yes, you've been hot lately, but the long look says this isn't your spot." A bettor riding a hot streak will feel unheard.

### Scenario 6 · Cold recent inside strong long-term
- 58 bets long-term (32-26, +38% ROI). Last 8 bets: 2-6 cold.
- **Engine:** `LEAN_IN · Home dogs has actually been one of your better spots. 32–26 (55.2%), +37.9% ROI.`
- **Verdict:** ✅ **CORRECT VERDICT.** ⚠️ **BLIND-SPOT LANGUAGE** — no acknowledgment of the cold spell. A bettor mid-losing-streak will not trust the LEAN_IN.

### Scenario 7 · Overlapping filters, one strong / one weak
- User is 12-3 (+100% ROI) on home dogs specifically
- Same user is 12-30 (-29% ROI) on any dog including road dogs
- **Engine (tight query "home dog"):** `LEAN_IN · +100% ROI. You've earned the right to look closer.`
- **Engine (wide query "any dog"):** `SKIP · You've struggled with dogs. Passing is a position.`
- **Verdict:** ✅ **BOTH VERDICTS INTERNALLY CORRECT.** Match-hierarchy correctly picks specificity when the user asks specifically. But ⚠️ **whipsaw risk** — a user toggling the dropdown from "home" to "any" sees LEAN_IN → SKIP within seconds. Could feel arbitrary without an explanation.

### Scenario 8 · Pushes / voids
- 15 total/over bets, 6W-6L-3P
- **Engine:** `NEUTRAL · sample's there, but nothing sharp either way.`
- **Verdict:** ✅ **CORRECT.** Pushes correctly excluded from win/loss math. `n=15` (with pushes), graded `6-6` counted for win rate (50%). Language and numbers are honest.

### Scenario 9 · Heavy fav (-400) — high win rate, negative ROI
- 20 bets, 15-5 (75% win rate), -$125 P/L, -6.2% ROI
- **Engine:** `NEUTRAL · sample's there, but nothing sharp either way.`
- **Verdict:** ⚠️ **HIDES THE STORY.** Bettor is winning 75% but bleeding money. The current NEUTRAL language reads "flat, no edge either way" — which is factually the opposite of what happened. The truth: *wins are cheap, losses are expensive*.

### Scenario 9b · Big dog (+400) — low win rate, huge ROI
- 20 bets, 8-12 (40% win rate), +$2000 P/L, +100% ROI
- **Engine:** `SKIP · You've struggled with road dogs. Passing is a position.`
- **Verdict:** ❌ **WRONG.** Same failure mode as Scenario 1, more extreme. Bettor is up $2000 (a 100% ROI) and the engine tells them to skip. This is the clearest safety failure of the current logic.

### Scenario 10 · Broadly losing bettor
- 20 bets in every bucket (moneyline home fav, ml away dog, over, under). All buckets ~35% win rate, ~-33% ROI.
- **Engine (any single-bucket query):** `SKIP · -33% ROI.`
- **Verdict:** ✅ **CORRECT PER BUCKET.** But a user clicking through all their dropdown combos hits SKIP after SKIP with no meta-framing. ⚠️ **UX gap, not logic gap** — Marc should have a "the whole book is red for you right now" register.

---

## 3. SITUATIONS WHERE CURRENT RULES PRODUCE MISLEADING OR WRONG OUTPUT

Summary table:

| # | Situation | Current output | Actual signal | Severity |
|---|---|---|---|---|
| 1 | Profitable dog bettor, low win rate | SKIP | LEAN_IN-worthy or NEUTRAL | ❌ **Actively bad advice** |
| 9b | Big-dog +ROI, low win rate | SKIP | LEAN_IN-worthy | ❌ **Actively bad advice** |
| 2 | Heavy-fav high win rate, -ROI | SKIP (correct call, wrong words) | SKIP with different language | ⚠️ Language bug |
| 9 | Heavy-fav high win rate, mildly -ROI | NEUTRAL "nothing sharp" | NEUTRAL with "crossed signal" language | ⚠️ Hides truth |
| 4 | Large sample, modest +ROI at flat odds | NEUTRAL "nothing sharp" | Warrants LEAN_IN-lite or "sustained flat-odds edge" register | ⚠️ Undersells |
| 5, 6 | Hot/cold streak inside opposite long-term | Correct verdict, blind language | Same verdict + streak acknowledgment | ⚠️ UX gap |
| 10 | Broadly losing bettor | SKIP-spam bucket by bucket | Global "step back" register | ⚠️ UX gap |
| 7 | Whipsaw between tight and wide buckets | Both technically correct | Same + acknowledgment of the specificity flip | ⚠️ UX polish |

**Two hard errors (1, 9b)** where the current engine tells a profitable bettor to stop doing what's working. **Both share the same root cause:**

> **The engine treats win-rate as a first-class gate independent of odds.** At extreme odds, win-rate ceases to be a signal of profitability. Dog bettors at 40% and fav bettors at 60% can be either printing or bleeding — win-rate alone cannot distinguish. Only ROI knows.

---

## 4. PROPOSED REVISED DECISION RULES (v2 — audit-stage, not implemented)

### 4.1 Guiding principle

> **ROI is the trust signal. Win-rate is a corroborator or a shape-indicator, never a first-class gate.**

This one change alone resolves scenarios 1, 2, 9, and 9b.

### 4.2 New constants
```python
MIN_N_FOR_ROI_CALL     = 15    # need at least 15 MONEY bets for ROI-driven verdict
MIN_N_FOR_WINRATE_CALL = 20    # win-rate corroborator needs slightly more sample
MIN_MONEY_BET_FRACTION = 0.6   # if <60% of bets are money bets, use win-rate fallback

LEAN_IN_ROI_STRONG   =  15.0   # strong LEAN_IN threshold (small-ish sample)
LEAN_IN_ROI_MODERATE =   5.0   # moderate LEAN_IN threshold (larger sample)
LEAN_IN_N_FOR_MODERATE = 30    # sample size at which moderate threshold kicks in

SKIP_ROI_STRONG      = -15.0   # strong SKIP threshold
SKIP_ROI_MODERATE    =  -5.0   # moderate SKIP threshold
SKIP_N_FOR_MODERATE  = 30

CROSSED_SIGNAL_WIN_RATE_HIGH = 60.0  # 60%+ win rate
CROSSED_SIGNAL_WIN_RATE_LOW  = 45.0  # ≤45% win rate

WIDEN_ONLY_IF_MULTIPLIER = 3.0        # only widen if wider bucket has ≥ 3x more sample
```

### 4.3 Revised decision function

```
# Insufficient sample — same as v1
if money_bet_n < MIN_N_FOR_ROI_CALL and resolved_n < MIN_N_FOR_WINRATE_CALL:
    → NEUTRAL (thin sample)

# Primary path: money bets have enough sample → ROI drives
if money_bet_n >= MIN_N_FOR_ROI_CALL and roi is not None:
    if roi >= LEAN_IN_ROI_STRONG:                                     → LEAN_IN
    if roi >= LEAN_IN_ROI_MODERATE and money_bet_n >= LEAN_IN_N_FOR_MODERATE: → LEAN_IN
    if roi <= SKIP_ROI_STRONG:                                        → SKIP
    if roi <= SKIP_ROI_MODERATE  and money_bet_n >= SKIP_N_FOR_MODERATE:  → SKIP
    # Between the bands → check for crossed signal
    if win_rate >= CROSSED_SIGNAL_WIN_RATE_HIGH and roi < 0:          → CROSSED_SIGNAL (SKIP flavor)
    if win_rate <= CROSSED_SIGNAL_WIN_RATE_LOW  and roi > 0:          → CROSSED_SIGNAL (LEAN_IN flavor)
    → NEUTRAL

# Fallback: user only makes prediction-only picks (or thin money sample)
# Win-rate is the ONLY tool we have. Use it, but conservatively — and
# NEVER call it "edge." At most: "you've historically performed well here."
if resolved_n >= MIN_N_FOR_WINRATE_CALL:
    if win_rate <= 35:                                                → SKIP  (very poor pick record)
    if win_rate >= 62:                                                → LEAN_IN (very strong pick record)
    → NEUTRAL

→ NEUTRAL (default)
```

### 4.4 What this eliminates
- ❌ Scenario 1 (profitable dog bettor gets SKIP) — win-rate no longer triggers SKIP
- ❌ Scenario 9b (big-dog +100% ROI gets SKIP) — win-rate no longer triggers SKIP
- ⚠️ Scenario 2 (correct verdict, wrong words) — new CROSSED_SIGNAL path fires the SKIP flavor with honest language
- ⚠️ Scenario 4 (55% at -110 undersold) — moderate LEAN_IN threshold (5% ROI on n≥30) fires LEAN_IN with the right hedged voice
- ⚠️ Scenario 9 (heavy fav 75%/–ROI hidden) — CROSSED_SIGNAL SKIP-flavor names the pattern

### 4.5 What this deliberately does NOT do (v2 scope discipline)

- ❌ No time-window slicing (scenarios 5, 6 language gap) — hold for v3
- ❌ No aggregate "broadly losing" meta-register (scenario 10) — hold for v3
- ❌ No odds parsing / break-even-vs-odds cross-check — hold until we ingest real market lines
- ❌ No hierarchy change on widening (scenario 7 whipsaw) — v2 will just improve the language on widen; hold structural change
- ❌ No LLM. Deterministic templates only.

### 4.6 Language rule (mandatory in v2)

**Never claim "edge."** Personal historical performance ≠ market edge. Without odds parsing and closing-line-value calculation, we do not have evidence of edge — we have evidence of past outcomes. Marc's LEAN_IN language must be rewritten to reflect this.

Every LEAN_IN line ends with a variant of:
> *"That's your track record — not a proof of market edge. If tonight's line offers real value, that's a separate read."*

Every SKIP line stays personal-tendency-focused:
> *"Your history here isn't good. Passing is a position."*

Every CROSSED_SIGNAL line names the shape:
> *"You win these often, but the odds aren't giving you enough. Winning isn't the same as making money."*

Every NEUTRAL line refuses to reward or punish variance:
> *"Sample's there, but nothing sharp. No edge to lean on, no reason to run from it."*

Every INSUFFICIENT line protects against overconfidence in a small sample:
> *"Small sample. Don't convince yourself you've found something that isn't there yet."*

---

## 5. FIVE EXAMPLE MARC RESPONSES FOR THE DIFFICULT CASES

Deterministic templates. No LLM. These would replace or augment the current five in v2.

### 5.1 CROSSED_SIGNAL — high win rate, negative ROI (Scenario 2, 9)

> **"Careful with this one. You've won 12 of your last 20 here — 60% — which sounds like a good spot. But you've lost $200 doing it. The wins are cheap, the losses are expensive. Winning often and making money aren't the same thing. If tonight's number is short again, you're chasing the pattern that hurts you."**

### 5.2 CROSSED_SIGNAL — low win rate, positive ROI (Scenario 1, 9b)

> **"This one's counterintuitive. You've only won 8 of your last 20 in this spot — but you've made $2000 doing it, because when the underdogs cash, they cash big. Your record looks bad; your wallet says otherwise. That's not a green light — it's a green flag that says your process here is defensible. Now find one where the price actually makes sense."**

### 5.3 MODERATE LEAN_IN — sustained flat-odds edge (Scenario 4)

> **"You've quietly built something here. 55–45 over 100 bets at market prices, up $505. That's not flashy, but at -110 it's the kind of number a professional would take. Doesn't mean tonight's line is priced wrong — that's a separate read. But your track record here is real, not variance. Trust the process."**

### 5.4 STRONG LEAN_IN — with edge disclaimer (rewrite of current, Scenario 6, 7)

> **"Historically, home dogs has been one of your better spots — 12–3, +$1500 over 15 money bets. That's your track record, not proof of a market edge. It doesn't tell us whether tonight's price offers real value. But your process here has been sound. Look closer at whether the number makes sense — and if it does, you've earned the right to trust yourself."**

### 5.5 STRONG SKIP — with dignity (rewrite of current)

> **"You've struggled here. 5–13 over 18 bets, down $959. That's a big enough sample and a big enough hole that it's not a slump — it's a pattern. The book has your number in this spot. Passing tonight isn't quitting. It's a position. You don't need action on every game to be a good bettor."**

---

## 6. NON-LOGIC ISSUES SURFACED BY THE STRESS TEST

Reporting for record; **not** proposing to fix without your call:

1. **Odds are stored as free-text string.** Cannot compute break-even, cannot compute CLV, cannot cross-check win-rate against implied probability. This is the single biggest missing capability. Once real market lines exist, parsing this properly unlocks true edge-vs-luck separation.
2. **No time-window slicing** (5, 6). Hot/cold streaks invisible.
3. **No global "you're losing everywhere" meta-register** (10). Bucket-by-bucket SKIPs feel like harassment.
4. **Match hierarchy prefers tight-small over wide-clear** — a small exact match at n=10 wins over a larger, clearer wider bucket at n=50. Sometimes wider is more truthful.
5. **Pushes count toward `n` but not toward `resolved`.** Not a bug, but the copy could clarify ("15 bets · 12 graded").

---

## 7. RECOMMENDATION

**Approve v2 rules in Section 4** and the **five language templates in Section 5**. Implementation is estimated at **~2-3 hours** — pure module edit inside `betting_coach.py`, no new endpoints, no UI changes, no data model changes. The existing frontend consumes the same JSON contract; the `recommendation` field just gains one new value (`CROSSED_SIGNAL`) which the frontend can render with the same UI as SKIP/LEAN_IN (color-coded per direction) — trivial follow-up.

**Deferred to v3 (call when ready):**
- Time-window slicing (recent vs lifetime split)
- Global "broadly losing" register
- Widen-hierarchy language ("we opened this up to give you enough sample")
- Odds parsing + break-even cross-check
- CLV once real market lines exist

**Deferred to when we ingest real market data:**
- Any claim of "market edge"
- Model probabilities
- Edge-vs-market comparison

---

## 8. AUDIT ARTIFACTS

- Stress-test harness output: captured inline in Section 2 (run against live `betting_coach.spot_check()` in memory, no code modification)
- Current rules: extracted verbatim from `/app/backend/betting_coach.py`
- No code was modified during this audit
- No new files were added to the running app (this report is a memory doc, not app code)

**Waiting on approval before any implementation.**

— Read-only Spot Check logic audit, Feb 19, 2026.
