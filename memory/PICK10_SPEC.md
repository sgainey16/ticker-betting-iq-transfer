# The Ticker — "Pick 10" Daily Prop Game: Build Spec
Companion to the analytics handoff doc (`ticker-analytics-handoff.md`). That doc defines the Player Prop Engine — this doc defines the daily game built on top of it.

---

## 1. Concept
A daily, low-friction prediction game: pick 10 outcomes, come back tomorrow to see how you did. Modeled on the daily-ritual format (think Wordle/daily-quiz style) — one round a day, quick to play, satisfying to check back on.

## 2. Core loop
1. **Tab opens** to the day's Pick 10 board.
2. **User picks 10 predictions** — sourced from the day's trending/popular markets in the Player Prop Engine (goal scorers, point props, shots on goal, team totals, etc.). Mix of near-locks and genuine toss-ups so a perfect score stays meaningful.
3. **Picks lock** once games start (no editing after lock).
4. **Next day**, results are graded automatically as real outcomes come in.
5. **Score posts to the user's wall** (e.g. "7/10") with an updated **lifetime hit-rate** shown alongside it.
6. **Push notification** tells the user their score is ready — the primary retention hook for this feature.

## 3. Question sourcing
- Pulled from the same Player Prop Engine markets defined in the analytics handoff doc (goal props, point props, shots, saves, team totals, etc.)
- Should be the day's **trending/most-bet-on** props, not a random sample — gives the game a "what's everyone talking about today" feel
- Start with a fixed board (same 10 questions for every user each day) — this keeps scores directly comparable across the leaderboard. A personalized "build your own 10" version can come later once the engine is proven out.

## 4. Scoring rules
- **Two separate scores — do not combine:**
  - **Game-prediction accuracy** (the existing daily win/loss pick feature) stays its own running % with its own badge (60%+ threshold).
  - **Pick 10 score** is tracked independently — its own daily result and its own lifetime hit-rate.
- **No streak/"turkey" bonus** on Pick 10 — that mechanic applies to the continuous daily game-pick format, not this fixed 10-question daily set.
- **A perfect 10/10 should be rare by design** — achieved through the mix of question difficulty (step 2 above), not through scoring rules. It should feel like a genuine achievement worth sharing, not a routine outcome.
- **Leaderboard ranks by lifetime hit-rate** for now (total correct ÷ total picks, across all days played) — simplest, most defensible metric to launch with. Room to expand later (e.g. surfacing perfect-10 count as a separate flex stat/badge) once usage data exists.

## 5. Wall/social layer
- Every graded score posts to the user's wall automatically — this is the primary marketing loop (more eyes on scores = more organic reach).
- A shareable score card (score, lifetime hit-rate) should be easy to post outward (social share), not just visible in-app.
- Feeds the existing "Following" feature — high lifetime hit-rate is exactly the kind of track record that makes a user worth following as a "celebrity picker."

## 6. Explicitly deferred (not needed for v1)
- Points/currency tied to Pick 10 results — can layer on later once the core loop is validated
- Personalized/build-your-own-10 board
- Streak or bonus mechanics of any kind
- Perfect-10 count as its own ranking stat (may add as a secondary badge later)

## 7. Dependencies
- Requires the Player Prop Engine (see `ticker-analytics-handoff.md`, section 6) to be generating daily prop predictions with confidence scores — Pick 10's question board is pulled directly from that output.
- Requires push notification infrastructure for the next-day results loop.

## 8. Brand reference
- **Colors:** Ticker Blue `#1E5BFF`, Ice White `#FFFFFF`, Night Black `#0B0B0F`, Steel Gray `#5C6670`, Puck Silver `#C8CDD3`
- **Type:** Rajdhani Bold (headlines), Oswald SemiBold (accent/labels), Inter Regular (body)
