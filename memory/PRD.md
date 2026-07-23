# The Ticker — Product Requirements

## Concept
AI-powered hockey television network MVP. Feels like a premium live TV
broadcast (not a chatbot): natural two-host conversations, deep stats/
analytics, predictions, and an interactive "toss it in" Q&A that the panel
answers on air.

## Phase 1 MVP — Two-Host Panel (Locked)
- **Reggie Banks** — Lead Anchor, retired NHL player. Emotional core.
  "Do the right things. Then execute." Blue accent (#1E5DFF).
- **Marc** — 60, Analytics Co-Host. Calm, measured, "let's look at the
  numbers." Cyan accent (#00E5FF).
- Every banter script carries `speaker`, `text`, and a `shot` cue
  (production-language camera cut). Optional `interrupt: true` triggers a
  hard cut-in overlap.
- Silent listening shots infer automatically from speaker.
- Zero-gap audio scheduler with 500-1100ms overlaps preserved (pre-existing
  invariant — do not break).

## Character Bibles (source of truth)
Kept verbatim in `/app/memory/` conversation history:
- Reggie Banks v1.0 — puck moves faster, support wins, hockey keeps receipts
- Marc v1.0 — good data + good instincts, context matters, respectful challenge

## Architecture
- **Backend**: FastAPI (`server.py`), Motor/MongoDB. Character system in
  `analysts.py`. ElevenLabs TTS pipeline in `voice_service.py`. Static
  sprite library served from `/api/sprites/*`.
- **Frontend**: React + Tailwind + Shadcn UI. Core components:
  - `LiveDesk.jsx` — orchestrates banter playback, shot cuts, quick reply
  - `TwoHostDesk.jsx` — renders current shot with 480ms cross-fade
  - `AnalystAvatar.jsx` — portrait avatar sourced from `/api/sprites/*`
- **Sprite library**: 46 cropped shots from user's Phase-1 Asset Library
  sheet, upscaled 3× via PIL LANCZOS. Rebuild: `python3 crop_asset_library.py`.

## What's Implemented (2026-02-23)
- ✅ Two-host banter system (Reggie + Marc) — 6 topics, 20-turn opener
- ✅ 46-shot camera state machine sourced from the Phase-1 sprite sheet
- ✅ Sprite cropper (`crop_asset_library.py`) + `/api/sprites` static route
- ✅ Overlapping audio scheduler (500-1100ms overlap) preserved
- ✅ Ask-the-panel Q&A (Claude Sonnet 4.5 via Emergent LLM Key) — two hosts
- ✅ Predictions module + leaderboard
- ✅ Voice Lab UI (legacy — needs a small refresh for the 2-host lineup)

## Known blockers / status
- **ElevenLabs quota exhausted** (21 credits left on "The ticker 2" key).
  User is working on voices separately. Audio will backfill automatically
  once the key is topped up — no code changes required.

## P1 Backlog
- **Interactive Q&A ("switching gears")** — user's question interrupts the
  current banter; panel closes the current thought then answers.
- **Stats & Analytics pages** — clickable power play, roster, standings.
- **Predictions upgrade** — driving-factor commentary per matchup.
- **Marc's own voice** — pick candidate via Voice Lab once ElevenLabs
  quota returns.
- **Voice Lab refresh** — regenerate 3 voice-design candidates for Marc,
  drop Doyle/Numbers/Dozer/Ace UI.

## P2 Backlog
- Expand asset library toward 150-250 shots per host.
- City-specific hosts (Boston, Chicago, Quebec, Alberta) + Muzzy Mike.
- Marc's own expression sprite sheet (like Reggie's).

## Third-party integrations
- **Claude Sonnet 4.5** via Emergent LLM Key (Ask + quick-reply banter)
- **ElevenLabs** — pre-generated + disk-cached TTS
  (`/app/backend/static/audio/*.mp3`)
