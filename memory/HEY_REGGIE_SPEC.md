# Hey Reggie — Voice Assistant + Audio Cache Architecture

**Build spec | Location: Ambient voice layer + backend cache infrastructure | Status: DEFERRED post-MVP (audio cache foundation OK to lay in during MVP)**

## The one-line pitch

> *"Say 'Hey Reggie' anywhere in the app — he answers back in his voice, and it costs almost nothing because we only pay for genuinely new questions."*

Two systems working together: **(1)** wake-word triggered voice interaction; **(2)** semantic answer cache so cost scales with *distinct questions asked*, not *number of users*.

---

## 1. Wake-Word Interaction

### 1.1 Trigger — on-device only
- iOS: `SFSpeechRecognizer` · Android: `SpeechRecognizer` · cross-platform: **Picovoice Porcupine** (recommended — proven wake-word engine, <1MB model, offline)
- Runs entirely on-device — **no API call, no cost** until the phrase fires
- Foreground-only listening (respect OS background rules + battery)

### 1.2 Active session window
- Wake-word fires → open **45-second listening window** (not one-shot)
- User can ask follow-ups without repeating "Hey Reggie"
- Window **extends by +30s** each time user speaks
- Auto-close on timeout → Reggie goes idle
- **"Hey Reggie" during Reggie's own answer**: interrupt immediately, stop audio, play cached interjection ("Yeah?"), begin listening

### 1.3 Explicit stop
- Voice: "That's it, Reggie" / "Stop, Reggie"
- UI: stop button — always visible while session is active
- Both end the mic + close session

### 1.4 "Full go" ambient mode (optional, later phase)
- Opt-in mode: Reggie proactively comments while user browses
- Clearly flagged in UI as higher-cost
- **Rate-limit** to N proactive comments per session regardless of tier (prevents annoyance + bounds cost)

---

## 2. Audio Cost Architecture

**Core principle**: only pay for genuinely new speech. Reuse everything else.

### 2.1 Three tiers of content

| Tier | Description | Generation | Examples |
|---|---|---|---|
| **Static library** | Fixed catchphrases, transitions, idle acks | Pre-generated once, stored as files | *"Stick on the ice"*, *"Here's the scoop"*, *"Yeah?"*, intros/outros |
| **Cached dynamic** | Answers to common questions | Generated once on first ask → reused forever | *"How's our power play doing?"*, *"Who's leading in points?"* |
| **Live / unique** | Truly one-off, personalized, or time-sensitive | Generated fresh every time | User-specific questions, in-game callouts |

### 2.2 Static library
- Tagged bank of Reggie's recurring lines from the Character Style Guide (§ 6 Reggie Voice Canon)
- Stored in cloud storage (S3-compatible), keyed by stable IDs
- Playback = file fetch. **Zero incremental cost.**

### 2.3 Self-growing answer cache (the key system)

**Flow:**
1. User asks a question (voice or text)
2. Embed the question (text-embedding model, e.g. OpenAI `text-embedding-3-small`) → vector representation
3. Cache lookup: semantic search for similar existing question (cosine similarity > 0.90)
4. **Cache hit** → play stored audio. Zero LLM + zero TTS cost.
5. **Cache miss** → generate answer (LLM → TTS) → store `{question_embedding, canonical_text, answer_text, audio_url, freshness_category, last_generated_at, hit_count}`

**Freshness categories** (set at generation time):

| Category | Behavior | Examples |
|---|---|---|
| `evergreen` | Never expires | Rules, historical facts, bio |
| `daily` | Regenerate once/day | Standings, streaks, "leading in X" |
| `live` | Do not cache (or TTL < 5 min) | In-game score/event-dependent |
| `personalized` | Cache **per user**, not globally | User's team/history/edge |

**Storage schema** (Postgres with pgvector recommended):

```
answer_cache
  id                 UUID PK
  question_embedding VECTOR(1536)      -- pgvector index
  canonical_question TEXT
  answer_text        TEXT
  audio_url          TEXT
  freshness_category ENUM(evergreen|daily|live|personalized)
  last_generated_at  TIMESTAMPTZ
  hit_count          INTEGER
  user_id            UUID NULL          -- non-null only for `personalized`
```

**Cost implication**: popular questions get asked constantly. Once cached, they cost $0 on repeat regardless of how many users. Cost scales with **distinct questions**, not sessions.

### 2.4 Segment production (e.g. 20-min game recap)

- Recap = **template with slots**
- Fixed transition audio (static library) + dynamic slots (live generation for today's specific content)
- Server-side audio splicing (**`pydub`** in Python) — natural pacing between clips, no robotic seams
- Only the dynamic slots hit ElevenLabs each day; the rest reuses static assets

---

## 3. What Emergent builds

1. **On-device wake-word listener** — session state machine (open / extend / close / interrupt)
2. **ElevenLabs integration** — already live in `voice_service.py`, needs to grow into this framework
3. **Text embedding + vector search** — pgvector on Postgres OR hosted (Pinecone/Weaviate for scale)
4. **Cache read/write** — with freshness-category rules
5. **Cloud storage** — S3-compatible for audio files (currently: `/app/backend/static/audio/`)
6. **Audio stitching** — `pydub` service for segment assembly
7. **Analytics dashboard** — cache hit rate, daily generation cost, most-asked questions

---

## 4. What's ALREADY in place (Feb 2026)

Foundation exists — some of this doesn't need to be built from scratch:

- ✅ **Content-hash audio cache** — `voice_service.ensure_audio()` already keys generated MP3s by SHA-1 of `analyst_id + text`. Identical text = zero regeneration cost. This is the *exact-match* precursor to semantic-match cache.
- ✅ **Voice profile archive** — `voice_profiles.json` preserves every voice tried, cleanly swappable.
- ✅ **Daily budget guard** — `/api/tts/budget` alarm caps daily char usage. Prevents runaway costs even before the semantic cache lands.
- ✅ **Static library seed** — 22 pre-recorded panel clips (April 8 wildcard) + 8 idle-host clips already sit in `/app/backend/static/audio/`. Same architecture as the tier-1 static library described here.

**What's genuinely new work** for the full spec:
- Semantic embedding layer + vector store (biggest infra add)
- Freshness-category tagging + expiry logic
- On-device wake-word (biggest client-side lift, likely needs native mobile app)
- Audio stitching pipeline (`pydub`, medium)

---

## 5. Web vs. Native — a note on wake-word

**"Hey Reggie" as spec'd requires native mobile** (iOS/Android). Reason: browser wake-word is limited — the Web Speech API works only while page has explicit mic permission AND requires the tab to stay foregrounded, and quality is significantly worse than Porcupine on-device.

**Phasing options:**

- **MVP web**: skip wake-word entirely. Ship a big *"Talk to Reggie"* button that opens a mic session (single tap → open 45s window, all the follow-up rules apply). No always-listening. Same UX inside the window.
- **Native mobile (Phase 2)**: Porcupine + native SDKs + true always-listening.

The **audio cache architecture ships independently of the wake-word** — build the cache first, wire it under the existing `/api/ask/stream` endpoint. Wake-word is UI on top.

---

## 6. Success metric

**Cache hit rate** — the single number that tells you whether the cost model is working.

- Launch: low (small cache)
- Week 4: 30-50% (popular questions accumulating)
- Month 3+: **60-80% target** — indicates the semantic cache is doing its job

Track daily. Alert if it drops (indicates cache poisoning, embedding drift, or freshness rules too aggressive).

---

## 7. Legal / Privacy

- **Always-listening wake-word** requires explicit user opt-in with clear disclosure that the mic is on
- On-device processing is the privacy story — nothing goes to a server until wake-word fires
- Retain user question audio? **No.** Store only the embedded representation + text; discard raw audio
- Personalized cache = tied to user account = deletable in the "Remove all Betting IQ data" flow

---

## 8. Phasing

1. **MVP now**: keep the current content-hash audio cache. Ship the *"Talk to Reggie"* single-tap button (web). No wake-word yet.
2. **Post-MVP Phase 1 — Semantic cache**: build pgvector + embedding + freshness rules. All the existing text ask questions start populating the cache. Cache hit rate becomes visible in an admin dashboard.
3. **Post-MVP Phase 2 — Static library expansion**: pre-generate Reggie's entire Voice Canon (§ 6 of Character Style Guide) as static assets. Rack up hundreds of ready-to-play catchphrases.
4. **Post-MVP Phase 3 — Segment stitching**: `pydub` pipeline for daily recap shows composed from static + dynamic slots.
5. **Post-MVP Phase 4 — Native mobile**: iOS/Android app with Porcupine wake-word. This is when *"Hey Reggie"* actually ships.
