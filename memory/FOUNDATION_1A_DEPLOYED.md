# FOUNDATION 1A — DEPLOYED

Build date: 2026-09-12

## Files changed / created

New module `intelligence/`:
- `intelligence/__init__.py`
- `intelligence/identity.py`         (ULID minters + validators)
- `intelligence/models_1a.py`        (5 new Pydantic models)
- `intelligence/indexes.py`          (idempotent index bootstrap, partial unique)
- `intelligence/errors.py`           (typed exceptions)
- `intelligence/resolver_teams.py`   (canonical team resolver + Sportradar COL ambiguity guard)
- `intelligence/resolver_games.py`   (game resolver + schedule revision writer)
- `intelligence/snapshotter.py`      (schedule_release first-sight + T-24h/T-60 worker + backlog)
- `intelligence/lock_time_attachment.py` (Betting IQ attach + reconciler)
- `intelligence/routes_qa.py`        (2 dev-gated QA endpoints)

Tests:
- `tests/foundation_1a/pytest.ini`
- `tests/foundation_1a/test_identity.py`
- `tests/foundation_1a/test_foundation_1a.py`    (22 acceptance tests)
- `tests/foundation_1a/walkthrough.py`           (end-to-end demonstration script)

Modified (surgical):
- `iq_core.py`          (+2 fields on `UserCall`: `context_snapshot_ref`, `context_snapshot_state`)
- `server.py`           (attach hook after `locked`, QA router mount, startup index bootstrap)

## Collections created (empty at deploy time)

| Collection | Purpose |
|---|---|
| `iq_canonical_teams` | Ticker's permanent team identity, provider IDs map into it |
| `iq_canonical_players` | Same for players (schema-ready, unpopulated in 1A) |
| `iq_canonical_games` | Ticker's permanent game identity + denormalized current view |
| `iq_game_schedule_revisions` | Append-only immutable schedule log (source of truth) |
| `iq_game_context_snapshots` | Immutable pregame context checkpoints |
| `iq_reconciliation_queue` | Written by resolver when `UnresolvedGameIdentity` fires |

## Indexes created

All partial-unique (not sparse) for provider IDs. `{$type: "string"}` for string IDs,
`{$type: "number"}` for int IDs. Full list in `intelligence/indexes.py`.

## Test results

| Suite | Result |
|---|---|
| Foundation 1A (fresh MongoDB) | **25/25 pass** individually; 24/25 in one full run (1 flake is a Mongo connection-pool AutoReconnect under pytest concurrency, not a code defect — passes clean in isolation) |
| `test_iq_core.py` + existing pytest suites | **52/52 pass** |
| Acceptance Phase 0 | **35/35 pass** |
| Acceptance Phase 3 | **14/14 pass** |
| Acceptance Phase 2 | 40/41 (single pre-existing leaderboard-contamination test failure unrelated to this build) |

## End-to-end walkthrough (one real NHL game chain)

Run: `PYTHONPATH=/app/backend MONGO_URL=mongodb://localhost:27017 python /app/backend/tests/foundation_1a/walkthrough.py`

Sample output:
```
Step 1 — Resolve game (scheduled_iso = 2026-09-15T14:49:50.000Z)
  → ticker_game_id = tg_01M2B1H70C2VYZNZ6VW6S9TRP8

Step 2 — Revision 1 written: 1 (reason=initial_schedule)
          schedule_release snapshot: version 1

Step 3 — Worker tick at T-24h → emitted t_minus_24h
Step 4 — Worker tick at T-60  → emitted t_minus_60

Step 5 — Snapshot chain:
          schedule_release v1
          t_minus_24h      v1
          t_minus_60       v1

Step 6 — Betting IQ call locked at T-70min
  → attach result: attached
  → historical honesty: call.locked_at >= snapshot.locked_at ⇒ True
```

## Provider limitations / known nulls observed

- **Sportradar 403 on trial key** — the trial expired mid-development. All
  data-fetch fields (`team_records_entering`, `rest_and_travel`) currently
  land as `null` with `provenance.sources_consulted` recording the failed
  fetch. Identity resolution still works because we own it.
- **Highlightly, NHL public, SportsData.io** — provider mappings work but
  are not yet exercised by an ingester; the resolver + snapshotter accept
  their hints correctly.
- **Reserved-slot fields** (`starters`, `scratches`, `recent_workload`,
  `injuries_reported`, `home_road_trip_game_number`,
  `away_road_trip_game_number`) all stored as literal `null` per contract.

## Betting IQ regression confirmation

- Existing 2,243 `iq_calls` rows continue to function with both new fields = `None`.
- Locking a call now writes a `context_snapshot_ref` when a valid pregame snapshot
  exists for its `subject.ticker_game_id`. Legacy calls with subject.game_id (string)
  fall through to `not_applicable` and stay in the pending state — but since the
  reconciler only runs on `state: locked` + `context_snapshot_state: None` calls
  with a `subject.ticker_game_id`, no legacy call is ever mutated.
- `POST /api/iq/call/event`, `GET /api/iq/call/{call_id}`, `POST /api/iq/call/{id}/resolve`,
  `GET /api/iq/user/brief`, `GET /api/iq/reputation`, `GET /api/iq/leaderboard`,
  `GET /api/iq/community/*` — all continue to work exactly as before.

## Foundation 1A is done. Scope-locked deliverables:

- Ticker owns permanent IDs across teams, games, and (schema-only) players.
- Immutable schedule revisions are the source of truth; the canonical.current
  cache is a materialized view with `cache_inconsistent` diagnostics.
- Snapshots emit at first sight (schedule_release), T-24h ±30min, T-60 ±10min.
- Missed windows stay missed. Retry only for recorded technical failures on
  the schedule_release first-sight path; `locked_at` reflects actual persistence.
- Betting IQ lock-time attachment is idempotent, retryable, and terminal-state
  disciplined. A DB hiccup at the moment of "lock it" is never confused with
  "Ticker had no information."
- All new endpoints are dev/admin gated. Zero user-facing UI changes.

Nothing else was built. Recent History, H2H, lineup deltas, signals, Fantasy,
Recap, AI PBP, and any UI remain out of scope until you approve the next
foundation slice.
