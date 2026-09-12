# Foundation 1A · Operational Activation — Deployed

Activated: 2026-09-12

## What ran

Executed `intelligence/activate.py` against production MongoDB
(`test_database`) using **NHL Public API only** for this pass. No
Sportradar (trial 403). SportsData.io + Highlightly available but not
wired into the schedule ingester in this pass — reserved for later.

## Data written

| Collection | Rows |
|---|---|
| `iq_canonical_teams` | **32** NHL teams (every appearance in the next 14 days) |
| `iq_canonical_games` | **51** upcoming real NHL games |
| `iq_game_schedule_revisions` | **51** (all `revision_number = 1`, `reason = "initial_schedule"`) |
| `iq_game_context_snapshots` | **51** `schedule_release` snapshots (kind = `schedule_release`, version = 1) |
| `iq_reconciliation_queue` | 0 |

## Proof — one real upcoming NHL game

**DAL @ STL · 2026-09-19T23:00:00Z · Enterprise Center**

```
ticker_game_id:  tg_01M2B233ZXCJJMZJY5DNTTSZX8
NHL public id:   2026010001
home_team_id:    tt_01M2B233YDSNMBZNSM71FD4R7X (STL, nhl_public tri_code=STL)
away_team_id:    tt_01M2B233YFNZV7TSP75X4W1RK0 (DAL, nhl_public tri_code=DAL)

revision 1:      reason=initial_schedule
                 scheduled_iso=2026-09-19T23:00:00Z
                 status=scheduled
                 locked_at=2026-09-12T14:59:37.091Z

schedule_release v1:
                 locked_at=2026-09-12T14:59:37.099Z
                 provenance.sources_consulted=[
                   {"name": "nhl_public",
                    "endpoint": "canonical_game_first_sight",
                    "http_status": 200}
                 ]

cache_inconsistent: false
snapshots_available: schedule_release=1/1, t_minus_24h=null, t_minus_60=null
```

Verified live via `GET /api/iq/game-context/tg_01M2B233ZXCJJMZJY5DNTTSZX8`
against the preview backend.

## Field population map (this real game)

**Populated (from NHL Public):**
- `scheduled_iso_at_snapshot`, `home_team_id`, `away_team_id`, `venue`,
  `provider_ids.nhl_public.id`, `season`, `season_type`, `status`

**Null because Sportradar unavailable (trial 403):**
- `provider_ids.sportradar.id` — every slot cleanly null. Provenance
  never claims Sportradar was consulted.

**Null because the ingester for that source is not wired in this pass**
(deliberate, not fabricated):
- `team_records_entering.home` / `.away` — SportsData.io standings is
  reachable but not yet invoked by this activation pass. Reserved
  for a future ingester slice.
- `rest_and_travel.home_days_rest` / `.away_days_rest`
- `rest_and_travel.home_back_to_back` / `.away_back_to_back`
- `rest_and_travel.home_prior_consecutive_road_games` / `.away_prior_consecutive_road_games`
  — all require a historical schedule scan (that scan is what Foundation 1B
  Recent History delivers). Correctly left null.

**Null because reserved (schema forbids population in 1A):**
- `rest_and_travel.home_road_trip_game_number` / `.away_road_trip_game_number`
- `recent_workload.*`, `starters.*`, `scratches.*`, `injuries_reported`

## Regression status after activation

| Suite | Result |
|---|---|
| Foundation 1A | **25/25 pass** |
| pytest suites (`test_iq_core`, `test_bet_csv_parser`, `test_stats_and_ticker`) | **52/52 pass** |
| Phase 0 acceptance | **35/35 pass** |
| Phase 3 acceptance | **14/14 pass** |

No regressions. No manufactured historical snapshots. No UI touched.

## Next natural behavior (no code needed)

The 51 upcoming games now sit in the spine. When the periodic snapshotter
worker runs inside their T-24h ±30min and T-60 ±10min windows, it will
emit `t_minus_24h` and `t_minus_60` snapshots naturally. Missed windows
stay missed — no backfill. (The worker is available via
`intelligence.snapshotter.worker_tick(db)`; wiring it to a scheduled
background job is a separate small task if you want it running
automatically before Foundation 1B.)

## Foundation 1A is FROZEN

Architecture accepted. Spine live with real NHL data. Ready to move to
Foundation 1B (Recent History) whenever you authorize it.
