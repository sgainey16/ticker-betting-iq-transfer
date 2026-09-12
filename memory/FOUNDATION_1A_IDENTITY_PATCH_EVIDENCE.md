# FOUNDATION 1A IDENTITY PATCH — IMPLEMENTATION + REPAIR EVIDENCE

Executed against live DB on 2026-09-12. Stopping for review.
Foundation 1B remains frozen and untouched at the schema level; one new
correction-reason literal (`canonical_identity_repair`) is used only when
a materially wrong version actually needs correcting.

---

## 1. Exact code change to `_find_natural_close`

`backend/intelligence/resolver_games.py`:

```python
async def _find_natural_close(db, home_id: str, away_id: str, season: str,
                              season_type: str, scheduled_iso: str,
                              hint_provider: Optional[str] = None,
                              hint_provider_game_id: Any = None) -> list[dict]:
    """Return candidates that natural-key close-match this hint.

    Same-provider identity exclusion (approved 1A patch):
        If the incoming hint carries a provider_game_id and a candidate
        already stores an ID for that SAME provider that differs from the
        hint, the candidate is NOT eligible. Same-provider IDs are unique
        per game; a differing same-provider ID means the candidate is a
        different real game, not a reschedule of the hint.
    """
    target = _parse_iso(scheduled_iso)
    lo = (target - _CLOSE_MATCH_WINDOW).isoformat().replace("+00:00", "Z")
    hi = (target + _CLOSE_MATCH_WINDOW).isoformat().replace("+00:00", "Z")
    query: dict[str, Any] = {
        "competition": "NHL", "season": season, "season_type": season_type,
        "home_team_id": home_id, "away_team_id": away_id,
        "current.scheduled_iso": {"$gte": lo, "$lte": hi},
    }
    if hint_provider and hint_provider_game_id is not None:
        # Exclude candidates that already carry a same-provider ID that
        # differs from the hint. Candidates with no same-provider ID (null
        # or missing) remain eligible so cross-provider first attachment
        # keeps working.
        field = f"provider_ids.{hint_provider}.id"
        query["$nor"] = [{field: {"$nin": [None, hint_provider_game_id]}}]
    cur = db["iq_canonical_games"].find(query)
    return [g async for g in cur]
```

Caller in `resolve_game()` now passes the hint's provider and provider_game_id
through. Everything else in step 3 is unchanged. The pre-existing POST-only
skip is kept as belt-and-suspenders.

---

## 2. All 9 new test results (Foundation 1A)

All 9 pass. Full list (grouped by amendment intent):

- **T1** `test_reg_same_teams_consecutive_day_home_and_home_stays_separate` ✔
- **T2** `test_reg_pit_fla_real_collision_pattern_stays_separate` ✔ (reproduces the exact live collision with NHL IDs 2025021211 + 2025021223)
- **T3** `test_reg_same_provider_id_postponement_stays_one_canonical` ✔
- **T4** `test_reg_reissued_id_with_positive_evidence_stays_one_canonical` ✔
- **T5** `test_reg_reissued_id_without_evidence_within_72h_now_refuses` ✔
- **T6** `test_cross_provider_first_attachment_still_works` ✔
- **T7** `test_playoff_series_games_get_distinct_ticker_game_ids` (existing) ✔
- **T8** `test_pre_same_teams_consecutive_stays_separate` ✔
- **T9** `test_ambiguity_still_raised_when_multiple_candidates_survive` ✔

---

## 3. Full Foundation 1A regression

**32/32 passing.**

```
tests/foundation_1a/test_foundation_1a.py .............................. [30]
..                                                                       [ 2]
tests/foundation_1a/test_identity.py ...                                 [ 3]

29 + 3 = 32 tests pass. 0 failures. 0 skips.
```

Every pre-existing 1A test (postponement, revisions, snapshots, lock-time
attachment, POST-skip, playoff-series regression) still passes.

## 4. Full Foundation 1B regression

**24/24 passing.**

```
tests/foundation_1b/test_backfill_min_history.py ....                    (4)
tests/foundation_1b/test_goalie_save_pct.py ....                         (4)
tests/foundation_1b/test_projections.py ....                             (4)
tests/foundation_1b/test_recent_history_and_as_of.py ........            (8)
tests/foundation_1b/test_writer_and_versioning.py ....                   (4)
```

Every 1B rule still holds: single collection, append-only, identical-write
no-op, GF/GA from `final_score`, save_pct derived from counts, both
temporal gates (`recorded_at <= as_of` AND `played_at_iso <= as_of`).

**Combined: 59/59 tests pass in 47.62s.** No skips.

---

## 5. PIT–FLA Apr 4 and Apr 5 now resolving to two different `ticker_game_id`s

Verified against the live DB after amendment + repair:

| | Game A (Apr 4) | Game B (Apr 5) |
|---|---|---|
| ticker_game_id | `tg_01M2B79NXVFHQKMQH5E0JFKMT4` | `tg_01M2B63QD72KGDY90WV90K4HR4` |
| provider_ids.nhl_public.id | 2025021211 | 2025021223 |
| newest final played_at | 2026-04-04T21:00:00Z | 2026-04-05T19:00:00Z |
| newest final score | PIT 9 – FLA 4 | PIT 5 – FLA 2 |
| newest record_version | 1 (initial) | 3 (canonical_identity_repair) |

The two games are permanently distinct canonicals.

---

## 6. Each NHL provider ID attached to exactly one correct canonical game

```
nhl_id=2025021211 → 1 canonical (Game A)
nhl_id=2025021223 → 1 canonical (Game B)
```

No shared, no orphaned. Every NHL id maps to one and only one `ticker_game_id`.

---

## 7. Repaired iq_game_finals chains

**Game B — original canonical `tg_01M2B63QD72KGDY90WV90K4HR4`:**

| version | played_at | score | reason | source |
|---|---|---|---|---|
| v1 | 2026-04-05T19:00:00Z | PIT 5 – FLA 2 | `initial` | `gamecenter/2025021223/boxscore` |
| v2 | 2026-04-04T21:00:00Z | PIT 9 – FLA 4 | `provider_late_data` | `gamecenter/2025021211/boxscore` |
| v3 | 2026-04-05T19:00:00Z | PIT 5 – FLA 2 | `canonical_identity_repair` | `gamecenter/2025021223/boxscore` |

v2 remains in the append-only log — that IS the historical evidence that
Ticker temporarily believed the wrong truth. v3 restores rightful truth.
Latest-version selection returns v3 (Game B's real score) for present-time
and any as_of reads that post-date the repair.

**Game A — new canonical `tg_01M2B79NXVFHQKMQH5E0JFKMT4`:**

| version | played_at | score | reason | source |
|---|---|---|---|---|
| v1 | 2026-04-04T21:00:00Z | PIT 9 – FLA 4 | `initial` | `gamecenter/2025021211/boxscore` |

Clean v1 minted under the amended resolver.

---

## 8. Confirmation no unnecessary duplicate version was created

- Game A's chain has exactly one row (v1). No bookkeeping duplicate.
- Game B's chain has one corrective row (v3). It was only written because
  the newest existing version (v2) was **materially different** from the
  rightful game's truth — the writer's own `_truth_view` compared v2
  against the intended payload and confirmed they differed, so a real
  corrective record was justified. If v2 had already matched Game B's
  truth, the repair would have no-op'd on the chain and left it alone
  (this branch is coded and exercised by `write_game_final`'s existing
  identical-write no-op logic, which is covered by
  `test_correction_1_identical_payload_is_noop`).
- The repair script is idempotent. Second run returned:
  ```
  collisions_detected: 0
  collisions_repaired: 0
  ```
  No further writes occurred.

---

## 9. Confirmation REG postponement, POST, and PRE behavior remain correct

Directly proven by the test matrix:

- REG postponement (same provider ID) → **T3 passes**. Step 2 handles it,
  same tgid, revision 2 written.
- REG reissued-ID postponement with positive evidence → **T4 passes**.
  Step 4 positive-evidence path returns same tgid.
- REG reissued-ID postponement without evidence → **T5 passes**. Correctly
  refuses via `UnresolvedGameIdentity`, no new canonical minted.
- REG cross-provider first attachment → **T6 passes**. `nhl_public`
  canonical still absorbs a `sportsdata_io` hint for the same game
  because the candidate carries no `sportsdata_io.id`.
- POST regression (playoff Games 1 & 2 within 72h) → **T7 passes**.
- PRE symmetric behavior (exhibition series within 72h stays separate)
  → **T8 passes**.
- Regular-season postponement natural-key path (cross-provider variant)
  → pre-existing `test_regular_season_postponement_still_uses_natural_key`
  passes.

---

## 10. Files touched

- `backend/intelligence/resolver_games.py` — amendment to `_find_natural_close`
  + one caller update. ~15 lines net.
- `backend/intelligence/models_1b.py` — one new `CorrectionReason` literal
  (`canonical_identity_repair`), used only when an actual corrective
  version is required. No schema widening.
- `backend/intelligence/repair_collided_canonicals.py` — new one-shot
  idempotent repair script (~190 lines). Not wired into any startup path;
  intended to be run once against production data.
- `backend/tests/foundation_1a/test_foundation_1a.py` — 8 new test
  functions (T1–T6, T8, T9; T7 already existed).

Nothing else in Foundation 1A or 1B was modified. The Foundation 1B
frozen schema stands.

---

## 11. Summary — evidence checklist

| Item | Status |
| --- | --- |
| Exact code change to `_find_natural_close` | §1 — same-provider `$nor` filter |
| All 9 new test results | §2 — 9/9 pass |
| Full Foundation 1A regression | §3 — 32/32 pass |
| Full Foundation 1B regression | §4 — 24/24 pass |
| PIT–FLA now resolve to two different tgids | §5 — confirmed |
| Each NHL id attached to exactly one canonical | §6 — confirmed |
| Repaired iq_game_finals chains | §7 — Game A: v1 initial; Game B: v1, v2 (audit), v3 identity-repair |
| No unnecessary duplicate version created | §8 — Game A has only v1; Game B's v3 was material; second repair pass = 0 writes |
| REG postponement / POST / PRE behavior correct | §9 — proven via T3–T8 |

Ready for freeze on your signal. Holding on Foundation 1C.
