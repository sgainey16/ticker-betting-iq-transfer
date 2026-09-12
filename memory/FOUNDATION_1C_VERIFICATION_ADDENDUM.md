# FOUNDATION 1C — VERIFICATION ADDENDUM (four items + worked example)

Architecture direction approved in principle. This addendum locks the
four remaining questions before build. No code. No changes to 1A or
1B. Storage design in the base architecture doc is amended only where
called out below (subject vs. composition; collision raw sides;
inference basis chaining; snapshot idempotency key).

---

## 1. Player / Line / Pair identity — persistent vs. ephemeral

### Two subject classes, not one

The architecture distinguishes **persistent-identity subjects** from
**ephemeral composition values**. This is the piece that prevents a
line combination from being mistaken for a permanent entity.

```
# Persistent identity — canonical, outlives any game
PersistentSubject =
  | TeamRef(ticker_team_id)
  | PlayerRef(ticker_player_id | provider_player_id_fallback)
  | GoalieRef(same shape as PlayerRef)

# Ephemeral composition — VALUES, not identities
LineComposition {
  team_id                : ticker_team_id
  role_slot              : "F1" | "F2" | "F3" | "F4"
  player_refs            : [PlayerRef, ...]              # order = LW / C / RW where known
  composition_signature  : hash(sorted(player_refs) + role_slot)   # deterministic dedup key
}
PairComposition {
  team_id                : ticker_team_id
  role_slot              : "D1" | "D2" | "D3"
  player_refs            : [PlayerRef, PlayerRef]
  composition_signature  : hash(sorted(player_refs) + role_slot)
}
SpecialTeamsUnitComposition {
  team_id                : ticker_team_id
  unit_kind              : "PP1" | "PP2" | "PK1" | "PK2" | "6v5" | "3v3_OT"
  player_refs            : [PlayerRef, ...]
  composition_signature  : hash(sorted(player_refs) + unit_kind)
}
```

**Compositions never carry a stored identity.** They are shaped values
that appear inside a `PregameContextEvent.proposition`. They do not
have their own collection. Their `composition_signature` is used only
to compare "is this the same composition we already recorded?" for
event supersession — not as a durable ID.

### Event attachment rules

Every 1C event attaches to a **persistent subject** for querying,
even when its proposition describes a composition:

| What we want to record | Subject | Proposition contains |
|---|---|---|
| "Player A expected on Line 1" | `PlayerRef(A)` | `{ kind: "line_assignment", composition: LineComposition(F1, ...), status: "expected" }` |
| "Team dresses this full line chart" | `TeamRef(home)` | `{ kind: "line_chart", forward_lines: [LineComposition, ...], d_pairs: [PairComposition, ...], units: [SpecialTeamsUnitComposition, ...] }` |
| "PP1 unit is X/Y/Z/Q/R" | `TeamRef(home)` | `{ kind: "st_unit", unit: SpecialTeamsUnitComposition(PP1, ...) }` |
| "Goalie confirmed" | `GoalieRef` | `{ kind: "goalie_confirmed" }` |
| "Player A → Line 2" (mid-day change) | `PlayerRef(A)` | `{ kind: "line_assignment", composition: LineComposition(F2, ...), status: "observed", supersedes: prior_event_id }` |

**Why attach a line-composition event to `PlayerRef(A)` rather than a
`LineRef`:** the durable question later is "what did Ticker believe
about *this player's* role at this timestamp?" — Player A is the
persistent entity. The line grouping is a value at a moment in time.
Querying "give me every role event for Player A ≤ as_of" is trivial;
querying "what did Line 2 look like today" is a projection over
several such events.

### The example — Player A across three timestamps

```
Event E1  [attributed_observation]
  subject         : PlayerRef(A)
  dimension       : line_role
  proposition     : { kind: "line_assignment",
                       composition: LineComposition(F1, [A, B_center, C_rw]),
                       status: "expected" }
  source          : "coach_availability_transcript"
  source_time_iso : 12:00
  recorded_at     : 12:03
  status          : proposed
  supersedes_event_id : null

Event E2  [attributed_observation]
  subject         : PlayerRef(A)
  dimension       : line_role
  proposition     : { kind: "line_assignment",
                       composition: LineComposition(F2, [A, D_center, E_rw]),
                       status: "observed",
                       observation_context: "morning_skate" }
  source          : "reporter_feed:@rmcinnis"
  source_time_iso : 11:45              # source reported it later than E1's source_time
  recorded_at     : 12:30              # but Ticker learned it at 12:30
  status          : proposed
  supersedes_event_id : null           # NOT superseding — different tier + different context

Event E3  [verified_fact]
  subject         : PlayerRef(A)
  dimension       : line_role
  proposition     : { kind: "line_assignment",
                       composition: LineComposition(F3, [A, F_center, G_rw]),
                       status: "dressed",
                       observation_context: "official_lineup" }
  source          : "nhl_public_gamecenter_landing"
  source_time_iso : 18:40
  recorded_at     : 18:41
  status          : confirmed
  supersedes_event_id : E1.id          # supersedes the earlier proposition of record
```

Projections at three different `as_of`:

- `as_of = 12:15`: terminal state on `PlayerRef(A).line_role` =
  `LineComposition(F1, [A, B, C], expected, attributed_observation)`.
  E2 not yet visible (recorded_at 12:30 > 12:15).
- `as_of = 13:00`: two events visible; E1 remains "expected" from the
  official-availability tier, E2 exists as an "observed" note at
  morning skate on a different line. Projection surfaces **both** and
  labels each with its own tier — no forced merger.
- `as_of = 19:00`: E3 supersedes E1 as the record proposition. E1 and
  E2 both remain in the log with `status=proposed`; the projection's
  terminal line_role for Player A = LineComposition(F3, [A, F, G],
  dressed, verified_fact). Provenance lists E1 as superseded and E2 as
  a co-visible attributed observation.

**Team traded during the day scenario:** if Player A is traded from
Team X to Team Y, that is a `roster_transaction` event on
`PlayerRef(A)` with `proposition = { kind: "trade", from_team_id: X,
to_team_id: Y }`. Subsequent line-assignment events attach to the
same `PlayerRef(A)` — the persistent identity — with their
`composition.team_id` now Y. History for X remains queryable.
`iq_canonical_players` (1A) holds the persistent identity; 1A is
untouched.

### What this rules out

- No `iq_lines` or `iq_pairs` collection. Would create false permanence.
- No stored `line_id` treated as a canonical entity.
- No overwrite of a prior line-assignment event when a new one arrives
  — always superseded via a new event.
- No implicit "Line 1 today = Line 1 tomorrow" assumption. Every
  composition is per-event.

---

## 2. MatchupCollision preserves both raw sides in full

`MatchupCollision` is NOT persisted as its own row. It is a
**projection over the event stream** — reconstructable at any `as_of`
from the underlying `metric_observation` events for each team on each
dimension. The projected object carries the raw sides in full so the
"why did Ticker see a collision" question is answerable durably.

### Amended `TeamStance` shape

```
TeamStance {
  team_id                : ticker_team_id
  role                   : "attacker" | "defender"          # side of the pair
  metric_definition_id   : str                              # e.g. "controlled_zone_entries.per60"
  metric_definition_ver  : semver                           # freezes the exact formula
  metric_value           : number | null
  sample_window          : { window_kind: "last_10" | "season" | "last_30_days",
                              from_iso: iso8601, to_iso: iso8601 }
  n_games_backing        : int
  coverage_note          : "adequate" | "sparse" | "insufficient"
  coverage_pct           : float | null                     # populated when provider gives per-game coverage %
  source_provider        : "sportlogiq" | "sportradar" | "nhl_public_derived" | ...
  source_time_iso        : iso8601 | null                   # provider's stamp
  recorded_at            : iso8601                          # Ticker's stamp
  trust_tier             : verified_fact | attributed_observation | ticker_inference
  supporting_event_ids   : [uuid, ...]                      # every event that fed this stance
}
```

### Amended `MatchupCollision`

```
MatchupCollision {
  dimension_pair          : (attacking_dim, defensive_dim)
  home_stance             : TeamStance                       # full raw side
  away_stance             : TeamStance                       # full raw side
  interaction_sign        : "favor_home" | "favor_away" | "balanced" | "no_evidence"
  interaction_confidence  : { level, basis, weakest_input_tier }
  sample_size_note        : adequate | sparse | insufficient   # bounded by weaker side
  as_of_iso               : iso8601                          # collision reconstructed at this time
  regeneration_key        : {
    home_supporting_event_ids : [uuid, ...],
    away_supporting_event_ids : [uuid, ...],
    metric_definition_versions: { home: semver, away: semver },
  }
}
```

### Regeneration guarantee

Given only `regeneration_key`, an independent projection can recompute
the collision at the same `as_of`. That is the audit contract. The
interaction_sign is a function of the two stances plus the metric
definition versions; both sides plus their versions are captured, so
"why did Ticker see a collision" is answerable at any future point
even after metric definitions change (a metric version bump would
force a new collision computation, not a silent rewrite of the old
one).

### Underlying metric-observation events

Each stance's `supporting_event_ids` points to `PregameContextEvent`
rows whose proposition shape is:

```
{
  kind                   : "metric_observation",
  metric_definition_id   : "controlled_zone_entries.per60",
  metric_definition_ver  : "1.2.0",
  value                  : 21.4,
  sample_window          : { window_kind, from_iso, to_iso },
  n_games               : 10,
  coverage_pct           : 0.94,
  provider_payload_ref   : "sportlogiq://team/EDM/entries?window=last_10&asof=...",
}
```

That event is what's actually written to `iq_pregame_context_events`.
The collision is the *projection* that pairs two such events into an
interaction. `MatchupCollision` therefore never holds a synthesized
value that can't be traced back to a stored event.

---

## 3. Player human / emotional context — inference cites facts, never becomes one

### Two-layer rule

1. **1C emits verified facts and attributed observations for human
   context.** It does NOT emit emotional inferences of the form
   "player X will be extra motivated." Those are not events 1C
   generates.
2. **1C may emit derivational events** (`ticker_inference` tier) that
   are structural, not psychological — e.g., "this is Player A's
   first game vs. former team X" is a *fact* derived from roster
   history. Its provenance points to the roster-history rows it was
   derived from. It's a **derived fact**, tier `verified_fact`,
   because roster history is itself verified.

### The `basis_event_ids` contract

Every non-fact-tier event whose proposition is a derivation MUST list
its inputs:

```
PregameContextEvent.proposition (inference variant) {
  kind                   : str                             # e.g. "role_signal"
  inference_summary      : str                             # a short structural label,
                                                            # never a psychological claim
  basis_event_ids        : [uuid, ...]                     # REQUIRED, non-empty
  basis_field_ids        : [str, ...]                      # optional pointers to 1A/1B fields
  caveats                : [str, ...]                      # e.g. ["single_source", "unofficial"]
}
```

If `basis_event_ids` is empty, the projection layer refuses to emit
the event as `ticker_inference` — it either downgrades to
`attributed_observation` (if a single named source backs it) or
suppresses it entirely with `null_field_reasons=missing_basis`.

### The Kadri example — allowed vs. forbidden

**Allowed (verified_fact):**
```
Event
  subject          : PlayerRef(Kadri)
  dimension        : human_context
  proposition      : { kind: "first_game_vs_former_team",
                        against_team_id: tt_...(COL),
                        derived_from_roster_history: [player_row_id_list] }
  source           : "ticker_derivation:roster_history"
  trust_tier       : verified_fact           # roster history is itself verified
  status           : confirmed
```

**Also allowed (attributed_observation):**
```
Event
  subject          : PlayerRef(Kadri)
  dimension        : human_context
  proposition      : { kind: "coach_public_comment",
                        text: "It'll be a special night for Naz.",
                        speaker: PlayerRef_or_CoachRef,
                        outlet: "team_press_availability_transcript" }
  source           : "press_availability:2026-04-05"
  source_time_iso  : 11:30
  trust_tier       : attributed_observation
  status           : proposed
```

**Forbidden — 1C never writes this:**
```
Event
  subject          : PlayerRef(Kadri)
  dimension        : human_context
  proposition      : { kind: "motivational_state",
                        inference: "elevated" }
  trust_tier       : ticker_inference
```

Why forbidden: 1C has no calibrated model that maps "hometown return
+ coach quote" to a motivational state. Emitting one would be
manufactured psychology. The correct home for that mapping is a
future signal foundation with an evidence model, and only if it can
show reproducible predictive value. 1C's job is to preserve the
facts and observations so that signal layer has honest inputs.

### Guardrail: forbidden proposition kinds

The event writer maintains a small blocklist of proposition `kind`
values that 1C is not permitted to emit at all:

```
FORBIDDEN_1C_KINDS = {
  "motivational_state",
  "emotional_edge",
  "confidence_level",
  "psychological_advantage",
  "clutch_factor",
  "will_to_win",
}
```

Attempting to write any of these raises at the writer boundary. This
is the concrete form of "inference never silently becomes fact."

---

## 4. Snapshot semantics — decision-driven, idempotent

### When (exact frozen list)

A snapshot is written **only** when one of these decision events
occurs:

| Trigger | `snapshot_kind` | `snapshot_reason` shape |
|---|---|---|
| A user's Locked Call transitions to `state=locked` | `iq_lock` | `user_call:{iq_calls.id}` |
| A signal foundation evaluates against the game (future) | `signal_evaluation` | `signal_run:{signal_runs.id}` |
| Explicit dev-time marker (dev-gated) | `dev_audit_marker` | `dev_audit:{operator}:{note_hash}` |

Nothing else. Not on read. Not on new event ingestion. Not on
scheduled ticks. Not on lineup announcements. Not on goalie
confirmations. Not on trend re-classifications.

### What a snapshot contains (reproduces what the intelligence layer saw)

```
PregameContextSnapshot {
  id                            : uuid
  ticker_game_id                : ticker_game_id
  snapshot_kind                 : iq_lock | signal_evaluation | dev_audit_marker
  snapshot_reason               : str                      # frozen shape above
  captured_at_as_of             : iso8601                  # THE cursor used for derivation
  built_at                      : iso8601                  # server_now()
  payload                       : PregameContext           # fully materialized view

  # Regeneration keys — enough to rebuild the payload:
  onec_snapshot_ref_1a          : 1A snapshot id | null
  game_finals_versions_seen     : { ticker_game_id : record_version }
  event_ids_seen                : [uuid, ...]
  metric_definition_versions    : { metric_id : semver }   # for every collision emitted

  supersedes_snapshot_id        : uuid | null
  provenance                    : Provenance1C
}
```

The regeneration keys together with the frozen 1A/1B stores + the
event stream are sufficient to reproduce the payload byte-identical
(on truth-view) years later.

### Idempotency key

```
idempotency_key = ( ticker_game_id, snapshot_kind, snapshot_reason )
```

Rules:

1. First snapshot for a fresh idempotency_key → `inserted_v1`.
2. Repeated evaluation with the SAME idempotency_key AND the newly
   materialized payload matches the newest existing snapshot on
   truth-view → **no-op**. No new version. Same behavior as 1B's
   `noop_identical`.
3. Repeated evaluation with the SAME idempotency_key AND the
   materialized payload has materially changed (e.g., a new event
   between the prior snapshot's `captured_at_as_of` and this call's
   `captured_at_as_of` changed a Last-N game or a matchup collision)
   → **new snapshot version** with `supersedes_snapshot_id` set.
4. Concurrent writers with the same idempotency_key and identical
   materialized payloads → the second writer detects the match on
   re-read and no-ops. Same discipline as 1B's writer race handling.
5. `snapshot_reason` intentionally encodes the decision event ID
   (`user_call:{id}` or `signal_run:{id}`) so **every distinct
   decision event has its own idempotency scope.** Two different calls
   on the same game produce two independent snapshot chains, even at
   the same `captured_at_as_of`.

### What snapshots DO NOT do

- No snapshot fan-out ("save one per matchup collision"). One
  snapshot per decision event.
- No snapshot as a caching optimization. Derivation is deterministic;
  a cache is unnecessary.
- No snapshot pinned to a wall-clock hour. Snapshots follow decisions,
  not the clock.
- No snapshot written on passive user reads.

---

## 5. End-to-end worked example — WHO + HOW + WHEN + CONTEXT

### Setup

**Game:** EDM (home) vs. VAN (away). Puck drop 19:00 MT. `as_of`
timestamps below in local MT.

**Story:**

- 09:05 — Ticker's roster-history job emits a derived fact:
  *"McDavid returning from injury, first game since Mar 12."*
- 10:30 — Sportsdata.io injuries feed: *McDavid activated,
  status=available.*
- 11:30 — Coach Knoblauch press availability: *"Connor will play
  tonight, we'll ease him in on the second line."*
- 12:15 — Reporter tweet: *"McDavid skating on Line 1 in main drills
  at optional."*
- 13:00 — Ticker's schedule computation: *EDM played last night; VAN
  played two nights ago.* Back-to-back for EDM.
- 15:00 — Sportlogiq nightly feed (hypothetical, arrives here):
  *EDM controlled-zone-entries/60 last-10 = 22.1;
  VAN blueline-entry-denial/60 last-10 = 18.4.*
- 17:20 — VAN's official social channel: *"Silovs gets the start
  tonight."*
- 17:35 — Warmup reporter: *"McDavid on Line 2 in warmup drills, not
  Line 1."*
- 18:41 — NHL Public gamecenter landing: *EDM confirmed goalie Skinner;
  VAN confirmed goalie Silovs; EDM line chart shows McDavid on Line 1.*

### Event stream (compact form)

```
E01 09:05  PlayerRef(McDavid)  human_context.return_from_injury            verified_fact
E02 10:30  PlayerRef(McDavid)  human_context.injury_status.available       verified_fact
E03 11:30  PlayerRef(McDavid)  human_context.coach_public_comment          attributed_observation
E04 11:30  PlayerRef(McDavid)  line_role.expected(F2, basis=E03.id)        ticker_inference
E05 12:15  PlayerRef(McDavid)  line_role.observed(F1, morning_skate)       attributed_observation
E06 13:00  TeamRef(EDM)        schedule.back_to_back=true                  verified_fact
E07 15:00  TeamRef(EDM)        metric_observation.controlled_entries=22.1  verified_fact (sportlogiq)
E08 15:00  TeamRef(VAN)        metric_observation.entry_denial=18.4        verified_fact (sportlogiq)
E09 17:20  GoalieRef(Silovs)   goalie_status.starter_announced             attributed_observation
E10 17:35  PlayerRef(McDavid)  line_role.observed(F2, warmup)              attributed_observation
E11 18:41  GoalieRef(Skinner)  goalie_status.confirmed  supersedes=null   verified_fact
E12 18:41  GoalieRef(Silovs)   goalie_status.confirmed  supersedes=E09    verified_fact
E13 18:41  PlayerRef(McDavid)  line_role.dressed(F1, official_chart)
                                supersedes=E04, co-visible: E05, E10       verified_fact
```

### Projection at `as_of = 15:30`

Visible events: E01–E08 (E09 at 17:20 not yet).

**WHO**
- `home.human_context_events`:
  - E01 (return_from_injury, verified_fact, terminal)
  - E02 (injury_status.available, verified_fact, terminal)
  - E03 (coach_public_comment, attributed_observation, terminal)
- `home.goalies.presumed_starter` = Skinner (ticker_inference, basis:
  Last-3 starts derivation; `starter_presumed_from = "last_3_starts"`)
- `home.reserved_but_null.confirmed_starting_goalie` = null
  (`null_field_reasons.confirmed_starting_goalie =
  "no_lineup_poller_yet_at_this_as_of"`)
- `away.goalies.presumed_starter` = derived from VAN's Last-3
  starters (ticker_inference); confirmed = null (E09 not yet visible)

**Line role for McDavid**
- Terminal at 15:30: E04 (line_role.expected F2, ticker_inference,
  basis=E03) co-visible with E05 (line_role.observed F1,
  attributed_observation, morning_skate).
- Projection surfaces **both**, tier-labeled. No forced merger. The
  projection does NOT claim "McDavid on Line 1" as verified — only
  attributes it to the observation source.

**HOW**
- MatchupCollision for `(controlled_zone_entries × blueline_entry_denial)`:
  - `home_stance`: metric_definition_id=`controlled_entries.per60`, ver 1.2.0,
     value=22.1, window=last_10, n=10, coverage=0.94, source=`sportlogiq`,
     source_time=15:00, recorded_at=15:02, tier=verified_fact,
     supporting_event_ids=[E07]
  - `away_stance`: metric_definition_id=`entry_denial.per60`, ver 1.2.0,
     value=18.4, window=last_10, n=10, coverage=0.92,
     source=`sportlogiq`, source_time=15:00, recorded_at=15:03,
     tier=verified_fact, supporting_event_ids=[E08]
  - `interaction_sign`: `favor_home` (higher entries vs. weaker denial)
  - `interaction_confidence`: level=`moderate`, weakest_input_tier=`verified_fact`
  - `sample_size_note`: `adequate`

**WHEN**
- Every field carries tier + source_time + recorded_at.
- `provenance.tier_cap_applied` records that E04's tier (inference,
  basis=E03 attributed_observation) is capped at `ticker_inference`.

**CONTEXT**
- `home.schedule_facts.back_to_back = true` (E06, verified_fact)
- `home.workload_inferences.team_fatigue_risk = { level: "elevated",
   basis: "b2b_home", inputs: [E06.id] }` (ticker_inference — the
   fact stays in `schedule_facts`, the inference stays in a separate
   slot; **never conflated**)
- No forbidden proposition kind emitted anywhere.

### Snapshot at 15:30 (user locks a call)

- Trigger: user locks a call on this game at 15:30.
- `snapshot_kind = "iq_lock"`, `snapshot_reason = "user_call:call_abc123"`,
  `captured_at_as_of = 15:30`.
- Payload: the exact projection above.
- `event_ids_seen`: [E01..E08]
- `game_finals_versions_seen`: for every 1B game consumed by Last-N /
  H2H, the record_version that satisfied both temporal gates.
- `metric_definition_versions`: `{ controlled_entries.per60: 1.2.0,
   entry_denial.per60: 1.2.0 }`.

### Projection at `as_of = 19:00` (post puck-drop, replay-only)

Now visible: E01–E13.

**Terminal WHO**
- McDavid `line_role` terminal = E13 (dressed F1, verified_fact).
  E04 is superseded (visible in log, non-terminal). E05 and E10 remain
  co-visible attributed observations. History preserved.
- `home.goalies.confirmed_starting_goalie` = Skinner (E11).
- `away.goalies.confirmed_starting_goalie` = Silovs (E12). E09 remains
  in the log as its predecessor attributed observation.

**HOW**
- Same collision, unchanged; sample window still last_10 as of the
  window bound (which was already before 15:00 anyway).

**Idempotency**
- If a second `iq_lock` snapshot is written for the SAME
  `snapshot_reason="user_call:call_abc123"` at 19:00, the writer:
  - Recomputes the payload at `captured_at_as_of=19:00`.
  - Compares truth-view against the 15:30 snapshot.
  - Payload has materially changed (McDavid F1 dressed; goalies
    confirmed; etc.) → writes v2 with `supersedes_snapshot_id` =
    15:30 snapshot's id.
- If a third write at 19:00 with an identical payload occurs (e.g.,
  from a concurrent worker) → no-op via `noop_identical`.

### Hindsight non-leak, proven

- At `as_of=15:30`, McDavid's line role is not "F1 dressed" — it is
  the co-visible pair of an inference (F2) and an attributed
  observation (F1 at morning skate). E13's dressed-F1 record never
  appears in the 15:30 snapshot.
- At `as_of=15:30`, Silovs is a presumed starter derived from VAN's
  Last-3 goalies, not a confirmed starter. E09 (17:20 announcement) is
  not visible; E12 (18:41 confirmation) is not visible.
- The 15:30 snapshot's `event_ids_seen` explicitly enumerates
  E01–E08 and no others. Any auditor can prove the snapshot is
  hindsight-clean by inspecting the ID set.
- The 19:00 snapshot's `event_ids_seen` includes E09–E13. It is a
  distinct snapshot version chained by `supersedes_snapshot_id`. The
  15:30 snapshot is never mutated.

---

## Summary of the four verifications

| # | Check | Answer |
|---|---|---|
| 1 | Player / Line / Pair identity | Persistent subjects (Team/Player/Goalie) vs. ephemeral compositions (LineComposition / PairComposition / SpecialTeamsUnitComposition) as **values** inside event propositions. No `iq_lines` collection, no permanent line ID. History preserved across mid-day line changes. |
| 2 | MatchupCollision preserves both raw sides | Yes — `TeamStance` amended to carry metric_definition_id + semver, value, sample window, n_games, coverage_pct, source_provider, both timestamps, trust tier, supporting_event_ids. Collision is a projection, not a persisted row; regeneration_key permits byte-identical reconstruction at the same as_of. |
| 3 | Human/emotional context | Verified facts and attributed observations preserved with full source metadata. Inferences REQUIRE non-empty `basis_event_ids`. A blocklist of proposition kinds (`motivational_state`, `emotional_edge`, etc.) is refused at writer boundary — 1C never emits manufactured psychology. |
| 4 | Snapshot semantics | Written only on decision events (`iq_lock`, `signal_evaluation`, `dev_audit_marker`). Idempotency_key = (`ticker_game_id`, `snapshot_kind`, `snapshot_reason`). Identical materialized payload → no-op. Material change → append `supersedes_snapshot_id`. Never on passive read / event ingestion / clock tick. |

Ready for build approval on your signal.
