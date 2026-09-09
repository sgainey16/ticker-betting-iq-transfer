# FOUNDATION AUDIT — CURRENT TICKER (Ticker 3)
### Read-Only Foundation Evaluation for Rebuild Decision

> **Purpose.** This is one leg of a three-way foundation comparison
> (Original Ticker Fork · MARSL · Current Ticker 3). The user is
> evaluating which codebase — if any — is the best chassis for a lean
> Ticker MVP structured around:
>
> **Home | Tonight/Scores | Recap | Highlights | Team | Player | Game | Talk**
> with **Reggie + Marc** as the persistent contextual intelligence layer.
>
> **Scope.** Read-only. No modifications, no fixes, no refactors, no
> installs, no deletions. Report only.
>
> **Date:** Feb 19, 2026

---

## 1. IDENTITY & VERSION

| Field | Value |
|---|---|
| Git branch | `main` |
| Current HEAD | `e8a0278` (2026-08-11 15:09:40 UTC) |
| Last commit message | "Rolled back cleanly. ✅" |
| Backend Python files | **21** |
| Frontend source files (.jsx/.tsx/.js/.ts) | **143** |
| Frontend components | **81** |
| Frontend pages | **36** |
| Backend endpoints | **54** (37 GET · 15 POST · 2 DELETE) |
| Total backend LOC | **~7,800** |
| Largest single file | `server.py` at **1,743 lines** |
| Second-largest | `HomeV2.jsx` at **1,291 lines** |
| Memory docs | **25** (Reggie/Marc + product specs) |

---

## 2. SCREENS & ROUTES

**Registered routes in `/app/frontend/src/App.js` (37 routes):**

### Core product (candidates for MVP)
- `/` → **Recap Show** (RecapShow.jsx)
- `/show` → **The Morning Skate** (Home.jsx)
- `/tonight/:gameId` → **Tonight Game** (TonightGame.jsx)
- `/home-v2` → **NHL Team Home** (HomeV2.jsx) — flagship dashboard
- `/scoreboard` → **Live Scoreboard**
- `/stats` → **Stats hub**
- `/team/:code` → **Team Stat Page**
- `/player/:playerId` → **Player Detail**
- `/lineup` + `/lineup/:team` → **Lineup viewer**
- `/reels` → **Reels tab** (placeholder)
- `/press-conference` → **Reggie Chat** (redirected to `/home-v2`)
- `/press-conference/classic` → **Legacy Presser** (PressConference.jsx)
- `/back-office` → **Voice preferences, settings**
- `/login` → **Login (localStorage-based)**
- `/recaps` + `/recaps-archive` → **Recap archive** (same component, both routes)
- `/matchup/:matchupId` → **Matchup Deep Dive**

### Ticker+ walled-off cascade (subscription tier, personalized junior/NCAA coverage)
- `/plus/onboarding`
- `/plus/your-ticker`
- `/plus/chl/:division`
- `/plus/ncaa/:conf`
- `/plus/team/:code`
- `/plus/prospect/:id`
- `/plus/upgrade`

### Junior-league experiments (walled-off, semi-vestigial)
- `/ohl/home`
- `/whl/recap-sample`
- `/whl/desk-show` — live-desk broadcast engine prototype

### Audition/demo/dev surfaces (candidates for removal)
- `/desk-preview` — sprite testing
- `/audition/fast-reel/:matchId`
- `/audition/brand`
- `/audition/team-room` + `/audition/team-room/:code`
- `/uncut/canucks` — one-off team demo
- `/demo/greatest-goal` — one-off
- `/voice-lab`
- `/voices`
- `/fantasy` — Fantasy tab (mostly mocked)
- `/predictions` → redirect to `/show` (dead route kept for backwards compat)
- `/recap` → redirect to `/` (dead route)
- `/soon/:slug` → coming-soon placeholder

**Route count vs product surface:**
- **Core product routes:** ~13
- **Ticker+ cascade:** 7
- **Vestigial/experimental:** ~17 (nearly half the total surface)

---

## 3. HOME IMPLEMENTATION

Two "home" pages exist simultaneously:

**`Home.jsx`** (mounted at `/show`) — "The Morning Skate":
- Pregame preview with Reggie & Marc frame portalled at top
- Legacy layout

**`HomeV2.jsx`** (mounted at `/home-v2`) — the flagship NHL Team Home:
- **1,291 lines** — largest page in the app
- Dynamic user's favorite team hero banner (recently refactored, unverified)
- Contains `UnifiedTopPlays.jsx` (personalized highlights rail with promotion caps for junior/NCAA)
- Contains `TenTen.jsx` (10 @ 10 daily quiz)
- Contains `WeeklyVotes.jsx` (Fight/Goal/Play/Culture/Star Power tabs)
- Contains `FavoritesRail.jsx` (horizontal team logos rail)
- Sub-components inlined: `CupScoreCard`, `NextGameCard`, `TeamLeadersAccuracy`, others

**Assessment:** HomeV2 is the intended flagship but is bloated. Home.jsx is legacy. In a clean rebuild, one Home wins — HomeV2's content, extracted into smaller components.

---

## 4. SCORES / TONIGHT IMPLEMENTATION

- **`Scoreboard.jsx`** — `/scoreboard` — Live scoreboard with `LiveDesk.jsx` broadcast frame portalled at top. Uses demo goal engine (`live.py` `_tick_demo`).
- **`TonightGame.jsx`** — `/tonight/:gameId` — Individual pre-game matchup page. Fetches per-game Reggie & Marc audio from `/api/tonight/segment` (Claude-generated per-matchup script + ElevenLabs audio).
- **`GameHub.jsx`** (550 lines) — Component used inside multiple pages for game card display with expandable tiles.
- **Prediction voting** — Unified with the logo tiles on the Tonight page. Tap a logo to lock your call.

**Data sources for scores/games:**
- Live: `live.py` runs a demo goal-tick engine (fake goals every few seconds)
- Static: `analysts.py::GAMES` — 4 hand-authored demo games with Reggie/Marc picks
- NHL API: `nhl_data.py` + `nhl_pbp.py` — real NHL public API integration

---

## 5. RECAP IMPLEMENTATION

- **`RecapShow.jsx`** — 564 lines — the marquee experience.
- Fetches `/api/recap-show/episode?date=YYYY-MM-DD` on load. DEMO_DATE currently hardcoded to `2025-04-12` (has real Highlightly clips).
- Builds a beat sequence: cold open (Reggie → Marc) → per-game (Reggie hook → clip → Marc outro) → sign-off (Marc → Reggie).
- Beats are played via `TwoHostDesk.jsx` (the animated broadcast frame) + audio fetched per-beat from `/api/recap-show/line-audio` (ElevenLabs).
- **`recap_show.py`** (380 lines) — backend generator. Fetches clips from Highlightly, groups by game, fans out concurrent `/matches/{id}` calls for final scores, uses Claude Sonnet 4.5 for the LLM-authored per-game script (with templated fallback).
- Has portrait/landscape mobile handling — clean broadcast bleed in landscape.

**Currently working:** Yes. As of this audit, Recap loads 8 real games from Apr 12, 2025 with generated Reggie/Marc scripts and on-demand ElevenLabs audio. Highlightly key was refreshed today after being 401'd.

---

## 6. TEAM PAGES

Two implementations:

**`TeamStatPage.jsx`** at `/team/:code` — the "canonical" NHL team stats page:
- Hero, season stat block, auto-generated depth chart (4 F-lines · 3 D-pairs · 2 G · IR), prospects panel via `tickerCatalog.PROSPECTS` `nhlOrbit` lookup
- Roster rows deep-link to `/player/:playerId`

**`plus/TeamPage.jsx`** at `/plus/team/:code` — the Ticker+ junior/CHL/NCAA team page:
- Mirrors HomeV2 layout with record, identity tiles, Reggie coach-read, prospects, outbound CTAs, local sponsor slot

Additional team-context page: `TeamRoomAudition.jsx` at `/audition/team-room/:code` — 6-team fan shrine prototype, marked audition.

---

## 7. PLAYER PAGES

Two implementations (unifying is on backlog):

**`PlayerDetail.jsx`** at `/player/:playerId` — canonical modern player page.
**`PlayerProfile.jsx`** at `/player-profile/:slug` — legacy variant (696 lines).

Route priority in `App.js` was fixed so `/player/:playerId` wins over the legacy path.

---

## 8. GAME PAGES

- **`TonightGame.jsx`** — pre-game page at `/tonight/:gameId`. Real matchup deep-link.
- **`MatchupDeepDive.jsx`** at `/matchup/:matchupId` — analytical deep-dive (uses `MatchupInsight.jsx`).
- **`GameHub.jsx`** (550-line component) — used inside multiple screens for game card display.

No single canonical "Game Detail" page — Tonight, Matchup Deep Dive, and Recap segment are three separate implementations.

---

## 9. HIGHLIGHTS / VIDEO FUNCTIONALITY

- **`PlayByPlayPanel.jsx`** + **`PlayByPlayModal.jsx`** — the primary highlight surface. Matches NHL Public API goals to Highlightly clips, split-screen play-by-play.
- Post-game interview clips appended via Highlightly's `post-match-content` + `press-conference` categories (integrated Feb 8, 2026).
- **`FastReelAudition.jsx`** at `/audition/fast-reel/:matchId` (575 lines) — sequenced Highlightly short clips with Reggie voice bumpers via YouTube IFrame Player API.
- **`Reels.jsx`** at `/reels` — placeholder tab (Reels feature not fully built yet).
- **`UnifiedTopPlays.jsx`** — on HomeV2, ranks NHL highlights first, junior/NCAA promoted with score ≥ 7.5.

Highlightly integration lives entirely in `highlightly_client.py` (294 lines). Reasonably well-abstracted.

---

## 10. REELS FUNCTIONALITY

- Route exists (`/reels`) with a placeholder page.
- Not built out. On the roadmap as "P1 — dedicated tab for auto-playing video reels."

---

## 11. TALK / CHAT FUNCTIONALITY

- **`ReggieAssistant.jsx`** — persistent bottom-docked chat pill. Present on most routes.
  - "Talk to me — Reggie" mic + text CTA
  - Wake-word "Hey Reggie" via native Web Speech API (`useWakeWord.js`)
  - Docked/minimizable pill state
  - Voice preferences configurable in `BackOffice.jsx`
- **`reggie_assistant.py`** — 324-line backend service, handles chat state, history, LLM streaming.
- Endpoints: `POST /api/assistant/reggie/chat`, `POST /api/assistant/reggie/action`, `GET /api/assistant/state`, `GET /api/assistant/history`, `DELETE /api/assistant/history`
- **`PressConference.jsx`** at `/press-conference/classic` — legacy classic presser (678 lines)
- Also `/api/ask/stream` — a separate SSE streaming endpoint for asking Reggie questions

**Multiple chat surfaces:** classic presser + docked assistant + streaming Q&A. In a clean rebuild, this consolidates to one.

---

## 12. REGGIE BANKS IMPLEMENTATION

**Character prompt:** `/app/backend/analysts.py` lines 10–116 (as a Python string literal, ~106 lines of prompt text inside the module).

**Voice ID (ElevenLabs):** `xlMuE31yicdJYxPOyMin` — user's custom "Reggie" voice (from `voice_service.py:34`)

**Voice settings (via `voice_service.py`):** stability + style overridable per host via BackOffice.

**Character content covered in prompt:**
- Core beliefs, signature catchphrases, player philosophy, vet takes
- Situational calls (goal, grinder shift, coach adjustments, goalie steals, obvious calls, young kid emerging, class act, disrespectful play)
- Signoffs, tone modes (LIGHT-AND-FUN vs TECHNICAL)
- Roasting Marc, agreeing with Marc, emotional core
- Rules: 2-4 sentences, never "as an AI," no emoji

**Visual assets:**
- `reggie_hero.png`, `reggie_hero_crop.png`, `reggie_portrait.png`, `reggie_stage.png` in `/app/backend/static/hosts/`
- 30+ sprite files at `/app/backend/static/sprites/` (reggie_neutral, reggie_explaining, reggie_pointing, reggie_leaning, reggie_hands_open, reggie_counting, reggie_looking_notes, reggie_looking_monitor, reggie_listening_off, reggie_skeptical, reggie_smirking, reggie_laughing, reggie_yelling, reggie_disappointed, reggie_serious, reggie_pointing, reggie_chirping, reggie_hot_take, reggie_mic_drop, reggie_celebrating, reggie_thinking, side_reggie, ots_reggie, two_reggie_speaks, etc.)

**Companion chat state:** Persisted in Mongo via `reggie_assistant.py`.

**Companion doc:** `BANTER_BIBLE.md`, `CADENCE_AND_PERFORMANCE.md`, `CHARACTER_STYLE_GUIDE.md`, `LANGUAGE_BIBLE.md`, `HEY_REGGIE_SPEC.md` — an extensive character bible package (created this session).

---

## 13. MARC COLLINS IMPLEMENTATION

**Character prompt:** `/app/backend/analysts.py` lines 118–260 (~140 lines of prompt as string literal).

**Voice ID (ElevenLabs):** `pqHfZKP75CvOlQylNhV4` — "Bill — mature, warm" (default; user can swap via BackOffice)

**Voice candidates rotation** — `voice_picker.py` maintains a small pool of ~5 Marc voice options for BackOffice picker.

**Character content covered in prompt:**
- Core identity (Patience beats panic, Curiosity beats certainty, etc.)
- Signature catchphrases, analytics philosophy, hockey wisdom
- Explaining the game, pushing back on Reggie, dry humor
- Marcisms (11 situational categories: overreactions, tape-agrees, tape-disagrees, someone-lucky, Reggie-fired-up, coaching adjustments, player-struggles, close-game, records, young-emergence, standings-lie, momentum)
- Veteran perspective, speaking style, rules

**Visual assets:**
- `marc_hero.png`, `marc_hero_crop.png`, `marc_portrait.png`, `marc_stage.png`
- ~15 sprites: marc_neutral, marc_explaining, marc_pointing, marc_leaning, marc_hands_open, marc_looking_notes, marc_looking_monitor, marc_listening_off, marc_skeptical, marc_smirking, marc_laughing, marc_serious, marc_analyzing_stats, marc_adjusting_glasses (x2), marc_smiling, ots_marc, side_marc, two_marc_speaks

**Marc has fewer sprites than Reggie** — a real character asymmetry, aligned with Marc's calmer role.

---

## 14. PERSISTENT HOST/PANEL IMPLEMENTATION

**`TwoHostDesk.jsx`** (258 lines) — the primary broadcast frame component.
- Renders as a wide 22:10 (or `fill`) container
- Two rendering modes:
  1. **SOLO SHOT** — when script picks a specific host expression (e.g. `reggie_pointing`) and the corresponding PNG exists at `/api/hosts/expressions/<host>/<slug>.png`
  2. **COMPOSED STUDIO** — fallback with both hosts side-by-side, active speaker's pane widened via CSS grow
- Currently: solo expression PNGs are missing (404s), so the composed studio is what actually renders on Recap. Hero portraits are used as backgrounds with brightness/rim-glow changes when speaking.
- `SHOTS` set exports 60+ named camera cues.

**`LiveDesk.jsx`** — the scoreboard/live-desk variant of the broadcast frame. Portalled into `#broadcast-slot` on `/show` and `/scoreboard`.

**`ReggieAssistant.jsx`** — the bottom-docked persistent pill (not part of the desk; it's the always-on chat).

**Broadcasts context:** `broadcastContext.jsx` — React context for controlling the desk state (which shot, who's speaking, etc.).

**Desk preview route:** `/desk-preview` — dev route for cycling through all 60 shot slots.

---

## 15. ELEVENLABS / TTS / VOICE

**Primary config file:** `/app/backend/voice_service.py` (273 lines)

**API key location:** `.env` → `ELEVENLABS_API_KEY`

**Model:** ElevenLabs Python SDK `elevenlabs==2.58.0`; `VoiceSettings` used for stability/similarity_boost/style/use_speaker_boost.

**Voice ID configuration (hardcoded in `voice_service.py`):**
```python
ANALYST_VOICES = {
  "reggie": { "voice_id": "xlMuE31yicdJYxPOyMin" },  # Custom "Reggie" voice
  "marc":   { "voice_id": "pqHfZKP75CvOlQylNhV4" },  # "Bill" — mature warm
}
```

**Additional voice candidate pool** (`/app/backend/voice_picker.py`, 210 lines) — 11 candidates users can swap between via BackOffice. Includes IDs like `QFNlGyAI98kVm40cB3ik`, `pNInz6obpgDQGcFmaJgB`, `TxGEqnHWrfWFTfGW9XjX`, `yoZ06aMxZJJ28mfd3POQ`, `iP95p4xoKVk53GoZ742B`, `nPczCjzI2devNBz1zQrb`, `3Mpc52HLMolH3B7bOzgW`, `JBFqnCBsd6RMkjVDRZzb`, `cjVigY5qzO86Huf0OWal`, `flq6f7yk4E4fJM5XTYuZ`.

**Preview clip cache:** `/app/backend/static/audio/previews/` — 18 pre-rendered preview mp3s for BackOffice picker.

**Full audio cache:** `/app/backend/static/audio/` — 327 pre-rendered Reggie/Marc mp3s across previous sessions (persistent).

**Budget guard:** Daily character limit enforced via `ELEVENLABS_DAILY_CHAR_LIMIT` env var; state tracked in `elevenlabs_daily_budget.json`.

**Audio processing:** Uses `subprocess.run` with ffmpeg for post-processing.

**⚠️ Concurrency issue flagged by code review:** `ensure_audio()` is synchronous but called from `async` handlers without `run_in_executor`/`to_thread`. Blocks event loop for seconds per line. This affects Recap warmup and any live banter generation.

---

## 16. CHARACTER ARTWORK / ASSETS

**Location:** `/app/backend/static/`

**Structure:**
- `static/hosts/` — hero portraits and full stages
  - `reggie_hero.png`, `reggie_hero_crop.png`, `reggie_portrait.png`, `reggie_stage.png`
  - `marc_hero.png`, `marc_hero_crop.png`, `marc_portrait.png`, `marc_stage.png`
  - `studio.png`, `studio_v2.png`
  - `_legacy_v1/` — 4 archived legacy portraits
  - `_realistic_v2_archive/` — archived realistic-style variants (marc/, reggie/, together/ subfolders)
  - `expressions/` — intended location for solo expression PNGs (currently only `together/` empty; solo folders empty despite code expecting them)
- `static/sprites/` — 48 sliced sprite frames (this is the working expression library)

**Served via FastAPI mounts (server.py:1727-1730):**
- `/api/audio` → `static/audio/`
- `/api/sprites` → `static/sprites/`
- `/api/hosts` → `static/hosts/`
- `/static` → `static/`

**Contact-sheet generator scripts:** `/app/backend/scripts/slice_contact_sheet.py` — can slice a 20-shot contact sheet from ChatGPT/Midjourney into individual host expression PNGs (spec in `CHARACTER_STYLE_GUIDE.md`).

---

## 17. HOCKEY DATA PROVIDERS

**Active integrations:**

| Provider | File | Purpose | Status |
|---|---|---|---|
| **Highlightly** | `highlightly_client.py` (294 lines) | Game highlights, scoring leaders, standings, post-game clips | ✅ Working (key refreshed today) |
| **NHL Public API** | `nhl_data.py` (173), `nhl_pbp.py` (143) | Free official scores/schedules/PBP | ✅ Working |
| **Sportradar** | `sportradar_client.py` (414 lines) | Advanced stats, PBP | ❌ Deprecated — 401/403 recurring failures |
| **Elite Prospects** | (not yet implemented) | CHL/AHL/NCAA rosters, bloodlines, junior stats | ⏳ Blocked awaiting user API key |

**Non-hockey integrations:**
- **Claude Sonnet 4.5** — via `emergentintegrations==0.2.0` + Emergent LLM Key. Powers all LLM script generation (recap, pregame, assistant).
- **YouTube IFrame API** — for embedding Highlightly clips in `FastReelAudition.jsx` and elsewhere.

**Env vars from `.env`:**
```
HIGHLIGHTLY_API_KEY, HIGHLIGHTLY_ENABLED, HIGHLIGHTLY_BASE_URL
SPORTRADAR_API_KEY, SPORTRADAR_ENABLED, SPORTRADAR_SEASON_TYPE, SPORTRADAR_SEASON_YEAR
SPORTSDATA_API_KEY  (unused stub)
ELEVENLABS_API_KEY, ELEVENLABS_DAILY_CHAR_LIMIT
EMERGENT_LLM_KEY
CORS_ORIGINS
```

---

## 18. TEAM/PLAYER/GAME DATA MODELS

**Pydantic models in `server.py`:**
- `AskRequest` (69) — chat input
- `PredictionCreate` (76) / `Prediction` (84) — game picks
- `BetLogCreate` (98) / `BetLog` (115) — betting entries
- `QuickReplyReq` (234)
- `VoiceSelectReq` (299) / `VoicePickReq` (437)
- `DeviceReq` (1358) / `RosterReq` (1363)
- `AssistantChatReq` (1454) / `AssistantActionReq` (1460)

**No Pydantic models for Team, Player, or Game entities.** All team/player/game data is either:
- Mocked as Python dicts in `analysts.py` (PLAYERS, TEAMS, GAMES arrays)
- Fetched from external APIs (Highlightly, NHL) and passed through as untyped dicts
- Hardcoded in frontend `/app/frontend/src/data/tickerCatalog.js` (843 lines of catalog data)

**Frontend data files:**
- `matchups.js` — matchup mocks
- `tickerCatalog.js` — CHL/AHL/NCAA teams, prospects, packages (843 lines, heavy mock data pending Elite Prospects API)

**Assessment:** The data model layer is the weakest architectural point. No canonical Team/Player/Game types. External API responses are passed around as raw dicts.

---

## 19. AUTHENTICATION / ONBOARDING / FOLLOWS / PERSONALIZATION

**Auth model:** localStorage-based (no server-side JWT/session).
- `/login` route exists
- User identity is a free-text `user_name` on prediction/betting endpoints
- **Security note from code review:** predictions are keyed on `(user_name, game_id)` alone — no device_id/auth binding. Two users with the same nickname overwrite each other's picks.
- Betting/subscription endpoints DO use `device_id` — inconsistent.

**Onboarding:**
- `/plus/onboarding` at `plus/Onboarding.jsx` (718 lines) — 5-step flow
- Steps: nickname, NHL team, CHL teams (WHL/OHL/QMJHL tabs), NCAA conferences (B1G/HE/NCHC/ECAC/CCHA/AHA), languages ("coming soon" flags)
- Also `OnboardingOverlay.jsx` — first-run interstitial component

**Personalization backbone:**
- `useUserProfile.js` (in `/app/frontend/src/lib/userProfile.js`) — localStorage hook for profile
- `signals.js` — signal-driven content ranking (user affinity, cross-border discovery)
- Ranker heuristic (`scorePackage`) in Ticker+ cascade — reweights hand-authored package catalog by user's teams, prospects, and NHL orbit
- `useSignals` hook feeds the ranker on HomeV2, Tonight, Recap

**Follows model:** Not persisted server-side. Everything lives in localStorage.

---

## 20. DATABASE / STORAGE

**MongoDB:**
- Client instantiated once at `server.py:55` via `AsyncIOMotorClient(MONGO_URL)`
- Only 2 imports across entire backend (very shallow usage)
- Used for: predictions, betting logs, subscription state, Reggie assistant chat history
- Not used for: teams, players, games, recaps, host state, personalization, follows, roster data

**In-process cache:**
- Recap show episodes cached per (date, voice) tuple in memory only
- Cache lost on backend restart

**Local file cache:**
- `static/audio/*.mp3` — 327 persistent pre-rendered TTS files
- `elevenlabs_daily_budget.json` — daily character counter

**localStorage (frontend):**
- `voiceSettings`, `signals`, `userProfile`, `ticker.tenten.YYYY-MM-DD`, subscription state, wake-word prefs

**Assessment:** MongoDB is present but massively underused. Most product state is either in-process (won't survive restart) or localStorage (per-device only). No true canonical source of truth for team/player/game/roster data.

---

## 21. MOBILE / RESPONSIVE

**Tailwind breakpoints found:**
- `portrait:` and `landscape:` variants used throughout RecapShow.jsx, HomeV2.jsx, TonightGame.jsx
- Standard `sm:`, `md:`, `lg:` breakpoints
- Recap page has explicit landscape "broadcast bleed" layout (edge-to-edge desk)
- Rotate-phone nudge component (`RotateHint`) for portrait phones

**PWA:**
- Add-to-Home-Screen prompt via `IosInstallPrompt.jsx`
- No service worker registration observed in this audit

**Assessment:** Mobile responsive story is decent for Recap (landscape-optimized broadcast bleed is a highlight), but portrait mobile is not a first-class citizen everywhere. HomeV2 at 1,291 lines has responsive markers but is complex enough that mobile-first refactor would benefit.

---

## 22. BACKEND ENDPOINTS (54 total)

### Core hockey/broadcast
```
GET  /api/analysts
GET  /api/ticker
GET  /api/nhl/standings
GET  /api/nhl/games
GET  /api/stats/players
GET  /api/stats/teams
GET  /api/topics
GET  /api/banter
POST /api/banter/quick-reply
GET  /api/suggested-questions
```

### Recap Show
```
GET  /api/recap-show/episode
GET  /api/recap-show/line-audio
GET  /api/recap-show/post-game-stats
GET  /api/recaps/highlights
GET  /api/recaps/latest-games
```

### Tonight / matchups
```
GET  /api/tonight/segment
GET  /api/audition/fast-reel
GET  /api/audition/play-by-play
```

### Live
```
GET  /api/live/state
POST /api/live/force-goal
POST /api/live/reset
```

### Predictions & betting
```
GET  /api/predictions/games
GET  /api/predictions/mine
GET  /api/predictions
POST /api/predictions
GET  /api/predictions/me/{user_name}
GET  /api/predictions/leaderboard
POST /api/predictions/simulate-resolve
POST /api/betting/bet
GET  /api/betting/bets
DELETE /api/betting/bet/{bet_id}
GET  /api/betting/stats
```

### Assistant (chat)
```
GET  /api/assistant/state
GET  /api/assistant/history
POST /api/assistant/reggie/chat
POST /api/assistant/reggie/action
DELETE /api/assistant/history
POST /api/ask/stream
```

### Voice & TTS
```
GET  /api/tts/budget
GET  /api/voices/picker
POST /api/voices/preview/{host}/{voice_id}
POST /api/voices/set-active
GET  /api/voice-lab/manifest
POST /api/voice-lab/select
```

### Images / static
```
GET  /api/images/team-logo/{code}
GET  /api/images/team-logos
```

### Radio
```
GET  /api/radio/station/{team_code}
GET  /api/radio/stations
```

### Subscription
```
GET  /api/subscription/state
GET  /api/subscription/roster
POST /api/subscription/increment-question
POST /api/subscription/activate
POST /api/subscription/roster
```

**All 54 endpoints live in one 1,743-line `server.py`. No FastAPI `APIRouter` split.**

---

## 23. MAJOR DEPENDENCIES

**Backend (`requirements.txt` — 127 packages total):**
```
fastapi==0.110.1
motor==3.3.1
pymongo==4.6.3
pydantic==2.13.4
elevenlabs==2.58.0
openai==1.99.9
emergentintegrations==0.2.0
litellm==1.80.0
httpx==0.28.1
```

**Frontend (`package.json` — 57 deps):**
```
react                 19.0.0
react-dom             19.0.0
react-router-dom      7.15.0
@tanstack/react-query 5.56.2
axios                 1.18.0
framer-motion         11.18.0
lucide-react          0.516.0
recharts              3.6.0
sonner                2.0.3
date-fns              4.1.0
clsx                  2.1.1
tailwindcss           (via config)
```

React 19 + React Router 7 — very fresh. `@tanstack/react-query` present but usage appears light. Shadcn UI in `/components/ui/`.

---

## 24. DUPLICATE / OVERLAPPING ROUTES & COMPONENTS

**Direct duplicates or overlaps:**
- `Home.jsx` vs `HomeV2.jsx` — two "home" pages, both mounted
- `PlayerDetail.jsx` vs `PlayerProfile.jsx` — two player pages, both mounted
- `TeamStatPage.jsx` vs `plus/TeamPage.jsx` — two team pages, different URL trees (NHL vs Ticker+)
- `PressConference.jsx` (classic) vs `ReggieAssistant.jsx` (docked pill) — two chat surfaces
- `/recaps` and `/recaps-archive` — same component mounted on two routes
- `/predictions` and `/recap` — redirect stubs for old routes (backwards-compat cruft)
- `Recaps.jsx` (archive) vs `RecapShow.jsx` (live) — related but distinct
- `LiveDesk.jsx` vs `TwoHostDesk.jsx` — two broadcast frame components with similar responsibilities

**Sub-component inline candidates for extraction:**
- `HomeV2.jsx` (1,291 lines) contains multiple inline sub-components (`CupScoreCard`, `NextGameCard`, `TeamLeadersAccuracy`) that should be their own files
- `BackOffice.jsx` (1,252 lines) mixes voice preferences, subscription controls, wake-word settings, and more

---

## 25. DEAD / EXPERIMENTAL CODE

**Vestigial routes (17 of 37):**
- `/audition/*` (4 routes) — brand, team-room, team-room/:code, fast-reel/:matchId
- `/desk-preview`, `/voice-lab`, `/voices` — dev tools
- `/demo/greatest-goal` — one-off
- `/uncut/canucks` — one-off
- `/fantasy` — mostly mocked, no real Fantasy platform integration
- `/press-conference/classic` — legacy chat
- `/ohl/home`, `/whl/recap-sample`, `/whl/desk-show` — junior-league experiments
- `/soon/:slug` — coming-soon placeholder
- `/predictions`, `/recap`, `/press-conference`, `/ask` — dead redirect routes

**Archive folders:**
- `/app/backend/static/hosts/_legacy_v1/` — old character portraits
- `/app/backend/static/hosts/_realistic_v2_archive/` — abandoned realistic character style
- `/app/backend/static/hosts/expressions/marc/`, `reggie/`, `together/` — empty folders, code expects PNGs here but they never got dropped in

**Backend modules with limited use:**
- `sportradar_client.py` (414 lines) — deprecated integration, key doesn't work; dead code unless key is refreshed
- `crop_asset_library.py`, `design_reggie.py`, `design_voices.py`, `generate_studio.py` — asset generation scripts, one-time use
- `radio_stations.py` (84 lines) — team radio station lookup, small feature, probably fine to keep

**Lint findings (from code review):** `ruff check` produced 82 findings — dead code (`SKATER_CATS` in sportradar_client.py), 13 unused imports, 25 blind `except: pass` handlers.

---

## 26. OBVIOUS COMPLEXITY / ARCHITECTURAL PROBLEMS

### Severity: HIGH (structural)

**1. `server.py` is a 1,743-line God-file.**
- 54 endpoints, Pydantic models, caching, static mounts, LLM streaming, DB access all in one file
- No `APIRouter` split
- Fresh developer onboarding is painful; test isolation is hard
- Code review flagged as "structural risk" (LOW severity ranking there, but the pattern compounds every commit)

**2. `analysts.py` mixes character prompts with NHL mock data.**
- 773 lines: ~250 lines of LLM system prompts as string literals, ~200 lines of PLAYERS/TEAMS/GAMES arrays, ~350 lines of BANTER_BY_TOPIC hand-authored scripts
- Prompts should be versioned config or dedicated `.txt`/`.md` files (which would benefit from your existing `LANGUAGE_BIBLE.md` / `BANTER_BIBLE.md` structure)
- Mock data should be in its own module (or, better, a real Team/Player/Game data layer)

**3. No canonical data model.**
- Team/Player/Game are dicts everywhere. No Pydantic types, no schemas.
- Frontend `tickerCatalog.js` (843 lines) is the closest thing to a data source of truth — and it's static frontend code.
- Elite Prospects integration will inherit this weakness unless the layer is designed first.

### Severity: MEDIUM (correctness)

**4. Blocking TTS calls stall the event loop.** (Code review finding)
- `ensure_audio()` performs ElevenLabs network + ffmpeg subprocess synchronously inside async handlers
- Under light concurrency, any user generating a Recap freezes the API for all other users
- Fix: `asyncio.to_thread` / offload to a queue

**5. Prediction data can be overwritten by nickname collision.** (Code review finding)
- Picks keyed on `(user_name, game_id)` with no device/auth binding
- Two users with the same free-text nickname overwrite each other's picks
- Data integrity issue on the leaderboard

**6. In-process cache means restarts lose everything.**
- Recap episodes cached in-memory only
- Backend restart = re-fetch every date, re-generate every script, re-render every audio line

### Severity: LOW (hygiene)

**7. 17 of 37 routes are audition/dev/vestigial.**
- Nearly half the frontend surface is not core product
- Onboarding a new developer requires them to intuit "what's actually shipped" vs "what's an experiment"

**8. CORS wildcard with credentials.**
- `CORS_ORIGINS="*"` with `allow_credentials=True` — browsers reject this, and it's over-broad
- Small fix, but a sign of copy-paste-not-thought-through configuration

**9. No test coverage.**
- Only `backend/tests/test_stats_and_ticker.py` — hits a hardcoded live preview URL
- No unit tests, no isolated tests
- Anything can break silently on refactor

---

## 27. CODE REVIEW AGENT VERDICT (excerpt)

*Full review captured in Section 28. Key findings:*

**Status:** READY WITH FIXES
**Classification:** **B — Useful components, not a clean complete foundation**

**Direct quote:**
> keep the provider modules (`highlightly_client`, `sportradar_client`, `nhl_data/pbp`, `voice_service`, `game_story`, `live`), MongoDB-backed betting/subscription/assistant flows, and the lint-clean React core; prune ~40% audition/demo/sidecar pages, split `server.py` into routers, extract `analysts.py` prompts/data, and de-block audio synthesis before building on it.

**Confirmed defects requiring fix before rebuild:**
- MEDIUM: Blocking TTS/ffmpeg in async handlers (server.py:208,273,543,768-771,791,835-836)
- MEDIUM: Name-keyed predictions vulnerable to overwrite (server.py:1171-1221)

**Coverage:**
- ✅ Complete: Requirements compliance, API contracts, data integrity, error handling, external integrations, resource bounds, frontend state, source structure, lint, framework best practices, dead code
- ⚠️ Partial: Test adequacy (no unit tests), concurrency/migration/auth (source-only assessment)

---

## 28. FULL CODE REVIEW AGENT REPORT

```
### MEDIUM CONFIRMED Blocking TTS/ffmpeg calls stall the whole API during shows
- Location: backend/server.py:208,273,543,768-771,791,835-836; backend/voice_service.py:182,210,255
- Trigger: Any request to /banter, /ask/stream, /tonight/segment, or
  /recap-show/episode?voice=true that hits an uncached line.
- Defect: ensure_audio() is a synchronous function performing ElevenLabs
  network calls plus a subprocess.run ffmpeg pass, but it is called directly
  inside async handlers/generators (no run_in_executor/to_thread). It blocks
  the single event loop for seconds per line (recap warms 4+ lines serially;
  banter loops every turn).
- Impact: While one user generates a show, all other users' requests on that
  worker hang. On a typical single/low-worker uvicorn deploy this reads as
  site-wide freezes under light concurrency.
- Fix: Offload ensure_audio via await asyncio.to_thread(...) or a
  worker/queue; pre-warm off the request path.
- Regression test: Fire two concurrent /recap-show/episode?voice=true
  requests; assert a lightweight /api/ health call returns under a small
  latency bound during generation.

### MEDIUM LIKELY Community picks can be overwritten/impersonated by name
- Location: backend/server.py:1171-1221 (upsert keyed on user_name+game_id),
  :1304-1331 leaderboard
- Trigger: Two users pick the same free-text user_name (max 40 chars, no
  identity binding).
- Defect: Predictions are keyed solely by user_name; there is no
  device_id/auth tie. create_prediction upserts on (user_name, game_id), so
  anyone posting the same name overwrites another person's pick and can
  inflate/alter their leaderboard record.
- Impact: Corruptable community tally (/predictions/games) and leaderboard
  — a core "community edge" product surface. Data integrity, not just
  cosmetic.
- Boundary: Acceptable only if picks are explicitly anonymous/demo; spec
  (COMMUNITY_EDGE_SPEC.md) implies real per-user records.
- Fix: Bind predictions to device_id (as betting/subscription already do)
  and namespace leaderboard by it.
- Regression test: Post two picks with identical user_name from different
  device ids; assert both persist independently.

## Open Questions And Test Gaps
- Testability is thin: the only backend test
  (backend/tests/test_stats_and_ticker.py) is an HTTP smoke suite pointing
  at a hard-coded live preview URL — no unit coverage and unrunnable
  offline. Import-time singletons (db client at server.py:55,
  voice_service._load_saved_voice_choices() at load) make isolated unit
  testing hard. Coverage is PARTIAL.
- /subscription/increment-question gates on used > FREE_QUESTION_LIMIT
  (:1409) while questions_remaining uses limit - used (:1395) — off-by-one
  grants a 4th free question. Confirm intended free count.

## Minor Issues
- [LOW] Monolith/structure: server.py is 1743 lines / 54 routes with no
  APIRouter split, mixing Pydantic models, caching, static mounts, LLM
  streaming, and DB access — high change/test risk (quality-guidelines
  >800-line strong-split trigger). analysts.py (773 lines) mixes 700+
  lines of LLM prompt string literals with mock PLAYERS/TEAMS/GAMES data;
  extract prompts to versioned config and separate the mock dataset.
- [LOW] Vestigial surface: ~half of 36 pages are audition/demo/legacy
  (BrandAudition, TeamRoomAudition, FastReelAudition, DeskPreview,
  GreatestGoalDemo, CanucksUncut, PlayerProfile legacy, HomeV2 vs Home,
  PressConference/classic, ohl/, whl/, plus/ sidecars) still routed in
  App.js:59-107. Core product is RecapShow (/), /show, /tonight/:id,
  /stats, /scoreboard, /predictions→/show, /back-office. Prune the rest.
- [LOW] ruff (0.16.6, ruff check --no-cache, exit 1, 82 findings):
  dead code SKATER_CATS unused (sportradar_client.py:295), 13 unused
  imports, 25 blind/pass/continue excepts (BLE001/S110/S112) that swallow
  errors. Group cleanup.
- [LOW] CORS wildcard with credentials: CORS_ORIGINS="*" (.env) +
  allow_credentials=True (server.py:1732-1737); browsers reject
  credentialed * and it is an over-broad policy. LOW/P3.

## Verdict
Status: READY WITH FIXES
Reason: No confirmed CRITICAL/HIGH, but two MEDIUM defects
(event-loop-blocking TTS, name-keyed picks) plus PARTIAL test coverage
warrant fixes; foundation classification B — useful components, not a
clean complete foundation: keep the provider modules (highlightly_client,
sportradar_client, nhl_data/pbp, voice_service, game_story, live),
MongoDB-backed betting/subscription/assistant flows, and the lint-clean
React core; prune ~40% audition/demo/sidecar pages, split server.py into
routers, extract analysts.py prompts/data, and de-block audio synthesis
before building on it.
```

---

## 29. CLASSIFICATION

# **B — Useful components but not a clean complete foundation.**

### Evidence for the B classification

**In favor of "usable" (why not C):**
- ✅ **Reggie & Marc DNA is deep and mature** — 773-line `analysts.py` prompt system, 60+ camera-cue vocabulary, 15+ situational voice modes per host, 25 spec docs including a full Banter Bible + Cadence & Performance Bible
- ✅ **Provider modules are cleanly abstracted** — `highlightly_client.py`, `nhl_data.py`, `nhl_pbp.py`, `voice_service.py` — copy them as-is into a new chassis
- ✅ **Real integrations working** — Highlightly (as of today), NHL Public API, ElevenLabs, Claude via Emergent LLM Key
- ✅ **Character asset library is real and substantial** — 48 sliced sprites, 4 hero portraits per host, contact-sheet slicing pipeline, expression bank documented
- ✅ **Persistent Reggie companion chat is architected** — Web Speech API wake-word, docked pill, backend state, chat history
- ✅ **327 pre-rendered TTS mp3s + 18 preview clips** — substantial audio content already generated
- ✅ **HomeV2's engagement stack is genuinely differentiated** — UnifiedTopPlays with promotion caps, TenTen daily quiz, WeeklyVotes with 5 tabs
- ✅ **Ticker+ walled-off cascade demonstrates the personalization model** — signal-driven ranker, per-user profile, cross-league discovery
- ✅ **Recap Show is the strongest product surface** — LLM-generated per-game scripts, ElevenLabs audio, split-screen play-by-play with post-game interviews, mobile landscape bleed

**Against "clean" (why not A):**
- ❌ **`server.py` is a 1,743-line monolith** — 54 endpoints, no router split
- ❌ **No canonical data model** — Team/Player/Game are untyped dicts throughout
- ❌ **17 of 37 routes are audition/dev/vestigial** — nearly half the frontend surface is not core product
- ❌ **Duplicate implementations everywhere** — Home vs HomeV2, PlayerDetail vs PlayerProfile, TeamStatPage vs plus/TeamPage, PressConference vs ReggieAssistant, LiveDesk vs TwoHostDesk
- ❌ **MongoDB is underused** — only 4 collections (predictions, bets, subscription, assistant history); everything else in localStorage or in-process
- ❌ **Blocking TTS in async handlers** — MEDIUM correctness defect, affects concurrency
- ❌ **Prediction integrity flaw** — nicknames can be overwritten
- ❌ **No test coverage** — one smoke suite pointing at a live URL
- ❌ **Multiple abandoned art directions** — `_legacy_v1/`, `_realistic_v2_archive/` folders indicate rework churn

---

## 30. WHAT WOULD NEED TO BE REMOVED TO REACH A LEAN MVP

**Target MVP surface:**
Home | Tonight/Scores | Recap | Highlights | Team | Player | Game | Talk

### FRONTEND — REMOVE

**Pages (17 files):**
- `BrandAudition.jsx`
- `CanucksUncut.jsx`
- `DeskPreview.jsx`
- `Fantasy.jsx`
- `FastReelAudition.jsx`
- `GreatestGoalDemo.jsx`
- `Home.jsx` (keep HomeV2)
- `Lineup.jsx` (unless kept as sub-feature)
- `PlayerProfile.jsx` (keep PlayerDetail)
- `PressConference.jsx` (keep ReggieAssistant docked pill)
- `TeamRoomAudition.jsx`
- `VoiceLab.jsx`
- `Voices.jsx`
- `ohl/OhlHome.jsx`
- `whl/WhlRecapSample.jsx`
- `whl/WhlDeskShow.jsx`
- `Recaps.jsx` (archive — unless kept)

**Routes to remove from App.js (13):**
- `/audition/*` (4 routes)
- `/desk-preview`, `/voice-lab`, `/voices`
- `/demo/greatest-goal`, `/uncut/canucks`
- `/fantasy`, `/press-conference/classic`
- `/ohl/*`, `/whl/*`
- `/soon/:slug`
- Redirect stubs: `/predictions`, `/recap`, `/press-conference`, `/ask`

**Components not needed for MVP surface:**
- `BrandAudition`-adjacent components
- `TeamRoomAudition`-related
- Legacy pieces referenced only by removed pages

### BACKEND — REMOVE

**Files (5):**
- `sportradar_client.py` (414 lines) — dead integration
- `crop_asset_library.py`, `design_reggie.py`, `design_voices.py`, `generate_studio.py` — one-time asset generation scripts

**server.py endpoints to remove (~15):**
- `/api/audition/fast-reel`, `/api/audition/play-by-play`
- `/api/live/force-goal`, `/api/live/reset` (dev-only)
- `/api/voice-lab/*` (2 endpoints)
- `/api/betting/*` (4 endpoints — unless keeping betting)
- `/api/subscription/*` (5 endpoints — unless keeping subscription tier)
- `/api/radio/*` (2 endpoints — unless keeping team radio)

### BACKEND — REFACTOR (not remove)

- **Split `server.py`** into `routes/` folder with FastAPI `APIRouter`s: `recap.py`, `tonight.py`, `stats.py`, `assistant.py`, `voices.py`, `predictions.py`, `images.py`, `nhl.py`
- **Extract `analysts.py` prompts** to `/app/backend/prompts/reggie.md` and `/app/backend/prompts/marc.md` (or load from the existing `LANGUAGE_BIBLE.md` / `BANTER_BIBLE.md`)
- **Extract mock data** from `analysts.py` to `/app/backend/mock_data/*.py` (or replace with real DB models)
- **Fix blocking TTS** — wrap `ensure_audio()` calls in `asyncio.to_thread()`
- **Fix prediction integrity** — bind to `device_id` like betting/subscription already do
- **Add Pydantic models** for `Team`, `Player`, `Game`, `Highlight` — the canonical data layer

### ASSETS — REMOVE

- `/app/backend/static/hosts/_legacy_v1/` (4 files)
- `/app/backend/static/hosts/_realistic_v2_archive/` (folders + contents)
- Empty `/app/backend/static/hosts/expressions/marc/`, `reggie/`, `together/` folders (or drop the expected PNGs in — they're referenced by code)

### MEMORY DOCS — KEEP

All 25 memory docs are valuable, especially the new package:
- `BANTER_BIBLE.md`
- `CADENCE_AND_PERFORMANCE.md`
- `CHARACTER_STYLE_GUIDE.md`
- `LANGUAGE_BIBLE.md`
- `THE_TICKER_HANDOFF_PACKAGE.md`
- `PRD.md`, `product_bible.md`
- Spec files (BETTING_IQ, COMMUNITY_EDGE, DAILY_PICKS, PICK10, ROOTS_SEGMENT, HEY_REGGIE, etc.)

---

## 31. REBUILD ESTIMATE

**If keeping this codebase as the foundation:**
- **Remove** — 17 frontend pages, 5 backend files, ~15 endpoints, 2 asset archive folders → **~2 days**
- **Refactor** — server.py router split, analysts.py extraction, fix TTS blocking, fix prediction integrity, add canonical data models → **~5-7 days**
- **Backfill missing** — canonical Team/Player/Game types, Elite Prospects integration (when key arrives), unit tests → **~7-10 days**
- **Total: ~15-20 focused engineering days** to reach a clean, tight MVP shipped from this chassis

**If rebuilding from scratch:**
- Would need to re-integrate: Highlightly, NHL API, ElevenLabs, Claude, 4 sprite libraries, 25 spec docs, character prompt engineering, mobile landscape bleed pattern, Roots weaving, personalization ranker, TenTen quiz, WeeklyVotes, UnifiedTopPlays
- **Estimated: ~30-45 engineering days** to reach parity, minus the character-DNA discovery time (which is now well-documented in memory docs and can be transported)

**Recommendation on this specific codebase:**
The B classification is honest. There is *real* Ticker DNA here — Reggie & Marc's voice canon, the character bibles, the working ElevenLabs stack, the Recap engine, the 327 pre-rendered audio files, the sprite library. Those are hard-won artifacts. But the codebase is carrying ~40% weight it doesn't need for the target MVP surface, and it has two MEDIUM correctness defects that must be fixed before scaling.

**Whether to revive Ticker 1, reskin MARSL, or start clean from selected components depends on how the other two audits come back.** This codebase is a strong "keeper of parts" — if Ticker 1 is cleaner architecturally, this becomes the source for character DNA + character assets + memory docs + provider modules, while Ticker 1 becomes the chassis.

---

## 32. DECISION SUPPORT — QUESTIONS TO ASK OF TICKER 1 & MARSL

To make a clean three-way comparison, verify these against the other two forks:

1. **How many lines is their `server.py` equivalent?** (Baseline: ours is 1,743)
2. **How many total routes vs how many are core product?** (Baseline: ours 37 total, ~13 core)
3. **Do they have canonical `Team`/`Player`/`Game` Pydantic models?** (Baseline: we don't)
4. **How deep is their Reggie & Marc prompt engineering?** (Baseline: 250+ lines of prompts per host in `analysts.py` plus 25 memory docs)
5. **What sprite/portrait library do they have?** (Baseline: 48 sprites + 8 hero portraits + contact-sheet pipeline)
6. **What's their ElevenLabs voice config?** (Baseline: `xlMuE31yicdJYxPOyMin` for Reggie, `pqHfZKP75CvOlQylNhV4` for Marc, 11 candidates in picker)
7. **Do they have working Highlightly integration?** (Baseline: yes, refreshed today)
8. **Do they have persistent chat / wake-word?** (Baseline: yes, Web Speech API + docked pill)
9. **Do they have the Ticker+ personalization cascade?** (Baseline: yes, 15 packages + ranker + walled-off routes)
10. **How much would need to be removed vs added to reach the target MVP surface?**

---

## 33. VERSION LOG

- **v1.0** — Feb 19, 2026. Read-only foundation audit of current Ticker 3 codebase. Includes full code review agent report. Written as one leg of a three-way comparison against Original Ticker Fork and MARSL. **No modifications made to the codebase during this audit.**

*Maintainer's note:* When Original Ticker Fork and MARSL audits arrive
(files `/app/memory/FOUNDATION_AUDIT_TICKER1.md` and
`/app/memory/FOUNDATION_AUDIT_MARSL.md` respectively), lay all three
side-by-side across the ten decision-support questions in Section 32 to
pick the chassis.
