# Ticker Pro Game-Surface Proof — Component Reuse Report

**Slice:** `/iq/game/:gameId` — single-game convergence proof (Best Ticker + Betting IQ overlay).
**Built:** 2026-02-14.
**Boundaries observed:** No 1A/1B/1C changes. No Atlas changes. No Special Teams engine. No fake Market data. No fake Sportlogiq analytics. No duplicate game/team/player identities. No Team Navi changes. No deletion of existing Betting IQ v2 surfaces (`TonightHero`, `GameRailV2`, `MatchupIntel`, `MatchupStats` all still shipping in `/iq?tab=tonight`).

---

## 1. Layout rhythm (matches the approved convergence brief)

| Position | What renders | Source |
|---|---|---|
| Sticky header | Back to Betting IQ + "**BETTING IQ · ON**" mode badge | New (`TickerProGame.jsx`) |
| Hockey identity | Home logo · time · your-pick tile + orange grade bubble | **`GameHub` — reused unchanged** |
| Reggie + Marc pregame | Play/Pause audio player + captioned Reggie hook + Marc read + rotating stat callouts | **`GameHub` — reused unchanged** |
| Head-to-head snapshot | Season · Head-to-Head table (goals/GP, GA/GP, shots, PP%, PK%, faceoff, sv%, L10) | **`GameHub` — reused unchanged** |
| Panel picks | Reggie: EDM · Marc: COL · Ticker Model % (when present) | **`GameHub` — reused unchanged** |
| **The Read Triangle** | TICKER IQ % · MARKET (locked) · COMMUNITY % — three legs | **New overlay** (`BettingIQOverlays.jsx`) |
| **My Call State** | Your Tonight's 10 pick for this game + LOCKED / RIGHT / MISS badge | **New overlay** (`BettingIQOverlays.jsx`) |
| **Hockey Intelligence rail** | 1 live · 9 pending providers · Overview lens body | **New overlay** (`BettingIQOverlays.jsx`) |

---

## 2. Reuse status per component

| Component / surface | Status | Notes |
|---|---|---|
| `pages/TickerProGame.jsx` | **NEW** — 130 lines | Betting-IQ-specific host page. Renders GameHub + overlays. |
| `components/GameHub.jsx` | **REUSED UNCHANGED** | Renders full Best Ticker game body: matchup, R+M pregame script + voice, head-to-head, panel picks, Ticker Model %, "Ask Reggie", "Full game hub" link. |
| `components/StatCallouts.jsx` | **REUSED UNCHANGED** | Rotating stat pills inside GameHub. |
| `lib/teamLogos.jsx` (`TeamLogo`) | **REUSED UNCHANGED** | Every crest across the page. |
| `lib/brand.jsx` (`TMark`) | **REUSED UNCHANGED** | Back-nav mark in header. |
| `lib/api.js` | **REUSED UNCHANGED** | `/predictions/games`, `/stats/teams`, `/predictions/mine`, `/iq/board`. |
| `lib/device.js` (`getDeviceId`) | **REUSED UNCHANGED** | Anonymous device identity for `/iq/board`. |
| `lib/teamColors.js` (`teamGlow`) | **REUSED** (added earlier in this session) | 32-team atmosphere palette for the Read Triangle logos + MyCallState glow. |
| `components/iq/v2/BettingIQOverlays.jsx` | **NEW** — `ReadTriangle`, `IntelligenceRail`, `INTELLIGENCE_LENS_REGISTRY`, `MyCallState` | Betting-IQ-native overlays. `INTELLIGENCE_LENS_REGISTRY` codifies availability tiers per the audit. |
| `components/iq/v2/TonightHero.jsx` | **PRESERVED** (retirement candidate) | Still rendering on `/iq?tab=tonight`. Retire only after convergence proof approval. |
| `components/iq/v2/GameRailV2.jsx` | **PRESERVED** (retirement candidate) | Still rendering on `/iq?tab=tonight`. |
| `components/iq/v2/MatchupIntel.jsx` | **PRESERVED** (retirement candidate) | Still rendering on `/iq?tab=tonight` under the new "Ticker Pro · preview" entry link. |
| `components/iq/v2/MatchupStats.jsx` | **PRESERVED** (retirement candidate) | Rendered inside MatchupIntel. |
| `components/iq/v2/MyIQCommandCenter.jsx` | **REUSED UNCHANGED** | My IQ still uses the recent "LOGOS. REGGIE. MARC. FUN." redesign. Untouched by this slice. |
| `components/iq/v2/TonightsTenLoop.jsx` | **REUSED UNCHANGED** | Fast prediction loop. Untouched. |
| `pages/HockeyIQ.jsx` | **REUSED, ONE ADDITIVE EDIT** | New "Ticker Pro · preview" link inserted above `MatchupIntel` on the Tonight tab so the proof is discoverable. |
| `App.js` | **REUSED, ONE ADDITIVE EDIT** | New route `/iq/game/:gameId → TickerProGame`. |

---

## 3. Data honesty per surface element

| Element | Data source | Tier |
|---|---|---|
| Home/Away identity, kickoff time | `GAMES` fixture (canonical Ticker games) | ✅ Available now |
| Reggie/Marc pregame hook + read | `/api/tonight/segment` (Claude via Emergent LLM key) + ElevenLabs TTS | ✅ Available now, honestly labelled Pregame |
| Panel picks | Hand-authored per game in `analysts.py` | ✅ Available now |
| Ticker IQ 58% | `game.ai_consensus` — editorial pre-model | ✅ Available now, labelled `Editorial · pre-model` |
| **Market % / Market chip** | ❌ Not wired | 🔒 **Renders LOCKED with reason: "Odds provider not connected"** |
| Community 80% (5 preds) | `db.predictions` aggregate on `/predictions/games` | ✅ Available now |
| My Call State ("You called COL · LOCKED") | `/iq/board` → user's `pick10_entry` call | ✅ Available now |
| Head-to-head snapshot rows | `/stats/teams` (SportsData.io when live, seed today) | ✅ / 🟡 rows without data render "—" instead of a fabricated number |
| Overview lens rows | Derived on the client from real GP / GF / GA / W / L / OTL / Pts | ✅ / 🟡 Derived-now (Record, Points, Goals/GP, GA/GP, Goal Diff) with visible provenance line: `"Verified · Season to date · Derived per-game rates from real GP/GF/GA"` |
| Intelligence lens rail — Offense / Defense / Transition / Puck Management / Possession / Net Front / Special Teams / Goaltending / Discipline | 9 lenses architecturally present in `INTELLIGENCE_LENS_REGISTRY` with `data_tier` metadata | ❌ **Do NOT render on the customer-facing rail.** The header states `1 live · 9 pending providers` so the intended engine is visible without any fabricated number. |

**No fabricated Market probability.**
**No fabricated Sportlogiq metric.**
**No fabricated advanced analytics.**

---

## 4. Retirement candidates (deferred per user brief)

The following v2 components duplicate work already in Best Ticker but remain shipping until this proof is approved:

- `iq/v2/TonightHero.jsx`
- `iq/v2/GameRailV2.jsx`
- `iq/v2/MatchupIntel.jsx`
- `iq/v2/MatchupStats.jsx`

They will be retired **only after** an explicit approval to converge the Tonight tab onto `GamePickerStrip` + `TickerProGame` (Section 5 of the convergence audit).

---

## 5. Verified on phone (~390px)

Screenshots captured in this session:
- Header + GameHub top (matchup identity + R+M pregame player).
- GameHub middle (head-to-head + captions).
- Read Triangle (Ticker IQ 58% · Market NOT WIRED · Community 80%).
- MyCallState card (You called COL · LOCKED).
- Hockey Intelligence rail + Overview lens body (COL vs EDM real derived stats with green-emphasis on the better side).

Every element renders without fabrication. Every gap is honestly acknowledged.

---

## 6. Next possible propagation targets (only if this proof is approved)

Per Section 5 of the convergence audit:
- **TEAM** — `TeamStatPage` / `plus/TeamPage` + `TeamIQOverlay` (aggregated Read Triangle across upcoming games, team lenses, personal record vs this team).
- **PLAYER** — `PlayerDetail` / `PlayerProfile` + `PlayerIQOverlay` (relevant props locked until Market feed lands, role read, personal record on player-attribute calls).
- **RECAP** — `RecapShow` + `<RecapIQSegment>` beat inserted into the existing show sequence (What Ticker thought / Market thought / Community thought / You picked / What actually happened / What we learned).
- **STATS** — `Stats` explorer + IQ category filters, deep-link into the same overlays above.

**Awaiting approval before touching any of those.**

---

**End of component-reuse report.**
