# SPECIAL TEAMS IQ — Step 2 · Provider Acquisition Matrix

**Status:** Data contract audit only. No code. No DB changes. No UI. No Foundation changes.
**Companion to:** `/app/memory/SPECIAL_TEAMS_IQ_FEASIBILITY.md` (Step 1, approved).
**Scope:** Betting IQ · Special Teams IQ only.
**Governing rule:** *We do not assume provider capability. Every unverified claim is marked* **NEEDS PROVIDER CONFIRMATION** *(NPC).*

---

## 0. How to read this document

- **Provider cells report capability, not contract terms.** Data-rights language for every provider is deferred to §7 — those cells all read `NPC` until we get contract answers in writing.
- **Two provider-capability tiers are distinguished for Sportradar.** Sportradar offers multiple NHL packages; a field marked "Sportradar (higher tier)" is capability our currently trial-lapsed key was never billed for. All of it is `NPC` until we verify against a live upgraded key.
- **"Ticker-derived" means Ticker computes this from lower-level provider events.** Its trust tier is capped at `ticker_inference`. It is never `verified_fact` regardless of how confident we are.
- **When the same signal is theoretically derivable from public PBP AND natively supplied by a tracking vendor, both are listed.** The tracking-vendor version is superior; the public-PBP version is an honest proxy that must be labeled as such.

---

## 1. Full Special Teams provider acquisition matrix

Legend for cells:
- **A** = native, already retrievable today
- **B** = derivable today from data we already ingest (Ticker-derived, `ticker_inference`)
- **C** = expected available on a paid tier from that provider (NPC)
- **D** = not available from that provider
- **NPC** = needs provider confirmation
- **—** = not applicable

Column order: **Ticker metric → raw event/data required → NHL public PBP → NHL Shift Charts → Sportradar (currently wired) → Sportradar (higher tier) → Sportlogiq → NHL EDGE (tracking) → Beat-reporter lineup feeds → Ticker derivation feasibility**

### 1.1 Power play — creation & entry

| Ticker metric | Raw event required | NHL PBP | NHL Shifts | Sportradar (wired) | Sportradar (higher) | Sportlogiq | NHL EDGE | Beat-reporter | Ticker-derived? |
|---|---|---|---|---|---|---|---|---|---|
| PP zone entry attempt (any) | entry event at OZ blue line during PP window | D | — | D | NPC — likely D | C (NPC — native entry classification) | NPC — puck position across blue line derivable but not published as event | — | **B (weak)** — inferred from shot origin timestamps + faceoff resets; poor recall |
| Controlled vs uncontrolled entry | entry method classification (carry / pass / dump / chip) | D | — | D | D (NPC) | C (NPC — Sportlogiq's core primitive) | NPC | — | D — cannot be honestly derived from PBP |
| Entry carrier (player) | actor player ID at entry event | D | — | D | D (NPC) | C (NPC) | NPC — puck holder derivable from x/y proximity if licensed | — | D |
| Entry denial by PK (event) | contested-entry event with defending player | D | — | D | D (NPC) | C (NPC) | NPC | — | D |
| Time from entry to first OZ shot | entry timestamp + first-shot timestamp | D (no entry timestamp) | — | D | NPC | C (NPC — Sportlogiq possession-sequence) | NPC | — | D — cannot compute without entry timestamp |
| PP OZ possession % of PP time | continuous puck-position by zone | D | — | D | D | C (NPC) | NPC | — | D |
| PP puck retrievals | recovery events | D | — | D | NPC — some hit/recovery marking possible | C (NPC) | NPC | — | D |

### 1.2 Power play — shot creation & danger

| Ticker metric | Raw event required | NHL PBP | NHL Shifts | Sportradar (wired) | Sportradar (higher) | Sportlogiq | NHL EDGE | Beat-reporter | Ticker-derived? |
|---|---|---|---|---|---|---|---|---|---|
| PP shots on goal (5v4) | shot-on-goal events + strength state | **A** (via typeDescKey + situationCode) | — | A — via boxscore rollups | A (NPC — via boxscore + PBP) | C (NPC — native) | NPC | — | **B** — direct count |
| PP shots (all attempts) | SOG + missed + blocked + strength state | **A** | — | A partial | A (NPC) | C (NPC) | NPC | — | **B** |
| PP shot x/y coordinates | native coord per shot | **A** partial (available; coordinate frame documented) | — | D | NPC — Sportradar PBP with coordinates NPC | C (NPC) | NPC | — | **B** |
| Inner-slot shot share (proxy) | shot coords + zone geometry | **A** | — | D | NPC | C (NPC — Sportlogiq classifies natively) | NPC | — | **B (Ticker-derived proxy)** — must be labeled "inner-slot share", NOT "high-danger" |
| One-timer creation (PP) | passer→shooter event linkage with tight ∆t | D — PBP has assists but not pass-to-shot linkage with location | — | D | NPC — passer linkage NPC | C (NPC — Sportlogiq's central primitive) | NPC | — | D (honest) |
| Cross-seam pass creation | pass origin/destination coords | D | — | D | D | C (NPC) | NPC | — | D |
| Slot / interior pass rate | pass zone classification | D | — | D | D | C (NPC) | NPC | — | D |
| Net-front presence (PP) | on-ice x/y of a designated F | D | — | D | D | C (NPC — Sportlogiq net-front event) | NPC (chip tracking would nail this) | — | D |
| Screen events / tips / rebounds | event-typed screen/tip; rebound = shot within N seconds of prior shot from same team | D (rebound is derivable weakly from shot sequence) | — | D | NPC (Sportradar sometimes flags rebound; NPC) | C (NPC — native) | NPC | — | **B (weak)** for rebounds only |

### 1.3 Penalty kill — suppression & structure

| Ticker metric | Raw event required | NHL PBP | NHL Shifts | Sportradar (wired) | Sportradar (higher) | Sportlogiq | NHL EDGE | Beat-reporter | Ticker-derived? |
|---|---|---|---|---|---|---|---|---|---|
| PK shots against (4v5) | shot-against events + strength state | **A** | — | A partial | A (NPC) | C (NPC) | NPC | — | **B** |
| PK shots-against x/y | native coord | **A** | — | D | NPC | C (NPC) | NPC | — | **B** |
| PK inner-slot shots allowed | shot coords + zone geometry | **A** | — | D | NPC | C (NPC — native) | NPC | — | **B (proxy, label honestly)** |
| Controlled entries allowed (against PK) | entry method events, PK side | D | — | D | D | C (NPC) | NPC | — | D |
| Entry denials by PK | contested-entry outcomes | D | — | D | D | C (NPC) | NPC | — | D |
| PK clear success rate | zone-exit event classification | D | — | D | NPC — Sportradar sometimes counts clears; NPC | C (NPC — native) | NPC | — | D |
| PK clear failures / retrievals against | recovery events on defensive-zone side | D | — | D | NPC | C (NPC) | NPC | — | D |
| PK forecheck pressure (against opp PP) | forecheck events | D | — | D | D | C (NPC — a Sportlogiq primitive) | NPC | — | D |
| Cross-seam pass suppression | pass zones allowed / disrupted | D | — | D | D | C (NPC) | NPC | — | D |
| Net-front / slot protection | on-ice x/y + shot coord co-occurrence | D | — | D | D | C (NPC) | NPC | — | D |
| One-timer suppression (PK) | opponent passer→shooter linkage denied | D | — | D | D | C (NPC) | NPC | — | D |
| Goaltender behind the PK — save% | goalie shots-against + saves, strength state | **A (via 1B goalie counts + PBP situation)** | — | A partial | A (NPC) | C (NPC) | NPC | — | **B** — already derivable, low-sample rule mandatory |

### 1.4 Personnel — units, players, roles

| Ticker metric | Raw event required | NHL PBP | NHL Shifts | Sportradar (wired) | Sportradar (higher) | Sportlogiq | NHL EDGE | Beat-reporter | Ticker-derived? |
|---|---|---|---|---|---|---|---|---|---|
| Roster on sheet (per game) | rosterSpots per game | **A** (`rosterSpots[]`) | — | A | A | C (NPC — player mapping needed) | — | — | **B** |
| Skaters on ice per event | `on_ice_player_ids` on each event | D — PBP does NOT publish per-event on-ice lists | — | D | NPC — "PBP with on-ice players" is provider-tier-specific | C (NPC — native for shot/entry events) | NPC | — | **B (reconstructable inference)** — from shift charts intersected with event timestamp; medium confidence |
| Shift start/end per player | shift table per game | D (not in `/play-by-play` endpoint) | **A** (stats.api.nhle.com `shiftcharts?cayenneExp=gameId=...`) | D | NPC | C (NPC) | NPC | — | **B** — once shifts endpoint is wired |
| PP1 / PP2 unit membership | explicit unit label | D | D (indirect) | D | NPC — Sportradar may not publish unit labels; NPC | C (NPC — often exposed via team-side product; NPC for media-tier) | — | **A (attributed observation)** — DailyFaceoff / Rotowire post morning-skate lines | **B (weak)** — reconstruct top-N PP TOI leaders per team; low confidence pregame, medium postgame |
| PK1 / PK2 unit membership | explicit unit label | D | D | D | NPC | C (NPC) | — | **A (attributed observation)** | **B (weak)** — reconstruct top-N SH TOI leaders |
| Player role within unit (bumper, one-timer flank, net-front, retrieval, distributor) | role classification | D | D | D | D | C (NPC — Sportlogiq role primitives NPC — most role inference in industry is team-side, not media-side) | NPC | — | D — Ticker cannot honestly derive without tracking |
| Scratches | pregame scratches list | D (some in gamecenter but not always pregame) | — | NPC | NPC | — | — | **A (attributed observation)** | **B** — cross-reference roster diff |
| Injuries / questionable / probable | injury feed | D | — | NPC — Sportradar has an Injury product on higher tiers (NPC) | NPC | — | — | **A (attributed observation)** — Rotowire, DailyFaceoff | **B** — event-log ingest |
| Missing PP driver flag | (unit membership) ∩ (scratches/injuries) | D | D | D | NPC | C (NPC) | — | **A (attributed observation)** dependent | **B** once inputs land |

### 1.5 Special-teams **opportunity environment** (separate from quality)

| Ticker metric | Raw event required | NHL PBP | NHL Shifts | Sportradar (wired) | Sportradar (higher) | Sportlogiq | NHL EDGE | Beat-reporter | Ticker-derived? |
|---|---|---|---|---|---|---|---|---|---|
| Penalties taken per team per game | penalty events | **A** | — | A partial | A (NPC) | C (NPC) | — | — | **B** |
| Penalties drawn per team per game | penalty events with drawnBy | **A partial** (drawnByPlayerId sometimes present; matched-minors messy) | — | A partial | A (NPC — cleaner) | C (NPC) | — | — | **B (with data-quality caveats)** |
| Penalty tendency by player | penalty events attributed to player | **A partial** | — | A partial | A (NPC) | C (NPC) | — | — | **B** |
| Opponent-interaction PP-count prior | team A drawn rate × team B taken rate | derived | — | — | — | — | — | — | **B** (elementary product) — must be labeled "prior expectation", not "prediction" |
| Referee crew tendency | crew assignment + historical calls-per-game | D | — | D | NPC — Sportradar Referees product NPC | D | — | Some third parties (Scouting the Refs, Vince Massey) publish crew stats; **NPC** for licensable feed | **B** — only if a crew feed is licensed |
| Game-state / score-state on penalty rate | score-state overlaid on penalty events | D | — | D | NPC | C (NPC) | — | — | **B (low priority)** |

### 1.6 Trajectory & as-of

| Ticker metric | Raw event required | Feasibility | Notes |
|---|---|---|---|
| Last-1/3/5/10/Season rollups on any metric above | per-game facts stored | **B** for every A- or B-class metric; **C** for tracking-only metrics | Applies universally once inputs exist |
| EMERGING / STRENGTHENING / STABLE / WEAKENING / REVERSING classification | ordered per-game series | **B** with a documented min-sample gate | Never assigned below min_sample — component returns null |
| 3:30 PM vs 6:40 PM as-of correctness | dual-gate on `recorded_at` + event `source_time` | **B** — inherits Foundation 1B / 1C rules unchanged | Snapshotting stays the responsibility of 1C's `PregameContextEvent` stream |

---

## 2. NHL public PBP — the unused-data inventory (baseline, zero provider cost)

`/app/backend/nhl_pbp.py` today calls `https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play` and **discards every event that is not a goal**. The feed already contains the following play types per game (per NHL's public documentation and confirmed by the code's `_label_situation` handling):

**Currently discarded event types on the play-by-play feed:**
- `shot-on-goal` (with coordinates, shooter, goalie, shot type)
- `missed-shot` (with coordinates)
- `blocked-shot` (with coordinates, shooter, blocker)
- `penalty` (with committed-by, drawn-by, served-by, penalty descKey, duration, situation)
- `faceoff` (with winning-/losing-player, zoneCode, situation)
- `hit` (with hitter, hittee, zoneCode)
- `giveaway` (with player, zoneCode)
- `takeaway` (with player, zoneCode)
- `stoppage` (reason)
- `period-start` / `period-end` / `game-end`
- `delayed-penalty`
- `shootout-complete` (shootout attempts)

**Fields on every event that are also available and currently unused:**
- `situationCode` (4-digit — encodes strength state incl. EN)
- `periodDescriptor.number`, `.periodType`
- `timeInPeriod`, `timeRemaining`
- `eventOwnerTeamId`
- `details.xCoord`, `.yCoord` (rink coordinates in NHL frame)
- `details.zoneCode` (D / N / O for defending/neutral/offensive relative to owner)
- `details.shotType` (wrist, snap, slap, backhand, tip-in, wrap, deflection)
- `details.reason` for stoppages / penalties (descKey)
- `details.duration` for penalties
- Player IDs by event: `scoringPlayerId`, `assist1PlayerId`, `assist2PlayerId`, `shootingPlayerId`, `goalieInNetId`, `committedByPlayerId`, `drawnByPlayerId`, `servedByPlayerId`, `hittingPlayerId`, `hitteePlayerId`, `losingPlayerId`, `winningPlayerId`, `playerId` (giveaway/takeaway), `blockingPlayerId`

**Additional NHL public endpoints not currently used by the codebase but freely available:**
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` — team-level PP/PK totals per game (verify field names via a fetch before relying)
- `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId={gameId}` — per-player shift start/end timecodes (subdomain differs from api-web)
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/landing` — pregame context (probable goalies sometimes, scratches sometimes)
- `https://api-web.nhle.com/v1/roster/{team}/current` — team roster snapshot

**What an expanded parser could legitimately produce, at zero additional provider cost:**

| Baseline capability | Derived from | Trust tier |
|---|---|---|
| PP goals, PP shots (SOG/attempts), PP shot coords, PP goalie-behind, PP faceoff W/L in OZ | goal + shot events × situationCode | `verified_fact` |
| PK goals against, PK shots against, PK shot coords, PK goalie shots-faced + saves, PK faceoff W/L in DZ | same, PK side | `verified_fact` |
| Team penalty tendency (taken and drawn — with drawnBy caveats) | penalty events | `verified_fact` (with data-quality note on matched minors) |
| Player-level PP goals, PP assists, SH goals — postgame | goal-event player IDs × situation | `verified_fact` |
| Rebound-shot rate (weak proxy — shot within N seconds of a prior same-team shot) | shot event sequence | `ticker_inference` — must be labeled "rebound-shot proxy" |
| Inner-slot shot share (proxy) | shot coords + a documented zone polygon | `ticker_inference` — must be labeled "inner-slot share" (never "high-danger") |
| Faceoff wins by strength state | faceoff events × situation | `verified_fact` |
| Reconstructed on-ice player list per event (medium confidence) | shift charts intersected with event timestamps | `ticker_inference` — medium confidence when shift charts are ingested |
| Reconstructed PP1/PK1 unit membership (weak inference pregame; medium postgame) | rank players by PP/SH TOI on ice | `ticker_inference` — always low-confidence pregame |

**What an expanded parser CANNOT do at zero cost, no matter how clever:**
- Zone entry method classification (carry / pass / dump)
- Entry denial classification
- Pass origin/destination coordinates
- Cross-seam / slot pass classification
- One-timer classification (passer→shooter linkage with location)
- Continuous puck-holder identification
- Continuous player x/y between events
- Net-front presence, screen events, tip events
- Retrievals (specific event class)
- Any concept called "high-danger chance" that isn't just a coordinate-zone shot proxy
- Any true xG (an xG would be Ticker inventing a model on public inputs; that is a rating question, not a data question)

---

## 3. What we can build **immediately for free** (baseline)

Given §2, the following Special Teams **team-level** intelligence surface is honestly buildable today at zero additional provider cost. Trust tier: `verified_fact` for direct counts, `ticker_inference` for anything derived.

1. **PP efficiency layer** — PP%, PP shot rate per 60 s of PP time, PP goals-per-shot, faceoff W% in OZ during PP. `verified_fact`.
2. **PK suppression layer** — PK%, PK shots-against rate per 60 s of PK time, PK goals-against-per-shot, PK save % behind kill (low-confidence-flagged under 50 SA in window). `verified_fact` for counts; `ticker_inference` for rate composition when strength-state windows must be counted from PBP directly.
3. **PP inner-slot share (proxy)** — for both teams. Labeled honestly; never "high-danger". `ticker_inference`.
4. **PP rebound-shot rate (proxy)** — labeled honestly. `ticker_inference`.
5. **Trajectory windows** — Last-1/3/5/10/Season for each of the above with the min-sample rules from Step 1 §7.
6. **Opportunity environment (thin)** — team-level penalties-drawn and penalties-taken per game, with recent tendency and a simple opponent-interaction prior. `verified_fact` on counts; `ticker_inference` on the prior. Referee crew tendency is not wired and stays null.
7. **Player-level PP goals/assists/SHG (postgame)** — for future "who drives the PP" questions, requires a canonical player identity layer that does not yet exist (`iq_canonical_players`); until then, provider NHL player IDs are stored on events and resolved later.

---

## 4. What specifically becomes possible with **Sportlogiq / Sportradar-higher-tier / NHL EDGE**

- **Sportlogiq (tracking events from video AI):** every C-class row in §1.1–§1.3 (entries by method, entry denial, controlled entries allowed, retrievals, forecheck pressure, pass zones, cross-seam / slot passes, one-timer creation, net-front, screens, rebounds as an event class, PK clears). This is Sportlogiq's *native* primitive family (NPC for the exact SKU we'd sign).
- **Sportradar higher tier:** cleaner and canonical team-level PP/PK box totals; on-ice player IDs per event (NPC on which tier); optional injury/roster/referee-crew products; documented correction/version policy for late data. Sportradar does *not* generate tracking data; if we want entries and passes, Sportradar is not the vendor for that layer.
- **NHL EDGE (chip tracking):** continuous puck (60 Hz) and player (12 Hz) coordinates; enables real net-front presence, real passing kinematics, real shot-quality models, real screen detection. Currently not broadly licensed to media/consumer; access is `NPC` and likely gated to broadcaster/league-partner tiers.
- **Beat-reporter feeds (DailyFaceoff / Rotowire / NHL EDGE for scratches):** unit membership (`attributed_observation`) and injury/scratch context that unlocks personnel-adjusted ratings. Without these, PP1/PK1 identification is a Ticker inference from shift-chart TOI, and pregame confidence stays low.

---

## 5. What **remains impossible or unreliable** even with all currently contemplated providers

- **Player roles within a PP unit** (bumper vs one-timer flank vs distributor vs net-front) at media-tier data — role labeling is typically a team-side Sportlogiq deliverable, not a media SKU. Even if licensed, roles are inference, never fact.
- **Referee crew tendency at contractually clean quality** — commercial feeds exist but are of uneven quality and legal footing; Ticker should treat this as `attributed_observation` at best, with a per-source confidence.
- **True xG at `verified_fact` tier** — no independent third-party xG model has a broad license to be *cited*. Ticker either uses a documented public xG (labeled as Ticker's model, `ticker_inference`) or omits the concept.
- **Pregame confidence on personnel** — even DailyFaceoff/Rotowire projections can be wrong. The pregame `attributed_observation` upgrades to `verified_fact` only after warmup confirms; the rating value can change and the earlier snapshot must be preserved.
- **Coordinate frame consistency** — NHL public PBP, Sportradar, and Sportlogiq each define rink coordinates slightly differently (origin, axis orientation, plus/minus). A calibration/unit-conversion step is required before any coordinate-derived metric (like inner-slot share) can be composed across providers.
- **Historical backfill of tracking data** — Sportlogiq's usable historical depth for a new customer is `NPC`; NHL EDGE's contractual history to a new licensee is `NPC`. Deep trajectories may be shallower than the codebase implies.

---

## 6. Sportlogiq — exact questions we should send Patrick

Grouped by decision.

**A. Event coverage (per game, per league, NHL only)**

1. Which of the following do you deliver as **native events** (not client-derived): zone entries with method classification (carry / pass / dump / chip), entry denial by defender, entry player, entry x/y coordinate; controlled entry outcome; controlled exit outcome and exit player; forecheck pressure events; puck retrieval events; continuous possession-sequence identifiers with start/end timestamps; passes with origin/destination coordinates; pass type classification (cross-seam, slot, high-danger); one-timer flag; screen events; tip/deflection events; rebound-shot flag; net-front presence events; PK clears (successful and failed); PP setup timestamps?
2. For every event above: is it strength-state stamped so we can filter PP/PK cleanly?
3. Are events emitted for every NHL game every night, or only for a subset of games (e.g. teams that subscribe on the team side)? If a subset, what percentage of the NHL season?
4. What is the SLA from puck drop to event availability — real-time push, near-real-time, or postgame batch?
5. Are corrections versioned per event, or delivered as a full re-issued file?

**B. Player identification**

6. Do events carry a Sportlogiq player ID? Do you publish a mapping table to NHL player IDs?
7. Do events carry the identity of the **passer** for pass events and the **denier** for entry-denial events, or only the primary actor?
8. For shot events, do you emit the on-ice player list at the moment of the shot (both teams), and if so, at what tier?

**C. Coordinates**

9. What rink coordinate frame do you use (origin, orientation, units)? Do you publish a conversion to NHL's frame?
10. Do you emit puck coordinates continuously, or only at discrete events? If continuous, at what sampling rate and at what tier?

**D. Personnel**

11. Do you identify PP1 / PP2 / PK1 / PK2 units for each game? If yes, on what basis — coach-declared, TOI-derived, or otherwise — and how is it delivered (pregame projection, postgame roster)?
12. Do you emit role labels within PP or PK units (bumper, one-timer flank, distributor, retrieval, net-front, PK pressure)? If yes, at what tier?

**E. Timing & latency**

13. Timestamps: are they NHL game clock, wall clock, or both? What's the precision (nearest second)?
14. Live delivery: webhook, websocket, WebRTC, or polling API? What's your quoted p95 latency from real-world action to feed?

**F. Historical depth**

15. What is the earliest season available for backfill?
16. Are historical files delivered in the same schema as live, or in a legacy schema?

**G. Commercial**

17. What is the minimum SKU that covers §A.1 for a media/consumer product? What is the tier that would additionally cover on-ice player lists (§B.8) and unit/role labels (§D.11–12)?
18. Sales cycle to a working sandbox key: expected days.

**H. Data rights (NPC — needs written contract answers)**

19. May Ticker ingest, persist, and derive proprietary ratings from Sportlogiq events?
20. May Ticker display those derived ratings commercially in Betting IQ?
21. May Reggie/Marc (an AI persona layer) speak text grounded in Sportlogiq-derived intelligence in a paid product?
22. May Ticker retain historical events after contract termination, and under what terms?
23. May Ticker use Sportlogiq data for ML model training?
24. Attribution — do we cite Sportlogiq visibly? Where and how?
25. Latency restrictions — are there any embargo windows we'd need to honor for real-time signals?

---

## 7. Sportradar — exact questions we should send

**A. NHL tier & endpoint coverage**

1. Which NHL v7 tier includes `pbp.json` per game with **coordinates on every shot event**, **on-ice player IDs per event**, and **strength state per event**?
2. Which tier includes a **boxscore feed** with team-level PP goals, PP opportunities, PP%, SHG, PK save% broken out cleanly?
3. Which tier includes **shift data** per player per game (start / end / duration)?
4. Do any tiers include **entry method** or **entry denial** as native events? (Expected answer: no — but confirm.)
5. Do any tiers include **passing events with origin/destination coordinates**? (Expected: no.)

**B. Personnel & injury**

6. Does Sportradar publish confirmed **PP unit** or **PK unit** membership for NHL games? At what tier? Cadence?
7. Do you have an NHL injury/status feed (probable/questionable/scratched) with source attribution and correction policy?
8. Do you have a **referee crew** feed with historical calls-per-game per crew?

**C. Corrections & latency**

9. When events are amended after ingest, is there an event-level version or only a game-level snapshot? What's the corrections SLA?
10. Live delivery latency (p95) from action to feed availability. Any known blackout regions or contractual gaps.

**D. Historical depth**

11. What is the earliest available season for `pbp.json` on the target tier? For boxscore? For shift data?

**E. Data rights (NPC)**

12. Ingest, persist, derive, display commercially, use for AI/LLM grounding, retention post-termination, ML training — same list as §6.H.
13. Attribution requirements and placement.

**F. Migration from our current trial-lapsed key**

14. What's the fastest path from our current lapsed trial to a working evaluation key on the target tier?

---

## 8. Other credible data-source candidates (only where they fill a genuine gap)

- **NHL EDGE (via NHL data-partner program)** — the only broadly credible source for real *continuous* player/puck tracking. Genuine gap-filler for net-front presence, screen detection, and non-inferential shot-quality modeling. Highly `NPC` on media/consumer licensability.
- **Stathletes** — Toronto-based; competes with Sportlogiq on some primitives. May be worth pricing against Sportlogiq for negotiation leverage. `NPC` on exact event coverage and delivery.
- **InStat Hockey** — European-heavier coverage; less relevant for NHL slate but might complement.
- **DailyFaceoff** — de-facto standard for confirmed NHL lines and PP/PK units. Licensable via API/scraper (ToS `NPC`).
- **Rotowire NHL** — injury/scratches/probable-goalie feed with license path. `NPC`.
- **Scouting the Refs / Vince Massey** — referee crew tendencies as content. Not a clean feed; usable only if we operationalize their published data with permission.
- **MoneyPuck / Evolving-Hockey / Natural Stat Trick** — public analytics sites. Useful as sanity-check baselines for our own derivations, NOT as licensed inputs. Publishing anything derived from them commercially would need clear terms.

---

## 9. Player → Unit → Team → Matchup — does the proposed provider set support the architecture?

**With Sportlogiq (or equivalent tracking-event vendor) plus a lineup source:** YES.

- **Event → Player:** Sportlogiq events carry actor player IDs (NPC for on-ice lists at shot events).
- **Player → Unit:** unit membership either comes native (NPC per tier) or is inferred from PP/SH TOI derived from shifts (NHL Shifts free) + game events. Either way, unit assignment lives at `ticker_inference` unless explicitly confirmed by DailyFaceoff (`attributed_observation`) or provider (`verified_fact`).
- **Unit → Team:** trivial roll-up.
- **Team → Opponent interaction:** roll-up × opponent's mirror = matchup delta. Personnel-adjusted deltas require both sides' unit inference to be present.
- **Team → Tonight matchup IQ:** Tonight-facing snapshot lives in 1C's `PregameContextEvent` stream with dual-gate `as_of` handling from Step 1 §6. Nothing here modifies 1A/1B/1C.

**Without Sportlogiq (public PBP + shifts + reporter feeds only):** the architecture holds for team-level ratings and low-confidence unit inferences, but **the "tactical Special Teams IQ" product cannot be shipped**. That is a hard boundary — we should not pretend otherwise.

---

## 10. Recommended **minimum provider dataset** for Ticker Special Teams IQ V1 Premium

To ship the premium tactical product honestly, the minimum viable dataset is:

1. **Sportlogiq (or equivalent tracking-event vendor) — required.** Covers §1.1–§1.3 C-class rows. Without it, "premium Special Teams IQ" is aspirational.
2. **NHL public PBP + Shift Charts — required.** Free. Provides `verified_fact` baseline (§3) and the shift skeleton needed for reconstructing on-ice player sets and inferring units from TOI.
3. **DailyFaceoff (or Rotowire) unit / lineup feed — required.** Upgrades pregame unit membership from `ticker_inference` to `attributed_observation`. Without this, pregame personnel-adjusted ratings are always low confidence.
4. **Sportradar higher tier — recommended, not required.** Provides cleaner drawn/taken counts, a canonical injury feed, and potentially referee crew data. If Sportlogiq is already contracted, Sportradar becomes a data-quality upgrade, not a source of new intelligence.
5. **NHL EDGE — optional / long-term.** Enables shift from inference-heavy to fact-heavy for shot quality and net-front. `NPC` on availability; not a V1 dependency.

**Rejection: NHL EDGE alone cannot substitute for Sportlogiq.** EDGE delivers raw kinematics; Sportlogiq delivers *event classifications* (this is a controlled entry, this is a cross-seam pass). Building a classification layer over EDGE from scratch is a research project, not a product commitment. Keep them as separate strata.

---

## 11. Proposed build sequence — designed to prevent building the system twice

Each phase produces something honest and consumable. No phase requires undoing a previous phase.

**Phase A — Free-tier baseline (no provider contract needed).** Nothing in this phase modifies 1A/1B/1C or the Atlas workstream.

- A.1: Extend `nhl_pbp.py` to parse *all* event types (not just goals) into an in-memory shape aligned with Step 1 §3.1. Read-only. No DB writes yet.
- A.2: Add a read-only in-memory Special Teams projection layer that computes `pp_quality_thin_v0` and `pk_quality_thin_v0` per team per window from A.1.
- A.3: Wire a single new read-only endpoint per Step 1 §9 (`GET /api/iq/matchup/special-teams`) that returns a rating card with **verified_fact** components, explicit `PERSONNEL = not_incorporated` and `TACTICAL = not_incorporated` flags, sample sizes, and null components below min_sample.
- A.4: Integrate into Tonight V3's `READS ON THIS GAME` grammar with render-hint contract from Step 1 §9. Omit when confidence is low.
- A.5: Once stable, promote the parsed events into a persistent `iq_special_teams_events` collection (Step 1 §3.1) so future backfills and corrections have somewhere to land.

**Phase B — Lineup source (before Sportlogiq contract).**

- B.1: Add an NHL Shift Charts ingest (free endpoint on `stats.api.nhle.com`) and a `iq_player_shifts` collection.
- B.2: Reconstruct on-ice player sets per event by intersecting shifts with event timestamps (medium confidence, `ticker_inference`). Publish coverage/confidence stats.
- B.3: Ingest DailyFaceoff (or Rotowire) unit lineups into 1C's `PregameContextEvent` stream. Attributed observation tier.
- B.4: Upgrade the Special Teams projection to render **personnel-aware** ratings: PP-driver-availability flags, unit-adjusted efficiency. The rating card gains a `personnel = pending / confirmed / low_confidence` label.

**Phase C — Sportlogiq contracted.**

- C.1: Ingest Sportlogiq events into a new collection (schema mirroring Step 1 §3.1 but for tracking-event provenance).
- C.2: Introduce the true tactical component tree from Step 1 §4 (entries, passes, one-timers, net-front, screens, PK clears). Each component ships with a `ComponentSpec` per Step 1 §5.1.
- C.3: Compose `pp_quality_tactical_v1` and `pk_quality_tactical_v1` recipes. Ship alongside — never replacing — the thin_v0 recipes so provenance stays inspectable.
- C.4: Upgrade Tonight V3 grammar to render the tactical card **only when tracking-provider coverage is confirmed for tonight's games**. Otherwise, thin_v0 stands.

**Phase D — NHL EDGE / Sportradar higher tier (optional upgrades).**

- Layered on Phase C: shot-quality upgrades, cleaner drawn/taken, referee crew, injury feed. Each upgrade replaces a `ticker_inference` component with a `verified_fact` counterpart. The recipe version bumps; the previous version is preserved so historical snapshots stay honest.

**Anti-pattern the sequence protects against:**

- We never bind the front end to a tactical shape until Phase C ships. So a Sportlogiq contract delay does not strand the UI.
- We never treat `ticker_inference` and `verified_fact` as interchangeable in a recipe. So a Phase D upgrade replaces components in a documented way, never silently.
- We never rebuild the event schema after Phase A.5. The Phase A collection and the Phase C collection coexist as separate sources with their own provenance blocks.

---

## 12. Absolute boundaries observed in this Step 2

- No changes to Foundations 1A / 1B / 1C.
- No changes to Atlas / production deployment.
- No changes to Tonight V3, My IQ, Community, Fantasy, Team Navi, Best Ticker Now.
- No code, no DB, no UI.
- No provider capability asserted without evidence — every `C` and every "higher tier" claim is `NPC` until provider-confirmed.
- No fabricated statistics or synthesised examples anywhere in the doc.
- No commitment to a specific rating formula, weighting scheme, or 0–100 mapping. That is a §5 (Step 1) decision, gated on real data.

---

**End of Step 2. Awaiting approval on which decision follows.**

Options for the operator:

- **(i)** Approve Phase A build (free-tier baseline; no provider contract needed) and let engineering begin extending `nhl_pbp.py` and standing up `iq_special_teams_events`.
- **(ii)** Send §6 (Sportlogiq) and §7 (Sportradar) question lists to those providers, gather answers, and revisit sequence.
- **(iii)** Approve Phase A + Phase B (free-tier baseline + shifts + DailyFaceoff lineups) in one plan, since neither requires a paid tracking contract.
- **(iv)** Something else — adjust the audit and re-return.
