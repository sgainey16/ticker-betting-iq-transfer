# Ticker Hockey IQ · Phase 0 Data Architecture — Amendment

**Status:** Design proposal awaiting approval. No code changes. Freezes (Spot Check v2, no Sportradar/Yahoo/forum/payments/IQ UI) remain in force.

**Purpose:** Design the smallest durable data foundation that lets Ticker Hockey IQ grow into voice-first, accuracy-first, wager-optional learning — without another migration.

---

## 0. The one decision that cascades — proposed state model

You asked whether **Prediction → Locked Call → Played** is the right sequence, or whether there's something cleaner.

**Recommendation: a cleaner two-axis model.** Here's why:

`Prediction → Locked Call → Played` conflates two orthogonal things:
- The **lifecycle of the opinion** (is the user still thinking? or have they committed?)
- The **presence of a wager** (did money change hands?)

Those are independent. A fantasy start/sit is "locked" but never "played" in the betting sense. A parent giving a hunch to their kid is "locked" and never played. A pro bettor still deciding is unlocked and unplayed. Forcing `Played` into the lifecycle would push wagering concepts into every UserCall, which is exactly what you asked us not to do.

**Proposed:**

**Axis 1 — Call lifecycle (all UserCalls):** `draft` → `locked` → `resolved` (with terminal branches `abandoned`, `voided`).

**Axis 2 — Optional wager attachment (18+ only):** a separate `Wager` record that can be attached to a `locked` UserCall. Presence/absence of a Wager does not affect lifecycle, grading, or accuracy math.

This gives you:
- Accuracy history for a 12-year-old, a fantasy player, a bettor, and a casual fan on **the same schema** — nobody's ever forced through a betting concept.
- Betting analytics (ROI, unit sizing) available *only when* the user voluntarily attaches a Wager.
- A hockey fan can build a lifetime Ticker Accuracy record with zero wagering content ever surfaced.

Rest of this doc assumes this model. If you disagree, everything downstream shifts.

---

## 1. The five durable objects

Only five. Everything the audit surfaced (first-instinct accuracy, changed-mind accuracy, homer bias, calibration, recency influence, reasoning-category patterns, community weighting) is **derivable** from these five without adding new tables.

```
User ──── UserCall ──── CallEvent (append-only journey)
                │
                ├──── Wager? (optional, 18+ only, sibling)
                │
                └──── Resolution (grading result)

Signal (standalone — externally-sourced facts, not user data)
```

---

## 2. `User` — one identity spine

Keyed on `device_id` today (matches existing `BetLog` identity). `nickname` is a display attribute, not primary. Fixes the leaderboard collision bug for free.

```
User {
  id: str                    # canonical, keyed to device_id today; future auth swaps to auth_uid
  device_ids: [str]          # array — allows future account linking across devices
  nickname: str              # display only, mutable, non-unique
  created_at: iso
  eligibility: {
    dob_declared: bool             # user has attested a DOB
    dob_year_only: int?            # store year only — enough for age gate, minimal PII
    region: str?                   # 2-letter ISO — future geo compliance
    adult_features_unlocked: bool  # derived: dob_year_only implies 18+ AND region allows
    unlocked_at: iso?
  }
  prefs: {                        # opaque bag — voice, pace, follows, etc.
    followed_teams: [str]
    followed_players: [str]
    voice_persona: str            # 'reggie' | 'marc' | ...
  }
}
```

**Notes:**
- `adult_features_unlocked` is the single boolean UI and API check for anything that mentions money.
- We store **year of birth only**, not full DOB. Enough for a hard 18+ gate; minimal PII footprint.
- `device_ids: [str]` lets us later link a second device to one User without breaking the current single-device flow.

---

## 3. `UserCall` — the durable committed opinion

This is the object every accuracy/learning metric trains on. Both today's `Prediction` and today's `BetLog` become variants of this.

```
UserCall {
  id: str
  user_id: str

  # WHAT the user is calling
  kind: enum                       # 'game_pick' | 'prop_pick' | 'pick10_entry'
                                   # 'fantasy_lineup' | 'series_pick' | 'community_take'
  subject: {                       # discriminated on `kind`; free-form JSON
                                   # game_pick:      { game_id, side: 'home'|'away' }
                                   # prop_pick:      { game_id, player_id?, market, over_under?, line? }
                                   # fantasy_lineup: { slot, player_id, action: 'start'|'sit' }
                                   # series_pick:    { series_id, side, games? }
    ...
  }

  # THE OPINION at its final state (projection — see §4)
  stance: {
    pick: str                      # canonical outcome string
    confidence_1_10: int?          # user-declared confidence; nullable
    reasoning_text: str?           # free-form final rationale
    reasoning_tags: [str]          # ['goalie_news', 'home_ice', 'travel', 'gut'] — controlled vocab, extensible
    changed_mind: bool             # derived: did they revise between first_instinct and lock?
    time_to_lock_sec: int?         # derived: created_at → locked_at
  }

  # FIRST INSTINCT captured separately so we can measure first-instinct accuracy
  first_instinct: {
    pick: str
    captured_at: iso
    source: enum                   # 'voice' | 'tap' | 'imported' | 'inferred'
  } ?

  # LIFECYCLE — three states, two terminal branches
  state: enum                      # 'draft' | 'locked' | 'resolved' | 'abandoned' | 'voided'
  created_at: iso
  locked_at: iso?
  resolved_at: iso?

  # CONTEXT snapshot at lock time — what signals existed when the user committed
  # (Used later for "the community was on the other side" learning)
  context_snapshot: {
    signal_refs: [signal_id]       # references to Signal records active at lock time
    ...                            # anything else cheap to snapshot
  } ?

  # OPTIONAL wager attachment (18+ only, sibling record — see §6)
  wager_id: str?
}
```

**Every future analytic falls out of this without a schema change:**

| Question | Derived from |
|---|---|
| First-instinct accuracy | `first_instinct.pick` vs `resolution.actual` |
| Changed-mind accuracy | `changed_mind == true` slice, correctness rate |
| Confidence calibration | `stance.confidence_1_10` binned vs correctness |
| Homer bias | `subject.game_id` filtered to `user.prefs.followed_teams` |
| Recency influence | `created_at` relative to last game result of that team |
| Reasoning-category patterns | `stance.reasoning_tags` grouped vs correctness |
| Overthinking | `stance.time_to_lock_sec` binned vs correctness |
| Community influence | comparison of `stance.pick` to `context_snapshot` community consensus signal |

**Explicitly not stored, because it's derived:** first-instinct-vs-final-pick delta, accuracy by category, streaks, personal Edge Score. All computed at read time from the same five objects.

---

## 4. `CallEvent` — the append-only journey

**This is the key architectural addition for voice-first capture.** UserCall gives you the *current state*. CallEvent gives you the *complete history of how the user got there*.

```
CallEvent {
  id: str
  call_id: str                     # FK → UserCall
  user_id: str                     # denormalized for cheap per-user queries
  ts: iso
  source: enum                     # 'voice' | 'tap' | 'imported' | 'reggie' | 'system'
  kind: enum                       # see below
  payload: {}                      # discriminated on `kind` — small JSON
}
```

**`kind` vocabulary — closed at Phase 0, extensible in migrations:**

| kind | payload example | purpose |
|---|---|---|
| `instinct_captured` | `{ pick: 'VAN' }` | Reggie: "who are you liking?" · User: "Vancouver." |
| `reasoning_added` | `{ text: '...', tags: ['goalie_news'] }` | User says "…because Demko is starting." |
| `signal_consumed` | `{ signal_id, disagreed: bool }` | User read/heard a signal Reggie or the UI surfaced |
| `revision` | `{ from_pick, to_pick, reason: 'goalies_flipped' }` | "Actually change me to Edmonton." |
| `confidence_set` | `{ value: 7 }` | "How sure are you?" · "Seven out of ten." |
| `locked` | `{}` | State transition — locks the final `stance` |
| `abandoned` | `{ reason }` | User walked away before locking |
| `wager_attached` | `{ wager_id }` | 18+ optional attachment |
| `resolution_delivered` | `{ correct, actual }` | System writes the outcome |
| `reflection` | `{ text, tags }` | Post-game: "yeah I fell in love with Vancouver again" |

**Why append-only and separate from UserCall:**
- UserCall.stance is a projection (the latest state). CallEvent is the truth.
- Voice conversations produce 4–10 events per call; we don't want to churn UserCall on every utterance.
- Future analytics (first-instinct-vs-final, revision patterns, "which reasoning tags precede changed-mind losses") are trivial event-log queries.
- **Reggie's writes are just `CallEvent` inserts.** He never edits UserCall directly. A tiny projector function replays events → updates `UserCall.stance` + `state`. This makes voice/UI/import all identical at the write layer.

---

## 5. `Signal` — the world's inputs, kept separate from user data

The audit called out the "distinct signals" concept (Market · Ticker Analytics · Community · Specialists · Forum · Context · Personal history). These are **facts about the world**, not user data. They live in their own object so Reggie can compose them independently.

```
Signal {
  id: str
  source: enum                     # 'market_line' | 'ticker_model' | 'community_consensus'
                                   # 'specialist_pick' | 'forum_observation' | 'injury_report'
                                   # 'goalie_confirmed' | 'schedule_context' | 'personal_history'
  subject: {                       # discriminated on `source`; same shape family as UserCall.subject
    game_id?: str
    player_id?: str
    market?: str
    ...
  }
  value: str                       # canonical outcome or numeric string
  confidence: float?               # 0.0–1.0 where source provides one
  provenance: {                    # who/what/when — accountability + moderation trail
    origin_id?: str                # e.g. the specialist's user_id, article url, etc.
    ingested_at: iso
    fact_tier: enum                # 'verified' | 'reported' | 'rumor' — from MATCHUP_ANALYTICS_SPEC
  }
  valid_from: iso
  valid_to: iso?                   # null = still valid; supports odds movement over time
}
```

**Why it matters for Phase 0:**
- Personal-history-as-a-signal is what closes the loop with Spot Check ("*your history says…*" is a Signal, not a UserCall).
- `context_snapshot.signal_refs` on UserCall points here — that's how we later ask "what did the community consensus say at the moment this user locked, and how often does the user agree/disagree?"
- Fact tier lives on the Signal, so a "verified" injury report and a "reported" beat-writer rumor are the same shape with a provenance flag.

**Phase 0 scope:** Object exists, one or two sources ingest into it (`market_line` mock, `personal_history` from existing bet_log). The other sources are added over Phases 2–5 without a schema change.

---

## 6. `Wager` — optional, sibling of UserCall, 18+ only

```
Wager {
  id: str
  user_id: str
  call_id: str                     # FK → UserCall (call must be state='locked' or later)
  played: bool                     # "did you actually play this?" — the only required field
  odds_text: str?                  # '-135' / '+180' — optional
  stake: float?                    # optional
  units: float?                    # optional alternative to stake
  book: str?                       # optional
  settled: {
    profit_loss: float?
    settled_at: iso?
  } ?
  created_at: iso
}
```

**Key rules:**
- Only createable if `user.eligibility.adult_features_unlocked == true`. Enforced at API layer.
- `played: bool` is the only required field. Everything else is optional — no financial disclosure required.
- Presence/absence of a Wager **never** affects UserCall grading, Accuracy Wheel, streaks, or leaderboards. Those are all UserCall metrics.
- ROI/Betting IQ analytics read only from UserCalls that *have* a Wager with `stake/odds` populated.
- Existing frozen `BetLog` records read via a view that projects them as `UserCall + Wager` pairs — no data migration needed on day one.

---

## 7. `Resolution` — outcome + grading

```
Resolution {
  id: str
  call_id: str                     # FK → UserCall
  actual: str                      # canonical outcome — shape matches UserCall.subject family
  correct: bool
  source: enum                     # 'nhl_api' | 'sportradar' | 'manual' | 'import'
  resolved_at: iso
  raw_evidence: {} ?               # arbitrary — box score fragment, prop line result, etc.
}
```

**Notes:**
- One Resolution per UserCall. If corrected (bad grade), `voided` transition on UserCall + a new Resolution row (append-only philosophy across the whole schema).
- The **live resolution feed** is the Phase 2 piece that writes Resolutions. Phase 0 just puts the object in place so voice-captured calls have a landing pad.

---

## 8. Relationship to existing `Prediction` and `BetLog`

**No destructive migration.** New writes flow through the new model. Existing records stay readable via projections.

```
Existing Prediction record
  → view emits UserCall(kind='game_pick', state='resolved', stance={pick, reasoning_text},
                        first_instinct=null,      # we didn't capture it back then
                        context_snapshot=null)
  → view emits Resolution(actual, correct)
  → no CallEvent history for legacy records (that's fine; new records get the journey)

Existing BetLog record
  → view emits UserCall(kind='game_pick' or 'prop_pick', state='resolved',
                        stance={pick, reasoning_tags: []})
  → view emits Wager(played=true, odds, stake, profit_loss, settled)
  → view emits Resolution(actual: derived from result field, correct: derived)
  → no CallEvent history
```

**Frozen Spot Check keeps reading `bet_log` directly.** The projection is one-way (BetLog → UserCall view), never the reverse. Zero risk to the frozen engine.

---

## 9. How Reggie/Marc read + write this

**Writes — voice-first, one tiny API:**

Reggie transcribes → sends structured event to a single endpoint:
```
POST /api/iq/call/event
  { user_id, call_id?, source: 'reggie', kind, payload }
```

- If `call_id` is null and `kind == 'instinct_captured'` → creates a new UserCall in `draft` and appends the event.
- Otherwise → appends event to existing call.
- A tiny projector function replays that call's events → updates UserCall.stance + state.

**That's the entire voice-write surface.** Everything else (locking, revising, adding a wager) is just another event kind. UI taps, CSV imports, and voice all funnel through the same event insertion.

**Reads — Reggie's pre-loaded user brief:**

The MOAT roadmap called out that Reggie's biggest missing piece is knowing the user. With this schema, the brief becomes:
```
GET /api/iq/user/{user_id}/brief
  → returns
    { user, recent_calls: [UserCall], open_calls: [UserCall],
      accuracy_summary: { overall, by_kind, by_reasoning_tag },
      followed_teams, followed_players,
      spot_check_state,           # from frozen Betting IQ, for adults only
      recent_signals_consumed }
```

That's what gets injected into Reggie's system prompt at session start. **Phase 0 scope: build the endpoint and the brief format. Reggie prompt integration is a Phase 3 step.**

---

## 10. How Fantasy fits without being forced into a betting schema

Fantasy start/sit is a UserCall with `kind='fantasy_lineup'` and no Wager. Ever. Full stop.

```
UserCall(
  kind='fantasy_lineup',
  subject={ league_id, slot: 'C1', player_id: 'auston-matthews', action: 'start' },
  stance={ pick: 'start-matthews', reasoning_tags: ['home_ice', 'favourable_matchup'] },
  state='locked'
)
```

Resolution grades against the fantasy scoring output (Phase 4 concern). Accuracy Wheel treats fantasy calls as their own category, same as game_pick and prop_pick. The user can build a legitimate Ticker Accuracy record on Fantasy alone.

**A user who only plays fantasy never sees Betting IQ, never gets asked about a wager, and still gets everything Ticker Hockey IQ promises about accuracy and personal learning.**

---

## 11. Age / eligibility boundary — where it enforces

Only **three** places actually check `user.eligibility.adult_features_unlocked`:

1. **API layer:** `POST /wager/*` refuses with 403 if false. `GET /iq/betting/*` refuses. `POST /iq/call/event` with `kind='wager_attached'` refuses.
2. **UI layer:** the "Betting" tab in the IQ 5-tab bar is hidden if false. The IQ landing tile for Betting is hidden.
3. **Reggie prompt layer:** the brief endpoint strips `spot_check_state` and any wager data if false.

**That's it.** Everything else in Ticker Hockey IQ (Tonight, My IQ, Fantasy, Community) works identically for a 13-year-old and a 48-year-old bettor.

---

## 12. What's explicitly NOT in Phase 0 (and why)

| Not in Phase 0 | Why |
|---|---|
| Homer bias table | Derived — group `UserCall.subject.game_id` by followed teams at read time |
| Confidence calibration curves | Derived — bin `stance.confidence_1_10` vs `resolution.correct` at read time |
| Reasoning-category performance tables | Derived — group `stance.reasoning_tags` at read time |
| First-instinct accuracy leaderboard | Derived from `first_instinct.pick` vs `resolution.actual` |
| Community weighting formula | Signal + Resolution give us the inputs; formula is a Phase 3+ decision |
| Specialist ranking | Same — Phase 3+ compute layer, not a table |
| Odds movement history | Signal.valid_from/to already supports it, just not ingested yet |
| Real Yahoo/ESPN import | Phase 4 |
| Real sportsbook feed | Phase 3 when Personal Edge needs it |
| Full authentication | Phase 0 keeps device_id spine; auth swap is a User.device_ids attach |

**The rule I applied:** *if a metric can be computed at read time from the five base objects, it does not get its own Phase 0 table.* Every "we might want to know X" question in the brief passes that test.

---

## 13. Migration strategy

**Zero destructive migration.** Phase 0 implementation:

1. Introduce the five new collections/tables: `users`, `user_calls`, `call_events`, `signals`, `wagers`, `resolutions`.
2. Add read-only projection views over existing `predictions` and `bet_log` so those records appear as UserCall/Wager/Resolution triples.
3. New writes go through the new model.
4. Old writes to `predictions` and `bet_log` continue for one transition window (Predictions.jsx and BetForm still write to legacy tables), with a shim that also emits a `UserCall` + events for new records. Once IQ shell is live (Phase 1), Predictions.jsx writes shift to new model; legacy tables become archive.
5. Frozen Spot Check never changes what it reads.

**Rollback path:** because writes still land in legacy tables during transition, dropping the new tables and disabling the shim reverts to today's state cleanly.

---

## 14. Summary of what we're asking approval for

1. **State model:** `draft → locked → resolved (+ abandoned, voided)` for UserCall. Wager as optional sibling attachment. This replaces "Prediction → Locked Call → Played."
2. **Five objects, no more:** User · UserCall · CallEvent · Signal · Wager (+ Resolution as the grading record). Everything else the brief mentions is derived.
3. **CallEvent as append-only journey** — the architectural addition that makes voice-first capture natural, gives us first-instinct/revision/reflection for free, and unifies voice + tap + import writes.
4. **Fantasy first-class, betting optional.** A user can build a lifetime Accuracy record without ever touching a wager or seeing betting content.
5. **Age gate = one boolean, three enforcement points.** Nothing else in IQ needs to know about it.
6. **Zero destructive migration.** Legacy Prediction + BetLog project into new model via read-only views. Frozen Spot Check untouched.

---

## 15. Open questions worth your call before we build

1. **Nickname uniqueness policy.** Today it's non-unique and collision-prone. Do we (a) keep non-unique + rely on User.id everywhere, (b) enforce global uniqueness with a claim flow, or (c) enforce uniqueness only for users who opt into a public profile? Recommend (c).
2. **DOB year-only vs. full DOB.** Year-only is enough for 18+ gating and minimises PII. Full DOB enables birthday personalization ("happy birthday from Reggie") but adds compliance surface. Recommend year-only until there's a clear product reason to expand.
3. **Do abandoned calls count against accuracy?** Recommend no — abandoned means the user never locked, so there was no opinion to grade. But they *should* be visible in "you started 47 calls this week, locked 31" personal patterns.
4. **Voice locking phrase specificity.** "Yep" / "lock it" / "I'm in" / "final answer" — should Reggie's locking-intent classifier be intentionally strict (require an explicit verb) or forgiving? Recommend strict for the first 3 months of real use, then loosen based on Reggie's transcription false-positive rate.
5. **Whether Community IQ posts create UserCalls.** A forum post can contain an implicit prediction ("I'm on the Bruins tonight"). Do we auto-extract that into a UserCall? Recommend no for Phase 0 — humans opt-in by tapping a "Lock this as a call" button on their own post. Cleaner data than an NLP extraction that will be wrong 15% of the time.
