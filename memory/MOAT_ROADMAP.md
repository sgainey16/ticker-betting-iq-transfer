# The Ticker — Founder/Power-User Experience & Proprietary Moat Roadmap
*Prepared for Emergent build planning*

---

## 1. Back-Office / Personal Console Tab
A management tab, separate from the panel/show experience, giving any user (founder included) a console view of their own data and history.

### Prediction & Pick History
- Full log of every pick made — game winners, props, Pick 10 — each tagged with the reasoning captured at the time it was made
- Accuracy broken out by category (not one blended number): game picks vs. props vs. fantasy calls
- Trend view over time (weekly/monthly), feeding the recap feature (see Section 3)

### "Coach for the User" Analytics Layer
- Pattern-detection on the user's own history: e.g. strongest on shots-on-goal props, weakest on totals — same anomaly-detection approach used for teams, pointed at the individual
- A running "edge" score comparing the user to the general accuracy baseline (target: ~15% above average North American bettor)
- Streak/momentum tracking on the user's own picks (separate from team Momentum Score) — hot or cold right now

### Fantasy/Roster Management
- Loaded fantasy team(s) and league-specific scoring rules in one place, so Presser can reference them directly without the user re-explaining each session
- Roster suggestions (waiver adds, trade targets) surfaced from the analytics engine, tied to the user's specific league scoring

### Account/Subscription Controls
- Tier status and usage against monthly question allotment (relevant once metered pricing is live)
- Granular notification controls (not all-or-nothing)
- Character/pace preference settings (which panel personality, depth level) — manual override alongside automatic learning

### Community/Social (once that layer exists)
- Public-facing profile if opted into an open account (Elo rating, follower count) — private by default, visible here regardless

**Suggested build order:** prediction/pick history log + fantasy roster info first (pure display on data already being collected) → "coach for the user" pattern-detection once the core analytics engine is live (phase 2).

---

## 2. Presser (1-on-1) Personalization Deep Dive
Goal: move Presser from "generic chatbot that answers what's asked" to "personal analyst that already knows you."

### Pre-loaded Context (highest priority fix)
Before a session starts, Presser should already have a "user brief" fed into its prompt: followed teams/players in priority order, fantasy roster + league scoring rules, prediction/pick history and accuracy record, and topics touched in past sessions. This is a prompt/data-plumbing fix, not new infrastructure — and it's the single biggest lever against the "generic" feedback already flagged.

### Depth-Matching
Track a rolling signal (question complexity, follow-up rate, how often they ask "why") and let Presser calibrate explanation depth automatically, rather than giving every user the same level of detail.

### Proactive Opening
Instead of a blank input box, Presser opens with 1-2 things relevant to that specific user — an anomaly on their team, a fantasy-relevant call-up, how a recent pick is trending. Reuses the Anomaly Engine, pointed at the individual instead of the general feed.

### Personality/Pace Matching
Track which panel character's tone (confident vs. counterpoint style) drives more engagement/return visits per user, and let the 1-on-1 experience lean toward that character over time — building on the already-planned pace-of-speech tracking.

### Closing the Loop
Presser references its own past advice ("last week you asked about X — here's how that played out"), tying directly into the recap/track-record system. This is what makes it feel like an ongoing relationship rather than a fresh session each time.

### Manual Override
A simple settings toggle for "deep dive" vs. "quick take" per topic, and which teams/players to prioritize — cheap to build, gives users direct control alongside the automatic learning.

**Suggested build order:** pre-loaded user context + proactive opening first (prompt-engineering work, highest payoff) → depth-matching and personality-matching once usage data exists to learn from.

---

## 3. Proprietary Moat Roadmap (User-Generated Data Concepts)
Core principle: the composite analytics scores (Ticker Intelligence layer) are a good differentiator but are copyable by a well-resourced competitor within 6–12 months. The actual moat is data only The Ticker accumulates over time, plus a public accuracy track record that can't be backfilled by a new entrant.

### Phase 1 (launch) — invisible plumbing
- Log every prediction (AI and user) with reasoning, whether it's a game pick, Pick 10 entry, or fantasy call — required foundation for everything below
- Simple win % / accuracy badge (already speced) — no moderation burden

### Phase 2 — turn logged data into visible features
- Weekly/monthly recap of a user's picks, reasoning, and record (Spotify-Wrapped style) — pure data replay, low risk
- Elo-style rating layered onto the existing points system — math change on data already collected
- Kaggle-style open model competition — public prediction competition against Ticker's dataset once enough historical data + outcomes exist to seed it; drives free R&D and credibility, but requires real data history first

### Phase 3 — features needing moderation/legal groundwork
- Public/followable profiles + social following tied to Elo success ("personalities" on the platform) — needs the identity/privacy and moderation plan
- Waze-style real-time fan reporting (morning skate/injury news) — needs a verification/trust-tier system before it's safe to surface publicly
- Prediction-market-style staking/points betting mechanic — needs legal review (leaning toward sweepstakes-style structure, points earned free with a no-purchase alternate entry, feeding a company prize pool rather than direct cash wagering)

### Can start earlier than the rest
- Local media hire for first-info updates (Glassdoor-style insider info) — a single trusted, controlled source rather than open crowdsourcing, so this can be pulled forward as an earlier differentiator if desired

**The throughline:** none of this is a real moat until it's been running long enough to produce a track record. Starting the invisible logging in Phase 1 is what makes Phase 2–3 features meaningful instead of empty when they launch.
