# IQ Tab — Ticker App Launcher Handoff Dossier

**Purpose.** Everything the Main Ticker workstream needs to fold Betting IQ + Hockey IQ + Fantasy IQ into a single **IQ** bottom-nav tab.
**Not a design doc.** This is the *brain* — data, collections, endpoints, grading rules, reputation math, providers, honesty rules.
**Every claim below is grounded in a real file in this fork.** File + line references included so nothing is imagined.

---

## Section 0 — TL;DR

**What "IQ" is.** One tab. Three lenses on the same underlying event log:
- **Hockey IQ** = general prediction accuracy (game winners, props, series, daily boards).
- **Betting IQ** = the subset of predictions with a wager attached.
- **Fantasy IQ** = start/sit accuracy.
- **Community IQ** = publicly-locked calls that resolved correctly.
- **Accuracy Overall** = raw record across everything gradeable.

**One append-only event log powers all five.** No parallel scoreboards. No duplicate stats.

**Smallest launch shape** (Section 10): drop-in the IQ tab as a shell rendering three things — Tonight's 10 fast loop, My IQ history/reputation, one Ticker-style Game IQ overlay. Bring six collections, three provider clients, ~15 endpoints, one grading pipeline. Everything else can wait.

---

## Section 1 — The intelligence brain (what already runs today)

### 1.1 Event-sourced prediction engine (`backend/iq_core.py`)

**Principle.** `UserCall.stance` is *never* mutated directly. It's projected from an append-only `iq_events` log. This is what makes as-of integrity possible — you can rewind any call to what the user knew at lock time.

**Call kinds** (`_VALID_CALL_KINDS`, server.py:2036):
```
game_pick        who wins tonight's game
prop_pick        player-to-score, shots, saves, totals, etc.
pick10_entry     daily 10-question board entry
fantasy_lineup   start/sit
series_pick      who wins a playoff series
community_take   explicitly-locked forum call
```

**Event kinds** (`_VALID_EVENT_KINDS`, server.py:2031):
```
draft_created         first tap
instinct_captured     first_instinct payload attached
reasoning_added       "why" text or tags
signal_consumed       user saw a Signal (market line, ticker model, etc.)
revision              user changed their pick before lock
confidence_set        1..10 slider committed
locked                explicit lock, ui_action string required
abandoned             user walked away
wager_attached        Betting IQ path — an iq_wagers row now points here
resolution_delivered  Resolution written by the grader
voided                data quality issue → not counted in accuracy
reflection            postmortem note the user added later
```

**Projection contract** (`project_call_from_events`, iq_core.py:257): every event flows through one pure function. If you replay the log up to any timestamp `T`, you get the call's state at `T`. That's the *only* way anyone should read a call.

### 1.2 Foundation 1A — Canonical identity (`backend/intelligence/models_1a.py`)

Every team, player, game has a canonical `id` and a `ProviderIdsTeam` / `ProviderIdsPlayer` / `ProviderIdsGame` map to NHL Public / SportsData.io / Sportradar / Highlightly. This is the reason the same "Edmonton Oilers" doesn't fork into three different rows depending on who ingested the update.

**Deployed.** Frozen. Don't touch.

`GameContextSnapshot` (models_1a.py:315) is the pregame snapshot Foundation 1A writes at freeze time — it's what "what did the user know when they locked this call?" attaches to via `context_snapshot_ref` on `UserCall`.

### 1.3 Foundation 1B — Immutable recent history (`backend/intelligence/models_1b.py`)

**Collections:** `iq_game_finals`, `iq_team_season_coverage`, plus a set of `*_as_of` projections.

**Key shapes:**
- `FinalScore` (models_1b.py:51) — home_goals, away_goals, period_scores, overtime, shootout, empty_netter_counts.
- `GoalieLine` (models_1b.py:72) — starter GA, saves, save_pct, decision.
- `TeamGameFacts` (models_1b.py:107) — shots, hits, PIM, PP goals/opps, PK goals-against/opps, faceoff W/L.
- `GameFinal` (models_1b.py:129) — canonical id, corrections chain, version, source provenance.

**Rule.** Corrections *never* mutate. They create a new versioned row. `recorded_at <= as_of_iso` filters everything for temporal integrity. This is what protects the Recap "what Ticker thought" panel from leaking post-game information.

**23/23 tests green.** 32 teams, 222 unique games backfilled. Frozen.

### 1.4 The Grading pipeline

Runs whenever `iq_game_finals` writes a new row (or dev-mode `/iq/board/{id}/resolve` fires):

1. Find all `iq_calls` with `subject.game_id` matching, state=`locked`.
2. Compare `subject.pick` to the actual outcome per the call's `grading_rule`.
3. Write `iq_resolutions` (correct / incorrect / ungradeable / voided).
4. Append `resolution_delivered` event.
5. `_reproject_call` recomputes stance → state moves to `resolved`.

**Ungradeable** ≠ incorrect. Data-quality holes never count against a user.

---

## Section 2 — Providers + env

### 2.1 Wired providers (`backend/.env`, `backend/*_client.py`)

| Provider | Env keys | Status | Client |
|---|---|---|---|
| **NHL Public API** | (none — free) | ✅ Live | `nhl_data.py`, `nhl_pbp.py` |
| **SportsData.io** | `SPORTSDATA_API_KEY` | ✅ Live | inline in `server.py` |
| **Sportradar NHL v7** | `SPORTRADAR_API_KEY`, `SPORTRADAR_ENABLED`, `SPORTRADAR_SEASON_TYPE`, `SPORTRADAR_SEASON_YEAR` | ⚠ 403s (trial expired) | `sportradar_client.py` |
| **Highlightly** | `HIGHLIGHTLY_API_KEY`, `HIGHLIGHTLY_BASE_URL`, `HIGHLIGHTLY_ENABLED` | ✅ Live | `highlightly_client.py` |
| **ElevenLabs** | `ELEVENLABS_API_KEY`, `ELEVENLABS_DAILY_CHAR_LIMIT` | ✅ Live | inline (Reggie/Marc voices) |
| **Emergent LLM key** | `EMERGENT_LLM_KEY` | ✅ Live | inline (Claude for pregame copy) |
| **Imagn** | `IMAGN_API_KEY` | ✅ Live | player imagery |

### 2.2 Data honesty tiers

| Tier | Meaning |
|---|---|
| ✅ **AVAILABLE NOW** | Wired to a live feed (NHL Public / SportsData.io / Highlightly / our own `iq_*`) |
| 🟡 **DERIVABLE NOW** | Real underlying data exists (PBP or box), projector needs to be written, low-fidelity → labelled |
| ❌ **REQUIRES SPORTLOGIQ / PREMIUM PROVIDER** | Tracking-quality data. **Never fabricated.** |
| ❌ **REQUIRES MARKET/ODDS PROVIDER** | Real bookmaker odds. **Never fabricated.** `OddsChip.jsx` exists visually but wires to nothing. |
| ⚫ **NOT CURRENTLY RELIABLE** | Raw provider field exists but is known-noisy (e.g. NHL Public giveaway/takeaway for team ratings). |

**Governing rule.** A metric never appears in the UI at a higher tier than its data supports.

---

## Section 3 — Collections (Mongo)

Six collections carry the IQ brain. All append-only or version-safe.

```
iq_users         one per anonymous device_id (or authed user)
                  { id, device_ids[], nickname, prefs.default_visibility, created_at }
iq_calls         the committed decision object
                  { id, user_id, kind, subject{}, stance{}, first_instinct{},
                    state, visibility, published_at, created_at, locked_at,
                    resolved_at, context_snapshot_ref, wager_id }
iq_events        the append-only truth log — every call state change lives here
                  { id, call_id, user_id, ts, source, kind, payload{} }
iq_resolutions   grader output — one row per resolved call
                  { id, call_id, outcome_status, correct, actual{}, grading_rule,
                    grading_version, source, raw_evidence{}, created_at }
iq_wagers        Betting IQ ledger — only when a user records a real wager
                  { id, call_id, user_id, stake, units, book, price_taken,
                    price_type, created_at }
iq_boards        daily Tonight's 10 board
                  { id, user_id, device_id, board_date, questions[{ q_id,
                    template, subject{game_id,home,away}, options[],
                    grading_rule }], created_at }
```

Plus the shared foundations:
```
iq_game_finals              immutable game results
iq_team_season_coverage     partial-by-default season coverage
iq_pbp_events_raw/norm      free NHL PBP baseline (Special Teams engine, planned)
iq_posts                    community posts (public/anonymous_aggregate calls)
```

**Reputation is derived, not stored.** `compute_reputation` (iq_core.py:693) re-computes on demand from `iq_calls` + `iq_resolutions` + `iq_wagers` + `iq_posts`.

---

## Section 4 — Endpoints (surface area to expose from the IQ tab)

Full list from `grep '^@api\.' backend/server.py`. All under `/api`.

### 4.1 IQ engine — MUST BRING

```
GET   /iq/user?device_id=                        get-or-create user, returns prefs + eligibility
POST  /iq/user/attest-adult                      Betting IQ gate (only if you keep the wager-record capability)
GET   /iq/user/brief?device_id=                  compact "your IQ state" — accuracy summary, open calls
GET   /iq/user/insights?device_id=               strengths/weaknesses insights (sample-gated)
GET   /iq/user/{user_id}/calls                   user's call history
POST  /iq/call/event                             the single write path — appends an event, reprojects
GET   /iq/call/{call_id}                         one call with its full event log
POST  /iq/call/{call_id}/resolve                 grader entry point
POST  /iq/call/{call_id}/wager                   attach a wager (Betting IQ)
PATCH /iq/call/{call_id}/visibility              private ↔ public ↔ anonymous_aggregate

GET   /iq/reputation?device_id=                  five-dimension reputation (Hockey / Betting / Fantasy / Overall / Community)
GET   /iq/leaderboard?dimension=hockey_iq&limit= ranked qualified users per dimension

GET   /iq/board?device_id=&board_date=           get-or-create daily Tonight's 10 board
POST  /iq/board/{board_id}/lock                  idempotent per-question lock
POST  /iq/board/{board_id}/resolve               dev-mode grader (production replaces with 1B trigger)
PATCH /iq/user/prefs                             one-time default_visibility save

GET   /iq/community/public-calls                 the community feed source
POST  /iq/community/post                         explicit forum post (community_take)
GET   /iq/community/posts                        posts list
GET   /iq/community/specialist-consensus         who's currently hot on a specific market
GET   /iq/community/specialists                  qualified specialists list
GET   /iq/community/feed-enriched                feed + reputation joined
GET   /iq/dev/mode                               is IQ_DEV_MODE on?
POST  /iq/dev/simulate-resolve                   dev grader
```

### 4.2 Ticker-side data endpoints — REUSE FROM MAIN TICKER

These already exist in this fork. Assume Main Ticker has equivalents. If not, port them:

```
GET   /nhl/standings                             live standings
GET   /nhl/games                                 today's schedule
GET   /stats/teams                               team stat table (season-to-date)
GET   /stats/players                             player stat table
GET   /predictions/games                         tonight's slate + Ticker Model + community %
POST  /predictions                               community prediction (game_pick shortcut)
GET   /predictions/mine?user_name=               my predictions history
GET   /predictions/leaderboard                   community leaderboard (legacy)
GET   /recaps/highlights                         Highlightly clips
GET   /recap-show/post-game-stats                for the Recap IQ segment
POST  /assistant/reggie/chat                     Reggie chat brain
POST  /assistant/reggie/action                   Reggie actionable prompts (bet log, etc.)
GET   /betting/stats                             legacy /back-office numbers
GET   /radio/station/{team_code}                 nice-to-have, not IQ-critical
```

---

## Section 5 — The five reputation dimensions (`compute_reputation`, iq_core.py:693)

Kept **separate on purpose**. Never collapsed into one score. Every dimension carries `n`, `correct`, `ungradeable`, `accuracy_pct`, `qualified` (n ≥ 10).

| Dimension | What counts |
|---|---|
| **hockey_iq** | Resolved calls of kind `game_pick`, `prop_pick`, `series_pick`, `pick10_entry` |
| **betting_iq** | Resolved calls **with an `iq_wagers` row attached** |
| **fantasy_iq** | Resolved calls of kind `fantasy_lineup` |
| **accuracy_overall** | Every resolved call, raw record |
| **community_cred** | Resolved calls with `visibility == "public"` — private calls never count |

**Leaderboard rule** (`leaderboard_from_user_reps`, iq_core.py:796): only `qualified` users (≥ 10 graded in that dimension) appear. Volume without accuracy doesn't rank.

**Per-team accuracy** (planned, easily derivable today): group `iq_calls` by `subject.home_id` + `subject.away_id`, join `iq_resolutions`. Same math, one filter. Same for per-player accuracy on `subject.player_id`. Backend addition is small (~30 lines); no schema change.

---

## Section 6 — Signals (external world)

`Signal` (iq_core.py:200) is the *only* concept the user can "consume" and have it recorded via `signal_consumed`. This is how the model learns which inputs correlate with better calls.

**Sources** (`SignalSource`, iq_core.py:186):
```
market_line              real bookmaker line ← ❌ not wired
ticker_model             our own probability ← ✅ editorial today (game.ai_consensus)
community_consensus      aggregate community % ← ✅ real
specialist_pick          from /iq/community/specialists ← ✅ derived
forum_observation        community post the user read ← ✅ real
injury_report            ← 🟡 partial (NHL Public + SportsData.io)
goalie_confirmed         ← ✅ from probable goalies feed
schedule_context         rest/travel/B2B from Foundation 1A snapshot ← ✅ real
```

**Fact tiers** (`FactTier`, iq_core.py:197): `verified`, `reported`, `rumor`. Never mixed in UI.

---

## Section 7 — Grading & as-of integrity rules

Rules the launcher MUST preserve (or the whole trust story collapses):

1. **Never mutate a call after lock.** New events only.
2. **Every grade attaches provenance.** `Resolution.source` + `Resolution.grading_version` + `raw_evidence`.
3. **`recorded_at <= as_of_iso` filters every retrospective read.** No post-lock data leaks into "what Ticker thought."
4. **Corrections create new versioned rows.** Never overwrite.
5. **Ungradeable is not incorrect.** Data-quality holes never count against the user's accuracy.
6. **Complete requires positive evidence.** `iq_team_season_coverage` is partial by default. Never marked complete on absence.
7. **Prediction ≠ Wager.** `iq_calls` and `iq_wagers` never merge into one accuracy number without a labelled split.
8. **Reputation is derived at read time.** Never stored. Recomputable at any point.

---

## Section 8 — What's mocked / provider-dependent / not built

- **Ticker Model probability** — `game.ai_consensus`. Editorial, hand-authored per game in `backend/analysts.py`. Honest label `EDITORIAL · PRE-MODEL`. Not a real model yet.
- **Reggie + Marc panel picks** — hand-authored in `analysts.py`. Broadcast copy.
- **Market column of the Read triangle** — LOCKED. Requires a real odds provider.
- **Deep intelligence lenses** — 9-lens `INTELLIGENCE_LENS_REGISTRY` exists (frontend/src/components/iq/v2/BettingIQOverlays.jsx). Only `overview` renders — the other 8 require Sportlogiq or the Special Teams free baseline.
- **Real board resolver** — Tonight's 10 grades in dev-mode via `POST /iq/board/{id}/resolve`. Production replaces this with a scheduled trigger reading `iq_game_finals`.
- **Custom analytical reels ("WHAT → WHY → SHOW ME")** — architecture designed, video pipeline not built. Should dispatch to Main Ticker's Highlights/Reels layer when built, not a second video engine.

---

## Section 9 — What NOT to port

Do not bring any of these into Main Ticker:

- `frontend/src/components/iq/v2/TonightHero.jsx`, `GameRailV2.jsx`, `MatchupIntel.jsx`, `MatchupStats.jsx` — retired-in-place, they duplicate Main Ticker's game surface. See `BETTING_IQ_TICKER_CONVERGENCE_AUDIT.md`.
- `frontend/src/pages/BackOffice.jsx` legacy adult-gated bet log UI — keep the `iq_wagers` collection, retire the standalone page.
- The four-empty-analytics-card wall + Go Deeper prompt paragraphs. Warm empty states only.
- The blanket 18+ `BETTING · LOCKED` unlock panel. Age/jurisdiction gating stays modular for specifically regulated features only — never gates the general Hockey IQ experience.
- Any `iq/v2/*` component with hand-crafted styling — Main Ticker's V2 kit replaces the visual role.
- `analysts.py` GAMES fixture as canonical data — that's editorial seed. Real slate comes from `/predictions/games` + NHL Public schedule.

---

## Section 10 — Smallest launcher-MVP recipe

**The minimum that proves the IQ tab works:**

### Backend port (self-contained, ~5 files + models)
```
backend/iq_core.py              [KEEP AS-IS]  — the entire brain, 849 lines
backend/intelligence/           [OPTIONAL for MVP] — Foundation 1A/1B. Can defer if Main Ticker has an equivalent canonical layer; otherwise port it.
backend/server.py               [PORT SECTIONS] — the IQ endpoints in Section 4.1. Grep for `@api.` + `/iq` — ~1,100 lines in one contiguous block near line 2089.
backend/analysts.py             [PORT AS EDITORIAL SEED] — hand-authored panel picks + ai_consensus per game.
backend/.env                    [ADD KEYS]  — MONGO_URL, EMERGENT_LLM_KEY, ELEVENLABS_API_KEY, SPORTSDATA_API_KEY, HIGHLIGHTLY_API_KEY, IMAGN_API_KEY, IQ_DEV_MODE
```

### Collections to provision (Mongo, empty is fine)
```
iq_users, iq_calls, iq_events, iq_resolutions, iq_wagers, iq_boards
iq_game_finals, iq_team_season_coverage    (only if you port Foundation 1B)
iq_posts                                    (only if you keep community feed)
```

### Frontend port (bring three surfaces + one shared lib)
```
frontend/src/components/iq/v2/TonightsTenLoop.jsx     [PORT] fast SEE→TAP→LOCK→NEXT loop
frontend/src/components/iq/v2/MyIQCommandCenter.jsx   [PORT] history/reputation home
frontend/src/components/iq/v2/LastNight.jsx           [PORT] compact result strip
frontend/src/components/iq/v2/BettingIQOverlays.jsx   [PORT] ReadTriangle + IntelligenceRail + MyCallState
frontend/src/lib/teamColors.js                        [PORT] 32-team primary color palette
frontend/src/lib/teamLogos.jsx                        [REUSE Main Ticker's] — do not port ours
frontend/src/lib/api.js                               [REUSE Main Ticker's]
frontend/src/lib/device.js                            [REUSE Main Ticker's]
```

### The IQ tab shell (Main Ticker composes, doesn't inherit)
```
Tab: IQ
├─ Segment: TONIGHT   →  TonightsTenLoop  (bottom-first)
├─ Segment: MY IQ     →  MyIQCommandCenter (banter + rail + Last Night + reputation strip)
├─ Segment: COMMUNITY →  Feed of /iq/community/public-calls   [optional at launch]
└─ Overlay entry from any Main Ticker Game page:
   →  <ReadTriangle> + <IntelligenceRail> + <MyCallState>  (Betting IQ overlay slots)
```

### Launcher-MVP acceptance criteria
- New user opens IQ tab → sees an honest empty state, taps PLAY, locks a card in < 60s.
- Same game viewed on the Main Ticker Game page shows a Read triangle (Ticker IQ / **Market LOCKED with reason** / Community %).
- Resolving a call writes to `iq_resolutions` and flips the user's dimension counters.
- User reaches 10 graded calls → `qualified` flips, appears on `hockey_iq` leaderboard.
- No metric shows fabricated data. Market column stays locked with visible reason string.

**What can wait post-MVP.** Community feed, Specialist Consensus, Go Deeper confidence capture, Season/Playoffs/Draft/Long Range prediction families, deep intelligence lenses beyond Overview, custom analytical reels, prediction-vs-bet drift, calibration curves, per-team/per-player accuracy views. All schema-ready today. Zero of them block launch.

---

## Section 11 — Key design/architecture docs to bring with the code

These docs in `/app/memory/` are worth reading in order:

1. `BETTING_IQ_CONSOLIDATED_ARCHITECTURE.md` — 517 lines. The consolidated Tonight's 10 + My IQ + Last Night design.
2. `BETTING_IQ_TICKER_CONVERGENCE_AUDIT.md` — 452 lines. The "Best Ticker is the parent chassis" decision and surface-by-surface convergence map.
3. `TICKER_PRO_GAME_SURFACE_PROOF.md` — the one-game convergence proof + component-reuse table (reused unchanged / augmented / Betting-IQ-specific / retirement candidates).
4. `HOCKEY_IQ_V2_SURFACE_DESIGN_MAP.md` — 260 lines. The nine surfaces mapped to V2 primitive roles, with data tier per element.
5. `FOUNDATION_1A_ACTIVATED.md` + `FOUNDATION_1B_BUILD_EVIDENCE.md` — the identity + recent-history brain.
6. `SPECIAL_TEAMS_IQ_FEASIBILITY.md` + `SPECIAL_TEAMS_IQ_PROVIDER_MATRIX.md` + `SPECIAL_TEAMS_IQ_STEP3_BASELINE_PLAN.md` — the first deep intelligence lens roadmap. Not required at launch. Bring when ready.

Skip in the initial handoff: `LANGUAGE_BIBLE.md`, `CHARACTER_STYLE_GUIDE.md`, `BANTER_BIBLE.md` unless Reggie/Marc appear on the IQ tab.

---

## Section 12 — Hard boundaries (the same ones we've enforced across this session)

- No changes to Foundation 1A / 1B / 1C, Atlas, Special Teams, Team Navi during port.
- No fabricated Market data. No fabricated Sportlogiq analytics.
- No duplicate Ticker, no duplicate game/team/player identities — Main Ticker's canonical layer wins.
- No new nav; the IQ tab lives inside Main Ticker's existing bottom-nav grammar.
- Prediction ≠ Wager separation preserved by schema.
- Age/jurisdiction gating is modular. It does not gate the general Hockey IQ experience.

---

**End of dossier. Everything in `/app/memory/` + this file is enough to plug an IQ tab into any Ticker shell.**
