# TICKER HOCKEY IQ — Landscape Audit + Information-Architecture Recommendation

**Scope:** Audit only. No code changes. Do not disturb frozen Betting IQ / Spot Check v2.
**Purpose:** Map every existing surface, identify what belongs inside Ticker Hockey IQ, propose 2–3 mobile IAs, recommend one, and stress-test the shared-data assumption before we commit ~$2K/mo to premium data.

---

## 1. Current-state component inventory

For each component: current location · file(s) · status · notes.

**Status legend:** ✅ LIVE (works today) · 🟡 PARTIAL (works but incomplete) · 🟠 DORMANT (built, hidden or unshipped) · 🔵 MOCK (stub UI, no engine) · ⚪ MISSING (spec only) · ⚫ OBSOLETE (should be retired).

### 1A · Betting IQ + Spot Check
| Component | Location | Status | Notes |
|---|---|---|---|
| Spot Check v2 engine | `backend/betting_coach.py` (544 lines) | ✅ LIVE (frozen) | ROI-primary trust signal, MIN_N thresholds, LEAN_IN / NEUTRAL / SKIP, deterministic Marc templates |
| Spot Check UI panel | `pages/BackOffice.jsx::SpotCheckPanel` | ✅ LIVE (DEV-gated) | 3 dropdowns → recommendation card + Marc line + evidence tiles |
| Bet Log (manual form) | `pages/BackOffice.jsx::BetForm` | ✅ LIVE (DEV-gated) | P0 fix landed: `home_or_away` + `fav_or_dog` required |
| Bulk CSV importer | `backend/bet_csv_parser.py` + `BulkImportPanel` | ✅ LIVE (DEV-gated) | 8-col schema · preview/commit · append/replace guardrail · 23 unit tests |
| Bet history stats | `POST /api/betting/stats` | ✅ LIVE | ROI, win-rate, P/L, by-type breakdown |
| Seed test bettor | `POST /api/betting/seed-test-bettor` | ✅ LIVE (DEV) | 86-bet fictional bettor for demos |
| Personal Edge | spec `BETTING_IQ_SPEC.md` §2 | ⚪ MISSING | Spec exists — "how you performed in comparable situations" is not yet implemented as its own surface |
| Betting DNA | spec `BETTING_IQ_SPEC.md` §2 | ⚪ MISSING | "Long-term tendencies and biases" as a first-class page — not built |
| Betting Coach (daily) | spec `BETTING_IQ_SPEC.md` §2 | ⚪ MISSING | Daily proactive nudges not built — Spot Check is reactive only |
| Market/odds surface | `components/OddsChip.jsx` | 🔵 MOCK | Deterministic hash-generated odds, not real sportsbook data |

### 1B · Prediction + Accuracy engine
| Component | Location | Status | Notes |
|---|---|---|---|
| Predictions collection + CRUD | `POST /api/predictions`, `GET /api/predictions/{me,mine}` | ✅ LIVE | Persists `{user_name, game_id, pick, reasoning, resolved, correct}` |
| Predictions page ("Call It · Tonight's card") | `pages/Predictions.jsx` (610 lines) | ✅ LIVE | Game-by-game winner picks, scorecard, streaks, accuracy % |
| Leaderboard | `GET /api/predictions/leaderboard` | 🟡 PARTIAL | **Keyed by `user_name` (nickname) — collision bug documented in prior handoff.** Needs re-key to `device_id` |
| Simulate resolve | `POST /api/predictions/simulate-resolve` | 🟡 PARTIAL | Demo-only auto-grader; no real result feed wired in |
| Pick 10 / Tonight's 10 board | spec `PICK10_SPEC.md` | ⚪ MISSING | Full spec exists, no code |
| Accuracy Wheel | referenced in `MOAT_ROADMAP.md` §1 | ⚪ MISSING | Category-level accuracy breakdown not surfaced anywhere |
| Reasoning capture at pick-time | `PredictionCreate.reasoning` field | 🟡 PARTIAL | Field exists in schema but is not required, rarely used in UI |
| Prediction resolution engine | — | ⚪ MISSING | Real grading against final scores/props not implemented |
| Edge Score tab | `pages/BackOffice.jsx::EdgeScoreTab` | 🟠 DORMANT | Stubbed "Reggie's rating of you" — no formula yet |
| Your Picks tab | `pages/BackOffice.jsx::YourPicksTab` | ✅ LIVE | Reads from `/predictions/mine`, shows track record |

### 1C · Fantasy
| Component | Location | Status | Notes |
|---|---|---|---|
| Fantasy roster page | `pages/Fantasy.jsx` (790 lines) | 🟡 PARTIAL | UI works, but the "insights" are **local rule-based mocks** (`HOT_TEAMS = {"EDM","COL",…}`, hardcoded waiver list, hardcoded injury watch) |
| Roster persistence | `POST /api/subscription/roster`, `GET /api/subscription/roster` | ✅ LIVE | Free-text player names + league scoring string — no real Yahoo import, no player IDs |
| Start-sit calls | `Fantasy.jsx::startSitCalls` | 🔵 MOCK | Purely lexical (checks team code against HOT/COLD sets) |
| Waiver wire | `TRENDING_WAIVERS` const | 🔵 MOCK | Hardcoded five-name list, no live availability |
| Injury watch | `INJURY_WATCH` const | 🔵 MOCK | Hardcoded three names |
| League import (Yahoo/ESPN) | — | ⚪ MISSING | Never built |
| Fantasy chat/advice thread | — | ⚪ MISSING | Reggie/Marc do not yet consume the roster in conversation |
| Nav entry | `BackOffice.jsx` TABS | 🟠 DORMANT | Commented-out `// { id: "fantasy", label: "Fantasy Tracker", ...}` — the standalone `/fantasy` route still resolves but has no nav breadcrumb |

### 1D · Community / Forum / Leaderboards
| Component | Location | Status | Notes |
|---|---|---|---|
| Public profile scaffolding | `BackOffice.jsx::SocialTab` | 🟠 DORMANT | Shows "0 / 1000 followers" progress bar — no actual follow relationship model in Mongo |
| Predictions leaderboard | `/predictions/leaderboard` | 🟡 PARTIAL | Overall accuracy only; no per-category, no per-team, no specialists |
| Community Edge™ (verified specialists) | spec `COMMUNITY_EDGE_SPEC.md` | ⚪ MISSING | Full spec exists, no code |
| Forum / threads | — | ⚪ MISSING | Never built |
| Community consensus signal | Community Consensus mechanic in `ANALYTICS_SPEC.md` | ⚪ MISSING | Never built |
| Local observations ("eyes at the rink") | — | ⚪ MISSING | Never built |
| Fact / Reported / Rumor tiers | `MATCHUP_ANALYTICS_SPEC.md` | ⚪ MISSING | Confidence-tier concept documented, no UI |

### 1E · My Ticker / My Hockey identity
| Component | Location | Status | Notes |
|---|---|---|---|
| UserProfile local store | `lib/userProfile.js` (implied by usage in Onboarding/YourTicker) | ✅ LIVE | Nickname, NHL team, CHL/NCAA teams, prospects, language, interests |
| Onboarding wizard | `pages/plus/Onboarding.jsx` | ✅ LIVE | 8-step: welcome → nickname → NHL → language → CHL → NCAA → interests → reveal |
| My Ticker landing (Plus) | `pages/plus/YourTicker.jsx` | ✅ LIVE | Personalized "Your Ticker" hub for youth/junior/college content |
| Followed teams/players persistence | localStorage only | 🟡 PARTIAL | No server-side identity — clears if user switches device/browser |
| Device-ID identity | `lib/device.js` → localStorage `ticker.device_id` | ✅ LIVE | Anonymous ID underpins bet-log, subscription, Spot Check |
| Account/auth | `pages/Login.jsx` | 🟠 DORMANT | Login page exists, real auth flow not wired (no `/auth/*` API routes) |
| Cross-environment identity | — | ⚪ MISSING | No single `User` model that spans Ticker + Plus/Youth + IQ |

### 1F · Advanced Hockey Intelligence + data sources
| Component | Location | Status | Notes |
|---|---|---|---|
| Sportradar client | `backend/sportradar_client.py` | 🟡 PARTIAL | **Trial-tier only**. Feeds standings, schedule, stats. Falls back to `analysts.PLAYERS/TEAMS` mocks. Not a production entitlement |
| Highlightly client | `backend/highlightly_client.py` | ✅ LIVE | PRO tier, working (key refreshed this fork) — highlights, match stats |
| NHL data mocks | `backend/nhl_data.py` (173 lines) | ✅ LIVE | Team/player mock library — the actual data most surfaces read from |
| Matchup Deep Dive | `pages/MatchupDeepDive.jsx` | 🟡 PARTIAL | Rich UI, largely mocked |
| Player detail | `pages/PlayerDetail.jsx` + `PlayerProfile.jsx` | 🟡 PARTIAL | Duplicate pages — pick one during unification |
| Team stat page | `pages/TeamStatPage.jsx` | 🟡 PARTIAL | Uses NHL public API via `nhl_data.py` |
| MatchupInsight card | `components/MatchupInsight.jsx` | ✅ LIVE | The best pattern for "context flowing through surfaces" — reuse this |
| Ticker Intelligence composite score | `ANALYTICS_SPEC.md` | ⚪ MISSING | Never built |
| Anomaly engine | `MOAT_ROADMAP.md` §3 | ⚪ MISSING | Never built |
| Elite Prospects licensing | — | ⚪ MISSING | Deferred per handoff |
| Sportlogiq / advanced tracking | — | ⚪ MISSING | Never scoped |

### 1G · Reggie & Marc conversational layer
| Component | Location | Status | Notes |
|---|---|---|---|
| Reggie assistant chat | `POST /api/assistant/reggie/chat` + `components/ReggieAssistant.jsx` | ✅ LIVE | Fully working, Claude Sonnet 4.5 via Emergent LLM key |
| Assistant state + history | `/assistant/state`, `/assistant/history` | ✅ LIVE | Persisted per device |
| Action proposals | `POST /api/assistant/reggie/action` | ✅ LIVE | Reggie can propose actions user confirms |
| Analyst panel (Marc, Lou, Tank, etc.) | `backend/analysts.py` (773 lines) | ✅ LIVE | Character definitions, style guide, banter templates |
| Voice/TTS pipeline | `voice_service.py`, `voice_picker.py` | ✅ LIVE | ElevenLabs integration |
| Wake-word "Hey Reggie" | `HEY_REGGIE_SPEC.md` + `PreferencesTab` toggle | 🟠 DORMANT | Opt-in toggle in UI, listener not wired |
| Multi-turn context loading (user brief) | `MOAT_ROADMAP.md` §2 "Pre-loaded Context" | ⚪ MISSING | Reggie does not yet consume bet history, prediction record, or roster in its system prompt |
| Cross-IQ conversational routing | — | ⚪ MISSING | Reggie cannot yet answer "what does my Spot Check say about tonight's Bruins moneyline" — the data lives in Mongo, prompt doesn't reach for it |

### 1H · Existing markets / odds
| Component | Location | Status | Notes |
|---|---|---|---|
| OddsChip | `components/OddsChip.jsx` | 🔵 MOCK | Deterministic hash → odds string. Convincing but fabricated |
| Real sportsbook feed | — | ⚪ MISSING | Deferred per user directive |

### 1I · Age gates & Youth protection
| Component | Location | Status | Notes |
|---|---|---|---|
| Onboarding CHL/NCAA path | `plus/Onboarding.jsx` | ✅ LIVE | Youth-first content lives at `/plus/*` routes |
| Betting IQ DEV gate | `BackOffice.jsx` TABS `dev: true` | ✅ LIVE | Betting IQ tab is hidden unless local flag set |
| Age verification / 18+ gate | — | ⚪ MISSING | **Critical gap.** Nothing enforces that betting surfaces are hidden from underage users |
| Family / kid-mode toggle | — | ⚪ MISSING | No parent-mode switch |
| Betting content isolation from `/plus` | Naturally isolated by route structure | ✅ LIVE (implicit) | `/plus/*` never surfaces betting content today |

### 1J · Ticker core (broadcast / news / scores)
| Component | Location | Status | Notes |
|---|---|---|---|
| Recap Show (landing) | `pages/RecapShow.jsx` | ✅ LIVE | Route `/` |
| Home V2 | `pages/HomeV2.jsx` (1,291 lines) | ✅ LIVE | Route `/home-v2` — "My Ticker" style flexible feed |
| Tonight (Predict Show) | `pages/Home.jsx` + `pages/TonightGame.jsx` | ✅ LIVE | Route `/show`, `/tonight/:gameId` |
| Scoreboard (live) | `pages/Scoreboard.jsx` | ✅ LIVE | Real NHL games |
| Reels | `pages/Reels.jsx` | ✅ LIVE | Vertical video |
| Stats | `pages/Stats.jsx` | ✅ LIVE | Player/team leaders |
| Global nav | `components/Layout.jsx` | ✅ LIVE | 6 tabs: Recap · Tonight · Scores · Home · Reels · Stats |
| Back Office (settings) | `pages/BackOffice.jsx` (1,927 lines) | ✅ LIVE | Gear icon, only visible from `/home-v2` |

---

## 2. What survived previous forks / what was lost

**Survived and healthy:**
- Recap/Tonight/Reels/Stats broadcast frame
- Predictions engine + Your Picks tab
- Full Reggie assistant with Claude + voice
- Mock analyst personas (Marc, Reggie, Lou, Tank) with banter templates
- Youth/college `/plus/*` cascade with onboarding
- Highlightly + Sportradar (trial) integrations
- The complete spec library (10+ .md files) in `/app/memory/`

**Survived but silently broken:**
- Predictions leaderboard nickname collision (documented, deferred)
- Fantasy insights (UI exists, engine is hardcoded)
- Login page (route exists, auth not wired)
- Wake-word toggle (UI exists, listener not wired)
- OddsChip (renders convincing odds that are not real)

**Lost or never built despite spec:**
- Pick 10 daily board (spec-complete)
- Community Edge™ verified specialists (spec-complete)
- Personal Edge / Betting DNA / Daily Coach (spec-complete)
- Accuracy Wheel (spec-complete)
- Matchup Analytics Sheet flagship view
- Anomaly engine
- Reggie pre-loaded user context ("user brief")
- Age-gate enforcement for betting content

---

## 3. Duplicate or conflicting architecture (unify before rebuilding)

| Duplicate pair | Resolution |
|---|---|
| `pages/PlayerDetail.jsx` + `pages/PlayerProfile.jsx` | Pick one. `PlayerDetail` is the newer, richer route |
| `pages/Home.jsx` + `pages/HomeV2.jsx` | HomeV2 is the go-forward "My Ticker" surface. Home is legacy Predict show |
| Predictions collection (`user_name`-keyed) + BetLog collection (`device_id`-keyed) | Both are records-of-what-you-thought-was-true. **Same underlying object type — different identity spine.** Should unify identity before scaling |
| `Fantasy.jsx` roster storage (`/api/subscription/roster`) vs. Ticker Plus follows (`localStorage`) | Two separate stores of "who this user cares about." Needs one identity |
| `analysts.py` mocks + Sportradar/Highlightly real data + `nhl_data.py` mocks | Three overlapping data providers with no unified `Game` / `Player` / `Team` object |
| `EdgeScoreTab` (Back Office) vs. `Predictions` scorecard (Predict page) | Both attempt "how are you doing?" — Edge Score is a stub. Fold into one Accuracy surface |
| DEV Betting IQ tab (Back Office) vs. eventual public Ticker Hockey IQ | Same feature, two homes. The Back Office IQ tab should retire once public IQ lands |

---

## 4. Ticker Hockey IQ — Mobile IA concepts

**Anchors that all three concepts must respect:**
- Betting IQ is FROZEN. Any concept must not require touching `betting_coach.py`.
- Reggie/Marc live inside Ticker Hockey IQ but also stay reachable from anywhere else (floating mic).
- Youth (`/plus/*`) must never surface betting content.
- Users must be able to return to main Ticker in one tap.
- Existing global 6-tab nav (Recap / Tonight / Scores / Home / Reels / Stats) is the launch surface.

---

### Concept A · **Sub-app with its own tab bar** (recommended — see §5)

**Entry point:** New global nav pill labelled **"Hockey IQ"** (Rajdhani, 12px), inserted between "Reels" and "Stats" on desktop. Mobile: same pill, horizontally scrollable nav.

Entering it slides in a full-screen sub-app with its **own persistent 5-tab bottom bar** (mobile) or top strip (desktop):

```
TONIGHT · MY IQ · BETTING · FANTASY · COMMUNITY
```

Advanced analytics **do not get their own tab** — they surface as inline cards inside every other tab (Matchup Insight card on Tonight, Player Impact on Fantasy, Team Momentum inside Community).

**Sub-app landing (`/iq`):**
- Hero: "Ticker Hockey IQ" mark + one-line pitch ("The intelligence layer for how you watch, predict, play, and bet hockey.")
- 5 large tiles matching the tab bar, each showing today's most valuable signal — *"3 Spot Checks flagged tonight" · "Pick 10 board unlocks in 2h" · "Your Bruins accuracy: 71% (top 8%)"*
- A "back to Ticker" chevron in the top-left is always visible.

**Tabs (mobile-first):**

| Tab | Contains today | Contains eventually |
|---|---|---|
| **Tonight** | Pick 10 board (from `PICK10_SPEC.md`), quick winner picks (moved from `pages/Predictions.jsx`), tonight's game cards with Matchup Insight | Longer-horizon markets, series-length questions, goalie/injury nudges |
| **My IQ** | Accuracy Wheel by category, prediction history (from `YourPicksTab`), calibration, biases, streaks | Personal Edge trend, "Reggie's read of you" summary, weekly recap |
| **Betting** | Frozen v2 Spot Check UI (moved from Back Office, kept identical), bet log, bulk importer, betting stats | Personal Edge, Betting DNA, real market comparison, Daily Coach nudges — all downstream of unfreezing |
| **Fantasy** | Roster (from `Fantasy.jsx`), start/sit calls | Real Yahoo import, waiver research, chat-first advice |
| **Community** | Predictions leaderboard (after device-ID fix), Community Edge™ specialist tiles | Forum, "eyes at the rink," verified specialists, category weighting |

**Reggie & Marc:** floating mic pill lives fixed bottom-right on every IQ screen. Context-aware — knows which tab you're on and can answer "how does this look for tonight?" against the tab's data.

**Return to Ticker:** persistent back chevron top-left; also, tapping "Recap" / "Tonight" / "Home" from the global nav (which stays visible or is swipe-accessible) leaves IQ.

**Youth protection:** `/iq` is gated by the same DEV flag mechanism used for Betting IQ today, plus an age-attestation on first entry (18+ checkbox stored in profile). Users onboarded through `/plus/*` who haven't attested never see the IQ pill.

**Reuse vs rebuild:**
- ✅ Reuse: `SpotCheckPanel`, `BetForm`, `BulkImportPanel`, `Predictions.jsx` (moves whole), `Fantasy.jsx` (moves whole), `MatchupInsight`, `ReggieAssistant`, entire spec library
- 🔨 Build: sub-app shell + 5-tab bar, `/iq` landing, Accuracy Wheel component, Community Edge tiles, age-gate flag
- 🗑 Retire: `BackOffice::BettingIQTab` (contents migrate), `BackOffice::EdgeScoreTab` (folds into My IQ)

**Mobile nav implications:** Two nav bars on IQ screens (global 6-tab at top, IQ 5-tab at bottom). Acceptable because they operate at different scopes — global for switching worlds, local for switching within IQ. Same pattern as Instagram (top nav + camera tabs) or Spotify (top nav + Now Playing).

---

### Concept B · **Flat expansion — new global tabs**

**Entry point:** Ticker Hockey IQ is not a sub-app. Its features are added as **three new pills in the global nav**: `PREDICT`, `BETTING`, `IQ`.

New global nav (mobile-scrollable):
```
RECAP · TONIGHT · SCORES · HOME · PREDICT · BETTING · IQ · REELS · STATS
```

- **PREDICT** = Predictions.jsx + Pick 10 + Accuracy Wheel + Leaderboard
- **BETTING** = Spot Check + Bet Log + eventual Personal Edge/DNA
- **IQ** = Fantasy + Community + advanced analytics
- No dedicated sub-app landing page.

**Where things live:**
- Betting IQ → its own top-level `/betting` tab. Not nested.
- Accuracy/Pick 10 → nested inside `/predict` tab.
- Fantasy + Community → both share the `/iq` tab, sub-toggled at page top.
- Advanced analytics → surfaced inline in Tonight and inside `/iq`.

**Return to Ticker:** always visible — the global nav is still the global nav.
**Youth protection:** requires per-tab visibility flags (hide `/betting` from underage). More surface area, more attack vectors.
**Reggie & Marc:** floating mic stays global.

**Reuse vs rebuild:**
- ✅ Reuse: same as A
- 🔨 Build: 3 top-level tabs + their pages, per-tab age gates
- 🗑 Retire: same as A

**Pros:** Fewer clicks to reach any feature. No IA depth.
**Cons:** Fragments the premium proposition — user never "walks into" a substantial IQ space; nine competing global tabs on a small screen; hard to sell one "Ticker Hockey IQ" subscription when the entitlement isn't a single place.

---

### Concept C · **Contextual overlay — no dedicated space**

**Entry point:** Ticker Hockey IQ is not a place. It's a **behaviour** — every existing page grows an "IQ layer" that expands on tap.

- Tonight page gets a "Spot Check this game" chip → opens Spot Check as a bottom-sheet.
- Every game card gets an "Ask Reggie" pill.
- Home V2 gets an "IQ Feed" row with Pick 10 previews, accuracy snapshots, Fantasy nudges.
- Back Office is renamed "My IQ" and becomes the settings + personal-data hub.
- A dedicated `/iq` route exists only as a rollup dashboard, not the primary entry.

**Where things live:**
- Betting IQ, Fantasy, Community — all reachable from contextual chips on the surfaces that make them relevant.
- Advanced analytics — same, inline.

**Return to Ticker:** N/A, user never left.
**Youth protection:** requires marking every IQ chip individually as adult-gated. **High risk of leak.**
**Reggie & Marc:** the primary vehicle. Every context question routes to Reggie.

**Reuse vs rebuild:**
- ✅ Reuse: same as A
- 🔨 Build: IQ chip system across ~15 existing pages, IQ Feed component, bottom-sheet framework
- 🗑 Retire: nothing (Back Office renames)

**Pros:** Feels most integrated. Zero "I'm in a different app" cognitive load. Maximises Reggie/Marc as the interface. Cheapest to build initially.
**Cons:** Fails the "substantial sub-app users could live inside" test explicitly stated in the brief; commercial narrative collapses (there's no "Ticker Hockey IQ" to sell); Youth protection becomes surface-by-surface and fragile; harder to give the intelligence environment a distinct visual identity.

---

## 5. Recommended concept — **A (Sub-app with its own tab bar)**

**Why:**

1. **It answers the brief literally.** The user asked for something that could hold a serious user's attention for most of a session — "almost a sub-app inside The Ticker." Concept A is the only one that gives IQ its own room.
2. **It matches the commercial architecture.** One IQ pill = one Ticker Hockey IQ subscription. Marketing doors (Fantasy, Betting, Community) all deposit into the same door. Concept B fragments the entitlement; Concept C hides it.
3. **It respects the frozen Spot Check.** Moving `SpotCheckPanel` from Back Office → `/iq/betting` is a wrapper change, not an engine change. Zero risk to v2.
4. **Youth protection is one gate, not fifteen.** One entry chip, one age attestation, one flag. Concept C would require gating every chip.
5. **Advanced analytics flows through IQ tabs, not against them.** The recommendation explicitly does NOT give analytics its own tab — that avoids the "dead stats warehouse" failure mode called out in the brief. Player Impact shows up inside Fantasy; Team Momentum shows up inside Tonight; Community Consensus shows up inside Community.
6. **Reggie/Marc keep their role as the connective tissue.** Floating mic on every IQ screen, context-aware to the tab.

**Suggested tab labels + one-line purpose (write these on the tab bar):**
- **Tonight** — What's worth watching and predicting right now.
- **My IQ** — What The Ticker has learned about you.
- **Betting** — Your history, your patterns, your Spot Checks.
- **Fantasy** — Your roster, your calls, your matchups.
- **Community** — Who else is worth listening to.

---

## 6. Shared-data / backend assessment

**The critical question:** can the existing backend support Prediction · Reasoning · Resolution · Accuracy · Specialization · Community weighting · Personal learning as **one shared object graph** rather than parallel systems?

### 6A · What's already shaped right
- `Prediction` model already has `{user_name, game_id, pick, reasoning, resolved, correct, created_at}`. **This is the seed object.** Every future signal (bet, pick 10 entry, fantasy call, forum prediction) is a variant of this.
- `BetLog` model is architecturally the same object with sportsbook-specific fields (`stake`, `odds`, `profit_loss`, `home_or_away`, `fav_or_dog`). It could be a subclass or a `type: "bet"` discriminator on a shared `UserCall` model.
- `device_id` is a viable identity spine (used for BetLog, subscription, assistant history). Predictions currently use `user_name` — this is the wrong seam.
- Mongo collections are appropriately isolated: `predictions`, `bet_log`, `assistant_history`, `subscription_state`. Cross-collection joins are cheap at the scale we'll operate.

### 6B · Architectural gaps that must be closed BEFORE any IQ expansion
1. **Identity unification** — one `User` object keyed on `device_id`, with `nickname` as a display attribute. `Prediction.user_name` becomes derived, not primary. Fixes the leaderboard collision *and* enables cross-IQ personal learning.
2. **Shared `UserCall` supertype** — a single record shape for anything the user commits to being right about. Fields: `{id, user_id, kind, subject, prediction, reasoning, confidence, market_ref, created_at, resolved_at, correct, context}`. `kind` ∈ `{game_pick, pick10_entry, bet, fantasy_start_sit, community_post_prediction}`. This is the object the Personal Learning layer trains on.
3. **Resolution feed** — nothing today grades real outcomes against real results. Every IQ accuracy/learning promise depends on this. Requires a live-scoreboard listener writing back to `UserCall.resolved`.
4. **Reasoning is second-class** — the Spot Check spec, Community Edge spec, and MOAT roadmap all depend on `reasoning` being captured at pick time. Currently `reasoning: str` is a free-text field, rarely populated. Should become a **structured** capture with tags (`{primary_factor, confidence_1_10, disagreed_with}`).
5. **No `Signal` model for the "distinct signals" concept** — the brief calls for Market / Ticker Analytics / Community / Specialists / Forum / Context / Personal History as separate signals Reggie interprets. Today they don't exist as objects. Requires a `Signal` supertype (`{outcome, source, value, confidence, timestamp, provenance}`).

### 6C · What can wait
- Real sportsbook odds ingestion (mock is fine for pattern-development; unfreeze once Personal Edge ships and the UI needs it).
- Sportradar production entitlement (trial suffices until IQ ships and we have paying users).
- Yahoo/ESPN fantasy import (roster is manual today, works for validation; upgrade after Fantasy IQ product-market fit signal).
- Forum infrastructure (predictions leaderboard fixes the immediate community proof-point; forum comes after specialists are ranked).

---

## 7. Suggested phased build order

**Phase 0 — Foundations** (2–3 weeks, no user-visible IQ product yet):
1. Introduce `User` model keyed on `device_id`; migrate `Prediction` off `user_name`. Fixes leaderboard collision as a side-effect.
2. Introduce `UserCall` supertype; make `Prediction` and `BetLog` variants of it (no data migration needed — new writes only, old records readable via view).
3. Introduce `Signal` model + a placeholder ingest for each of the 6 signal types (some can be mock while pattern is proven).
4. Age-attestation flag on `User`.

**Phase 1 — IQ shell + move existing surfaces** (2 weeks):
1. Build `/iq` sub-app shell with 5-tab nav + floating Reggie mic.
2. Move Spot Check panel + Bet Log + Bulk Import into `/iq/betting` (wrapper only, engine frozen).
3. Move Predictions.jsx and Your Picks into `/iq/tonight` and `/iq/my-iq`.
4. Move Fantasy.jsx into `/iq/fantasy`.
5. Retire `BackOffice::BettingIQTab` + `BackOffice::EdgeScoreTab`.
6. Ship to the same 3–5 real bettors from the current experiment — they now use IQ as a coherent space, not a hidden dev tab.

**Phase 2 — Pick 10 + Accuracy Wheel + resolution** (3 weeks):
1. Live resolution listener (grades `UserCall.correct` against final scores/props).
2. Pick 10 daily board from `PICK10_SPEC.md`.
3. Accuracy Wheel (category breakdown surface in My IQ).
4. Predictions leaderboard v2 keyed on `User.id`, per-category ranking.

**Phase 3 — Personal Edge + Betting DNA + Community Edge** (4 weeks):
1. Unfreeze Betting IQ engine per spec (Personal Edge across game contexts, Betting DNA tendencies page, Daily Coach nudges).
2. Community Edge™ specialist tiles + verified predictions.
3. Reggie pre-loaded user brief — Reggie's system prompt now consumes `UserCall` history and Spot Check state.

**Phase 4 — Fantasy IQ real** (4 weeks):
1. Yahoo/ESPN league import (integration playbook via `integration_playbook_expert_v2`).
2. Real player pool + waiver/injury data (Sportradar production tier — this is the moment $2K/mo starts paying off).
3. Chat-first Fantasy advice with roster context.

**Phase 5 — Forum + Community IQ** (open-ended):
1. Threaded discussion.
2. Verified fact vs reported vs rumour tiers.
3. "Eyes at the rink" local observations.

Total to a defensible, sellable Ticker Hockey IQ premium: **Phases 0–3 ≈ 10–12 weeks focused work.** Everything after is expansion.

---

## 8. Risks / dependencies / things we should NOT build yet

**Do NOT build yet (per user directive + audit findings):**
- Sportradar production entitlement — wait until Phase 4 Fantasy needs real player usage
- Sportsbook integration — wait until Phase 3 Personal Edge needs it
- Yahoo/ESPN import — wait until Phase 4
- Forum — wait until Phase 5
- Payment flows — wait until Phase 3 (something worth charging for)
- Any rebuild of Spot Check v2 — frozen indefinitely

**Real risks:**
1. **Reggie context loading is the highest-leverage single change.** If Reggie doesn't consume `UserCall` history in its prompt, the "network that knows you" promise stays hollow no matter how many IQ tabs we ship. This is a Phase 0 dependency and should not slip.
2. **Resolution feed is the bottleneck for every accuracy claim.** Without it, Accuracy Wheel is a lie and Personal Edge has nothing to compare against. Must land in Phase 2, not later.
3. **Age gate is currently a soft flag.** For any public IQ launch that includes Betting, this must become a hard attestation (18+ checkbox + regional detection) or we have legal exposure. Legal review before Phase 1 goes public.
4. **Nickname-as-identity is a data poison.** Every day predictions collide on `user_name` is a day we accumulate wrong training data for future personal learning. Fix in Phase 0, not later.
5. **The "$2K/mo Sportradar" decision is Phase 4-timed, not Phase 1.** The IQ shell + moved Betting IQ + Pick 10 + Accuracy Wheel can all launch on existing data. Only real Fantasy player usage and precise line movement need production tier.

**Dependencies to line up now:**
- Confirm one premium entitlement covers all IQ surfaces (marketing doors, single subscription) — user confirmed above; codify in `PRD.md`.
- Legal review of betting content isolation from `/plus/*` before Phase 1 public launch.
- Decide whether Reggie/Marc pre-loaded user brief pulls from `UserCall` alone or also from a summary vector (embedding of past sessions) — cheap decision today, expensive later.

---

## 9. Reused vs rebuilt — one-page summary

| Reuse as-is | Wrap / re-home | Retire | Build new |
|---|---|---|---|
| `betting_coach.py` (frozen) | `SpotCheckPanel` → `/iq/betting` | `BackOffice::BettingIQTab` | `/iq` sub-app shell |
| `BulkImportPanel` | `BetForm` → `/iq/betting` | `BackOffice::EdgeScoreTab` (stub) | 5-tab bottom nav |
| `bet_csv_parser.py` | `Predictions.jsx` → `/iq/tonight` | `pages/Home.jsx` (legacy) | `/iq` landing |
| `ReggieAssistant` | `Fantasy.jsx` → `/iq/fantasy` | `PlayerProfile.jsx` (duplicate of PlayerDetail) | Accuracy Wheel component |
| `MatchupInsight` | `YourPicksTab` → `/iq/my-iq` | | Pick 10 board (spec-ready) |
| `analysts.py` personas | Predictions leaderboard → `/iq/community` (after re-key) | | Age attestation gate |
| Highlightly integration | | | `User` supertype + `UserCall` unification |
| Sportradar trial (still trial) | | | `Signal` object model |
| Full spec library `/app/memory/*.md` | | | Live resolution listener |
| Onboarding wizard | | | Reggie pre-loaded user brief |

---

## TL;DR

- **Almost everything the brief describes as "eventually" already has spec files in `/app/memory/`.** The gap is not vision, it's execution scaffolding.
- **The biggest single architectural fix is identity unification** — one `User` keyed on `device_id`, with `Prediction` and `BetLog` becoming variants of a shared `UserCall`. Fixes the leaderboard bug for free and unlocks personal learning.
- **Concept A (sub-app with its own 5-tab bar: TONIGHT · MY IQ · BETTING · FANTASY · COMMUNITY) is the recommendation.** It's the only concept that answers the brief literally, matches the commercial architecture, and respects the frozen Betting IQ.
- **The $2K/mo Sportradar spend is a Phase 4 decision, not a Phase 1 one.** IQ shell + moved Betting IQ + Pick 10 + Accuracy Wheel can all ship on existing data.
- **Do not build anything yet.** Approve the IA + phased build order first.
