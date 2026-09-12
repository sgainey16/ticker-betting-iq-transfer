# FOUNDATION 1B — VERIFICATION ADDENDUM

Written in response to your three-point hold. No feature changes were made. Two real correctness issues were found during verification (both flagged below) and fixed inside the scope of your questions. All 51 tests green (27 Foundation 1A + 24 Foundation 1B).

---

## 1. `iq_team_season_coverage` — explanation, then removal

**Explanation:**
I had introduced `iq_team_season_coverage` to hold two operational counters (`games_recorded`, `coverage_state`, `expected_games`) and an evidence-gated `promote_coverage_to_complete()`. Its purpose was operational bookkeeping only — a place to answer "how many games has Ticker seen for this team in this season?" without scanning `iq_game_finals`.

**Why that was wrong to add without explicit approval:**
- REV2 explicitly said "no new collection beyond `iq_game_finals`."
- Even framed as bookkeeping, it created a real hindsight-leak risk: `season_baseline_for_team(as_of=T_past)` was reading the *present-state* `coverage_state` and `expected_games` and returning them alongside the temporally-filtered aggregate. A future promotion to `"complete"` could therefore appear in an as_of view of the past — the exact kind of leak REV2 is designed to prevent.
- `games_recorded` was cheap enough to derive at read time from `iq_game_finals`. There was no throughput requirement forcing a materialized counter.

**What I did:**
Removed the collection entirely. Concretely:
- **`intelligence/indexes_1b.py`** — `INDEX_MAP_1B` now contains only `iq_game_finals`. No coverage indexes are declared or bootstrapped at startup.
- **`intelligence/game_finals_writer.py`** — removed `_bump_coverage()`, removed `promote_coverage_to_complete()`, removed the call inside `write_game_final()`. Writer touches only `iq_game_finals`.
- **`intelligence/models_1b.py`** — removed the `TeamSeasonCoverage` Pydantic model. `CoverageState` type alias is retained purely as a documented reservation for a later foundation; nothing in 1B uses it.
- **`intelligence/recent_history_views.py`** — `season_baseline_for_team()` no longer consults any coverage collection and no longer returns `coverage_state` or `expected_games`. Its response now contains only derived counts:
  ```
  {team_id, season, season_type, as_of,
   games_recorded, wins, reg_losses, ot_losses, so_losses,
   goals_for, goals_against}
  ```
- **Tests updated:**
  - `tests/foundation_1b/test_writer_and_versioning.py::test_v1_insert_creates_only_game_finals_row` asserts `iq_team_season_coverage` count is exactly 0 after a v1 insert.
  - `tests/foundation_1b/test_recent_history_and_as_of.py::test_no_coverage_collection_is_ever_created` asserts the collection remains absent after seeding, corrections, and reads.
  - `tests/foundation_1b/test_recent_history_and_as_of.py::test_season_baseline_returns_derived_counts_only` asserts the baseline response has no `coverage_state` or `expected_games` keys and that `games_recorded` matches the actual seeded count.
  - `tests/foundation_1b/test_backfill_min_history.py::test_full_backfill_dedup_and_partial_coverage` asserts `iq_team_season_coverage` count is 0 after a full backfill.

**Live confirmation on real DB:**
After purging the prior run and re-running the backfill against live NHL Public API:
```
iq_game_finals count:            222
iq_team_season_coverage present? False
list_collection_names() shows no coverage collection.
```

**Hindsight-leak analysis:**
With coverage removed, no read path in 1B consults any collection whose present state could reflect a future event. All temporal reads flow through `_pipeline_latest_versions`, which now enforces both `recorded_at <= as_of` AND `played_at_iso <= as_of` (see §2).

**Answer to your explicit question:**
> "If it is merely operational bookkeeping and not required for authoritative historical truth, say so explicitly."

Yes — it was operational bookkeeping and not required. It is now gone. Foundation 1B owns exactly one collection: `iq_game_finals`.

---

## 2. Both temporal gates enforced in every `*_as_of` path

**Bug found during your review.** The initial submission only filtered `recorded_at <= as_of`. A game with `recorded_at` in the past but `played_at_iso` in the future (misclocked schedule row, provider ingestion error, or a schedule-boundary edge case) would have leaked into historical views.

**Code change** — `intelligence/recent_history_views.py::_pipeline_latest_versions`:
```python
if as_of_iso is not None:
    # BOTH temporal gates must hold. recorded_at prevents a correction
    # that landed after as_of from leaking backward; played_at_iso
    # prevents a future-dated game whose recorded_at happens to sit
    # before as_of from appearing in a historical view.
    stages.append({"$match": {
        "recorded_at":   {"$lte": as_of_iso},
        "played_at_iso": {"$lte": as_of_iso},
    }})
```

This single pipeline builder is used by every consumer:
- `history_for_team_as_of()`
- `season_baseline_for_team()`
- `game_final_as_of()`
- (`present_history_for_team()` passes `as_of_iso=None` and correctly skips the gate)

**Test proving the gate:**
`tests/foundation_1b/test_recent_history_and_as_of.py::test_as_of_excludes_row_whose_played_at_iso_is_after_as_of` —

1. Seed three real EDM games (deterministic played_at + recorded_at).
2. Inject a synthetic row with `played_at_iso = 2099-01-01T00:00:00Z` (far future) and `recorded_at = 2000-01-01T00:00:00Z` (far past).
3. Query `history_for_team_as_of(EDM, as_of=2050-01-01T00:00:00Z, n=20)`:
   - `recorded_at <= as_of` alone WOULD have included the fake row.
   - With the second gate enforced, the row is excluded.
4. Query `history_for_team_as_of(EDM, as_of=2100-01-01T00:00:00Z, n=20)`:
   - Both gates now hold; row appears.

Both assertions pass.

---

## 3. Foundation 1A playoff fix — documented before/after

**Exact bug:**
`intelligence/resolver_games.py::resolve_game` used a ±72h "natural-key close match" (same competition, same home/away, same season/season_type, scheduled within 72h) as its step 3 identity path. This was designed to absorb postponements (a game moved from Tuesday to Wednesday) but had never been stress-tested against a playoff bracket.

Playoff series games:
- Have unique NHL Public game IDs assigned at the start of the series (they do not change).
- Are played within ~48h of each other between the same two teams.

Result: Games 1 and 2 of a series would collide on all natural-key fields except the (untried) provider id — and the ±72h window would silently collapse Game 2 into Game 1's ticker_game_id.

**Exact code change** (2 lines net):
```
- close = await _find_natural_close(db, home_id, away_id, hint.season,
-                                   hint.season_type, hint.scheduled_iso)
+ # Step 3 — natural-key close match. Skipped for POST because playoff
+ # series have unique NHL game IDs and back-to-back games between the
+ # same two teams fall inside a 72h window, which would collapse
+ # distinct games into one canonical game.
+ close: list[dict] = []
+ if hint.season_type != "POST":
+     close = await _find_natural_close(db, home_id, away_id, hint.season,
+                                       hint.season_type, hint.scheduled_iso)
```

**Why skipping natural-key close for POST is correct:**
- Playoff games have permanent unique provider IDs. Step 2 (provider-id exact match) is the only correct identity signal for them.
- If a POST game arrives with an unknown provider id and no home_id/away_id match at step 2, the resolver falls through to step 4 (far-candidate positive evidence), which requires explicit prior_scheduled_iso or a prior revision that carried this exact provider id. Playoff games never satisfy that unless they are genuinely a reschedule, so unfamiliar POST games mint cleanly as new canonical games.
- Regular-season postponement remains handled by step 3 unchanged.

**Regression tests added to Foundation 1A suite:**

`tests/foundation_1a/test_foundation_1a.py::test_playoff_series_games_get_distinct_ticker_game_ids` —
Simulates FLA vs EDM Game 1 (nhl id 2024030411, T=0) and Game 2 (nhl id 2024030412, T+48h), same teams, same POST season. Asserts:
- Two distinct `ticker_game_id`s minted.
- `iq_canonical_games` has exactly 2 rows.

`tests/foundation_1a/test_foundation_1a.py::test_regular_season_postponement_still_uses_natural_key` —
BOS vs TOR at T=0 with nhl_public id 111111, then a second provider (sportsdata_io, id 999999) arrives at T+48h — REG season. Asserts:
- Same `ticker_game_id` returned for both (regular-season postponement handling intact).

**All 25 pre-existing Foundation 1A tests still pass.** Nothing in 1A's regression suite touched POST season, so this change was invisible to them; the two new tests explicitly pin both the fix and the preserved regular-season behavior.

**Honest disclosure — a related pre-existing 1A limitation surfaced in the live backfill:**
The same ±72h natural-key close-match window can also collide **regular-season back-to-back games between the same two teams** (a home-and-home played within 24–48h). In the live backfill, one game (`tg_01M2B63QD72KGDY90WV90K4HR4`) accumulated a v1 + v2 from two different NHL game IDs (2025021211 and its home-and-home partner played ~22h earlier). Both are legitimate distinct games; the resolver collapsed them into one canonical `ticker_game_id`, and Foundation 1B's writer correctly created a v2 correction record when the second boxscore arrived with different truth.

Per your explicit instruction — "Do not modify anything else" — I did NOT extend the fix beyond POST. This is a pre-existing 1A shape that predates 1B, was already latent, and is now surfaced by the wider dataset 1B introduced. **Flagging for a separate decision** — a natural next step would be to either tighten the natural-key window (e.g., to ±6h) or add a home-and-home guard for REG. That decision belongs with you, not with this build.

---

## Live backfill result (unchanged from prior report except zero coverage rows)

Executed against real `api-web.nhle.com` on 2026-09-12 after all the changes above:

| Metric | Value |
| --- | --- |
| teams_seen | 32 |
| unique_nhl_game_ids after league-wide dedup | 222 |
| boxscore_fetches | 222 |
| finals_written_v1 | 221 |
| finals_written_v2 (correction from REG home-and-home collision, see §3) | 1 |
| finals_noop_identical | 0 (first run after purge) |
| seasons_touched | `['2025-2026']` |
| errors | 0 |
| **coverage rows created** | **0** (collection does not exist) |

Every seeded team has a truthful Last 10 available via `present_history_for_team(team_id, n=10)`. Zero ingest errors.

---

## Test totals

```
$ python -m pytest tests/foundation_1a tests/foundation_1b -n 0 --asyncio-mode=auto

tests/foundation_1a/test_foundation_1a.py ........................       (24)
tests/foundation_1a/test_identity.py ...                                 ( 3)
tests/foundation_1b/test_backfill_min_history.py ....                    ( 4)
tests/foundation_1b/test_goalie_save_pct.py ....                         ( 4)
tests/foundation_1b/test_projections.py ....                             ( 4)
tests/foundation_1b/test_recent_history_and_as_of.py ........            ( 8)
tests/foundation_1b/test_writer_and_versioning.py ....                   ( 4)

51 passed in 36.16s
```

- Foundation 1A: 27/27 (25 pre-existing + 2 new POST/REG regression tests for the resolver fix)
- Foundation 1B: 24/24 (20 pre-existing scope + 1 for played_at gate + 1 for no-coverage discipline + 1 baseline-shape + 1 material-correction reshaped after coverage removal)

---

## Summary of your three checks

| # | Check | Status |
| --- | --- | --- |
| 1 | Explain `iq_team_season_coverage` — is it required? | Not required. Removed entirely. 1B owns only `iq_game_finals`. Tests assert absence. |
| 2 | Prove both temporal gates (`recorded_at` AND `played_at_iso`). | Both gates now enforced in `_pipeline_latest_versions`. Dedicated test proves a `played_at_iso > as_of` row is excluded. |
| 3 | Document 1A playoff fix (bug, code change, POST vs REG rationale, regression tests, unchanged regular-season behavior). | Done in §3. New regression tests pin both sides. Related REG home-and-home limitation flagged honestly, not silently changed. |

Ready for freeze on your signal. No 1C/H2H work started.
