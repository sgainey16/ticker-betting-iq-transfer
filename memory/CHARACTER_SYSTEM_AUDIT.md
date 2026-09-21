# CHARACTER SYSTEM AUDIT — THIS APP (Hockey IQ / Betting IQ fork)

**Scope.** Read-only recovery. No file was edited or moved.
**Search coverage.** Filenames + full-text across `backend/`, `frontend/src/`, `memory/`, JSON configs, ElevenLabs voice manifests, portrait assets. No `.git` history mining available in this fork.

---

## A. CHARACTER INVENTORY TABLE

| Name (as-shipped) | Aliases / prior names found | Status in this app | Voice status | Portrait status | Bible depth |
|---|---|---|---|---|---|
| **Reggie Banks** | *"JT"* (per `bible_notes_v0.md` §3 — prior lead anchor name, deprecated) | **COMPLETE + ACTIVE** — lead anchor everywhere (Recap, Home, Tonight, GameHub, MyIQCommandCenter) | ✅ Custom uploaded voice (`xlMuE31yicdJYxPOyMin`) — cool + confident + excited + sportscaster swagger. 3 Voice Design drafts archived. | ✅ 5 hero moods (`warm/celebrate/laughing/skeptical/surprised`) at `/frontend/public/hosts/reggie/` | **RICHEST HERE** — full system prompt (~4KB), Banter Bible + Language Bible + Character Style Guide + `bible_notes_v0.md` §3 |
| **Marc Collins** | *"Marc Doyle"* (in `hostImages.js` HOST_NAMES — inconsistency vs `analysts.py` "Marc Collins") | **COMPLETE + ACTIVE** — analytics co-host, permanent partner to Reggie | ⚠ Placeholder pre-made voice "Bill" (`pqHfZKP75CvOlQylNhV4`) — mature, warm, awaiting custom upload. Multiple candidate voice previews recorded. | ✅ 5 hero moods (`warm/smile/explaining/excited/neutral`) at `/frontend/public/hosts/marc/` | **RICHEST HERE** — full system prompt (~4KB), Banter Bible + Language Bible + `bible_notes_v0.md` §3 |
| **"Doyle"** *(Liam "Lucky" Doyle)* | Irish-American Boston anchor — the earlier 4-host launch cast | **PLACEHOLDER / ARCHIVED** — Voice Design briefs + 3 mp3 previews only. No system prompt. Not wired into any UI. | ✅ Voice Design ID `LSCwn9kS2iiBOqBoYQB4` (preview #3 chosen). Detailed voice-brief text preserved in `design_voices.py` | ❌ None | Voice brief only |
| **"Numbers"** *(Erik "Numbers" Lindqvist)* | Minnesota Scandinavian analytics co-host | **PLACEHOLDER / ARCHIVED** — voice design only. `bible_notes_v0.md` §3 explicitly rules him out as "weakest/most boring character" | ✅ Voice Design ID `JVfspUVvbZORRlJCUaNp` (preview #3). Full voice brief in `design_voices.py` | ❌ None | Voice brief only |
| **"Dozer"** *(Danylo "Dozer" Kovalenko / later "Dozer DeLuca")* | Cleveland blue-collar enforcer / heart-and-soul. `bible_notes_v0.md` records the surname migration Kovalenko → DeLuca. | **PLACEHOLDER / ARCHIVED** — voice design only. No system prompt. Not wired into any UI. | ✅ Voice Design ID `qm0LIHvBaL5XhqKcnozC` (preview #3). Full voice brief in `design_voices.py` | ❌ None | Voice brief only |
| **"Ace"** *(Anthony "Ace" Marchetti)* | Rhode Island Italian-American wildcard | **PLACEHOLDER / ARCHIVED** — voice design only | ✅ Voice Design ID `5uSBiecvz1GMSIyYpD2S` (preview #3). Full voice brief in `design_voices.py` | ❌ None | Voice brief only |

### Not present in this app at all

Searched with aliases. Zero hits.

- AJ / AJ Sandhu / Arjun Sandhu
- Talia Cardinal
- Sofia / Sophie / Sophie Marchand (the only "Marchand" hits are Brad Marchand the NHL player)
- Jake Callahan / Jake Anderson (the only "Anderson" hits are line-combo player names)
- Claire Donovan / Claire Murphy
- Mateo Reyes / Rayo / "Nikki Redline Reyes" (only mentioned once in `bible_notes_v0.md` as a "bench character for later rotation" — F1 driver concept, not built)
- Casey Whitfield
- Hanna / Hana
- Lena Meyer
- Matthias / Mathias Keller
- Sanna Lehtinen
- Lars Nyström

Also mentioned in `bible_notes_v0.md` §3 as **explicitly deferred / not-in-MVP**: "Muzzy Mike," a Boston host, a Chicago host, a Quebec host, an Alberta host, a laughing older mustached man, a young enthusiastic guy, a glasses/tweed analytics-book guy, a calm morning host ("Sam Elliott / James Earl Jones / Bobby Hull vibe" for NFL), Nikki "Redline" Reyes, and city-based superfan field-correspondent avatars. **None built here.**

---

## B. EXACT FILE PATHS

### B.1 Master character material (bring these verbatim)

| Purpose | Path | Depth |
|---|---|---|
| **Reggie + Marc system prompts** (LLM personality) | `/app/backend/analysts.py` (lines 10–229) | Full — ~4KB per host, catchphrase banks, situational reggieisms/marcisms, tone modes (LIGHT-AND-FUN vs TECHNICAL) |
| **Banter Bible** — pair chemistry rules | `/app/memory/BANTER_BIBLE.md` (690 lines) | Full — "the fast-onboarding manual for any AI agent that needs to write dialogue between Reggie and Marc" |
| **Language Bible** — comedy rules, chirp vs roast distinction, category catalogue | `/app/memory/LANGUAGE_BIBLE.md` (464 lines) | Marked PARTIAL — "user paste ends mid-Section 5-E, Sections F onward are TBD" |
| **Character Style Guide** — visual identity + generation prompts + full quote banks | `/app/memory/CHARACTER_STYLE_GUIDE.md` (447 lines) | Full |
| **Compiled Product Bible v0** — 4-host roster history, aliases, recurring segments | `/app/memory/bible_notes_v0.md` (159 lines) | Full |
| **Banter Bible companion docs referenced but not present in this fork** | `ROOTS_SEGMENT_SPEC.md`, `HEY_REGGIE_SPEC.md` | Missing — worth asking other forks |
| **Product Bible (global tone)** | `/app/memory/product_bible.md` (253 lines) | Full |

### B.2 Voice configuration

| Purpose | Path |
|---|---|
| **Active runtime voice registry** (Reggie + Marc IDs + settings) | `/app/backend/voice_service.py` (lines 30–43) |
| **Persistent voice-choice overrides** | `/app/backend/static/audio/voice_choices.json` |
| **Archive of every Reggie/Marc profile ever configured** (with why-changed notes) | `/app/backend/voice_profiles.json` |
| **Voice-picker candidate pool** (10 pre-made ElevenLabs candidates per host + user's Voice Design drafts) | `/app/backend/voice_picker.py` |
| **Voice Design briefs for the archived 4-host cast** (Doyle, Numbers, Dozer, Ace) | `/app/backend/design_voices.py` (lines 18–86) |
| **Reggie Voice Design script** (3 preview generator) | `/app/backend/design_reggie.py` |
| **Preview mp3 manifest** (voice_name → 3 preview mp3s per character) | `/app/backend/static/audio/previews/manifest.json` |
| **Model + budget guardrails** — `eleven_multilingual_v2`, 20K char/day default cap | `/app/backend/voice_service.py` (lines 45, 89–90) |

### B.3 Portrait / imagery

| Purpose | Path |
|---|---|
| **Portrait mood mapping + per-route mood pick** | `/app/frontend/src/lib/hostImages.js` |
| **Reggie hero PNGs** | `/app/frontend/public/hosts/reggie/reggie_{warm,celebrate,laughing,skeptical,surprised}.png` |
| **Marc hero PNGs** | `/app/frontend/public/hosts/marc/marc_{warm,smile,explaining,excited,neutral}.png` |
| **Contact-sheet slicing tools** (Photoshop-style extraction from generation grids) | `/app/backend/scripts/slice_contact_sheet.py`, `/app/backend/scripts/slice_reggie.py`, `/app/backend/crop_asset_library.py` |
| **Portrait component** | `/app/frontend/src/components/HostPortrait.jsx` (supports `persona="reggie"|"marc"`, mood, mirror, size) |
| **Two-host desk** | `/app/frontend/src/components/TwoHostDesk.jsx` |

### B.4 Show-runner + banter engines

| Purpose | Path |
|---|---|
| **Reggie chat brain / assistant** | `/app/backend/reggie_assistant.py`, `/app/frontend/src/components/ReggieAssistant.jsx` |
| **Pregame show script generator** | `/app/backend/pregame_show.py` |
| **Recap show generator** | `/app/backend/recap_show.py` |
| **Game story writer** | `/app/backend/game_story.py` |
| **Live desk component** | `/app/frontend/src/components/LiveDesk.jsx` |
| **Broadcast context provider** (per-route camera/mood coordination) | `/app/frontend/src/lib/broadcastContext.jsx` |
| **IQ Coach chat + dock** | `/app/frontend/src/components/iq/IQCoachChat.jsx`, `IQCoachDock.jsx` |
| **Joke bank / retrieval** | `/app/frontend/src/lib/jokeBank.js` |
| **Reggie loading/idle lines** | `/app/frontend/src/components/IdleHost.jsx` |

---

## C. WHICH PROJECT APPEARS TO CONTAIN THE RICHEST/MASTER VERSION

**For Reggie + Marc: THIS APP is the master.**

Evidence:
- Full system prompts (~4KB each) with catchphrase banks, situational reggieisms/marcisms, tone modes, and partner-teasing rules — all in `backend/analysts.py`.
- The **Banter Bible** (690 lines) and **Language Bible** (464 lines, PARTIAL) explicitly cover the Reggie × Marc chemistry, chirp/roast rules, and comedy category catalogue.
- Real voice IDs configured, cached audio files exist, portrait sets shipped, per-route mood pick wired.
- `bible_notes_v0.md` shows this app is where the JT → Reggie migration was decided and where "Marc Doyle" (still visible in `hostImages.js` line 31) is being converged to "Marc Collins" (analysts.py) — meaning this fork is where the master reconciliation is happening.

**For the wider Junior/NCAA/6-host cast: THIS APP does NOT have them.**

- No AJ, Talia, Jake, Claire, Sofia, Rayo, Casey, Hanna, Lena, Matthias, Sanna, Lars.
- The only fossilised 4-host set (Doyle / Numbers / Dozer / Ace) exists as **voice-design briefs and mp3 previews only** — no system prompts, no partner rules, no multilingual behaviour, no language packs.
- The AI Play-by-Play fork almost certainly holds the six-host system, pair chemistry, multilingual rules, and voice direction described in your list. Not here.

---

## D. MULTILINGUAL — WHAT EXISTS IN THIS APP

- **Voice model:** `eleven_multilingual_v2` (in `voice_service.py:45`) — the model itself supports multilingual, so the *plumbing* is in place.
- **Voice Design model:** `eleven_multilingual_ttv_v2` (in `design_voices.py:99`).
- **No language packs.** No English/French/Spanish/German/Swiss-German/Italian/Nordic files.
- **No language bibles for regional voices.** `LANGUAGE_BIBLE.md` in this fork is a *comedy* language bible, not a *regional-language* bible.
- **No pronunciation rules** for team/player names by region.
- **No Dozer + Sofia FR-CA/EN pair behaviour.** Dozer is only present as a solo voice-design brief.
- **No Rayo / Spanish handling.**
- **No Lena + Matthias Swiss / Central Europe pair.**
- **No Sanna + Lars Nordic pair.**

**Conclusion.** The multilingual cast + rules you're looking for **live in the AI Play-by-Play fork, not here.** This app is monolingual Reggie + Marc.

---

## E. PAIRS — WHAT EXISTS

| Pair | Present? | Where |
|---|---|---|
| **Reggie + Marc** | ✅ **Rich** — the entire Banter Bible is dedicated to this pair. Includes signature interruption patterns (Marc's "You're not wrong… but…"; Reggie chirping "Professor McCalculator"), agree/disagree templates, grudging-agreement lines, warm-teasing rules ("never mean"), and per-situation cadence guidance. | `analysts.py` + `BANTER_BIBLE.md` + `bible_notes_v0.md` |
| AJ + Talia | ❌ Not present | — |
| Dozer + Sofia | ❌ Dozer is a solo voice brief only; Sofia doesn't exist here | — |
| Jake + Claire | ❌ Not present | — |

---

## F. RECURRING BITS / MEMORY / CALLBACKS

Present for **Reggie + Marc only**:

- **Reggie signature phrases:** "Do the right things. Then execute." · "Hockey keeps receipts." · "Simple beats fancy." · "That's a HOCKEY play." · "Come on now." · "Attaboy, kid." · "Write it down." · "I've seen this movie before." · "OH BABY!" · "Bar-down city!" · "Roof daddy." · "Now THAT's compete." · "Songs are getting written about him tonight." · "Back to me on that one." · "That's the Ticker, folks."
- **Marc signature phrases:** "Let's look at the numbers." · "Context matters." · "Here's the pattern." · "Let's separate luck from skill." · "Small sample size." · "Evidence beats assumptions." · "That's today's headline, not tomorrow's reality." · "The tape and the numbers finally shook hands." · "Chess match." · "Sometimes probability takes the night off." · "That's a plaque number."
- **Recurring segment named "Cup Check"** (`bible_notes_v0.md:32`).
- **Emotional core (SPARINGLY):** Reggie's "kids losing the opportunity to play" theme — one moment of real heart per segment is worth ten catchphrases.
- **Tone-mode switch:** LIGHT-AND-FUN vs TECHNICAL. Panel / Home / Player pages default to LIGHT-AND-FUN. Deep Dive / Presser / Betting IQ / Fantasy Desk opts into TECHNICAL.
- **Memory / callback logic:** none machine-implemented in this fork beyond LLM system prompt. The Banter Bible describes callback discipline as a rule, not a data structure.

---

## G. THINGS EACH CHARACTER MUST AVOID (extracted from system prompts)

**Reggie:**
- Never "as an AI." Never emoji. Never sounds scripted.
- Never chirps a person, only habits. "Attaboy" for effort; "JV backcheck" for lazy shifts — never insulting the player.
- Never claims to regret his career.
- Never uses fantasy-podcast phrases like "PP1 exposure," "value pop," "regression coming," "efficiency add" in LIGHT-AND-FUN mode.

**Marc:**
- Never "as an AI." Never emoji.
- Never sounds like a spreadsheet — every stat is wrapped in hockey meaning.
- Never interrupts (waits, then reframes with "You're not wrong… but…").
- Dry humor **at most once per answer.**

---

## H. WHAT SHOULD BE COPIED INTO THE CURRENT TICKER SPORTS DESK BUILD FROM THIS APP

The **Reggie + Marc master material** — that's what this fork actually owns:

1. `backend/analysts.py` lines 10–229 — the two system prompts, verbatim. These are the source of truth.
2. `memory/BANTER_BIBLE.md` — 690 lines of pair chemistry rules.
3. `memory/LANGUAGE_BIBLE.md` — 464 lines of comedy/chirp rules (⚠ marked PARTIAL, "Sections F onward TBD" — ask other forks for the completion).
4. `memory/CHARACTER_STYLE_GUIDE.md` — full visual identity, generation prompts, quote banks.
5. `memory/bible_notes_v0.md` — the alias/history reconciliation record (JT → Reggie; Kovalenko → DeLuca; deferred cast; Marc Doyle vs Marc Collins).
6. `backend/voice_service.py` + `backend/voice_profiles.json` — active voice IDs + full archive with change history.
7. `backend/design_voices.py` — the four archived voice-design briefs (Doyle / Numbers / Dozer / Ace) with full ElevenLabs prompt text. These are salvage-quality if the AI Play-by-Play fork's briefs are lost.
8. `backend/static/audio/voice_choices.json` + `backend/static/audio/previews/manifest.json` — every voice ID currently chosen and every preview mp3 filename.
9. `frontend/public/hosts/reggie/*.png` + `frontend/public/hosts/marc/*.png` — 10 portrait moods (5 per host).
10. `frontend/src/lib/hostImages.js` — per-route mood pick logic + the JS-side names/roles (**note: `hostImages.js:31` says "Marc Doyle"** — that alias should be reconciled to "Marc Collins" per `analysts.py`).
11. `frontend/src/components/HostPortrait.jsx` + `TwoHostDesk.jsx` + `LiveDesk.jsx` + `IdleHost.jsx` + `ShowOpener.jsx` + `broadcastContext.jsx` — the visual desk machinery.
12. `backend/reggie_assistant.py` + `backend/pregame_show.py` + `backend/recap_show.py` + `backend/game_story.py` — the show-runner engines (Reggie chat brain, pregame script, recap generator, story writer).
13. `frontend/src/lib/jokeBank.js` — joke bank plumbing (⚠ audit contents before importing — may be shallow).

**Deliberately NOT worth copying from this fork** (they're better sourced elsewhere or already superseded):
- Any wider-cast character prompts — this app has none for AJ, Talia, Jake, Claire, Sofia, Rayo, Casey, Hanna, Lena, Matthias, Sanna, Lars.
- Multilingual rules / language packs — none exist here.
- Junior & NCAA panel logic — not present.
- Pair chemistry for any pair other than Reggie + Marc — not present.

---

## I. INCONSISTENCIES / RECONCILIATION FLAGS

These need resolving when merging with other forks:

1. **Marc's last name.** `analysts.py` says **"Marc Collins."** `hostImages.js:31` says **"Marc Doyle."** Two different sources of truth in the same repo. Consolidate on one before the port.
2. **Kovalenko → DeLuca.** `bible_notes_v0.md:44` records that "Dozer" migrated from surname *Kovalenko* to *DeLuca*. `design_voices.py` still keys him as `kovalenko` in code. If the AI Play-by-Play fork has moved fully to *DeLuca*, use their version.
3. **Reggie's origin.** `bible_notes_v0.md:29` records the migration from Boston/Dorchester → Elk River, MN ("neutral all-American voice"). Any older fork still using the Boston backstory is out of date.
4. **JT alias.** `bible_notes_v0.md` records the lead anchor was formerly called "JT" before being renamed **Reggie Banks**. Any file/asset still labelled "JT" in another fork should be updated on merge.
5. **Language Bible completeness.** `LANGUAGE_BIBLE.md` is marked PARTIAL at "Section 5-E" — Sections F onward are missing. Highest priority to ask the other forks for the completion.
6. **The archived 4-host cast** (Doyle / Numbers / Dozer / Ace) has voice IDs and voice-design briefs but **no system prompts** in this fork. If any of them should be revived, the AI Play-by-Play fork is the likely source.

---

## J. SUMMARY (one paragraph)

This fork holds the **canonical Reggie + Marc material** — two full system prompts, three bible documents (Banter, Language partial, Character Style), the voice-registry archive, portrait sets, per-route mood pick, joke bank, show-runner engines, and the alias-reconciliation history. It does **not** hold the wider Junior/NCAA/6-host cast, no multilingual layer, and no pairs other than Reggie + Marc. If your goal is to migrate a full multilingual cast system into Ticker Sports Desk, this app supplies the Reggie/Marc master and nothing else — the AI Play-by-Play fork is where the rest should exist.

---

**End of audit. No files edited. Every path above verified to exist in the current tree.**
