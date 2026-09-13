# SPECIAL TEAMS IQ — Step 3 · Free NHL PBP + Shifts Baseline Implementation Plan

**Status:** Implementation plan only. No code. No DB writes. No UI. No composite ratings.
**Companions:** `/app/memory/SPECIAL_TEAMS_IQ_FEASIBILITY.md` (Step 1) · `/app/memory/SPECIAL_TEAMS_IQ_PROVIDER_MATRIX.md` (Step 2).
**Scope:** Betting IQ · Special Teams IQ · free baseline layer ONLY.
**Boundary observed:** Foundations 1A/1B unmodified. 1C architecture unmodified. Atlas untouched. Tonight UI unchanged. No fabricated stats. No Special Teams IQ composite score. Player attribution preserved throughout. Sportlogiq remains **leading candidate / NEEDS PROVIDER CONFIRMATION**; Sportradar retained in the broader intelligence architecture for event/context data even if not the tracking engine.

**Non-negotiable rule of this build:** raw events → normalized derived facts → windowed projections → *(stop here for Step 3)*. Ratings and composite scores come later, only after every downstream number can trace back to its evidence.

---

## 0. Executive summary

Public NHL PBP + Shift Charts already contain enough information for a trustworthy team-level Special Teams *fact* layer with real player attribution, strength-state correctness, and dual-gate `as_of` integrity — provided we (a) persist the raw event stream verbatim, (b) normalize derivatives separately, and (c) never let inferences claim `verified_fact`. The plan below stands up that layer as an additive read-only path. Two new collections are proposed, both fully isolated from Foundations 1A/1B and both shaped to receive Sportlogiq (or any other future tracking-event vendor) as an additional source without schema replacement.

**No changes proposed to any frozen foundation.** Compatibility statement in §14.

---

## 1. Which NHL PBP event types are currently discarded

Confirmed by inspection of `/app/backend/nhl_pbp.py`: the code fetches `https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play` and iterates `plays[]`, keeping only rows where `typeDescKey == "goal"`. Every other event type on the feed is discarded before persistence.

Event types actually present on that feed that we are throwing away today:

| typeDescKey | What we currently do | What it carries that we need |
|---|---|---|
| `shot-on-goal` | discarded | shooter, goalie, `xCoord`/`yCoord`, `shotType`, `situationCode`, `zoneCode`, event time |
| `missed-shot` | discarded | shooter, `xCoord`/`yCoord`, `situationCode`, `zoneCode` |
| `blocked-shot` | discarded | shooter, blocker, `xCoord`/`yCoord`, `situationCode`, `zoneCode` |
| `penalty` | discarded | committed-by, drawn-by, served-by, `descKey`, `duration`, `situationCode`, `zoneCode` |
| `faceoff` | discarded | winning-player, losing-player, `zoneCode`, `situationCode` |
| `giveaway` | discarded | player, `zoneCode`, `situationCode` |
| `takeaway` | discarded | player, `zoneCode`, `situationCode` |
| `hit` | discarded | hitter, hittee, `zoneCode`, `situationCode` |
| `stoppage` | discarded | reason (`descKey`) — needed for pulled-goalie / delayed-penalty edge handling |
| `period-start`, `period-end`, `game-end` | discarded | period boundaries — needed for strength-state timeline reconstruction |
| `delayed-penalty` | discarded | trigger for delayed-penalty strength state (§7) |
| `shootout-complete` | discarded | terminates the game timeline |

Plus the following event-agnostic top-level fields we currently do not persist:
- `rosterSpots[]` (per-game roster: playerId, position, team, sweater number, name) — used today only to build a `name_map` for goal parsing, then discarded.
- `homeTeam` / `awayTeam` blocks (team IDs, abbreviations) — used only for the goal-team map.
- Game-level metadata: `id`, `season`, `gameType`, `gameDate`, `venue`, `startTimeUTC`, official crew if present.

---

## 2. Which events (and fields) should now be persisted/normalized

Two layers:

**Layer 1 — RAW: `iq_pbp_events_raw`** (append-only, source-verbatim). One row per NHL PBP play. This layer is our source of truth from the NHL public API. We never derive anything into it. If NHL changes a field, we still have the raw record.

Fields per row:
- `id` (uuid, ours)
- `ticker_game_id` (from Foundation 1A canonical resolver — never made up)
- `provider_source_id` = "nhl_public_pbp"
- `provider_event_uid` = concat of NHL `gameId` + `eventId` (stable across re-fetches)
- `event_seq` (monotonic per game)
- `period`, `period_type` (`REG`|`OT`|`SO`)
- `time_in_period_sec` (int; convert from `MM:SS`)
- `event_type` (verbatim `typeDescKey`)
- `situation_code_raw` (verbatim 4-digit string)
- `zone_code` (`O`/`N`/`D` verbatim)
- `coord_x`, `coord_y` (verbatim floats; NHL rink frame)
- `event_owner_team_id_nhl` (verbatim int)
- `details_raw` (verbatim JSON object)
- `roster_spots_raw` (once per game; stored on game header — see §5)
- `source_time_iso` = NHL-published event time when available, else `played_at_iso` reconstructed from period + time-in-period (§8)
- `recorded_at_iso` = server_now() at ingest
- `provenance` = Foundation-1A-shaped provenance block (source_provider, source_row_id = `provider_event_uid`, ingested_at, correction_of = null)
- `trust_tier` = `"verified_fact"` (NHL public PBP is our reference for facts)

**Layer 2 — NORMALIZED: `iq_pbp_events_norm`** (append-only, additive). One row per raw event, with our derived fields alongside the raw pointer. This layer is inspectable, replaceable, and reproducible from Layer 1.

Fields per row:
- `id` (uuid), `ticker_game_id`
- `raw_event_id` (ref to Layer 1)
- `event_type` (canonical vocabulary, see §4)
- `event_time_sec_from_period_start`, `period`, `absolute_game_sec` (§8)
- `strength_state` (`5v5`|`5v4`|`4v5`|`5v3`|`3v5`|`4v4`|`3v3`|`6v5_EN`|`5v6_EN`|`delayed_penalty_home`|`delayed_penalty_away`|`unknown`)
- `strength_state_confidence` (`derived_from_code`|`derived_from_penalty_window`|`unknown`)
- `for_team_id` (Ticker canonical team id, resolved via 1A)
- `against_team_id` (Ticker canonical team id, resolved via 1A)
- `actor_player_id` (nullable; NHL playerId until we have `iq_canonical_players` — see §11)
- `secondary_actor_player_id` (nullable; e.g. drawnBy, blocker, hittee, assist1)
- `tertiary_actor_player_id` (nullable; e.g. assist2, servedBy)
- `goalie_player_id` (nullable; when relevant)
- `coord` (`{x, y}` in NHL frame, verbatim; nullable)
- `zone` (`O`/`N`/`D` verbatim; nullable)
- `shot_type` (verbatim; nullable)
- `on_ice_home_player_ids` (list, nullable; populated by the shifts-intersection step in §6)
- `on_ice_away_player_ids` (list, nullable; same)
- `on_ice_confidence` (`shift_intersect_ok`|`shift_intersect_partial`|`shifts_unavailable`)
- `provenance` (mirrors Layer 1 + a `derivation_ref` string identifying the derivation version)
- `trust_tier` (default `verified_fact` for canonical event mappings that are strictly relabelings; `ticker_inference` for anything derived — e.g. on-ice reconstruction, strength state derived from a penalty window when the situation code was ambiguous)

**Why two layers.** The raw layer protects our right to be wrong about derivations. Every derived field can be re-computed if we improve the derivation logic — without ever losing the source-truth stream. This is how Foundation 1B keeps its immutability guarantees and we adopt the same pattern.

---

## 3. What NHL Shifts adds

Endpoint: `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={gameId}` (note: **different subdomain** — `api.nhle.com` for the stats REST API, not `api-web.nhle.com`).

Per-player, per-shift records per game: `playerId`, `teamAbbrev`, `period`, `startTime`, `endTime` (in `MM:SS`), `duration`, `shiftNumber`, `hexValue` (color), plus goalie-specific rows.

New collection: `iq_player_shifts_raw` (append-only) — one row per shift.

Fields:
- `id`, `ticker_game_id`
- `provider_source_id` = `"nhl_stats_shiftcharts"`
- `player_id_nhl`, `player_ticker_id` (nullable; §11)
- `team_id_ticker`
- `period`, `shift_number`
- `start_sec_from_period_start`, `end_sec_from_period_start`
- `absolute_start_game_sec`, `absolute_end_game_sec`
- `provenance`
- `trust_tier` = `"verified_fact"`

What shifts unlock (with honest confidence bounds):
- **On-ice reconstruction at any event time** — intersect shift intervals with `absolute_game_sec` of an event. Confidence `shift_intersect_ok` when we get exactly the expected count for the derived strength state (e.g. 5v4 → 5 home skaters + 4 away skaters + both goalies on-ice unless empty net). Confidence `shift_intersect_partial` when counts are off by ±1 (common near shift boundaries — this is a real edge case, not a bug).
- **PP TOI and PK TOI per player per game** — sum of shift-time intersected with PP or PK windows for the player's team. Enables per-player Last-N unit-membership reconstruction (a `ticker_inference`, never a fact).
- **PP unit reconstruction (weak)** — rank players on a team by 5v4 TOI to identify "top 5 PP TOI" as an inferred PP1. Documented as low-confidence pregame; medium-confidence postgame.

Shifts do **not** unlock: on-ice player list DURING a shift's ambiguous edge, individual event attribution, entry method, pass classification, or anything Sportlogiq-only.

---

## 4. Canonical event vocabulary — provider-neutral

Layer 2 uses a canonical vocabulary so that Sportlogiq (or any future tracking vendor) can add events to `iq_pbp_events_norm`-shape rows without redefining primitives. The mapping is stored as data (a small mapping table, not code), so a new provider is a new mapping row, not a new schema.

Canonical `event_type` values in Step 3:

| Canonical | Source | Notes |
|---|---|---|
| `goal` | NHL `goal` | Also emitted for shootout with `period_type == "SO"` (excluded from most windows) |
| `shot_on_goal` | NHL `shot-on-goal` | |
| `shot_missed` | NHL `missed-shot` | |
| `shot_blocked` | NHL `blocked-shot` | Shooter and blocker both attributed |
| `penalty_taken` | NHL `penalty` (from taker perspective) | `for_team_id` = drawing team; `against_team_id` = penalized team |
| `faceoff` | NHL `faceoff` | Winner and loser preserved |
| `giveaway` | NHL `giveaway` | Actor is the giver; `for_team_id` = opposing team |
| `takeaway` | NHL `takeaway` | Actor is the taker |
| `hit` | NHL `hit` | Hitter as actor, hittee as secondary |
| `stoppage` | NHL `stoppage` | Retained for period-time reconstruction and pulled-goalie edges |
| `delayed_penalty_signaled` | NHL `delayed-penalty` | Triggers §7 delayed-penalty state |
| `period_start`, `period_end`, `game_end` | corresponding NHL types | Timeline anchors |

Canonical `event_type` values that Sportlogiq (or another tracking vendor) could later contribute WITHOUT schema change: `zone_entry`, `zone_entry_denial`, `pass`, `cross_seam_pass`, `one_timer_attempt`, `net_front_presence`, `retrieval`, `pk_clear`, `pk_clear_failed`, `forecheck_pressure_event`. These are placeholders in the vocabulary spec, **not** rows we invent from PBP.

---

## 5. How events attach to game / team / player / on-ice group

**Game.** `ticker_game_id` is resolved via Foundation 1A's canonical resolver from `(nhl_game_id, played_at)`. Never invented. If the resolver returns null (unknown / pre-canonical game), the event is not ingested — logged and quarantined. Foundation 1A stays untouched.

**Team.** `for_team_id` / `against_team_id` are resolved via Foundation 1A's team resolver from NHL team ID or abbrev. Same not-invented rule.

**Player.** NHL playerId is stored on every event as `actor_player_id_nhl`. `actor_player_id_ticker` is set to `null` until a future `iq_canonical_players` collection exists (out of scope for this step). Two consequences:
1. Player-attributed rollups today are **provider-ID-scoped**. They are honest (we count what NHL says) but not yet Ticker-canonical. This is fine and documented.
2. When `iq_canonical_players` lands, a batch pass fills in `actor_player_id_ticker` on historical rows. No event rewrites are required — this is a nullable additive field.

**On-ice group.** Populated only when shifts are available for that game. When they are, we run the shift-intersect step (§6) and store `on_ice_home_player_ids` / `on_ice_away_player_ids`. When shifts are missing, we leave both null and set `on_ice_confidence = "shifts_unavailable"`. The rating layer treats null on-ice as "personnel-neutral, low confidence" — never guesses.

**Unit membership.** *Not* stored on the event. It is a projection at read time from Last-N shift-derived TOI (§9). Unit labels are always inferences.

---

## 6. How PP/PK state is determined

**Two independent methods, cross-checked.**

**Method A — Direct decode of `situationCode`.** NHL emits a 4-digit code per event: [home_goalie count, home_skaters count, away_skaters count, away_goalie count]. Deterministic mapping to strength state on the ice at that event. This method is fast and correct when the code is well-formed and both goalies are on ice.

Handled outputs:
- `1551` → 5v5 (EV)
- `1541` → home PP 5v4; from away perspective, PK
- `1451` → away PP 5v4
- `1531`, `1351` → 5v3
- `1441`, `1541`, mixes → 4v4 / 3v3 / etc.
- `0561`, `1650`, etc. → empty-net variants; encoded as `6v5_EN` / `5v6_EN`

**Method B — Penalty-window timeline.** Build an in-memory timeline per game from `penalty` and `stoppage` and `goal` events:
1. Start with 5v5 at each period start.
2. On `penalty_taken` with `duration >= 2` and not `major` / `misconduct` / `match`: open a PP window at the drawing team's side for `duration`, unless it is offset by a simultaneous opposing minor (coincidental), in which case both cancel and no window opens (4v4 result — see §7).
3. On PP-goal against a minor penalty: close that specific minor early. Majors are served in full regardless of goals.
4. On period-end during an active PP: the remainder carries into the next period.
5. Delayed-penalty signaled: emit a `delayed_penalty_home|away` window that ends when possession changes or the penalty is called; during this window the offended team may pull the goalie → `6v5_EN`-adjacent.

Method B is authoritative in the timeline domain. The comparison against Method A produces `strength_state_confidence`:
- Both agree → `derived_from_code`, full confidence.
- Method A missing (bad code) but Method B unambiguous → `derived_from_penalty_window`, medium confidence.
- Both disagree → `unknown`, event flagged for review (rare — logs to a QA endpoint, never silently overridden).

**Why both.** Method A alone fails on empty nets and coincidental penalty edges. Method B alone fails when providers publish overturned penalties as retracted events without perfect ordering. Together they cover the edge cases in §7 honestly.

---

## 7. Strength-state edge cases (explicit handling rules)

| Case | Rule |
|---|---|
| **Coincidental matched minors** | Two simultaneous minors on opposite teams cancel; strength drops from 5v5 to 4v4 for the full duration, no PP window opens for either team. Neither team receives a `PP opportunity`. |
| **Coincidental unmatched minors (double minor + minor)** | The extra minor still creates a PP window at the differential. E.g. Team A gets double minor + Team B gets minor → Team B on PP 5v4 for the differential. |
| **4v4 → any additional minor** | Additional minor drops to 4v3 → strength state `4v3` in Layer 2; opportunity is a "PP" but on 4v4 base, which affects how PP shot rate is normalized (per 60 s of PP time, calculated from the actual differential window). |
| **3v3 OT** | Regular-season OT is 3v3. Any minor drops opponent to `3v4` for the offender's team — treated as a PP opportunity for the other team even in OT. Playoff OT is 5v5 and follows regulation rules. |
| **Delayed penalty** | Between `delayed-penalty` signal and the call whistle: strength state is `delayed_penalty_home` or `delayed_penalty_away`. If the offended team pulls its goalie, code goes to `6v5_EN`-adjacent. Any goal during this state counts to the offended team AND the delayed penalty is not served. This window is real but rare and is preserved in the timeline. |
| **Empty net (pulled goalie, no penalty)** | End-of-game goalie pull → `6v5_EN` or `5v6_EN`. Not a PP; do not count as PP opportunity. Goals in this state are recorded but not PP goals. |
| **Overturned penalty (challenge / on-ice reversal)** | NHL emits a stoppage / description-key indicating the reversal. The PP window is retracted from the timeline; the raw penalty event stays in Layer 1 but the Layer 2 normalized flag `penalty_retracted = true` prevents it from counting toward opportunities. |
| **Major penalty** | 5-minute PP; not shortened by goals. Own opportunity; own shot-rate window. Counted separately from minor opportunities. |
| **Misconduct / game misconduct** | No strength effect (a team-mate serves). Not a PP opportunity. |
| **Match penalty** | Ejection + 5-minute major served by a team-mate. Treated as a major PP opportunity. |
| **Bench minor** | Anyone eligible serves it. PP opportunity opens the same way as an on-ice minor. |
| **Penalty shot** | No strength change on the ice. Not a PP opportunity. Recorded as a distinct event. |
| **Shootout** | Excluded from all PP/PK aggregates. `period_type == "SO"` filter applied at every projection. |

Each rule above is a documented function in the projection layer (not a magic constant). QA tests in §12 exercise each row of this table with real historical games as fixtures.

---

## 8. Time & absolute game-second reconstruction

Every event carries `period` and `time_in_period_sec`. We compute `absolute_game_sec` as follows:

- Regulation game: `(period - 1) * 1200 + time_in_period_sec` for periods 1–3.
- OT: after regulation ends, `absolute_game_sec` = `3600 + time_in_ot_sec` (playoff periods 5-minute? actually 20-minute in playoffs — see next rule).
- Regular-season OT is 5 minutes 3v3; period index = 4; length cap = 300 s.
- Playoff OT is 20-minute periods 5v5; period index = 4, 5, ...; length cap = 1200 s each.
- SO plays are period 5 (regular season) — excluded from windows by rule.

This is `played_at_iso` at seconds-precision within the game. **Foundation 1B's `played_at_iso` on the game-final row remains the game-end timestamp** — we do not compete with it; we just derive an event-time overlay for strength-state and as-of purposes.

---

## 9. Last-1 / 3 / 5 / 10 / Season projection design

**Projections read from Layer 2 (`iq_pbp_events_norm`) and shift data. They never write back to it.** Projections are versioned functions of the raw + normalized stream.

Projection API shape (returns data, not code):

```
ProjectionRequest {
  ticker_team_id : str
  window         : "last_1" | "last_3" | "last_5" | "last_10" | "season"
  as_of          : iso8601   # dual-gate applied
  strength_slice : "pp_5v4" | "pk_4v5" | "5v5" | "all_pp" | "all_pk" | ...
}
ProjectionResult {
  metrics_by_component : {
     pp_goals            : {value, sample, provenance, trust_tier, confidence},
     pp_shots_on_goal    : ...,
     pp_shot_attempts    : ...,
     pp_shots_in_inner_slot: {value, sample, trust_tier: "ticker_inference", proxy_label: "inner_slot_share"},
     pp_opps             : ...,
     pk_shots_against    : ...,
     pk_goals_against    : ...,
     penalties_taken     : ...,
     penalties_drawn     : ...,
     pp_toi_seconds      : ...,      # from shifts × window
     pk_toi_seconds      : ...,
     ...
  }
  windows_used          : list of ticker_game_ids contributing
  windows_excluded      : list of ticker_game_ids omitted with reason
  shift_availability    : "all_games" | "partial" | "none"
  as_of                 : echo
  version               : "special_teams_baseline_v0"
}
```

Rules:
- **`last_N` counts only** games where BOTH `played_at_iso <= as_of` AND `recorded_at <= as_of` for their 1B record. Games missing final truth are excluded and listed in `windows_excluded`.
- **Season** is the current season by Foundation 1A season identity, subject to the same dual-gate.
- **Minimum sample gates per component** are declared as data (e.g. `pp_opps >= 6` for PP% to be non-null in a `last_5` window). Below the gate: component returns `null`. No imputation. No silent widening to season.
- **Trajectory labels** (`EMERGING ↑` etc.) are a separate projection function over the ordered per-game series. Only assigned when the sample supports it. Not part of Step 3's numeric outputs (comes when we compose ratings).

**Player-level projections mirror the team projection shape**, keyed by `player_id_nhl` today (or `player_id_ticker` once available). The player projection uses the same raw stream — no separate aggregation pipeline. This is how "who created this team's number" stays answerable later.

---

## 10. As-of / time-leakage protection

We adopt Foundation 1B's dual-gate unchanged and apply it to every projection:

- Every event has `source_time_iso` (event-clock reconstructed via §8) AND `recorded_at_iso` (server ingest time).
- A projection at `as_of = T` filters:
  - `source_time_iso <= T` AND
  - `recorded_at_iso <= T`
- Shift rows follow the same rule with `absolute_end_game_sec` mapped to a wall-clock via the game's `played_at_iso`.
- Late data (an NHL correction re-ingested at 8:00 PM to a 3:00 PM game) becomes a new normalized row with `recorded_at_iso = 8:00 PM`. A projection with `as_of = 5:00 PM` does NOT see it. A projection with `as_of = 9:00 PM` does. Both remain queryable; neither overwrites the other.
- **Snapshotting.** For decision moments (e.g. tip-time), the projection is materialized into `iq_special_teams_snapshots` (see §11 for extensibility). Snapshots are append-only, immutable, and carry the `as_of` used. This is our audit trail against "the number changed after the fact."

Foundation 1B's temporal contract is not modified. This baseline **borrows the rule and applies it to a new stream**; 1B stays frozen.

---

## 11. Provenance / null / confidence rules

**Provenance** on every row:
- `source_provider` = `"nhl_public_pbp"` (raw) or `"nhl_stats_shifts"` (shifts) or `"ticker_derivation"` (normalized-only derivations)
- `source_row_id` = provider's stable id where available; else our `provider_event_uid`
- `ingested_at` = server timestamp
- `derivation_ref` (for Layer 2) = a version string identifying the derivation logic that produced this row (e.g. `"pbp_norm_v1"`)
- `correction_of` = pointer to a superseded row when applicable

**Trust tiers** (borrowed from 1C's vocabulary):
- `verified_fact` — a direct relabeling of the raw NHL event (a shot is a shot).
- `ticker_inference` — anything Ticker derives (strength state via penalty-window when the code was ambiguous, on-ice player list via shift intersection, inner-slot proxy, unit membership).
- No `attributed_observation` events in Step 3 — those live in 1C's `PregameContextEvent` stream (DailyFaceoff, Rotowire etc.) and are out of scope here.

**Confidence composition.** A metric's confidence is the min of its inputs' tiers:
- If any input is `ticker_inference`, the metric cannot be presented as `verified_fact`.
- If shift data was unavailable for a game contributing to a metric, that game contributes to the numerator/denominator but the metric's `on_ice_availability = "partial"` flag is raised.
- If `pp_opps` in a window is below the min-sample gate, the metric returns `null`. Consumers cannot request "just show me what you have" — they must ask for `include_below_sample = true` explicitly at the projection API, and the response labels each such value.

**Null behaviour is a first-class contract.** No metric ever imputes. No metric ever widens its own window silently. Null propagates.

---

## 12. How Sportlogiq (or any future tracking vendor) plugs in later — without schema replacement

Design invariants that make this work:

1. **Provider identity is a column, not a table.** `iq_pbp_events_raw.provider_source_id` accepts any string. A Sportlogiq raw stream lands in a new collection `iq_tracking_events_raw` with the same shape family (id, provider_source_id, provider_event_uid, ticker_game_id, coords, actor IDs, trust_tier). No changes to the NHL raw collection.
2. **Canonical event vocabulary is data, not code.** §4's list already reserves `zone_entry`, `pass`, `one_timer_attempt`, etc. When Sportlogiq begins delivering these, a mapping row is added — nothing existing changes.
3. **Layer 2 (`iq_pbp_events_norm`) accepts events sourced from multiple providers** (via a new `iq_stx_events_norm` if we want a single physical collection, or by cross-collection projections). The projection functions in §9 already take a `strength_slice` filter; adding a `data_source_filter` is additive.
4. **Player IDs are resolved through a shared `iq_canonical_players` layer** (not yet built). When it lands, both NHL PBP events and Sportlogiq events resolve to the same Ticker player identity. That is the join key that keeps "Player X was on the ice for this Sportlogiq entry" and "Player X was on the ice for this NHL PBP shot" in the same story.
5. **Confidence composition is a function of trust tiers, not source names.** A metric built from Sportlogiq's tracking-derived event stays `ticker_inference` unless Sportlogiq's licensed contract permits us to cite it as `verified_fact`. That is a §7 (Step 2) data-rights answer.
6. **Sportradar remains part of the broader architecture** for team-level canonical PP/PK box totals, referee crew (if licensed), and injury/roster feeds. It plugs in via the same provider-identity-as-column pattern into `iq_pbp_events_raw` if Sportradar's PBP is subscribed, or into `iq_pregame_context_events` (1C's collection) for context feeds. No schema replacement required.

---

## 13. Tests required before we trust the baseline

Every test is a pass/fail assertion against a known historical game or set of games. Tests are the exit criteria for Step 4 build acceptance.

**A. Ingest fidelity**
1. For a chosen historical game, the count of raw events by `typeDescKey` matches the count on the live NHL PBP endpoint at ingest time.
2. Re-fetching the same game and re-ingesting produces zero new rows (idempotent on `provider_event_uid`).
3. A simulated NHL correction (a modified re-fetch) creates a new normalized row with `correction_of` set to the prior; the raw layer preserves both.

**B. Strength state**
4. Method A and Method B agree on strength state for ≥ 99% of events in a 20-game sample. Disagreements are logged with the raw code + timeline snapshot for review.
5. Coincidental matched minors produce no PP opportunity for either team (asserted against a known fixture — e.g. games where both teams share simultaneous 2-min minors).
6. Double minors produce two contiguous PP windows unless a PP goal closes the first.
7. Delayed-penalty windows appear in the timeline for the correct duration on games with known delayed calls.
8. Empty-net states are never counted as PP opportunities.

**C. Shifts + on-ice reconstruction**
9. For a game with complete shift data, the on-ice count at any event equals the strength state's expected count (e.g. 5v4 → 5 home skaters + 4 away skaters when home has the PP; 5v3 → 5+3, etc.), within tolerance for shift-boundary jitter (`shift_intersect_partial` acceptable at boundaries).
10. Summed shift-time equals game elapsed time (approximately) — off-ice, ice-cleared, goalie pulls handled correctly.
11. PP TOI per player summed across a team equals total PP time on that team's PP windows.

**D. Attribution**
12. PP goal player IDs from Layer 1 match the goal event's `scoringPlayerId` verbatim.
13. Penalty drawn-by/committed-by IDs are stored on both raw and normalized rows and reconcile against the timeline used to compute opportunities.

**E. Projections**
14. `last_5` PP% for a given team on a given `as_of` uses exactly the 5 most recent games satisfying the dual-gate. Adding a later game does not retroactively change the earlier snapshot.
15. Min-sample gates return `null` (not zero) when unmet.
16. Season aggregate equals the sum of per-game facts across the season subject to the dual-gate.
17. Player-level PP goal count in a window equals the sum of goal events attributed to that player in that window at that strength.

**F. As-of leakage**
18. A projection at `as_of = T` never includes any event with `recorded_at_iso > T` or `source_time_iso > T`.
19. Re-computing an old snapshot with today's timestamp produces a numerically different (or explicitly identical) result — never silently the same.

**G. Rollback / correction**
20. A retracted penalty (per §7 rules) does not contribute to `pp_opps` in any window that includes it.
21. Overturned goal (rare) removes the goal from PP goal counts; raw layer preserves the original event.

Tests **A**, **B**, **D**, **E**, **F**, **G** are integration tests against captured historical fixtures. Tests **C** run against shift-endpoint data. All tests live under `/app/backend/tests/special_teams_baseline/` when we build; nothing runs today.

---

## 14. Compatibility statement — Foundation 1A / 1B / 1C

**Foundation 1A** (`iq_canonical_games`, `iq_canonical_teams`): READ-ONLY consumer. We resolve `ticker_game_id` and `ticker_team_id` from 1A. If 1A rejects an input, the ingest is quarantined — never invents an id. No writes to 1A.

**Foundation 1B** (`iq_game_finals`): READ-ONLY consumer for game finality (`played_at_iso`, `recorded_at`). The baseline **does not write to `iq_game_finals` and does not populate the reserved `power_play_opportunities` / `power_play_goals` / `penalty_minutes` fields** — 1B stays frozen with those explicitly `None`. Any question that asks "what were the PP goals in this game?" is answered by aggregating from `iq_pbp_events_norm`, not by writing into 1B. This is a deliberate separation.

**Foundation 1C** (`iq_pregame_context_events`, `iq_pregame_context_snapshots`): NOT MODIFIED. Personnel/lineup context (DailyFaceoff, injuries) will live in 1C when 1C ships. The baseline layer references 1C as a *future* provider of on-ice trust upgrades but does not implement or predate it.

**New collections proposed (all additive, no existing collection touched):**
- `iq_pbp_events_raw` (append-only source-truth)
- `iq_pbp_events_norm` (append-only Ticker-canonical)
- `iq_player_shifts_raw` (append-only)
- `iq_special_teams_snapshots` (append-only projection snapshots)
- (Not proposed here — deferred to a later step: `iq_canonical_players`. Nullable player Ticker IDs on events keep this deferral safe.)

**No foundation is at risk in this plan.** If any subsequent build request would require modifying 1A/1B, STOP and raise it separately — this plan does not.

---

## 15. Out of scope for Step 3 (explicit)

- No composite `SPECIAL TEAMS IQ 82` rating. Not even a placeholder.
- No `TICKER RATING` label on any component. Numbers are named after their evidence (`pp_goals_last_5`, `pk_shots_against_last_10`, etc.).
- No Tonight UI wiring. When ratings ship in a future step, they wire through the render-hint contract from Step 1 §9.
- No Sportlogiq simulation, mock events, or synthetic tracking data.
- No `xG`, no `high-danger` label. Only `inner_slot_share` proxy, honestly named.
- No premium composite scores, badges, or leaderboard-style displays.
- No changes to My IQ, Community, Fantasy, Best Ticker Now, Team Navi, voice engine, or Atlas workstream.

---

## 16. Proposed build order for Step 4 (when approved)

Every sub-step is small, individually testable, and revertable.

- **S4.1 — Raw ingest.** Extend `nhl_pbp.py` to parse all `typeDescKey` values into a shared normalized dict, still returning the goal shape unchanged for existing callers (backward-compatible). No DB writes yet.
- **S4.2 — Layer 1 collection.** Add `iq_pbp_events_raw` schema, indexes, and an idempotent upsert path. Backfill from S4.1 for a small historical window (e.g. 30 days).
- **S4.3 — Strength-state timeline.** Implement §6 Methods A + B and §7 edge-case rules as a pure function over Layer 1. Emit normalized rows into `iq_pbp_events_norm`. Unit-test coverage per §13.B.
- **S4.4 — Shifts ingest.** Wire the `stats.api.nhle.com` shift endpoint into `iq_player_shifts_raw`. Idempotent upsert.
- **S4.5 — On-ice reconstruction.** Implement the shift-intersect derivation, populate `on_ice_home_player_ids` / `on_ice_away_player_ids` / `on_ice_confidence` in Layer 2. Tests per §13.C.
- **S4.6 — Projection API (read-only).** Implement the `ProjectionRequest`/`ProjectionResult` contract per §9, backed by Layer 2 and shifts. No writes. Available at `GET /api/iq/special_teams/team/{code}?window=...&as_of=...&strength_slice=...`. Player-level mirror at `GET /api/iq/special_teams/player/{nhl_player_id}?...` follows the same shape.
- **S4.7 — Snapshot writer.** For requested `as_of` values (tip-time, +30 min, etc.), materialize projections into `iq_special_teams_snapshots`. Immutable, versioned.
- **S4.8 — QA endpoint.** A `/api/iq/special_teams/qa/strength_state_disagreements` route that surfaces §6 Method-A-vs-B disagreements for the last N days. Never public. Test-only.

None of this ships into Tonight UI in Step 4. UI integration is a separate approval.

---

**End of Step 3. No code. Awaiting approval.**

## Approval options

- **(i)** Approve the plan as written. Proceed to Step 4 build (raw ingest → Layer 2 → shifts → projections → snapshots → QA endpoint). No Tonight UI wiring.
- **(ii)** Approve with amendments — reply with the specific rules or edge cases you want tightened, and I revise the plan before any code.
- **(iii)** Approve **only Phases S4.1 through S4.3** (raw ingest + Layer 1 collection + strength-state normalization) as a minimum trust-establishment increment; hold shifts and projections until we see the strength-state disagreement rate in production data.
- **(iv)** Hold Step 4 pending the Sportlogiq/Sportradar conversation. Leave the plan on the shelf.
