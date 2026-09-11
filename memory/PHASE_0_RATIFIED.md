# Ticker Hockey IQ · Phase 0 — Ratified Architecture (Amendment Applied)

**Status:** APPROVED WITH AMENDMENTS · IMPLEMENTED · ACCEPTANCE PASSED (35/35 live + 23/23 unit).

**What changed vs. the initial proposal:** every one of your 10 amendments has been folded in. This doc is the source of truth going forward.

---

## The ten amendments — where each one landed in code

| # | Amendment | Where enforced |
|---|---|---|
| 1 | Signal is **world intelligence only**. Personal history is **derived** from own UserCall/CallEvent/Resolution, never stored as a Signal. | `iq_core.build_reggie_brief()` composes `accuracy_summary` from user history; `SignalSource` enum contains zero personal-history values. `/iq/user/brief` never returns a `personal_history_signal` field — verified in acceptance check [6]. |
| 2 | Adult eligibility needs **provenance, not a naked boolean**. No DOB. | `iq_core.Attestation` model: `{method, attested_at, policy_version, jurisdiction, revoked_at}`. `POST /iq/user/attest-adult` requires jurisdiction, stores method + timestamp + policy version. Zero DOB fields on User. Verified in acceptance checks [2]. |
| 3 | Resolution **call-type aware**. `grading_rule` + `grading_version` per call kind. Fantasy `ungradeable` legitimate. | `iq_core.Resolution` model: `{outcome_status, correct?, grading_rule, grading_version, ...}`. `OutcomeStatus` enum includes `ungradeable` + `partial`. `correct` is nullable. Fantasy resolution demonstrated ungradeable in acceptance check [4]. |
| 4 | First instinct vs locked call preserved; don't auto-classify uncertain events. | `project_call_from_events()` captures `first_instinct` ONCE, never overwrites. `revision` events keep `first_instinct` intact. `CallEvent.kind` vocabulary is closed at 12 conservative kinds. |
| 5 | Voice locking **strict**: isolated positive utterances don't lock. | `iq_core.validate_locked_event()` rejects unless `payload.explicit=true` AND (`confirmation_prompt` OR `ui_action`). Endpoint `POST /iq/call/event` runs this validator before any DB write. Verified in acceptance check [1] with the exact "yeah I like Vancouver" case rejected 400. |
| 6 | Abandoned calls **do NOT affect accuracy**. | `iq_core.accuracy_summary()` filters `state != 'resolved'` out. Verified in acceptance check [4]. |
| 7 | Nickname **non-unique for private accounts**; unique only for public handles. | `User.nickname` free-form. `User.prefs.public_nickname` is the reserved handle (nullable, only set on opt-in to public profile). Internal identity always `User.id`. Leaderboard queries (Phase 2) will key on `User.id`. |
| 8 | **No automatic extraction** of UserCalls from forum posts. | `CallEvent` vocabulary contains no "post_scraped" or "inferred_call" kinds. Only explicit `draft_created` or `instinct_captured` opens a call. Community posts become UserCalls only via a future "Lock this as a call" explicit action. |
| 9 | Object count clarification — **six is fine**. | Doc uses six objects: User · UserCall · CallEvent · Signal · Wager · Resolution. |
| 10 | Zero-destructive migration. Legacy Predictions + BetLog + Importer + Spot Check protected. | Six new Mongo collections (`iq_users`, `iq_calls`, `iq_events`, `iq_signals`, `iq_wagers`, `iq_resolutions`). Legacy `predictions` and `bet_log` untouched. `/iq/legacy/projection` is read-only. Verified in acceptance check [5]. |

---

## Adult attestation — recommended minimal implementation (per amendment 2)

**Fields captured** (five, no more):

```
Attestation {
  method: "self_attestation_v1"        # versioned so KYC upgrade doesn't need schema change
  attested_at: ISO timestamp
  policy_version: "adult-unlock-policy-v1"
  jurisdiction: ISO country or country-region code  # user-declared, not IP-geolocated
  revoked_at: null | ISO timestamp     # revocation is future-friendly
}
```

**What we don't collect:**
- ❌ DOB (year-only can't reliably determine current age; adds PII without solving the problem)
- ❌ Full name / address / ID
- ❌ IP geolocation (unreliable + adds compliance surface); jurisdiction is user-declared
- ❌ SSN / financial data

**Method upgrade path:** if a real sportsbook partner ever requires stronger assurance, we upgrade `method` to `id_verified_v1` or `partner_verified_v1` and add optional fields (`verifier_id`, `verified_at`, `document_type`) without breaking existing attestations. The schema was designed for this from day one.

**What "adult_features_unlocked" means today:**
- The user has self-attested that they are 18+ AND eligible for real-money wagering features in their declared jurisdiction.
- The Ticker does not process wagers. Attestation is the honest floor for a non-transacting product.
- If the product ever transacts (which the freeze list explicitly forbids), we upgrade method to real KYC via partner integration — schema stays identical.

---

## The six durable objects (final)

```
User ──── UserCall ──── CallEvent (append-only journey)
             │
             ├──── Wager (optional, 18+ only, sibling)
             │
             └──── Resolution (call-type-aware grading)

Signal (standalone — world data only, never personal history)
```

### User
```
User {
  id: uuid
  device_ids: [str]
  nickname: str                 # free-form, non-unique for private accounts
  created_at: iso
  eligibility: {
    adult_features_unlocked: bool   # derived from attestation
    attestation: Attestation | null
  }
  prefs: {
    followed_teams: [str]
    followed_players: [str]
    voice_persona: str
    public_nickname: str | null      # reserved iff opt-in to public profile
  }
}
```

### UserCall
```
UserCall {
  id, user_id
  kind: 'game_pick' | 'prop_pick' | 'pick10_entry' | 'fantasy_lineup' | 'series_pick' | 'community_take'
  subject: { ... }              # shape depends on kind
  stance: CallStance            # PROJECTION of event log, never edited directly
  first_instinct: { pick, captured_at, source } | null    # captured ONCE
  state: 'draft' | 'locked' | 'resolved' | 'abandoned' | 'voided'
  created_at, locked_at?, resolved_at?
  context_snapshot: { signal_refs, ... } | null
  wager_id: str | null
}
```

### CallEvent (append-only)
```
CallEvent {
  id, call_id, user_id, ts, source
  kind: one of 12 closed values (see below)
  payload: {}
}
```
**Vocabulary (closed at Phase 0, extensible in future migrations):**
`draft_created` · `instinct_captured` · `reasoning_added` · `signal_consumed` · `revision` · `confidence_set` · `locked` · `abandoned` · `wager_attached` · `resolution_delivered` · `voided` · `reflection`

### Signal (world data only)
```
Signal {
  id, source, subject, value, confidence?, provenance, valid_from, valid_to?
}
```
`source` ∈ `{market_line, ticker_model, community_consensus, specialist_pick, forum_observation, injury_report, goalie_confirmed, schedule_context}`.
**No `personal_history` source exists on purpose.**

### Wager (optional, 18+ only)
```
Wager {
  id, user_id, call_id
  played: bool                  # only required field
  odds_text?, stake?, units?, book?, settled?
  created_at
}
```
Accuracy math NEVER reads Wagers. Only ROI/betting analytics do.

### Resolution
```
Resolution {
  id, call_id
  outcome_status: 'correct' | 'incorrect' | 'push' | 'void' | 'ungradeable' | 'partial'
  correct: bool | null          # null for ungradeable/partial
  actual: {}                    # canonical outcome, shape family = UserCall.subject
  grading_rule: str             # e.g. 'game_winner_v1', 'fantasy_start_sit_v1'
  grading_version: str
  source: 'nhl_api' | 'sportradar' | 'manual' | 'import' | 'system'
  resolved_at, raw_evidence?
}
```

---

## API surface — Phase 0 endpoints

Seven endpoints. All under `/api/iq/*`.

| Method + Path | Purpose |
|---|---|
| `POST /api/iq/user/attest-adult` | Records attestation with provenance, unlocks adult features |
| `GET /api/iq/user?device_id=X` | Get-or-create the User for this device (idempotent) |
| `POST /api/iq/call/event` | The single write endpoint — every voice utterance / tap / import lands here |
| `GET /api/iq/call/{call_id}` | Full call — projected stance + all events + resolution + wager |
| `GET /api/iq/user/{user_id}/calls?state=&limit=` | List a user's calls |
| `POST /api/iq/call/{call_id}/resolve` | Verified resolution — writes Resolution + `resolution_delivered` event |
| `POST /api/iq/call/{call_id}/wager` | Attach optional wager (adult-gated) |
| `GET /api/iq/user/brief?device_id=X` | Reggie's pre-loaded user brief (derived personal history) |
| `GET /api/iq/legacy/projection?device_id=X&user_name=Y` | Read-only projection of legacy Predictions + BetLog into UserCall shape |

**State transitions enforced at endpoint layer:**
- `draft` → any editing event allowed
- `locked` → only `resolution_delivered` / `voided` / `wager_attached` / `reflection` / `signal_consumed` accepted (all others rejected 409)
- `resolved` / `abandoned` / `voided` → only `reflection` / `voided` accepted

---

## Acceptance evidence

**Unit tests (pure logic):** `python -m pytest backend/tests/test_iq_core.py -v` → **23/23 PASS**
- Projector: empty/first-instinct-once/reasoning-append/revision/confidence/lock-transition/abandoned/resolved/order-safety/unknown-kind-tolerance
- Lock strictness: rejects missing explicit, rejects missing context, accepts voice prompt, accepts UI button, rejects the exact "yeah I like Vancouver" case
- Accuracy: excludes abandoned/draft/locked-unresolved, ungradeable excluded from pct, first-instinct + changed-mind split correctness
- Legacy projection: Prediction shape, BetLog with money → Wager, prediction-only → no Wager
- Brief: strips spot_check_state for non-adult, includes for adult

**Live acceptance (backend end-to-end):** `python backend/tests/acceptance_iq_phase0.py` → **35/35 PASS**
- Full lifecycle: voice-shaped `instinct → reasoning → revision → strict lock → resolve` with journey retrievable
- STRICT lock: "yeah I like Vancouver" (isolated) → 400 rejected; "Lock EDM?" + "yep" → 200 locked
- Post-lock edits: revision on a locked call → 409 rejected
- Attestation: no DOB collected, method + timestamp + policy version + jurisdiction all persisted
- Wager: blocked pre-attestation (403), attached post-attestation, duplicate rejected (409), `played=false` accepted with zero financial fields
- Accuracy: abandoned + draft + locked-unresolved excluded from math; fantasy ungradeable segregated
- Legacy preserved: `/betting/bet` still writes to bet_log; `/betting/spot-check` still responds; bulk-import guardrail still fires; legacy projection reads bets as UserCall+Wager+Resolution triples

**Regression:** `python backend/tests/acceptance_bulk_import.py` → **36/36 PASS** (frozen Spot Check + importer untouched)

---

## What still awaits future phases

**Nothing new in Phase 0 UI.** Per your directive:
- No IQ shell / no 5-tab bar
- No Accuracy Wheel
- No Pick 10 board
- No Fantasy import
- No forum
- No Sportradar production upgrade
- No payment work

The foundation is invisible to end users. It works entirely through the API — future phases (IQ shell, Reggie prompt integration, live resolution feed) will consume these endpoints without further data migration.

## Files created this phase

| File | Purpose |
|---|---|
| `/app/backend/iq_core.py` | Pure Pydantic models + projector + brief composer + legacy projections |
| `/app/backend/server.py` (+~220 lines) | Seven `/api/iq/*` endpoints |
| `/app/backend/tests/test_iq_core.py` | 23 unit tests on the pure module |
| `/app/backend/tests/acceptance_iq_phase0.py` | 35-check live acceptance script |
| `/app/memory/PHASE_0_RATIFIED.md` (this file) | Source-of-truth architecture doc |
