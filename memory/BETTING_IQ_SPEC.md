# The Ticker — Personal Betting IQ

**Build spec | Location: Back Office (Office / Personal Page) | Status: DEFERRED post-MVP**

---

## Summary

A personalization layer that turns The Ticker from a predictor
("Dallas has a 63% chance to win") into a **coach**
("You lose money betting against home underdogs").

Works by logging every bet a user makes, mining that history for
tendencies and behavioral patterns, and feeding personalized
recommendations back into the daily experience — layered on top of the
existing game-level Edge Score, **not replacing it**.

Lives on the **Back Office page** as its own tabbed module, alongside
the other personal back-end data already planned there.

---

## 1. Data Model — Bet Log

Every logged bet captures:

- Date
- Game / matchup
- Bet type (moneyline, spread, puck line, totals, player prop,
  first goal, shots, saves — tracked as **distinct categories**,
  not lumped together)
- Odds
- Stake
- Result (win/loss)
- Profit / loss

Raw table everything below is computed from. Manual entry is the likely
v1 path. Auto-import from sportsbook affiliates is a stretch goal worth
scoping separately.

---

## 2. Derived Tendency Stats

Computed from the bet log, refreshed as new bets are added:

- **Team history** — record and net P/L betting *on* each team
  ("Vancouver: 34 bets, 12-22, -$412")
- **Against-team history** — record betting *against* each team
- **Home vs. away** — win-rate split
- **Favorite vs. underdog** — win-rate split
- **By bet type** — win rate and ROI per category (moneyline, spread,
  props, etc., independently)

Each stat generates a plain-language callout when it crosses a
meaningful threshold (sample size + edge). Example: *"You consistently
overestimate Vancouver"* — not just raw numbers.

---

## 3. Psychological / Behavioral Pattern Detection

Rules-based alerts, each **backed by the user's own historical data
point**:

- **Revenge betting** — flag a bet placed within ~12 hrs of a loss;
  surface the user's historical win rate in that window
- **Tilt** — flag after 3 consecutive losses; surface historical
  performance on the next bet after a 3-loss streak
- **Overconfidence** — flag a shift toward favorites after a win
  streak; track whether that shift historically correlates with worse
  results for this user
- **Emotional / team bias** — flag disproportionate betting volume on
  a user's followed / favorite team; surface ROI on that team
  specifically

Tone: **supportive coaching, not surveillance**. Plain language,
always paired with the user's own numbers, never generic advice.

---

## 4. Personal Edge Score

A second score layered next to the existing game-level Edge Score:

- **Game Edge** (existing system output)
- **Your Historical Edge** (how this user has historically performed in
  comparable spots — same bet type, home/away, fav/dog, team)
- **Confidence** (derived from sample size)
- **Recommendation** (plain-language: lean in / neutral / **skip**)

**"Skip" is explicitly allowed** and should appear when the bet doesn't
match the user's proven strengths. This is the differentiator vs. every
other betting product that only ever says "bet more."

---

## 5. Betting DNA Profile

A long-run summary page (unlocks after sufficient bet volume — exact
threshold TBD) showing:

- Risk tolerance
- Best leagues / bet types / odds ranges
- Best days of week / time of season
- Teams to avoid vs. teams mastered
- Which analyst's picks (Reggie, etc.) they perform best following
- Which stats predict their wins vs. which they tend to ignore

---

## 6. Daily Surfacing — "AI Betting Coach"

Morning delivery should lead with:

> *"Here are the five games that match your historical strengths"*

Not just the day's biggest games. **This is the core behavior change**
from a generic predictor to a personalized coach, and should be the
**most visible expression** of this whole feature.

---

## Placement & UX

- **Home base**: Back Office page, as its own tabbed module
  ("Betting IQ") alongside Fantasy team, Preferences, etc.
- **Inline surfacing**: Personal Edge Score should also appear inline
  wherever the game-level Edge Score already appears, once a user has
  enough logged history.
- **Betting DNA**: deeper page reached *from* the Betting IQ module —
  not front-loaded on first visit.

---

## Phasing Recommendation

**NOT a launch / MVP feature.** Depends on real bet-logging volume
existing first, and needs its own legal review pass separate from the
sweepstakes / points structure already planned. Personalized "bet this
/ skip this" output is a **different regulatory category** than general
prediction content.

Reasonable sequencing:

1. **Bet log + basic tendency stats** first (team / home-away / fav-dog
   splits) — ships once logging volume exists
2. **Behavioral pattern alerts** — after tendency stats prove out
3. **Personal Edge Score** — once game-level Edge Score is stable
4. **Betting DNA + "AI Betting Coach" daily surfacing** last — needs
   enough data per user for it to be genuinely accurate rather than a
   guess

---

## Legal Flag

This feature was **intentionally scoped separately** from The Ticker's
core points / sweepstakes structure (already legal-reviewed for
wagering-adjacent risk).

**Personalized betting recommendations require their own legal pass
before build.** Do not inherit clearance from the existing prediction /
points system.

---

## Why this matters strategically

Every other sports-analytics / betting product on the market is a
**predictor**. Give them a game → they give you a probability. That's a
commodity. Anyone can build it.

A **coach** — one that knows your own history better than you do, and
tells you when to skip — is a category no one owns yet. It also produces
the retention and LTV that predictors can't: users don't churn from
something that's actively saving them money on their own weaknesses.

This is the feature that moves The Ticker from *"cool app"* to
*"category-defining product I tell my friends about."*
