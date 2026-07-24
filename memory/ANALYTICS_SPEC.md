# The Ticker — Analytics Section Build Spec
### For Emergent — Phase 1 Analytics Engine
---

## 1. Purpose & Philosophy

The Ticker's analytics section is not a stats website. Most existing hockey analytics sites (MoneyPuck, Natural Stat Trick, HockeyViz) say **"here is the data."** The Ticker's differentiator is saying **"here is what the data means, and here's what you should do about it."**

The AI (via panel characters Reggie and Marc) should work *for* the user like a personal analyst — surfacing the handful of things that actually matter for a decision, rather than dumping raw numbers and leaving the user to interpret them. Visual stat pages exist as a secondary "show me the receipts" layer users can tap into after the AI's proactive insight gets their attention — not the primary interface.

Core goal: give the average gambler and fantasy player the best available data, delivered as clearly and easily as possible, with guided follow-up questions — this is the path to being the best in the category, not out-doing competitors on raw data volume.

---

## 2. Three-Layer Data Architecture

**Layer 1 — Internal Research Library**
A cataloged reference of existing public analytics models and methodologies (HockeyViz, MoneyPuck, Natural Stat Trick, Evolving-Hockey, NHL EDGE, academic xG papers). For each: creator, inputs/outputs, strengths/weaknesses, predictive value, licensing status.
- **Important:** This layer is for *studying methodology only*. The Ticker does not ingest, scrape, or use these sites' proprietary computed outputs (their models, heat maps, or derived scores) in its own prediction engine — even internally/invisibly. Only publicly available raw data and openly published methodology may inform The Ticker's own models.

**Layer 2 — Licensed/Public Structured Data**
Raw inputs the prediction engine is actually built on:
- **sportsdata.io (paid)** — schedules, rosters, injuries, box-score stats, odds, historical data, news. Note: does NOT provide shift-by-shift or on-ice player tracking data.
- **NHL public API/endpoints** (`api-web.nhle.com`, `api.nhle.com/stats/rest`) — fills the gap above: shift data, on-ice player tracking, shot x/y coordinates, play-by-play with game state.
- **NHL Records and Stats API** — historical stats.
- News API vendor (e.g. NewsAPI/Newscatcher-style) for media articles.
- Monitored-account service (not raw X/Twitter API) for tracking breaking-news insiders.

**Data licensing roadmap:** Official/exclusive NHL data licensing (the tier Sportradar currently holds exclusively for sportsbooks/media) is a future business-development goal once The Ticker has real traction and revenue — not a Phase 1 target. No self-serve application exists for this; it requires a direct partnership conversation.

**MOAT PLUMBING (start at launch, not later):** Composite analytics scores are copyable by a well-resourced competitor within 6-12 months — they aren't the moat. The real moat is accumulated data + public accuracy track record that can't be backfilled. **Phase 1 must include invisible logging of every prediction (AI and user) with reasoning captured at pick-time.** See `MOAT_ROADMAP.md` for the full three-phase plan (invisible logging → recap/Elo features → community + sweepstakes-style staking).

**Existing pipeline asset:** A data pipeline script for the NHL API + MoneyPuck pulls already exists as a starting point — ask the founder for it directly before Sprint 1 kicks off.

**Visual + logic reference:** The concrete UI target for the matchup analytics feature lives in `/app/memory/mockups/ticker-matchup-sheet.html` (component/UI reference — sample data only) and `/app/memory/mockups/MATCHUP_ANALYTICS_SPEC.md` (data + logic behind it, incl. 20-category framework, Ticker Intelligence composite scores, factor-importance transparency "Holy Grail," Fact/Reported/Rumor confidence tiers, Community Consensus mechanic, and intangibles layer). Treat the Matchup Sheet as the flagship visual output of Layer 3 — the "receipts view" that the guided-question UX drills into on demand.

**Elite Prospects licensing target:** For deep cross-era player coverage (drafts, juniors, international, retired players, European leagues below the NHL pipeline), the canonical source is **Elite Prospects Data Services** — enterprise licensing, direct partnership only, typical deals ~$1,500–$5,000/mo depending on scope. Same "future business-development" tier as Sportradar/NHL exclusive. Not Phase 1. In the interim, we cover ~80% of the historical need using NHL's own public API (`/v1/player/{id}/landing` returns career + junior + international splits for most NHL players), the NHL Records API for all-time stats and draft history, and Wikidata/Wikipedia for biographical detail — all free and legitimately usable. Scraping Elite Prospects is prohibited by their ToS and creates real legal exposure for a commercial app.

**Layer 3 — The Ticker's Proprietary Intelligence Engine**
Built on top of Layer 2 raw data. This is the actual product/moat.

---

## 3. Layer 3 Model Ideas (Prediction/Insight Engine)

- Player Impact
- Team Momentum
- Line Chemistry
- Goalie Confidence
- Defensive Breakdown Detection
- Matchup Advantage
- Fatigue/Rest Advantage
- Coaching Tendencies
- Offensive/Defensive Pressure
- High-Danger Chance Rating
- Expected Regression
- Fantasy Opportunity Score
- Betting Confidence
- Prediction Confidence
- Risk Rating
- Player Trend Score

Every prediction (winner, score, player projections, confidence, models used) should be logged against actual results, so the system can measure which models/combinations perform best and self-improve over time.

---

## 4. Deep Matchup/Shot Analytics Spec

The highest-value, hardest-to-replicate layer. Core inputs needed:

**Shot location & quality**
- Distance from net, angle
- Shot type (wrist, slap, tip, one-timer, rebound)
- High-danger zone flag (home-plate area)

**Shot timing / game context**
- Score state at time of shot
- Rush chance vs. off-cycle chance
- Time since last zone entry / faceoff win

**Pre-shot movement**
- Cross-ice ("east-west") pass immediately before shot
- Number of passes/touches in the scoring sequence

**Matchup layer**
- Which opposing D-pair (and forward line) was on ice for the shot
- Strength state (5v5, PP, PK)

**Shift-timing / fatigue layer**
- Time elapsed in the shift when the shot occurred
- Extended shift flag (60+ seconds)
- Back-to-back shift situations

**Why this matters:** individual stats like "shot location" or "which D-pair" are common. The differentiator is *stacking* them — e.g. "Team X generates high-danger chances specifically against a tired 3rd-pairing D in the last 15 seconds of their shift, especially off odd-man rushes." That's a specific, actionable insight no public site packages this way.

Required raw fields: shot x/y coordinates, shot type, time-in-period, on-ice player IDs (both teams), shift-start timestamp per player, score state. All available via NHL's public play-by-play/shift feeds.

---

## 5. Anomaly Engine / "Story Opportunity" System

System continuously asks "what changed" and proactively surfaces stories rather than waiting for user questions — e.g. a player shooting more, a goalie outperforming expectation, a line's chemistry emerging, a defense collapsing.

**Story Opportunity Score (0–100)** determines response depth:
- 0–30: report the stat plainly
- 31–60: add light context
- 61–80: search hockey history for a comparable/relevant callback
- 81–100: full panel discussion — jokes, comparisons, predictions, historical callbacks

---

## 6. Daily Intelligence Reports

AI-generated daily report covering:
- Biggest team trends
- Hottest/coldest players
- Biggest fantasy and betting opportunities
- Lineup surprises
- Injury impacts

---

## 7. Trade Analyzer Feature

User proposes trading Player B for Player C; the AI evaluates both across:

**Requested data points**
- Ice time — by line/linemates, and by part of the game
- Basic stats — shots, hits, fights
- Touches, turnovers
- Zone time
- Bio — age, weight, height, years in league
- Career totals (e.g. top goals all-time)
- Trending stats — increasing/decreasing over recent stretch
- Penalties drawn / penalties taken

**Recommended additional layers**
- Deployment context: PP1/PP2 vs. PK time, quality of linemates, quality of competition, home/road splits
- Regression/luck indicators: shooting % vs. career average, PDO, actual goals vs. xG
- Trajectory: last 5/10/15 games vs. season pace, and *why* (role change, linemate change)
- Risk factors: injury history/durability, coach trust, team situation (contender vs. rebuild), contract status
- Position-specific: faceoff win% (centers), multi-position roster eligibility

**Output goal:** not "who has more points" but "who's sustainable vs. who's inflated" — a clear verdict, not just a stat comparison.

---

## 8. Guided Question UX (Core Interaction Model)

This is the primary interface pattern for analytics delivery — not static dashboards.

**Design rules:**
1. Lead with the verdict-relevant insight, not a stat dump.
2. Offer 2–3 tappable follow-up question chips that guide a non-expert toward the next smart question.
3. End with a clear lean/opinion — the panel is coaching a decision, not just reporting numbers.
4. Each response should be short enough to read in one glance on a phone screen.

**Example flow — fantasy lineup decision:**
> User: "Should I start Bedard tonight?"
>
> Marc: "Good question to ask — he's got a rough matchup on paper, facing Carolina's top pair, who's allowed the fewest high-danger chances in the league over the last 15 games. But here's the thing: his shooting % has been ice cold compared to his season average, and his underlying chances haven't dropped. That's a regression-due signal, not a decline signal."
>
> *[Follow-up chips: "What's regression mean?" / "How's he done vs. tough D before?" / "What about my bench alternative?"]*
>
> User taps: "How's he done vs. tough D before?"
>
> Marc: "Three games this season against elite shutdown pairs — modest points, but he still generated strong shot volume every time. He doesn't disappear against good competition, he just needs puck luck. I'd lean start."

**Same shape applies to betting questions** (e.g. "Should I bet the over?") — lead with pace-of-play/goalie form, offer a follow-up chip like "What's the public betting split?", close with a confidence-flavored lean.

---

## 9. AI Delivery Principle

Reggie and Marc translate complex analytics into natural hockey conversation rather than exposing raw stats directly to users — e.g. translating an expected-goals differential into a plain-language read on team dominance, not a table of xG numbers.

---

## 10. Build Priority Order (Phase 1 MVP)

1. Functional app
2. Natural panel conversation
3. NHL data and analytics (this spec)
4. Production quality
5. Continuous refinement from real usage

Within analytics specifically, recommended build order:
1. Layer 2 data pipeline (sportsdata.io + NHL public endpoints) — get raw data flowing reliably
2. One flagship output end-to-end: Daily Intelligence Report — forces data pipeline + AI reasoning + delivery format to work together
3. Guided-question conversational interface (Section 8)
4. Anomaly Engine / Story Opportunity scoring (Section 5)
5. Trade Analyzer (Section 7)
6. Deep matchup/shot analytics (Section 4) — highest complexity, biggest differentiator, can follow once core loop is proven

---

## Annex A · Historical Context Flavor Layer (side piece)

Not a core analytics feature — a *flavor* layer that colors panel delivery when a natural callback exists. Reggie and Marc reach for a history reference when it lands, not on every segment. The engine's job is to have hooks *available* on the shelf so the AI can grab one when the moment calls for it.

**Three hook types the engine surfaces on demand:**

1. **Similar-player comps** — vector-match active-player career markers against retired-player same-age seasons. Return top 3 comps only when similarity is strong (not forced).
   - *"Bedard's age-19 shot rate lines up almost exactly with a young Sakic."*
   - *"Utah's third-line C is doing a Tikkanen impression — eats the other team's top center every night."*

2. **Records on pace** — nightly job flags players whose season/career pace is within meaningful range (>85% of the mark) of all-time or age-cohort records.
   - *"If MacKinnon keeps this pace, first since Lemieux to hit 130 at 29."*
   - *"McDavid is four games from Gretzky's consecutive multi-point mark at that age."*

3. **Team/era parallels** — a lightweight tag that matches current team profiles (rebuild trajectory, roster shape, underlying-vs-record gap) against famous historical teams. Fires rarely, hits hard when it does.
   - *"This Utah club feels like the '82 Islanders in reverse — great in transition, brutal own-zone, one veteran signing away from scary."*

**Data sources** (all free/legal, no new spend):
- NHL Records API for all-time records + franchise leaderboards
- NHL Public API `/v1/player/{id}/landing` for career + junior + international splits on any NHLer
- Wikidata for retired-player bios and milestones

**Story Opportunity Score integration** (from Section 5): a matched hook adds a small bump to the score band — never dominates it. History is seasoning, not the meal.

**Delivery rule** (extends Section 9): callbacks must sound conversational, never encyclopedic. Marc leads on stat-driven comps and record-watch; Reggie leads on personality/locker-room comps ("Same swagger Iginla had — that's a compliment").

Elite Prospects licensing (Section 2) would eventually extend this to non-NHL European legends. Not required for Phase 1.
