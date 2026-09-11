# BETTING IQ AUDIT — TICKER BETTING IQ LAB
### Read-Only Focused Audit · No Modifications · No Rebuild Comparisons

> **Scope.** Betting IQ ONLY. This workspace is now the Ticker Betting IQ
> Lab. Ignoring all earlier requests to compare Ticker 1/3/MARSL.
>
> **Read-only.** No code was modified, deleted, refactored, or installed.
> Report only.
>
> **Date:** Feb 19, 2026
>
> **Method.** Searched every file across `/app/backend`, `/app/frontend`,
> `/app/memory`, all routes, unused components, prompts, and docs for any
> Betting-IQ-adjacent surface. Classified each finding as:
>
> - **WORKING** — connected to real data and functional
> - **PARTIAL** — code exists but is incomplete/disconnected
> - **MOCK** — UI/data is simulated/placeholder
> - **SPEC ONLY** — described in memory/docs but not implemented
> - **MISSING** — required for the intended product but doesn't exist

---

## 1. WHAT BETTING IQ IS TODAY

**Honest one-paragraph answer:**
A user in this fork today can log bets manually (win/loss/push/pending), see their own bet history, see two headline stats (Prediction Accuracy % and Betting ROI %) each paired with a confidence band (insufficient / low / moderate / higher), and see a per-bet-type split table once ≥10 comparable bets exist. **That's it.** There is no odds feed, no bookmaker integration, no model-generated pick, no "Personal Edge" score, no behavioral pattern detection, no daily coaching surface, no Betting DNA page, no 18+ gating, and **the entire Betting IQ tab is currently hidden from the Back Office UI** ("commented out for Phase 1 — entertainment-first focus"). The backend is live and Mongo-persisted. The frontend `BettingIQTab` component exists in full, is wired to the backend, works, but is **unreachable** from any UI surface — only accessible if someone uncomments one line in `BackOffice.jsx`.

**Adjacent things that DO exist and might read as "Betting IQ" to a user:**
- **Predictions page** (`/show`, was `/predictions`) — free-pick win/loss game against 4 hand-authored demo matchups, with an "OddsChip" showing deterministic **mock** sportsbook lines
- **Panel picks + AI consensus** — each demo game carries `reggie_pick`, `marc_pick`, `ai_consensus_side`, `ai_consensus` (0-100%) hand-authored in `analysts.py`. These fuel the Predictions UI.
- **Community tally** — real-time aggregate of user picks per game (from Mongo `predictions` collection)
- **Leaderboard** — user_name ranked by prediction accuracy across resolved games
- **Subscription/paywall foundation** — 3 free questions per device via `/api/subscription/*` endpoints

None of the above use real market lines, model output, or edge calculations. All the "odds" numbers a user sees today are deterministic hashes of the game ID.

---

## 2. EXISTING BETTING IQ SCREENS

### 2A. Screens THAT SHIP with betting content visible

**`/app/frontend/src/pages/Predictions.jsx`** — mounted at `/show` via redirect (route `/predictions` redirects to `/show` per App.js)
- Free-pick game against the 4 hand-authored `GAMES` in `analysts.py`
- Each game card shows:
  - Home vs Away team logos + names
  - Reggie's pick + Marc's pick (hand-authored)
  - AI Consensus percentage bar
  - Community tally (real-time aggregate from Mongo)
  - **`OddsChip` — deterministic mock odds line** (moneyline fav/dog + total O/U)
  - Tap-a-logo-to-vote UI (locks at start_iso)
- Leaderboard section at page bottom
- User's own prediction record

**`/app/frontend/src/components/OddsChip.jsx`** (~40 lines)
- Renders "The Book · BOS -145 · TOR +120 · O 6.5 -105"
- **Fully MOCK** — reads from `mockLine(gameId)` in `/app/frontend/src/lib/mockOdds.js` which is a deterministic string hash → fake odds
- Comment in the file: *"When we wire Highlightly's real /odds endpoint, mockLine gets swapped for a fetch and every consumer picks up the truth."*

### 2B. Screens BUILT BUT HIDDEN

**`/app/frontend/src/pages/BackOffice.jsx` → `BettingIQTab()` function** (lines 848–1008)
- **160-line fully-built React component**
- Live-wired to `/api/betting/bets`, `/api/betting/stats`, `/api/betting/bet`, `/api/betting/bet/{id}`
- Renders:
  - "Log a bet" button opening `<BetForm>`
  - Two headline stat cards: **Prediction Accuracy** (win % of resolved picks) and **Betting Profitability** (ROI% + P/L on money bets)
  - Each stat card carries a confidence band pill (insufficient / low / moderate / higher) + sample-size chip
  - "How Betting IQ works" explainer callout — describes the 10/25/50 confidence thresholds
  - Bet History list (`<BetRow>` per row)
  - "By Bet Type" splits table (only surfaces rows with n ≥ 10)
- **⚠️ Tab is COMMENTED OUT** at `BackOffice.jsx:32`:
  ```js
  // Betting IQ + Fantasy Tracker hidden for Phase 1 (entertainment-first focus).
  // Code preserved — flip these back on for Phase 2.
  // { id: "betting-iq", label: "Betting IQ", icon: Brain, kicker: "Your personal AI betting coach" },
  ```
- The `active === "betting-iq" && <BettingIQTab />` line (line 97) IS live — so the tab CAN render, but no button navigates there.

### 2C. Related public/community screen (adjacent, not "Betting IQ" strictly)

**Leaderboard section** inside `Predictions.jsx` — top 20 users by prediction correct/resolved ratio.

**No Betting DNA page. No Personal Edge inline chip. No daily coaching surface. No Pick 10 board. No parlays/props tab. No 18+ gate. No sportsbook affiliate deeplink.**

---

## 3. EXISTING BETTING DATA

### 3A. Real data (from live systems)

| Data | Source | Status |
|---|---|---|
| User's own bet log | Mongo `bet_log` collection (per device_id) | **WORKING** |
| User's prediction picks | Mongo `predictions` collection | **WORKING** |
| Community vote tally per game | Mongo aggregation over `predictions` | **WORKING** |
| Prediction leaderboard | Mongo aggregation | **WORKING** |
| User's aggregate betting stats (splits, ROI, confidence bands) | Computed in `/api/betting/stats` from `bet_log` | **WORKING** |

### 3B. Mocked / hand-authored data currently on screen

| Data | Location | Status |
|---|---|---|
| Sportsbook moneyline / total | `mockLine()` in `mockOdds.js` (deterministic hash) | **MOCK** |
| 4 tonight's games | Hardcoded `GAMES` array in `analysts.py` (lines 275–320) | **MOCK** |
| Reggie's pick per game | Hand-authored `reggie_pick` field on each `GAME` | **MOCK** |
| Marc's pick per game | Hand-authored `marc_pick` field on each `GAME` | **MOCK** |
| AI Consensus % | Hand-authored `ai_consensus` (0-100) + `ai_consensus_side` on each `GAME` | **MOCK** |
| Resolved winner (for leaderboard) | `/api/predictions/simulate-resolve` — random 55/45 home-favor coin flip | **MOCK** |

### 3C. Data providers wired for hockey but NOT used for odds

| Provider | File | Betting-related capability | Current status |
|---|---|---|---|
| **Highlightly** | `highlightly_client.py` (294 lines) | Has `/odds` endpoint per public API docs, NOT yet integrated. Grep for "odds" in this file returns 0 matches. | **MISSING** integration for odds |
| **Sportradar** | `sportradar_client.py` (414 lines) | Their NHL feed includes markets/lines. `sr.ticker_lines()` uses standings only. Grep for "odds"/"line"/"moneyline"/"prob" returns 0 hits in this file. Key currently 401'd. | **MISSING** integration + broken key |
| **NHL Public API** | `nhl_data.py`, `nhl_pbp.py` | No odds data (league doesn't publish lines) | N/A |
| **SportsDataIO** | `SPORTSDATA_API_KEY` env var exists | No actual integration file exists | **MISSING** (env stub only) |

**Bottom line on odds data:**
Every odds/line/prob number a user sees is fabricated by `mockLine()`. Zero real sportsbook lines are ingested by this codebase today. Three integrations (Highlightly, Sportradar, SportsDataIO) could theoretically provide real odds, but none of them are wired.

### 3D. Data models (Pydantic, `server.py`)

**Prediction (free-pick game):**
```python
PredictionCreate: user_name, game_id, pick ('home'|'away'), reasoning
Prediction: id, user_name, game_id, pick, reasoning, created_at, resolved, correct
```
- ⚠️ Predictions keyed on `user_name` only, not device_id → any two users with same nickname overwrite each other (flagged in Foundation Audit as MEDIUM defect)

**BetLog (Bet Log):**
```python
BetLogCreate: device_id, bet_date, matchup, bet_type, selection, odds,
              stake, prediction_only, result, profit_loss, notes
BetLog: id + all of the above + created_at
```
- `bet_type` accepts: `'moneyline' | 'spread' | 'total' | 'prop' | 'first-goal' | 'shots' | 'saves' | 'other'` (matches spec §1)
- `prediction_only=true` supported (spec §9)
- `result` states: `'win' | 'loss' | 'push' | 'pending'`
- ✅ Properly device-keyed
- ⚠️ `odds` is stored as a free-text string ("`-135`", "`+180`") — not parsed. Can't compute closing-line value without normalization.

---

## 4. EXISTING BETTING INTELLIGENCE

### 4A. WORKING intelligence

| Feature | Source | Notes |
|---|---|---|
| **Prediction Accuracy** — user's win rate across resolved picks | `/api/betting/stats` | ✅ Wired end-to-end. Uses `bet_log` where `result != 'pending'`. |
| **Betting Profitability** — user's ROI% + total P/L | `/api/betting/stats` | ✅ Isolates money bets from prediction-only per spec §8. |
| **Confidence bands** — `_confidence_band(n)` | `server.py:1591–1598` | ✅ Implements spec §7: `<10 insufficient · <25 low · <50 moderate · 50+ higher`. Applied to every returned stat. |
| **Splits by bet type** | `/api/betting/stats.by_bet_type` | ✅ Groups the user's `bet_log` by `bet_type`, returns win-rate + ROI + confidence per bucket. UI hides rows with n < 10. |
| **Splits by result** | `/api/betting/stats.by_result` | Groups by outcome (mainly for internal debugging). |
| **Splits by matchup** | `/api/betting/stats.by_matchup` | Loose text-string bucket per matchup ("BOS @ NJD"). Not team-normalized (e.g. "BOS @ NJD" and "Boston @ New Jersey" would be different buckets). |
| **Leaderboard** (free-pick game) | `/api/predictions/leaderboard` | ✅ Top 20 by correct/total. |

### 4B. PARTIAL intelligence

| Feature | State |
|---|---|
| **Hand-authored `ai_consensus` %** per game in `analysts.py` | Present in data, rendered on Predictions page, but not model-generated. Static per game. Not a running/updating "model." Reads as intelligence but isn't. |
| **Panel picks (Reggie/Marc)** | Hand-authored, contradict each other by design (spec-driven), no dynamic reasoning. |
| **User's Prediction Accuracy** on the free-pick game | Rolling `correct/resolved` percentage exists in `/api/predictions/me/{user_name}`. No badge unlock at 60% (DAILY_PICKS_SPEC.md calls for it — not implemented). |

### 4C. MISSING intelligence (major gaps vs BETTING_IQ_SPEC.md)

| Feature from spec | Status |
|---|---|
| **Personal Edge Score** ("Your Historical Edge" vs Game Edge) — spec §4 | **MISSING** |
| **Comparable-bet definition** (multi-dimensional matching: bet type + fav/dog + home/away + odds range + etc.) — spec §11 | **MISSING** (only crude buckets exist: `by_bet_type`, `by_matchup`) |
| **Behavioral pattern detection** (revenge betting, tilt, overconfidence, emotional bias) — spec §3 | **MISSING** |
| **Betting DNA profile page** — spec §5 | **MISSING** |
| **"AI Betting Coach" daily surfacing** — spec §6 | **MISSING** |
| **Closing-line value (CLV)** — spec §8 | **MISSING** (odds stored as string, no closing line captured) |
| **Risk-adjusted results / bankroll stddev** — spec §8 | **MISSING** |
| **Concerning-pattern alerts** (stake escalation, chase pattern, frequency spikes) — spec §10 | **MISSING** |
| **Streak / momentum on user's own picks** (from MOAT_ROADMAP.md) | **MISSING** |
| **User-vs-baseline "edge score"** (~15% above average bettor, MOAT_ROADMAP) | **MISSING** |
| **Skip recommendation** (the differentiator per spec §4) | **MISSING** |
| **Data export / pause behavioral analysis / full wipe controls** — spec §9 | **MISSING** (only single-bet delete exists) |
| **Units vs dollar view toggle** — spec §9 | **MISSING** |
| **Pick 10 daily prop board** — PICK10_SPEC.md | **SPEC ONLY** |
| **Community Edge (verified expert follows)** — COMMUNITY_EDGE_SPEC.md | **SPEC ONLY** |
| **18+ / responsible-gambling gate** | **MISSING** |
| **Real sportsbook line ingestion** | **MISSING** (mockOdds.js only) |
| **Odds normalization / American→decimal→implied prob** | **MISSING** |
| **Legal disclaimer / "not affiliated with any sportsbook"** | Partial — one line in `RecapShow.jsx` footer: *"For entertainment & decision insights — never a wager"* |

---

## 5. EXISTING REGGIE/MARC + BETTING IQ

### 5A. WORKING

**Reggie system prompt (`/app/backend/analysts.py` lines 10–116)** explicitly addresses gambling-adjacent content:

Key excerpt (line ~102–116):
> **TONE MODES — READ THIS EVERY TIME:**
> - **PANEL SHOW / GENERAL / PLAYER PAGES → LIGHT-AND-FUN mode.** Warm sports-desk energy. Stories, character callbacks, running gags, appreciation of the game. **NO gambling language. NO fantasy-podcast phrases like 'PP1 exposure,' 'value pop,' 'regression coming,' 'efficiency add.'** You are entertaining a fan who may never place a bet in their life. If you mention numbers, wrap them in a story — 'kid's got 15 goals and he plays like he's got 40 more coming.'
> - **DEEP DIVE / PRESSER / BETTING IQ / FANTASY DESK → TECHNICAL mode is welcome.** The user opted in. Bring the receipts, the splits, the on/off numbers. Still stay in-character but the language can get sharper.
> - **DEFAULT: assume LIGHT-AND-FUN unless the context clearly says otherwise.**

Reggie prompt also includes **Trade / GM takes** — closest thing to a betting-oriented voice already written:
> "Cap space is a scoreboard." / "Contenders don't panic. They adjust." / "You're either buying or you're kidding yourself."

**Marc system prompt (`/app/backend/analysts.py` lines 118–260)** is the analytical voice — designed to be more comfortable in "TECHNICAL mode." His **Marcisms** cover exactly the kind of situations a Betting Coach needs:

- *When someone overreacts:* "That's today's headline, not tomorrow's reality." / "Let's not write the obituary after one game." / "We've seen this movie before."
- *When analytics agree with the eye test:* "The tape and the numbers finally shook hands." / "That's exactly what the model expected." / "Everything points in the same direction."
- *When analytics disagree:* "Now it gets interesting." / "That's why we watch the games." / "That's why hockey is beautiful."
- *When someone gets lucky:* "Sometimes probability takes the night off." / "He cashed every bounce." / "That's hockey's sense of humor."
- *When someone breaks a record:* "That's a plaque number." / "Write it down — you'll tell your grandkids you watched it."

Marc's spec-quoted rules that map DIRECTLY to Betting Coach behavior:
- *"Small sample size."*
- *"Evidence beats assumptions."*
- *"One game is a story. Eighty-two games are the truth."*
- *"Panic has never scored a goal."*
- *"Good process eventually gets rewarded."*
- *"Winning can hide problems. Losing can hide progress."*

### 5B. PARTIAL / DORMANT

- **`reggie_assistant.py`** has a full LLM chat endpoint that can answer any question — including bet-related ones — but there is **no Betting-IQ-context injection** into the prompt. If a user asks Reggie "should I bet the Habs tonight?" today, Reggie responds in LIGHT-AND-FUN default mode with no access to the user's bet log, stats, or the game's mock odds.
- **`/api/ask/stream`** — SSE streaming Q&A endpoint. Same story. No betting context piped in.
- Reggie's docked assistant pill (`ReggieAssistant.jsx`) has no "ask about tonight's picks" quick-action.

### 5C. MISSING (Reggie/Marc for Betting IQ)

| Feature | Status |
|---|---|
| Prompt-time injection of user's Bet Log stats into Reggie/Marc chats | **MISSING** |
| Reggie/Marc "explain this bet" or "explain this line" endpoint | **MISSING** |
| Reggie/Marc anomaly narration ("Marc, the model likes this game — but historically this isn't a spot our user wins in") | **MISSING** |
| Reggie/Marc daily coach beat (the AI Betting Coach voice from spec §6) | **MISSING** |
| Reggie's on-air daily picks segment (DAILY_PICKS_SPEC.md — Reggie makes the daily calls, Marc reacts) | **SPEC ONLY** |
| Reggie's tracked accuracy against actual outcomes | **SPEC ONLY** |
| Agree/Fade tracking (did user go with or against Reggie's call?) | **MISSING** |
| 60% badge for user's rolling win % (DAILY_PICKS_SPEC.md) | **MISSING** |

### 5D. Voice-canon material transportable to Betting IQ

**Marc-shaped Coach lines** already sitting in `/app/memory/CHARACTER_STYLE_GUIDE.md` (Sections 5.11 Marcisms) that we can lift verbatim into Betting IQ callouts:
- Overreaction bucket ("That's today's headline, not tomorrow's reality.")
- Luck bucket ("Sometimes probability takes the night off.")
- Sample size bucket ("One game is a story. Eighty-two games are the truth.")
- Standings-lie bucket ("Points hide problems.")

These map cleanly onto: user's hot streak (careful, small sample), user's cold streak (regression will come), user's tilt window (probability takes nights off), user's team-loyalty bias (points hide problems).

**Reggie's Trade/GM takes** map onto stake decisions ("You're either buying or you're kidding yourself").

**The character voice for a Betting Coach is already written.** What's missing is the wiring that pulls the user's own numbers in as context.

---

## 6. SMALLEST REAL BETTING IQ — WHAT TO PUT IN FRONT OF 5–10 REAL BETTORS

**Constraint:** Build on what already exists. Don't design new. Don't wait for real odds feeds. Don't wait for the model.

### 6.1 The MVP hypothesis to test

> **"Do bettors care about seeing their own tendencies broken down by bet type + fav/dog + home/away, delivered in Marc's voice, with a Skip recommendation when their history is bad in a matching spot?"**

If yes → we've validated the "coach vs predictor" thesis before spending a dollar on real odds ingestion or model building. If no → we save that spend.

### 6.2 What to ship (est. 3-4 days of engineering)

**Step 1 — Un-hide what's already built** *(1 hour)*
- Uncomment the Betting IQ tab in `BackOffice.jsx:32`
- **This alone gets 60% of the MVP live.** The tab renders. Users can log bets. Stats compute. Confidence bands display. Splits by bet type work.

**Step 2 — Add the two "coach" callouts the current UI is missing** *(1 day)*
Extend `/api/betting/stats` output with a `callouts` array where the backend picks Marc-voice lines when a threshold is crossed:
- If `by_bet_type` has any bucket with n ≥ 25 and ROI ≤ -10% → callout: *"Marc: 'Points hide problems — you're down 18% on player props over 27 bets. That's not a slump, it's a pattern.'"*
- If `by_bet_type` has any bucket with n ≥ 25 and ROI ≥ +10% → callout: *"Marc: 'The tape and the numbers finally shook hands — you're +14% on moneylines. Whatever you're doing there, keep doing it.'"*
- If total resolved bets crosses each threshold (10 / 25 / 50) → callout: *"Marc: 'Sample size just jumped. Confidence bands upgraded.'"*
- If `betting_profitability.win_rate_pct` diverges >15pt from `prediction_accuracy.win_rate_pct` → callout: *"Marc: 'You're picking winners but losing money — the odds aren't giving you value in your favorite spots.'"* (this is spec §8 in one line)
- These are pure-string generation, no LLM needed for v1.

**Step 3 — The "Skip" recommendation** *(1 day)*
Add a lightweight endpoint `GET /api/betting/spot-check?bet_type=X&side=home|away&odds=-140`:
- Look up the user's bucket for `{bet_type, side}` in their log
- If n ≥ 10 and ROI ≤ -10% → return `{ recommendation: "skip", reason: "You're 5-14 on away moneyline favorites over the last 6 months. This spot isn't where you win.", confidence: "moderate" }`
- If n ≥ 10 and ROI ≥ +10% → return `{ recommendation: "lean_in", reason: "This is one of your best spots — 12-4 on home dogs at +150 or better.", confidence: "moderate" }`
- Else → return `{ recommendation: "neutral", reason: "Not enough comparable bets yet — log 10+ and we'll flag it.", confidence: "insufficient" }`
- Expose in the `BetForm` component as the user is entering their pick — before they log it.
- **This is the spec §4 "Skip recommendation" in its simplest form.** It's the differentiator.

**Step 4 — 18+ / responsible-gambling gate** *(2 hours)*
- One-time modal on first Betting IQ tab open: "Are you 18+? Confirm you understand this is entertainment analysis, not financial advice."
- Persist in `subscribers` doc alongside `is_premium`.
- Legal footer permanent on the tab.

**Step 5 — Recruit 5-10 real bettors + instrument** *(1 day)*
- Add lightweight event logging (Mongo `bet_iq_events`): `tab_opened`, `bet_logged`, `stat_viewed`, `callout_shown`, `spot_check_invoked`, `skip_recommendation_shown`, `skip_recommendation_followed`
- Manually seed test users' bet logs with 30-60 historical bets each so their stats have signal from day one (users hate logging blank pages)
- Send them a private link. Ask them to use it for 2 weeks.
- Weekly retro on the events + qualitative interview.

### 6.3 What we deliberately do NOT do yet

- ❌ Real sportsbook odds integration (Highlightly/Sportradar/SportsDataIO)
- ❌ Model-generated game picks / real "Game Edge Score"
- ❌ Behavioral pattern detection (revenge/tilt/overconfidence) — no urgent evidence gap
- ❌ Betting DNA profile page — spec §5 waits for volume
- ❌ Pick 10 daily prop board — needs prop engine
- ❌ Community Edge / verified expert follows — needs the whole platform
- ❌ Auto-import from sportsbook affiliates
- ❌ Reggie/Marc LLM-generated callouts (Step 2 uses templated strings; add LLM later if the mechanic works)

### 6.4 What Step 1–4 gets us

- **A live, personalized, spec-compliant Betting Coach** — with the "Skip" differentiator working from day one
- **The one message the spec is built around** — *"The model likes this game — but historically, this is not where you make your best decisions"* — deliverable in a simpler form: *"You've told me your history. This is not your spot."*
- **Zero external dependency** — no odds feeds, no models, no third-party APIs to negotiate
- **Real learning signal** — instrumented, so 2 weeks of usage tells us whether users care
- **Marc's voice on every callout** — proves the character IP works in a Betting context before we invest in more of it

### 6.5 One risk to flag before launching to bettors

The **`odds` field in `BetLog` is stored as free-text string** (`"-140"`). To compute ROI accurately, we're currently trusting the user to also enter their `profit_loss` correctly. For 5-10 bettors this is fine; for scale, we need American-odds parsing + auto P/L calculation. Add if the MVP validates.

---

## 7. INTEGRATION PROVIDERS — ODDS-CAPABLE STATUS

| Provider | File | Can provide odds? | Currently wired? | Status |
|---|---|---|---|---|
| **Highlightly** | `highlightly_client.py` | Yes (per their public docs) | No | **MISSING** |
| **Sportradar** | `sportradar_client.py` | Yes (markets on NHL feed) | No (also key 401'd) | **MISSING** + broken |
| **SportsDataIO** | env var stub only | Yes (their bread & butter) | No file exists | **MISSING** |
| **NHL Public API** | `nhl_data.py`, `nhl_pbp.py` | No (league doesn't publish lines) | Working (for scores/PBP) | N/A |
| **Odds API / RapidAPI odds vendors** | — | Yes | Not evaluated | **MISSING** |

For the smallest MVP (Section 6), **zero of these need to be integrated.** User-entered odds in the Bet Log are enough. Odds ingestion becomes urgent only when we add:
- A real "Game Edge Score" (needs market probabilities to compute)
- CLV tracking (needs closing-line snapshot)
- Sportsbook affiliate deeplinks (needs live line matching to a book)

---

## 8. SUMMARY TABLE — STATUS OF EVERY BETTING IQ CONCEPT

| Concept | Status | Location |
|---|---|---|
| Bet Log data model | **WORKING** | `server.py:98-128` |
| POST `/api/betting/bet` | **WORKING** | `server.py:1601` |
| GET `/api/betting/bets` | **WORKING** | `server.py:1623` |
| DELETE `/api/betting/bet/{id}` | **WORKING** | `server.py:1634` |
| GET `/api/betting/stats` (splits + confidence) | **WORKING** | `server.py:1643` |
| Confidence bands (10/25/50) | **WORKING** | `server.py:1591` |
| Prediction accuracy vs betting profitability separation | **WORKING** | `server.py:1693–1713` |
| Splits by bet type | **WORKING** | `server.py:1714` |
| BettingIQTab UI | **BUILT BUT HIDDEN** | `BackOffice.jsx:848–1008` (tab commented at :32) |
| BetForm entry UI | **BUILT BUT HIDDEN** | `BackOffice.jsx` (part of `BettingIQTab`) |
| Personal Edge Score | **MISSING** | — |
| Skip recommendation | **MISSING** | — |
| Comparable-bet multi-dim matching | **MISSING** | — |
| Behavioral pattern alerts | **MISSING** | — |
| Betting DNA page | **MISSING** | — |
| Daily AI Betting Coach surfacing | **MISSING** | — |
| Closing-line value (CLV) | **MISSING** | — |
| Risk-adjusted results | **MISSING** | — |
| Concerning-pattern detection | **MISSING** | — |
| Units vs dollars toggle | **MISSING** | — |
| Data export / pause / full wipe | **MISSING** (single delete only) | — |
| Free-pick Predictions game | **WORKING** | `Predictions.jsx`, `server.py:1128–1220` |
| Real-time community tally | **WORKING** | `server.py:1128` |
| Prediction leaderboard | **WORKING** | `server.py:1304` |
| Reggie's hand-authored picks | **MOCK** | `analysts.py:275–320` |
| Marc's hand-authored picks | **MOCK** | `analysts.py:275–320` |
| AI Consensus % | **MOCK** (static) | `analysts.py:275–320` |
| Sportsbook odds display | **MOCK** | `mockOdds.js`, `OddsChip.jsx` |
| Real sportsbook line ingestion | **MISSING** | — |
| 18+ / age gate | **MISSING** | — |
| Responsible-play guardrails (spec §10) | **PARTIAL** (footer disclaimer only) | `RecapShow.jsx` footer |
| Subscription paywall foundation | **WORKING** | `server.py:1387–1450` |
| Reggie/Marc voice canon for betting | **SPEC ONLY** | `CHARACTER_STYLE_GUIDE.md`, `analysts.py` prompt |
| Reggie/Marc prompt injection with bet stats | **MISSING** | — |
| "Ask Reggie about a bet" endpoint | **MISSING** | — |
| Reggie's daily-picks show segment (DAILY_PICKS_SPEC) | **SPEC ONLY** | — |
| Reggie accuracy tracking | **SPEC ONLY** | — |
| Agree/Fade tracking | **MISSING** | — |
| Pick 10 daily prop board (PICK10_SPEC) | **SPEC ONLY** | — |
| Community Edge / verified follows (COMMUNITY_EDGE_SPEC) | **SPEC ONLY** | — |
| MOAT invisible logging (predictions + reasoning captured at pick-time) | **PARTIAL** (predictions logged, reasoning captured, but no AI-model output logged) | `server.py:1171` |

---

## 9. THREE THINGS TO ANSWER NEXT (as user framed)

1. **What we already have** → *This audit.*
2. **What Betting IQ should actually be** → *Waiting for user's answer.*
3. **What we need to make the first testable version real** → *Section 6 proposes the smallest testable version. Waiting for user's approval.*

---

## 10. STOP FOR APPROVAL

Report is complete. Written to `/app/memory/BETTING_IQ_AUDIT.md`.

**No code was modified. No files were deleted. No integrations were touched. No comparisons to MARSL / Ticker 1 were performed.**

Ready for your review. Next step waits on your call.

— Read-only Betting IQ audit, Feb 19, 2026.
