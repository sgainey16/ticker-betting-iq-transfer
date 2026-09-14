# BETTING IQ — Consolidated Product Architecture (Audit + Design)

**Status:** Audit + design only. No code. No DB writes. No UI. This document supersedes the previous separate Tonight / Tonight's 10 / Team + Player architecture messages.
**Boundary observed:** No changes to Foundations 1A/1B/1C, Special Teams IQ workstream, Atlas cutover, Community/Fantasy pages, Best Ticker Now, Team Navi. No duplicate prediction engine, no duplicate team/player database. No fake market/analytics/history.

---

## Section 0 — TL;DR

We do NOT need a second system. Roughly **75% of the backend for the daily operating loop already exists** — `iq_calls` + `iq_events` + `iq_wagers` + `iq_users` support append-only prediction capture with instinct/reasoning/confidence/lock/wager/resolve semantics already. The gaps are:
1. **Board-of-questions object** ("Tonight's 10") — one small new collection, not a new engine.
2. **Question templates + resolvers** — a small library that turns real game facts into 10 objectively-resolvable prompts per night. Reuses Foundation 1B's `iq_game_finals` for grading.
3. **Frontend surfaces** — Tonight cleanup completion, My IQ command center (currently a stub), Last Night resolution surface, Betting IQ team/player *lenses* over the existing routes.
4. **Personal analytics projections** — read-only views over `iq_events` (calibration, category strength, prediction-vs-bet drift). All computable today from data we already store.

**Recommended smallest first slice (Section L):** build `iq_boards` + question templates + Last Night resolution surface + My IQ command-center skeleton. Everything else follows from that heartbeat.

---

## Section 23 — Existing Backend Audit (before the design)

### 23.1 What already exists (reuse, do NOT rebuild)

| Concern | Current implementation | Reusable for |
|---|---|---|
| Append-only prediction capture | `POST /api/iq/call/event` with 12 `_VALID_EVENT_KINDS` (`draft_created`, `instinct_captured`, `reasoning_added`, `signal_consumed`, `revision`, `confidence_set`, `locked`, `abandoned`, `wager_attached`, `resolution_delivered`, `voided`, `reflection`) writing to `iq_events`; `_reproject_call()` folds events into `iq_calls` state | Tonight's 10 lock/unlock, confidence, reasoning tags, revisions, resolution — **the entire event model is already correct** |
| Call kinds | `_VALID_CALL_KINDS = {game_pick, prop_pick, pick10_entry, fantasy_lineup, series_pick, community_take}` — **`pick10_entry` already exists** | Tonight's 10 entries slot directly into this kind |
| Prediction resolution | `POST /api/iq/call/{call_id}/resolve` with `ResolveCallReq { outcome_status, correct, actual, grading_rule, grading_version, source, raw_evidence }` | Automated resolution against `iq_game_finals` |
| Wager attach | `POST /api/iq/call/{call_id}/wager` with `WagerReq { played, odds_text, stake, units, book }` | My Bets layer — **wager is a first-class event, already separated from prediction** |
| User identity | `_ensure_user_by_device` upserts `iq_users` keyed on `device_ids` | Anonymous-first flow already in place |
| User brief / insights | `GET /api/iq/user/brief`, `GET /api/iq/user/insights` | My IQ command-center hydration |
| Reputation & leaderboard | `GET /api/iq/reputation`, `GET /api/iq/leaderboard` | Community surface (later) |
| Community feed | `GET /api/iq/community/public-calls`, `POST /iq/community/post`, `GET /iq/community/posts`, `GET /iq/community/specialist-consensus`, `GET /iq/community/specialists`, `GET /iq/community/feed-enriched` | Community page (deferred per boundary) |
| Legacy manual bets | `BetLog` model + `/api/betting/bet` + `/api/betting/spot-check` | **Legacy** — keep read-only; new "My Bets" reads from `iq_wagers` via `iq_calls` |
| Legacy public predictions | `db.predictions` + `POST /api/predictions` (home/away picks) | Powers the current Community % on Tonight's `predictions/games` endpoint. **Keep it**; do NOT migrate to the IQ call system in this pass. Community read stays. |
| Dev tools | `POST /api/iq/dev/simulate-resolve`, `GET /iq/dev/mode` | Testing daily loop before real resolution flows |
| Game/Team/Player identity | Foundation 1A canonical resolvers via `intelligence/*`; `/api/nhl/standings` (live SportsData.io); `/api/stats/teams`; frontend `TeamPage`, `TeamStatPage`, `PlayerProfile`, `PlayerDetail` routes | Betting IQ Team/Player LENSES over existing routes — **do not create new entity records** |
| Postgame truth | Foundation 1B `iq_game_finals` (final score, goalie splits, shot counts) | Automated grading for Tonight's 10 resolvers |

### 23.2 Genuine gaps (build)

| Gap | Why the existing system doesn't cover it |
|---|---|
| **Daily question board object** (`iq_boards`) | No concept of "these 10 questions form tonight's board" exists. `iq_calls` is one call per question; a board groups them and tracks 0/10 → 10/10 progress. |
| **Question templates + resolvers** | The IQ system captures picks against any subject dict, but there's no library that generates 10 objectively-resolvable questions from tonight's slate. Each template needs: subject shape, options, `grading_rule` string, resolver function tied to 1B. |
| **Board resolution scheduler** | Games end at different times through the night; we need a small worker that resolves each question against 1B as its game finalizes and emits `resolution_delivered` events. |
| **My IQ command-center UI** | `/iq?tab=my-iq` renders a placeholder today. The data endpoints exist. |
| **Last Night surface** | No dedicated view for yesterday's resolved board. Data exists; presentation doesn't. |
| **Betting IQ Team/Player lens** | No lens component wraps existing `TeamPage`/`PlayerProfile` with the Betting IQ intelligence framing (Tonight's 10 involvement, Ticker IQ read, community, matchup context). |
| **Personal analytics projections** | `iq_events` has the raw material; there's no read endpoint that returns calibration curves, category strengths, prediction-vs-bet drift, first-instinct-vs-changed-mind. |
| **Navigation context stack** | Deep-link back-navigation from Question → Game → Team → Player → Question must preserve the board position. Frontend doesn't currently retain that state. |

### 23.3 Confirmed absent — DO NOT build in this pass

- Real sportsbook odds / market movement (no vendor wired).
- xG / Corsi / Fenwick / PDO (no tracking feed).
- Any composite Ticker Rating 0-100 for Special Teams / Transition / etc. (per Step 3 plan).
- Duplicate team/player identity tables (existing 1A + `TeamPage`/`PlayerProfile` cover this).
- Community leaderboard redesign, Fantasy redesign.

---

## Section A — TONIGHT (final information + interaction hierarchy)

Preserves the V3.2 corrections and adds Tonight's 10 surfacing.

```
BETTING IQ · TONIGHT · N GAMES        (compact header, no host-split chip)

┌─ Game rail (horizontal, small logo tiles, tip time only) ─┐
│  Selected tile: white ring + team-color gradient wash      │
└────────────────────────────────────────────────────────────┘

REGGIE + MARC · IQ DESK
[Reggie] "Edmonton gets the Ticker lean"  [Marc]
         [ TALK ]  [ HEAR THE READ ]
         · Read (transcript link)                            (Editorial chip · top-right, tiny)

┌──── HERO CRESTS ────┐
   [ COL logo 132px ]  @  [ EDM logo 132px ]                  (no boxes, team-color atmosphere)
        COL                       EDM

THE READ
  Ticker IQ                        [EDM]  58%                (editorial · pre-model — tiny amber)
  Community                        [COL]  80%                (5 predictions — tiny neutral)

MATCHUP INTELLIGENCE
  Team snapshot                                              (renamed from Season · Head to Head)
    · live SportsData.io standings comparison               (LIVE pill)
    · Record / Points / Pts% / Conf rank / Div rank
    · emerald arrow on the better side, per row

[NEW] TONIGHT'S 10 ON THIS GAME
  ~ 2 of tonight's 10 involve this matchup ~
  Q1 · Who wins tonight?                                     [ COL ] [ EDM ]  · locked ✓
  Q4 · Which team scores first?                              [ COL ] [ EDM ]  · not locked
  See tonight's 10 →                                         (deep-link to My IQ · Tonight's 10)

WHAT CHANGED                                                 (real events only; empty state honest)
  · No significant changes yet.

[Sticky bottom] MAKE A PREDICTION  ·  COL @ EDM  →
```

Interaction language: swipe rails, tap expand, Sheet for Talk / Hear / Make a prediction / See tonight's 10.

Anti-patterns explicitly avoided: giant hero card, host-split badge, redundant "Desk & Room disagree" pill, padlocked lens tabs.

---

## Section B — MY IQ (personal command center)

`/iq?tab=my-iq` becomes:

```
MY HOCKEY IQ
  63% Accuracy · 184 graded · Season high 7-day streak    (headline row)
  Last night 7/10 · Tonight 0/10 in progress

┌───────────────── HORIZONTAL SEGMENT RAIL ─────────────────┐
│  LAST NIGHT   |   TONIGHT'S 10   |   MY BETS   |   ME     │
└───────────────────────────────────────────────────────────┘

(Selected segment renders below. Only one segment visible at a time.)

  LAST NIGHT segment          →  see Section D
  TONIGHT'S 10 segment        →  see Section C
  MY BETS segment             →  see Section E
  ME segment (scouting)       →  Overall accuracy · Strongest category ·
                                  Weakest category · Calibration curve ·
                                  Prediction accuracy vs bet accuracy ·
                                  First-instinct vs changed-mind
                                  (each panel gates on n ≥ 10 and shows sample size;
                                   below sample = "keep predicting to unlock this stat")
```

Hierarchy rule: **no giant vertical dashboards.** Segments swap in place. Deep panels expand on tap.

---

## Section C — TONIGHT'S 10 (Question 1 → 10 journey)

### C.1 Board object shape (new — one collection)

```
iq_boards {
  id                : uuid
  device_id         : str              # anonymous-first identity
  slate_date        : "YYYY-MM-DD"     # local slate identity
  version           : "v1"
  questions[10]     : [ QuestionRef ]  # ordered
  created_at        : iso
  locked_count      : int              # projection from iq_calls
  resolved_count    : int              # projection
  correct_count     : int              # projection
}
QuestionRef {
  index             : 1..10
  template_key      : str              # e.g. "who_wins", "team_scores_first", "goalie_saves_higher"
  subject           : dict             # {game_id, team_a, team_b, player_id?, ...}
  options           : [str, str, ...]  # ordered choice labels
  call_id           : uuid | null      # linked iq_call once user acts (kind = "pick10_entry")
}
```

Board projection reads from `iq_calls` where `call_kind == "pick10_entry"` and `board_id == this.id` — **no separate storage of user picks.**

### C.2 Question templates (v1 — objectively resolvable only)

Each template = `{key, prompt, options_fn(subject), grading_rule, resolver(fbin_final)}`.

- `who_wins` — "Who wins {AWAY} @ {HOME}?" · options `[AWAY, HOME]` · resolver: `final.winner_team_id`.
- `team_scores_first` — same options · resolver: first goal event in NHL PBP (already ingested via `nhl_pbp.py`).
- `game_reaches_ot` — options `[Yes, No]` · resolver: 1B `final.period_type != "REG"`.
- `saves_higher` — "Which goalie makes more saves?" · options `[GOALIE_A, GOALIE_B]` · resolver: 1B goalie splits.
- `shots_higher` — "Which team records more shots?" · options `[AWAY, HOME]` · resolver: 1B `shots_on_goal`.
- `named_player_scores` — "Does {STAR_PLAYER} score?" · options `[Yes, No]` · resolver: NHL PBP goal-scorer IDs. Star pool = top-5 season PP goals per team, capped so we don't pick an unknown.
- `pp_scores_first` — "Which PP scores first?" · options `[AWAY_PP, HOME_PP, No PP goals]` · resolver: NHL PBP + strength state (once §3 baseline lands).
- `first_period_leader` — "Who leads after 1?" · options `[AWAY, HOME, Tied]` · resolver: 1B period splits (need extension) OR PBP period-end aggregate.
- `total_goals_over_5_5` — "Over/under 5.5 total goals?" · options `[Over, Under]` · resolver: 1B `home_goals + away_goals`.
- `blowout` — "Will a team win by 3+?" · options `[Yes, No]` · resolver: 1B.

**Rule:** every template ships with a resolver that hits `iq_game_finals` or NHL PBP. If a resolver requires data we don't have, that template is not deployed. No question is ever generated we cannot resolve.

### C.3 Board generation (nightly, deterministic)

- Cap: 10 questions. Diversity constraint: no more than 2 questions per game, no more than 3 questions per template.
- Selection: interesting-first (games with tight Ticker IQ vs Community reads, star player available, special-teams matchup imbalance from Step 3 baseline if live). Deterministic seed = `slate_date` for reproducibility across users on the same night.
- Cutoff: board freezes for a user at tip-time of the first game involved.

### C.4 The Question 1 → 10 journey

```
Q4 / 10 · COL @ EDM
Which team scores first?

[ COL logo · COL ]           [ EDM logo · EDM ]
       (tap)                        (tap)

On tap:
  → optional Confidence chip:  50 · 60 · 70 · 80 · 90       (one tap; skippable)
  → optional Why tags:  GOALTENDING · SPECIAL TEAMS ·
                        RECENT FORM · MATCHUP · LINEUP ·
                        GUT · TELL REGGIE                    (multi-select; skippable)
  → LOCK button                                              (writes iq_call locked event)

Progress row updates: 4 / 10

Deep-dive controls on every question:
  INSPECT →  opens Betting IQ Team lens (Section G) or Player lens (Section H)
  ASK REGGIE →  opens IQCoachChat pre-seeded with this question
```

**Casual path:** tap → tap → tap → LOCK → next.
**Deep path:** tap → INSPECT → team/player lens → back to same question with pick preserved.

State preservation is described in Section I.

### C.5 Change your mind

Until lock, a user can change their answer freely. After lock, a question is immutable and a `revision` event fires ONLY if the game hasn't started — otherwise 409. Both events remain in history so "you changed your original pick" is observable in Reflection.

---

## Section D — LAST NIGHT (resolution + feedback)

```
LAST NIGHT · MON FEB 12
7 / 10   ·   70% Accuracy

RESOLVED
  ✓  Who wins COL @ EDM?               EDM  · you picked EDM         [detail →]
  ✕  Does McDavid score?               No  · you picked Yes         [detail →]
  ✓  Which PP scores first?            EDM  · you picked EDM        [detail →]
  ✓  Over/under 5.5?                   Over · you picked Over       [detail →]
  · · ·

BREAK DOWN MY NIGHT                                                  (Reggie/Marc, personal)
  "You went 4/4 on game winners. Player calls hurt you — 1/3 tonight."
  (only stated when the small-sample cell supports it; provenance from history)

  [ HEAR IT ]  [ TALK ]
```

Tap-a-result opens the Section 10 detail view:

```
Q7 · Does McDavid score?         RESULT: NO       YOU PICKED: YES

WHAT I PICKED           Yes
MY CONFIDENCE           70%
WHY I PICKED IT         Recent form, matchup
WHAT HAPPENED           McDavid: 0 goals, 4 shots, 21:32 TOI      (from 1B + NHL PBP)
WHAT TICKER KNEW        (as-of your lock timestamp, NOT after)
  · Ticker IQ leaned EDM 58%
  · Community leaned COL 80%
  · McDavid last 5: 3G / 2A
  (any post-lock information is explicitly withheld to preserve the as-of model)
```

**Data source:** `iq_calls` locked-event timestamp is the `as_of` for the WHAT TICKER KNEW panel. This is the same dual-gate rule from Step 1 §6 / Foundation 1B — no post-lock leakage.

---

## Section E — MY BETS (actual wagers, separate from predictions)

Reads from `iq_wagers` (populated via `POST /api/iq/call/{call_id}/wager`). Never a substitute for predictions — a wager attaches to an existing call.

```
MY BETS · SEASON
Placed: 43        Won: 22       ROI: +6.4 units       ROI%: +14.9%
Predictions this season: 184 · Bet on 43 of them (23%)

Predictions accuracy      63%
Actual bet accuracy       51%   ▼  (12 pt gap — you're better at predicting than at picking what to bet)
                                    (only surfaces when both samples ≥ 25 per §23 confidence bands)

BREAKDOWN                                            (each row gates on n ≥ 10)
  By bet type            Moneyline 58% · Total 44% · Prop 40%
  By confidence bucket   90%-confidence bets: 3/4 · 60%-confidence bets: 5/12
  By category tag        Goaltending 68% · Special Teams 40% · Matchup 55%
```

Betting IQ participation never requires wagering money. `prediction_only=True` (BetLogCreate flag already exists) or simply an `iq_call` without an `iq_wager` attached — both paths honest.

---

## Section F — REGGIE + MARC (coaching role)

Existing IQCoachChat already provides the conversational surface. The coaching role becomes a **prompt layer** on top of the same endpoint, injecting the user's real IQ data as system context.

Prompt-context strata (only inject facts, never invent):

- User's live board state (`iq_boards` + linked calls).
- User's stored preferences from `subscribers` / `rosters`.
- User's Section D last-night resolution (grade + per-category grade).
- User's Section B / ME scouting projections when sample ≥ 10.
- Tonight's public reads (`predictions/games` community aggregate).
- 1B recent-history facts for a queried team/player.

Prompt-context strata **explicitly forbidden**: fabricated stat claims, xG, PDO, market movement, any signal that isn't in the wired data stack.

Coach-role phrasing patterns (activate only when real):
- "You went 7/10 last night. Want the quick breakdown?" — after Last Night resolution.
- "You're going against Ticker on this one." — when user pick ≠ Ticker IQ side.
- "Player-goal calls have been one of your weaker categories recently." — when category calibration sample ≥ 10.
- "Interesting — you changed your original pick." — when revision event exists on a locked call.

All coach lines carry `Editorial` provenance and are subject to the same `UNVERIFIED_PATTERNS` scrubber already in `MatchupIntel.jsx` — extended for the coach prompt.

---

## Section G — BETTING IQ TEAM VIEW (lens over existing pages)

**Do NOT create a new team page.** Existing routes: `/team/:code` → `TeamStatPage`, `/plus/team/:code` → `TeamPage`. Betting IQ needs a `/iq/team/:code` route that renders the existing team data through the Betting IQ intelligence framing.

Reusable assets:
- Foundation 1A team identity resolver.
- `/api/nhl/standings` (live) → Record / Points / Pts% / Conf & Div rank.
- `/api/stats/teams` (mock fallback) → color, name.
- Highlightly logos.
- Foundation 1B `iq_game_finals` → recent 1/3/5/10 record.
- Existing `TeamPage` components can be embedded as-is where they render.

Betting IQ Team view sections (only render sections with real data):

```
[ Big crest with team-color atmosphere ]         NAME
                                                 Record · Points · Div rank

TONIGHT
  Next matchup   OPP @ HOME  ·  7:00 PM ET
  Ticker IQ read
  Community read
  Tonight's 10 questions on this team           (deep-links back preserving state)

RECENT FORM
  Last 1/3/5/10                                  (from 1B)
  Home / Road split                              (from 1B where present; hidden otherwise)

MATCHUP LENS (renders only when Special Teams IQ baseline lands)
  · currently omitted per boundary — Section 5 hides unavailable lenses

WHAT CHANGED
  · lineup / goalie / scratches events (from future 1C)

Reggie / Marc  [ TALK ] [ HEAR ]                (context-seeded)
```

No section renders empty — if the underlying data doesn't exist yet, the section is omitted entirely (same rule as Tonight V3.2 lens hiding).

---

## Section H — BETTING IQ PLAYER VIEW (lens)

Route: `/iq/player/:playerId`. Same rule — wraps existing `PlayerDetail` / `PlayerProfile` data, does not duplicate.

Reusable assets:
- `/api/stats/players` (Sportradar → mock fallback).
- Foundation 1B goalie splits for goaltenders.
- NHL PBP goal-scorer / assist attribution.
- Existing player headshot / images pipeline.

Betting IQ Player view sections:

```
[ Photo ]  NAME  · POS · TEAM
           Age · Height/Weight · Season line

TONIGHT
  Opponent  ·  Tip time
  Ticker IQ read on the game
  Tonight's 10 questions involving this player   (deep-linked)
  Community view (if applicable)

RECENT PERFORMANCE
  Last 1/3/5/10 line                             (from 1B / PBP goal events)
  TOI trend                                       (only when shifts endpoint is wired — S4.4)
  Role / line / unit                              (only when 1C ships — omitted today)

STATUS
  Available / Questionable / Scratched            (only when injury feed wired — omitted)

Reggie / Marc  [ TALK ] [ HEAR ]
```

Same omission rule — the view never fabricates.

---

## Section I — NAVIGATION / STATE

State stack (frontend-only, no new backend):

```
{
  stack: [
    { screen: "iq/tonight", scroll: 0 },
    { screen: "iq/tonights-10", questionIndex: 4, scroll: 320 },
    { screen: "iq/team/EDM", scroll: 0 },
    { screen: "iq/player/mcdavid", scroll: 260 },
  ]
}
```

- Deep-link URLs carry enough to reconstitute state: `/iq/tonights-10?board=<id>&q=4`, `/iq/team/EDM?from=board:<id>:q4`.
- Frontend keeps a session-scoped stack (context provider) so back-navigation preserves scroll position and, critically, the pending pick state on an unlocked question.
- Router pattern: existing `react-router` `useLocation().state` for stack push/pop.
- No new state persisted to DB — this is UX plumbing.

Rule: **from Question → Game → Team → Player → back must land exactly on the same question with the same pending pick**, even if the user came in via a shared URL.

---

## Section J — Existing backend reuse vs. genuine build

| Feature | Reuse | Build new |
|---|---|---|
| Lock a Tonight's 10 answer | `POST /api/iq/call/event` with `kind="locked"`, `call_kind="pick10_entry"` | ⃝ nothing |
| Confidence | Same endpoint, `kind="confidence_set"` | ⃝ |
| Why-tags reasoning | Same endpoint, `kind="reasoning_added"` | ⃝ |
| Change your mind pre-lock | Same endpoint, `kind="revision"` | ⃝ |
| Attach a wager to a locked call | `POST /api/iq/call/{call_id}/wager` | ⃝ |
| Resolve a call | `POST /api/iq/call/{call_id}/resolve` | ⃝ |
| User accuracy / streak | `GET /api/iq/user/brief` + `GET /api/iq/user/insights` | + a `by_category` and `by_confidence_bucket` extension on insights |
| Board generation | none | ✱ `iq_boards` collection + templates + generator |
| Board resolution scheduler | none | ✱ small worker that watches 1B game finals and pushes `resolution_delivered` to each linked call |
| Last Night surface | data yes, view no | ✱ frontend + a `GET /api/iq/board/{id}` read endpoint |
| My IQ command-center | endpoints yes, view is stub | ✱ frontend segment rail |
| Betting IQ Team/Player lens | data + existing routes yes | ✱ frontend lens components + `/iq/team/:code`, `/iq/player/:playerId` routes |
| Personal analytics | raw material yes | ✱ `GET /api/iq/user/analytics` projection (calibration, category, prediction-vs-bet) |

**No duplicate prediction engine. No duplicate team/player DB.** Every new thing above is either a small collection (`iq_boards`), a small projection read, or a frontend route.

---

## Section K — DATA INTEGRITY

- **Resolution:** every question template ships with a resolver bound to 1B or NHL PBP. Resolution events are `verified_fact`. Scheduler is idempotent — re-running a resolve produces no state change.
- **As-of protection:** the "WHAT TICKER KNEW" panel on a Last Night detail (Section D) filters every input by `recorded_at <= locked_ts AND source_time <= locked_ts`. Same dual-gate rule as Foundation 1B and the Step 3 baseline. **Post-lock information never leaks into the retrospective view.**
- **Provenance on every fact surfaced:** `verified_fact` for 1B and PBP; `attributed_observation` for future beat-reporter feeds (1C, not implemented here); `ticker_inference` for anything derived; `editorial` for host takes with the scrubber applied.
- **Sample-size gates:** Section 7 of the existing Betting IQ spec — every stat surfaces a confidence band (`insufficient / low / moderate / higher`). Below `insufficient`, the stat cell says "keep predicting to unlock this" and does NOT render a number.
- **Prediction ≠ bet:** enforced by schema — `iq_wagers` is a distinct event kind (`wager_attached`) tied to but separate from prediction. Analytics NEVER combine them into one accuracy number without labeling the split.

---

## Section L — Smallest implementation sequence (frontend habit test)

Each step is independently shippable and independently reversible. No step depends on the Special Teams IQ baseline landing first.

**L.1 — Board object + one template (2 backend endpoints, 0 frontend)**
- Add `iq_boards` collection.
- Implement ONE template: `who_wins`.
- Add `GET /api/iq/board/today?device_id=...` (get-or-create today's board), `POST /api/iq/board/{id}/resolve` (dev endpoint).
- Test: seed a board, resolve it, verify 1/1 accuracy on user's brief.

**L.2 — Tonight's 10 UI shell in My IQ segment**
- Render the board as 10 rows on a placeholder My IQ page (segment rail).
- Wire pick capture through the EXISTING `POST /api/iq/call/event` — `who_wins` questions become `pick10_entry` calls.
- Confidence + why-tags optional, skippable.
- Test on phone: tap through 10 questions, lock 10, watch progress become 10/10.

**L.3 — Last Night surface + resolution scheduler**
- Add remaining 5 low-risk templates whose resolvers hit 1B directly (`team_scores_first`, `game_reaches_ot`, `saves_higher`, `shots_higher`, `total_goals_over_5_5`).
- Add the resolver worker (runs on demand via dev endpoint first, then scheduled).
- Ship the Last Night detail surface.
- Test: yesterday's board rolls to Last Night; user sees 7/10 grade and per-question detail with as-of "what Ticker knew" view.

**L.4 — Tonight contextual insertion**
- Add "TONIGHT'S 10 · N ON THIS GAME" strip to each Tonight matchup body (uses `iq_boards` today's).
- Deep-link that strip to the My IQ · Tonight's 10 segment with the question pre-scrolled.
- State-preservation shim (navigation context provider — Section I).
- Test on phone: tap Tonight's 10 chip → answer → back → still on same game.

**L.5 — My IQ command-center completion**
- Segment rail: Last Night · Tonight's 10 · My Bets · Me.
- ME segment uses existing `/api/iq/user/brief` + `/api/iq/user/insights`.
- Extend insights with by-category and by-confidence-bucket projections (small backend addition).
- Test: personal scouting report populates only cells with sample ≥ 10.

**L.6 — Player-context templates (adds STAR templates)**
- Add `named_player_scores` and `first_period_leader` templates once we have a reliable star pool per team (top-N PP goals from PBP or Sportradar leaders).
- Test on phone: at least one player-attribute question in the daily 10.

**L.7 — Betting IQ Team + Player lenses**
- `/iq/team/:code` and `/iq/player/:playerId` frontend routes.
- Lens components consume existing endpoints. Sections without real data omitted (Section 5 rule).
- Deep-link back to origin question via the navigation stack.
- Test: from Q4 → EDM lens → McDavid lens → back → Q4 with pending pick intact.

**L.8 — Coach role prompt layer (last, because it depends on prior data being real)**
- Extend IQCoachChat system prompt with the strata in Section F.
- Extend the `UNVERIFIED_PATTERNS` scrubber to cover coach output.
- Test: coach line "You went 4/4 on game winners" only appears when Section D history supports it.

**L.9 — My Bets sub-surface**
- Wire `iq_wagers` attach flow into the Section E surface.
- Ship the prediction-vs-bet drift panel with the ≥25 sample gate.
- Test: log a wager on a locked call; watch it flow into My Bets.

---

## Section M — Boundaries observed

- Foundation 1A/1B — read-only consumer. No writes.
- Foundation 1C — referenced only for its `PregameContextEvent` trust-tier vocabulary. No implementation here.
- Special Teams IQ baseline — cited as the plug-in path for the future Matchup Lens; no build coupling.
- Atlas — untouched.
- Community / Fantasy pages — not redesigned. Community % on Tonight continues to read the existing `db.predictions` endpoint.
- Best Ticker Now / Team Navi — untouched.
- No duplicate prediction engine — Tonight's 10 rides `iq_calls`/`iq_events`.
- No duplicate team/player DB — Betting IQ Team/Player are frontend lenses over existing routes.
- No fake market data, no fake advanced metrics, no fake user history.

---

**End of consolidated architecture. No code. Awaiting approval on Section L sequencing.**
