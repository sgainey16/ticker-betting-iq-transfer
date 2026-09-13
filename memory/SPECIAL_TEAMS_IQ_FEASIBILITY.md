# SPECIAL TEAMS IQ — Feasibility & Architecture Audit

**Status:** Step 1 audit only. No code. No DB changes. No UI build.
**Frozen inputs:** Foundations 1A and 1B. 1C referenced but not modified.
**Boundary:** Betting IQ only. Not Fantasy, not Best Ticker Now, not Team Navi, not My IQ/Community.

**Rule of the day:** *Simple rating on top → complete evidence underneath. We earn the number before we display the number.*

---

## 0. TL;DR — Can we build Special Teams IQ today?

**No — not the deep tactical version. Yes — a first, honest, provenance-tiered v0.5.**

- **What we can build today** with existing providers: a team-level PP/PK efficiency layer with real trajectory (Last-1/3/5/10/Season), penalty-opportunity environment (drawn/taken tendency), and thin situational context (goalie start, empty-net exclusion) — all rated **team-only**, `attributed_observation` or `verified_fact` tier, no personnel-level claims.
- **What we cannot build today**: controlled zone entries, entry method, entry denial, slot/interior passes, cross-seam suppression, one-timer creation, shot quality per lane, high-danger creation/suppression, unit personnel (PP1/PP2/PK1/PK2), roles within units, retrieval, screens/tips — none of this exists in any provider currently wired.
- **The rating we can honestly ship first is an EFFICIENCY + OPPORTUNITY rating with a wide confidence band, not a "tactical Special Teams IQ."** The tactical version requires a tracking-data provider (Sportlogiq, Stathletes, or NHL EDGE) that is not yet contracted.

The rest of this document is the map to get there without inventing anything.

---

## 1. Current data inventory (what Betting IQ actually has today)

| Source | Wired module | Special-teams-relevant fields exposed today | Freshness |
|---|---|---|---|
| **NHL public API** (`api-web.nhle.com/v1`) | `nhl_pbp.py` | Play-by-play per game: `plays[]` with `typeDescKey` (`goal`, `shot-on-goal`, `missed-shot`, `blocked-shot`, `hit`, `giveaway`, `takeaway`, `faceoff`, `penalty`, `stoppage`), `situationCode` (encodes 5v5/PP/PK/EN), `xCoord/yCoord`, period, time-in-period, `eventOwnerTeamId`, `scoringPlayerId`, `assist1PlayerId`, `assist2PlayerId`, `shotType`. Currently the client **only parses goal events**; the rest is discarded. | Real-time during game, immutable postgame |
| **NHL public API** — gamecenter roster spots | `nhl_pbp.py::_build_name_map` | Skater roster on the sheet per game (playerId → name). No unit assignments. | Real-time |
| **SportsData.io** (`nhl_data.py`) | free tier | Standings only: Wins/Losses/OTL/Pct/ConfRank/DivRank. No PP%/PK%, no shots. | 5-min cache |
| **Sportradar NHL v7** (`sportradar_client.py`) | ⚠ trial-expired 403s; user asked to allow nulls | If active: league hierarchy, standings (with GF/GA), daily schedule, `seasons/{yr}/{type}/leaders.json` (18 categories including `powerplay_goals`, `shorthanded_goals`, `penalty_minutes` for players). No team-level PP%/PK% or event PBP is currently pulled by the client. Sportradar's fuller feeds (Play-By-Play, boxscore with team-level PP/PK) are available on higher tiers but the client **does not call those endpoints today**. | 5–30 min TTL |
| **Highlightly** (`highlightly_client.py`) | active | `get_match_stats(match_id)` → team `overallStatistics` flat map (whatever Highlightly ships per sport — typically shots, shots-on-target, corners for soccer; for hockey the coverage of PP/PK counts is provider-specific and currently untested from the codebase). Also team logos and highlight clips. Not event-level, not personnel. | Per-match |
| **Foundation 1A** (`iq_canonical_games`, `iq_canonical_teams`) | in-cluster Mongo, migrating to Atlas | Canonical game + team identity. Not stats. | Append-only |
| **Foundation 1B** (`iq_game_finals`) | same | Immutable postgame truth: `FinalScore`, per-team `shots_on_goal`, goalie counts (`shots_against`, `saves`, `goals_against`, `starter`, `toi_seconds`), correction versioning. `TeamGameFacts` explicitly reserves `power_play_opportunities`, `power_play_goals`, `penalty_minutes` **as `None` — 1B does not populate them today.** | Postgame, versioned |

**Bottom line on the inventory:** the NHL PBP feed is a much richer feed than the codebase is currently using. Every shot/penalty/faceoff/turnover event on the sheet is available — we just discard everything except goals. That is a substantial latent asset.

---

## 2. Input classification — every proposed Special Teams input, by feasibility

Legend: **A** = available now · **B** = reliably derivable now from what we already receive · **C** = expected from Sportlogiq (or another tracking-data vendor) · **D** = expected from Sportradar (higher tier than currently wired) · **E** = requires lineup/reporting/human context · **F** = not currently reliable

### 2.1 Power play

| Input | Class | Notes |
|---|---|---|
| PP goals for | **B** | NHL PBP: `situationCode` → PP + `typeDescKey=goal`. Currently unparsed. |
| PP opportunities | **B** | Derivable from NHL PBP penalty events (start of PP window) with expiry/overturn tracking. Non-trivial but honest. Alternative: **D** — Sportradar boxscore returns PP opps directly. |
| PP% | **B** | Once above two exist. |
| PP goals against (SHG conceded) | **B** | NHL PBP: shorthanded goal typed events. |
| Controlled entry success | **C** | Not in NHL PBP. Requires tracking data. |
| Entry method (carry / pass / dump / chip) | **C** | Tracking data. |
| Entry player | **C** | Tracking data. |
| Failed entries | **C** | Tracking data. |
| Time to establish offensive-zone setup | **C** | Tracking data. |
| Offensive-zone possession time (PP) | **C** | Tracking data (some approximations exist via manual event zones but with poor confidence). |
| Puck recoveries | **C** | Tracking data. |
| Shots for (PP) | **B** | NHL PBP: shots + `situationCode=PP`. |
| Shot locations (PP) | **B** | NHL PBP `xCoord/yCoord`, coordinate frame per NHL docs. |
| High-danger creation | **F today / C future** | Requires an accepted definition. Manual public-PBP "danger zone" approximations exist (rink-coordinate-based scoring-chance definitions), but they are proxies — never truly high-danger without shooter/passer trajectory, which is Sportlogiq/EDGE. Should not be labeled "high-danger" until we have real inputs. Can be honestly labeled "inner-slot shot share." |
| Slot / interior pass creation | **C** | Tracking data. |
| East-west passing | **C** | Tracking data. |
| Net-front creation, screens, tips, rebounds | **C** | Tracking data. Public PBP marks rebounds only implicitly. |
| One-timer creation | **C** | Tracking data (requires passer→shooter link). |
| Shot quality | **F today / C future** | Requires an accepted xG model. Public PBP xG is possible to compute in-house from coordinates + shot type, but that is Ticker inventing a model. Should not be shipped as "Ticker xG" without a rating audit. |
| Who drives each PP component | **C + E** | Tracking data + unit assignment. |

### 2.2 Penalty kill

| Input | Class | Notes |
|---|---|---|
| PK goals against | **B** | NHL PBP + `situationCode=PP` from opponent perspective. |
| Times shorthanded | **B** | Derivable from penalty events. |
| PK% | **B** | Once above exist. |
| Shorthanded goals for | **B** | NHL PBP `situationCode=SH` + goal. |
| Entry denial | **C** | Tracking data. |
| Controlled entries allowed | **C** | Tracking data. |
| Time before opponent PP setup | **C** | Tracking data. |
| Clear success / failed clears | **C** | Tracking data. |
| Recoveries | **C** | Tracking data. |
| Slot / net-front protection | **C** | Tracking data. |
| Cross-seam suppression | **C** | Tracking data. |
| One-timer suppression | **C** | Tracking data (requires passer→shooter). |
| High-danger suppression | **F today / C future** | Same caveat as PP high-danger. |
| Shot-quality suppression | **F today / C future** | Same xG caveat. |
| Goaltending behind the PK | **B partial** | Foundation 1B goalie counts + PBP `situationCode` filtering. Save-pct-on-PK is derivable per game. Sample sizes on PK are notoriously noisy and must be labeled `low_confidence` under ~50 shots against. |

### 2.3 Personnel (units)

| Input | Class | Notes |
|---|---|---|
| PP1 / PP2 / PK1 / PK2 assignment | **E** | Not in any wired feed. Two credible sources exist: (i) beat-reporter morning-skate posts (attributed_observation, human-in-loop), (ii) same-team recent-history TOI-on-ice from PBP shift data (NHL PBP exposes shifts; we can *reconstruct* who was on ice during PP windows and rank by PP TOI). Reconstruction is a Ticker inference — never a verified fact. |
| Player roles (entry carrier, distributor, primary shooter, flank/one-timer location, bumper, net-front, retrieval, PK pressure, PK lane responsibility) | **C** | Tracking data required to identify these roles credibly. |
| Scratches / injuries / returns / promotions / demotions | **E** | Beat reporter or provider transaction feed. Sportsdata.io injury feed is available on a higher tier than currently wired. NHL public API surfaces "scratches" per gamecenter (D partial). |
| Deployment changes (line combinations, PP unit changes) | **E** | Reporter observations at morning-skate / warmup. |
| Missing PP driver / missing PK player | **E → then B** | Once (E) lineup event is captured, presence/absence of a Ticker-known unit member is derivable. |

### 2.4 Penalty-opportunity environment

| Input | Class | Notes |
|---|---|---|
| Penalties drawn per game (team) | **B** | Aggregate from NHL PBP `penalty` events (attributed to drawing team). Note: some penalty events don't attribute the drawee cleanly — matched-minor calls need careful handling. |
| Penalties taken per game (team) | **B** | Same source. |
| Recent tendency (Last-N) | **B** | With per-game aggregation. |
| Opponent interaction (team A drawn rate × team B taken rate) | **B** | Simple product baseline; only honest as an *expected penalty count* prior, not a rating. |
| Referee crew tendency | **F today** | Sportradar and some third parties publish crew data; not currently wired. |
| Game state effect (score/period) on penalty tendency | **B** | Achievable but low signal; deferred. |

### 2.5 Time / trajectory

| Requirement | Class | Notes |
|---|---|---|
| Last-1 / 3 / 5 / 10 / Season roll-ups | **B** | Every input above that is A or B rolls up trivially once we store per-game facts. |
| EMERGING ↑ / STRENGTHENING ↑ / STABLE → / WEAKENING ↓ / REVERSING ↕ classification | **B** | Derivable from ordered game series. Must respect a minimum-sample gate before labeling (see §7). |
| As-of temporal correctness | **B** | Foundation 1B's dual-gate (`recorded_at <= as_of` AND `played_at_iso <= as_of`) covers game facts. Lineup/goalie/scratches events must live in 1C's `PregameContextEvent` stream to inherit the same integrity. |

---

## 3. Proposed canonical event model — one event, many levels

To satisfy the "player → unit → team → matchup" architectural requirement, we do **not** invent a new event schema. We extend Foundation 1C's `PregameContextEvent` primitive and add ONE new post-play collection that mirrors its provenance shape.

### 3.1 New collection: `iq_special_teams_events` (postgame, append-only)

Purpose: capture the minimum-viable, provenance-tiered slice of NHL PBP that Special Teams IQ needs, without cross-cutting 1A/1B.

```
iq_special_teams_events {
  id                    : uuid
  ticker_game_id        : ticker_game_id           # 1A canonical
  event_seq             : int                       # provider event ordering, monotonic per game
  period                : int
  time_in_period_sec    : int
  strength_state        : "5v5"|"5v4"|"4v5"|"5v3"|"3v5"|"4v4"|"3v3"|"EN"|"unknown"
  event_type            : "penalty"|"pp_shot"|"pp_goal"|"pk_shot"|"pk_goal_against"|"pk_clear"|"faceoff_pp"|"faceoff_pk"|...
  for_team_id           : ticker_team_id
  against_team_id       : ticker_team_id
  coord                 : { x: float, y: float } | null    # NHL rink coords, only when native
  actor_player_id       : ticker_player_id | null           # resolved when identity is stable
  assist_player_ids     : [ticker_player_id] | null
  goalie_player_id      : ticker_player_id | null
  raw                   : object                           # the raw provider event, verbatim, immutable
  provenance            : Provenance                       # 1A shape (source_provider, ingested_at, source_row_id, etc.)
  trust_tier            : "verified_fact"                  # PBP events from NHL public API are verified_fact
}
```

Notes:
- **Append-only** with the same correction-via-supersede pattern Foundation 1B uses. A late correction becomes a new row referencing the prior via `supersedes_event_id`.
- **Trust tier is fixed at `verified_fact`** for events sourced directly from NHL PBP. Any Ticker-derived aggregation (e.g. "pp_5v4_shot_share") is an *inference* and lives in a separate `iq_special_teams_projections` view — not in this collection.
- No coordinates from tracking providers here — those would live in a future `iq_tracking_events` collection with distinct trust and provenance rules.

### 3.2 Player → unit → team → matchup wiring

The same event supports every level:

```
event.actor_player_id          → PLAYER-level roll-up
    ↳ (unit membership map from 1C)   → UNIT-level roll-up (PP1/PP2/PK1/PK2)
       ↳ for_team_id                  → TEAM-level roll-up
          ↳ for_team_id × against_team_id → MATCHUP-level projection
```

Unit membership is not stored on the event. It is a **projection layer**: a function of `(actor_player_id, on_ice_shift_at_event_time)` → unit label, driven by shift data (also in NHL PBP under `shifts[]`) and 1C's lineup events. Unit labels are always inferences, never facts, so downstream ratings can carry their true confidence.

### 3.3 What we do NOT do

- We do not fold PP/PK counts back into 1B `TeamGameFacts`. 1B stays frozen. PP/PK totals are derived at read time from `iq_special_teams_events`.
- We do not resolve skater identity in the event write path unless the player is in `iq_canonical_players` (which does not exist yet). Until then, `actor_player_id` is `null` and events carry the provider raw ID inside `raw` for future resolution.

---

## 4. Special Teams component tree

**Do not read this as a shipping spec.** This is the components landscape. Which components ship in v0.5 is a §5/§6 decision, gated on real inputs.

```
SPECIAL TEAMS IQ (team, tonight)
├── PP QUALITY
│   ├── Efficiency
│   │   ├── PP%                         (B — postgame roll-up)
│   │   ├── PP shot rate (per 60s PP)    (B)
│   │   └── PP goals per shot            (B)
│   ├── Creation
│   │   ├── Inner-slot shot share        (B, honestly labeled — not "high-danger")
│   │   ├── One-timer creation           (C — Sportlogiq)
│   │   ├── East-west pass rate          (C)
│   │   └── Net-front presence           (C)
│   ├── Entry
│   │   ├── Controlled entry share       (C)
│   │   ├── Entry method mix             (C)
│   │   └── Time to setup                (C)
│   ├── Personnel (PP1)
│   │   ├── Unit membership              (E → reconstructable inference; low confidence)
│   │   ├── Missing driver flag          (E, once known)
│   │   └── Role gaps                    (C — role identification requires tracking)
│   └── Trajectory
│       └── Last-1/3/5/10/Season class   (B, gated on sample)
│
├── PK QUALITY
│   ├── Suppression
│   │   ├── PK%                          (B)
│   │   ├── PK shots-against rate        (B)
│   │   └── PK goals against per shot    (B)
│   ├── Denial
│   │   ├── Controlled entries allowed   (C)
│   │   └── Entry denial rate            (C)
│   ├── Structure
│   │   ├── Clear success                (C)
│   │   ├── Slot protection              (C)
│   │   └── Cross-seam suppression       (C)
│   ├── Personnel (PK1)
│   │   ├── Unit membership              (E)
│   │   └── Key PKer availability        (E)
│   ├── Goaltending behind the PK
│   │   └── PK save % (last-N, low-conf) (B, always flagged low-conf)
│   └── Trajectory
│       └── Last-1/3/5/10/Season class   (B)
│
├── EXPECTED OPPORTUNITY (tonight)
│   ├── Team A penalties drawn rate      (B)
│   ├── Team B penalties taken rate      (B)
│   ├── Referee tendency                 (F today — not wired)
│   └── Score-state adjustment           (B, low priority)
│
└── MATCHUP INTERACTION
    ├── PP-A vs PK-B efficiency delta    (B, once PP% and PK% land)
    ├── Personnel-adjusted delta         (E, once unit availability lands)
    ├── Tactical collision               (C — requires tracking on both sides)
    └── Confidence composition           (§7 rules)
```

---

## 5. Rating architecture — how a number gets earned (no arbitrary weights yet)

The document's absolute rating rule: **before any rating exists, every component needs definition, inputs, calculation, sample, comparison baseline, time window, provenance, availability, confidence, and null behavior.** This section is the mechanism, not the numbers.

### 5.1 A component spec is a struct, not a formula

Each component (say, `pp_efficiency`) is defined as:

```
ComponentSpec {
  key                 : "pp_efficiency"
  definition          : "PP goals scored per PP opportunity, at 5v4 strength state only"
  inputs              : [
      { field: "pp_goals_5v4",   source: "iq_special_teams_events", derivation: "count where event_type='pp_goal' AND strength_state='5v4'" },
      { field: "pp_opps_5v4",    source: "iq_special_teams_events", derivation: "count of PP windows opened at 5v4 (documented algorithm §5.2)" }
  ]
  formula             : "pp_goals_5v4 / pp_opps_5v4"
  window              : "Last-N" | "Season"     # multiple windows produce multiple values
  min_sample          : { opportunities: 12 }    # below this, the component returns null and confidence.low_sample=true
  baseline            : "league_median_same_window"    # each component ships with a documented baseline for standardization
  provenance_of_value : composed from provenance of every input event
  trust_tier_ceiling  : "verified_fact"
  null_behavior       : "return null; do NOT impute; do NOT default to baseline"
}
```

### 5.2 A rating is a *documented composition of component specs*

There is no free-floating "0-100 formula." A rating is a named recipe:

```
RatingRecipe {
  name                : "pp_quality_v0"
  version             : "0.5"
  window              : "season_with_last_3_overlay"
  components_used     : ["pp_efficiency", "pp_shot_rate", "pp_goals_per_shot"]
  standardization     : "z-score vs league_median per component per window"
  aggregation         : "documented — either equal-weight, or explicitly declared weights approved by product"
  presentation_scale  : "0-100, monotonic transform of aggregated z-score, published band edges (e.g. 40-60 = league-average)"
  confidence          : composed from component confidences (§7)
  as_of               : timestamp used
  evidence            : list of contributing events + component values, retrievable for WHY?
}
```

A user tapping WHY? on `PP QUALITY 68` gets:
- the RatingRecipe (`pp_quality_v0`),
- the component values that fed it (efficiency, shot rate, goals-per-shot),
- the input events that fed each component,
- the sample sizes and confidence flags,
- and, for personnel-affected ratings, the unit-availability inferences and their sources.

This is what "we earn the number before we display the number" means in engineering terms.

### 5.3 v0.5 shippable rating (honest, thin)

Given today's inventory, the only rating recipe we can honestly compose is a **`pp_quality_thin_v0`** and **`pk_quality_thin_v0`** using efficiency + shot rate + goals-per-shot at the correct strength states, with:

- explicit `TRUST TIER = verified_fact` (all inputs are PBP verified),
- explicit `PERSONNEL = not_incorporated`,
- explicit `TACTICAL = not_incorporated` on the WHY? panel,
- a wide confidence band (§7).

Anything beyond that requires tracking data or lineup events. The rating card must visibly say so.

### 5.4 What we NEVER do

- No hidden weights.
- No composite score that mixes tiers (verified + inferred) without carrying the ceiling.
- No 0-100 that reads as "Ticker's opinion" when it's actually league z-score.
- No component that can grow in influence when its confidence is low.

---

## 6. As-of model — how the 3:30 PM rating cannot see the 6:40 PM goalie confirmation

The rule is inherited unchanged from 1B and 1C.

- Every event in `iq_special_teams_events` carries `played_at_iso` (or event time) AND `recorded_at`.
- Every lineup / scratches / goalie-confirmation event lives in `iq_pregame_context_events` (1C) with `source_time_iso` AND `recorded_at`.
- A projection at `as_of = T` includes an event only if BOTH `source_time_iso <= T` (where meaningful) AND `recorded_at <= T`.

Practically:
- The **3:30 PM Special Teams IQ read** aggregates PBP events with `played_at_iso <= 3:30 PM` (i.e. previous completed games only) and 1C context events with `recorded_at <= 3:30 PM`. If the goalie is not yet confirmed, the projection uses `presumed_starter` at `ticker_inference` tier and the rating card shows a `personnel = pending` label.
- The **6:40 PM read** re-runs the same projection with `as_of = 6:40 PM`. The confirmed goalie event now qualifies. The rating value may change; the previous 3:30 PM read is preserved (snapshotted), never overwritten. Both are queryable for audit.

**Nothing in this file changes the 1A/1B contract.** The event stream is additive, the projection layer is derived, and both the 3:30 and 6:40 values are byproducts of the same append-only history.

---

## 7. Null / uncertainty model — missing data lowers specificity, not truth

Rules that apply uniformly:

1. **A component with input below its `min_sample` returns `null`.** No imputation. No silent fallback to a broader window.
2. **A rating with any null component either (a) omits that component from aggregation and lowers the confidence, or (b) returns null itself if the rating's minimum coverage rule is not met.** The choice is documented per RatingRecipe.
3. **Confidence is a struct, not a scalar.**
   ```
   Confidence {
     level    : "high" | "medium" | "low" | "unusable"
     basis    : ["sample_size_ok"|"low_sample"|"personnel_confirmed"|"personnel_inferred"|"tracking_absent"|"one_provider_only"|...]
     ceiling  : trust_tier                              # inherited from inputs
     window   : window key
     sample   : documented sample counters
   }
   ```
4. **Confidence composition inherits the weakest input tier.** A rating built on any `ticker_inference` cannot be presented as `verified_fact`, even if 80% of its inputs are.
5. **Presentation must reflect confidence.** A `low` confidence rating renders with:
   - a distinct visual state (dimmer number, wider "band" indicator, or a `LOW CONFIDENCE` chip),
   - a WHY? panel that opens directly on the missing-input list,
   - never a green "advantage" pill.

---

## 8. Worked hypothetical matchup (no fabricated real-world claims)

**Fictional teams A and B. All values below are placeholder shapes, NOT numbers to seed.**

```
TICKER MATCHUP · SPECIAL TEAMS IQ · fictional_A @ fictional_B
as_of = tip_time_minus_180min

TEAM A — PP QUALITY (thin_v0)
  window: season_with_last_3_overlay
  components:
    pp_efficiency        → value: <derived from A's iq_special_teams_events (season+last_3)>
                            sample: <opps_count>
                            baseline: league_median_same_window
                            confidence: derived_here
    pp_shot_rate         → value / sample / baseline / confidence
    pp_goals_per_shot    → value / sample / baseline / confidence
  personnel: not_incorporated (unit membership not persisted in v0.5)
  tactical: not_incorporated (no tracking provider wired)
  overall rating         → aggregated z-score per RatingRecipe, mapped to 0-100 band
  confidence             → composed: min(component confidences)

TEAM B — PK QUALITY (thin_v0)
  components:
    pk_suppression       → value / sample / baseline / confidence
    pk_shot_rate_against → value / sample / baseline / confidence
    pk_gaa_on_kill       → LOW_CONFIDENCE flag if shots-against < 50 in window
  personnel: not_incorporated
  tactical: not_incorporated
  overall rating         → aggregated, banded, with confidence band shown

EXPECTED OPPORTUNITY
  team_A_penalties_drawn_per_game_last_10   → sample_ok
  team_B_penalties_taken_per_game_last_10   → sample_ok
  expected_pp_windows_for_A                 → simple product baseline, honest label
  ref_crew_tendency                          → null (not wired)

MATCHUP INTERACTION
  pp_A_z_score minus pk_B_z_score           → delta with confidence band
  personnel_adjusted                        → null (no lineup events yet)
  tactical_collision                        → null (no tracking data)

RATING CARD (as it would render, no numbers seeded)
  SPECIAL TEAMS IQ — TONIGHT
  A  [rating]  B  [rating]
  A  [advantage/tie/disadvantage badge with confidence band]
  WHY? → opens component tree; every leaf shows sample size, source, trust tier
  MISSING: unit personnel, tracking data, ref crew — displayed openly
```

Every number in a real render must trace to real events. The point of this section is only to show the **shape** and prove that even the thin v0.5 rating cannot lie about what it is.

---

## 9. Tonight V3 integration path (no Tonight redesign now)

Tonight V3's `MatchupIntel` already has grammar hooks for a future intelligence layer:

- The **`READS ON THIS GAME`** section can host a `SPECIAL TEAMS` read line the moment `pp_quality_thin_v0`/`pk_quality_thin_v0` are calculable.
- Rendering rule: only render the read if BOTH teams have non-null ratings AND at least one team has confidence >= `medium`. Otherwise omit entirely (grammar exists for this today).
- The `WHAT'S WATCHING` section is where 1C personnel events (goalie confirmed, PP1 driver questionable) surface without pretending they've been priced in.
- Tapping the Special Teams read opens a sheet with the full component tree from §4 — this is the "WHY?" surface.

**No Tonight redesign is needed to receive Special Teams IQ.** Only two component contracts need to become real:

```
GET /api/iq/matchup/special-teams?ticker_game_id=...&as_of=<iso>
  → returns:
    {
      recipe: "pp_quality_thin_v0",
      version: "0.5",
      as_of: "...",
      teams: {
        home: { rating, band, components[], confidence, personnel, tactical },
        away: { rating, band, components[], confidence, personnel, tactical }
      },
      interaction: { delta, confidence, missing[] },
      evidence: { event_ids[], recipe_url }
    }
```

Rendering never asks the frontend to interpret trust tiers — the API returns explicit render hints (`omit` / `render_with_low_confidence` / `render_confident`).

---

## 10. Provider question list (send these before signing anything)

### Sportlogiq (or Stathletes / another tracking vendor)

1. Which tracking events are available at the play level: zone entry attempts, entry method (carry/pass/dump/chip), entry denial, controlled entry success flag, passer→shooter linkage, pass zones (slot/interior/east-west), net-front presence, screen/tip events, one-timer flag?
2. Are events time-stamped to game clock at ≤ 1s resolution? Do you emit `on_ice_player_ids` per event, or only shooter/passer?
3. Do you emit **PP-specific** and **PK-specific** event subsets (entries broken out by strength state), or is strength state a filterable field?
4. What is the standard delivery: real-time push (websocket/webhook), postgame batch (S3/API), or both? For postgame, what's the SLA from puck-drop to availability?
5. How are corrections handled? Is there a supersede/versioning field on events, or are files re-issued in bulk?
6. Do you publish a shot-quality / xG model? If yes, is the model output emitted per event, is the model documented, and are you willing to be cited as the source (verifiable_fact tier depends on this)?
7. What is your coverage of full-season and playoff schedule? Any gaps in a typical regular season?
8. Player ID stability: how are player IDs maintained across seasons? Do you map to NHL API player IDs or provide a mapping table?
9. Rate limits, retention (how far back can we backfill?), and pricing tier for the exact endpoints in questions 1–3.

### Sportradar (higher tier than currently wired)

1. On what NHL v7 tier does `pbp.json` per game unlock, and does it include: shot events with coordinates, penalty events with drawing/taking player IDs, faceoff events per zone/strength state, on-ice player IDs per event, and shift data?
2. Does the boxscore feed on that tier include team-level PP goals, PP opportunities, SHG, and PK save % broken out?
3. Does Sportradar publish a shot-quality/xG value per shot event at any tier?
4. Correction / late-data policy: how are events amended after ingest? Is there an event-level version or a game-level snapshot?
5. Are line combinations / power-play units published anywhere in your NHL product? If yes, at what cadence (morning, warmup, in-game)?
6. Is a referee crew feed available? If yes, with historical calls-per-game per crew?
7. Injury / roster status feed for NHL: cadence, source attribution, and correction policy?
8. Historical coverage (backfill window) for `pbp.json` and injury/roster on the target tier?
9. Latency SLA from live game event to feed availability, and any known gaps (blackouts, provider outages)?

### NHL (via the public NHL EDGE product, if applicable)

1. Does NHL EDGE publish tracking-quality event data (zone entries by method, shot-quality) to a data-partner tier, and what is the licensing path?
2. Is there any commercial contract that would allow us to cite EDGE-derived metrics as `verified_fact` with attribution?

### Beat-reporter / lineup context (Rotowire, DailyFaceoff, LineupTracker, similar)

1. Confirmed lines and PP/PK unit lineups: how are they timestamped, sourced, and attributed?
2. Delivery format: API / webhook / scraping ToS?
3. Correction/withdrawal handling when a reporter retracts a lineup post-warmup?

---

## 11. Absolute boundaries observed in this audit

- No modification to Foundation 1A / 1B / 1C.
- No new production code proposed here — only a schema sketch (§3.1) and an endpoint contract sketch (§9) for approval.
- No fabricated stats anywhere in the document.
- No provider capability claimed without evidence — Sportradar's higher-tier PBP capability is described as "expected" in the question list, not assumed.
- No rating formula assigned weights.
- No rating rendered without the provenance stack that earned it.

---

## 12. Recommendation — the smallest first step that is honest

If the goal is to prove the architecture on real data before spending on Sportlogiq/Sportradar upgrades:

1. **Extend `nhl_pbp.py` to parse all event types**, not just goals, into an in-memory shape aligned with §3.1. Read-only. No DB writes yet.
2. **Add a read-only projection**: `iq/special_teams/team/{code}?window=season|last_N&as_of=...` that computes PP%/PK% and shot rates on the fly from parsed PBP for a small set of games (say, last 30 days). No new collection yet.
3. **Compose the thin `pp_quality_thin_v0` / `pk_quality_thin_v0` recipe** from §5.3 against that projection. Publish provenance and confidence in the response.
4. **Wire only into Tonight V3's `READS ON THIS GAME` grammar** with the render-hint contract in §9. Omit when confidence is low.
5. **Only after the projection is stable and reviewed**, introduce `iq_special_teams_events` (§3.1) as the persistent collection so back-filling and correction versioning become possible.

This gives us a real Special Teams read on real data with zero fabrication and zero commitment to tracking-vendor spend, and it clarifies which provider question in §10 is worth paying to answer next.

---

**End of Step 1 audit. No code. No DB changes. Stop for approval.**
