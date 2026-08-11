# READ THIS FIRST — Handoff Index for the Next Fork

**Written:** Feb 2026
**Purpose:** Tell you what to read, in what order, so you can pick up
The Ticker and understand Reggie & Marc in ~30 minutes without
guessing.

---

## The Reggie & Marc doc stack (READ IN THIS ORDER)

1. **`BANTER_BIBLE.md`** — The characters, their chemistry, sample
   exchanges, chirp ladder, segment playbook, LLM prompt boilerplate.
   *If you only read one doc, read this one.*

2. **`CADENCE_AND_PERFORMANCE.md`** — The performance layer. WPM
   targets, pause lexicon, interruption model, emotional register
   scale, laugh policy, generator JSON output format. *Read this
   before touching any TTS or generation code.*

3. **`CHARACTER_STYLE_GUIDE.md`** — Visual identity + the full
   Reggie/Marc quote banks. *Reference doc — don't memorize.*

4. **`LANGUAGE_BIBLE.md`** — The comedy category catalogue and the
   central chirp/roast rule. **Note:** Sections 5-F through 9 are
   still TBD (user paste ended mid-Section 5-E). When those arrive,
   cross-check against `BANTER_BIBLE.md` and reconcile.

5. **`ROOTS_SEGMENT_SPEC.md`** — Read only if you're touching
   junior/CHL/NCAA content or the hometown/bloodline personalization.

6. **`HEY_REGGIE_SPEC.md`** — Read only if you're touching the
   companion chat or wake-word features.

7. **`product_bible.md`** — Global product tone. Read once for
   context.

---

## The build task waiting for you

The user wants **Reggie & Marc banter running on Recap and Tonight
for a demo tomorrow**. The docs above specify exactly how it should
sound. The build steps (per the user's ask — main agent did NOT
write this code, this is intentional handoff):

1. **Update `/app/backend/pregame_show.py`** so its Claude prompt
   emits the per-beat JSON format defined in
   `CADENCE_AND_PERFORMANCE.md` Section 9 (speaker, text, wpm,
   register, pre_pause_ms, post_pause_ms, voice_settings,
   interruption, chyron).

2. **Update `/app/backend/recap_show.py`** the same way.

3. **Update `/app/backend/voice_service.py`** so it honors the new
   fields:
   - `<break time="Xms"/>` tags for pauses
   - ElevenLabs voice_settings per register (stability/style from the
     CADENCE doc's tables)
   - Overlap scheduling for interruptions (Type A/B/C/D from Section 4)
   - Chyron markers passed through to the frontend

4. **Update the frontend banter player** (probably in the Tonight and
   Recap components) so it plays beat sequences with correct ducking,
   overlaps, and chyron sync.

5. **Test with `testing_agent_v3_fork`** — end-to-end flow: user
   opens Tonight, hears pre-game banter that sounds like a broadcast;
   opens Recap, hears highlight banter with proper cadence.

---

## The unverified change from the previous session

**`/app/frontend/src/pages/HomeV2.jsx`** was refactored to render the
user's favorite NHL team dynamically instead of the hardcoded MTL
shell. The screenshot tool timed out before the change could be
visually verified. **First thing to do in the next session:** run a
screenshot or the testing agent on `/home-v2` for a non-MTL user and
confirm the hero banner shows the correct team colors, name, and logo.
If it crashes, that's your P0 before anything else.

---

## The strategic decisions the user made this session

- **Sportradar / Sportlogiq at launch:** YES, needed. User's
  instinct is right — broadcast positioning requires
  best-in-class real-time data at launch. Main agent's recommendation
  is **Sportlogiq over Sportradar** (Canadian-built, hockey-first, 30
  of 32 NHL teams use them, feeds Marc's analytical persona
  perfectly). Elite Prospects covers the Roots/junior/bloodline data.
  Both are needed. Not either/or.

- **Demo strategy:** Ship a basic doc-only package this session
  (this is that package). Next fork wires the code. User priorities
  ordered by importance: cadence → timing → pause rate →
  interruption → emotion.

- **Language:** English only for the demo. French/Québécois deferred
  (needs authentic rewrite, not translation).

---

## Blocked items — do not try to solve these

- **Elite Prospects API key** — user is negotiating with EP sales.
  Do not try alternative junior stats providers. Keep
  `tickerCatalog.js` mocks in place until the key arrives.
- **Sportradar 403 trial key** — 8 recurring failures. Do not
  retry. User is deciding between Sportradar and Sportlogiq.
- **French/Québécois translation** — awaiting human writer input.
  Do not auto-translate `LANGUAGE_BIBLE.md`.

---

## What "good" looks like when you're done

A user opens the Tonight page tomorrow, taps a matchup, and hears:
- Reggie opening at ~180 WPM, warm and alive
- Marc following at ~150 WPM with a data point, after a ~500 ms
  breath pause
- One natural interruption in the 45-second beat
- A dramatic pause after the punchline
- Chyron graphics syncing to Reggie's key lines
- The whole thing feeling like a broadcast, not a podcast, not a
  robot

If it sounds like ESPN highlights with two guys who like each other,
you nailed it.

Good luck. — The previous main agent.
