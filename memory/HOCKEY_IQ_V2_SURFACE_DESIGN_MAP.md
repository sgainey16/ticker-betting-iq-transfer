# Hockey IQ V2 — Surface Design Map

**Status:** Design map only. NO CODE. NO NEW SCREENS.
**Governing spec:** V2 Design Constitution (produced in the Main Ticker V2 workstream) + this V2 Amendment.
**North star:** Take the finished Main Ticker V2 experience and turn the intelligence all the way up. Same Ticker, same hockey world, same characters, same navigation grammar — more evidence, depth, personalization, intelligence.

---

## Section 0 — What this fork actually has today (honest)

The V2 primitive library referenced in the amendment — `V2Screen`, `V2IdentityHeader`, `V2IntelStrip`, `V2SectionTabs`, `V2FeatureMetric`, `V2MetricRail`, `V2ResultCard`, `V2Matchup`, `V2GameLine`, `V2LeaderRow`, `V2RailCard`, `V2Chip`, `V2StatStrip` — **is not yet present in `/app/frontend/src/`**. Neither is a `V2 Design Constitution` document under `/app/memory/`.

That is fine for a design map. The map treats V2 primitives as target grammar (design intent). When the real V2 primitive library ships from the Main Ticker workstream, Hockey IQ **inherits** — it does not fork.

Until then, the table below shows both:
- **V2 primitive role** — the design contract the Hockey IQ surface commits to.
- **Interim mount** — the strongest existing component in this fork that fills that role during any prototype phase. Interim mounts are used ONLY for reference visuals; they do not become the shipped implementation.

The one-screen reference build we choose in Section 10 will render against the V2 primitives once they land, not against interim mounts.

**Hockey IQ capabilities already in this fork** (do NOT throw away):
- `iq_boards`, `iq_calls`, `iq_events`, `iq_wagers`, `iq_users`, `pick10_entry`.
- Append-only history, resolution, as-of integrity.
- Confidence + reasoning + visibility event kinds (capability preserved, not asked in the default fast loop).
- Foundation 1A (canonical identity + pregame snapshots) — deployed.
- Foundation 1B (immutable game finals) — deployed.
- `TonightsTenLoop` (SEE → TAP → LOCK → NEXT).
- `MyIQCommandCenter` (LOGOS. REGGIE. MARC. FUN. redesign).
- `BettingIQOverlays` (`ReadTriangle`, `IntelligenceRail`, `MyCallState`, `INTELLIGENCE_LENS_REGISTRY`).
- `/iq/game/:gameId` proof surface (Best Ticker GameHub + IQ overlays).

**Naming discipline for this design work:** the product is **Ticker Hockey IQ**. The word "Betting IQ" narrows the visual identity; from this map forward, treat betting intelligence as one capability inside Hockey IQ, not the whole thing.

**Navigation discipline:** the previous constitution's Hockey-IQ-specific nav (`TONIGHT | GAME IQ | MY BETS | MY IQ`) is **de-frozen**. Hockey IQ will inherit the finished Main Ticker V2 navigation. Design the surfaces, not a competing nav universe.

---

## Section 1 — HOCKEY IQ HOME

**Purpose.** The first thing a Hockey IQ user sees. Establishes "Ticker with the intelligence turned all the way up" instantly.

| Slot | V2 primitive role | Interim mount today | Content |
|---|---|---|---|
| Screen frame | `V2Screen` | `HockeyIQ.jsx` shell | Sticky header inherited from Main Ticker |
| Identity header | `V2IdentityHeader` | Not yet present | `HOCKEY IQ` mark + user's Hockey IQ state chip (calls in book, accuracy if ≥ 10, streak) |
| Host welcome | Two-voice banter primitive (from V2 constitution) | `HostBanter` inside `MyIQCommandCenter` | Reggie + Marc react to yesterday's card, tonight's slate, streak, or Cup horizon |
| Tonight rail | `V2Matchup` × N inside a `V2RailCard` | `iq/v2/MyIQCommandCenter.jsx` `MatchupChip` | Horizontal matchup rail. Same crests, team-color glow, `TICKER IQ / MARKET (locked) / COMMUNITY` micro-chip on each |
| Tonight's 10 CTA | `V2Chip` (pill primitive) | Existing `Play tonight's 10` pill | 0/N counter chip + PLAY |
| Last night strip | `V2StatStrip` + result pips | Existing `LastNightStrip` in `MyIQCommandCenter` | 5 / 8 · 63% + logo pips with ✓ / ✕ |
| My IQ progress | `V2FeatureMetric` (sample-gated) | Existing `MyIQProgressStrip` (≥ 10 gate) | Accuracy · N graded |
| Deep Intel entry | `V2SectionTabs` (single tab active, others `pending providers`) | `IntelligenceRail` in `BettingIQOverlays` | Doorway to the 9-lens registry; only the tiers that have real data surface |
| Section tabs / mode toggle | Inherited from Main Ticker V2 nav grammar | n/a | Do NOT re-invent |

**Data available now:** everything above except Market chips. Sample-size gates enforce honest empty states.
**Provider-dependent:** Market probabilities (odds provider), deeper lenses (Sportlogiq).
**Do NOT build yet:** a Hockey-IQ-specific news feed, a Hockey-IQ-specific highlight reel, a competing primary navigation.

---

## Section 2 — MY IQ

**Purpose.** The most distinct Hockey IQ surface. Personal prediction / learning engine. Visual, hockey-first, fast.

| Slot | V2 primitive role | Interim mount | Content |
|---|---|---|---|
| Screen frame | `V2Screen` | `MyIQCommandCenter.jsx` | Same as Home frame |
| Host banter | Two-voice primitive | `HostBanter` (state-aware, already shipping) | before / during / after / graded lines |
| Prediction board | New V2 primitive `V2PredictionBoard` (proposed) | `TonightsTenHero` + `TonightsTenLoop` | Scrollable SEE → TAP → LOCK → NEXT. Not a wizard. |
| Prediction families | Section tabs inside the board | Not yet present | **TONIGHT** (available) · **SEASON** (available for standings/awards proxies) · **PLAYOFFS** (once bracket forms) · **DRAFT** (draft window) · **LONG RANGE** (career/prospect projections) |
| Personal history | `V2FeatureMetric` grid, sample-gated | Existing `iq_user_insights` payload | Last Night → Recent → Overall → By Category → Strengths / Weaknesses → Calibration → Prediction-vs-Bet drift |
| My Bets | Small `V2Chip` link, not a tile | Existing `MyBetsLink` | Enter the wager-tracking sub-surface (not the whole app) |
| Deep-dive door | New V2 primitive `V2WhyPanel` (proposed) | Not yet present | `WHAT? → WHY? → SHOW ME` — see Section 9 |

**Data available now:** everything in TONIGHT, plus derived personal analytics as sample sizes open.
**Provider-dependent:** market-driven prediction thresholds (OVECHKIN SHOTS · MARKET 3.5), Sportlogiq-driven questions.
**Do NOT build yet:** Playoff / Draft / Long-Range question generators before their real resolvers exist.

**Prediction ≠ wager.** Preserved by schema. Analytics never combine them into one accuracy number without labelling the split.

**Timestamped horizons:** SEASON / PLAYOFFS / DRAFT / LONG RANGE calls resolve at very different points in time. `iq_calls` already carries `created_at`, `locked_at`, `context_snapshot_ref`. Resolution runs whenever the horizon closes, not just at end-of-night.

---

## Section 3 — GAME · IQ-AUGMENTED STATE

**Purpose.** The same Best Ticker game surface with intelligence turned on. Not a duplicate hockey universe.

| Slot | V2 primitive | Interim mount | Content |
|---|---|---|---|
| Screen frame | `V2Screen` | `TickerProGame.jsx` | Sticky "Hockey IQ · On" mode chip |
| Game identity | `V2Matchup` + `V2GameLine` | Best Ticker `GameHub` (reused unchanged) | Crests, time, your-pick tile |
| Host segment | Two-voice primitive + audio | `GameHub`'s pregame script + ElevenLabs voice | Existing capability |
| Head-to-head | `V2StatStrip` | `GameHub`'s Season · Head-to-Head table | Existing capability |
| **The Read triangle** | `V2IntelStrip` × 3 (TICKER IQ · MARKET · COMMUNITY) | `ReadTriangle` in `BettingIQOverlays` | Three legs. Market renders LOCKED until an odds feed lands |
| **My call state** | `V2ResultCard` in `pending` / `right` / `miss` tone | `MyCallState` in `BettingIQOverlays` | Only if this game is on the user's Tonight's 10 board |
| **Deep intelligence rail** | `V2SectionTabs` + `V2MetricRail` | `IntelligenceRail` + `INTELLIGENCE_LENS_REGISTRY` | 9-lens architecture visible; only real lenses surface |
| Overview lens body | `V2FeatureMetric` grid | Existing derived-per-game overview | Record, Points, Goals/GP, GA/GP, Goal Diff — all derived from real GF/GA/GP |
| **Custom analytical reel entry** | `V2Chip` "SHOW ME" | Not yet present (Section 9) | Enter into a WHY?-driven reel when the underlying video index supports it |

**Data available now:** identity, host script, head-to-head, Ticker IQ (editorial), Community, MyCallState, Overview lens body.
**Provider-dependent:** Market column, Sportlogiq lenses, custom video reels (need indexed video + rights).
**Do NOT build yet:** a Hockey-IQ-specific Tonight page.

---

## Section 4 — TEAM · IQ-AUGMENTED STATE

**Purpose.** Inherit the Main Ticker team page. Add intelligence overlays.

| Slot | V2 primitive | Interim mount | Content |
|---|---|---|---|
| Screen frame | `V2Screen` inherited from Main Ticker | `TeamStatPage` / `plus/TeamPage` | Reuse |
| **Team read** | `V2IntelStrip` | Not yet present | What Ticker thinks about this team this week (editorial today, model later) |
| **Community lean on next game** | `V2Chip` | Existing `db.predictions` aggregate | Real |
| **Personal record vs this team** | `V2FeatureMetric` | Derivable from `iq_calls` grouped by `subject.home/away` | Sample-gated ≥ 5 |
| **Team-level lens rail** | `V2SectionTabs` mirroring Game lenses | Not yet present | Offense / Defense / Special Teams / Goaltending only surface at tier ✅ AVAILABLE; the rest stay in the registry |
| **Tonight involvement chip** | `V2Chip` | Derivable from today's `iq_boards` questions matching this team | "On your Tonight's 10 · Q4" |

**Data available now:** standings, GF/GA/GP, community %, personal record, involvement chip.
**Provider-dependent:** advanced lenses.
**Do NOT build yet:** duplicate Cup Score, duplicate team narrative — reuse HomeV2 pillars primitives when V2 versions ship.

---

## Section 5 — PLAYER · IQ-AUGMENTED STATE

**Purpose.** Inherit Main Ticker player page. Add prediction / market / intelligence context.

| Slot | V2 primitive | Interim mount | Content |
|---|---|---|---|
| Screen frame | `V2Screen` inherited | `PlayerDetail` / `PlayerProfile` | Reuse |
| **Tonight's relevant markets** | `V2IntelStrip` | Not yet present | Goals O/U, shots O/U, points O/U — LOCKED until Market feed lands |
| **Tonight's 10 player questions** | `V2GameLine` derivative | Not yet present | Only when player-attribute templates activate (L.6 in consolidated architecture) |
| **Role / opportunity read** | `V2FeatureMetric` | Derivable from PBP + box (TOI, PP-unit membership) | Basic tier available; deep drivers require Sportlogiq |
| **Community position on this player tonight** | `V2Chip` | Derivable once player-prop templates land | Sample-gated |
| **Personal accuracy on this player** | `V2FeatureMetric` | `iq_calls` grouped by `subject.player_id` | Sample-gated |
| **WHAT? WHY? SHOW ME entry** | `V2WhyPanel` (new) | Not yet present | See Section 9 |

**Data available now:** basic role/opportunity + personal accuracy.
**Provider-dependent:** market props, deep tracking metrics, custom reels.
**Do NOT build yet:** player prop UI without a Market feed.

---

## Section 6 — STATS / DEEP INTELLIGENCE

**Purpose.** Recognisable hockey stats at the surface; progressively deeper intelligence underneath.

| Slot | V2 primitive | Interim mount | Content |
|---|---|---|---|
| Screen frame | `V2Screen` inherited | `Stats`, `Scoreboard` | Reuse |
| Standings / team stats / player stats | `V2LeaderRow` inherited | Existing tables | Reuse |
| **IQ category filter chips** | `V2Chip` row | Not yet present | Filter tables by "categories Ticker IQ is watching" — only categories with real data appear |
| **Deep lens drill-through** | Deep-link into Team / Player IQ overlays | Existing routes | No new page |

**Data available now:** standings + core team/player stats.
**Provider-dependent:** filter categories that require Sportlogiq.
**Do NOT build yet:** a Hockey IQ analytics warehouse UI.

---

## Section 7 — RESULTS / PERSONAL LEARNING

**Purpose.** The retrospective loop. Where hockey turns into intelligence.

| Slot | V2 primitive | Interim mount | Content |
|---|---|---|---|
| Screen frame | `V2Screen` inherited | Segment inside `MyIQCommandCenter` today | Reuse |
| **Last Night** | `V2ResultCard` per question | Existing `LastNightStrip` pips | Reuse |
| **Recent Results** | `V2ResultCard` list | Derivable from `iq_calls` last 7d | Sample-gated |
| **By Category** | `V2FeatureMetric` grid | Extend `iq_user_insights` with `by_call_kind` + `by_template` breakouts | Backend addition planned (L.5) |
| **Strengths / Weaknesses** | `V2FeatureMetric` | Existing `iq_user_insights` (`high_confidence` insights) | Already implemented |
| **Calibration** | `V2FeatureMetric` (reliability curve) | Not yet present | Requires Go Deeper confidence capture |
| **Prediction vs Bet drift** | `V2ResultCard` split | Join `iq_calls` × `iq_wagers` × `iq_resolutions` | ≥ 25 wagered gate |
| **RECAP · IQ SEGMENT** | Beat inserted into `RecapShow` | Not yet present | What Ticker thought / Market thought / Community thought / You picked / Actual / What we learned. As-of-integrity enforced. |

**Data available now:** Last Night, Recent, By Category, Strengths.
**Provider-dependent:** Market column inside the Recap segment.
**Do NOT build yet:** a Hockey-IQ-only recap page — insert the beat into Main Ticker's Recap.

---

## Section 8 — MY BETS

**Purpose.** Optional personal wager tracking. Preserves prediction-vs-wager separation.

| Slot | V2 primitive | Interim mount | Content |
|---|---|---|---|
| Entry | Small `V2Chip` link (never a giant tile) | Existing `MyBetsLink` | Reuse |
| Wager list | `V2LeaderRow` derivative | Existing `BackOffice.jsx` (adult-gated) | Read from `iq_wagers` via `iq_calls` (new IQ path) — legacy `bet_log` stays read-only |
| **Price-taken vs closing** (CLV) | `V2FeatureMetric` | Not yet present | Requires Market feed + closing snapshots. |

**Data available now:** the ledger only (`iq_wagers` shape + legacy `bet_log`).
**Provider-dependent:** CLV, market price at time of pick.
**Do NOT build yet:** a full CLV analytics view without a Market feed. Do NOT let My Bets dominate primary navigation.

---

## Section 9 — CUSTOM ANALYTICAL REELS (FUTURE)

**The WHAT? → WHY? → SHOW ME principle.**

**Example:**
```
BOSTON POWER PLAY — entry performance declining          [WHAT]
  → controlled entries down 12% vs L20, denial rate up   [WHY]
  → Custom reel of the 14 relevant entry attempts        [SHOW ME]
```

**Design contract.**
- **WHAT** is a `V2ResultCard` derived from real underlying metrics (never a magic composite).
- **WHY** opens a `V2WhyPanel` (new V2 primitive proposal) exposing definition · inputs · sample · window · baseline · provider · freshness · confidence · null behaviour · supporting evidence.
- **SHOW ME** dispatches to **Main Ticker's Highlights / Reels machinery** with a filtered query. Hockey IQ does NOT build a second video engine.

**Data available now:** none of the reel construction is available — this depends on indexed video + rights + a query interface into the Highlights/Reels layer.
**Provider-dependent:** every ingredient (Sportlogiq events → video timestamps → rights-cleared clips → renderer).
**Do NOT build yet:** any part of this. Preserve the surface as a doorway on Game / Team / Player, wired to a stub route until the video machinery is real.

---

## Section 10 — Proposed FIRST reference screen

**Recommendation: build HOCKEY IQ HOME first — not Tonight, not My IQ.**

Reasoning:
1. **Home establishes the visual constitution for every subsequent surface.** If Home reads as "the finished Main Ticker V2 with intelligence turned on," we have found the architecture and every other Hockey IQ screen inherits.
2. **Home is genuinely unique.** Main Ticker's home is a broadcast home / recap show / team command centre. A Hockey IQ home is *the same person's* home when Hockey IQ mode is on — with today's card, last night's result, personal intelligence state, and a doorway into deep hockey intelligence. That composition does not exist anywhere in this fork.
3. **Home stresses the composition system, not any single screen's data.** Tonight's rail, Last Night, My IQ progress, host banter, Read triangle chip on each matchup, Intelligence rail entry — every V2 primitive from the constitution gets a workout on this one screen. If the grammar composes cleanly on Home, we know it will compose on Game / Team / Player.
4. **My IQ is a strong second choice**, but it's already been redesigned twice this session ("LOGOS. REGGIE. MARC. FUN.") and users have already seen it. Home is the fresh reference the design constitution needs.
5. **Tonight is a bad first choice.** Per Amendment §4, Tonight is shared hockey. Building "Hockey IQ Tonight" first re-creates the mistake of a parallel hockey universe.

**Constraints for the reference build (when approved):**
- Real V2 primitives only (once the primitive library ships). No interim mounts in the reference implementation.
- Only tier ✅ and 🟡 (derivable-now) data. No Market probabilities. No Sportlogiq metrics. Locked lenses hidden, not padlocked.
- Reggie + Marc as short two-voice banter, not a widget.
- ~390px iPhone width. Screenshots. STOP for review.
- No routes deleted. No old surfaces retired.

**What HOME must prove:**
- Same Ticker visual identity as Main Ticker V2.
- Immediate: "let's play" energy (the Home hero is the Tonight rail + PLAY pill).
- Honest empty states everywhere data isn't legitimate.
- Intelligence architecture visible without fabrication (`1 live · 9 pending providers` pattern).
- Personal state legible in one glance (streak / calls in book / accuracy once sample opens).

---

## Section 11 — Hard boundaries (unchanged)

- **No code from this design map.**
- No new Hockey IQ navigation (inherit Main Ticker V2 when it lands).
- No duplicate Ticker, no duplicate game / team / player databases.
- No fake Market data. No fake Sportlogiq analytics. No fake advanced ratings.
- No changes to Foundation 1A / 1B / 1C. No Atlas changes. No Special Teams engine implementation. No Team Navi changes.
- No deletion of existing Hockey IQ v2 surfaces (`TonightHero`, `GameRailV2`, `MatchupIntel`, `MatchupStats`) — they remain until the V2 reference screen ships and is approved.
- Preserve the working `iq_boards` backend, the `TonightsTenLoop`, the `MyIQCommandCenter`, and the `TickerProGame` proof.

---

**End of design map. No code. Awaiting approval on Section 10's first-screen recommendation.**
