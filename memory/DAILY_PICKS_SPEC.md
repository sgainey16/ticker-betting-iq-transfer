# The Ticker — Daily Picks Feature (Phase 1)
### For Emergent
---

## Concept
A simple daily win/loss prediction game, designed as an easy, launchable phase-1 version of the larger prediction/community system (full staking, debate threads, and multi-character picks are phase 2 — documented separately).

---

## How It Works
1. **Reggie picks the games of the day.** As part of the daily show, Reggie dissects each game in depth and makes his call (win/loss) on air. This gives the show a built-in nightly segment structure and a concrete reason to dig into matchups beyond general banter.
2. **Marc reacts, but does not make his own competing pick.** Marc comments on Reggie's reasoning (agrees, pushes back with the data, needles him if the numbers don't support the call) — this preserves Marc's analytical credibility without creating a parallel prediction that could conflict with Reggie's or with the analytics engine's own tracked accuracy.
3. **User makes their own pick *after* hearing Reggie's insight and reasoning** — not before. The show/analysis is the draw; the pick is the payoff, made with full context rather than a blind guess.
4. **The app tracks:**
   - The user's ongoing running win percentage across all their picks
   - Whether the user agreed with or faded (picked against) Reggie's call, and how each performs over time
   - Reggie's own running record, revisited afterward against the actual stats/outcomes (a natural recurring "how'd the picks hold up" segment)
5. **Badge:** user unlocks a badge once their running win percentage crosses 60%.

---

## Design Notes / Rationale
- This can double as the structural backbone of the daily show itself — "run through tonight's games and make the picks" gives every episode a built-in spine (which games to cover, in what order, ending in a call), rather than needing a separate content plan for what the show discusses each day.
- Deliberately simple for launch: no staking, no public debate threads, no scoring formulas — just pick, track, badge.
- Keeps the analytical panel's credibility intact — Reggie is the one "on the record" making bold calls (fits his experience/gut-instinct character), Marc stays the trusted data voice without ever being "wrong on purpose."
- Agree/fade tracking keeps the mechanic interesting even though many users will simply mirror Reggie's pick after hearing his case — a user who fades him and wins should feel that as its own accomplishment, separate from raw win %.
- Purely for fun at this stage — no money/staking attached in phase 1.
- Sets up the data foundation (user pick history, agree/fade outcomes, Reggie's tracked accuracy) that the fuller phase-2 prediction/staking/debate-thread system can build on later.

---

## What This Needs From the Analytics Engine
- A daily "Reggie's Pick" data object per game: game ID, pick (winner), Reggie's stated reasoning/key stats cited, timestamp
- A user-pick record: user ID, game ID, pick, whether it matched Reggie's pick (agree/fade flag), actual outcome, timestamp
- A rolling win-percentage calculation per user, updated as game outcomes are confirmed
- A rolling win-percentage / accuracy record for Reggie's picks specifically, for the "how'd the picks hold up" recap segment

---

## Sibling feature — Pick 10 daily prop game

The Daily Picks game (this doc) tracks *game-outcome* accuracy — win/loss per game, one call per game Reggie covers, badge at 60%.

A separate daily game — **Pick 10** — runs on top of the Player Prop Engine and tracks *prop-prediction* accuracy on a fixed 10-question daily board. See `PICK10_SPEC.md`.

**Scoring is deliberately independent:** the two games have their own daily result, their own lifetime hit-rate, and their own badges/leaderboards. Never combined. This keeps each game's credibility clean and gives users two distinct achievements to chase.

**Dependency order:** Daily Picks can ship in Phase 1 (only needs schedules + winner outcomes — free). Pick 10 waits for the Player Prop Engine to be online.
