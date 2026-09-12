# FOUNDATION 1A — NARROW IDENTITY PATCH REVIEW

Scope: diagnose + propose fix. **No code changes.** No 1B changes. No 1C work.

The Foundation 1B live backfill surfaced a canonical-identity defect in Foundation 1A's game resolver. Two legitimately distinct regular-season games between the same two teams, played roughly 22 hours apart, were collapsed into a single `ticker_game_id`. This document captures the real collision, explains the current natural-key algorithm, isolates why it protects legitimate cases, proposes the smallest deterministic change, and outlines the required tests and repair path.

---

## 1. Exact real REG collision observed

Reconstructed directly from `iq_canonical_games`, `iq_game_schedule_revisions`, and `iq_game_finals` after the 2026-09-12 backfill.

Both games verified live against `api-web.nhle.com`:

| Field | Game A | Game B |
| --- | --- | --- |
| NHL Public game id | **2025021211** | **2025021223** |
| season | 2025-2026 | 2025-2026 |
| gameType | 2 (REG) | 2 (REG) |
| startTimeUTC | **2026-04-04T21:00:00Z** | **2026-04-05T19:00:00Z** |
| home / away | PIT / FLA | PIT / FLA |
| venue | PPG Paints Arena | PPG Paints Arena |
| final score | PIT 9 – FLA 4 | PIT 5 – FLA 2 |
| gameOutcome | `{lastPeriodType: REG}` | `{lastPeriodType: REG}` |

These are two distinct legitimate games — a same-arena, back-to-back home stack between the same two teams, 22 hours apart. Both are `OFF` (final) in the NHL Public API.

### What happened inside Ticker

Sequence observed:

1. **T=16:09:51.271Z** — Game B (2025021223, Apr-05, 5-2) resolved first for its own team's walk-back. Resolver step 5 minted `ticker_game_id = tg_01M2B63QD72KGDY90WV90K4HR4`, wrote schedule revision #1 with `provider_ids_at_revision.nhl_public.id = 2025021223` and `scheduled_iso = 2026-04-05T19:00:00Z`. Cache set `iq_canonical_games.provider_ids.nhl_public.id = 2025021223`.

2. **T=16:09:51.272Z** — Foundation 1B wrote `iq_game_finals` v1 for that tgid using `gamecenter/2025021223/boxscore` (score 5-2, played 2026-04-05).

3. **T≈16:09:51.5xxZ** — Same tgid reached from another team's walk-back through Game A (2025021211, Apr-04, 9-4). Resolver step 2 (provider-id exact) failed because no canonical carried `nhl_public.id = 2025021211`. Step 3 (natural-key close-match): same competition, same season, same season_type, same home_team_id, same away_team_id, scheduled_iso within `_CLOSE_MATCH_WINDOW = 72h`. **Game B's canonical was the sole close match, so the resolver returned that tgid** and then invoked `_attach_new_provider_id` — which **overwrote** the cached `provider_ids.nhl_public.id` from 2025021223 to 2025021211.

4. **T=16:09:51.533Z** — Foundation 1B wrote `iq_game_finals` v2 for that same tgid using `gamecenter/2025021211/boxscore` (score 9-4, played 2026-04-04), tagged `provider_late_data`.

Resulting state (current):

- Canonical row `tg_01M2B63QD72KGDY90WV90K4HR4`: `provider_ids.nhl_public.id = 2025021211`, cached `current.scheduled_iso = 2026-04-05T19:00:00Z`, `schedule_revision = 1`.
- `iq_game_schedule_revisions`: 1 row (rev 1) still correctly pinned to Game B's original `nhl_id = 2025021223` and `scheduled_iso = 2026-04-05`. (Append-only worked.)
- `iq_game_finals`: 2 rows, v1 = Game B's truth, v2 = Game A's truth. v2 was labeled a "correction" but is in fact a **different game's truth on the wrong canonical row**.
- Game A (2025021211) has NO canonical `ticker_game_id` of its own.

Everything downstream — Last-N views, `_as_of` reads, projections — would ascribe Game A's outcome (9-4) to Game B's canonical identity. This is the exact class of hindsight/identity corruption REV2's discipline is designed to prevent.

Only 1 game in the 32-team, 222-game live backfill hit this. It is a rare pattern (same-arena consecutive-day matchups between the same two teams) but it is real.

---

## 2. Current natural-key matching algorithm

`intelligence/resolver_games.py::resolve_game()` runs, in order:

1. **Step 1** — Resolve `home_team_id`, `away_team_id`.
2. **Step 2** — Provider-id exact match. If any canonical has `provider_ids.{hint.provider}.id == hint.provider_game_id`, return its tgid.
3. **Step 3** — Natural-key close match. Skipped for `season_type=POST` (playoff fix already landed). For all other season types:
   ```
   candidates = iq_canonical_games where
     competition == "NHL"
     season == hint.season
     season_type == hint.season_type
     home_team_id == hint.home_hint→resolved
     away_team_id == hint.away_hint→resolved
     current.scheduled_iso within ±72h of hint.scheduled_iso
   ```
   - 1 candidate → attach hint's provider id and return that tgid.
   - >1 candidates → raise `AmbiguousGameHint`.
4. **Step 4** — Far candidates (>72h away) require **positive evidence of reschedule** (a prior revision that carried this hint's provider_id, or a `supporting_evidence.prior_scheduled_iso` that matches a prior revision on the candidate). Otherwise → `UnresolvedGameIdentity`.
5. **Step 5** — Mint new canonical + revision 1.

**Constants:**
- `_CLOSE_MATCH_WINDOW = timedelta(hours=72)`

---

## 3. Why the ±72h heuristic was originally required

Two legitimate identity cases historically fell inside 72h:

**Case A — Same-provider postponement with a reissued provider id.**
Rare but possible: a provider retires the original provider_game_id after a postponement and issues a brand-new one for the rescheduled instance. Step 2 fails; step 3 catches it as long as the reschedule is within 72h.

**Case B — Cross-provider first attachment.**
A canonical minted by NHL Public exists; SportsData.io then sends the same game with its own SDIO provider_id. Step 2 fails (no canonical has that SDIO id); step 3 catches it and calls `_attach_new_provider_id` to attach the SDIO id to the existing canonical.

Both are real. Case B is the far more common one in practice.

**Where the heuristic breaks:**
The ±72h window is silent about *what already exists on the candidate for the same provider*. In the collision above, the candidate already carried `nhl_public.id = 2025021223` and the incoming hint was `nhl_public.id = 2025021211`. That configuration is impossible for a reschedule (a single provider never assigns two different ids to the same rescheduled game). It can only mean Game A is a **different game**. But step 3 didn't test that invariant.

The POST-only skip (already merged) is a partial fix: it protects playoffs but leaves REG (and PRE) exposed to the same failure mode when two legitimate games between the same teams sit inside 72h.

---

## 4. Which legitimate cases the current heuristic protects

Retained legitimate cases with their preferred identity path:

| Case | Correct identity path |
| --- | --- |
| Same-provider postponement, **same** provider_game_id | **Step 2** (provider-id exact). Never needs step 3. NHL Public API keeps the same `id` across postponements — verified. |
| Same-provider postponement, **reissued** provider_game_id (rare) | **Step 4** (far candidates + positive evidence). The provider is expected to signal the tie via `supporting_evidence.prior_scheduled_iso`; if not, refusal + reconciliation queue is safer than a silent collapse. |
| Cross-provider first attachment (NHL Public first, then SportsData.io / Highlightly / Sportradar) | **Step 3** natural-key close. This is the only case where step 3 is truly necessary. |
| Genuine same-teams-same-day home-and-home (rare but real) | **Step 5** — mint two distinct canonicals. Same-provider IDs are always distinct. |

**Why the reschedule cases cannot simply use provider id:**
- Same-id reschedule is already handled by step 2; no other mechanism needed.
- Reissued-id reschedule (rare) genuinely needs a non-provider-id signal — that's what step 4's `_positive_evidence_of_reschedule()` provides. Step 3 is not required for that case; step 4 already carries the load.

**Conclusion:** step 3 exists almost exclusively for **cross-provider first attachment**. If step 3 is constrained so that it never fires when the same provider already has a *different* id on the candidate, step 3's usefulness for cross-provider matching is preserved and its harm for same-provider distinct games is eliminated.

---

## 5. Proposed smallest deterministic change

**One-rule amendment to `_find_natural_close`:**

> When enumerating candidates for a natural-key close match, exclude any candidate that already carries a **same-provider** `provider_ids.{hint.provider}.id` **different from** `hint.provider_game_id`.

Concretely, add this Mongo filter clause to the `_find_natural_close` query:

```
"$or": [
    { f"provider_ids.{hint.provider}.id": {"$exists": False} },
    { f"provider_ids.{hint.provider}.id": None },
    { f"provider_ids.{hint.provider}.id": hint.provider_game_id },
]
```

(Or, more compactly: `{"$nor": [{ f"provider_ids.{hint.provider}.id": {"$nin": [None, hint.provider_game_id]}}]}`.)

**Behavioral summary of the amendment:**

| Situation | Before | After |
| --- | --- | --- |
| REG, same teams, ±72h, both have distinct nhl_public ids | Collapse (BUG) | Two canonicals — correct |
| REG postponement, same nhl_public id | Step 2 handles it | Step 2 still handles it — unchanged |
| REG reissue postponement with `supporting_evidence.prior_scheduled_iso` | Step 3 collapses (worked by luck) | Step 3 excludes candidate; step 4 uses positive evidence → same tgid — correct |
| Cross-provider first attachment (nhl_public id already present, sdio hint arrives) | Step 3 attaches | Step 3 attaches (canonical has no sdio.id, so not excluded) — unchanged |
| POST, same teams, ±72h | Already skipped (playoff fix) | Still skipped by that guard; new rule is defense in depth — unchanged |
| PRE, same teams, ±72h | Same as REG behavior | Preseason exhibition series are rare and pattern the same as REG; new rule protects them symmetrically |

The amendment is 3–5 lines of code in `_find_natural_close`. The POST-only skip in `resolve_game` stays as-is (belt-and-suspenders). `_positive_evidence_of_reschedule` and step 4 are unchanged.

**Why this is the smallest deterministic change:**
- No changes to model schemas or indexes.
- No changes to append-only invariants.
- No new configuration knobs (no "close-match window" tuning).
- No changes to cross-provider attachment behavior.
- Rule is expressible as a single query filter — no code branching beyond one Mongo clause.
- Deterministic: given the same DB state, the resolver's answer for a given hint is now fully determined by whether the candidate already carries a same-provider id, which is a stable attribute of the candidate.

---

## 6. Proposed tests (all Foundation 1A, no 1B or 1C changes)

New tests to add in `tests/foundation_1a/test_foundation_1a.py`:

**T1. REG same-teams consecutive-day home-and-home stays separate.**
Mint canonical for Game A (nhl_public id 111, Tue 21:00), then resolve a hint for Game B (nhl_public id 222, Wed 19:00), same teams, same season/type. Assert two distinct tgids and `iq_canonical_games` count == 2.

**T2. REG same-teams ~30h apart (typical home-and-home) stays separate.**
Same as T1 but at 30h delta (well inside 72h) with the concrete PIT/FLA IDs 2025021211 + 2025021223 to mirror the real collision. Assert two distinct tgids.

**T3. REG same-provider-id postponement remains one canonical (step 2 still wins).**
Mint canonical with nhl_public id X. Resolve a second hint with the SAME id X and a scheduled_iso 48h later. Assert same tgid; assert `iq_game_schedule_revisions` has 2 rows (revision 2 written).

**T4. REG reissued-id postponement with positive evidence remains one canonical.**
Mint canonical with sportradar id "sr-orig" at Tue. Resolve a hint with sportradar id "sr-new" at Tue+7d **carrying `supporting_evidence.prior_scheduled_iso`**. Assert same tgid (step 4 positive-evidence path).

**T5. REG reissued-id without positive evidence refuses to auto-match.**
Mint canonical with sportradar id "sr-orig". Resolve a hint with sportradar id "sr-different", no supporting_evidence, ±72h scheduled_iso. Assert `UnresolvedGameIdentity` raised and no new canonical minted (existing assertion pattern, but note that under the amendment the exclusion happens at step 3, so step 4's refusal path is the terminal one).

**T6. Cross-provider first attachment still works.**
Mint canonical from nhl_public (nhl.id=Z). Resolve a sportsdata_io hint with same teams within ±72h; step 3 attaches sdio.team_id to the existing canonical. Assert same tgid.

**T7. POST regression (playoff fix) unaffected.**
Existing `test_playoff_series_games_get_distinct_ticker_game_ids` continues to pass.

**T8. PRE parity.**
Repeat T1's scenario with `season_type="PRE"`. Assert two distinct tgids.

**T9. Regression pin — natural-key ambiguity when >1 candidate remains after the new exclusion.**
Contrived edge case: two canonicals with the same teams and neither has an nhl_public id. A new nhl_public hint arrives inside ±72h. Both candidates survive the new exclusion (both have `nhl_public.id == null`). Assert `AmbiguousGameHint` — same behavior as before.

All existing 27 Foundation 1A tests must remain green; specifically:
- `test_postponement_within_72h_preserves_ticker_game_id` (same-id case — step 2 path).
- `test_far_postponement_with_positive_evidence_no_new_mint` (step 4 path).
- `test_far_postponement_without_evidence_raises_unresolved` (step 4 refusal path).
- `test_regular_season_postponement_still_uses_natural_key` (cross-provider attachment).
- `test_playoff_series_games_get_distinct_ticker_game_ids` (POST skip).

---

## 7. Repair of the collided live record

**Yes — repair is required.** The current state has one canonical row that has absorbed two different real games. Downstream consumers already read this incorrectly.

The collided data:
- Canonical `tg_01M2B63QD72KGDY90WV90K4HR4`
  - Rev 1 (immutable): `nhl_id=2025021223`, `scheduled_iso=2026-04-05T19:00:00Z`. Correct for Game B.
  - Current cache: `provider_ids.nhl_public.id = 2025021211`. **Wrong** — overwritten by the collision.
- `iq_game_finals` rows for this tgid:
  - v1: from `gamecenter/2025021223/boxscore`. Correct for Game B, wrong version marker (should stay the terminal truth for this canonical).
  - v2: from `gamecenter/2025021211/boxscore`. **Belongs to a different canonical.**

Repair steps (all deterministic, all append-only preserving iq_game_finals except for one narrow migration):

1. **Restore Game B's canonical cache.**
   Rewrite `iq_canonical_games.provider_ids.nhl_public.id = 2025021223` (the value already preserved in rev 1's `provider_ids_at_revision`). `current.scheduled_iso` is already correct. `iq_canonical_games` is a materialized cache — it is legitimately mutable.

2. **Append a `canonical_identity_repair` correction record on Game B's canonical.**
   Extend `CorrectionReason` with a new literal `"canonical_identity_repair"`. Write a new v3 on `tg_01M2B63QD72KGDY90WV90K4HR4` whose truth is **identical to v1** (i.e., re-declare Game B's actual truth as v3). This preserves append-only integrity: v2 is not deleted, but v3 restores the correct terminal state. Latest-version selection in Foundation 1B (`_pipeline_latest_versions` with `$first` on `record_version DESC`) will now return v3 (= Game B's truth) for all reads. v2 remains in the log with its own recorded_at for audit.

3. **Mint a fresh canonical for Game A (nhl_public id 2025021211).**
   Run `resolve_game()` *under the amended resolver*. With the amendment, Game A now correctly mints a new canonical: step 2 fails (no canonical carries 2025021211 after step 1's restoration), step 3 excludes Game B's canonical (it already carries `nhl_public.id = 2025021223 ≠ 2025021211`), no far candidates apply, step 5 mints. Emit its own revision 1 and (optionally) a schedule_release snapshot per the 1A first-sight rules.

4. **Write v1 in `iq_game_finals` for Game A's new canonical.**
   Fetch `gamecenter/2025021211/boxscore` and call `write_game_final()`. This produces a clean v1 tied to the correct canonical.

**Reads after repair:**
- `game_final_as_of(Game B)` returns v3 payload = Game B's truth (score 5-2, played 4-05).
- `game_final_as_of(Game A)` returns Game A's v1 payload (score 9-4, played 4-04).
- `history_for_team_as_of(PIT, ...)` returns two distinct games with correct scores in chronological order.
- Audit trail preserved: v1 (initial), v2 (the wrong attachment), v3 (identity repair, matches v1 truth) are all in the log with distinct `recorded_at` and `provenance` blocks.

**Repair effort:** a one-shot Python script alongside `intelligence/backfill_1b.py`, e.g., `intelligence/repair_collided_canonicals.py`. Idempotent. Runs once against live DB. Adds the `canonical_identity_repair` enum value to `models_1b.CorrectionReason`.

**Alternative repair path considered and rejected:**
- **Delete v2 and forget it happened.** Rejected — violates append-only invariant of `iq_game_finals`, and destroys the audit trail of the original error. Future 1A/1B verification should be able to see that a v2 was written and superseded.

---

## 8. Summary — what's proposed for approval

**Amendment:**
- One filter clause added to `_find_natural_close()` excluding candidates that already carry a same-provider id different from the hint's.
- No changes to models, indexes, or the append-only invariant.
- Keep the existing POST-only skip in `resolve_game()` as defense in depth (or fold it into the new rule — your call; recommend keeping for now).

**Tests:**
- 9 new tests in `tests/foundation_1a/`.
- All 27 existing 1A tests + 24 1B tests must remain green (52 total; grows to 60 after the new 1A tests).

**Repair of live data:**
- Add `canonical_identity_repair` to `CorrectionReason`.
- One-shot idempotent script:
  1. restore Game B's canonical cache `nhl_public.id` to 2025021223,
  2. append v3 on Game B's canonical = Game B's truth,
  3. mint Game A's canonical under the amended resolver,
  4. write v1 on Game A's canonical.

**Explicitly out of scope:**
- Foundation 1B changes.
- Foundation 1C, signals, weighting, learning.
- Any broader Foundation 1A refactor.
- Any change to the ±72h constant itself (`_CLOSE_MATCH_WINDOW`).
- Any change to `_positive_evidence_of_reschedule` or step 4.

Ready for your decision on whether to build this amendment. No code will be written until you approve.
