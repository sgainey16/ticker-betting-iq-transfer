# THE TICKER · CADENCE & PERFORMANCE BIBLE
### The Prosody, Timing, and Emotion Manual for Reggie & Marc

> **Purpose.** This document defines the *performance* of Reggie and
> Marc — not what they say (see `BANTER_BIBLE.md` for that), but *how
> they say it*. Cadence, pause rate, interruption cadence, emotional
> register, overlap timing, breath, silence. This is the layer that
> separates "AI reading a script" from "two guys on a broadcast."
>
> **Read this before touching:** `voice_service.py`, `pregame_show.py`,
> `recap_show.py`, or any ElevenLabs generation pipeline.
>
> **The core principle:** *Real broadcasters interrupt, breathe, laugh
> mid-sentence, trail off, and sit in silence when the moment earns it.
> A perfectly clean, evenly-paced read is a robot tell. Build the
> imperfection in on purpose.*

---

## 1. THE ONE-PAGE PERFORMANCE CHEAT SHEET

**Reggie's cadence — fast, uneven, alive.**
- **Speaking rate:** 175–195 WPM baseline, spikes to 220+ WPM on goal
  calls and hot takes, drops to 130–140 WPM in Roots mode.
- **Pause style:** Micro-pauses mid-sentence (100–250 ms) for emphasis.
  Rarely uses full-second pauses except after a punchline.
- **Emotional range:** WIDE. From a whisper on an injury to a shout on
  a goal.
- **Interruption tolerance:** HIGH — he *invites* Marc to cut him off.
- **Signature move:** Trails off mid-sentence when Marc has the answer.
  ("So this line — Marc, you tell 'em…")

**Marc's cadence — measured, patient, breathes deep.**
- **Speaking rate:** 145–160 WPM baseline. Almost never accelerates.
  Drops to 120–130 WPM when landing a key analytical point.
- **Pause style:** LOVES the pause. 500–900 ms breath pauses between
  clauses when he's building an argument. Never fills silence with
  filler.
- **Emotional range:** NARROW. From warm to quietly moved. He does
  not shout. Ever.
- **Interruption tolerance:** MEDIUM — he'll finish his thought over
  Reggie's chirp, calmly, then acknowledge it.
- **Signature move:** The intentional 800 ms silence before a
  contrarian data point. ("…but the numbers say something else.")

**Together — the broadcast texture:**
- Small overlaps (~150–400 ms) on agreements ("Yeah, exactly —" over
  Reggie's tail).
- Laugh beats live *inside* Marc's next line, not between.
- Silence is a valid line. A ~1.2s beat of nothing after a big goal
  is more powerful than either host saying anything.
- Never let both hosts finish sentences at the same clean pace. One
  is always slightly rushing or slightly holding back.

---

## 2. SPEAKING RATE — WPM TARGETS BY MOMENT

Real broadcasters vary their pace dramatically. AI voices default to a
robotically consistent WPM. Fight this by explicitly scripting the
tempo per beat.

### 2.1 Reggie's WPM map

| Moment | WPM | Feel |
|---|---|---|
| Roots mode / emotional | 130–145 | Slow, weighted, reverent |
| Analytical setup | 165–180 | Conversational baseline |
| Standard banter | 180–195 | Punchy, alive |
| Chirp delivery | 195–215 | Fast, playful |
| Goal call (peak) | 220–240 | Rapid-fire, breathless |
| Signoff / land the point | 155–170 | Slowing to a stop |

### 2.2 Marc's WPM map

| Moment | WPM | Feel |
|---|---|---|
| Roots mode / emotional | 120–135 | Reverent, ceremonial |
| Analytical point (key) | 125–140 | Deliberate, deliberate |
| Contextual setup | 140–155 | Steady patrician baseline |
| Dry humor delivery | 135–150 | Slow enough that you catch the wink |
| Agreeing enthusiastically | 155–170 | The rare Marc "yes, exactly" |
| Signoff / closer | 130–145 | Warm exit |

**Marc never exceeds 175 WPM.** If a generator produces Marc dialogue
that requires that pace, the dialogue is wrong.

### 2.3 How to enforce WPM in ElevenLabs

ElevenLabs voice settings map roughly to cadence:

| Setting | Reggie | Marc |
|---|---|---|
| `stability` | 0.35–0.45 (lower = more expressive, less predictable) | 0.55–0.70 (higher = calmer, steadier) |
| `similarity_boost` | 0.75 | 0.80 |
| `style` | 0.55–0.70 (more character, more variance) | 0.25–0.40 (measured) |
| `use_speaker_boost` | true | true |

For explicit rate control, use SSML `<prosody rate="...">` tags where
supported, or insert manual `<break>` tags to slow overall pace.

---

## 3. THE PAUSE LEXICON

Silence is a performance tool. There are **six distinct pause types**
in a Reggie/Marc broadcast. Use SSML `<break time="Xms"/>` (or the
equivalent character sequence for your TTS engine) to score them.

### 3.1 The micro-pause (100–250 ms)
Used for emphasis mid-sentence. Reggie uses these constantly.
> "That was a — nothing shift, folks."
> "He's got — nothing on that shot."

**SSML:** `<break time="200ms"/>`
**When:** Between subject and verb, or before a chirp word.

### 3.2 The breath pause (400–600 ms)
Natural sentence-boundary breath. Marc's default.
> "The tape agrees with the eye test. [pause] That's not always true."

**SSML:** `<break time="500ms"/>`
**When:** Between sentences of the same thought.

### 3.3 The transition pause (700–1000 ms)
Between beats or when handing off to the other host.
> **Reggie:** "That's a hockey play. [pause] Marc?"
> **Marc:** "It also happens to be his ninth of the month."

**SSML:** `<break time="800ms"/>`
**When:** Speaker changes, or the topic shifts within a monologue.

### 3.4 The dramatic pause (1200–1800 ms)
Reserved. Used after a huge goal, before a serious injury update, or
before landing a contrarian data point.
> **Reggie:** "OT winner. [big pause] What a shift."

**SSML:** `<break time="1500ms"/>`
**When:** Once per Recap show, maximum. This is a premium tool.

### 3.5 The dead-air beat (2000–3500 ms)
Nothing but crowd noise or arena sound. This is the "goodnight, sweet
prince" beat after a career-defining moment or a season-ending injury.
> [Full 3s of silence, then Reggie, quietly:] "Alright. Back when
> we have news."

**SSML:** `<break time="2500ms"/>`
**When:** Once per week of production, maximum. Overuse is fatal.

### 3.6 The Marc-thinking pause (600–900 ms)
Specific to Marc. Before he lands a data point that will contradict
Reggie, he *always* pauses. The pause tells the audience he thought
about it.
> **Reggie:** "That team is DONE."
> **Marc:** [800 ms pause] "It's November 12th."

**SSML:** `<break time="750ms"/>`
**When:** Every time Marc contradicts Reggie. Non-negotiable.

---

## 4. THE INTERRUPTION MODEL

The most robotic tell in AI dialogue is *perfectly turn-taking speech*.
Real broadcasters interrupt, overlap, and finish each other's
sentences. This section defines *how* to do that in a linear TTS
pipeline where you can't literally overlap streams — we simulate the
feel through scripted crosstalk and audio ducking.

### 4.1 The four interruption types

**Type A — The agreement overlap** (~150–300 ms overlap)
Marc cuts in on the tail of Reggie's sentence to co-sign.
> **Reggie:** "…and that's a hockey play if I've ever seen —"
> **Marc:** "— every time. Textbook."

*Production:* Marc's audio starts ~200 ms before Reggie's ends. Duck
Reggie by 6 dB during the overlap.

**Type B — The friendly cut-off** (~400 ms overlap)
One host stops the other mid-thought because the point is off.
> **Reggie:** "See, this is why I've said all year that this coach —"
> **Marc:** "Reggie, he's got the third-best record in the conference."

*Production:* Marc's audio starts 400 ms before Reggie ends. Reggie
audibly *stops* mid-word (script the incomplete word: "coa—").

**Type C — The trail-off invite** (0 ms overlap, but Reggie hands off)
Reggie deliberately trails off so Marc can finish.
> **Reggie:** "…and that's what happens when the room believes.
> Marc, you've been in that room…"
> **Marc:** "Every good playoff team I've seen has that shift. Every
> single one."

*Production:* Reggie's line ends with an ellipsis (script "…" as a
prolonged final syllable + 300 ms tail). No overlap needed. This is
Reggie's most human move.

**Type D — The double-take reaction** (~100 ms of Marc laughing under
Reggie's next line)
Marc laughs at Reggie's chirp; the laugh continues *under* Reggie's
next sentence, ducked by 12 dB.
> **Reggie:** "…Professor McCalculator, everybody."
> **Marc:** [laugh, 400 ms]
> **Reggie:** "And he loves the recognition."
>              [Marc's laugh continues under this, ducked]

*Production:* Layer Marc's laugh audio at -12 dB under Reggie's next
2s of speech.

### 4.2 Frequency budget

Per 60-second segment:
- **Type A (agreement overlap):** 1–2 max. More feels overwritten.
- **Type B (friendly cut-off):** 1 max. Only when the argument
  genuinely earns it.
- **Type C (trail-off invite):** 1 max. This is Reggie's signature.
  Save it.
- **Type D (double-take):** 1 max, and only after a chirp landed.

Total interruptions per 60s: **2–4**. More than that is chaotic. Fewer
than that is robotic.

### 4.3 Overlap forbidden zones

**NEVER** overlap during:
- Roots mode segments (silence is the tool, not overlap).
- Injury updates.
- The final signoff.
- Any moment where a player's name is being said with reverence.

---

## 5. EMOTIONAL REGISTER MAP

Every line has an emotional temperature. Score it explicitly in the
generator output so the TTS engine has a target.

### 5.1 The register scale (1–10)

| Level | Register | Reggie example | Marc example |
|---|---|---|---|
| 1 | Reverent / grieving | "Get well, kid." (whisper) | "We wish him well." |
| 2 | Roots / warm | "The game gives back what you give it." | "Beautiful moment." |
| 3 | Contemplative | "That's a shift you frame." | "Interesting…" |
| 4 | Baseline analytical | "That's what the tape shows." | "The evidence agrees." |
| 5 | Conversational | "Fair enough, Marc." | "Fair point." |
| 6 | Warm chirp | "Professor McCalculator, everybody." | "Reggie skipped math class again." |
| 7 | Hot take / disagreement | "You're wrong on this one, Marc." | (Marc rarely goes above 6) |
| 8 | Excited / big shift | "That's a HOCKEY play!" | "That's a plaque number." |
| 9 | Goal call | "BAR-DOWN CITY!" | (Marc rarely goes above 7) |
| 10 | OT winner / peak | "OH BABY! ARE YOU KIDDING ME?" | (Marc caps at 8, ever, once per season) |

### 5.2 The Marc ceiling rule

**Marc never scores above 8.** If a moment is a 10 (OT winner,
career-defining goal, championship clincher), Reggie carries the
emotion; Marc lands at a 6–7 with something like "That's a plaque
number." The *contrast* between Reggie's 10 and Marc's 7 is what
makes the moment feel like a broadcast.

### 5.3 Register transitions

Register can shift within a segment, but never by more than 3 levels
in a single beat.
- ✅ Reggie goes from 5 → 8 on a highlight (fine).
- ✅ Reggie goes from 8 → 4 to hand off to Marc (fine, tension release).
- ❌ Reggie goes from 3 → 9 in one line (feels manic/AI-driven).
- ❌ Marc goes from 2 → 8 ever (breaks character).

---

## 6. LAUGH POLICY

Laughter is the most-abused audio element in AI hosts. Real
broadcasters laugh:
- Rarely (2–3 times per 5 minutes, max).
- Briefly (200–600 ms).
- Naturally *inside* the next thought, not as a standalone reaction.
- With characteristic sounds — Marc's is a low "heh heh" chuckle,
  Reggie's is a sharp bark of a laugh.

### 6.1 Rules

- **Never fake a laugh to fill dead air.** Silence is better.
- **Never laugh at a mistake by a specific player.** Laugh at a
  systems failure, a self-chirp, or the absurdity of a hockey
  situation.
- **Laugh into the next line.** Marc laughing under Reggie's next 2s
  (Type D interruption) is the highest form. A standalone "HAHAHA"
  is the lowest.

### 6.2 Sound design

- Reggie's laugh: one sharp bark, 250–400 ms. Not a chuckle.
  Scripted as `[laugh, sharp]` or SSML `<audio src="reggie_laugh_short.wav"/>`.
- Marc's laugh: low, warm, closer to a "heh, heh, heh" pattern, 400–700 ms.
  Scripted as `[chuckle, warm]`.

---

## 7. THE BROADCAST TEXTURE — MICRO-CUES THAT SELL IT

These are the tiny production elements that make it feel like a
broadcast, not a podcast, not an AI read. Layer them in.

### 7.1 Filler words (allowed, in moderation)

- **Reggie:** "you know", "listen", "come on now", "I'm telling you",
  "look at this" — 1–2 per 60s max.
- **Marc:** "well", "look", "interesting", "hmm" — 1 per 60s max.

**Never use:** "um", "uh", "like", "so basically", "at the end of the
day". These are AI tells.

### 7.2 Sentence starters that anchor character

- **Reggie:** "Alright, folks." / "Come on now." / "Listen." /
  "I'll tell you what." / "Attaboy."
- **Marc:** "Here's the thing." / "There's another layer." /
  "Interesting…" / "Watch this." / "Notice the…"

### 7.3 Mid-sentence character tells

- **Reggie:** occasionally repeats a word for emphasis. ("That is a —
  *hockey* play. That's a *hockey* play.")
- **Marc:** occasionally corrects himself in real-time. ("He's had
  seven — actually, eight since the trade.")

Both of these are humanizing. Deploy 1–2 per full show.

### 7.4 Breath sounds

ElevenLabs voices include natural breath sounds when `stability` is
below ~0.5. **Keep Reggie's stability below 0.5.** Marc's can sit
higher (0.55–0.70) — his patience reads as breath control.

---

## 8. AUDIO SCORING — CHYRON, DUCK, AND BED

The banter doesn't live alone. It sits inside a broadcast mix. The
generator output must include cues for:

### 8.1 Chyron sync

Every key line should be markable for a lower-third graphic. Include
inline markers:
```
Reggie: {{CHYRON:"THAT'S A HOCKEY GOAL"}} That's a HOCKEY goal, Marc.
```
The frontend uses these to sync chyrons to speech onset.

### 8.2 Ducking

When crowd noise, replay audio, or a highlight clip is playing under
the hosts, script it:
```
Marc: [duck bed -8dB] Watch the setup — three touches, all one-timers.
[/duck]
```

### 8.3 Music bed

Roots mode requires a minor-key music bed. Script the entry and exit:
```
{{BED:enter, roots_theme, fade_in_1500ms}}
Reggie: Kid's from Trois-Rivières…
[full roots beat]
{{BED:exit, fade_out_2000ms}}
```

---

## 9. THE GENERATOR OUTPUT FORMAT

This is the canonical machine-readable format for a banter beat.
`pregame_show.py` and `recap_show.py` should produce dialogue in this
JSON structure so the TTS pipeline can score it precisely.

```json
{
  "segment_id": "recap_2026-02-19_MTL-BOS_goal_1",
  "segment_type": "recap_clip",
  "target_duration_sec": 45,
  "register_target": 8,
  "beats": [
    {
      "speaker": "reggie",
      "text": "OH BABY. Bar-down city.",
      "wpm": 220,
      "register": 9,
      "voice_settings": { "stability": 0.35, "style": 0.70 },
      "pre_pause_ms": 0,
      "post_pause_ms": 800,
      "chyron": "BAR-DOWN CITY",
      "interruption": null
    },
    {
      "speaker": "marc",
      "text": "That's his fourth goal in five games from that exact spot.",
      "wpm": 140,
      "register": 5,
      "voice_settings": { "stability": 0.65, "style": 0.30 },
      "pre_pause_ms": 400,
      "post_pause_ms": 500,
      "chyron": null,
      "interruption": null
    },
    {
      "speaker": "reggie",
      "text": "Marc, you're doing that thing where the spreadsheet ruins the goal.",
      "wpm": 195,
      "register": 6,
      "voice_settings": { "stability": 0.40, "style": 0.65 },
      "pre_pause_ms": 200,
      "post_pause_ms": 400,
      "chyron": null,
      "interruption": null
    },
    {
      "speaker": "marc",
      "text": "The spreadsheet loves that goal. I love that goal.",
      "wpm": 155,
      "register": 6,
      "voice_settings": { "stability": 0.60, "style": 0.35 },
      "pre_pause_ms": 300,
      "post_pause_ms": 600,
      "chyron": null,
      "interruption": { "type": "A", "overlap_ms": 250 }
    },
    {
      "speaker": "reggie",
      "text": "There it is. Attaboy, kid.",
      "wpm": 165,
      "register": 5,
      "voice_settings": { "stability": 0.45, "style": 0.55 },
      "pre_pause_ms": 500,
      "post_pause_ms": 0,
      "chyron": null,
      "interruption": null
    }
  ]
}
```

**Field notes:**
- `wpm` is a *target*, not a hard cap. TTS should approximate.
- `register` (1–10) informs voice-setting selection and prosody.
- `pre_pause_ms` is the silence *before* this beat starts.
- `post_pause_ms` is the silence *after* this beat ends.
- `interruption` describes overlap with the *previous* beat.
- `chyron` triggers lower-third graphic sync on the frontend.

---

## 10. CADENCE GUARDRAILS FOR THE LLM

Include this instruction block in every generator system prompt:

```text
CADENCE RULES — enforce every beat:

1. Reggie's baseline WPM is 180. Marc's baseline WPM is 150. Never
   generate a Marc line that must be spoken faster than 175 WPM to fit
   its target duration.

2. Every Marc contradiction of Reggie must have a pre_pause_ms of
   700–900. This is Marc's thinking pause. It is non-negotiable.

3. No segment exceeds two identity-six catchphrases from either host.
   No segment opens with a catchphrase.

4. Interruption budget per 60 seconds: 2 to 4 total. Zero interruptions
   during Roots mode, injury updates, or signoffs.

5. Register scale is 1–10. Marc caps at 8, and only reaches 8 on a
   plaque-number moment (once per show, maximum). Marc's baseline is
   4–5. Reggie's baseline is 5–6.

6. Register cannot shift more than 3 levels between consecutive beats
   from the same speaker. A 3→9 jump is banned.

7. Silence is a valid beat. Any segment above register 8 should
   include at least one dramatic pause (1200–1800 ms post_pause on the
   goal-call line).

8. Reggie's trail-off (Type C interruption) is his signature move.
   Deploy exactly once per segment above 60 seconds. Script the
   trail-off text with an ellipsis and a spoken "…Marc?" or similar
   hand-off.

9. Never generate perfectly balanced turn-taking. Word count per beat
   should vary: 3–30 words per beat, average 12, with at least one
   sub-6-word beat and one 20+-word beat per 60 seconds of dialogue.

10. Every beat must have a target register, WPM, and pause. If any of
    these are missing from the output, the beat is malformed.
```

---

## 11. THE "DOES THIS SOUND LIKE A BROADCAST?" CHECKLIST

Before shipping any generated audio, listen back and confirm:

- [ ] At least one dramatic pause > 1200 ms in the segment.
- [ ] At least one interruption (Type A, B, C, or D).
- [ ] Word count per beat varies (not all 15-word beats).
- [ ] Reggie's WPM varies by at least 30 across the segment.
- [ ] Marc's WPM stays in the 130–170 band.
- [ ] At least one Marc "thinking pause" before a data point.
- [ ] No back-to-back catchphrases.
- [ ] The last line is a takeaway, not a joke.
- [ ] Total segment length is within ±10% of target.
- [ ] Register scale is respected (no Marc 9s, no Reggie 3-to-9 jumps).

If any two of these fail, regenerate.

---

## 12. VERSION LOG

- **v1.0** — Feb 2026. Initial full Cadence & Performance Bible.
  Defines WPM targets, pause lexicon, interruption model, emotional
  register map, laugh policy, broadcast texture cues, audio scoring
  markup, and generator JSON output format. Companion to
  `BANTER_BIBLE.md` (content) and `CHARACTER_STYLE_GUIDE.md` (voice
  canon).

*Next steps for main agent:* Wire this spec into `pregame_show.py` and
`recap_show.py` so their Claude prompts emit the JSON format in
Section 9 and the TTS pipeline in `voice_service.py` honors every
field (WPM approximation via voice_settings, pauses via `<break>`
tags, interruptions via overlap scheduling, chyron sync via markers).
