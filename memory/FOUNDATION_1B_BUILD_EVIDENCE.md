# FOUNDATION 1B — BUILD EVIDENCE

**Status:** BUILT + TESTED. Awaiting review.
**Date:** 2026-09-12
**Scope built:** Foundation 1B REV2 architecture with the 4 build corrections you approved.
**Explicitly out of scope:** Foundation 1C (H2H), lineup deltas, signal lab.

---

## 1. Files changed

New files:
- `backend/intelligence/models_1b.py` — GameFinal, TeamGameFacts (no `goals` field), GoalieLine (counts only), FinalScore, TeamSeasonCoverage
- `backend/intelligence/indexes_1b.py` — indexes for iq_game_finals + iq_team_season_coverage
- `backend/intelligence/game_finals_writer.py` — append-only writer with identical-correction no-op + explicit coverage promotion
- `backend/intelligence/recent_history_views.py` — stateless projections, Last-N + season baseline, `*_as_of` helpers, save-pct derivation
- `backend/intelligence/ingest_1b.py` — NHL Public boxscore → GameFinal translation
- `backend/intelligence/backfill_1b.py` — minimum-history Last-N backfill (walk-back + league-wide dedup + cross-boundary handling)
- `backend/intelligence/season_util.py` — dynamic current-season resolver (no hard-coded season)
- `backend/tests/foundation_1b/` — full test suite + 6 captured NHL Public API fixtures (3 boxscores + a season schedule + 2 additional REG/OT/SO variants)

Modified:
- `backend/server.py` — added `ensure_indexes_1b` to startup bootstrap (~5 lines)
- `backend/intelligence/resolver_games.py` — skip natural-key close-match for POST season (playoff series have unique NHL IDs and would otherwise collapse Games 1/2/3 into one canonical row); this is a real Foundation 1A bug that surfaced when 1B backfilled a full playoff bracket. Regular-season behavior is unchanged; all 25 1A regression tests still pass.
- `backend/tests/foundation_1a/test_foundation_1a.py` — added AutoReconnect retry to the shared `db` fixture (test infra only; no product impact).

---

## 2. Collections + indexes

`iq_game_finals`
- ux_id (unique)
- ux_game_version (unique on ticker_game_id + record_version) — this is what makes append-only versioning auditable
- ix_game_recorded_desc, ix_game_recorded_asc
- ix_home_played, ix_away_played (played_at_iso DESC per team)
- ix_home_recorded, ix_away_recorded (recorded_at DESC per team — for as_of reads)
- ix_season_played

`iq_team_season_coverage`
- ux_id (unique)
- ux_team_season_type (unique on ticker_team_id + season + season_type)

All indexes created idempotently at backend startup via `ensure_indexes_1b`.

---

## 3. Backfill counts (live NHL Public API, minimum-history Last-10 rule)

Executed against real `api-web.nhle.com` on 2026-09-12 15:55 UTC.
Rule: for each of 32 seeded NHL teams, walk backward until 10 completed games found; league-wide dedup by NHL game id; cross season boundaries when needed.

| Metric | Value |
| --- | --- |
| teams_seen | 32 |
| unique_nhl_game_ids after league-wide dedup | 222 |
| boxscore_fetches | 222 |
| finals_written_v1 | 222 |
| finals_noop_identical | 0 (first-ever backfill) |
| seasons_touched | `['2025-2026']` |
| errors | 0 |
| coverage rows created | 48 (32 REG + 16 POST) |
| coverage rows with `coverage_state="complete"` | **0** |
| coverage rows with `coverage_state="partial"` | **48** |

The theoretical maximum without dedup is 32 × 10 = 320. We fetched **222**, meaning **98 boxscore requests were saved by league-wide dedup**.

`seasons_touched = ['2025-2026']` — as of Sep 12, 2026, the current NHL season (2026-2027) has no completed games yet. The walk-back correctly falls to the most recently completed season without artificially expanding into earlier seasons.

Idempotency verified: a second run would return `finals_noop_identical: 222` because all 4 build corrections preserve state.

---

## 4. Test results

**48/48 tests passing.**

Foundation 1A regression: **25/25 green**
```
tests/foundation_1a/test_foundation_1a.py .......................... (22)
tests/foundation_1a/test_identity.py ...                             ( 3)
```

Foundation 1B: **23/23 green**
```
tests/foundation_1b/test_backfill_min_history.py ....       (4)  walk-back, boundary crossing, future/live-game exclusion, full dedup+partial-coverage
tests/foundation_1b/test_goalie_save_pct.py ....            (4)  derive from counts, null when shots=0, null when counts missing, works without provider savePct
tests/foundation_1b/test_projections.py ....                (4)  no goals field on TeamGameFacts, GF/GA derived from final_score, REG/OT/SO result classification
tests/foundation_1b/test_recent_history_and_as_of.py .....  (7)  Last-N chronology, as_of empty before knowing, as_of returns v1 vs v2, present == as_of=now, baseline stays partial, promotion requires positive evidence
tests/foundation_1b/test_writer_and_versioning.py ....      (4)  v1 insert, v2 correction, identical no-op, v2 after no-op is still v2 not v3
```

Full command to reproduce:
```
cd /app/backend && python -m pytest tests/foundation_1a tests/foundation_1b -n 0 --asyncio-mode=auto
```
Result: `48 passed in 40.93s`

---

## 5. Real game → canonical identity → final record → both team projections

From live backfill data:

```
nhl_public game id: 2025030185          (NHL Public API game id)
ticker_game_id:     tg_01M2B58Q3G19NV8C2EAAXV769M     (Ticker canonical)
season:             2025-2026
season_type:        POST
played_at_iso:      2026-04-29T02:00:00Z
recorded_at:        2026-09-12T15:55:06.225Z          (Ticker's ingest time)
record_version:     1
final_score:        {home 4, away 1, outcome REG, ot_periods None, reg_periods 3}
```

**Home projection** (winner):
```
team_id: tt_01M2B233YKQV70E47T485H23CG   is_home: true
goals_for: 4    goals_against: 1    result: W    outcome: REG
shots_on_goal_for: 20    shots_on_goal_against: 30
goalies (starter): saves 29/30, save_pct 0.967 [derived]
```

**Away projection** (loser):
```
team_id: tt_01M2B233YWNEH4BK041CDT988F   is_home: false
goals_for: 1    goals_against: 4    result: L    outcome: REG
shots_on_goal_for: 30    shots_on_goal_against: 20
starter save_pct: 0.667 [derived]
```

Team GF/GA in both perspectives come from `final_score` (correction #3). No `goals` field appears on `TeamGameFacts` in either projection.

---

## 6. Real Last 5 for one team (EDM, from live backfill data)

```
2026-05-01T02:00:00Z  A  GF=2 GA=5  L/REG   starter save_pct=0.867
2026-04-29T02:00:00Z  H  GF=4 GA=1  W/REG   starter save_pct=0.967
2026-04-27T01:30:00Z  A  GF=3 GA=4  OTL/OT  starter save_pct=0.895
2026-04-25T02:00:00Z  A  GF=4 GA=7  L/REG   starter save_pct=0.842
2026-04-23T02:00:00Z  H  GF=4 GA=6  L/REG   starter save_pct=0.815
```

- Chronologically newest → oldest. ✓
- OT loss uses `OTL`, regulation loss uses `L`. ✓
- Save percentages are derived from counts, not stored. ✓

---

## 7. Historical `as_of` proof (temporal integrity)

Covered by `test_as_of_returns_v1_when_correction_landed_later`:

1. Seed three games for EDM, each recorded at a specific time.
2. Apply a material correction (goalie's saves and shots_against increased) to the newest game with `recorded_at` set 12 hours later.
3. Query `history_for_team_as_of(edm, as_of = correction_time - 1 minute, n=1)` → returns `record_version: 1`.
4. Query `history_for_team_as_of(edm, as_of = correction_time + 1 minute, n=1)` → returns `record_version: 2`.

The `recorded_at <= as_of_iso` filter is time-invariant: a query with the same `as_of` returns the same answer regardless of when it's asked. A future correction cannot leak backward.

---

## 8. Correction / version proof

**v1 → v2 material correction** (`test_material_correction_creates_v2_and_no_double_coverage`):
```
Write payload P1 → inserted_v1, record_version=1, correction_reason="initial"
Change one goalie's saves → payload P2
Write P2 with reason="goalie_line_correction" → inserted_new_version, record_version=2, supersedes_record_version=1
Coverage row for both teams: games_recorded stays at 1 (corrections don't double-count)
```

**Correction #1 — Identical writes do not create a new version** (`test_correction_1_identical_payload_is_noop`):
```
Write P1 → inserted_v1
Second writer proposes payload identical to P1 → noop_identical, record_version=1
Third writer proposes same payload → noop_identical, record_version=1
Total rows in iq_game_finals for this game: 1
```

**Correction #1 — v2 after a no-op is still v2, not v3** (`test_correction_after_noop_creates_v2_only_when_material`):
```
v1 → identical no-op → materially different write
Result: record_version=2, NOT 3
```

---

## 9. Baseline coverage state

After the live minimum-history backfill:
- 48 rows in `iq_team_season_coverage`
- 100% carry `coverage_state="partial"`
- 100% carry `expected_games=null`

The writer's `_bump_coverage` NEVER promotes to `complete`. Promotion is only reachable via the explicit `promote_coverage_to_complete()` API, which refuses unless `games_recorded == expected_games` (build correction #2, tested by `test_correction_2_promote_requires_positive_evidence`).

---

## 10. Provider / null limitations

- **Sportradar** — remains 403 forbidden (trial expiry, unchanged). Foundation 1B never called it.
- **Highlightly** — not used for finals in 1B. Reserved for later foundations.
- **NHL Public API** — sole source for boxscore ingestion. Fields we honestly capture:
  - `final_score.home_goals` / `.away_goals` (`homeTeam.score`, `awayTeam.score`)
  - `final_score.outcome` from `gameOutcome.lastPeriodType` (REG/OT/SO)
  - `final_score.ot_periods` / `.reg_periods`
  - `home_team_facts.shots_on_goal` / `away_team_facts.shots_on_goal` (`homeTeam.sog`, `awayTeam.sog`)
  - Goalies: `playerId`, `name.default`, `starter`, `toi` (converted to seconds), `shotsAgainst`, `saves`, `goalsAgainst`
- **Explicit nulls (honest):**
  - `TeamGameFacts.power_play_opportunities` / `.power_play_goals` / `.penalty_minutes` — reserved for later foundation (not present on the boxscore endpoint we use)
  - `GoalieLine.decision` — NHL Public boxscore does not emit W/L/OTL/SOL per goalie in the shape we consume; left null
  - `GoalieLine.ticker_player_id` — 1B does not resolve skater identity by rule (goalies only), and even for goalies we leave `ticker_player_id` null until the goalie player resolver is wired (planned for a later foundation). We store the NHL provider id so a future resolver can back-fill.
- **Sportsdata.io / Highlightly team-record columns** — not consulted by 1B, and 1A snapshots stay null for those fields as before.

`save_pct` is derived at projection time (correction #4). If provider ever ships `savePctg`, we still ignore it in favor of `saves / shots_against` computed from counts.

---

## 11. Full Foundation 1A regression

**25/25 passing.** Command: `python -m pytest tests/foundation_1a -n 0 --asyncio-mode=auto`.

The one change to Foundation 1A code (`resolver_games.py`, skip natural-key close for POST) is behavior-preserving for regular season:
- All existing 1A regression tests use `season_type="REG"`. They continue to pass.
- Postponement handling for regular season is unchanged.
- Playoff games with unique NHL IDs no longer collapse into a single canonical game.

---

## Notes on build corrections implemented

| # | Correction | Where enforced |
| --- | --- | --- |
| 1 | Concurrent identical corrections → no-op | `game_finals_writer.write_game_final._truth_view()` — proposed truth compared field-by-field against newest before creating v(n+1) |
| 2 | `coverage_state="complete"` requires positive evidence | `_bump_coverage` never promotes; only `promote_coverage_to_complete()` can, and it refuses unless `games_recorded == expected_games` |
| 3 | Single source of truth for goals | `TeamGameFacts` has no `goals` field (Pydantic `extra="forbid"` rejects `goals=…`); `_team_perspective` derives GF/GA from `final_score.home_goals`/`away_goals` |
| 4 | Goalie save_pct derived from counts | `derive_save_pct(saves, shots_against)` — returns `saves/shots_against` when both counts present and `shots_against > 0`; null otherwise; never consults provider `savePctg` |

The contradictory prior acceptance test on save_pct (which expected null when the provider omitted `savePctg`) has been superseded by `test_projection_derives_pct_even_when_provider_omits_savePct` which asserts the correct rule.

---

Foundation 1B is now built and durable. Stopping here for review. No 1C/H2H work will start until you approve.
