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

## Recent Changes (Feb 2026)
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
