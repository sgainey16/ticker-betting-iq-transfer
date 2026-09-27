# IQ FORK — FULL ECOSYSTEM INVENTORY

**Scope.** Read-only compilation and mapping. Everything in this fork that could feed the future unified Ticker intelligence engine — completed, dormant, partial, or placeholder. **Nothing was edited or merged.**
**Companion doc.** `IQ_TAB_HANDOFF_DOSSIER.md` covers the launcher-MVP recipe. This doc covers the *whole fork*.
**How to read this.** Every claim is tied to a real file. Status tags: ✅ *shipping* · 🟡 *partial/scaffolded* · 🧊 *dormant/spec-only* · 🟣 *placeholder/legacy*.

---

## Section 1 — Fantasy IQ

**Route.** `/fantasy` → `frontend/src/pages/Fantasy.jsx` (790 lines) ✅

**Ships today:**
- **Affiliate roster panel** — DraftKings (DFS/salary), Sleeper (season-long/dynasty), Yahoo (H2H), ESPN (classic/points). Manual roster import UI for Sleeper.
- **Scoring options** — Points, Head-to-Head, Roto, Custom (config, no engine).
- **Manual roster tracking** — read/write to `db.rosters` (see server.py:1436). Per-team, favourite-teams array.
- **Reggie Assistant** embedded — user can ask fantasy questions and Reggie can propose actions (set favourites, load roster) via `/assistant/reggie/action`.

**Backend surface (`server.py`):**
- `POST /subscription/activate` — persists subscription tier for a device_id + question quota (legacy pattern reused for fantasy trials).
- `POST /subscription/increment-question` — tracks Reggie-assistant question usage.
- `GET /subscription/roster` — reads the user's stored fantasy roster.
- `GET /subscription/state` — returns tier + roster + favourites + notes.
- `Roster` model (`server.py:1436`) — `{ device_id, favorite_teams, roster, notes }`.

**Design corpus (memory docs):**
- `memory/MOAT_ROADMAP.md` — Section 1 Back-Office / Coach-for-the-User Analytics Layer references fantasy calls, start/sit intelligence, weakness detection ("strongest on shots-on-goal props, weakest on totals").
- `memory/ANALYTICS_SPEC.md` — Section on player-prop engine explicitly designed to feed fantasy alongside props (same numeric backbone).

**Dormant / not built:**
- 🧊 **Real projections engine** — no per-player fantasy projections exist. `Fantasy.jsx` shows UI shell; the "Coach for the User" logic lives in insights/reputation, not in a fantasy projector.
- 🧊 **Start/sit recommender** — designed in `MOAT_ROADMAP.md` but no code.
- 🧊 **Injury/availability wiring** — no injury feed connected. `SignalSource` (`iq_core.py:186`) declares `injury_report` as a signal kind but nothing writes it.
- 🧊 **Yahoo/ESPN OAuth import** — UI placeholder only.
- 🧊 **DFS salary-cap optimizer** — not present.

**Call kind that exists but is unused today:** `fantasy_lineup` (in `_VALID_CALL_KINDS`, `server.py:2038`). The pipeline is ready to accept fantasy calls into `iq_calls` → `iq_events` → `iq_resolutions` — no UI writes them yet.

**Fantasy IQ reputation dimension** (`compute_reputation`, `iq_core.py:693`) — already declared, ready to compute once `fantasy_lineup` calls exist.

---

## Section 2 — User Intelligence / Tracking

**Backend core.** `backend/iq_core.py` (849 lines) — the whole personal-tracking engine.

**Data captured per call:**
- `UserCall` (`iq_core.py:112`) — kind, subject, stance, first_instinct, state, visibility, confidence, published_at, locked_at, resolved_at, `context_snapshot_ref` (Foundation 1A snapshot at lock time), `wager_id`.
- `CallEvent` — the append-only event log. **12 event kinds** including `draft_created`, `instinct_captured`, `reasoning_added`, `signal_consumed`, `revision`, `confidence_set`, `locked`, `wager_attached`, `resolution_delivered`, `abandoned`, `voided`, `reflection`.
- `first_instinct` block — records the user's *first tap* before any revision. Preserves gut-vs-head signal.

**Insights engine (`backend/iq_insights.py`, 570 lines):** ✅

7 distinct insight functions, each with a marc_voice + reggie_voice narration:

| Insight | What it measures | Min sample |
|---|---|---|
| `insight_kind_strength` | best/worst call kind (game_pick vs prop_pick vs pick10_entry) | 10 |
| `insight_first_instinct` | do you overwrite good gut picks? | 20 |
| `insight_confidence_calibration` | high-confidence accuracy vs actual outcome | 20 |
| `insight_team_bias` | over-picking specific teams beyond your accuracy on them | 20 |
| `insight_recent_vs_lifetime` | short-term hot/cold vs lifetime baseline | 10 |
| `insight_frequency_shift` | volume changes (playing more/less than usual) | 20 |
| `insight_specialist_category` | are you a specialist in a specific market? | 10 |

**Reputation engine (`compute_reputation`, `iq_core.py:693`):** ✅

Five dimensions, kept **explicitly separate**:
- `hockey_iq` — general prediction accuracy (game/prop/series/pick10)
- `betting_iq` — subset with wager attached
- `fantasy_iq` — `fantasy_lineup` calls
- `accuracy_overall` — raw record across everything
- `community_cred` — public-visibility calls that resolved correct

Each carries `n`, `correct`, `ungradeable`, `accuracy_pct`, `qualified` (≥10 sample).

**"Reggie brief" (`build_reggie_brief`, `iq_core.py:621`):** ✅ — packages per-user state into a single object Reggie/Marc use as context.

**Endpoints:** `/iq/user`, `/iq/user/brief`, `/iq/user/insights`, `/iq/user/{user_id}/calls`, `/iq/reputation`, `/iq/leaderboard`.

**Followed teams/players (`UserPrefs`, `iq_core.py:74`):** ✅
`followed_teams: list[str]`, `followed_players: list[str]` — plumbing present. Reggie brief reads them. **No UI writes them yet** (compare to legacy `Roster.favorite_teams` in `server.py:1436` — a parallel path that DOES have UI). Reconciliation flag: two identity sources.

**Team-specific + player-specific accuracy:**
- 🟡 *Derivable now.* `iq_calls` carries `subject.game_id`, `subject.home`, `subject.away`, `subject.player_id`. A `groupBy` on those fields joined to `iq_resolutions` produces per-team / per-player accuracy in ~30 lines. No schema change. Not exposed as an endpoint yet.
- 🧊 The **"personal scouting report"** concept — `memory/MOAT_ROADMAP.md` §1 explicitly calls it out ("Coach for the User Analytics Layer").

**Personalization models:** none machine-trained. Insights use rule-based thresholds today. `culture_layer_status: raw` on `CommunityPost` (`iq_core.py:673`) is the marker that Phase 2 will feed structured user language into future personalisation.

**The explicit distinction the user asked to preserve** — *what the user likes* vs *what the user predicts* vs *what the user is good at predicting*:
- **Likes** = `followed_teams` / `followed_players` (`UserPrefs`) + `favorite_teams` (`Roster`) — dormant, plumbing only.
- **Predicts** = `iq_calls` (kind + subject + volume).
- **Good at predicting** = `iq_calls` × `iq_resolutions` (correct / n by category / team / player).

**Three different arrays. Never collapsed.** Code respects the distinction; UI hasn't surfaced it yet.

---

## Section 3 — Community Intelligence

**Backend endpoints (`server.py`):** ✅

- `GET /iq/community/public-calls` — the public-visibility calls feed (`server.py:2535`).
- `POST /iq/community/post` — write a discussion/observation/question/call_share (`server.py:2582`).
- `GET /iq/community/posts` — thread-aware list with `parent_post_id` filter (`server.py:2609`).
- `GET /iq/community/specialists?dimension=&limit=` — qualified specialists per reputation dimension (`server.py:2740`).
- `GET /iq/community/specialist-consensus?subject_game_id=&dimension=` — what qualified specialists lean on THIS game (`server.py:2392`).
- `GET /iq/community/feed-enriched` — feed + reputation joined (`server.py:2682`).

**Public calls feed shape (`public_call_feed_item`, `iq_core.py:823`):** publishes the full journey (first_instinct + reasoning_tags + confidence + locked_at + resolved_at + outcome). Never leaks wager info. Anonymises for `anonymous_aggregate` visibility.

**Consensus / disagreement:**
- ✅ *Community %* — real, on `/predictions/games`, from `db.predictions` aggregate.
- ✅ *Specialist consensus* — filter public calls to authors qualified in a specific reputation dimension. Effectively "what the accurate community thinks vs what the crowd thinks."
- 🧊 *Crowd vs Market vs Ticker disagreement* — designed in `BETTING_IQ_TICKER_CONVERGENCE_AUDIT.md` Section 3.1 (the Read Triangle). Community leg is real. Market leg is LOCKED until an odds provider is wired.

**Verified users / experts:**
- 🟡 The `qualified` flag on each reputation dimension is the machine-verified "specialist" primitive. No manual "verified analyst" badge exists.

**Team-specific communities:** not built. Foundation for it is `CommunityPost.target.team_ref` (`iq_core.py:682`) — free-form dict slot that could carry team_id.

**Crowd accuracy over time:** 🟡 Derivable — group `db.predictions` by team + join to `iq_game_finals`. Not exposed.

---

## Section 4 — Forums / Discussion / Community Conversation

**Existing forum primitives (all in this fork):**

| Primitive | Where | Status |
|---|---|---|
| `CommunityPost` model | `iq_core.py:676` | ✅ ships |
| `PostKind` | `iq_core.py:656`: `discussion` · `observation` · `question` · `call_share` | ✅ ships |
| `CultureMeta` (language marker, team refs, player refs, region, culture_layer_status) | `iq_core.py:664` | ✅ captured on write, not yet consumed |
| `parent_post_id` — threading capability | `CommunityPost.parent_post_id` | ✅ ships (replies work) |
| Author display (nickname / anonymous flag) | `server.py:2620-2625` | ✅ ships — never leaks user_id in feed payload |
| `db.iq_posts` collection | live | ✅ |
| `_VALID_POST_KINDS` guard | `server.py` | ✅ 400 on unknown kinds |
| `call_share` verification — post must reference a publicly-locked call owned by the poster | `server.py:2585-2594` | ✅ |
| Post length limit — 4000 chars | `CommunityPost.body` | ✅ |
| List filter — parent thread OR top-level only | `server.py:2609-2626` | ✅ |
| Frontend surface | `HockeyIQ.jsx` `CommunityTab` | 🟡 tab renders, feature-thin |
| `/topics` endpoint | `server.py` (see endpoint index) | 🟣 legacy discovery, not wired to forums |
| Age-gated adult discussion areas | not built | 🧊 |

**Deliberately missing (dormant / not built):**

- 🧊 **Categories / channels / topics** as first-class entities — `target` is a free-form dict; there's no `Channel` or `Topic` schema.
- 🧊 **Team forums / league forums / game threads** — `target.team_ref` and `target.game_id` are the hooks, no UI segments them yet.
- 🧊 **Live game threads / pregame threads / postgame discussion** — no live-thread lifecycle.
- 🧊 **Likes / reactions** — no `Reaction` model, no like counter.
- 🧊 **Follows / subscriptions** — `UserPrefs.followed_teams` + `followed_players` exist but nothing subscribes to *posts* or *users*.
- 🧊 **Notifications** — nothing.
- 🧊 **Moderation** — no `report_reason`, no `blocked_users` array, no shadow-ban, no `moderation_status` flag, no admin queue. Zero references to "moderat" or "abuse" in the community code path.
- 🧊 **Reporting / blocking user-side** — nothing.
- 🧊 **Verified contributor / analyst badges** — the reputation `qualified` flag is the machine substitute; no human-curated badge system.
- 🧊 **Contribution history / status** — not surfaced. Derivable from `db.iq_posts.find({user_id})`.
- 🧊 **Anonymous vs device-based identity issues** — `anonymous_aggregate` visibility exists at the call level but the community *identity plumbing* has an unresolved question: users are keyed by `device_id` today, which means multi-device is broken and identity persistence is fragile.

**Game-specific community intelligence (dormant surface):**
- 🧊 *"What fans are saying"* — designable from `iq_posts.target.game_id` + `iq_calls.subject.game_id` on today's slate.
- 🧊 *Live game threads* — no lifecycle.
- 🧊 *Postgame discussion* — same primitive as `discussion` posts, no post-resolution beat.
- ✅ *Prediction consensus* on a game — real, from `/predictions/games`.

**Community as future signal — DOCUMENTED, NOT BUILT:**
- ✅ *Percentage picking each team* — real, on `/predictions/games`.
- ✅ *Confidence distribution* — derivable from `iq_calls` public calls (confidence_1_10 stance field).
- 🧊 *Opinion changes over time* — derivable from `iq_events` `revision` kind, not surfaced.
- ✅ *Highly-accurate users disagreeing with the crowd* — this IS the "specialist_consensus" endpoint at `server.py:2392`. Ships today. Currently qualified specialists per dimension.
- 🟡 *Team-specialist users* — reputation is per-dimension globally; team-specific reputation is a natural extension (same math on `.subject.home/away`).
- 🧊 *Community sentiment changes* — no NLP on post text. `CultureMeta.culture_layer_status: raw` is the future hook.

**Design corpus:**
- `memory/COMMUNITY_EDGE_SPEC.md` (263 lines) — full Community Edge™ spec: "Follow this predictor for Bruins games. Don't follow them for player props." Deferred post-MVP.
- `memory/COMMENTARY_ENGINE_SPEC.md` (123 lines) — commentary-generation engine.
- `memory/HEY_REGGIE_SPEC.md` (169 lines) — voice-assistant + audio cache overlay for community/forum content.

---

## Section 5 — Accuracy

**Overall + category accuracy:**
- `accuracy_summary(calls, resolutions_by_call)` (`iq_core.py:409`) ✅ — returns `total_calls`, `total_resolved`, `correct`, `accuracy_pct`, `by_call_kind` breakout.
- Endpoint: `/iq/user/brief` (calls `accuracy_summary` inside `build_reggie_brief`).

**Team accuracy / player-market accuracy:** 🟡 derivable now, not exposed. `subject.home/away/player_id` on every call.

**Historical accuracy:**
- ✅ Every call is immutable + append-only. Full history reproducible at any `as_of_iso`.
- ✅ `iq_events` timeline preserves the whole decision journey.

**Streaks:**
- ✅ Streak counter in `/predictions/leaderboard` (`server.py:1328-1361`) — 5-game hot/cold + streak break detection.
- 🟡 Personal streak on `iq_calls` — same math, not surfaced per-user yet.

**Grading:**
- ✅ `Resolution` model (`iq_core.py`) — `outcome_status ∈ {correct, incorrect, ungradeable, voided}`, `correct: bool | None`, `grading_rule`, `grading_version`, `source`, `raw_evidence`.
- ✅ **Ungradeable ≠ incorrect** — data-quality holes never count against user accuracy.

**Confidence / calibration:**
- ✅ Confidence captured via `confidence_set` event, min sample 20 for calibration.
- ✅ `insight_confidence_calibration` (`iq_insights.py:172`) — flags mis-calibration when high-confidence bucket underperforms.
- 🧊 **Reliability curve** — not drawn. Math is available.

**Existing Accuracy wheel / comparison concepts:**
- 🧊 The "wheel" concept isn't materialised in code. `MOAT_ROADMAP.md` §1 references category-Accuracy views. `HOCKEY_IQ_V2_SURFACE_DESIGN_MAP.md` Section 7 sketches Results / Personal Learning with sample-gated cells (Last Night → Recent → By Category → Strengths → Calibration → Prediction-vs-Bet drift).

---

## Section 6 — Market / Betting IQ

**Legacy bet log (`db.bet_log`, `server.py:1676-1964`):** 🟣 shipping legacy path

- `Bet` model (`server.py:166-185`) — `bet_type ∈ {moneyline, spread, total, prop, first-goal, shots, saves, other}`, `stake`, `odds_text`, `units`, `book`, `side`, `notes`, `bet_date`.
- Endpoints: `POST/GET/DELETE /betting/bet`, `GET /betting/bets`, `GET /betting/stats`, `POST /betting/import/preview`, `POST /betting/import/commit`, `POST /betting/spot-check`, `POST /betting/seed-test-bettor`.
- CSV import → `backend/bet_csv_parser.py`.
- Coach analysis → `backend/betting_coach.py` (spot_check pipeline).
- UI → `BackOffice.jsx` (1927 lines, adult-gated).

**New wager path (`db.iq_wagers`, `server.py:2295`):** ✅ shipping

- `Wager` model (`iq_core.py:214`) — `stake`, `units`, `book`, `price_taken`, `price_type`, `odds_text`, `call_id`, `user_id`.
- `POST /iq/call/{call_id}/wager` — attaches a wager to an already-locked call. Requires adult attestation.
- `wager_attached` event kind — records into `iq_events`.

**Bet history / ROI / win rate / units:**
- ✅ `GET /betting/stats` (`server.py`) — aggregates by book, bet_type, home/away, fav/dog. Rolling win rate + units on `db.bet_log`.
- 🟡 The **new** path (`iq_wagers`) doesn't yet have its own aggregate endpoint. Same math, not built.

**Favourites / dogs, puck line / moneyline / totals:** ✅ shipping — `betting_coach.spot_check`.

**Market movement / closing-line concepts:** 🧊 not built. Requires odds provider (see below). `Wager.price_taken` + `price_type` fields are the hooks.

**Ticker vs market / community vs market / user vs market:**
- 🧊 The Read Triangle (`ReadTriangle` in `frontend/src/components/iq/v2/BettingIQOverlays.jsx`) explicitly renders the MARKET leg as LOCKED with the reason string "Odds provider not connected."
- Fabrication is impossible today (no market provider wired).

**Related endpoints for pipeline import:**
- `POST /betting/seed-test-bettor` — seeds a demo user with realistic bet history for testers.
- `POST /betting/spot-check` — runs the coach analysis on demand.

**Design corpus:**
- `memory/BETTING_IQ_SPEC.md` (331 lines) — Build spec, Status: DEFERRED post-MVP.
- `memory/BETTING_IQ_AUDIT.md` (411 lines).
- `memory/BETTING_IQ_INPUT_AUDIT.md` (211 lines) — how to get 30–100 real historical bets from remote testers without painful UX.
- `memory/BETTING_IQ_CONSOLIDATED_ARCHITECTURE.md` (517 lines) — the L.1–L.9 consolidated architecture.
- `memory/SPOT_CHECK_LOGIC_AUDIT.md` (301 lines), `memory/SPOT_CHECK_V2_REPORT.md` (227 lines).

---

## Section 7 — Tonight / Game Intelligence

**Nightly matchup experience:** ✅

- `/tonight/:gameId` → `TonightGame.jsx` — wraps `GameHub`.
- `/iq/game/:gameId` → `TickerProGame.jsx` — the convergence proof; GameHub + Read Triangle + MyCallState + Intelligence Rail.
- `/predictions/games` — real slate + Ticker Model % + community %.
- `GameHub` component — matchup identity, R+M pregame audio, head-to-head stats, panel picks.

**Signals / edges / WHY? / LEARN:**
- ✅ `Signal` model (`iq_core.py:200`) + `SignalSource` (`iq_core.py:186`): `market_line` · `ticker_model` · `community_consensus` · `specialist_pick` · `forum_observation` · `injury_report` · `goalie_confirmed` · `schedule_context`.
- ✅ `signal_consumed` event kind — records which signals the user saw before locking (correlation input for future model).
- ✅ `FactTier` (`iq_core.py:197`): `verified` · `reported` · `rumor`. Never mixed in UI.

**Verified-signal concepts:** 🟡 model exists; UI only surfaces community + Ticker Model today. Market signal is locked.

**Ticker interpretation / pregame intelligence:**
- ✅ `backend/pregame_show.py` — pregame narrative generator (Reggie/Marc + stat_line for chyron).
- ✅ `backend/analysts.py` — hand-authored panel picks + `ai_consensus` per game (editorial pre-model, honestly labelled).
- ✅ `backend/game_story.py` — game narrative writer.
- ✅ `backend/recap_show.py` — recap generator.

**Game-specific prediction concepts:**
- ✅ Ships: `game_pick`, `prop_pick`, `pick10_entry`, `series_pick`.
- 🧊 Templates registered but not yet UI-populated: `team_scores_first`, `saves_higher`, `shots_higher`, `game_reaches_ot`, `total_goals_over_5_5`.

---

## Section 8 — Player / Team Intelligence

**Team IQ / Player IQ (surfaces):**
- `/team/:code` → `TeamStatPage.jsx` ✅
- `/plus/team/:code` → `plus/TeamPage.jsx` ✅
- `/player/:playerId` → `PlayerDetail.jsx` ✅
- `/player-profile/:slug` → `PlayerProfile.jsx` ✅
- `/lineup/:team` → `Lineup.jsx` ✅
- Convergence audit position: these become Main Ticker parent surfaces + IQ overlay slots (`TeamIQOverlay`, `PlayerIQOverlay`) once V2 kit lands.

**Form / trend concepts:**
- ✅ **Rolling-form intelligence layer** — `backend/intelligence/rolling_form.py` (built 2026-02-14). SEASON / L10 / L5 / L2 / L1 with confidence tiers, direction vs season baseline, acceleration (L5 vs L10). Team + goalie. Internal endpoints `/iq/intel/team-rolling-form`, `/iq/intel/goalie-rolling-form`. Not user-facing.
- ✅ Foundation 1B — `iq_game_finals` immutable per-game history, `recent_history_views` Last-N + season baseline projections.
- ✅ Foundation 1A — canonical identity + `GameContextSnapshot` pregame freeze.

**Player matchup analysis / goalie analysis / usage/deployment:**
- ✅ `goalie_rolling_form` — Save% + GAA + record windows per goalie.
- 🟡 `GoalieLine` on `iq_game_finals` — starter flag, decision, TOI, saves, shots-against, GA. Available now.
- 🧊 Line-combo / usage analytics — `Lineup.jsx` renders lines, no analytics behind them.
- 🧊 Deployment metrics (zone starts, situational TOI, matchup shifts) — REQUIRES SPORTLOGIQ. Not fabricated.

**Special Teams:**
- 🧊 `memory/SPECIAL_TEAMS_IQ_FEASIBILITY.md` (498 lines).
- 🧊 `memory/SPECIAL_TEAMS_IQ_PROVIDER_MATRIX.md` (396 lines).
- 🧊 `memory/SPECIAL_TEAMS_IQ_STEP3_BASELINE_PLAN.md` (433 lines) — S4.1-S4.8 free NHL PBP baseline plan. Not yet implemented.
- PP%/PK% — reserved on `TeamGameFacts` (models_1b.py:114-117), null until SportsData-tier/Sportradar populates.

**Recent performance / historical comparisons:**
- ✅ Rolling-form module (see above).
- ✅ Foundation 1B history + as-of temporal integrity.

**Deep intelligence lens registry:** `frontend/src/components/iq/v2/BettingIQOverlays.jsx` `INTELLIGENCE_LENS_REGISTRY` — 9 lenses: `overview` (available), `offense` / `defense` (derivable_low_fidelity), `transition` / `puck-management` / `possession` / `net-front` (requires_sportlogiq), `special-teams` (derivable_pending_baseline), `goaltending` / `discipline` (available_basic). **Only `overview` renders today.**

**Design corpus:**
- `memory/ANALYTICS_SPEC.md` (223 lines) — Phase 1 Analytics Engine spec, three-layer data architecture.
- `memory/FOUNDATION_1C_ARCHITECTURE.md` (976 lines) — pregame hockey context deep spec.

---

## Section 9 — Learning / Education

**WHY? / LEARN / Reggie-Marc interpretation:**
- ✅ `insight_*` functions (`iq_insights.py`) — every insight ships `reggie_voice` + `marc_voice` narration for the user. This is the **existing "coach for the user"** mechanism.
- ✅ `Signal` model captures what the user saw before locking → future correlations become teaching moments.
- ✅ `Suggested questions` endpoint (`/suggested-questions`) — Reggie-provided next-question prompts.
- ✅ `banter` endpoint (`/banter`, `/banter/quick-reply`) — conversational depth engine.
- ✅ `assistant/reggie/chat` — full chat brain with `assistant_conversations` collection.
- ✅ `assistant/history`, `assistant/state`, `assistant/reggie/action` — action-oriented assistant.

**Educational stat explanations / teaching moments:**
- ✅ `reasoning_tags` on `stance` — free-form user-attached "why" tags. Enables retrospective teaching ("you tagged 'goaltending' 12 times, and you're 68% on those calls — that's your strong lane.")
- 🟡 `WHAT → WHY → SHOW ME` — designed in the convergence audit Section 3.4 (custom analytical reels). Only WHAT is real today. WHY requires provenance drill-through UI (not built). SHOW ME requires Main Ticker's Highlights/Reels machinery (dispatch target, not a second engine).

**User learning / progression concepts:**
- ✅ Reputation `qualified` flag = the first "level up" concept (crossing 10 samples per dimension).
- 🧊 Badges / levels / progression bars — not built.
- 🧊 Explicit "did you learn this?" tracking — not built.

**Design corpus:**
- `memory/GLOSSARY.md` (149 lines) — shared vocabulary between user and agent.
- `memory/product_bible.md` (253 lines).
- `memory/CADENCE_AND_PERFORMANCE.md` (535 lines) — prosody/timing/emotion manual.
- `memory/LANGUAGE_BIBLE.md` (464 lines, PARTIAL at 5-E).
- `memory/BANTER_BIBLE.md` (690 lines).
- `memory/CHARACTER_STYLE_GUIDE.md` (447 lines).
- `memory/COMMENTARY_ENGINE_SPEC.md` (123 lines).

---

## Section 10 — Personalization / My IQ

**Shipping surfaces:**
- `frontend/src/components/iq/v2/MyIQCommandCenter.jsx` — Reggie+Marc banter (state-aware), Tonight's 10 hero, Last Night pips, Your IQ Is Building empty state, My Bets link, Go Deeper concept card.
- `frontend/src/components/iq/v2/TonightsTenLoop.jsx` — SEE → TAP → LOCK → NEXT fast loop.
- `frontend/src/components/iq/v2/LastNight.jsx` — result strip.

**Personal scouting-report concepts:**
- ✅ `iq_user_insights` (via `iq_insights.py`) — strongest/weakest category, first-instinct pattern, calibration, team bias, recent vs lifetime, frequency shift, specialist category. **Real, ships, returns marc_voice + reggie_voice.**

**Personal trends:**
- ✅ `insight_recent_vs_lifetime` — hot streaks + cold streaks vs lifetime baseline.
- 🟡 Per-team / per-player accuracy trends — derivable, not exposed.

**Tailored insights:**
- ✅ Reggie brief consumes user prefs (followed_teams, followed_players) + accuracy summary — LLM prompts adapt per user.

**Recommendations:**
- 🧊 No recommendation engine. `MOAT_ROADMAP.md` describes it.

**Notification concepts:**
- 🧊 Nothing. Not even a schema slot.

**Design corpus:**
- `memory/HOCKEY_IQ_V2_SURFACE_DESIGN_MAP.md` (260 lines) — 9 surfaces mapped.
- `memory/MOAT_ROADMAP.md` (80 lines) — the "Coach for the User" section.

---

## Section 11 — Identity / Age / Safety Architecture

**Identity:**
- ✅ `iq_users` collection keyed by `device_id` (`_ensure_user_by_device`, `server.py`).
- ✅ `UserPrefs` (`iq_core.py:72`): `default_visibility`, `followed_teams`, `followed_players`.
- ✅ `Eligibility` block (`iq_core.py:65`): `adult_features_unlocked`, `attestation: Attestation`.
- 🟣 **Two identity paths coexist:** `db.iq_users` (new IQ path, device-keyed) vs `db.rosters` (legacy fantasy path, device-keyed, `favorite_teams`, `roster`, `notes`). Not reconciled.
- 🟣 **`user_name`** — used by legacy `/predictions` endpoints (`user_name` string, no auth). This is a *third* identity path.
- 🧊 **Planned unified identity** — no design doc yet. Reconciliation is a known open question.

**Age gate / adult-only surfaces:**
- ✅ `Attestation` model (`iq_core.py:45`) — `attested_at`, `jurisdiction`, `method: self_attestation_v1`, `policy_version_accepted: adult-unlock-policy-v1`. **Never stores DOB.**
- ✅ `POST /iq/user/attest-adult` (`server.py:2089`).
- ✅ `wager_attached` event + `POST /iq/call/{call_id}/wager` require `eligibility.adult_features_unlocked=true` (403 otherwise).
- ✅ Legacy `BackOffice.jsx` (bet log) enforces adult attestation at the page level.
- ✅ Age/jurisdiction gate is **modular** — never gates the general Hockey IQ experience per the convergence audit direction. Only regulated wager-recording features.

**Device_id / account identity issues:**
- 🟣 Multi-device is currently broken (each device = new `iq_users` row).
- 🧊 Account linking / merge — not built.

**Design corpus:**
- `memory/LEGAL_TODO.md` (73 lines) — pre-launch legal cleanup checklist.

---

## Section 12 — Data / Signal Foundation (the shared brain)

**Foundation 1A — Canonical Identity** ✅ DEPLOYED
- `backend/intelligence/models_1a.py` — `TickerTeam`, `TickerPlayer`, `TickerGame`, `ProviderIds*`, `GameContextSnapshot`.
- `backend/intelligence/identity.py`, `resolver_teams.py`, `resolver_games.py`, `snapshotter.py`, `activate.py`, `repair_collided_canonicals.py`.
- `iq_teams`, `iq_players`, `iq_games`, `iq_game_context_snapshots` collections.

**Foundation 1B — Immutable Recent History** ✅ DEPLOYED
- `backend/intelligence/models_1b.py` — `FinalScore`, `TeamGameFacts`, `GoalieLine`, `GameFinal`.
- `backend/intelligence/game_finals_writer.py`, `ingest_1b.py`, `backfill_1b.py`, `recent_history_views.py`, `indexes_1b.py`.
- 32 teams, 222 unique games backfilled. 23/23 tests green.

**Foundation 1C — Pregame Hockey Context** 🧊 ARCHITECTURE APPROVED, NOT IMPLEMENTED
- `memory/FOUNDATION_1C_ARCHITECTURE.md` (976 lines).
- `memory/FOUNDATION_1C_VERIFICATION_ADDENDUM.md` (589 lines).

**Foundation 2 — Prediction Memory / Signal Attachments** 🧊
- `memory/PHASE_0_DATA_ARCHITECTURE.md` (419 lines) + `PHASE_0_RATIFIED.md` (215 lines).

**Rolling form** ✅ BUILT (Section 8).

**Core intelligence primitives already reusable across every IQ section:**

| Primitive | Purpose | Used by |
|---|---|---|
| `Signal` | Any external input the user saw | Predictions, Community feed, Reggie brief, future personalisation |
| `UserCall` | Every decision object | Predictions, Betting IQ, Fantasy, Community, Accuracy, Learning |
| `CallEvent` | Append-only journey log | Everything — this is the truth |
| `Resolution` | Grading output + provenance | Accuracy, Reputation, Insights, Recap IQ segment |
| `Wager` | Optional financial layer | Betting IQ only |
| `CommunityPost` | Discussion / observation / question / call_share | Community, Forums, culture layer |
| `GameContextSnapshot` | Pregame freeze | As-of integrity across everything |
| `GameFinal` | Immutable outcome record | Grading, Recap, Rolling form |
| Reputation dimensions | Derived per-user credibility | Community, Leaderboards, Specialist consensus |
| `iq_boards` | Daily 10-question board | Tonight's 10 fast loop |

**Every one of these can be consumed by every other IQ section** — the schema is designed for it.

**Providers wired today (`backend/*_client.py`, env):**
- NHL Public API ✅
- SportsData.io ✅
- Sportradar NHL v7 ⚠ (403s — trial expired)
- Highlightly ✅
- ElevenLabs ✅
- Emergent LLM key ✅
- Imagn ✅

**Providers required, NOT wired:**
- Real bookmaker odds (Market leg of Read Triangle).
- Sportlogiq (Transition / Puck Management / Possession / Net Front / xG lenses).
- Yahoo / ESPN OAuth (fantasy real-import).

---

## Section 13 — Frontend / Product Bibles (design corpus)

**49 memory docs · 15,255 total lines.** Sorted by size (relevant subset):

| Doc | Lines | What it covers |
|---|---|---|
| `THE_TICKER_HANDOFF_PACKAGE.md` | 1484 | Master handoff |
| `FOUNDATION_1C_ARCHITECTURE.md` | 976 | Pregame hockey context |
| `FOUNDATION_AUDIT_CURRENT.md` | 944 | Foundation audit |
| `BANTER_BIBLE.md` | 690 | Reggie×Marc pair chemistry |
| `FOUNDATION_1C_VERIFICATION_ADDENDUM.md` | 589 | 1C verification |
| `CADENCE_AND_PERFORMANCE.md` | 535 | Prosody/timing manual |
| `BETTING_IQ_CONSOLIDATED_ARCHITECTURE.md` | 517 | L.1-L.9 architecture |
| `SPECIAL_TEAMS_IQ_FEASIBILITY.md` | 498 | Special teams engine feasibility |
| `LANGUAGE_BIBLE.md` | 464 | Comedy/chirp rules (PARTIAL at 5-E) |
| `BETTING_IQ_TICKER_CONVERGENCE_AUDIT.md` | 452 | Convergence direction |
| `CHARACTER_STYLE_GUIDE.md` | 447 | Visual identity + generation prompts |
| `SPECIAL_TEAMS_IQ_STEP3_BASELINE_PLAN.md` | 433 | Free PBP baseline S4.1-S4.8 |
| `TICKER_HOCKEY_IQ_AUDIT.md` | 424 | Landscape audit + IA recommendation |
| `PHASE_0_DATA_ARCHITECTURE.md` | 419 | Two-axis state model amendment |
| `BETTING_IQ_AUDIT.md` | 411 | Betting IQ audit |
| `SPECIAL_TEAMS_IQ_PROVIDER_MATRIX.md` | 396 | Provider tier matrix |
| `IQ_TAB_HANDOFF_DOSSIER.md` | 374 | Launcher-MVP recipe |
| `BETTING_IQ_SPEC.md` | 331 | Betting IQ build spec |
| `SPOT_CHECK_LOGIC_AUDIT.md` | 301 | Spot check logic |
| `COMMUNITY_EDGE_SPEC.md` | 263 | Community Edge™ spec |
| `HOCKEY_IQ_V2_SURFACE_DESIGN_MAP.md` | 260 | 9-surface V2 map |
| `product_bible.md` | 253 | Global tone bible |
| `FOUNDATION_1B_BUILD_EVIDENCE.md` | 245 | 1B evidence |
| `SPOT_CHECK_V2_REPORT.md` | 227 | Spot check v2 report |
| `ANALYTICS_SPEC.md` | 223 | Phase 1 analytics engine |
| `CHARACTER_SYSTEM_AUDIT.md` | 213 | Reggie/Marc canonical audit |
| `BETTING_IQ_INPUT_AUDIT.md` | 211 | Real bet import UX |
| `HEY_REGGIE_SPEC.md` | 169 | Voice assistant + audio cache |
| `HIGHLIGHTS_RECAP_SPEC.md` | 167 | Highlightly integration spec |
| `bible_notes_v0.md` | 158 | Alias/history reconciliation |
| `GLOSSARY.md` | 149 | Shared vocabulary |
| `README_FOR_NEXT_FORK.md` | 132 | Handoff index |
| `COMMENTARY_ENGINE_SPEC.md` | 123 | Commentary generation |
| `TICKER_PRO_GAME_SURFACE_PROOF.md` | 107 | One-game convergence proof report |
| `ROOTS_SEGMENT_SPEC.md` | 86 | Roots segment |
| `CHECKPOINTS.md` | 81 | Chronological decision log |
| `MOAT_ROADMAP.md` | 80 | Founder/power-user moat |
| `LEGAL_TODO.md` | 73 | Pre-launch legal cleanup |
| `DAILY_PICKS_SPEC.md` | 48 | Daily picks Phase 1 |
| `PICK10_SPEC.md` | 47 | Pick 10 daily prop game |
| `VOICE_AD_SCRIPTS.md` | 39 | Voice ad scripts |

Plus the Foundation 1A/1B evidence docs and PRD.md.

---

## Section 14 — MASTER MAP: "One Unified Ticker Intelligence Engine"

What could power all six domains from the same brain **today** — bold = shipping, italic = derivable now, plain = requires provider or design:

| Consumer | Real inputs available NOW |
|---|---|
| **Predictions engine** | **iq_calls · iq_events · iq_resolutions · rolling_form · Signals · GameContextSnapshot** |
| **Betting IQ** | **iq_calls (wager-attached) · iq_wagers · Resolutions · rolling_form · legacy bet_log** |
| **Fantasy** | **iq_calls (fantasy_lineup kind ready) · Roster** · *derivable per-player accuracy* |
| **User Accuracy / My IQ** | **accuracy_summary · iq_user_insights (7 insight functions) · compute_reputation (5 dimensions)** |
| **Community** | **iq_posts · public_call_feed_item · specialist_consensus · qualified specialists** |
| **Team IQ** | **rolling_form (team) · iq_game_finals · standings** · *derivable per-team accuracy for followers* |
| **Player IQ** | **rolling_form (goalie) · GoalieLine · box stats** · *derivable per-player accuracy* |
| **Reggie / Marc** | **build_reggie_brief · analysts.py system prompts · pregame_show · game_story · recap_show** |
| **NEXT (Main Ticker) recommendations** | *derivable from followed_teams + iq_calls + iq_posts as interest signals* |
| **Premium Hockey IQ** | *rolling_form full trend layer + 9-lens registry + insights + reputation + wager-vs-prediction drift* |

**The unified brain is real. It exists as data + primitives. Only the surfaces are fragmented.**

---

## Section 15 — RECONCILIATION FLAGS

Open items that need decisions before a full merge:

1. **Three identity paths** — `iq_users.device_id`, `Roster.device_id`, `predictions.user_name`. Must converge.
2. **Two follow paths** — `UserPrefs.followed_teams` (new IQ) vs `Roster.favorite_teams` (legacy fantasy).
3. **Two wager paths** — `db.bet_log` (legacy, adult-gated `BackOffice`) vs `db.iq_wagers` (new, attached to `iq_calls`). Legacy is read-only but still shipping.
4. **Marc's surname** — `analysts.py` "Marc Collins" vs `hostImages.js:31` "Marc Doyle".
5. **Foundation 1C** — approved architecture, not built.
6. **Sportradar 403** — trial expired.
7. **`LANGUAGE_BIBLE.md` PARTIAL** at Section 5-E.
8. **The convergence direction** (`BETTING_IQ_TICKER_CONVERGENCE_AUDIT.md`) awaiting the real Main Ticker V2 kit before propagating past `/iq/game/:gameId`.

---

## Section 16 — WHAT TO PACKAGE (verbatim file list)

### 16.1 Backend — the whole brain

```
backend/iq_core.py                                (849 lines — event-sourced engine)
backend/iq_insights.py                            (570 lines — 7 insight functions)
backend/analysts.py                               (Reggie + Marc prompts + editorial seed)
backend/pregame_show.py                           (pregame narrative)
backend/recap_show.py                             (recap narrative)
backend/game_story.py                             (game story writer)
backend/reggie_assistant.py                       (Reggie chat brain)
backend/voice_service.py                          (ElevenLabs runtime)
backend/voice_profiles.json                       (voice archive w/ history)
backend/voice_picker.py                           (10-candidate picker)
backend/design_voices.py                          (4-host voice design briefs)
backend/design_reggie.py                          (Reggie voice design)
backend/bet_csv_parser.py                         (bet CSV import)
backend/betting_coach.py                          (spot check logic)
backend/highlightly_client.py                     (Highlightly wrapper)
backend/nhl_data.py, nhl_pbp.py                   (NHL Public wrappers)
backend/sportradar_client.py                      (⚠ 403 today)
backend/intelligence/                             (WHOLE FOLDER — Foundations 1A + 1B + rolling_form + snapshotter)
backend/tests/                                    (regression suite)
backend/.env                                      (env template only, no secrets)
```

### 16.2 Frontend — IQ surfaces + shared libs

```
frontend/src/pages/HockeyIQ.jsx                   (shell w/ 4 tabs)
frontend/src/pages/TickerProGame.jsx              (convergence proof)
frontend/src/pages/Fantasy.jsx                    (fantasy shell)
frontend/src/pages/BackOffice.jsx                 (legacy bet log — retire when new wager path fully replaces)
frontend/src/components/iq/                       (WHOLE FOLDER — v2 kit + IQCoachChat + IQCoachDock + MakeCallPanel)
frontend/src/components/HostPortrait.jsx
frontend/src/components/TwoHostDesk.jsx
frontend/src/components/LiveDesk.jsx
frontend/src/components/IdleHost.jsx
frontend/src/components/ShowOpener.jsx
frontend/src/components/ReggieAssistant.jsx
frontend/src/components/GameHub.jsx               (reused-unchanged parent for TickerProGame)
frontend/src/components/PickRecordCard.jsx
frontend/src/components/OddsChip.jsx              (visual only — no market wiring)
frontend/src/components/StatCallouts.jsx
frontend/src/lib/teamLogos.jsx, teamColors.js
frontend/src/lib/api.js, device.js
frontend/src/lib/hostImages.js                    (⚠ has "Marc Doyle" — reconcile)
frontend/src/lib/broadcastContext.jsx
frontend/src/lib/jokeBank.js
frontend/public/hosts/reggie/*.png (5 moods)
frontend/public/hosts/marc/*.png (5 moods)
```

### 16.3 Memory / bibles — the whole `/app/memory/` directory

All 49 docs above. `LANGUAGE_BIBLE.md` marked PARTIAL. `README_FOR_NEXT_FORK.md` should be updated to point at this inventory.

### 16.4 Env keys to bring

```
MONGO_URL, DB_NAME
EMERGENT_LLM_KEY
ELEVENLABS_API_KEY, ELEVENLABS_DAILY_CHAR_LIMIT
SPORTSDATA_API_KEY
SPORTRADAR_API_KEY (currently 403), SPORTRADAR_ENABLED, SPORTRADAR_SEASON_TYPE, SPORTRADAR_SEASON_YEAR
HIGHLIGHTLY_API_KEY, HIGHLIGHTLY_BASE_URL, HIGHLIGHTLY_ENABLED
IMAGN_API_KEY
IQ_DEV_MODE
CORS_ORIGINS
```

---

## Section 17 — Hard boundaries

- **Read-only compilation.** Nothing merged. Nothing rewritten.
- **No fabricated Market data. No fabricated Sportlogiq analytics.** Every gap in this inventory is honestly labelled 🧊 / ⚫.
- **The unified brain thesis is a mapping, not an implementation.** Do not build it until the Main Ticker V2 kit lands and the convergence audit's Gate A is signed off.
- **Preserve every 🧊 dormant concept as a design asset.** Some of the richest ideas (Community Edge™, Coach for the User, WHY → SHOW ME reels) are dormant *by choice*.

---

**End of inventory. Every file path verified to exist. No claim above is invented.**
