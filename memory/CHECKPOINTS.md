# The Ticker — Development Checkpoints

Plain-English narrative log of major decisions and milestones. Read chronologically to understand *why* the app looks like it does today.

For fast rollback within a session, use Emergent's **Rollback** feature (chat input area). For durable snapshots you can browse forever, use **Save to GitHub** at each milestone below.

---

## 2026-07-29 · Recap Show landing day 🎬

**Milestone:** The Ticker's flagship recap experience is live at `/recap`.

**What shipped:**
- New leftmost nav tab: **Recap** — `Recap · Show · Presser · Stats · Predict`
- `/api/recap-show/episode?date=YYYY-MM-DD` — full episode manifest generator (`recap_show.py`)
- `/api/recap-show/line-audio` — on-demand ElevenLabs host audio per beat (Reggie & Marc voiced captions)
- `RecapShow.jsx` — full-frame show player with beat-by-beat state machine:
  - Cold open (Reggie + Marc welcome)
  - Per-game segments: host hook → clip → host outro → next
  - Close (Marc + Reggie sign-off)
- Segment progress rail at the bottom with real Highlightly team logos (Blue Jackets, Flyers, Blackhawks, Canadiens, etc.)
- April 12, 2025 chosen as the demo date — 8 wildcard-race games, all embeddable YouTube clips
- Existing Recaps browse gallery preserved at `/recaps-archive` — nothing thrown away
- Recap route added to LiveDesk QUIET_ROUTES so the persistent audio pauses (no competing shows)

**What's next:**
- Real end-to-end audio playback test with sound on (browser will need user interaction to unlock)
- Optional LLM-scripted per-game commentary (currently templated hooks — good enough for MVP, richer with Claude later)
- Sportradar Imagn still pending activation (Highlightly logos are covering us for now)
- Score/box-score data overlay per clip (Sportradar box scores exist, not yet folded into segments)

**Recommended savepoint:** "Save to GitHub" — call it `"Recap Show live · Apr 12 2025 demo"`

---

## 2026-07-29 · Logos + Videos + Recap Show baseline

**Status:** milestone commit — recommended "Save to GitHub" point.

**What's true at this moment:**
- Highlightly Pro live ($7.99/mo) — real NHL clips + team logos flowing
- Recaps page shows real playoff highlights (YouTube embeds + ESPN link-outs)
- 32 team logos rendering in the logo-vs-logo picker
- Persistent audio: broadcast keeps playing when navigating to Stats/Predict/Recaps
- Presser + Back Office auto-pause the show (no competing audio)
- Launch Zone banner: "Founding Member Zone — free launch window, we'll tell you before paid flips on"
- "We study you" positioning line live on Home Deep Dive tile + Launch Zone Details
- Nav: `Show · Presser · Stats · Predict · Recaps`
- Predictions page: pick-vs-panel with Reggie/Marc takes, community vote, streak-vs-panel
- Sportradar Imagn still blocked at 403 — Highlightly logos are the workaround

**What we're about to build next:**
- **Recap Show** — SportsCenter-style morning show for Apr 12, 2025 (wildcard crunch)
- New leftmost nav tab: `Recap`
- Existing Recaps browse gallery folds into a "Browse other days" section on the new Recap page
- Format: cold open → per-game (host intro → clip → host outro) → close

**User's operating rule at this moment:** "Nobody will know the difference" — meaning: skip games without embeddable clips, don't build fallback UI for that edge case. Regular-season nights have full coverage anyway.

---
