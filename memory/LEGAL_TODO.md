# LEGAL TODO — Pre-Launch Cleanup

**Owner**: Founder (with legal review)
**Blocking**: Public launch of Ticker+ / CHL / NCAA verticals

## Team Logos & Marks

The Ticker+ cascade (CHL divisions, NCAA conferences, team pages, prospect
pages) currently displays team logos sourced from **Wikipedia
Special:FilePath URLs** (`https://en.wikipedia.org/wiki/Special:FilePath/*.svg`).

**Legal posture today**: editorial / nominative fair use. This is generally
defensible for identification purposes in a sports commentary product (same
posture as ESPN, TSN, Sportsnet), but it is **not licensed** and every
team logo on file remains the trademarked property of the team.

**Every team affected** — all CHL teams (WHL / OHL / QMJHL) and NCAA
schools rendered via the `<TeamLogo>` component in
`/app/frontend/src/components/plus/TeamLogo.jsx`.

### Must do before public launch

1. **Team-direct brand kits** — reach out to each pilot team (starting with
   Kamloops Blazers) for their official brand kit + written permission to
   use marks in-app. Junior teams almost always say yes when the ask comes
   with a partnership pitch (they want the exposure).
2. **NCAA schools** — most schools have athletics-department media kits
   with an editorial-use permission attached. Easier than pro teams.
3. **Licensed data provider fallback** — subscribe to Highlightly Pro or
   Sportradar for CHL/NCAA coverage. Their team-metadata endpoints include
   licensed logo URLs, which removes the fair-use exposure entirely.
4. **Swap the source** — with brand kits in hand, host the licensed assets
   on our own CDN (or use the provider CDN) and update the `logoUrl`
   values in `/app/frontend/src/data/tickerCatalog.js`.
5. **Delete this file** once the swap ships to production.

### Where the risk is right now

- **Public site**: `/plus/*` routes render logos via `<TeamLogo>`.
- **Marketing / press**: any screenshot of the Ticker+ product that shows
  a logo. Fine for internal decks and partner pitches; risky in paid ads.
- **App stores**: iOS / Google Play submissions with team logos in
  screenshots are the most likely to draw a takedown request. Handle
  before submitting.

### The safe-fallback that already exists

If any single logo URL fails to load, `<TeamLogo>` gracefully falls back
to a coloured initial badge (e.g. orange "KAM"). So legal takedowns of a
specific URL don't break the app — they just downgrade that team to the
badge visual until we replace the URL. That's the intended containment.

## Reggie & Marc voices (ElevenLabs)

Existing ElevenLabs voice cloning agreements govern Reggie and Marc voice
usage. **Not affected by this file** — flagged here so future audits see
the whole map.

## NHL data / marks

NHL data is provided by Sportradar / Highlightly under existing paid
licenses. NHL Shield SVG in `/app/frontend/src/components/NHLShield.jsx`
is editorial-fair-use only.

## When to revisit

Any time we consider:
- App store submission (immediate blocker)
- Paid marketing with logo imagery
- Partnership pitches where logo usage terms are discussed
- Public launch (hard blocker — resolve before)

Last updated: session that introduced Ticker+ cascade.
