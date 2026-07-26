# The Ticker — PRD (Product Requirements Document)

## Product Law — LOCKED 2026-02-25 (reframed 2026-02-26)

### Freemium model — the DEPTH GATE, not a wall
Free tier stays generous forever. **Premium unlocks depth, not access.**
No visit counters, no tapered show, no hard walls. Every user gets full
show, unlimited predictions, and standard Presser — always. What they
pay for is DEPTH: advanced analytics, historical tracking, insider
segments, betting/fantasy intelligence, custom alerts.

### Free vs. Premium mapping (first draft — iterate as we build)
| Feature | Free | Premium |
|---|---|---|
| Live show / broadcast | Full | Full |
| Presser chat | Basic replies | Extended: memory + follow-ups + longer answers |
| Matchup Deep Dive | Hero + Ticker Intelligence summary | All 20 categories + factor drill-down |
| Skaters/Goalies/Standings | Full | Full |
| Predictions | Unlimited | Unlimited |
| Edge Score | Your % only | Trend + rank + Reggie head-to-head |
| Consensus Model | — | "Reggie says X, Marc Y, AI Z, crowd W" |
| Prediction history | Last 10 | Full season + streak analysis |
| Premium R&M segments | — | Insider episodes, extended Q&A |
| Fantasy tools | Roster save | AI start/sit + waiver + trade analyzer |
| Betting tools | — | Line movement, sharp splits, CLV |
| Custom alerts | — | Lineup, line, injury alerts |

### Pricing (two-tier — matches the two-audience split)
- **$3.99/mo — "The Show Pass"** — full show + banter + character canon (casual/humor audience)
- **$14.99–24.99/mo — "The Edge"** — everything above + all Premium features from the table (bettor/analytics audience)
- **Founding Member locked-in-for-life at $3.99/mo** — first 5,000 users only (creates launch urgency)
- **Annual option**: 17% off (~2 months free)

### Product loop (the daily engine)
1. User opens app at 5pm → **Show** (Reggie + Marc analyze tonight's slate)
2. Show ends with **"Make Your Picks →"** CTA
3. User makes **Game Picks** + tries **Pick 10**
4. Tomorrow: user sees their W/L vs. Reggie → drives return
5. Streaks + Edge Score + leaderboard → drives social sharing

### Presser scope (MVP)
- **Reggie-only** for MVP. Marc plumbing kept intact for future re-enable.
- Post-MVP: expand to ~10 characters (Tank, Lou, Cody, Marc, etc.)

### Deferred to Post-MVP (see `/app/memory/BETTING_IQ_SPEC.md` and `/app/memory/COMMUNITY_EDGE_SPEC.md`)
- **The Ticker Betting IQ** — named proprietary product with 4 components: **Bet Log** · **Personal Edge** · **Betting DNA** · **Betting Coach**. Turns The Ticker from predictor into *coach* — analyzes both the game and the person making the prediction. Includes mandatory confidence bands, prediction-vs-profitability separation, user privacy controls, responsible-play guardrails (never says "bet heavily" / "recover losses" / etc.), and progressive-specificity comparable-bet definition. Lives in Back Office as its own tab. **Requires separate legal review** — personalized "bet this / skip this" is a different regulatory category than general prediction content.
- **The Ticker Community Edge™** — the social layer. Public profiles with **Verified Edge per category** (not overall accuracy), auto-generated Team & Category Specialists leaderboards, follow-predictors mechanics with configurable notification thresholds (post / agreement / contrarian), Trust Score composite ranking (accuracy + ROI + sample + consistency + recency + diversity + verified history), Strength Breakdown showing both edges *and* weaknesses ("Don't follow them for player props"), communities/groups/leagues, reputation badges earned through verified performance. **Own legal review required** — public financial claims, copy-picks / tout-service considerations, cross-user data visibility, verified-history tamper resistance. **Ship AFTER Betting IQ Phase 1 has enough per-user history to produce credible per-category leaderboards** — empty leaderboards make the product look dead.

## Vision
AI-powered NHL broadcast MVP with a two-host panel (Reggie Banks + Marc
Collins). TV-quality feel, real NHL data, ElevenLabs-voiced audio,
podcast-cadence banter, 1-on-1 press-conference deep dives, personal
fantasy back-office, subscription foundation with affiliate rails.

## Architecture (locked)
- **Home** (`/`) — Continuous broadcast, auto-advances through topics, tap ticker to jump.
- **Presser** (`/press-conference`) — 1-on-1 deep dives + 3-free-question soft nudge.
- **Stats** (`/stats`) — Public NHL.com-style leaders / standings / schedule.
- **Fantasy** (`/fantasy`) — Roster editor + AI insights + DK/Sleeper/Yahoo/ESPN affiliate rail.
- **Login** (`/login`) — Notify-me + Founding Member activation stub.
- **Desk preview** (`/desk-preview`) — Hidden dev QA page for all camera shots.

## Character Style — LOCKED to hero art
- Canonical: `reggie_hero_crop.png` + `marc_hero_crop.png` (painterly Pixar-adjacent 3D)
- Full style guide at `/app/memory/CHARACTER_STYLE_GUIDE.md` — hand to ChatGPT for future expression sheets
- Archives: `_legacy_v1/` (older cartoon), `_realistic_v2_archive/` (off-style contact sheets)

## Shipped this session
- ON MIC banner removed → minimal in-frame speaker badge
- Show topics moved into ticker as clickable scrolling lane
- Top nav: Broadcast · Presser · Fantasy · Stats · Login
- LiveDesk audio scheduler v3: two-audio ping-pong + preload + 400ms default overlap + tighter pace cues (breath 320, land 180, beat 60)
- FFmpeg silence-trim on all new ElevenLabs clips
- Continuous flow: end of one topic auto-advances to next
- Stats page — NHL-style skater/goalie leaders, standings, schedule
- Fantasy page — league name + scoring + 6-row roster + favorite teams + notes + heuristic insights + affiliate rail
- Subscription foundation (mock) — device-based counter, upgrade modal, activation endpoint, roster persistence in Mongo
- "Jump in — ask the desk" removed from Home; Presser only
- Hero portraits + composed studio unified to canonical style
- Contact-sheet slicer script (`scripts/slice_contact_sheet.py`) for future updates
- Character style guide document created

## Known Blockers
- **Recurring**: ElevenLabs credits burn on any regeneration. Cache is respected on replay; new lines only cost when generated fresh. Verify credits are on the workspace whose key sits in `/app/backend/.env`.

## Priority for tomorrow
1. **P0 — Podcast structure refinement**: Crisper timing/delivery. Banter jabs at open + close of each segment; one host carries the meat of the middle with the other doing short reactions only ("Hmm", "Wow", "C'mon").
2. **P0 — Expand shot cueing in `analysts.py`**: Use the richer camera roster (`two_arguing`, `two_hot_take_clash`, `two_punchline`, `two_signoff`) once expression sheets are re-shot in hero style.
3. **P1 — Voice Input on Presser**: Web Speech API default + Whisper fallback via Emergent LLM Key.
4. **P1 — Real Stripe subscription plumbing** ($3.99/mo Founding Member) with paywall OFF until launch.
5. **P1 — Free NHL Stats API** (`api-web.nhle.com`) for player-level analytics.
6. **P2 — Fantasy AI engine**: Replace heuristic insights with real Claude-driven start-sit calls from saved roster.
7. **P2 — Cost safety net**: Daily character-budget alarm on ElevenLabs; fall back to captions past a threshold. **✅ DONE 2026-02-25** — 20k chars/day cap, `/api/tts/budget` endpoint, tunable via `ELEVENLABS_DAILY_CHAR_LIMIT`.

## Backlog
- Additional hosts (Tank, Lou, Cody) — deferred
- Community forums, prediction tracking — deferred
- Real fantasy platform sync (Sleeper → Yahoo → ESPN OAuth) — deferred
- Push notifications for anomaly flags — deferred
- 3D/video avatars — deferred (budget protection)

## Change Log
- **2026-02-25** — **Matchup Deep Dive page shipped** at `/matchup/:matchupId` — full 20-category framework from `MATCHUP_ANALYTICS_SPEC.md`. Hero (score, teams, storylines) → AI Game Story (LLM-streamed + voiced with the new Reggie voice) → **Ticker Intelligence Dashboard** (8 composite gauges: Momentum · Confidence · Fatigue · Clutch · Chemistry · Pressure · Coaching Edge · Injury Impact) → **Factor Importance Ranking** (top 5 weighted, the "Holy Grail") → 20-category accordion → Ask Reggie footer with prefilled matchup Qs. Data hardcoded for 3 April 8 2025 matchups (BOS-NJD, NYI-NSH, VGK-COL). MatchupInsight card on Home now inserted above LiveDesk and Deep Dive CTAs link to the new page. SEO-friendly URLs — every matchup is a shareable Twitter/Discord link (acquisition play).
- **2026-02-25** — Reggie now speaks his Presser replies via TTS through the new voice.
- **2026-02-25** — April 8 2025 Wildcard Night 22-turn panel show built with real games (BOS@NJD, NYI@NSH, VGK@COL) + real stats from `api-web.nhle.com`; all 22 audio clips pre-cached (~2,200 chars, verified live); set as default Home topic.
- **2026-02-25** — Presser locked to Reggie-only for MVP; analyst switcher UI removed; `?analyst=marc` URL trick disabled; multi-analyst state plumbing kept intact for future 10-character expansion. Product Law section added to PRD locking freemium mechanic (progressive Founder Trial ratchet), two-tier pricing ($3.99 Show Pass / $14.99-24.99 The Edge), Founding Member 5,000-seat cap, "The 90" compressed comedy show for free tier.
- **2026-02-25** — Presser empty-state data card replaced with Back Office mini-ticker (Accuracy · Banners · Top Team), each row deep-links to `/back-office`; graceful hand-off to real stat card when a question is asked.
- **2026-02-25** — Reggie Banks voice canon fully expanded — 12 categories baked into `system_prompt` (signature calls · player philosophy · vet takes · lazy play calls · praising · roasting Marc · agreeing with Marc · emotional/kids core · ex-player insider · trade/GM takes · situational Reggieisms · signoffs); `/app/memory/CHARACTER_STYLE_GUIDE.md` § 6 added. Marc canon extended with 5 new situational categories (close games · records · young players · standings-lie · momentum shifts). Live smoke test confirmed both hosts speaking authentically in-character.
- **2026-02-25** — Back Office page shipped at `/back-office` — 6 tabs (Picks · Edge Score · Fantasy · Social · Preferences · Membership); Presser locked to 3-section layout with sticky sub-nav (Deep Dive · Analytics · Games); "Deep Dive Analytics" section renamed to "Analytics"
- **2026-02-25** — Marc Collins voice canon locked in (patient, curious, wise — the audience-smartener); expanded `system_prompt` in `analysts.py`, added full Marcism quote bank to `CHARACTER_STYLE_GUIDE.md`, updated tagline + loading lines + fallback replies; daily ElevenLabs character-budget alarm live at `/api/tts/budget` (75k chars/day, ELEVENLABS_API_KEY refreshed, audio pipeline verified end-to-end)
- **2026-02-24** — Character style locked to hero art; contact-sheet slicing pipeline; style guide document
- **2026-02-24** — 5-page nav, topics-in-ticker, subscription foundation, Stats + Fantasy pages, DK/Sleeper affiliate rail, tighter audio scheduler, silence-trim
- **Earlier** — Studio UI, Tap-to-Join, cold opens, ElevenLabs voice casting, SportsData.io ticker
