# The Ticker — Commentary Engine & Sharing/Virality Spec

**Status:** Planning reference. Not all of this is in current build scope. Refer to this doc when scoping any work on hosts, banter, tone, or sharing/clips.

**Source:** User dev-update dated 2026-07-29. Captured verbatim below.

---

## 1. Context-Aware Commentary Engine

**Goal:** Reggie and Marc should never sound like AI reading facts. Priority is authenticity, entertainment, and replay value — not maximizing joke count.

**6-step live commentary process:**
1. **Observe** — identify statistical/visual events worth noting
2. **Evaluate** — decide if it's worth commenting on; classify the moment type (funny, impressive, historical, tactical, emotional, storytelling, teaching, debate, prediction)
3. **Choose Commentary Style naturally** — serious analysis, funny/historical comparison, personal story, light chirp, coaching/betting insight, tactical explanation, prediction, friendly disagreement. Humor is never forced.
4. **Search the Comparison Library** by category if a comparison fits (see taxonomy below) — search for the *best* comparison, not the funniest
5. **Character Filter** — Reggie and Marc deliver the same observation differently, per their locked personalities
6. **Apply Timing Rules** (below)

**Comparison Library categories:** hair, beards, camp shape, conditioning, strength, speed, hands, vision, shot, passing, leadership, goaltending, penalty taking, physical play, fighting, confidence, momentum, fans, arena atmosphere, coaches, referees, equipment, playoff intensity, clutch moments, cold streaks, hot streaks, historical NHL moments, famous players, movies, pop culture, locker room sayings, common hockey expressions

**Timing Rules:**
- Never joke during: injuries, emotional ceremonies, immediately after tragic news, serious discussions, memorials
- Reduce humor during overtime/elimination moments unless it naturally fits
- Increase personality during: TV timeouts, intermissions, pregame, postgame, reviews, coach challenges, downtime between whistles

**Repetition Protection:** Track comparisons, jokes, historical references, and catchphrases already used. Avoid repeating the same comparison too frequently. Prefer fresh language.

**Content-mix ratio target (guideline, not hard rule):** ~60% hockey analysis / 20% storytelling / 10% humor / 5% history / 5% predictions

**Ultimate goal:** Fans should forget they're listening to AI — should feel like two former NHL players naturally reacting, teaching, and occasionally delivering lines fans repeat to friends. If a line sounds like a generic chatbot, rewrite it.

---

## 2. Dynamic Commentary & Banter Engine

**Core philosophy:** Most AI sports products go Game Event → Script. The Ticker should go **Game Event → Understand Context → Select Personality → Select Humour Style → Deliver Natural Conversation**.

**Event evaluation factors:** game importance, score, time remaining, who the player is, rookie vs. veteran, star vs. depth player, severity, crowd reaction, replay angle, previous conversation, which host is speaking, current mood of the broadcast.

**Commentary Formula — 3 layers:**
- **Layer 1 — Observation:** what actually happened, stated plainly (e.g. "He lost an edge.")
- **Layer 2 — Instant Reaction:** short 1-2 word gut reactions delivered before the actual comment ("Ooof…", "Oh!", "Boom!", "Yikes", "That's got to hurt")
- **Layer 3 — Comment Style:** the line is drawn from a specific **Humour Style**, not generated as a random joke

**Humour Style taxonomy** (distinct from the Comparison Library above — this organizes *how* a joke is framed, not *what* is being compared): Locker Room, Family, Dinner, Travel, Card Games, Golf, Fishing, Beer League, Team Bus, Hotels, Coaches, Equipment Manager, Construction, Vehicles, Movies, Music, Social Media, Weather, Animals, Food, Airport, Old School Hockey, Story Starter, Self-Deprecating, Teammate, Reggie Only, Marc Only. List meant to keep expanding.

**Conversation structure:** Hosts build on each other's lines in natural back-and-forth (Reggie reacts → Marc adds context/redirects → Reggie responds), not each host reading a scripted line in turn.

**Reggie:** fast, confident, funny, former offensive player, loves stars/skill, chirps players, locker-room humour, emotional reactions, bold opinions.

**Marc:** calm, experienced, respected, protects players, explains coaching decisions, laughs before speaking, provides balance, adds context, often redirects Reggie.

**"Banter Bible" data structure:** a searchable database structured as `Situation → Humour Style → Comment → Tags`. Every comment carries metadata tags.

> Example: Situation = "Big Hit" → Tags = [Playoffs, Funny, Family, PG, Reggie, Momentum, Physical Play]

**Situation Library target:** 200+ specific hockey situations to build banter against — goals, big hits, fights, scrums, broken sticks, falls, missed empty nets, huge saves, penalty shots, coach reactions, bad line changes, bad passes, turnovers, goalie pull, empty net, video review, referee calls, offside, icing, power play, penalty kill, blocked shots, rookie mistakes, veteran mistakes, hat tricks, milestones, shutouts, bench reactions, fan reactions, playoff overtime, etc.

**Repetition tracking cadence:** track usage at last game / last week / last month / per-user level, prioritizing fresh comments.

**Tone Engine:** every line additionally tagged along a tone axis — funny, dry, serious, respectful, playoffs, rookie friendly, emotional, historic, sarcastic, celebration, story, teaching — so commentary matches the moment.

**Future-state vision:** once the situation/humour-style/tone structure exists, AI generates new comments within each category automatically (respecting personality, tone, hockey culture, context, repetition rules) rather than every line being manually written. The library becomes a continuously expanding living system.

**Positioning:** Most sports AI can explain a game; very few can recreate hockey culture (team buses, dressing rooms, card games, golf trips, road hotels, practice rinks, playoff runs, training camps). That culture — not just stats — is what should make Reggie and Marc memorable. This is a personality/conversation/hockey-culture engine, not a joke generator.

---

## 3. Sharing / Virality Mechanics

- Sharing should be framed broadly — **any** moment a user likes (a great stat, a recap line, a prediction) should be easily shareable in a tagged format, not limited to one content type
- **Audio-first**: preference is for voice/audio clips over static text or image cards — carries the hosts' personalities better and requires no reading
- **Marc & Reggie highlight reel**: once enough tagged clip material accumulates, compile a running "Best of" reel (works as both marketing content and a re-engagement hook for lapsed users)
- *(Note: an earlier idea to identify users as real hockey prospects via name/location matching for personalized shareable content was explored and dropped — not moving forward with that direction.)*

---

## What already exists in the codebase (mapping current state → this spec)

| Spec area | Current codebase reality |
|---|---|
| Reggie / Marc locked personalities | ✅ `analysts.py` — full character system prompts already codify Reggie=offensive/streetwise, Marc=analyst/protector. Matches spec §2 personality description almost 1:1. |
| Comparison Library (early seed) | ⚠️ Partial — `/app/frontend/src/lib/jokeBank.js` was seeded during the Tone Reset. Small (~30 lines), not tagged, no categories, no repetition tracking. |
| Banter Bible schema | ❌ Not built. `/api/banter` currently generates lines on the fly from LLM + character prompts. Lines are stored in `broadcast_manifests` (Manifest v2) but with **no** situation/humour-style/tone tags. |
| Timing Rules | ❌ Not codified. Nothing prevents jokes during memorials/injuries yet. |
| Repetition Protection | ❌ Not built. Every generation is independent. |
| Tone Engine | ❌ Not built. |
| Content-mix ratio (60/20/10/5/5) | ⚠️ Prompt-level nudge only, not measured. |
| Situation Library (200+) | ❌ Not built. No situation catalog exists. |
| Clip-sharing pipeline | ⚠️ **Backend architecture in place** — Manifest v2 gives every turn a stable `turn_id` and `type`, which is exactly what a clip export needs. No frontend export UI yet. |
| Audio-first sharing | ⚠️ Backend TTS via ElevenLabs is per-turn, so audio clips are natively addressable. No download/share button on turns yet. |
| Marc & Reggie "Best of" reel | ❌ Not built. Depends on ratings/likes existing per turn first. |

---

## Recommended shape of first concrete work (when the user is ready)

**Data model first, content second.** Two small builds unlock everything else:

**Build A — Banter Bible schema in Mongo.**
Create a `banter_lines` collection with the tagged structure now, so every line the show generates (either from LLM or hand-authored) lands in a query-able store. Fields:

```
{
  id, text, speaker (reggie|marc), 
  situation, humour_style, comparison_category (optional),
  tone_tags[], pg_rating,
  source (llm|hand_authored),
  usage: { last_game_at, last_week_count, last_month_count, all_time_count },
  ratings: { likes, shares, skips }
}
```

Then modify `analysts.py` / `/api/banter` to log every generated turn to this collection with best-guess tags. Two weeks of usage data unlocks the "fresh line for situation X, not used in last N days" query — which is the actual heart of the whole engine.

**Build B — Share button per turn.**
Manifest v2 already stamps each turn with a stable `turn_id`. Add a share button on the mini-player and the full frame that grabs the current turn's audio URL + text and drops a share sheet (native `navigator.share()` on mobile, copy-link on desktop). Zero backend rebuild — just a UI hook on top of what's already there. This is the smallest possible step toward the "audio-first virality" ambition and it also creates the first stream of user-signal data (which turns get shared) that feeds the ratings field in Build A.

Together, A + B create the flywheel: every line is tagged and stored → shares/likes flow back as ratings → repetition-protection queries become real → future AI generation queries the Bible for fresh material instead of hallucinating each time.

Both are contained, non-disruptive to the current shipping app, and buy real leverage for every future item in this spec.
