# Ticker Hockey IQ — PRD

_(Last updated 2026-09-12 after Foundation 1B build.)_

## Original problem statement
Build **Ticker Hockey IQ**, a premium intelligence environment that tracks user prediction accuracy over time via an append-only event system. The core discipline is **Temporal Integrity**: what Ticker knew before a game must be preserved separately from what happened after, and pregame knowledge must never be rewritten with hindsight data. The Hockey Intelligence Engine is being built layer-by-layer (Foundation 1A → 1B → 1C → …). One foundation at a time.

## Product surface
- Mobile shell: **Tonight / My IQ / Fantasy / Community** tabs with Reggie & Marc coach integration (shipped in Phases 0–3).
- Underlying intelligence engine: canonical identity, immutable pregame snapshots, immutable postgame finals, lock-time attachment, future foundations for H2H / lineups / signals.

## Foundations status

### Foundation 1A — Canonical identity & pregame snapshots  ✅ DEPLOYED
- Ticker-owned canonical IDs (`tt_`, `tg_`, `tp_`).
- Immutable pregame `iq_game_context_snapshots` (kinds: `schedule_release`, `t_minus_24h`, `t_minus_60`).
- Append-only `iq_game_schedule_revisions`.
- Lock-time attachment on `iq_calls` (`context_snapshot_ref`, `context_snapshot_state`).
- Ingest sources: NHL Public API + SportsData.io + Highlightly (Sportradar 403 unresolved, deferred).
- 25/25 tests green.

### Foundation 1B — Recent history (immutable game finals)  ✅ BUILT 2026-09-12
- `iq_game_finals` — append-only, versioned per game. Corrections create new rows, never mutate.
- `iq_team_season_coverage` — partial by default; promotion to `complete` gated by positive evidence.
- Stateless team-perspective projections; Last-N + season baseline; `*_as_of` helpers using `recorded_at <= as_of_iso` for temporal integrity.
- Build corrections shipped: identical-correction no-op; complete-requires-evidence; single-source-of-truth for goals via `final_score`; save-pct derived from counts.
- Minimum-history Last-10 backfill executed against live NHL Public API: 32 teams, 222 unique games, 48 coverage rows all partial.
- 23/23 tests green.
- Full evidence: `/app/memory/FOUNDATION_1B_BUILD_EVIDENCE.md`.

### Tonight's 10 — daily prediction board  ✅ BUILT 2026-02-14 (phone-review slice)
Phone-review governing principle applied: **SEE → TAP → LOCK → NEXT.** Deeper capture (confidence, reasoning, per-pick visibility) preserved underneath but never asked during the default fast loop.

Backend (all additive, no changes to frozen 1A/1B):
- `iq_boards` collection — one board per (user, board_date), populated from tonight's real slate, capped at 10 (honest — never manufactured to reach 10).
- `GET /api/iq/board?device_id=&board_date=` — get-or-create today; past dates return 404 without fabrication.
- `POST /api/iq/board/{id}/lock` — idempotent per question. Reuses `iq_calls` (kind=`pick10_entry`) and `iq_events` (`instinct_captured` + `locked`). One-time `default_visibility` from prefs — no per-pick visibility prompt.
- `POST /api/iq/board/{id}/resolve` — dev-mode grading against a deterministic winner. Real 1B-driven grader is next.
- `PATCH /api/iq/user/prefs` — one-time `default_visibility` save.
- 6/6 pytest regression tests green (`tests/test_boards.py`).

Frontend (Phase 3 phone-review corrections applied):
- New `TonightsTenLoop` — full-viewport question card, two large tappable crests, auto-advance after ~550ms lock flash. No confidence, no "Why?" tags, no per-pick visibility chooser in the default loop.
- New `MyIQCommandCenter` — activity-first layout: Tonight's 10 hero tile → Last Night grading → "Your IQ is building" warm empty state → low-emphasis My Bets tile → Go Deeper concept card.
- New `LastNight` — resolved board renders per-question row (your pick vs winner, right/miss pill). Honest empty state when nothing has resolved.
- Tonight logo hierarchy corrected: main matchup crests shrunk to 104px, THE READ row crests enlarged to 64px, Season Comparison team logos enlarged to 40px. `EDITORIAL · PRE-MODEL` demoted to small neutral disclosure.
- Removed from the general Hockey IQ experience: blanket 18+ `BETTING · LOCKED` unlock panel; four-empty-analytics-card wall; Fantasy as a My IQ performance metric. Capabilities preserved in code for future regulated features.

## Prioritized backlog

### P0 (up next)
- **Phone review of Tonight's 10 fast loop** (built 2026-02-14). Awaiting user sign-off before expanding board templates or adding Go-Deeper capture UI.

### P1
- **Real board resolution against Foundation 1B** — replace the dev-only `POST /iq/board/{id}/resolve` with a scheduler that grades each question as its game's `iq_game_finals` lands.
- **Additional resolvable question templates** — `team_scores_first`, `game_reaches_ot`, `saves_higher`, `shots_higher`, `total_goals_over_5_5`. Board still capped at 10 and honest about slate size.
- **Go Deeper with My IQ (functional)** — opt-in workflow that turns on confidence + reasoning capture in the fast loop for users who tap in.
- **Foundation 1C — Head-to-Head memory** across the last N head-to-heads between two teams (opponent-context history).
- **Foundation 1D — Lineup / personnel / role deltas** using boxscore + gamecenter data.
- **Foundation 2 — Signal Lab** (Prediction Memory & Signal Attachments).

### P2
- **Community redesign** — leaderboard-style Who's Hot / Specialists / Friends / All (deferred per Feb 2026 phone review).
- **Betting IQ Team + Player lenses** (L.7 in the consolidated architecture).
- **Coach role prompt hardening** (L.8).
- **My Bets drift panel** with prediction-vs-bet analytics (≥25 sample gate).
- **Phase 4 — Fantasy: Yahoo / ESPN import**, real player data (Sportradar production ingest once trial is renewed).
- **Phase 5 — Forum + Community IQ expansion.**

### P3
- **Refactor `server.py`** into `/app/backend/routes/*` and `/app/backend/models/*`; break down the 2.9k-line file. Deferred per user.
- **Special Teams IQ Free Baseline** — build sequence S4.1 - S4.8 per `/app/memory/SPECIAL_TEAMS_IQ_STEP3_BASELINE_PLAN.md`. On hold pending user direction.

## Known limitations (honest)
- Sportradar NHL v7 → 403 Forbidden (trial expiry). Sportradar-only fields stay null; never fabricated.
- GoalieLine.ticker_player_id is currently null; provider NHL id captured for later back-fill by a goalie player resolver.
- `iq_dev` simulation and Phase 3 coach responses use `IQ_DEV_MODE=1` when enabled.

## Test discipline
- All new work must ship with tests. Fixture-driven for external APIs (no live HTTP in CI).
- Foundation 1A: `/app/backend/tests/foundation_1a` — 25/25.
- Foundation 1B: `/app/backend/tests/foundation_1b` — 23/23.
