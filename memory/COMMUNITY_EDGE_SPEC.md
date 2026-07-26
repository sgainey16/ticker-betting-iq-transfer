# The Ticker Community Edge™

**Build spec | Location: Public Profiles + Discovery + Follow layer | Status: DEFERRED post-MVP**

## The one-line pitch

> *"Follow this predictor for Bruins games. Don't follow them for player props."*

Every other creator-follow platform ranks people by one number.
The Ticker Community Edge™ ranks people by **where they've proven a measurable edge** — and just as importantly, **where they haven't**.

## Core idea

Anyone can make picks. Very few people can prove they consistently beat a specific market. **The Ticker verifies it.**

## How it connects to Personal Betting IQ

- **Personal Betting IQ** = the app knows YOU (your bet history, biases, tendencies, historical spots you win/lose in)
- **Community Edge** = the app knows WHO ELSE is worth listening to (verified experts per category, not overall)

Together they close the loop: *"The model likes this game. You historically lose in these spots. But BruinsKing88 hits 72% on Bruins home games — worth a look."*

---

## 1. Public User Profile

Every user has a public profile (opt-in).

**Example — SteveG:**

| Metric | Value |
|---|---|
| Overall Accuracy | 64.2% |
| ROI | +18.4% |
| Record | 823-458 |
| Followers | 4,327 |
| **Edge Rating** | 92 |
| Verified Predictions | 1,281 |

Every number here must comply with **Section 7 of the Betting IQ spec** — minimum sample sizes + confidence bands. A 3-0 profile doesn't get an "Edge Rating."

---

## 2. Strength Breakdown

Instead of one ranking → show where each user **excels** AND **struggles**. That honesty is what builds trust.

**Example — SteveG on Bruins:**

| | |
|---|---|
| Record | 126-68 (65%) |
| ROI | +21% |
| Edge Rating | 96 |
| Confidence | High |

**Example — SteveG on Edmonton:**

| | |
|---|---|
| Record | 18-31 (36%) |
| ROI | -14% |
| Recommendation | **Do not follow Edmonton picks** |

Followers instantly know: *"This person understands Boston. Don't tail them on Edmonton."*

---

## 3. Team & Category Specialists (Auto-generated leaderboards)

The app automatically maintains rankings such as:

- Best Boston Predictor
- Best Vancouver Predictor
- Best Toronto Predictor
- Best Goalie Props Predictor
- Best Totals Predictor
- Best Underdogs Predictor
- Best Saturday-Night Predictor
- Best Playoff Predictor
- Best First-Goal Predictor
- Best Rookie Props Predictor

Every category is its own leaderboard. **Nobody ranks in every category** — that's the point.

---

## 4. Follow Predictors

Just like following creators.

**Example — a user's Follow list:**

- BruinsKing88 (community member)
- Reggie Banks (Ticker analyst)
- Marc Collins (Ticker analyst)
- MoneyPuck AI (external model)
- The Ticker Model (proprietary)
- Steve (personal friend)

**Every morning delivery becomes personal:**

> "BruinsKing picked BOS -1.5"
> "Reggie picked the Over"
> "Steve skipped today's game"

Each is a tiny signal. Aggregated across a user's follow list, they form a personal consensus that no other product can generate.

---

## 5. Trust Score (proprietary composite ranking)

Accuracy alone isn't enough. The Trust Score blends:

- Prediction accuracy
- Return on investment (ROI)
- Sample size
- Consistency (variance, not just mean)
- Recent performance
- Diversity of bets (not just one bet type / one team)
- Verified history length

**Rule**: An 8-2 profile never ranks above a 630-410 profile over two seasons. Sample size is a first-class ranking dimension.

---

## 6. "Why They Win" Explanations

Viewing a profile should answer *why*, not just *what*.

**Example — Why is BruinsKing ranked #1 for Boston?**

- 72% on Bruins home games
- +28% ROI on Bruins moneyline
- Excellent goalie-matchup predictions
- Avoids emotional betting after Boston losses
- Doesn't force bets on national-TV games

Plain-language reasons, all backed by verifiable data in the profile.

---

## 7. Copy Predictions (One-Tap Follow)

- **Follow Steve's Picks** — one tap, done
- **Notify me when Steve posts** — push
- **Notify me when Steve and Reggie agree** — 2-signal alert
- **Notify me when three trusted analysts agree** — consensus alert
- **Notify me when Steve disagrees with the consensus** — contrarian alert

Every notification threshold is user-configurable.

---

## 8. Communities & Groups

Users can create:

- Public groups
- Friends leagues
- Family pools
- Fantasy leagues
- Office competitions
- City leaderboards
- Country rankings

Community leaderboards create local competition — the retention engine at the social layer.

---

## 9. Reputation Badges

Earned through **verified performance**, never purchased.

Examples:

- 🏆 Bruins Expert
- 🧤 Goalie Guru
- 🎯 Prop Hunter
- 📈 Underdog King
- 🔥 20-Game Streak
- 💰 Positive ROI (500+ Bets)
- 📊 Data Disciple
- 👑 Elite Predictor

Every badge has a documented threshold. Badges revoke when performance regresses below threshold (with a grace period).

---

## 10. The Signature Feature — Verified Edge

Rank users NOT by overall accuracy — by **Verified Edge per category**.

Verified Edge combines:

- Long-term ROI in that category
- Prediction accuracy in that category
- Number of verified picks in that category
- Consistency over time in that category

Then a user sees:

> "Follow this predictor for Bruins games. Don't follow them for player props."

**That is much more useful than one overall percentage.** It tells people *where* someone has demonstrated a measurable edge, not just that they had a good run overall.

This is the signature ranking system for The Ticker Community Edge™.

---

## Placement & UX

- **Public profiles**: `/u/:handle` route (SEO-friendly, shareable — every profile becomes an acquisition surface)
- **Discovery**: dedicated `/community` page for browsing leaderboards, categories, communities
- **Inline surfacing**: on any matchup page, show *"Top-rated predictors for this specific matchup type"* — turns every Deep Dive into a discovery moment
- **Notifications**: push + email, with rich per-follow-signal configuration

---

## Legal Flag

**Requires its own legal review — separate from Betting IQ AND from the core sweepstakes/points system.**

Community Edge introduces:

- **Public monetary claims** ("+28% ROI") — advertising / tout-service considerations
- **Copy-picks / follow mechanics** — potential regulation as a tip-selling service in some jurisdictions
- **Cross-user financial performance visibility** — data-protection considerations
- **Anti-fraud / spoofing** — verified-history mechanics need to be tamper-resistant, and profiles with financial claims need audit-trail integrity

Precedent platforms (Action Network Contributors, Pyckswise, MoneyBadger) exist — study their operating models and legal footprint before scoping build.

---

## Phasing

**NOT MVP.** Also NOT the first post-MVP feature — Community Edge only works once there's a meaningful population of users with **verified history** to rank. Realistic sequence:

1. **Ship core MVP** (predictions, Matchups tab, Deep Dive)
2. **Ship Personal Betting IQ Phase 1** (bet log + tendency stats)
3. **Grow user base to N** (where N produces enough per-category history to auto-generate credible leaderboards — likely thousands, not hundreds)
4. **Launch Community Edge in three sub-phases**:
   - a. Public profiles + Strength Breakdown + Verified Edge scoring
   - b. Follow mechanics + notification thresholds
   - c. Communities/groups + badges

Building Community Edge before user volume exists = empty leaderboards = product looks dead. Timing is critical.

---

## Why this matters strategically

**Personal Betting IQ creates retention.** A user's own history compounds — the more they use the app, the more valuable it becomes to them personally.

**Community Edge creates network effects.** Every verified expert brings their following. Every follower becomes an acquisition surface. Every badge earned is a shareable moment.

Together they lock in the moat:

- Predictor apps: "Here's a probability."
- The Athletic-style content: "Here's an article."
- The Ticker: *"Here's a probability. Here's how YOU historically perform in this spot. And here's a verified expert in this specific category, ranked by Verified Edge, that you could follow — or fade."*

That third product has no obvious competitor and would be genuinely hard for a well-funded incumbent to replicate — because the personal-history data and the verified-community-history data are both **compounding assets that only grow with time**.
