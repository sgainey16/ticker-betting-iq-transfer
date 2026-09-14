# Betting IQ ↔ Best Ticker — Product Convergence Audit

**Status:** Audit + design only. NO CODE. NO DB WRITES. NO UI CHANGES.
**Boundary:** No changes to Foundations 1A / 1B / 1C, Special Teams IQ, Atlas, Team Navi, Best Ticker Now.
**North star (governing principle for every recommendation below):**
> **Betting IQ is not another app. It is The Ticker with the professional intelligence layer turned on.**

---

## Section 0 — TL;DR

**Finding.** Betting IQ has been built as a parallel visual system (its own Tonight, its own game panels, its own read/community/desk layout). That is why it currently reads as more elementary than Best Ticker: it re-implements what The Ticker already does well instead of augmenting it.

**Recommendation.** Converge on the Best Ticker chassis. Betting IQ inherits nearly every surface The Ticker already ships. Betting IQ contributes **four genuinely unique layers** on top:

1. **My IQ prediction board** (already built — keep + evolve).
2. **`TICKER IQ | MARKET | COMMUNITY` triangle** everywhere hockey shows up.
3. **Deep hockey intelligence lenses** (Offense / Defense / Transition / Puck Management / Possession/Forecheck / Net Front / Special Teams / Goaltending / Discipline) attached to Game / Team / Player.
4. **Personal prediction history / learning** (My Results, strengths, weaknesses, calibration, prediction-vs-bet drift).

Everything else — logos, Reggie + Marc, Tonight, Recap, Stats, Team, Player, media, navigation — should be **the same components** Best Ticker already uses, with intelligence overlays.

**Preserve everything built.** No throw-aways. `iq_boards`, `iq_calls`, `iq_events`, `iq_wagers`, `iq_users`, `pick10_entry`, append-only history, resolution, as-of integrity, Community prediction capability, confidence + reasoning + visibility capabilities, personal analytics architecture — all remain.

---

## Section 1 — Current Best Ticker surface inventory (reusable chassis)

Extracted from `/app/frontend/src/App.js` and the `pages/` + `components/` directories.

### 1.1 Pages that already exist in Best Ticker

| Route | File | Function |
|---|---|---|
| `/` | `pages/RecapShow.jsx` | Two-host SportsCenter-style recap show (Reggie + Marc, clips, cold open, sign-off) |
| `/show` | `pages/Home.jsx` | Broadcast home |
| `/home-v2` | `pages/HomeV2.jsx` | Team command center — Cup Score, story tiles, host reads, pillars grid |
| `/tonight/:gameId` | `pages/TonightGame.jsx` | Deep-link per-game hub — wraps `GameHub` |
| `/team/:code` | `pages/TeamStatPage.jsx` | Team stats surface |
| `/plus/team/:code` | `pages/plus/TeamPage.jsx` | Premium team command page |
| `/player/:playerId` | `pages/PlayerDetail.jsx` | Player detail |
| `/player-profile/:slug` | `pages/PlayerProfile.jsx` | Player profile |
| `/lineup/:team` | `pages/Lineup.jsx` | Line combinations |
| `/scoreboard` | `pages/Scoreboard.jsx` | League scoreboard |
| `/stats` | `pages/Stats.jsx` | Stats explorer |
| `/recaps` | `pages/Recaps.jsx` | Recap archive |
| `/reels` | `pages/Reels.jsx` | Vertical media reel |
| `/matchup/:matchupId` | `pages/MatchupDeepDive.jsx` | Deep matchup breakdown |
| `/fantasy` | `pages/Fantasy.jsx` | Fantasy tracker |
| `/iq` | `pages/HockeyIQ.jsx` | Betting IQ shell (Tonight / My IQ / Fantasy / Community tabs) |
| `/back-office` | `pages/BackOffice.jsx` | Adult-gated bet log / bulk import / spot check |
| `/press-conference` | `pages/PressConference.jsx` | Analyst Q&A |

### 1.2 Best Ticker components already available for reuse

| Component | Purpose |
|---|---|
| `components/TwoHostDesk.jsx` | Reggie + Marc broadcast desk (poses, camera state, script beats) |
| `components/HostPortrait.jsx` | Persona portrait with size + mood + mirror props |
| `components/GameHub.jsx` | Self-contained per-game hub — pregame script, voice playback, matchup ID |
| `components/GameStory.jsx` | Narrative story cards for a game |
| `components/PostGameStats.jsx` | Postgame comparison stats block |
| `components/PlayByPlayPanel.jsx` | PBP browser (Foundation 1B feed) |
| `components/PlayByPlayModal.jsx` | Modal variant |
| `components/MatchupInsight.jsx` | Two-team insight card |
| `components/GamePickerStrip.jsx` | Horizontal game rail (already used by Tonight tab in Betting IQ shell) |
| `components/FavoritesRail.jsx` | Followed teams rail |
| `components/GoalAlertBar.jsx` | Live goal ticker |
| `components/StatCallouts.jsx` | Called-out numbers |
| `components/PickRecordCard.jsx` | User pick record card |
| `components/OddsChip.jsx` | ⚠ Small odds chip — currently visual only, not wired to any real market feed |
| `components/Ticker.jsx` | Live ticker strip |
| `components/LiveDesk.jsx` | Live show desk |
| `components/ReggieAssistant.jsx` | In-page Reggie assistant |
| `components/AnalystCard.jsx`, `components/AnalystAvatar.jsx` | Analyst tiles |
| `components/NHLShield.jsx` | League shield mark |
| `lib/teamLogos.jsx` | Canonical team logos |
| `lib/brand.jsx`, `lib/config.js`, `lib/teamColors.js` | Brand palette + team-color palette (added by this slice) |

### 1.3 Betting IQ-specific components (v2 shell)

| Component | Current role | Convergence recommendation |
|---|---|---|
| `iq/v2/TonightHero.jsx` | Compact Tonight header inside the IQ shell | Retire — Tonight IQ should ride Best Ticker's Tonight surface with an intelligence overlay, not re-render its own header |
| `iq/v2/GameRailV2.jsx` | Horizontal matchup scroller | Fold into `GamePickerStrip` with an "IQ overlay" mode |
| `iq/v2/MatchupIntel.jsx` | Selected-matchup intelligence body | Split: The Read (Ticker IQ / Community, later Market) becomes an overlay panel; matchup stats already duplicate `PostGameStats` / `MatchupInsight` |
| `iq/v2/MatchupStats.jsx` | Season comparison table | Retire — `PostGameStats` or a shared "Season Comparison" primitive should cover this |
| `iq/v2/TonightsTenLoop.jsx` | Full-screen fast prediction loop | **Keep as-is** — this is a Betting-IQ-native surface |
| `iq/v2/MyIQCommandCenter.jsx` | My IQ page (redesigned to Logos + Hosts) | **Keep** — my-iq is genuinely unique |
| `iq/v2/LastNight.jsx` | Grading strip | Keep the concept; move rendering back into `MyIQCommandCenter` (already done in redesign) |
| `iq/v2/WhyChip.jsx` | Help pop | Keep — small, atomic |
| `iq/IQCoachDock.jsx`, `iq/IQCoachChat.jsx` | Reggie chat inside the IQ shell | Reconcile with `ReggieAssistant` — same brain, different mount points |
| `iq/MakeCallPanel.jsx` | Formal event-authoring call flow | Downgrade — deep capture flow. The default prediction path is Tonight's 10; this becomes a "log a longer, considered call" advanced tool |

---

## Section 2 — Convergence map (surface by surface)

For each surface: what Best Ticker already does, what Betting IQ adds, what data supports the augmentation today, what's on hold pending real providers.

### 2.1 HOME / RECAP

**Best Ticker chassis:** `RecapShow` (two-host player), `HomeV2` (team command center), `Home` (broadcast home).

**Betting IQ augmentation (deferred, small):**
- A one-line "Your card · N/M" chip on Home if the user has an active Tonight's 10 board — deep-links straight into the fast loop.
- A one-line "Last night · X/Y · Z%" chip on Recap if the user's board resolved.

**Data available now:** `iq_boards` + `iq_calls` + `iq_resolutions`. **✅ AVAILABLE NOW.**

**No new surface.** The chip lives inside existing components.

---

### 2.2 TONIGHT (the big convergence)

**Best Ticker chassis:** `GamePickerStrip` (horizontal rail), `GameHub` (per-game hub with pregame script + voice), `TonightGame` (deep-link).

**Betting IQ contract:** **Do not create another Tonight.** Betting IQ should render the same `GameHub` component, augmented with two overlays:

1. **THE READ triangle** (Section 3.1) — Ticker IQ / Market / Community percentages at the top of `GameHub`.
2. **INTELLIGENCE LENSES** row (Section 3.2) — Overview + eventually Special Teams / Transition / Goaltending / etc., appearing as sibling tabs beside GameHub's existing pregame content.

**Data available now:**
- Ticker IQ % — `game.ai_consensus` (editorial pre-model, honestly labelled).
- Community % — `db.predictions` aggregate on `/api/predictions/games` (real).
- Market % — ❌ **REQUIRES MARKET/ODDS PROVIDER.** Column stays blank/locked until a legitimate feed lands.

**Retire:** `TonightHero`, `GameRailV2`, `MatchupIntel`, `MatchupStats` inside the IQ shell — they duplicate Best Ticker components. The IQ shell's Tonight tab should render `GamePickerStrip` + `GameHub` (or `TonightGame` deep-link) with the overlays.

---

### 2.3 GAME

**Best Ticker chassis:** `GameHub`, `GameStory`, `PostGameStats`, `PlayByPlayPanel`, pregame script + voice.

**Betting IQ augmentation:**
- **The Read triangle** at the top (see above).
- **Ticker IQ Desk** — Reggie + Marc pregame audio is the entry point; Betting IQ opens the underlying prediction context ("this is your `game_pick` call") next to it.
- **Intelligence Lens rail** below the score summary. Lenses only appear when real data supports them (Section 3.2).
- **My call state** — if this game is on the user's Tonight's 10 board, show "You called EDM" and grade state.

**Data available now:** Real live scores (SportsData.io / Sportradar), pregame script (in code), community %.
**Deferred:** Real market %, deep analytics lenses (see 3.2 tiers).

**No new page.** `GameHub` grows two overlays: `<GameHubReadTriangle>` + `<GameHubIntelligenceRail>`.

---

### 2.4 TEAM

**Best Ticker chassis:** `TeamStatPage` (live), `plus/TeamPage` (premium command center — Cup Score, story tiles, pillars).

**Betting IQ augmentation:**
- **Tonight involvement chip** — "On your Tonight's 10 · Q4 · EDM @ COL". Deep-link back to the question.
- **Team-level intelligence lenses** (mirrors Game lenses). Team pages already have Offense / Defense / Special Teams / Goaltending story tiles in `HomeV2` — same visual pattern, more depth underneath.
- **Ticker IQ team read** — what Ticker thinks about this team this week (editorial today, model later).
- **Community read on next game** — % split.
- **Personal record vs this team** — from `iq_calls` grouped by `subject.home/away`.

**Data available now:** Standings, Cup Score inputs (already in HomeV2 seed shape), community %, personal history.
**Deferred:** Deep lenses beyond Overview (need real underlying data, see 3.2).

**No new page.** Add `<TeamIQOverlay>` slot to `TeamStatPage` and `plus/TeamPage`.

---

### 2.5 PLAYER

**Best Ticker chassis:** `PlayerDetail`, `PlayerProfile`.

**Betting IQ augmentation:**
- **Tonight's relevant markets** (goals O/U 0.5, shots O/U N.5, points O/U 1.5) — ❌ blocked until Market feed lands.
- **Relevant Tonight's 10 questions** if a player prop template is active (`named_player_scores` — L.6 in the consolidated architecture).
- **Ticker IQ role/opportunity read** — TOI trends, PP-unit membership, matchup shift start rate. AVAILABLE NOW at basic level (NHL Public + SportsData) but "role driver" ratings are DERIVABLE ONLY at low fidelity without Sportlogiq.
- **Community position on this player tonight** — % of users who took OVER on their prop.
- **Personal accuracy on this player** — from `iq_calls` grouped by `subject.player_id`.

**Data available now:** Core box stats, PP-unit membership from PBP (needs Foundation for goalie-line-style resolvers), personal history.
**Deferred:** Market props, deep transition/creation/net-front metrics (Sportlogiq or equivalent).

**No new page.** Add `<PlayerIQOverlay>` slot to `PlayerDetail` / `PlayerProfile`.

---

### 2.6 STATS

**Best Ticker chassis:** `Stats` (explorer), `Scoreboard`.

**Betting IQ augmentation:**
- No new stats page needed. Betting IQ's job in Stats is:
  - Allow filtering the standings / stat tables by "categories Ticker IQ is watching" (Special Teams delta, Transition delta, etc.) — but only surface categories with real underlying data (see 3.2).
  - Deep-link every stat row into its Team / Player page, where the IQ overlays live.

**Data available now:** Standings, GF/GA, PP%, PK%, shots (via SportsData.io / NHL Public).
**Deferred:** Everything Sportlogiq-tier.

---

### 2.7 RECAP

**Best Ticker chassis:** `RecapShow` (two-host player), `Recaps` (archive).

**Betting IQ augmentation (this is a big one — currently missing):**

A **Betting IQ recap** does not need a new page. It's a one-segment insert in the existing `RecapShow` beat sequence whenever the user has resolved calls from that day:

```
WHAT TICKER THOUGHT       (58% EDM)         [Editorial · pre-model, honestly labelled]
WHAT THE MARKET THOUGHT   (52% EDM)         [Blank until Market feed]
WHAT THE COMMUNITY THOUGHT (80% EDM)        [db.predictions aggregate]
WHAT YOU PICKED           (COL)             [iq_calls]
WHAT ACTUALLY HAPPENED    (EDM won 4-2)     [iq_game_finals]
WHAT WE LEARNED           ("Community is a fade tonight")  [derived from iq_events + Foundation 1B]
```

**Strict as-of integrity rule:** the "WHAT TICKER THOUGHT" panel must filter every input by `recorded_at <= locked_ts` — same dual-gate that Foundation 1B already enforces. Post-lock information NEVER appears in the retrospective.

**Data available now:** Ticker %, Community %, user pick, final score, learning line (derived).
**Deferred:** Market column.

**Component:** A new `<RecapIQSegment>` slot inside the existing `RecapShow` beat builder.

---

### 2.8 REGGIE + MARC

They already exist across Best Ticker. Betting IQ should **NOT** re-mount them as separate coach docks. Reconcile:

| Location | Current | Recommendation |
|---|---|---|
| `RecapShow` | `TwoHostDesk` — deep, camera-directed | Keep |
| `HomeV2` | Quote block | Keep |
| `GameHub` | Pregame script + voice | Keep |
| Betting IQ Tonight (MatchupIntel) | `IQDeskPanel` | Retire — the same voice/portrait plumbing already exists in `GameHub`; the IQ Desk becomes an overlay of `GameHub`'s existing pregame block |
| Betting IQ My IQ (new redesign) | `HostBanter` two-voice state-aware lines | **Keep** — this IS the Betting-IQ-native host role: host of the user's prediction game. This is unique. |
| Betting IQ Community | `IQCoachDock` | Reconcile with `ReggieAssistant` — one chat brain, mounted where needed |

**Rule:** hosts are always short, visual, conversational, audio-first. Never a giant help-widget card.

---

### 2.9 MEDIA / HIGHLIGHTS

**Best Ticker chassis:** `Reels`, `GameHub` clips, `RecapShow` clips.

**Betting IQ augmentation:** none required in Phase 0. Later, a Betting IQ recap may link to the specific highlight that resolved a question ("here's the McDavid goal that hit your OVER").

---

### 2.10 NAVIGATION

**Current:** `/iq?tab=tonight|my-iq|fantasy|community` uses a sticky tab bar unique to the IQ shell.

**Recommendation:**
- Retire the separate `/iq` shell's Tonight tab. Deep-link into Best Ticker's Tonight surface with `?iq=on` query flag that turns on the IQ overlays.
- Keep the tab bar for `my-iq` + `community` — those are Betting IQ-native.
- Or, cleaner: the whole Betting IQ experience is Best Ticker with a "Ticker Pro / Betting IQ mode" toggle at the app-shell level. When on, every Game / Team / Player page grows its IQ overlay panels.
- Preserve the navigation context stack so `Question → Game → Team → Player → back` lands on the same question with pending pick intact (already designed in the consolidated architecture, Section I).

---

## Section 3 — What is genuinely unique to Betting IQ

Everything below stays inside Betting IQ, not converged into Best Ticker.

### 3.1 The `TICKER IQ | MARKET | COMMUNITY` triangle

Visual comparison, normalised to probability where legitimate. Three columns everywhere a matchup / player prop appears.

| Leg | What it is | Data status |
|---|---|---|
| **TICKER IQ** | Ticker's own prediction/intelligence position | ✅ AVAILABLE NOW as editorial (`ai_consensus`), honestly labelled `EDITORIAL · PRE-MODEL`. Upgrades to a real model output with Foundation 1C+ |
| **MARKET** | Real bookmaker odds → market-implied probability (with no-vig option). Actual prices sit underneath. | ❌ **REQUIRES MARKET/ODDS PROVIDER.** No fabrication. Column locked until a legitimate feed is wired. Odds fields on `Wager` (`odds_text`, `book`) are user-entered only |
| **COMMUNITY** | Ticker users' prediction distribution | ✅ AVAILABLE NOW via `db.predictions` aggregate on `/api/predictions/games` |

**Language discipline:**
- Ticker IQ and Community = **probabilities/predictions**.
- Market = **actual bookmaker odds** (with an implied-probability derivation).
- Do NOT call all three "odds."
- Distinguish **RAW BOOK ODDS** vs **MARKET IMPLIED PROBABILITY** vs **NO-VIG MARKET PROBABILITY** in every UI element that surfaces them.

**Placement:**
- Game → Read triangle at the top.
- Team → Aggregated across upcoming games this week.
- Player → Per-prop.
- Tonight's 10 → Underneath the question after the user has locked (so the pick isn't primed by the market number).
- My IQ personal analytics → Prediction-vs-market drift (once Market lands).
- My Bets → Price taken vs closing line (CLV, once Market and closing snapshots land).

---

### 3.2 Deep hockey intelligence lenses (Game / Team / Player)

Same nine categories the user named. Each lens is a two-team (or single-player) comparison card with a WHY? drill-through into evidence.

| Lens | Best-case UI ("COL 84 · EDM 67 · WHY?") | Data tier |
|---|---|---|
| **OFFENSE** | GF/60, shot generation, high-danger chances, rush chances, shooting % | ✅ AVAILABLE NOW at basic level (SportsData.io + NHL Public). Danger-chance quality is DERIVABLE ONLY at low fidelity |
| **DEFENSE** | GA/60, shots against, high-danger against, zone-time against | ✅ AVAILABLE NOW at basic level. Zone-time DERIVABLE NOW from PBP |
| **TRANSITION / BREAKOUT** | Controlled exits, failed exits, entries against, entry denial | ⚠ **REQUIRES SPORTLOGIQ / PREMIUM PROVIDER.** Approximations from PBP are unreliable |
| **PUCK MANAGEMENT / TURNOVERS** | Turnovers under pressure, giveaways/takeaways contextualised | ⚠ REQUIRES SPORTLOGIQ. Raw giveaway/takeaway from NHL Public is NOT CURRENTLY RELIABLE for team ratings |
| **POSSESSION / FORECHECK** | OZ time %, forecheck pressure, recoveries | ⚠ REQUIRES SPORTLOGIQ. Corsi/Fenwick would be DERIVABLE NOW from PBP but were previously scrubbed from copy per phone-review honesty rule |
| **NET FRONT / DANGER** | Screens, deflections, cross-crease passes, net-front presence | ⚠ REQUIRES SPORTLOGIQ or equivalent tracking feed |
| **SPECIAL TEAMS** | PP%, PK%, PP entry success, PK exit success, PP shot rate | ✅ PP%/PK% AVAILABLE NOW. Entry/exit success DERIVABLE NOW from PBP via the Foundation 1B-style free baseline (already planned in `/app/memory/SPECIAL_TEAMS_IQ_STEP3_BASELINE_PLAN.md`). Advanced tracking = Sportlogiq |
| **GOALTENDING** | GSAx, save %, save % by danger, quality-of-shot faced | Save% ✅ AVAILABLE NOW (Foundation 1B). GSAx / danger-weighted ⚠ REQUIRES SPORTLOGIQ (or a Ticker-derived xG model — a Foundation 2 project, currently DERIVABLE at low fidelity only) |
| **DISCIPLINE** | Minor rate, PIM/60, penalties drawn vs taken, refereeing tendencies | ✅ Minor/PIM AVAILABLE NOW. Referee tendencies REQUIRES an external referee assignment / historical PBP index |

**Rule.** A lens does not appear in the UI until its underlying data is legitimate. Lenses that require Sportlogiq stay off screen — not padlocked, not "coming soon," simply absent from the horizontal rail. `MatchupIntel`'s LENSES_COMING array already codifies this pattern.

**Intelligence hierarchy** (per user brief §5):
```
EVENT → PLAYER → UNIT/LINE/PAIR → TEAM → TONIGHT'S MATCHUP
```
Every rating opens progressively:
- Team rating → contributing players → contributing units → contributing events → sample size + provenance → "compare against opponent."
- The Foundation 1A → 1B → 1C → 2 layer stack already models this. Ratings project from lower layers; they don't get invented at the top.

---

### 3.3 My IQ prediction board (already built)

**Preserve.** Everything already shipped in this slice:
- `iq_boards` + `iq_calls` + `iq_events` + `iq_wagers` + `iq_users`
- `pick10_entry`, append-only history, resolution, as-of integrity
- Fast loop (SEE → TAP → LOCK → NEXT)
- Reggie + Marc host banter (state-aware)
- Team-colour matchup rail
- Compact Last Night pips

**Evolution (per user brief §9 – §11):**
1. **Scrollable prediction board (not a wizard).** Tonight's 10 becomes a scroll-through mix of question templates: `who_wins`, `player_scores`, `team_total_over_under`, `game_reaches_ot`, `saves_higher`, `shots_higher`. Each still SEE → TAP → LOCK. No forced order.
2. **After 10/10: MORE PICKS →** — additional legitimate resolvable questions if the slate supports them. Never manufactured.
3. **Market-driven questions** — once a Market feed lands, the board expands to include real thresholds (`OVECHKIN SHOTS · MARKET 3.5 · OVER | UNDER`) instead of Ticker-invented thresholds. Do NOT invent thresholds today.
4. **Two-voice banter reacts** to progress and to yesterday's grade (already implemented).

---

### 3.4 Personal prediction history / learning (below the board)

Progressive reveal — each cell requires a sample-size gate before rendering a number.

| Panel | Data source | Gate |
|---|---|---|
| LAST NIGHT | `iq_boards` + `iq_resolutions` yesterday | ≥1 resolved call |
| RECENT RESULTS | rolling 7-day `iq_calls` | ≥3 resolved calls |
| MY ACCURACY (overall) | `accuracy_summary` on `/api/iq/user/brief` | ≥10 resolved calls |
| BY CATEGORY (game winners / totals / props / goal scorers) | Extend `iq_user_insights` with `by_call_kind` and `by_template` breakouts (small backend add, already listed as L.5 in the consolidated architecture) | ≥10 per category |
| STRENGTHS / WEAKNESSES | Same `iq_user_insights` output — `high_confidence` insights | already implemented threshold logic |
| CALIBRATION | Once Go Deeper turns on confidence capture — reliability curve | ≥25 resolved calls with confidence |
| PREDICTION vs BET DRIFT | Join `iq_calls` × `iq_wagers` × `iq_resolutions` | ≥25 wagered calls |
| MY BETS | `iq_wagers` | Any |

**Prediction ≠ Bet** is enforced by schema (already true). Never combined into one accuracy number without labelling the split.

---

## Section 4 — Availability tiers, one clean legend

| Tier | Meaning |
|---|---|
| ✅ **AVAILABLE NOW** | Wired to a live feed in the current codebase (NHL Public, SportsData.io, Highlightly, our own `iq_*` collections) |
| 🟡 **DERIVABLE NOW** | Real underlying data exists (PBP or box) but a projector needs to be written; low-fidelity approximations flagged as such and never presented as premium ratings |
| ❌ **REQUIRES SPORTLOGIQ / PREMIUM PROVIDER** | Tracking-quality data. Not fabricated |
| ❌ **REQUIRES MARKET/ODDS PROVIDER** | Real bookmaker odds. Not fabricated. `OddsChip.jsx` exists but is currently visual only |
| ⚫ **NOT CURRENTLY RELIABLE** | Raw provider field exists but is known-noisy (e.g. NHL Public giveaway/takeaway for team ratings); do NOT surface as intelligence |

Every metric surfaced by Betting IQ must carry its tier internally, and the UI must never present a tier-❌ or tier-⚫ metric as if it were tier-✅.

---

## Section 5 — Recommended unified information architecture

**One app. One visual language. Betting IQ is a mode, not a fork.**

```
THE TICKER (parent chassis — every surface owns the visual language)
│
├─ HOME / RECAP                 → RecapShow, HomeV2, Home  (+ IQ chip for active card)
├─ TONIGHT                      → GamePickerStrip + GameHub  (+ Read triangle overlay + Intelligence rail)
│   └─ /tonight/:gameId         → TonightGame  (same, deep-linked)
├─ GAME                         → inside GameHub  (+ Read triangle + Intelligence lenses + My call state)
├─ TEAM                         → TeamStatPage / plus/TeamPage  (+ TeamIQOverlay: aggregated Read triangle, team lenses, personal record)
├─ PLAYER                       → PlayerDetail / PlayerProfile  (+ PlayerIQOverlay: props, role read, personal record)
├─ STATS                        → Stats, Scoreboard  (+ IQ category filters, deep-link into IQ overlays)
├─ MEDIA / HIGHLIGHTS           → Reels, RecapShow clips
├─ FANTASY                      → Fantasy  (unchanged in this convergence)
│
└─ BETTING IQ MODE (toggle at app-shell level, always visible when on)
    ├─ MY IQ                    ← Betting-IQ-native, keep the redesigned command centre
    │    ├─ Reggie + Marc host banter
    │    ├─ Tonight's 10 scrollable board (evolves per §3.3)
    │    ├─ Continue / Play / Review pill
    │    ├─ Last Night pips
    │    ├─ Recent Results + My Accuracy (sample-gated)
    │    ├─ By Category + Strengths/Weaknesses (sample-gated)
    │    ├─ Calibration + Prediction-vs-Bet drift (deep-gated, Go Deeper)
    │    └─ My Bets (link)
    ├─ COMMUNITY                ← Betting-IQ-native (leaderboard redesign deferred per phone review)
    └─ RECAP · IQ SEGMENT       ← inserts into the existing RecapShow beat sequence, doesn't create a new page
```

**Retirement candidates** (retire only when the augmented Best Ticker surface is proven, not before):
- `iq/v2/TonightHero.jsx`
- `iq/v2/GameRailV2.jsx`
- `iq/v2/MatchupIntel.jsx` (split into `<ReadTriangle>` + `<IntelligenceRail>` overlays on `GameHub`)
- `iq/v2/MatchupStats.jsx` (fold into a shared "Season Comparison" primitive `PostGameStats` could host)

**Everything else in the Betting IQ v2 folder stays.**

---

## Section 6 — Hard boundaries reconfirmed

- **No code from this audit.**
- No duplicate Ticker.
- No duplicate game/team/player databases — reuse canonical Ticker entities (Foundation 1A).
- No fake odds.
- No fake advanced analytics.
- No Foundation 1A/1B changes.
- No Foundation 1C implementation.
- No Atlas changes.
- No Special Teams IQ implementation.
- No Team Navi changes.
- Do not throw away the working Tonight's 10 backend or the redesigned My IQ.

---

## Section 7 — Proposed next-step gates (needing user approval before any code)

**Gate A — Convergence sign-off (this document).**
Approve the principle that Betting IQ inherits Best Ticker components everywhere except the four unique surfaces (§3.1–§3.4).

**Gate B — First convergence slice.**
Replace the Betting IQ Tonight tab's home-grown MatchupIntel with the existing `GameHub` + two overlays (`<ReadTriangle>`, `<IntelligenceRail>`). One augmentation, one retirement. Prove the pattern on one surface before touching Team / Player.

**Gate C — Market provider decision.**
Separate audit. Before any Market UI ships, agree on:
- Provider (The Odds API / Sportradar Odds Comparison / SportsData.io Odds / a direct sportsbook feed).
- Books included, market types (moneyline, puck line, totals, team totals, player props), latency, historical/closing availability, licensing/display restrictions, vig treatment.
- Storage schema: `odds_snapshots` (append-only, timestamped), `market_implied_probability` (derived at read time), `closing_line_snapshot` (for CLV).

**Gate D — Deep intelligence lens rollout.**
Ship lenses one at a time, only when data is legitimate:
1. Special Teams IQ Free Baseline (already planned).
2. Goaltending (save% is available today; GSAx waits).
3. Discipline (available today).
4. Everything else on hold pending Sportlogiq.

---

**End of audit. No code. Awaiting approval on Section 5 information architecture and Gate A sign-off.**
