# The Ticker — PRD (Product Requirements Document)

## Vision
AI-powered NHL broadcast MVP with a two-host panel (Reggie Banks + Marc
Collins). TV-quality feel, real NHL data, ElevenLabs-voiced audio,
podcast-cadence banter, 1-on-1 press-conference deep dives, personal
fantasy back-office, subscription foundation with affiliate rails.

## Architecture (locked)
- **Home** (`/`) — Continuous broadcast, auto-advances through topics, tap ticker to jump.
- **Presser** (`/press-conference`) — 1-on-1 deep dives + 3-free-question soft nudge.
- **Stats** (`/stats`) — Public NHL.com-style leaders / standings / schedule.
- **Fantasy** (`/fantasy`) — Roster editor + AI insights + DK/Sleeper/Yahoo/ESPN affiliate rail.
- **Login** (`/login`) — Notify-me + Founding Member activation stub.
- **Desk preview** (`/desk-preview`) — Hidden dev QA page for all camera shots.

## Character Style — LOCKED to hero art
- Canonical: `reggie_hero_crop.png` + `marc_hero_crop.png` (painterly Pixar-adjacent 3D)
- Full style guide at `/app/memory/CHARACTER_STYLE_GUIDE.md` — hand to ChatGPT for future expression sheets
- Archives: `_legacy_v1/` (older cartoon), `_realistic_v2_archive/` (off-style contact sheets)

## Shipped this session
- ON MIC banner removed → minimal in-frame speaker badge
- Show topics moved into ticker as clickable scrolling lane
- Top nav: Broadcast · Presser · Fantasy · Stats · Login
- LiveDesk audio scheduler v3: two-audio ping-pong + preload + 400ms default overlap + tighter pace cues (breath 320, land 180, beat 60)
- FFmpeg silence-trim on all new ElevenLabs clips
- Continuous flow: end of one topic auto-advances to next
- Stats page — NHL-style skater/goalie leaders, standings, schedule
- Fantasy page — league name + scoring + 6-row roster + favorite teams + notes + heuristic insights + affiliate rail
- Subscription foundation (mock) — device-based counter, upgrade modal, activation endpoint, roster persistence in Mongo
- "Jump in — ask the desk" removed from Home; Presser only
- Hero portraits + composed studio unified to canonical style
- Contact-sheet slicer script (`scripts/slice_contact_sheet.py`) for future updates
- Character style guide document created

## Known Blockers
- **Recurring**: ElevenLabs credits burn on any regeneration. Cache is respected on replay; new lines only cost when generated fresh. Verify credits are on the workspace whose key sits in `/app/backend/.env`.

## Priority for tomorrow
1. **P0 — Podcast structure refinement**: Crisper timing/delivery. Banter jabs at open + close of each segment; one host carries the meat of the middle with the other doing short reactions only ("Hmm", "Wow", "C'mon").
2. **P0 — Expand shot cueing in `analysts.py`**: Use the richer camera roster (`two_arguing`, `two_hot_take_clash`, `two_punchline`, `two_signoff`) once expression sheets are re-shot in hero style.
3. **P1 — Voice Input on Presser**: Web Speech API default + Whisper fallback via Emergent LLM Key.
4. **P1 — Real Stripe subscription plumbing** ($3.99/mo Founding Member) with paywall OFF until launch.
5. **P1 — Free NHL Stats API** (`api-web.nhle.com`) for player-level analytics.
6. **P2 — Fantasy AI engine**: Replace heuristic insights with real Claude-driven start-sit calls from saved roster.
7. **P2 — Cost safety net**: Daily character-budget alarm on ElevenLabs; fall back to captions past a threshold. **✅ DONE 2026-02-25** — 20k chars/day cap, `/api/tts/budget` endpoint, tunable via `ELEVENLABS_DAILY_CHAR_LIMIT`.

## Backlog
- Additional hosts (Tank, Lou, Cody) — deferred
- Community forums, prediction tracking — deferred
- Real fantasy platform sync (Sleeper → Yahoo → ESPN OAuth) — deferred
- Push notifications for anomaly flags — deferred
- 3D/video avatars — deferred (budget protection)

## Change Log
- **2026-02-25** — Reggie Banks voice canon fully expanded — 12 categories baked into `system_prompt` (signature calls · player philosophy · vet takes · lazy play calls · praising · roasting Marc · agreeing with Marc · emotional/kids core · ex-player insider · trade/GM takes · situational Reggieisms · signoffs); `/app/memory/CHARACTER_STYLE_GUIDE.md` § 6 added. Marc canon extended with 5 new situational categories (close games · records · young players · standings-lie · momentum shifts). Live smoke test confirmed both hosts speaking authentically in-character.
- **2026-02-25** — Back Office page shipped at `/back-office` — 6 tabs (Picks · Edge Score · Fantasy · Social · Preferences · Membership); Presser locked to 3-section layout with sticky sub-nav (Deep Dive · Analytics · Games); "Deep Dive Analytics" section renamed to "Analytics"
- **2026-02-25** — Marc Collins voice canon locked in (patient, curious, wise — the audience-smartener); expanded `system_prompt` in `analysts.py`, added full Marcism quote bank to `CHARACTER_STYLE_GUIDE.md`, updated tagline + loading lines + fallback replies; daily ElevenLabs character-budget alarm live at `/api/tts/budget` (75k chars/day, ELEVENLABS_API_KEY refreshed, audio pipeline verified end-to-end)
- **2026-02-24** — Character style locked to hero art; contact-sheet slicing pipeline; style guide document
- **2026-02-24** — 5-page nav, topics-in-ticker, subscription foundation, Stats + Fantasy pages, DK/Sleeper affiliate rail, tighter audio scheduler, silence-trim
- **Earlier** — Studio UI, Tap-to-Join, cold opens, ElevenLabs voice casting, SportsData.io ticker
