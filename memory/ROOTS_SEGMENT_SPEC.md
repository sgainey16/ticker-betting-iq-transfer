# Roots · Engineering Spec

**Philosophy:** Roots is woven into the existing bible and app — it is
not a separate section, not a separate page, not a bottom-of-page card.
Full tone rules live inside `/app/memory/LANGUAGE_BIBLE.md` (Section 1
texture note, Section 3 register table, Section 4 developing-player
test). This document is engineering-facing only.

## Primitives

Two thin components in `/app/frontend/src/components/plus/Roots.jsx`:

- **`<RootsRibbon connections={...} />`** — inline amber connection line
  that renders only when a story's `connections` overlap the user's
  followed teams. Silent otherwise. Drops into any surface: prospect
  page, matchup tile, weekly-vote entry, recap tile, desk-show chyron.

- **`<RootsBeat story={...} />`** — a small reflective quote block
  (Marc grounder + Reggie storyteller) for surfaces hosting an actual
  Roots moment. Distinct navy + amber palette so it reads as a register
  shift, not another electric-orange Ticker card.

Both primitives are opt-in per surface. There is no page owned by Roots.

## Data shape

```
{
  id: string,
  archetype: "vet" | "enforcer" | "rookie" | "hometown" | "community",
  hero: { name, role, team, league },
  town: { name, region, rink },
  lineage: [{ name, era, connection }],

  // Connection graph — cross-referenced against the user's followed
  // teams at render time. Only matches light up.
  connections: [
    {
      type: "played_for" | "drafted_by" | "coached_by" | "family" | "hometown" | "trained_at",
      team?: string,         // e.g. "SHE" (Sherbrooke Phoenix), "MTL"
      league?: string,       // "QMJHL" | "OHL" | "WHL" | "NCAA" | "NHL" | "AHL"
      years?: string,        // "2018-2020"
      note: string,          // human-readable, Marc-voice
      family?: { relation, team, era }  // for family/bloodline connections
    }
  ],

  hook: string,
  marcQuote: string,
  reggieQuote: string,
  sources: [{ label, url }],
  audio: { marcMp3?, reggieMp3?, bedMp3? }
}
```

Prospect entries in `/app/frontend/src/data/tickerCatalog.js` also carry
an optional `connections[]` array of the same shape. Ribbons on
`/plus/prospect/:id` render from that field.

## Placement matrix (surfaces that opt in today)

| Surface | Primitive | Trigger |
|---|---|---|
| `ProspectPage` (`/plus/prospect/:id`) | `<RootsRibbon>` | Prospect's `connections` overlap user profile |
| `MatchupTile` | `<RootsRibbon>` (future) | Matchup's featured prospect has matching connections |
| `RecapShow` beat | `<RootsBeat>` (future) | Producer marks a beat as a Roots moment |
| `WhlDeskShow` chyron | `<RootsBeat>` (future) | Chyron timeline includes a Roots cue |
| `WeeklyVotes` entry (future "Roots" tab) | `<RootsBeat>` | Weekly vote across story-of-the-week candidates |

## Data sources (still to integrate)

- **Elite Prospects API** — junior/college teams played, coach names,
  draft picks, family/bloodline records where present.
- **NHL Public API** — historical NHL rosters for the family reference
  lookups (father/brother/uncle games played).
- **Human research** — community-figure stories. Not scrape-able. That
  is the moat.

## What Roots is not

- Not a page
- Not a bottom-of-screen card
- Not a stats dump
- Not a slot to sneak in a chirp

Ration it. The rarer it lights up, the more it lands.
