# The Ticker — Product Requirements Doc

## Original Problem Statement
An AI-powered sports television network MVP focused strictly on hockey. Phase 1 is the "Entertainment" layer: Broadcast, Presser, Stats, Predictions, Recaps. The app should feel like a premium live TV broadcast — overlapping audio banter, real NHL data, distinct AI personalities (Reggie Harlow + Marc Collins), and a podcast-like cadence with video-recap highlights integrated into a SportsCenter-style morning desk show.

## Product Pillars
- Flowing broadcast audio touching all topics automatically.
- Team Room "Home" page providing a hyper-localized fan shrine (Locker Room, Coach's Office, War Room, Film Room).
- Individual Play-by-Play short highlight reels via YouTube SDK with AI host bumper transitions.
- "Coach, not casino" Betting IQ.
- Integrations: Real NHL data, ElevenLabs TTS, Highlightly for game clips, logos, odds, and stats.

## Current App Surface
| Route | Screen | Notes |
|---|---|---|
| `/` | Recap Show | Morning-after broadcast, split-screen play-by-play, Highlightly clips, own audio flow (quiet route) |
| `/show` | The Morning Skate | Pregame preview, Reggie & Marc frame portalled in top |
| `/scoreboard` | Live Scoreboard | Reggie & Marc frame at top (LIVE ACTION chyron) + game cards (demo goal engine) |
| `/predictions` | Call It | Tap-to-pick UI + scorecard |
| `/audition/team-room/:code` | Team Room Audition | 6-team fan shrine prototype |
| `/audition/fast-reel` | Fast Reel | Highlight sequencer with Reggie bumpers |

## Personalities
- **Reggie Harlow** — Color analyst, hot takes, catchphrases, hockey instinct.
- **Marc Collins** — Analyst, numbers/context, protects players, quiet punchlines.
- Language Bible: `/app/memory/LANGUAGE_BIBLE.md` (partial; Sections 1-5E complete, 5F-9 TBD).

## Design Decisions (locked)
- **Smart Contrast theming (Feb 8, 2026)** — Content pages (Recap, Home, Show, Scoreboard) stay dark = broadcast feel. Data pages (Stats, and any future data-monitor surfaces) stay light = readability for dense tables. No global Dark/Light toggle. When "My Office" ships, a small "Theme: Auto" chip will appear as a preference marker but the contrast rule is fixed by page type. Time-of-day auto shifts explicitly rejected (disorients users, low delight-per-effort).

## Recent Changes (Feb 2026)
- **Product direction: Entertainment before Analytics (Feb 8, 2026)** — recorded in `LANGUAGE_BIBLE.md` and PRD: when Elite Prospects data lands, the wiring order is (1) highlights + videos + scoring leaders + standings, THEN (2) rosters + depth charts + analytics. Bloodlines / player-connections are TALKING POINTS for Reggie & Marc (fed into the LLM prompt as flavor), NOT a UI surface. No standalone bloodline diagrams or Roots panels — the hosts *talk* about family/lineage, they don't chart it. AHL affiliate work paused until EP key arrives (mapping seeded in catalog, favorites-rail integration and `/ahl/:code` page will be built with real data in one pass).
- **Elite Prospects API research (Feb 8, 2026)** — mapped the Swagger surface. Base URL `https://api.eliteprospects.com/v1`. Critical endpoints identified: `/teams/{id}/affiliates` (NHL→AHL parent-child), `/teams/{id}/in-the-system` (every prospect in an org's system across leagues), `/teams/{id}/roster`, `/teams/{id}/depth-chart`, `/players/{id}/nhl-rights`, `/players/{id}/player-connections` (structured bloodlines), `/players/{id}/draft-selections`, `/players/{id}/videos`, `/leagues/{slug}/scoring-leaders`, `/leagues/{slug}/standings`. When the user shares `EP_API_KEY`, build a rate-limited proxy in `elite_prospects.py` with 24h Mongo cache.
- **Onboarding restructure — leagues over prospects (Feb 8, 2026)** — dropped the "Prospects to follow" step (5 steps now, not 6). NHL step renders real NHL CDN logos. CHL step gets `WHL / OHL / QMJHL` tabs; QMJHL seeded with 11 teams. NCAA step gets 6 conference tabs (B1G / HE / NCHC / ECAC / CCHA / AHA) with 4 new conferences seeded.
- **Stats page logo pass (Feb 8, 2026)** — Skaters/Goalies/Standings tables render clean 30px team logos with no accompanying "EDM/MTL" code text. Leader cards + full-list modal same treatment. Logos are the visual anchor, no acronym needed.
- **Proper NHL logos via official CDN + Favorites rail (Feb 8, 2026)** — `/api/images/team-logos` serves NHL's official asset CDN. `FavoritesRail.jsx` on Home shows the fan's NHL/CHL/NCAA teams (max 4) with league-badge chips and a "+" mini team-picker.
- **Per-game Reggie & Marc pregame segments (Feb 8, 2026)** — `/tonight/:gameId` now fetches `/api/tonight/segment` which returns a Claude-Sonnet-4.5-generated script specifically about that matchup plus pre-rendered ElevenLabs audio URLs.
- **Stats overhaul + Team Stat Pages (Feb 8, 2026)** — dropped the standalone `Matchups` tab from `/stats`. Standings rows are clickable and deep-link into a new team page at `/team/:code` with hero, season stat block, auto-generated depth chart (4 F-lines · 3 D-pairs · 2 G · IR), and prospects panel via `tickerCatalog.PROSPECTS` `nhlOrbit` lookup. Every roster row deep-links to `/player/:playerId`. Player route order fixed — `/player/:playerId` wins over legacy audition path.
- **Post-game interviews in Individual Highlights (Feb 8, 2026)** — `/api/audition/play-by-play` now returns a parallel `interviews[]` array pulled from Highlightly's `post-match-content` + `press-conference` categories. `PlayByPlayPanel.jsx` appends those clips at the bottom of the goal list inside the same scrollable rail; tapping one opens `PlayByPlayModal` (interview clips are included in the modal's clip pool so Next/Prev flows naturally from the last goal into the presser).
- **Unified logo voting + "Highlights of the Night" pivot (Feb 8, 2026)** — the top matchup logos on the Tonight game hub (`/tonight/:gameId` and expanded tiles in `GameHub.jsx`) ARE the vote buttons now — no separate row below. Tap a logo to lock your call; tap the other logo to switch until the puck drops. Backend upserts on `(user_name, game_id)` so a pick change updates the DB row instead of duplicating it, and enforces a 409 lock after `start_iso`. Live-shifts `start_iso` server-side so demo games always sit on the next upcoming evening. Added missing `/api/predictions/mine` endpoint so picks hydrate across sessions. Recap surface renamed from "Last Night's Games / Morning Show" → "Highlights of the Night" (rail sorts most-recently-finished first) — the framing is "as soon as we have the tape we roll it" rather than "wait for morning".


- **Roots woven into the fabric (Feb 8, 2026)** — Roots is now a philosophy inside the existing bible and app, not a separate section or card. `LANGUAGE_BIBLE.md` updated in place: Section 1 (Purpose) names the reflective register, Section 3 (Frequency) adds a "Roots mode" row to the register table, Section 4 (Central Rule) folds in the "chirps yes, roasts no" line with a developing-player test ("would his mom, coach, scouts wince?"). Two thin primitives in `/app/frontend/src/components/plus/Roots.jsx` — `<RootsRibbon>` and `<RootsBeat>` — drop into existing surfaces on demand. First woven placement: `/plus/prospect/:id` — a `RootsRibbon` renders below the tagline only when the prospect's `connections[]` overlap the user's followed teams (Habs fans see "Habs bloodlines · Dad wore the jersey in '94" on Boumedienne and Trudeau; Canucks fans see Delta power-skating on Oliver; Leafs fans see Marlboros minor-midget on Petrov). Standalone `RootsSegment` card removed from HomeV2 bottom.
- **NHL Home unified engagement stack (Feb 8, 2026)** — three new components on `/home-v2` that convert the flagship into a daily-return surface while enforcing the "NHL flagship, cream rises" philosophy:
  - `UnifiedTopPlays.jsx` — replaces the NHL-only `HighlightsRail`. NHL highlights stay dominant; only junior/NCAA packages with `baseScore >= 7.5` are eligible to climb, capped at 2 tiles. Each non-NHL tile wears a league chip + a "why you're seeing this" badge (e.g. "Marquee matchup", "Kaid Oliver · #14") so promotion is legible.
  - `TenTen.jsx` — "10 @ 10" daily engagement quiz. Ten one-tap questions spanning hot topics, fav team, star power, draft board, prospect radar, and coach's read. LocalStorage keyed per-day (`ticker.tenten.YYYY-MM-DD`) so mid-day return picks up where the user left off; end-state shows per-question tallies vs. the room.
  - `WeeklyVotes.jsx` — added `Star Power` tab (daily "who owned the night" across NHL·NCAA·OHL·WHL), sitting alongside Fight/Goal/Play with Culture still teased locked. Warm-start tallies included so day-one card feels populated.
  - Tested end-to-end by `testing_agent_v3_fork` (iteration_11) — all 6 suites PASSED, 0 console errors, localStorage persistence verified across reloads.
- **Ticker+ CHL/NCAA cascade (walled-off at `/plus/*`)** — full personalization flywheel: 8-step onboarding with nickname capture (Reggie/Marc address the user by name), NHL team, junior/college teams, prospects, interests. LocalStorage-backed `useUserProfile` hook drives it. Ranker heuristic (`scorePackage`) reweights the hand-authored package catalog by user's teams, prospects, and NHL orbit. Surfaces built: `/plus/your-ticker` (personalized dashboard with quick-switch team-logo row at top), `/plus/chl/:division`, `/plus/ncaa/:conf`, `/plus/team/:code` (mirrors HomeV2 layout with record, identity tiles, Reggie coach-read, prospects, outbound CTAs, local sponsor slot), `/plus/prospect/:id` (with Ticker+ paywall via `<GoDeeper>`), `/plus/upgrade` (pricing tiers, feature grid, "simulate upgrade" for demo). 15 hand-authored packages spanning KAM/KEL/VIC/MICH/BU/KIT with Reggie/Marc micro-scripts. Real team logos hotlinked from Wikipedia with graceful initial-badge fallback via `<TeamLogo>`. Legal cleanup logged at `/app/memory/LEGAL_TODO.md` (blocking public launch).
- **HomeV2 "Beyond the NHL" + `WeeklyVotes` (Fight/Goal/Play/Culture) + `MatchupTile` UTM-tagged partner drivers** — content-forward NHL-home gateway to junior/NCAA discovery, personalizes to the visitor's NHL team orbit.
- **`/whl/desk-show` — Live desk show engine prototype** — new walled-off route that wraps a real Kamloops Blazers 2024-25 YouTube highlight in a produced broadcast. Deterministic showrunner timeline of "speak / duck / unduck / score / chyron / flash / sting / close" cues fire off `player.getCurrentTime()`. Reggie + Marc TTS preloaded, played synchronised with video, YT audio ducks to 15% while they read, pops back to 100% at goal moments. Persistent score bug, sliding chyrons, goal flash, on-air host tally. Silent geo-block guard: if the YT video won't play within 6s, engine falls through to a wall-clock virtual timeline over a "video restricted" poster so overlays + audio still demo.
- **Team Room warmth pass** — removed generic Cup/LEGACY icon per user feedback ("not every team has Stanley Cups"), replaced with retired-jersey banners on both walls.
- **Scoreboard consistency** — Reggie & Marc broadcast frame now anchors the top of `/scoreboard` via the shared broadcast slot; chyron reads "LIVE ACTION" (was "Live · demo mode"). `/scoreboard` promoted out of QUIET_ROUTES; LiveDesk portals into `#broadcast-slot` for both `/show` and `/scoreboard`.
- **Reggie & Marc doc package v1 (Feb 19, 2026) — docs only, no code this session** — shipped three new memory docs so any new fork can absorb the hosts in ~30 minutes and wire the code themselves.
  - `BANTER_BIBLE.md` — one-page cheat sheet, character DNA, the 5-beat rhythm, 15 annotated sample exchanges (goal, blowout, rookie, Roots, injury, fight, comeback, chirp Marc, signoff…), segment-by-segment playbook, catchphrase policy + identity-six lists, the chirp ladder (Tiers 1–6), the "is this OK?" tests, canonical LLM system-prompt boilerplate, and 20 starter regeneration prompts.
  - `CADENCE_AND_PERFORMANCE.md` — the performance layer the user explicitly asked for. WPM targets per host per emotional moment (Reggie 130–240, Marc capped at ~175), six-type pause lexicon (micro → dead-air), four-type interruption model (agreement overlap / friendly cut-off / trail-off invite / laugh-under), 1–10 emotional register scale with Marc capped at 8, laugh policy, broadcast-texture micro-cues (filler words, breath sounds, mid-sentence self-corrections), audio scoring markup (chyron, duck, bed), and the canonical per-beat generator JSON output format for `pregame_show.py` / `recap_show.py` to emit.
  - `README_FOR_NEXT_FORK.md` — handoff index. Tells the next agent what to read in what order, what code to write next (`pregame_show.py`, `recap_show.py`, `voice_service.py`, frontend banter player), and the current blocked/unverified state (HomeV2 dynamic team hero unverified, EP key pending, Sportradar vs Sportlogiq decision pending).
  - **Strategic decision recorded:** at launch, Ticker needs BOTH Elite Prospects (roots/junior/bloodlines) AND a real-time hockey data feed. Main agent recommendation is **Sportlogiq over Sportradar** — Canadian, hockey-first, tracking data (zone entries, pressure, chances) feeds Marc's analytical persona, 30 of 32 NHL teams use them. Sportradar de-prioritized but not fully deprecated.

## Prior Session Work
- Play-by-play split-screen + modal (`PlayByPlayPanel.jsx`, `PlayByPlayModal.jsx`) — matches NHL Public API goals to Highlightly clips.
- `FastReelAudition.jsx` — sequenced Highlightly short clips with Reggie voice bumpers (YouTube IFrame Player API).
- 6-team Team Room prototype at `/audition/team-room/:code` — team-themed colors, retired jerseys, solo Reggie takes, superfan XP.
- Ticker Blue (#1E5BFF) brand rollout + T-monogram logo (`brand.jsx`).
- Marc voice pacing tune (0.95 speed, natural breathing via `…`).
- Goal rate-limiter in `live.py`; Recaps audio controls consolidated (mute merged into play/pause); Predict → "Call It", Score → "Scores" labels.

## Backlog (prioritised)

### P0 — Next up
- Formalize the tone pivot in `/app/memory/LANGUAGE_BIBLE.md` (Reggie/Marc voice: respectful, analytical, "build the game, don't roast the kid") — user requested but not yet written down.
- Add-to-Home-Screen PWA prompt (fixes Safari chrome overlap on mobile).

### P1 — Broadcast polish
- Host "interruptions" (Reggie cutting Marc mid-sentence via SSML/state machine).
- Themed Highlight Hubs ("Goalie Wall", "Rough Night", "Power Play Clinic") using Highlightly categories.
- `/lineups` on Morning Skate (Highlightly PRO).

### P1 — Team Room promotion
- Decide the home-page layout (user is still undecided; leave until concept is finalised).
- 32-team roll-out with real NHL/Highlightly-hydrated data.

### P2 — Data & polish
- Replace `live_engine._tick_demo()` with real NHL public API polling once the season starts (Oct).
- Nano Banana illustrated characters for Reggie & Marc to replace silhouettes in Team Room.
- Wikipedia/hometown flavor for host banter.
- Complete LANGUAGE_BIBLE.md sections 5F–9 (user has more to paste or wants agent draft).

### P2 — Refactor
- Split `/app/backend/server.py` (>1500 lines) into routers (highlights, play-by-play, live, banter, etc.).

### Deprecation
- Sportradar Imagn client — trial keys 403; API doesn't provide video anyway. Rip out or hold for post-Series-A metrics.

## Integrations
- **Claude Sonnet 4.5** — Emergent LLM Key
- **Gemini Nano Banana** (image gen) — Emergent LLM Key (idle, ready for character art)
- **ElevenLabs** — user API key in `/app/backend/.env`
- **Highlightly PRO** — user API key in `/app/backend/.env`
- **NHL Public API** — no key required
- **Sportradar** — pending deprecation

## Key Data Contracts
- `GET /api/nhl/play-by-play/{match_id}` — Matches NHL goals to Highlightly videos
- `GET /api/match-highlights/{match_id}` — Highlightly short clips for a match
- `GET /api/live/state` — Demo (later real) live scoreboard state
- `GET /api/banter?topic=…` — LLM-generated Reggie/Marc turns
- `GET /api/topics` — Rotating broadcast topics

## Health
- **Mocked**: Live Scoreboard engine (`live.py`), Betting odds (`mockOdds.js`), Recap Show date pinned to Apr 12 2025, Team Room stats.
- **Broken**: Sportradar (403).

---

## Hockey IQ Product Integration Pass — Feb 12, 2026
Objective: make Reggie + Marc feel visibly and functionally present inside the 4-tab Hockey IQ sub-app at 390×844. The intelligence engine (Phase 0–3) was already built and frozen.

### Completed
- **Chrome compression** — `Layout.jsx` now hides global Ticker header/footer/LiveDesk/Reggie FAB on `/iq/*` so Hockey IQ owns its own single 48px sticky bar.
- **Coach docks on every tab** — new `IQCoachDock` component (Reggie + Marc portraits via existing `HostPortrait`) with a contextual coaching line and "Talk to X" chips.
  - Tonight: reacts to the selected game.
  - My IQ: leads with Marc's coaching line from `/api/iq/user/brief`.
  - Fantasy: Reggie asks about the roster.
  - Community: Marc reads the consensus/specialist split.
- **Inline `IQCoachChat`** — bottom-sheet chat surface per tab, uses existing `/api/assistant/reggie/chat` + `/action` (not the global FAB).
- **Reusable `MakeCallPanel`** — extracted so any surface (Tonight, cold-start, later Fantasy/Community reply) can capture a `UserCall` via the Phase 0 event pipeline (`instinct_captured` → optional `reasoning_added` → `confidence_set` → `locked`).
- **Tonight** — first game auto-selects so MakeCallPanel is on screen at load. No dead landing state.
- **My IQ coach-first** — Marc coach dock + insight cards render FIRST; reputation grid is secondary evidence below.
- **My IQ cold-start** — empty history now shows Reggie's "We haven't seen you call anything yet" card with an inline MakeCallPanel prefilled to the first game, instead of "Not enough data".
- **Automatic return loop** — new `/api/iq/dev/simulate-resolve` (dev-gated by `IQ_DEV_MODE=1`) deterministically grades locked calls with a 2-of-3 correct pattern so the make → lock → auto-resolve → My IQ update → Marc coaching update loop can be demonstrated without waiting for a real Sportradar feed.
- **Community people-first** — new `/api/iq/community/feed-enriched` attaches author reputation + top-qualified specialty to each public call. New `/api/iq/community/specialists?dimension=` returns top-N per dimension. Feed items now render: portrait + nickname + specialty chip (Community · 84%) + call + outcome pill. Marc consensus card interprets the room ("Room and specialists both on over. Rare alignment.").
- **Adult coaching_line fallback** — `iq_insights.coaching_line_for_bet_context()` now returns a general Marc line derived from any qualifying insight when the user hasn't unlocked betting. Non-adults still get grounded coaching, only betting-specific priorities remain adult-gated.
- **Consumer-language cleanup** — Every "Phase N", "Yahoo/ESPN coming later", "kept separate on purpose", "existing tracker", "frozen v2", "Coming next" phrase removed from the /iq surface.

### Test results
- 65/65 backend pytest (52 pre-existing + 13 new integration-pass cases)
- 35/35 Phase 0 acceptance
- 40/41 Phase 2 acceptance (single test-data contamination — pre-existing, unrelated)
- 14/14 Phase 3 acceptance (updated one assertion to reflect intentional non-adult coaching line)
- Testing agent: PASS (backend 100%, frontend ~95% — no critical bugs, retest_needed=false)

### Files touched
- `backend/server.py` — 3 new endpoints (`feed-enriched`, `specialists`, `dev/mode`, `dev/simulate-resolve`)
- `backend/iq_insights.py` — non-adult coaching line fallback
- `backend/.env` — `IQ_DEV_MODE=1` for preview
- `backend/tests/test_iq_integration_pass.py` — 13 new tests (from testing agent)
- `backend/tests/acceptance_iq_phase3.py` — assertion updated for new coaching behavior
- `frontend/src/pages/HockeyIQ.jsx` — full rewrite
- `frontend/src/components/iq/IQCoachDock.jsx` — new
- `frontend/src/components/iq/IQCoachChat.jsx` — new
- `frontend/src/components/iq/MakeCallPanel.jsx` — new (extracted, reusable)
- `frontend/src/components/Layout.jsx` — `isIQRoute` chrome-suppression gate

### Still Deferred (per user scope lockdown)
- Sportradar production upgrade
- Yahoo/ESPN fantasy import
- Sportsbook payment integration
- Full forum expansion
- Tonight's 10 / Accuracy Wheel / Betting DNA UIs
- Voice-first ElevenLabs playback on Marc/Reggie coach lines (text-only this pass)
- Server-side refactor into `/app/backend/routes/`

