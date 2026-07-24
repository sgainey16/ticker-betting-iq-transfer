# The Ticker — Matchup Analytics: Build Spec
Companion to `ticker-matchup-sheet.html`. That file is the UI/component reference — this doc is the data and logic spec behind it.

---

## 1. Important: the HTML file uses sample data
Every number, name, and flag in the matchup sheet (Wolves vs. Ironclad, scorer names, injury notes, referee stats) is **placeholder content** to demonstrate the layout and interaction pattern. None of it is real. Build against a live feed using the sources below — don't treat the sample values as target numbers.

## 2. Data sources
- **NHL API** — official play-by-play, boxscores, standings, schedule
- **MoneyPuck** — advanced stats (Corsi/Fenwick, expected goals, high-danger chances, zone starts)
- **HockeyDB** — historical player/team records
- **EliteProspects** — prospect and draft-pipeline data
- A data pipeline script already exists as a starting point for the NHL API + MoneyPuck pulls — ask the founder for it directly.

## 3. Master Analytics Framework (20 categories)
This is the target architecture — a Master Hockey Analytics Bible with 1,000+ measurable variables, organized into 20 categories, each ultimately needing its own data source, update frequency, predictive-value rating, and fan-friendly explanation the hosts can deliver on air. The specific questions already scoped in earlier planning (marked ✅ below) are a subset of this — not the ceiling.

1. **Team Strength** — record, points %, goal differential, home/away splits, last 10/20/40, expected wins, strength of schedule
2. **Offensive Analytics** — goals/game, expected goals, shot attempts and quality tiers (high/medium/low danger), rebound/deflection/net-front goals, PP vs. 5v5 splits, goals by period/score-state/situation ✅ *(PP scoring detail, shot location/type already scoped)*
3. **Defensive Analytics** — goals/expected goals against, blocked shots, rush/slot chances allowed, PK clear success, zone-exit %, turnovers, defensive zone time ✅ *(turnovers, shot blocks already scoped)*
4. **Possession Analytics** — Corsi, Fenwick, expected goal %, zone possession splits, faceoff possession, puck recovery by type ✅ *(zone time, faceoff win % already scoped)*
5. **Goaltending** — career/season/L10/L5/home/away/vs-opponent splits, danger-tier save %, rebound control, shootout/penalty-shot %, PP/PK save %, goals saved above expected ✅ *(shorthanded save % specifically, previous-matchup goalie history already scoped)*
6. **Individual Player Analytics** — full per-skater stat set (goals, assists, shot attempts, zone entries/exits, TOI, quality of competition/teammates) ✅ *(shots-per-game to goals, even-strength TOI, ice-time-after-trade correlation already scoped)*
7. **Line Chemistry** — combinations, games together, expected goals/production together, matchup success ✅ *("which line is turning the tide" already scoped)*
8. **Matchups** — player vs. player, center vs. center, D-pair vs. line, coach vs. coach, goalie vs. shooter, player vs. referee/building/altitude/time zone
9. **Historical Matchups** — last meeting, last 5/10, playoff vs. regular season, same goalie/coach/referee
10. **Injuries** — current/day-to-day/long-term/IR, expected minutes lost, replacement quality, playing hurt, morning skate participation ✅ *(specialist-role impact already scoped)*
11. **Schedule Analytics** — back-to-backs, 3-in-4, travel distance, time zones crossed, road trip/homestand length, days rest ✅ *(fatigue, days off, all-star break already scoped)*
12. **Referees** — crew assignment, penalty tendencies (home/away bias), fighting/misconduct frequency, game pace, ref history with specific teams/players ✅ *(referee assignment and PP-opportunity tendency already scoped)*
13. **Arena Factors** — home ice advantage, ice quality, altitude, temperature, crowd noise, building scoring trends
14. **Coaching** — record, challenge success, line matching, PP/PK strategy, pull-goalie timing ✅ *(coaching change, coach reaction to last game already scoped)*
15. **Betting Market Intelligence** — opening/current line, sharp vs. public money, line movement, closing line value
16. **Psychological / Intangibles** — revenge games, contract year, trade rumors, must-win/elimination/trap games, milestones ✅ *(this matches the intangibles list already scoped — see section 6)*
17. **Team Culture** — leadership quality, locker room morale, body language, internal conflict, trade-deadline mood
18. **Video Intelligence (future)** — forecheck pressure, gap control, passing lanes, skating stride, fatigue read from tape
19. **External Factors** — travel disruptions, illness/flu outbreaks, equipment issues, lost luggage
20. **Proprietary "Ticker Intelligence"** — see section 4 below; this is the differentiator layer, not raw data

## 4. Proprietary "Ticker Intelligence" layer
This is the differentiator: composite scores The Ticker calculates by blending categories above, rather than raw stats a user could get anywhere else.
- **Momentum Score** — who's actually controlling play right now
- **Confidence Score** — body language + recent success + interviews
- **Fatigue Score** — minutes, travel, hits taken, shift length, recovery
- **Clutch Rating** — performance in last 5 minutes, OT, shootout, playoffs, one-goal games
- **Chemistry Rating** — per line
- **Pressure Rating** — performance under hostile crowd, playoffs, rivalry, elimination
- **Referee Compatibility** — some players consistently thrive or struggle under certain officiating styles
- **Coaching Edge** — which coach is winning the tactical battle tonight
- **Injury Impact** — not just who's out, but how much that player changes the team's identity

**AI Game Story principle:** the output should read like analysis, not a probability alone. Instead of "Boston has a 57% chance," the target format explains *why* — rest advantage, goaltending matchup history, special teams edge, referee tendency — in one connected narrative.

## 5. Factor-importance transparency ("the Holy Grail")
For each matchup, rank every factor that mattered by weight, so predictions are explainable rather than a black box — for example:
1. Goaltending mismatch
2. Rest advantage
3. Injuries
4. Special teams matchup
5. Travel fatigue
6. Referee tendencies
7. Historical matchup
8. Line chemistry
9. Home ice
10. Other factors

The exact weighting is a modeling question for later — the point for this build phase is that the UI/data model should support attaching a "why it mattered" ranking to every prediction, not just a single percentage.

## 6. Confidence tiers & sourcing
Every answer to a taxonomy question should carry one of three confidence tags, not be presented as uniformly certain:
- **Fact** — official stats, box scores, confirmed lineups/injuries
- **Reported** — beat writer or team-confirmed info not yet reflected in official data (e.g. a coach's presser comment)
- **Rumor** — unconfirmed chatter from social media, forums, or podcast/interview speculation

**Sourcing pipeline:**
- Official stats/injuries from NHL API and team reporting (→ Fact)
- Beat writers, team press conferences, credentialed reporting (→ Reported)
- Social media (Twitter/X, Reddit) — pull via each platform's official API/licensing terms, not open scraping, to avoid losing access later
- Podcast and interview audio — transcribe and scan for relevant mentions (injuries, line changes, locker-room tone); output as a summarized data point attributed to the source, not a reproduction of the original commentary (→ Reported or Rumor depending on who's speaking)

**Voice delivery rule:** the tier should control language, not just a UI tag — a Fact is stated flatly by the AI host, a Reported item gets "I'm hearing that..." framing, a Rumor gets an explicit "take this with a grain of salt" caveat before it's said aloud.

## 7. Community consensus mechanic
Users can submit opinions/observations (e.g. "that slash looked like it'll affect his shot") into the forum tied to a specific taxonomy question. Other users upvote/agree. Once agreement crosses a set threshold (e.g. 70%+ of a minimum vote count), the claim is promoted from forum chatter into a **"Community Consensus"** tag on the matchup sheet — a tier between Reported and Rumor, since it's aggregated across many observers rather than one source. Below threshold, it stays visible only in the forum, not promoted to the main sheet.

Open question to settle before building: should the consensus badge show which specific users contributed (reinforces trust in sharp predictors, ties into the "follow high-accuracy users" feature) or stay anonymous/aggregate (protects against brigading a specific claim)?

## 8. Delivery channels
The filled-out question list per game needs to reach paying users two ways:
- **Visual** — the matchup sheet / deep-dive UI (this file's companion HTML)
- **Verbal** — through the "Ask Our Analyst" voice feature, applying the same confidence-tier language rules above

## 9. Intangibles layer (folds into category 16 above)
These are judgment-based factors the AI should weigh qualitatively — they don't come from a stat query, but should influence the confidence/framing of a prediction:
- Revenge game (player facing a former team)
- Contract-year motivation
- Milestone watch (player closing in on a record)
- Trap-game risk (looking ahead to a bigger rival)
- Debut game (new trade/call-up's first game in the lineup)
- Recently reshuffled line combinations
- Captain/leadership absence
- National TV / rivalry-atmosphere spotlight
- Recent bad blood (fights, scrums, controversial hit in the last meeting)

## 10. Brand reference
Full brand guide already exists for The Ticker — reference it directly rather than re-deriving a palette:
- **Colors:** Ticker Blue `#1E5BFF`, Ice White `#FFFFFF`, Night Black `#0B0B0F`, Steel Gray `#5C6670`, Puck Silver `#C8CDD3`
- **Type:** Rajdhani Bold (headlines), Oswald SemiBold (accent/labels), Inter Regular (body)
- Logo suite, merch mockups, and sub-brand marks (Ask Our Analyst, The Debate, Call It, Breaking News, Ticker Fantasy, Leaderboard, Community Zone) are documented separately — ask the founder for the full brand guide file.
