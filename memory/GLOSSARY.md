# The Ticker — Glossary & Naming Decisions

This is the shared vocabulary between the user and the agent. When either
side uses a term below, it means the specific thing described here.

Last updated: 2026-07-30.

---

## 📺 Show / broadcast anatomy

| Term | Meaning |
|---|---|
| **Show frame** | The big video panel where Reggie & Marc sit — the "TV" |
| **Cold open** | First 5-10s of a show before real content (Reggie's opening line) |
| **Sign-off / Outro** | Closing line at end of a show |
| **Segment** | One self-contained piece of the show (e.g. "Game 3 recap") |
| **Beat** | One line/moment inside a segment (smaller than a segment) |
| **Cutaway** | Camera jumps from the desk to game clips and back |
| **B-roll** | The game highlight clips playing behind/instead of the hosts |
| **Two-shot** | Camera shot with both hosts side-by-side |
| **Solo shot** | Camera on just one host — the one talking |
| **Playing over** | Host talks while clips roll ("Marc plays over the goal montage") |

## 🎬 On-screen text

| Term | Meaning |
|---|---|
| **Chyron** (kai-ron) | Any text overlay on screen |
| **Lower-third** | Chyron at the bottom third (host name tag) |
| **Bug** | Small persistent corner logo (LIVE dot, network T logo) |
| **Ticker** | Scrolling stat/score bar at the bottom (yes, our name) |
| **Score bug** | Little score box in the corner during a game |
| **Watermark** | Very faint background logo ("The Ticker" ghost) |

## 🎙️ Audio

| Term | Meaning |
|---|---|
| **VO** | Voice-over — host talking, no video of them |
| **PKG** | Package — pre-produced clip+VO+graphics segment |
| **Bed** | Background music/ambient under hosts |
| **Stinger** | Short audio sting/whoosh between segments |
| **Cue** | Trigger — "cue Reggie's line" = start his audio |
| **Cross-talk / banter** | Two hosts talking back and forth |

## 🏒 Sports / betting

| Term | Meaning |
|---|---|
| **The Board** | ✅ *Official name* for tonight's list of games |
| **The Card** | Flavor synonym for The Board (Reggie banter) |
| **The Slate** | Flavor synonym for The Board (Marc banter) |
| **Chalk** | The favorite / popular pick |
| **Dog** | The underdog |
| **Line** | Betting odds / spread |
| **Prop** | Individual player/team over-under bet |
| **Sharp** | Smart bettor with a track record |
| **Public** | The general public (opposite of sharp) |
| **Fade** | Bet against someone/the public |
| **Consensus** | What most agree on |
| **Read** | Someone's take/prediction |

## 🧠 Analytics — **RULE: never used bare, always explained on first mention**

The following acronyms are too jargon-heavy for the average user. Whenever
Reggie or Marc drops one on-air (or it appears on-screen), it must be
paired with a plain-English gloss the first time it appears in a segment.
Same rule for LLM prompts that generate show scripts.

| Acronym | On-air phrasing |
|---|---|
| **PDO** | "the luck stat" |
| **Corsi / Fenwick** | "possession" or "shot attempts" |
| **xG** | "quality of chances" or "expected goals" |
| **HDCF** | "chances from the slot" |
| **B2B** | "back-to-back — second night in a row" |

These *may* stay bare because they're mainstream enough:
- PP / PK (Power Play / Penalty Kill)
- PP% / PK%
- Faceoff win %
- Rest advantage
- Goalie starts

## 📱 Our app — official names for each area

| Area | Name |
|---|---|
| Recap Show landing page (`/`) | **The Morning Line** / Recap Show |
| Pregame show (future) | **The Morning Skate** |
| Predictions page (`/predictions`) | **The Pick 'Em** / The Board |
| Post-Game Stats panel | **The Box Score** / Post-Game panel |
| Head-to-Head dropdown | **The H2H** / Season Snapshot |
| Segment rail below the frame | **The Segment Rail** / Game Rail |
| Reggie chat FAB (bottom right) | **Reggie's Booth** / The Companion |
| Betting log (`/back-office`) | **The Back Office** |
| Match analysis (`/matchup/:id`) | **The Postmortem** / Deep Dive |
| Mini audio bar at bottom | **The Mini Bar** / Persistent Player |
| Top nav | **The Marquee** |

## 🔔 Stinger

Client-synthesized via Web Audio API — no external file, no API cost.
Lives at `/app/frontend/src/lib/stinger.js`.

- **Fires on show open** — full network sting when the user taps "Tap to
  run the tape" on the Recap Show.
- **Self-caps at 3 plays per browser session** via `sessionStorage`, so
  the effect stays fun and doesn't wear out. Fresh count on each new
  browser session.
- Vibe: deep sub-bass whoosh (SportsCenter DNA) + high-frequency synth
  click (modern signature) + short sine riser (the punch-out cue).
- Two intensities exported (`playStinger`, `playStingerSoft`); only the
  full one is wired today. Between-segment stingers are parked for now.
- Tune the feel by nudging the numbers inside the file — hot-reload only.

## ✍️ Handy phrasing shortcuts

- "the text below the panel" → **the lower-third**
- "the little logo top right" → **the LIVE bug**
- "the video with the two hosts" → **the show frame** or **the two-shot**
- "the row of games at the bottom" → **the segment rail** / **game rail**
- "the numbers page" → **the box score**
- "the games list" → **the board**
