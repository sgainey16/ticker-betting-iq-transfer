# THE TICKER — PRD

## Concept
AI Sports Network (not an app, not a chatbot). Every fan walks into their own
studio where Reggie Banks + Marc Collins are already talking. Phase 1 = NHL
hockey. Success = fans wonder "*what does Reggie think about that trade?*"

Canonical bibles: `/app/memory/product_bible.md` (v1.0 — full network vision),
`/app/memory/bible_notes_v0.md` (earlier notes, superseded where they conflict).

## Locked Phase 1 direction
- **Reggie Banks** — Chicago, blue collar, master chirper. Main host.
- **Marc Collins** — 60, calming presence, still enjoys the fun. Analytics
  co-host. Support voice.
- **No names anywhere in the UI** — users learn them through the banter,
  the way you learn TV hosts.
- **Wide studio two-shot** (Fox Sports 1 vibe) — both hosts visible on
  first load, monitor-wall backdrop, lit desk edge, THE TICKER on desk front.
- Intimate press-conference hero shots are reserved for the Ask / 1-on-1
  Press Conference feature (Phase 2 preview).

## What's live (2026-02-23)
- ✅ Two-host banter engine: 6 topic scripts, real cross-talk, interrupts
- ✅ ElevenLabs TTS working — 58 lines cached across all topics
- ✅ Wide 22:10 CSS studio: monitor-wall backdrop, lit desk edge, THE TICKER
  wordmark on desk front, ambient blue/cyan side glow
- ✅ Signature 2-second broadcast sting (`/app/frontend/src/lib/sting.js`) —
  fires on first audio unlock + on every topic switch
- ✅ Voice Picker at `/voices` — 6 candidates for Reggie, 5 for Marc,
  in-character preview clip per candidate, tap "Use this voice" to swap live
- ✅ Names removed from Home, Ask Analyst, Voices, lower-third
- ✅ Nav shows THE TICKER · SPORTS NETWORK (no "AI · HOCKEY DESK")
- ✅ Character portraits + hero images saved at `/api/hosts/*`
- ✅ Backend: /api/banter, /api/voices/picker, /api/voices/set-active,
  /api/voices/preview, /api/hosts static, /api/sprites static
- ✅ Reggie hometown updated to Chicago in bible

## Currently blocked / waiting on user
- **Voice audition** — user has one Voice Design draft plugged in as
  Reggie candidate #1 (`QFNlGyAI98kVm40cB3ik`). Waiting for user to audition
  the roster and lock final picks.
- **Real NHL data (SportsData.io + NHL Stats API)** — not started; user
  agreed panel-polish comes first, then real data.
- **Character bibles v2** — user planning to expand personas; current
  bibles are the working prompts (calming Marc, feisty Reggie).

## P1 backlog (after voice lock-in)
- Real NHL data pipeline (SportsData.io + NHL Stats API)
- Fantasy Assistant lite (start/sit Q&A with roster context)
- Betting Insights lite (xG, rest days, back-to-backs)
- Press Conference / Ask flow polish (uses intimate hero shots)
- Subscription-ready Stripe plumbing (gated features, free during MVP)

## P2 backlog
- Tank / Lou / Cody characters (rotating roster)
- Community forums, user profiles, following
- Prize / games / trivia layer
- Multi-sport, real-time highlights, VR
- 20+ expression sprites per host

## Third-party integrations
- **Claude Sonnet 4.5** via Emergent LLM Key — Ask + quick-reply banter
- **ElevenLabs** — TTS, disk-cached at `/app/backend/static/audio/*.mp3`.
  API key is restricted (TTS-only scope) — voice list not readable, but
  generation works fine.

## Key files
- `frontend/src/components/TwoHostDesk.jsx` — studio scene
- `frontend/src/components/LiveDesk.jsx` — banter engine + audio scheduler
- `frontend/src/lib/sting.js` — signature broadcast sting
- `frontend/src/pages/Voices.jsx` — voice picker
- `backend/analysts.py` — character bibles + banter scripts
- `backend/voice_picker.py` — candidate voice roster
- `backend/voice_service.py` — TTS + cache
