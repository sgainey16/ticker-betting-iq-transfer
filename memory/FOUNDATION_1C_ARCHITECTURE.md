# FOUNDATION 1C — PREGAME HOCKEY CONTEXT: ARCHITECTURE PROPOSAL

Audit + design only. No code changes. No DB changes.
Foundations 1A and 1B are frozen and untouched.

Purpose recap: 1C assembles the pregame hockey situation that Ticker
legitimately possessed at a given point in time for a specific game.
1A tells us *which game*. 1B tells us *what happened*. 1C tells us
*what we knew about these two teams just before this game*.

---

## 1. Current-data audit — what 1C can derive today

For a game `G` scheduled at time `T`, given only frozen 1A + 1B and
the currently active NHL Public API (SportsData.io + Highlightly are
also live but 1C doesn't need them for the base cut), 1C can produce
the following fields as of any `as_of ≤ T`:

### Team performance (both home and away)
- **Last-1 / Last-3 / Last-5 / Last-10 games** — directly via
  `recent_history_views.history_for_team_as_of(team, as_of, n)`.
  Returns full projection per game (opponent, home/road, GF, GA,
  result, outcome, shots for/against, goalies).
- **Home-only / road-only splits** — filter `is_home` on the Last-N
  projections. Effectively free.
- **Goals for / against** — derived from `final_score` per correction #3.
- **Shots for / against** — `shots_on_goal_for` / `shots_on_goal_against`
  are on every TeamGameFacts projection.
- **Season record / baseline** — `season_baseline_for_team(team, season,
  season_type, as_of)`: `games_recorded`, W, RegL, OTL, SOL, GF, GA.
- **Recent form vs season baseline** — Last-N averages minus season
  averages, computed at read time. Pure derivation.

### Schedule / rest / travel
- **Rest days going into G** — delta between `T` and the team's most
  recent completed game's `played_at_iso` (from Last-1). Reliable.
- **Back-to-back flag** — `rest_days ≤ 1`. Reliable.
- **3-in-4 / schedule compression** — count of completed *and*
  scheduled games (from `iq_canonical_games`) whose `played_at_iso` or
  `scheduled_iso` falls within the 4-day window ending at `T`. Reliable
  as long as 1A's schedule cache is current for that team.
- **Venue and time zone at each recent game** — `venue.city` /
  `venue.timezone` are on every canonical game via 1A. This gives a
  first-order travel signal (city change / TZ delta) without a real
  distance model.

### Goalies
- **Recent-start goalie identity for each team** — `home_goalies` /
  `away_goalies` on every 1B GameFinal include `starter`, `toi_seconds`,
  `provider_player_id_nhl`, `display_name`, and derived `save_pct` from
  counts.
- **Goalie's recent performance** — filter Last-N for the team, extract
  the goalie row where `starter=True` and `toi_seconds > 0`, project
  their save_pct, shots_against, saves, decision (where present).
  Group by `provider_player_id_nhl` for a per-goalie recent-form view.
- **Presumed starter for the upcoming game** — most-frequent starter
  across the team's Last-3 completed games, tie-broken by most recent.
  This is a **presumed** starter, not a confirmed one, and must be
  labeled that way on every field it appears on.

### Head-to-head (where the sample exists)
- **H2H last-N** — filter `iq_game_finals` where
  `(home_team_id, away_team_id)` matches either orientation for the two
  teams, `played_at_iso ≤ as_of`, latest-version selection, ordered
  desc. Return whatever count exists plus an explicit `n_games`.

### Playoff context (limited)
- **Playoff round + series state** — 1A already stores
  `iq_game_context_snapshots.playoff_context` when it's populated by a
  provider. 1C exposes what's there and reports null if absent. Does
  not synthesize.

---

## 2. Missing fields / provider dependencies (do NOT fabricate)

Every one of these is left as an explicit null, tagged in the 1C
provenance block with a reason so consumers can see *why* it's missing.

| Field | Why unavailable today | Would require |
|---|---|---|
| **Confirmed starting goalie before puck drop** | NHL Public schedule/gamecenter endpoints don't confirm starters until near puck drop and Ticker doesn't have a pregame-lineup poller wired. 1B goalie rows are postgame. | Pregame lineup poller (NHL Public gamecenter landing endpoint sampled at ~T-60) or Daily Faceoff / Sportlogiq feed. Belongs in a later foundation. |
| **Injuries** | No injury provider wired. | Sportsdata.io player-injury endpoint, or Sportradar (blocked by 403). |
| **Scratches** | Same as injuries; scratches are often not officially posted until warmups. | Pregame lineup poller. |
| **Line combinations** | No provider ingested. | Daily Faceoff / Sportlogiq. |
| **Roster changes / trades** | No provider tap. 1A canonical teams don't track roster deltas. | Sportsdata.io trades feed / NHL Public transactions. |
| **Coaching changes** | Same. | Manual admin table or Sportsdata.io. |
| **Power-play %, PK %** | 1B TeamGameFacts intentionally leaves `power_play_opportunities` / `power_play_goals` / `penalty_minutes` as reserved null (frozen shape). | 1B does not carry the raw counts; adding them means reopening 1B. **Do not do this in 1C.** A future foundation can extend TeamGameFacts, or a companion collection can carry PP/PK counts. |
| **Advanced Sportlogiq / Sportradar metrics** (Corsi, xG, high-danger, zone-start ratios) | Sportradar trial 403. Sportlogiq not wired. | Later foundation once feeds are restored. |
| **Market odds / betting lines** | Out of scope for Betting IQ's intelligence foundations. | Deliberately not planned for 1C. |
| **Precise travel distance / miles flown** | 1A venues carry city + timezone but no lat/lon. | Static team-venue coordinates table (small, doable), but not required for 1C's first cut. |

**Rule of honesty for 1C:** if a field can't be reliably derived, it is
`null` with a provenance entry explaining why. 1C never substitutes a
presumption for a confirmed fact silently — it either labels the
presumption honestly (e.g., `starter_presumed_from: last_3_starts`) or
returns null.

---

## 3. Proposed data model

Two shapes: a **derived view** (returned by the stateless read helpers)
and an **immutable snapshot** (persisted only at Betting IQ decision
moments).

### 3.1 `PregameContext` — the derived view (never stored on its own)

```
PregameContext {
  ticker_game_id          : str
  as_of                   : iso8601 str   # the temporal cursor
  competition             : "NHL"
  season                  : str
  season_type             : PRE | REG | POST
  scheduled_iso           : iso8601 str   # from 1A canonical
  status_at_as_of         : GameStatus    # from 1A latest revision ≤ as_of

  home_team_id            : ticker_team_id
  away_team_id            : ticker_team_id

  home                    : TeamPregameSlice
  away                    : TeamPregameSlice
  head_to_head            : H2HSlice
  playoff_context         : PlayoffContext | null   # passthrough from 1A snapshot
  onec_snapshot_ref_1a    : snapshot_id | null      # the 1A snapshot that was in effect at as_of
  provenance              : Provenance1C
}

TeamPregameSlice {
  team_id                 : ticker_team_id
  season_baseline         : {games_recorded, wins, reg_losses, ot_losses, so_losses, gf, ga}
  last_1 / last_3 / last_5 / last_10 : LastNBlock
  home_only_last_10       : LastNBlock
  road_only_last_10       : LastNBlock
  form_vs_baseline        : {last_5_gf_per_game_delta, last_5_ga_per_game_delta,
                             last_5_shots_for_per_game_delta, last_5_shots_against_per_game_delta}
  rest_and_schedule       : {
    last_played_at_iso        : iso8601 | null
    days_rest                 : int | null
    back_to_back              : bool | null
    games_in_prior_4_nights   : int
    games_in_prior_7_nights   : int
    venue_changes_last_3      : int          # count of city changes in last 3 played+scheduled
  }
  presumed_starter        : {
    provider_player_id_nhl    : int | null
    display_name              : str | null
    starter_presumed_from     : "last_3_starts" | "insufficient_data" | null
    recent_starts_last_10     : [ { game, played_at, opponent, saves, shots_against,
                                    save_pct_derived, decision } ... ]
  }
  reserved_but_null       : {
    confirmed_starting_goalie   : null   # requires lineup poller
    injuries                    : null   # requires provider
    scratches                   : null   # requires lineup poller
    line_combinations           : null   # requires DFO/Sportlogiq
    power_play_pct              : null   # 1B counts not carried (frozen)
    penalty_kill_pct            : null   # 1B counts not carried (frozen)
    advanced_metrics            : null   # Sportlogiq/Sportradar
  }
}

LastNBlock {
  n_requested             : int
  n_returned              : int           # may be less than n_requested honestly
  games                   : [ TeamPerspective ... ]   # 1B projection shape
  aggregates              : {
    wins, reg_losses, ot_losses, so_losses,
    gf_total, ga_total,
    shots_for_total, shots_against_total,
    starter_save_pct_weighted   # derived from goalie counts, null if unavailable
  }
}

H2HSlice {
  n_games                 : int
  games                   : [ H2HProjection ... ]   # last-10 head-to-head, chronological desc
  aggregates_from_home_perspective : {
    wins_reg, wins_ot, wins_so, losses_reg, losses_ot, losses_so,
    gf_total, ga_total
  }
  sample_size_note        : "adequate" | "sparse" | "insufficient"   # ≥5 / 2-4 / 0-1
}

Provenance1C {
  built_at                : iso8601 str
  engine_version          : semver
  as_of                   : iso8601 str
  reads_performed         : [
    { collection, query_shape, as_of_applied, count_returned } ...
  ]
  onec_snapshot_ref_1a    : snapshot_id | null
  null_field_reasons      : {
    field_name : "sportradar_unavailable" | "no_lineup_poller"
                | "reserved_in_foundation_1b" | "provider_not_wired"
                | "no_games_before_as_of"
  }
}
```

### 3.2 `PregameContextSnapshot` — the immutable record (only written at decision moments)

```
PregameContextSnapshot {
  id                            : uuid
  ticker_game_id                : ticker_game_id
  snapshot_kind                 : "iq_lock" | "signal_evaluation"   # extensible
  snapshot_reason               : str            # e.g. "user_call:call_id" or "signal_run:run_id"
  captured_at_as_of             : iso8601 str    # the as_of used to derive
  built_at                      : iso8601 str    # server_now() when snapshot written

  # The derived view, materialized:
  payload                       : PregameContext (as above, minus provenance link cycle)

  # Backing refs — what the derived view depended on:
  onec_snapshot_ref_1a          : 1A snapshot_id | null
  game_finals_versions_seen     : {
    ticker_game_id : record_version  # for every 1B game read into the payload
  }

  provenance                    : Provenance1C
  supersedes_snapshot_id        : uuid | null    # only if a correction is materially required
}
```

**Storage collection (only new one 1C proposes):** `iq_pregame_context_snapshots`.
Append-only. Same versioning discipline as 1B (identical-write no-op;
version bump only when the derived payload is materially different from
the newest existing snapshot for the same `(ticker_game_id, snapshot_kind, snapshot_reason)`).

**No changes to 1A or 1B schemas.** 1A snapshots and 1B finals are read
inputs. 1C owns exactly one new collection.

---

## 4. Query design — present vs historical/as_of

Single builder pattern, matching the 1B `_pipeline_latest_versions`
discipline:

**Read helpers (proposed function surface):**
```
pregame_context_for(db, *, ticker_game_id, as_of_iso=None) -> PregameContext
pregame_context_snapshot_at_lock(db, *, ticker_game_id, snapshot_kind,
                                 snapshot_reason, as_of_iso) -> snapshot_id
pregame_context_history(db, *, ticker_game_id) -> [PregameContextSnapshot ...]
```

**Present-tense** (`as_of_iso=None`):
- Uses the current state of 1A canonical (latest revision) and 1B
  finals (latest version per game).
- No filter on `recorded_at` or `played_at_iso` beyond `<= now`.

**Historical (`as_of_iso` provided):**
- Propagates the `as_of` cursor into **every** downstream call:
  - `history_for_team_as_of(team, as_of, n)` (already enforces both
    temporal gates: `recorded_at ≤ as_of` AND `played_at_iso ≤ as_of`).
  - `season_baseline_for_team(team, ..., as_of)` (same gates).
  - `game_final_as_of(ticker_game_id, as_of)` (same gates).
  - 1A snapshot selection: `locked_at ≤ as_of` (existing 1A rule).
  - Rest-days: last `played_at_iso ≤ as_of`.
  - Schedule compression: canonical games with
    `scheduled_iso ≤ as_of` OR `played_at_iso ≤ as_of`.

**Invariant:** for a fixed `(ticker_game_id, as_of)` pair, the derived
`PregameContext` payload must be deterministic. This is the property
that makes snapshotting meaningful.

**Backward guarantee:** because both 1B gates are already enforced and
1A snapshots use `locked_at ≤ as_of`, a repeated call with the same
`as_of` returns the same answer *forever*, even after future
corrections land. This is what makes "at 4:15 PM before this game,
these were the facts Ticker possessed" provable.

---

## 5. Snapshot strategy

**When to snapshot** (Option C, as your instinct suggested):

- **On Betting IQ lock**: when a user locks a call on a game (existing
  `iq_calls.state = "locked"` transition), immediately derive the
  pregame context at `call.locked_at` and write a
  `PregameContextSnapshot` with `snapshot_kind="iq_lock"`,
  `snapshot_reason=f"user_call:{call.id}"`. Store the snapshot id on
  the call alongside the existing `context_snapshot_ref` (which points
  to the 1A snapshot). This is the moment "what did Ticker know?"
  becomes historically important.
- **On signal evaluation** (later foundation): when a Betting IQ signal
  runs against a game, write a snapshot with
  `snapshot_kind="signal_evaluation"`. Out of scope for 1C build; the
  hook must be designed cleanly so a future foundation can call it
  without reopening 1C.

**When NOT to snapshot:**
- Never on a passive read. A user browsing the app must not create
  snapshots.
- Never on retry unless the payload is materially different.
- Never as a "record what we know now for later" background writer —
  that would grow unbounded and would not serve any provable question
  ("what did we know at 4:15 PM?" is answered by re-deriving with
  `as_of=4:15 PM`, which is deterministic because of the 1B temporal
  gates).

**Versioning inside snapshots:**
Same rule as 1B: append-only, `supersedes_snapshot_id` chain, new
version only when `_truth_view(payload_new) != _truth_view(payload_old)`.
An identical re-derive is a no-op. A material correction (e.g., 1B v3
`canonical_identity_repair` changing a Last-10 game's truth) that
propagates into the derived payload does create a new snapshot version
— and that is the correct behavior: it records that Ticker's
understanding of "what we thought we knew" changed.

---

## 6. Provenance rules

Every read AND every snapshot carries a `Provenance1C` block with:

1. **`built_at`** — server_now() at derivation.
2. **`engine_version`** — semver; bumps on rule/model changes so
   consumers can distinguish e.g. `1.0.0` derivations from `1.1.0`.
3. **`as_of`** — the temporal cursor. Present-tense reads record the
   effective `as_of = built_at`.
4. **`reads_performed`** — every backing 1A/1B query with the `as_of`
   applied and the row count returned. Enables audit ("how many Last-N
   games contributed?").
5. **`onec_snapshot_ref_1a`** — the 1A `iq_game_context_snapshots.id`
   whose `locked_at` is the newest `≤ as_of`. Null if none exist.
6. **`game_finals_versions_seen`** — for each 1B game consulted, the
   exact `record_version` that satisfied both temporal gates. Snapshots
   pin these so a future audit can see whether a correction landed
   after the snapshot's `built_at`.
7. **`null_field_reasons`** — every null field gets a reason code:
   `sportradar_unavailable`, `no_lineup_poller`,
   `reserved_in_foundation_1b`, `provider_not_wired`,
   `no_games_before_as_of`. No silent nulls.

This block is stored inside every snapshot and returned inline on every
derived view. It is the audit trail that Betting IQ signal grading will
depend on later.

---

## 7. Tests required (all fixture-driven, matching 1B discipline)

**Unit — pure computation (no DB):**
- `derive_rest_days` for boundary cases (same day, 24h, 48h, 72h+,
  none available).
- `derive_form_vs_baseline` handles zero-game seasons.
- `derive_presumed_starter` from Last-3 goalies: unanimous, split,
  insufficient data → returns `insufficient_data`.
- `derive_venue_changes_last_3` counts city transitions correctly.

**Integration — against seeded 1A + 1B fixtures:**
- **T-C1** Present-tense projection for a game where the home team has
  10 completed games ≤ T and the away team has 8. Assert
  `n_returned` matches per side, aggregates are correct, and no null
  fields except the reserved list.
- **T-C2** as_of BEFORE the away team's first 1B ingest returns
  `n_returned=0` for away Last-N; away season_baseline has
  `games_recorded=0`. No exception thrown.
- **T-C3** as_of that predates a 1B correction returns the pre-correction
  version in the Last-N block. `game_finals_versions_seen` records
  v1, not v2. Post-correction as_of records v2.
- **T-C4** Back-to-back detection: home team's last played_at is 22h
  before `T` → `back_to_back == True`. 40h before `T` →
  `back_to_back == False`.
- **T-C5** Schedule compression: seed 4 canonical games in the last 4
  nights → `games_in_prior_4_nights == 3` (excludes G itself).
- **T-C6** Presumed starter honesty: label always includes the
  provenance path (`last_3_starts` or `insufficient_data`).
- **T-C7** H2H sparsity labeling: 0 games → `insufficient`, 2 games →
  `sparse`, 6 games → `adequate`.
- **T-C8** Playoff context passthrough: 1A snapshot has round=`R2` and
  series_state → 1C exposes it verbatim.
- **T-C9** Provenance non-empty: every derived view lists at least the
  backing 1B reads and the effective as_of.
- **T-C10** Reserved-null contract: every field in `reserved_but_null`
  is literally `null`, never an empty string, empty list, or `0`.

**Snapshot lifecycle:**
- **T-C11** Snapshot on lock: `iq_lock` snapshot at `call.locked_at`
  contains a payload byte-for-byte equal (on truth-view) to the derived
  view at that as_of.
- **T-C12** Idempotent lock snapshot: re-calling the snapshot writer
  with the same `(ticker_game_id, snapshot_kind, snapshot_reason,
  as_of)` and an identical derived payload → no new version. Different
  payload → new version, `supersedes_snapshot_id` set.
- **T-C13** Historical replay: given only the snapshot's
  `game_finals_versions_seen` and `onec_snapshot_ref_1a`, an independent
  derivation reconstructs the exact snapshot payload. Proves the
  snapshot is self-contained for audit.
- **T-C14** Never leaks post-game data into pregame view: seed a 1B
  final with `recorded_at > T`. Derived view with `as_of = T` must not
  include it in any Last-N or season baseline.

**Full-suite regression:**
- 32 Foundation 1A tests remain green.
- 24 Foundation 1B tests remain green.
- All new 1C tests green (est. 14 above).

---

## 8. Recommended minimum-history requirements

For 1C to produce a meaningful pregame context, per team as_of `T`:

| Field | Minimum history required | Currently satisfied by 1B seed? |
|---|---|---|
| Last-1 | 1 completed game ≤ T | Yes |
| Last-3 | 3 completed games ≤ T | Yes (backfill seeds 10) |
| Last-5 | 5 completed games ≤ T | Yes |
| Last-10 | 10 completed games ≤ T | Yes (exactly enough) |
| Home-only-Last-10 | Up to 10 home completed games | Partial — depends on the split; view returns whatever fraction of Last-10 is home. Honest `n_returned`. |
| Season baseline | Any completed games for the team in current season/type | Yes, small samples early season |
| Rest days | Last-1 completed game | Yes |
| B2B / schedule compression | 4-night window prior to T | Yes if within 1B seed; falls back to `iq_canonical_games` for scheduled entries |
| Presumed starter | 3 Last-N games with a starter goalie | Yes; if fewer, label as `insufficient_data` |
| H2H | Any completed head-to-head in `iq_game_finals` ≤ T | Sparse in current seed (only 10 per team); many pairs will have 0. Honest labeling required. |

**Recommendation:** no additional backfill required to build 1C. When
Betting IQ starts grading signals against H2H, we'll want to widen 1B's
Last-N seed — but that is a *later explicit decision*, not a 1C
prerequisite. 1C ships with honest sparse-sample labeling.

---

## 9. Foundation 1C boundary — what's in and what's out

**IN scope for Foundation 1C:**
- Stateless derived `PregameContext` view over 1A + 1B.
- Full `as_of` temporal cursor propagation.
- Immutable `iq_pregame_context_snapshots` (one new collection).
- Snapshot on `iq_lock` (Betting IQ user-call lock moment). Hook API
  for later `signal_evaluation` snapshots — not implemented in 1C.
- Provenance block on every read and snapshot with explicit
  null-field reasons.
- Honest labeling of inferred fields (e.g., `starter_presumed_from`).
- Sample-size discipline on H2H (`adequate` / `sparse` / `insufficient`).
- Fixture-driven test suite (14 tests) + 1A + 1B regression preserved.
- Dev-gated QA endpoint (optional) `/api/iq/pregame-context/{ticker_game_id}`
  and `/history` that return the derived view + snapshot chain.

**OUT of scope for Foundation 1C (explicit):**
- No prediction, no LEAN / NEUTRAL / SKIP.
- No odds, no market edge.
- No signal weights, no ML.
- No Personal / Community / Fantasy IQ.
- No Reggie / Marc UI hookup.
- No AI play-by-play or Banter surfaces.
- No confirmed lineup / starting goalie confirmation surface.
- No injury / scratch / roster / coaching change ingestion.
- No PP% / PK% computation — would require reopening 1B's frozen
  TeamGameFacts to carry raw counts. Defer to a later foundation.
- No advanced Sportlogiq / Sportradar metrics.
- No changes to 1A snapshots, 1B finals, `iq_canonical_teams`,
  `iq_canonical_games`, or `iq_calls`.
- No new `iq_calls` fields at 1C level. When the lock-time snapshot
  writer runs, the snapshot's id will be referenced through the
  snapshot collection's own indexes (queryable by `snapshot_reason`)
  rather than by extending `iq_calls`. This keeps 1A's `iq_calls`
  contract frozen.

**Also NOT built in 1C:** any auto-writer that snapshots pregame context
in the background for all upcoming games. Snapshots are decision-driven,
not scheduler-driven — matching the discipline that snapshots record
what Betting IQ actually possessed *at the moment of a decision*, not
what it happened to compute on an idle worker tick.

---

## 10. Open questions for your call before build

1. **Snapshot kind vocabulary at 1C.** Ship 1C with only
   `snapshot_kind="iq_lock"`, or also include `snapshot_kind="ad_hoc"`
   for a dev QA endpoint that lets you request a snapshot on demand?
   Neutral either way; leaning `iq_lock` only, keeping the surface narrow.
2. **QA endpoint gating.** Same `IQ_DEV_MODE=1` pattern as 1A's
   `/api/iq/game-context/*`? Recommend yes for consistency.
3. **Where the snapshot id lands on the call.** Two clean choices:
   (a) query the snapshot collection by `snapshot_reason="user_call:{id}"`
   at read time (my preference — no schema change to `iq_calls`);
   (b) add a `pregame_context_snapshot_ref` field to `iq_calls`
   symmetric to the existing `context_snapshot_ref`. Recommend (a) to
   avoid touching 1A's `iq_calls` contract.
4. **Weighted starter save_pct in Last-N aggregates.** Simple average of
   per-game save_pct, or shots-weighted (sum saves / sum shots_against)?
   Recommend shots-weighted — mathematically honest and matches how
   real save_pct works across a sample.
5. **`insufficient_data` threshold for presumed starter.** Below 2
   starts in Last-3? Below 1? Recommend: if fewer than 2 completed
   starts appear in Last-3, return `insufficient_data`.

None of these are blockers. All can be decided at build-approval time.

---

## Summary

Foundation 1C is a **derivation layer** over 1A + 1B, plus a small
append-only snapshot collection that pins the derivation at Betting
IQ's actual decision moments. One new collection. Zero changes to
frozen layers. Every null field is attributed. Every inferred field
is labeled. Every read is deterministic given `(ticker_game_id, as_of)`
because both temporal gates are already enforced upstream.

That is the layer Betting IQ signals can honestly stand on later:
Ticker's provable pregame belief at the exact moment it mattered.

Awaiting approval. No code and no DB changes until you say go.
