# The Ticker — Highlightly Integration & Recap Experience

**Status:** SPEC FILED — Build starting Feb 2026
**Pillar Priority:** Co-equal with Predictions/Team-vs-Team (both are front-door pillars, neither buried)
**Feature Type:** PILOT — must be toggleable/removable without breaking rest of app

---

## 1. Overview & Goal

Launch a "sports desk" style game recap/highlight experience featuring AI hosts Reggie and Marc, powered by real game footage from Highlightly.

**Pilot framing:** Build it, test it, have a clean toggle to remove/revert if it doesn't land.

**Two co-equal core pillars of The Ticker:**
1. **Predictions** — next-game analytics, the team-vs-team breakdown (in dev)
2. **Recaps** — game highlights (this document)

**Core positioning:** Fans come to The Ticker's AI hosts for highlights *because it's more entertaining* than a plain highlight reel — production quality, pacing, and personality-driven humor must feel deliberate, not generic AI voiceover slapped on clips.

---

## 2. Placement in App

- **Landing page unchanged.** No highlight video on Home — remains the existing multi-sport panel talking-points entry.
- **Recaps/Highlights gets its own dedicated section/page**, separate from Predictions/Team-vs-Team.
- Page must clearly explain free vs. premium (see §6).
- **Bi-directional handoff:** each recap's closing teases the next matchup and links into that game's Predictions page; Predictions pages link back to relevant recaps.

---

## 3. The Recap Format ("Sports Desk" Style)

Modeled on TSN/ESPN-style desk segment. **Target length: ~2 minutes per game.**

**Structure:**
1. **Commentary intro** — Reggie & Marc set up what mattered
2. **The clips** — video-forward, LARGE and prominent on screen (video is the visual star, not a small inset next to hosts)
3. **Light commentary during clips** — energy up, but not talking over every second
4. **Big moments get real game sound, not commentary** — on goals, highlight-reel saves, big hits: hosts go QUIET, let broadcast/crowd/arena sound carry the moment, react a beat AFTER ("DID YOU SEE THAT—")
5. **Fun closing bit** — light, personality-driven wrap
6. **Post-game stats** — quick, visual stat rundown
7. **Teaser into next game** — short handoff to that matchup's Predictions page

### Audio Requirement (NON-NEGOTIABLE)
Must work as a **complete audio-only experience**. Phone in pocket, no screen — user never loses the story. At every moment, either commentary OR real game sound must be present and meaningful. **NEVER dead air.**

### Story Opportunity Score (0–100)
Every clip scored to drive production depth:
- **0–30:** minimal or no commentary — clip + game sound only
- **31–60:** light reaction line
- **61–80:** fuller commentary with context on why it matters
- **81–100:** full "big moment" treatment — energy building in, quiet during peak action, big reaction after, possible replay/telestrator callback

Standouts feel special. Not every clip identical.

---

## 4. Team- and Player-Specific Humor — Joke Bank

Reggie & Marc's commentary must include jokes/references specific to teams/players involved — genuine differentiator, not nice-to-have.

**Structured "Joke Bank" per character:**
- Tagged by **team, player, storyline** (scoring streak, rivalry, recent trade)
- Each character pulls from + remixes tagged content, not fully improvising live
- Keeps humor in-character; content is refreshable as real storylines develop; avoids stale/generic AI humor
- **Distinct comedic voice per character.** Reggie and Marc do NOT pull from same pool interchangeably. Voice consistency > joke volume.
- Draws on existing **Hockey Slang Database** (tagged term bank by era/region/popularity) — NOTE: database has NOT yet been shared with Emergent. Will need to be provided as part of this build.

---

## 5. Highlightly Integration — Pilot Approach

**Loosely coupled / swappable.** Do not deeply wire APIs throughout the app in case footage quality/coverage doesn't hold up and a different provider needs testing later.

**Build requirements:**
- Video/highlight layer is a **toggleable module** — flip off cleanly → reverts to existing audio-first panel format with no breakage.
- Isolate all Highlightly calls behind a service layer / adapter interface.

**What we need to learn from real data:**
- Clip segmentation: discrete short clips per event (goal/save/hit — PREFERRED, lets us assemble our own paced 2-min cut) vs. one long pre-edited reel
- Original broadcast/crowd audio intact on clips? Or do we need separate ambient/crowd sound layer?
- Turnaround from final whistle → clip availability
- Resolution + aspect ratio at real mobile size
- Clips tagged by player/team/situation? (needed for on-demand feature §6)
- Coverage: every game or only marquee?

**Evaluation criteria (define before full build-out):**
- Test window + success criteria
- Compare engagement/watch-time on highlight-powered recap vs. existing audio-only panel over defined period
- Decision: keep, iterate, or pull

---

## 6. Premium Tier: On-Demand Clip Analysis

- **Premium:** request feature on Recaps page — type in a specific player/moment/situation, Reggie/Marc pull + analyze that specific clip on demand. Interactive version of the standard recap.
- **Free:** standard ~2-min recap only.

---

## 7. Build Priority (as specified by user)

1. Confirm Highlightly's actual clip format/audio/tagging (§5) before deeper build-out
2. Toggleable video/highlight module wrapping existing panel show logic
3. Story Opportunity Score logic tying clip significance to commentary depth
4. Joke Bank structure (even small seeded version) so commentary isn't generic
5. Recaps page UI (free tier first, premium on-demand second)
6. Handoff links between Recaps and Predictions/Team-vs-Team pages

---

## 8. Implementation Plan (Emergent-side)

### Phase 1 — Scaffold (this build)
- [ ] New route `/recaps` in React app + nav entry co-equal with Predictions
- [ ] Backend `routes/highlights.py` — Highlightly adapter service, feature-flag toggle
- [ ] Env var `HIGHLIGHTLY_API_KEY` + feature flag `HIGHLIGHTS_MODULE_ENABLED`
- [ ] Recaps page UI: game list → recap player (video-forward, hosts as inset/lower-third)
- [ ] Story Opportunity Score data model + seed scoring rules
- [ ] Joke Bank JSON seed structure (`/app/memory/joke_bank/*.json` by character/team/player/storyline)
- [ ] Free-tier standard 2-min recap flow
- [ ] Bi-directional link stubs: recap → predictions page, and predictions → recap

### Phase 2 — after data validation
- Real Highlightly clip ingestion + assembly
- Commentary generation tuned to Story Opportunity Score
- Premium on-demand clip analysis
- Engagement analytics for pilot evaluation

### Phase 3 — after "Launch analytics North Star"
- Merge real NHL data with recap stat rundown
- Storyline detection from real data feeds Joke Bank tags

---

## 9. Data Models (proposed)

```
recap {
  id, game_id, home_team, away_team, final_score,
  clips: [clip_id...],
  duration_sec, generated_at, status
}

clip {
  id, game_id, event_type (goal|save|hit|penalty|other),
  player_ids[], team_id, timestamp, video_url, audio_intact:bool,
  story_opportunity_score (0-100),
  commentary_depth (silent|reaction|context|big_moment)
}

joke_bank_entry {
  id, character (reggie|marc),
  tags: {team[], player[], storyline[]},
  content, tone, era, region, freshness_date
}
```

---

## 10. Kill-switch / Rollback

- Env flag `HIGHLIGHTS_MODULE_ENABLED=false` hides `/recaps` route + nav entry
- Backend adapter returns null → frontend falls back to audio-only panel format
- No orphaned DB rows: recaps table is additive, non-destructive
- Existing app functionality untouched
