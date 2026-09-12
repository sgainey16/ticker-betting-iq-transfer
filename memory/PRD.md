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

## Prioritized backlog

### P0 (up next)
- **User review of Foundation 1B** — evidence report submitted; awaiting sign-off.

### P1
- **Foundation 1C — Head-to-Head memory** across the last N head-to-heads between two teams (opponent-context history).
- **Foundation 1D — Lineup / personnel / role deltas** using boxscore + gamecenter data.
- **Foundation 2 — Signal Lab** (Prediction Memory & Signal Attachments).

### P2
- **Phase 4 — Fantasy: Yahoo / ESPN import**, real player data (Sportradar production ingest once trial is renewed).
- **Phase 5 — Forum + Community IQ expansion.**

### P3
- **Refactor `server.py`** into `/app/backend/routes/*` and `/app/backend/models/*`; break down the 2.7k-line file. Deferred per user.

## Known limitations (honest)
- Sportradar NHL v7 → 403 Forbidden (trial expiry). Sportradar-only fields stay null; never fabricated.
- GoalieLine.ticker_player_id is currently null; provider NHL id captured for later back-fill by a goalie player resolver.
- `iq_dev` simulation and Phase 3 coach responses use `IQ_DEV_MODE=1` when enabled.

## Test discipline
- All new work must ship with tests. Fixture-driven for external APIs (no live HTTP in CI).
- Foundation 1A: `/app/backend/tests/foundation_1a` — 25/25.
- Foundation 1B: `/app/backend/tests/foundation_1b` — 23/23.
