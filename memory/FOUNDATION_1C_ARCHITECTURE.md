# FOUNDATION 1C — TIME-AWARE HOCKEY CONTEXT & MATCHUP STATE

**Status:** Architecture / audit only. No code. No DB changes.
**Frozen layers:** Foundations 1A and 1B are unmodified inputs.

The pregame job of 1C is to reconstruct, at any timestamp before a
game: **the hockey situation Ticker legitimately knew**, in enough
depth for a later signal layer to reason about matchup interactions
— not just aggregate trends.

Everything below is scaffolding. **Nothing in 1C predicts, weights, or
recommends.** It records, distinguishes, and projects.

---

## 0. Core architectural primitive

A single primitive underlies every field in the four dimensions the
brief called out (WHO / HOW / WHEN / CONTEXT):

**`PregameContextEvent`** — an append-only, timestamped, trust-tiered
proposition about a specific game. Every fact, observation, inference,
and superseding update is an event.

```
PregameContextEvent {
  id                        : uuid
  ticker_game_id            : ticker_game_id     # from 1A
  dimension                 : Dimension          # see §3
  subject                   : SubjectRef         # team | line | pair | player | goalie
  proposition               : PropositionShape   # dimension-specific typed payload
  trust_tier                : verified_fact | attributed_observation | ticker_inference
  source                    : SourceRef          # provider name / reporter handle / "ticker_engine"
  source_time_iso           : iso8601 | null     # WHEN THE SOURCE SAID IT
  recorded_at               : iso8601            # WHEN TICKER LEARNED IT (server_now())
  status                    : proposed | confirmed | contradicted | superseded | withdrawn | resolved
  supersedes_event_id       : uuid | null
  confidence                : { level: str, basis: str } | null
  provenance                : Provenance1C       # see §11
}
```

Everything else in 1C — trajectories, matchup collisions, snapshots,
views — is a *projection* over this stream. This is the shape that
makes the WHEN dimension honest: a projection at `as_of=T` filters the
stream by both `source_time_iso <= T` (where meaningful) and
`recorded_at <= T`.

**Why an event stream (not a wide row):** the user's own example — a
goalie expected at 12:00, player questionable at 3:00, lines observed
at 5:30, goalie confirmed at 6:40, late scratch at 6:55 — cannot be
faithfully represented in a single row. Each of those is an event with
its own source, source_time, and trust tier, and later events supersede
earlier ones without erasing them. The event log is the natural home
for that shape.

The one new collection 1C proposes is
**`iq_pregame_context_events`**. One collection for the stream, plus
one for point-in-time snapshots at decision moments (§14). No changes
to 1A or 1B.

---

## 1. Trust tiers (three, applied everywhere)

Every downstream field carries its `trust_tier` explicitly. Consumers
never see a raw value without knowing what class of knowledge it is.

| Tier | Definition | Examples |
|---|---|---|
| **verified_fact** | Provider-confirmed, machine-readable, unambiguous. | Final score (1B), schedule + status (1A), NHL confirmed goalie announcement, roster transaction from Sportsdata.io |
| **attributed_observation** | A named human/reporter observation with a source and source_time. | Beat reporter posts morning-skate lines, coach quote in press availability, credible warmup lineup photo |
| **ticker_inference** | Ticker's own derivation from lower-tier inputs. | `presumed_starter` from Last-3, `form_vs_baseline`, `matchup_collision.interaction_sign`, `fatigue_risk` |

**Rule:** an inference's tier is capped by the weakest input. An
inference built from an attributed observation cannot claim
`verified_fact`. This is enforced at the projection layer, not at
storage.

---

## 2. WHO — the four-tier hierarchy

Subjects that events can attach to:

```
SubjectRef =
  | TeamRef(ticker_team_id)
  | LineRef(ticker_team_id, line_id_or_signature)      # F1/F2/F3/F4 or set-of-player-ids
  | PairRef(ticker_team_id, pair_id_or_signature)      # D-pair
  | PlayerRef(ticker_player_id | provider_player_id)   # 1A player id if resolved; otherwise provider fallback
  | GoalieRef(same shape as PlayerRef)
```

1B currently only resolves goalie identity (via `provider_player_id_nhl`
on GoalieLine, `ticker_player_id` null pending a goalie resolver). 1A
has `ticker_player_id` minted only if/when a resolver is wired.

**Consequence for 1C:** LineRef and PairRef are architected but will
start empty — they populate only when a lineup poller or Sportlogiq
feed is added. That's fine; the schema anticipates them so a later
foundation can turn them on without a migration.

---

## 3. HOW — tactical matchup representation (collisions, not rankings)

The essential object is the **interaction** between two team stances
on a shared hockey dimension. Never a scalar. Never a ranking.

### 3.1 Dimensions in scope for 1C's schema

Grouped into interaction pairs. Each pair is a `Dimension` value in
the event stream, and each pair collides A×B in a `MatchupCollision`.

| Attacking dimension | Defensive counter |
|---|---|
| controlled_zone_entries | blueline_entry_denial |
| controlled_exits / breakout_efficiency | forecheck_pressure |
| failed_exits | forecheck_created_turnovers |
| oz_puck_possession | dz_suppression |
| puck_retrievals | opponent_recovery_clearance |
| cycle_creation | cycle_disruption |
| rush_creation | rush_defense |
| transition_efficiency | transition_disruption |
| dangerous_turnovers_committed | turnover_to_chance_conversion |
| shot_chance_creation_zones | defensive_zone_weaknesses |
| pp_entry_setup | pk_entry_denial_disruption |
| line_matchup_effect (WHO+HOW hybrid) | opposing line_matchup_effect |

### 3.2 The collision object

```
MatchupCollision {
  dimension_pair            : (attacking_dim, defensive_dim)
  home_stance               : TeamStance    # see below
  away_stance               : TeamStance
  interaction_sign          : "favor_home" | "favor_away" | "balanced" | "no_evidence"
  interaction_confidence    : { level, basis, weakest_input_tier }
  sample_size_note          : adequate | sparse | insufficient
  as_of_iso                 : iso8601
}

TeamStance {
  team_id                   : ticker_team_id
  role                      : "attacker" | "defender"          # side of the pair
  metric_value              : number | null
  supporting_events         : [event_id ...]                    # traceability
  trust_tier                : verified_fact | attributed_observation | ticker_inference
  n_games_backing           : int
}
```

**In 1C, most metric_values will be null** — Sportlogiq/Sportradar data
provide these directly; from NHL Public alone we can compute only crude
proxies (see §9 availability matrix). The **schema exists so a future
provider integration writes into an already-defined shape**. Null with
a documented reason is preferable to fabricated proxies.

**Never a single "matchup score."** The collision is a bundle of two
stances plus an interaction sign. Downstream signals will combine
collisions; 1C does not.

---

## 4. Sequence & trajectory design (WHO × WHEN)

Averages flatten information. For every Last-N metric that 1C exposes,
we preserve the **ordered sequence** and a classified trend.

### 4.1 Sequence storage

For each `(team_id, metric, window)` slot in the projected view:

```
Sequence {
  metric                    : "gf_per_game" | "shots_for" | "starter_save_pct" | ...
  window                    : "last_1" | "last_3" | "last_5" | "last_10" | "season"
  ordered_values            : [ { game_id, played_at, value, trust_tier } ... ]  # DESC by played_at
  aggregate                 : { mean | shots_weighted_pct | count, ... }
  trend                     : TrendLabel
  compared_to_season        : { delta_vs_baseline, direction }
  n_available               : int
  n_requested               : int
}

TrendLabel =
  | emerging          # earliest values low/absent, latest rising
  | strengthening     # broadly monotonic upward
  | stable            # low variance across window
  | weakening         # broadly monotonic downward
  | reversing         # recent flip vs. prior direction
  | insufficient_sample
```

### 4.2 Trend classifier (rule-based, deterministic, no ML)

- `insufficient_sample` if `n_available < 3`.
- Split the sequence into two halves (older / newer).
- Compute mean of each half.
- Direction magnitude = |delta| / older_std_or_epsilon.
- Classify:
  - direction magnitude below threshold → `stable`
  - newer > older and consistent sign game-over-game → `strengthening`
  - newer < older and consistent sign game-over-game → `weakening`
  - newer > older but older half was near zero / absent → `emerging`
  - newer half sign opposite of prior trend on the tail → `reversing`

Thresholds are constants in a module-level config (not per-team). No
training, no fitting. Deterministic classification is a required
property because Betting IQ signal grading must be able to replay
trends at `as_of` cleanly.

**Comparison to season baseline** is a separate slot (`delta_vs_baseline`)
so consumers can distinguish "recent form" from "season identity."
Time-of-season matters: early season means `season_baseline.n <
threshold` and the classifier explicitly reports that instead of
producing a noisy signal.

---

## 5. Rest / travel / workload — facts vs. inferences

The dimension the user was most concerned about. Facts and inferences
live in **separate typed slots** and can never be conflated.

### 5.1 Facts (verified_fact tier)

```
ScheduleFacts {
  last_played_at_iso        : iso8601 | null      # from 1B latest played
  days_rest                 : int | null          # T - last_played_at
  back_to_back              : bool | null         # rest ≤ 1
  games_in_prior_4_nights   : int
  games_in_prior_7_nights   : int
  road_trip_game_number     : int | null          # position within a consecutive road stretch
  home_stand_game_number    : int | null
  prev_game_went_to_ot      : bool | null
  prev_game_went_to_so      : bool | null
  venue_city_changes_last_3 : int
  timezone_deltas_last_3    : [int, ...]          # signed hours
}
```

### 5.2 Player workload facts (verified_fact where measurable)

```
PlayerWorkloadFacts {
  player_ref                : PlayerRef
  toi_last_3                : [seconds_or_null, ...]  # from 1B boxscore only if we ingest skater TOI (currently only goalies are on 1B)
  goalie_starts_last_5      : int | null              # from 1B goalies
  goalie_relief_appearances_last_5 : int | null       # goalies with toi > 0 AND starter=false
  ot_workload_seconds_last_5 : int | null             # requires OT-window split (Sportlogiq/Sportradar)
  ...
}
```

Currently, 1B carries only goalie counts. Skater TOI is not on
`TeamGameFacts` (reserved null when 1B was frozen). Consequence: for
1C, player workload is populated **only for goalies today**. The
schema anticipates skater TOI so a later foundation can add it without
migration.

### 5.3 Inferences (ticker_inference tier)

```
WorkloadInferences {
  team_fatigue_risk         : { level: none | mild | elevated | high,
                                basis: schedule_compression_last_7 | b2b_road | recent_ot,
                                inputs: [event_id ...] } | null
  goalie_fatigue_risk       : same shape, only when goalie identity resolved
  rested_matchup_interaction: {
    home_rest_days, away_rest_days,
    interaction: "home_rested_advantage" | "away_rested_advantage" | "even" | "insufficient",
    basis: str
  }
}
```

**Rule:** `team_fatigue_risk` is inference and lives in
`WorkloadInferences`. `days_rest` is fact and lives in
`ScheduleFacts`. A signal layer can consult either; it cannot mistake
one for the other.

### 5.4 Travel model (§9's D-tier)

`venue_city_changes_last_3` and `timezone_deltas_last_3` are the
extent 1C computes from 1A venue data. Miles-flown / east-vs-west
directional-jetlag models require a static venue lat/lon table plus a
travel-effect model, both of which belong outside 1C's boundary.

---

## 6. HUMAN / EMOTIONAL / EVENT context — trust-tier discipline

The core rule: **1C records human context; it does not manufacture
psychology.**

### 6.1 Human-context event kinds

```
HumanContextKind (dimension = "human_context") =
  | first_game_vs_former_team
  | hometown_return
  | debut
  | milestone_opportunity           # e.g., approaching 500 goals
  | return_from_injury
  | coaching_change
  | lineup_promotion
  | lineup_demotion
  | healthy_scratch
  | healthy_return
  | player_public_comment
  | coach_public_comment
  | tribute_or_special_event
  | credible_reporter_observation
  | other_verified_circumstance
```

Each is a `PregameContextEvent` with `subject` set appropriately
(PlayerRef for milestone/return, TeamRef for coach change, etc.).

### 6.2 Three-tier example lattice

Same fact, three tiers, all preserved:

```
Event A [verified_fact]
  dimension:        "human_context"
  subject:          PlayerRef(McDavid)
  proposition:      { kind: "return_from_injury",
                      last_played_at: "2026-03-12T02:00Z",
                      first_available_at: "2026-04-05T19:00Z" }
  source:           "sportsdata_io.injuries"
  source_time_iso:  "2026-04-04T22:15Z"
  recorded_at:      "2026-04-04T22:18Z"
  status:           confirmed

Event B [attributed_observation]
  dimension:        "human_context"
  subject:          PlayerRef(McDavid)
  proposition:      { kind: "credible_reporter_observation",
                      text: "McDavid moving well at morning skate, in top-six drills",
                      reporter: "reporter-handle",
                      outlet: "Sportsnet" }
  source:           "reporter_feed:reporter-handle"
  source_time_iso:  "2026-04-05T15:42Z"
  recorded_at:      "2026-04-05T15:44Z"
  status:           proposed

Event C [ticker_inference]
  dimension:        "human_context"
  subject:          PlayerRef(McDavid)
  proposition:      { kind: "role_signal",
                      inference: "top_six_return_expected",
                      basis_event_ids: [B.id],
                      caveats: ["single_source", "unofficial"] }
  source:           "ticker_engine"
  source_time_iso:  null
  recorded_at:      "2026-04-05T15:44Z"
  status:           proposed
```

A signal layer that requires `verified_fact` filters to A. One that
accepts attributed observations gets A + B. One that permits inference
gets all three. **1C never silently promotes B or C to A.**

### 6.3 Never converting inference into fact

Enforced at write time: a projection cannot output a
`verified_fact`-tagged field whose backing event set includes any
`attributed_observation` or `ticker_inference`. The projection either
downgrades the tier or emits null.

---

## 7. WHEN — the time model

### 7.1 Two clocks per event

- `source_time_iso` — when the source said it (reporter tweet time,
  NHL announcement time, Sportsdata.io payload time).
- `recorded_at` — when Ticker persisted the event.

The gap is meaningful: a source_time of 15:42 and a recorded_at of
17:03 tells us Ticker learned this at 17:03, so an `as_of=15:50` view
cannot include it — even though the source said it earlier.

### 7.2 The `as_of` rule (inherited discipline)

For 1C projections and snapshots:

```
event is eligible at as_of iff
    recorded_at <= as_of
    AND (source_time_iso IS NULL OR source_time_iso <= as_of)
```

The `source_time_iso <= as_of` gate is the new one 1C introduces. It
prevents a payload whose provider-timestamp is future-dated (from
clock skew or a mis-ingested schedule row) from leaking into a
past-view. Same shape as 1B's `played_at_iso <= as_of` gate.

### 7.3 Reconstruction example

The scenario from the brief, encoded:

```
12:00  Event(kind=goalie_expected,          subject=Goalie X, tier=attributed_observation, source_time=12:00, recorded_at=12:03, status=proposed)
15:00  Event(kind=player_status_update,     subject=Player Y, tier=verified_fact,          source_time=15:00, recorded_at=15:02, status=proposed)     # "questionable"
17:30  Event(kind=lines_observed_at_warmup, subject=TeamRef,   tier=attributed_observation, source_time=17:30, recorded_at=17:34, status=proposed)
18:40  Event(kind=goalie_confirmed,         subject=Goalie X, tier=verified_fact,          source_time=18:40, recorded_at=18:41, status=confirmed,
                                                                                                                                supersedes=goalie_expected event)
18:55  Event(kind=late_scratch,             subject=Player Z, tier=verified_fact,          source_time=18:55, recorded_at=18:56, status=confirmed)
```

`pregame_context_for(game, as_of=15:30)` → sees the 12:00 goalie
proposition and the 15:00 status. Does not see 17:30, 18:40, or 18:55.
Grading a signal Ticker locked at 15:30 uses exactly that stream.

Because the goalie-confirmed event *supersedes* the goalie-expected
event, a view at 18:45 sees both in the log but the projection reports
the confirmed one as terminal. This mirrors 1B's `record_version`
chain but on the event level.

---

## 8. Matchup state can change (§7 of the brief)

Every event carries a `status`:

```
Status =
  | proposed         # first appearance, unconfirmed
  | confirmed        # explicit provider or verified update
  | contradicted     # a later event of higher tier disagrees
  | superseded       # a later same-subject/same-dimension event replaces it
  | withdrawn        # source retracted (e.g., reporter deletes a report)
  | resolved         # game concluded; the matchup question is now historical
```

**Transitions are events themselves** (append-only). We never mutate
`status` on the original row. A `superseding` event carries
`supersedes_event_id`, and the projection considers it terminal.

**Live-game overturn is architected but not implemented.** When Live IQ
lands, in-game evidence can `contradict` a pregame matchup event
(e.g., "expected rush defense from Team B" — during the game they
generate 12 rush chances against). The `resolved` status is written at
game end. 1C stops before that; the schema anticipates it so no
migration is required later.

**Consequence for signal grading later:** a signal that fired based on
a `proposed` event whose status ultimately became `contradicted` can
be graded distinctly from a signal that fired on a `confirmed` event
that stayed `confirmed`. That grading logic sits above 1C.

---

## 9. Data-availability matrix

| Field / Feature | Tier | Source today | Class |
|---|---|---|---|
| Final scores / outcome | verified_fact | 1B (NHL Public boxscore) | **A — available now** |
| Shots on goal per team | verified_fact | 1B (`shots_on_goal`) | **A** |
| Rest days / B2B / 3-in-4 / 7-in-N | verified_fact | 1A schedule + 1B played_at | **B — reliably derivable** |
| Venue / city / timezone | verified_fact | 1A `venue` | **A** |
| Home / road splits of Last-N | verified_fact | 1B projections + `is_home` | **B** |
| Season baseline (W/L/OTL/SOL, GF/GA) | verified_fact | 1B `season_baseline_for_team` | **B** |
| Goalie recent starts + save_pct (derived) | verified_fact / ticker_inference | 1B goalies | **B** |
| Presumed starter (from Last-3) | ticker_inference | 1B goalies | **B** |
| Trend classification | ticker_inference | 1B ordered sequences | **B** |
| Form vs. baseline delta | ticker_inference | 1B | **B** |
| H2H history | verified_fact | 1B pair-filter | **B** (sparse) |
| Playoff round / series state | verified_fact | 1A snapshots (when populated) | **A/B** |
| Player TOI / workload | verified_fact | NOT in 1B; would need Sportlogiq or SDIO player boxscore | **C — deeper provider** |
| OT workload | verified_fact | Same | **C** |
| Line combinations | verified_fact | Daily Faceoff / Sportlogiq / warmup observations | **C/D** |
| D-pair combinations | verified_fact | Same | **C/D** |
| PP / PK role | verified_fact | Sportlogiq / SDIO play-by-play | **C** |
| Confirmed starting goalie (pre-puck-drop) | verified_fact | NHL gamecenter landing (near puck-drop), teams' own announcements | **C — needs pregame poller** |
| Injuries | verified_fact | Sportsdata.io injuries / Sportradar | **C** |
| Scratches | verified_fact | Pregame lineup source | **C/D** |
| Healthy return / promotion / demotion | verified_fact | SDIO transactions + lineup poller | **C** |
| Coaching change | verified_fact | SDIO / manual admin table | **C/D** |
| Zone-entry rates (controlled/failed) | verified_fact | Sportlogiq | **C** |
| Cycle / rush creation rates | verified_fact | Sportlogiq | **C** |
| xG / high-danger / expected-shot-quality | verified_fact | Sportlogiq / Sportradar | **C** |
| Corsi / Fenwick / on-ice shot metrics | verified_fact | Sportlogiq / Sportradar (Sportradar 403 currently) | **C** |
| Zone-start ratios | verified_fact | Sportlogiq / Sportradar | **C** |
| Reporter observation (lines at morning skate) | attributed_observation | Manual ingest or reporter API | **D — human/reporting input** |
| Coach / player public comment | attributed_observation | Press-availability transcript / SDIO news | **D** |
| First-game-vs-former-team | verified_fact | SDIO transactions + roster history (needs roster history) | **C/D** |
| Milestone (500 goals, 1000 games) | verified_fact | Career totals + SDIO player metadata | **C** |
| Hometown / debut | verified_fact | Player bio metadata | **C** |
| Fatigue inference | ticker_inference | Derived from ScheduleFacts + workload | **B (with the honesty caveat)** |
| Miles flown / precise jetlag | verified_fact | Static venue lat/lon table + travel model | **E — not currently reliable** |
| Fan-attendance / crowd energy | attributed_observation | Not ingested | **E** |
| Ref crew tendencies | ticker_inference | Not ingested | **E** |

**A** and **B** features form the concrete cut of 1C. **C** and **D**
features have schema slots that stay null with a
`provider_not_wired` / `no_lineup_poller` / `sportradar_unavailable`
reason. **E** features are not represented in the schema — no null
slot, no false promise.

**Null is preferable to fabricated data** — enforced at the projection
layer via the trust-tier cap rule.

---

## 10. Proposed objects / schema

Three shapes: events (persisted), views (derived), snapshots
(persisted at decision moments).

### 10.1 Persisted — `iq_pregame_context_events`

The event stream defined in §0. Indexes:
- `(ticker_game_id, dimension, subject_key, source_time_iso desc)`
- `(ticker_game_id, recorded_at asc)`
- `(supersedes_event_id)` (partial where non-null)
- `(status, ticker_game_id)`

### 10.2 Derived view — `PregameContext`

Returned by stateless read helpers. Composed from:
- All eligible events in the stream for the game
- 1A canonical + latest schedule revision ≤ as_of
- 1A snapshot with `locked_at ≤ as_of` (the closest one)
- 1B projections via `history_for_team_as_of`,
  `season_baseline_for_team`, and H2H queries — all with as_of

Shape (structural only):

```
PregameContext {
  ticker_game_id, as_of_iso, season, season_type,
  home / away : TeamPregameSlice
  head_to_head : H2HSlice
  matchup_collisions : [MatchupCollision, ...]     # §3
  human_context_events : [PregameContextEvent, ...] # WHO tier-tagged
  playoff_context : PlayoffContext | null
  provenance : Provenance1C
}

TeamPregameSlice {
  team_id
  season_baseline : { ... }
  windows : {
    last_1, last_3, last_5, last_10 : Sequence      # §4
    home_only_last_10, road_only_last_10 : Sequence
  }
  form_vs_baseline : { ... }
  schedule_facts : ScheduleFacts                     # §5.1
  player_workload_facts : [PlayerWorkloadFacts, ...] # goalies only today
  workload_inferences : WorkloadInferences           # §5.3
  goalies : {
    presumed_starter : { ..., starter_presumed_from: str }  # ticker_inference tier
    recent_starters_last_10 : [ ... ]
    reserved_but_null : {
      confirmed_starting_goalie : null   # requires §14 lineup poller
      lineup_last_confirmed_at  : null
    }
  }
  human_context_events : [ ... ]                     # subset scoped to this team
  reserved_but_null : { line_combinations: null, d_pairs: null,
                         injuries: null, scratches: null,
                         advanced_metrics: null, ... }
}
```

### 10.3 Persisted — `iq_pregame_context_snapshots`

Written only at Betting IQ decision moments (§14). Append-only,
versioned like 1B (`_truth_view` compare, identical-write no-op).
Snapshot contains a materialized `PregameContext` payload plus:

```
{
  id                            : uuid
  ticker_game_id                : ticker_game_id
  snapshot_kind                 : "iq_lock" | "signal_evaluation"
  snapshot_reason               : str                      # "user_call:{id}" | "signal_run:{id}"
  captured_at_as_of             : iso8601
  built_at                      : iso8601
  payload                       : PregameContext           # materialized derived view
  onec_snapshot_ref_1a          : 1A snapshot id | null
  game_finals_versions_seen     : { ticker_game_id : record_version }
  event_ids_seen                : [uuid, ...]              # every 1C event that contributed
  supersedes_snapshot_id        : uuid | null
  provenance                    : Provenance1C
}
```

### 10.4 What 1C does NOT add

- No changes to `iq_calls`, `iq_canonical_games`, `iq_canonical_teams`,
  `iq_canonical_players`, `iq_game_context_snapshots`,
  `iq_game_schedule_revisions`, or `iq_game_finals`.
- No new columns anywhere in the frozen collections.
- Snapshot linkage to calls is by `snapshot_reason="user_call:{id}"`
  (queryable via index) rather than by extending `iq_calls`.

---

## 11. Provenance rules

Every read AND every snapshot carries a `Provenance1C` block:

```
Provenance1C {
  built_at                       : iso8601
  engine_version                 : semver
  as_of_iso                      : iso8601
  reads_performed                : [
    { collection, query_shape, as_of_applied,
      count_returned, weakest_tier_returned } ...
  ]
  onec_snapshot_ref_1a           : snapshot_id | null
  game_finals_versions_seen      : { ticker_game_id : record_version }
  event_ids_seen                 : [uuid, ...]
  null_field_reasons             : { field_name : reason_code }
  tier_cap_applied               : [                              # honesty audit
    { field, requested_tier, effective_tier, reason } ...
  ]
}
```

Reason codes (frozen enum): `sportradar_unavailable`,
`no_lineup_poller`, `reserved_in_foundation_1b`, `provider_not_wired`,
`no_events_before_as_of`, `insufficient_sample`,
`weaker_source_tier_capped_inference`.

---

## 12. Null / uncertainty rules

1. **Null with a reason** for every unknowable field. `reserved_but_null`
   fields are literally `null`, never `0` or `""` or `[]`.
2. **`insufficient_sample`** wherever `n_available < threshold`. Sample
   threshold constants live in one module (`intelligence.thresholds_1c`)
   so consumers can inspect them.
3. **Tier cap** — no downstream projection outputs `verified_fact` if
   any backing event was lower-tier. The cap is recorded in
   `tier_cap_applied`.
4. **Presumed vs. confirmed** — every field with an inferred subject
   (e.g., `presumed_starter`) carries an explicit `presumed_from` or
   `basis` string. Signals that require confirmation can refuse.
5. **H2H sparsity labels** — `insufficient` (0-1 games), `sparse` (2-4),
   `adequate` (≥5). Below `insufficient`, downstream matchup collisions
   depending on H2H history are omitted entirely.
6. **Sequence-window shortfalls** — a Last-10 with `n_available=6`
   returns the 6 games and reports `n_available=6, n_requested=10`.
   The trend classifier may return `insufficient_sample`.
7. **No silent nulls anywhere.** Every null slot is enumerated in
   `provenance.null_field_reasons`.

---

## 13. Minimum sample / coverage rules

| Slot | Minimum for a value | Below minimum |
|---|---|---|
| Trend classification | 3 games in window | `insufficient_sample` |
| Season baseline | 1 game | Returned with `games_recorded=N`, no suppression |
| Shots-weighted starter save_pct | 30 shots against total | Reported as `insufficient_sample` |
| Presumed starter | 2 starts in Last-3 | `insufficient_data` |
| H2H aggregates | 2 games | `sparse` label; aggregates included but flagged |
| MatchupCollision (given a specific dimension) | 3 games backing each side | collision omitted; recorded in provenance |
| Rest / B2B / compression | 1 completed prior game | `null` days_rest if none |

Widening 1B's Last-N backfill to strengthen H2H samples is a **later
explicit decision** and does not belong in 1C.

---

## 14. Snapshot strategy (hybrid — Option C, defended)

1. **Reads are stateless projections** over
   `iq_pregame_context_events` + 1A + 1B, with as_of cursor.
   Deterministic by the two-gate rule.
2. **Snapshots are written only at Betting IQ decision moments**:
   - `snapshot_kind="iq_lock"` at `iq_calls.locked_at`. The snapshot
     writer runs after the existing 1A `context_snapshot_ref`
     attachment.
   - `snapshot_kind="signal_evaluation"` — hook defined; implementation
     deferred to the signal foundation.
3. **Idempotent snapshot writer** — same discipline as 1B. Identical
   materialized `PregameContext` payload → no new version. Material
   change → new snapshot version, `supersedes_snapshot_id` set. This
   is the only way the 1C snapshot chain grows.
4. **Never a background auto-writer** for upcoming games. "What did
   Ticker know at 4:15 PM?" is answered by rederivation with
   `as_of=4:15 PM` (deterministic), not by wall-of-snapshots.
5. **Snapshots are self-contained for audit** — the `event_ids_seen`
   and `game_finals_versions_seen` fields let an auditor rebuild the
   exact payload from scratch.

Why hybrid rather than pure A or B:

- Pure **stateless (A)** loses the "prove Ticker acted on X" record.
  Rederivation years later at the same `as_of` is deterministic, but
  we still want a durable snapshot at the moment a real bet/call was
  made — otherwise verification requires trusting that no
  hindsight-corrupt event silently slipped in (§7's gates make that
  impossible in principle, but the snapshot is the belt to the
  suspender).
- Pure **snapshot-only (B)** grows unbounded and burdens the app to
  guess what timestamps will ever matter.
- **Hybrid (C)** = deterministic derivation for all reads +
  durable receipts at decision moments. Same shape 1A already uses
  (`iq_game_context_snapshots` + `context_snapshot_ref` on calls).

---

## 15. Required tests

Fixture-driven only (no live HTTP). Same discipline as 1B.

**Event-stream basics:**
- T-C01 Insert a verified_fact event; project — event appears with
  correct tier.
- T-C02 Insert an attributed_observation of the same subject; project
  — both events appear; latest source_time is terminal for status.
- T-C03 Superseded events are visible in the log but non-terminal in
  the projection.

**Two-gate temporal correctness:**
- T-C04 Event with `recorded_at ≤ as_of` but `source_time_iso > as_of`
  is excluded.
- T-C05 Event with `source_time_iso ≤ as_of` but `recorded_at > as_of`
  is excluded.
- T-C06 The goalie 12:00 → 15:00 → 17:30 → 18:40 → 18:55 scenario:
  projection at `as_of=15:30` returns exactly the pre-15:30 events.

**Trust tiers:**
- T-C07 Tier cap: an inference derived from an attributed observation
  cannot be labeled `verified_fact`; `tier_cap_applied` records the
  downgrade.
- T-C08 A `verified_fact` projection that depends on an ingredient
  event marked `contradicted` degrades or is omitted; recorded in
  provenance.

**Sequence / trajectory:**
- T-C09 `strengthening`, `weakening`, `stable`, `emerging`,
  `reversing`, `insufficient_sample` all reachable via crafted
  Last-N sequences.
- T-C10 Trend classification is deterministic under repeat calls.

**Rest / travel / workload:**
- T-C11 `days_rest` and `back_to_back` correctly derived across the
  boundary.
- T-C12 `games_in_prior_4_nights` counts scheduled+completed inside
  the window, excluding G itself.
- T-C13 `venue_city_changes_last_3` and `timezone_deltas_last_3` from
  1A venue chain.
- T-C14 `team_fatigue_risk` inference tier is
  `ticker_inference`, and `days_rest` fact tier stays `verified_fact`
  — never conflated.

**Human context:**
- T-C15 A reporter observation and a verified return-from-injury event
  coexist with distinct tiers.
- T-C16 A subsequent withdrawal event (`status=withdrawn`) removes the
  observation from the terminal projection but leaves it in the log.

**Matchup collisions:**
- T-C17 A collision with both sides `n_games_backing ≥ 3` is emitted
  with a non-null `interaction_sign`.
- T-C18 A collision with one side `insufficient` is omitted; recorded
  in provenance.

**Snapshot lifecycle:**
- T-C19 Snapshot at `iq_lock` matches the derived payload at the same
  as_of (truth-view equality).
- T-C20 Re-snapshot with identical materialized payload → no new
  version.
- T-C21 Re-snapshot after a material change (new event supersedes an
  older one) → new snapshot version with `supersedes_snapshot_id` set.
- T-C22 Historical replay: given only
  `event_ids_seen + game_finals_versions_seen + onec_snapshot_ref_1a`,
  an independent projection reconstructs the exact snapshot payload.
- T-C23 No post-game leak: a 1B final with `recorded_at > as_of` or
  `played_at_iso > as_of` never appears in the 1C projection.

**Regression:**
- All 32 Foundation 1A tests remain green.
- All 24 Foundation 1B tests remain green.
- 23 new 1C tests target ~100% coverage of the tier / gate /
  sequence / snapshot machinery.

Estimated 1C suite: 23 tests. Combined project total after build:
32 + 24 + 23 = **79 green tests**.

---

## 16. Foundation 1C boundary — final

**IN scope:**
- `iq_pregame_context_events` (one new append-only collection).
- `iq_pregame_context_snapshots` (one new append-only collection).
- Stateless read helpers: `pregame_context_for(ticker_game_id, as_of=None)`,
  `pregame_context_history(ticker_game_id)`.
- Snapshot writer wired to `iq_calls` lock transition (query-by-reason
  linkage; no new `iq_calls` field).
- Trust-tier machinery, tier-cap enforcement, provenance blocks.
- Sequence storage + deterministic trend classifier.
- Trend labels: `emerging | strengthening | stable | weakening | reversing | insufficient_sample`.
- Rest / travel / workload facts vs. inferences separation.
- Human-context event kinds (schema slots; ingesters wire in later).
- MatchupCollision schema (dimensions listed in §3.1) with null
  metric_values where provider data is missing.
- Status transitions on events: `proposed → confirmed → contradicted
  → superseded → withdrawn → resolved`; live-game overturn hook
  designed but not built.
- Dev-gated QA endpoint (`IQ_DEV_MODE=1`):
  - `GET /api/iq/pregame-context/{ticker_game_id}?as_of=...`
  - `GET /api/iq/pregame-context/{ticker_game_id}/history`
- Test suite (23 tests) + preserved 1A/1B regressions.

**OUT of scope (explicit):**
- No prediction. No LEAN / NEUTRAL / SKIP. No confidence-to-action
  mapping.
- No odds, no market edge, no closing-line-value math.
- No signal weights, no ML, no Betting DNA.
- No Personal IQ, Community IQ, Fantasy IQ.
- No Reggie / Marc UI, no AI play-by-play.
- No pregame lineup poller (belongs in a data-ingest foundation).
- No live in-game intelligence engine. The `contradicted` / `resolved`
  status transitions are supported by the schema but no live writer
  runs.
- No Sportlogiq / Sportradar ingestion. 1C's matchup collision fields
  stay null-with-reason until those integrations land in a later
  foundation.
- No changes to 1A or 1B schemas, indexes, or writers.
- No auto-writer that snapshots pregame contexts for every upcoming
  game.
- No PP% / PK% math (would require reopening 1B's TeamGameFacts).
- No player-TOI ingestion (same reason).

---

## 17. Worked examples — architecture representing real pregame situations

Each example ends *before* a prediction. Nothing here says "bet X."

### 17.1 Home-and-home, tired starter, a scratch, and a hot line

**Game:** MTL @ TOR, second night of back-to-back, 7:00 PM ET puck drop.

**Event stream (partial), all `as_of=17:30`:**

```
Event  dim="rest"                subject=TeamRef(MTL)   tier=verified_fact
       prop={ played_last_at: "yesterday 20:00", days_rest: 0, back_to_back: true }
       source=ticker_engine  source_time=null  recorded_at=17:12  status=confirmed

Event  dim="goalie_start_recent" subject=GoalieRef(Montembeault) tier=verified_fact
       prop={ starts_last_5: 4 } source=1B derivation  recorded_at=17:12

Event  dim="human_context"       subject=PlayerRef(Suzuki)  tier=attributed_observation
       prop={ kind: "credible_reporter_observation",
              text: "Suzuki not in optional skate; team ruled out being cautious",
              reporter: "@rmcinnis", outlet: "TSN" }
       source=reporter_feed  source_time=15:44  recorded_at=15:46  status=proposed

Event  dim="human_context"       subject=PlayerRef(Suzuki)  tier=verified_fact
       prop={ kind: "healthy_scratch", opponent: TOR, expected_return: null }
       source=nhl_public_gamecenter_landing  source_time=17:15  recorded_at=17:18
       status=confirmed  supersedes=<the earlier reporter event>
```

**Projection at `as_of=17:30`:**

- `home.schedule_facts.back_to_back = true` (verified_fact)
- `home.workload_inferences.team_fatigue_risk = { level: "elevated",
   basis: "b2b_road", inputs: [rest event] }` (ticker_inference)
- `home.goalies.presumed_starter = { display_name: "Montembeault",
   starter_presumed_from: "last_3_starts" }` (ticker_inference)
- `home.human_context_events` shows Suzuki confirmed scratch,
  supersedes reporter observation
- `provenance.tier_cap_applied` records that any collision that
  wanted to use Suzuki-in-lineup as an input has been suppressed
  (tier: `verified_fact` → weakest input now `verified_fact`
  but proposition changed to "absent"; downstream collision
  omitted with reason `key_input_absent`)

No prediction. Just the picture of what Ticker knew at 17:30.

### 17.2 Reporter contradicted by later official update

**Game:** VAN @ EDM.

- **12:03** Reporter: "Skinner in for EDM tonight." (attributed_observation)
- **17:41** NHL Public gamecenter landing: `probableGoalie = Pickard`.
  (verified_fact, supersedes reporter event)

**Projection at `as_of=13:00`:** presumed_starter = Skinner
(attributed_observation-backed, tier `ticker_inference` because it's a
projection from a lower-tier input). `presumed_from = "reporter_report"`.

**Projection at `as_of=18:00`:** presumed_starter downgrade path —
`confirmed_starting_goalie = Pickard` (verified_fact). Reporter event
still in the log with `status=superseded`. Any signal that fired at
13:00 has a durable snapshot pinning what it saw; any signal fired at
18:00 sees the corrected reality.

### 17.3 The classic "old team" narrative

**Game:** SEA @ COL. Kadri returns to Denver for the first time.

- **09:00** Ticker ingests event: `first_game_vs_former_team`
  (verified_fact, source=`ticker_derivation_from_roster_history`,
  tier is `verified_fact` because roster history is verified).
- **11:30** Coach Bednar quote: "It'll be a special night for Naz."
  Ingested as `attributed_observation` from a press-availability feed.
- **17:00** No other events land.

**Projection at `as_of=17:00`:**

- `human_context_events` on the away team's slice contains both.
- No matchup collision on this dimension — 1C is NOT saying "emotional
  edge to Kadri." It's saying: this circumstance exists on paper,
  tier-tagged, at these timestamps.

A future signal layer might combine this with a Kadri-vs-COL
historical event-rate. 1C does not.

### 17.4 A matchup-vs-matchup collision (Sportlogiq-fed, hypothetical)

Once Sportlogiq is wired:

- Team A `controlled_zone_entries.per60 = 21.4` (verified_fact,
  n_games_backing=10)
- Team B `blueline_entry_denial.per60 = 18.9` (verified_fact,
  n_games_backing=10)
- Collision: `{ interaction_sign: "favor_home",
    interaction_confidence: { level: "moderate",
    basis: "both sides adequately sampled",
    weakest_input_tier: "verified_fact" },
    sample_size_note: "adequate" }`

Note the collision emits an *interaction sign* — not a bet. The signal
layer above 1C decides whether that interaction becomes a wager or
even a nudge. 1C stops at the description.

Today, in the absence of Sportlogiq, this collision's `metric_value`
fields are null with `null_field_reasons` = `provider_not_wired`, and
the collision's `interaction_sign` is `no_evidence`. The **schema is
ready** the day the provider is turned on.

---

## Summary

Foundation 1C is a **time-aware event stream + hybrid derivation +
decision-moment snapshot** layer over the frozen 1A + 1B foundations.
It preserves:

- WHO — team → line → pair → player → goalie (schema ready; populates
  as providers land).
- HOW — matchup collisions as A×B interactions, never rankings.
- WHEN — two-gate as_of (`source_time_iso` and `recorded_at`) plus
  status transitions on events.
- CONTEXT — facts vs. inferences separated by trust tier; every null
  attributed; human context preserved without manufactured psychology.

Two new collections. Zero changes to frozen layers. Every field is
either a fact, an attributed observation, or an inference — labeled,
provenanced, and reproducible.

That's the trellis a real Betting IQ signal engine can stand on
later. It is not that engine.

Awaiting approval. No code and no DB changes until you say go.
