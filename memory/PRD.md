# The Ticker — PRD (Product Requirements Document)

## Original Vision
An AI-powered sports television network MVP focused on NHL hockey. A two-host
panel (Reggie Banks + Marc Collins) delivers a continuous, TV-quality broadcast
with real NHL data, distinct personalities, ElevenLabs-voiced audio, and a
podcast-like cadence. Users can also 1-on-1 press-conference the hosts,
manage a fantasy back-office, and browse NHL-style stats.

## Architecture (locked)
- **Home** (`/`) — Passive broadcast: continuous 15-min flow through topics, tap ticker to jump.
- **Presser** (`/press-conference`) — 1-on-1 deep dives, 3 free questions then soft "Founding Member" nudge (paywall OFF for MVP).
- **Stats** (`/stats`) — Public NHL.com-style leaders / standings / schedule.
- **Fantasy** (`/fantasy`) — Roster editor, favorite teams, decision-insights, DK/Sleeper/Yahoo/ESPN affiliate rail.
- **Login** (`/login`) — Placeholder + notify-me email + device-based activation.
- (Legacy) Voices `/voices`, VoiceLab `/voice-lab`, Predictions `/predictions` still live but off-nav.

## What's Implemented (as of Feb 2026)
### Core Broadcast
- Wide Fox-Sports-style CSS studio with two-host split, monitor wall, THE TICKER desk logo
- ElevenLabs custom Voice Design for Reggie + Marc (cast via /voices)
- Two-lane ticker: ON THE SHOW (clickable topics) + LIVE NHL (SportsData.io headlines)
- Auto-flow: end of one topic → next topic (continuous 15-min feel)
- Tap-to-Join overlay (bypasses browser autoplay)
- Pause / Sound-on / Sound-off controls
- Minimal in-frame speaker badge (no more chunky "ON MIC" lower-third)
- Ping-pong audio scheduler with preload + aggressive negative overlap (default 400 ms)
- Pace cue map: cutoff/-700, quick/-500, relaxed/-400, beat/60, land/180, breath/320 ms
- **Backend ffmpeg silence-trim pipeline** on all new ElevenLabs clips (silenceremove, -40 dB, 50 ms window)

### Press Conference
- Renamed `/ask` → `/press-conference` (302 redirect kept)
- 3-free deep-dive counter per device (localStorage id)
- Soft upgrade modal + Founding Member sidebar CTA
- Mock activation (`POST /subscription/activate` — real Stripe deferred)

### Stats (public, NHL-style)
- Skaters leaders table (G/A/P/+//TOI)
- Goalies leaders (SV%/GAA/W-L)
- Standings (PTS/GF/GA/DIFF)
- Tonight's schedule (SportsData.io games)

### Fantasy Desk (foundation)
- League name + scoring type + 6-row roster editor + favorite-teams chips + notes
- Decision Insights panel (heuristic today; AI-driven with Founding Member later)
- **Affiliate rail**: DraftKings, Sleeper, Yahoo Fantasy, ESPN Fantasy (placeholder links + sponsored tag)
- Founding Member activation button
- Roster persists in Mongo (`db.rosters`, keyed by device_id)

### Backend
- FastAPI on 8001 (`/api/*` routed via ingress)
- Endpoints: `/banter`, `/topics`, `/ticker`, `/nhl/*`, `/stats/*`, `/ask/stream`, `/voices/*`, `/predictions/*`, `/subscription/*`
- MongoDB collections: `qa_log`, `predictions`, `subscribers`, `rosters`
- 3rd-party: ElevenLabs (TTS), SportsData.io (NHL), Emergent LLM Key (Claude Sonnet 4.5)

## Known Blockers (as of last change)
- **P0 – ElevenLabs credits exhausted.** New audio can't be generated. Audio cache was cleared to force regeneration through the new silence-trim pipeline; user must top up ElevenLabs credits before broadcast audio plays again. All code is in place; audio will auto-populate on first `/api/banter` hit once credits refresh.

## Backlog / P1
- Voice Input on Presser (Web Speech API + Whisper fallback via Emergent LLM Key)
- Real Stripe subscription plumbing ($3.99/mo Founding Member)
- Free NHL Stats API integration (`api-web.nhle.com`) for player-level analytics
- Better decision-insight AI engine (currently heuristic)

## Backlog / P2
- Additional hosts (Tank, Lou, Cody)
- Community forums, user profiles, prediction tracking
- Real fantasy platform sync (Sleeper API first, then Yahoo/ESPN OAuth)
- Push notifications for anomaly flags

## Backlog / P3
- 3D/video character avatars (explicitly deferred to protect $400 budget)

## Change Log
- **2026-02** — 2-page → 5-page nav; ticker eats topic bubbles; continuous flow; tighter audio scheduler; silence-trim; subscription foundation; Stats + Fantasy pages; DK/Sleeper affiliate rail
- **Earlier** — Studio UI, Tap-to-Join, cold opens, ElevenLabs voice casting, SportsData.io ticker, pace cues
