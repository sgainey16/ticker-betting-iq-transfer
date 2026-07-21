# THE TICKER — Product Requirements (Living Doc)

## Original problem statement (excerpt)
An AI-powered hockey analyst panel — four distinct AI personalities delivering
fantasy hockey insight, stats, banter, and predictions the way a real sports
desk would. V1 scope: NHL only.

## User personas
- **Fantasy hockey manager** — needs fast, opinionated takes on players and matchups.
- **Casual NHL fan** — wants entertaining commentary + basic stats, not a spreadsheet.
- **Prediction-first user** — comes to make picks and build a public record.

## Core requirements (static)
- Four distinct AI analysts (Doyle, Lindqvist, Kovalenko, Marchetti) with
  hard-constrained voice + visual identity (see problem statement §6).
- Broadcast aesthetic: dark charcoal, brushed-steel borders, signature accent
  color per analyst, live-feeling ticker.
- In-character microcopy everywhere (loading, error, empty).
- Free vs. premium gating (deferred to Phase 2).

## Architecture
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + react-fast-marquee.
- Backend: FastAPI + Motor (MongoDB) + emergentintegrations (Claude Sonnet 4.5).
- SSE streaming for the Ask Analyst answer flow (`POST /api/ask/stream`).
- Mock NHL data (players, teams, games, ticker headlines) in `backend/analysts.py`.

## Phase 1 — Aha moment (built 2026-02, updated 2026-02)
- Home page **is the live desk**: cropped-clean broadcast photo of all four
  analysts, continuous ticker strip on top, live captions typing out
  **synced to real ElevenLabs voice audio** (4 distinct pre-made voices — Adam
  for Doyle, Josh for Numbers, Clyde for Kovalenko, Charlie for Marchetti).
- Topic tabs steer the panel: `League Wide` · `Trade Deadline` · `Playoff Race`
  · `Hot Takes` · `Leafs` · `Oilers` · `Rangers`. Click one, panel loads a
  fresh script and starts talking.
- Web Audio API broadcast stinger plays on topic changes for that "on air" hit.
- Reactions/laughs (`Ha!`, `Heh.`, `Ha ha.`) baked into scripts as short lines
  each analyst voices in-character — they laugh at each other's jokes.
- "Turn on sound" gate respects browser autoplay policy; mute toggle available.
- Audio pre-generated to disk (55 mp3s cached), served under `/api/audio/*`
  so Kubernetes ingress routes it correctly.
- "Ask the panel" input → LLM-generated in-character reply + spoken audio in
  the responding analyst's voice.
- Ask Our Analyst Anything screen (pick analyst → SSE streaming Claude Sonnet
  4.5 answer + stat card).
- Predictions dashboard (make picks, one-line reasoning, personal accuracy +
  streak, public leaderboard, admin "simulate results" fallback per spec §7).
  **Betting lines removed** — spec §2 excludes gambling for V1.
- **Auth is intentionally skipped for Phase 1** — display name in localStorage.

## Deferred to Phase 2 (backlog)
- P0: Full auth (JWT), onboarding (favorite team → players → home tabs).
- P0: Stripe test-mode paywall + free/premium gating on all screens.
- P1: Stats browser screen (player/team detail with AI insight line).
- P1: Community feed prototype (reactions, comments on picks).
- P1: Profile & Preferences screen (notifications, home-tab selection).
- P2: Admin area (user mgmt, content moderation, prediction verification UI).
- P2: Real NHL stats + results feed integration.
- P2: Nano Banana avatar regeneration to hit character-file constraints
      (Kovalenko biggest, Doyle stubble, etc.) — currently using stock photos
      because Emergent Universal Key balance is $0.

## Known blockers
- **EMERGENT_LLM_KEY balance is $0** — Ask Analyst streaming returns a friendly
  in-app error until the user tops up under Profile → Universal Key → Add Balance.
  Everything else on the app works without an LLM call.
