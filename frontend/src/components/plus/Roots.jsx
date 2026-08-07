// Roots — woven, not appended.
// -----------------------------------------------------------------------------
// Roots is a tone/mood that lives INSIDE existing surfaces, not a page-bottom
// card. This file exports two lightweight primitives that other components
// pull in when the moment they're rendering has a Roots layer:
//
//   • <RootsRibbon> — a single amber connection line that appears inside any
//     tile / card / row when a story's connection touches the user's followed
//     teams. This is the personalization moat: "Former Sherbrooke Phoenix
//     · 2018-20", "Habs bloodlines · Dad wore the jersey in '94".
//
//   • <RootsBeat> — a small reflective quote block for surfaces that host a
//     story-worthy moment (a prospect page, a recap tile, a matchup preview).
//     Same navy + amber palette, no chirps, Reggie storyteller + Marc grounder.
//
// Full tone rules: /app/memory/LANGUAGE_BIBLE.md (Section 4, Section 3 table
// row for Roots mode, Section 1 texture note). Data shape and rollout order:
// /app/memory/ROOTS_SEGMENT_SPEC.md.

import { Link2, Compass } from "lucide-react";
import { useUserProfile } from "@/lib/userProfile";

// Cross-reference a story's connections array against the user's followed
// teams. Only matching connections render. Everything else stays dormant so
// the ribbon feels earned, never spammy.
export function matchRootsConnections(connections, profile) {
  if (!connections?.length) return [];
  const following = new Set([
    ...(profile?.chl_teams  || []),
    ...(profile?.ncaa_teams || []),
    ...(profile?.nhl_team ? [profile.nhl_team] : []),
  ]);
  return connections.filter(c => {
    if (c.team && following.has(c.team)) return true;
    if (c.family?.team && following.has(c.family.team)) return true;
    return false;
  });
}

// Ribbon — inline, small, drops into any surface. If nothing matches the
// user's followed teams, renders nothing (no wasted real estate).
export function RootsRibbon({ connections, className = "" }) {
  const { profile } = useUserProfile();
  const active = matchRootsConnections(connections, profile);
  if (!active.length) return null;
  return (
    <div className={`space-y-1 ${className}`} data-testid="roots-ribbon">
      {active.map((c, i) => (
        <div
          key={i}
          data-testid={`roots-ribbon-${i}`}
          className="flex items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.05] px-2.5 py-1"
        >
          <Link2 className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "12px", color: "#fbd38d", lineHeight: 1.3 }}>
            {c.note}
          </span>
        </div>
      ))}
    </div>
  );
}

// Beat — a small reflective block for surfaces hosting a story moment.
// Sits inside a prospect page, recap tile or matchup preview when the
// story earns it. Minor-key palette (navy + amber) so it reads as a
// register shift, not another electric-orange Ticker card.
export function RootsBeat({ story, className = "" }) {
  const { profile } = useUserProfile();
  if (!story) return null;
  const active = matchRootsConnections(story.connections, profile);
  return (
    <div
      data-testid="roots-beat"
      className={`relative rounded-lg border border-amber-500/20 bg-gradient-to-br from-[#0a1220] via-[#0a1626] to-[#0a1220] p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Compass className="w-3 h-3 text-amber-400/80" />
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.34em", color: "#fbbf24" }}>
          Roots{story.town?.name ? ` · ${story.town.name.toUpperCase()}` : ""}
        </span>
      </div>
      {active.length > 0 && (
        <div className="mb-3">
          <RootsRibbon connections={story.connections} />
        </div>
      )}
      {story.hook && (
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "17px", color: "#fff", lineHeight: 1.3 }}>
          {story.hook}
        </div>
      )}
      {story.marcQuote && (
        <div className="mt-3 pl-2.5 border-l-2 border-amber-400/40 text-white/85"
             style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px", lineHeight: 1.5 }}>
          "{story.marcQuote}"
          <div className="mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.32em", color: "#fbbf24" }}>
            — MARC
          </div>
        </div>
      )}
      {story.reggieQuote && (
        <div className="mt-2 pl-2.5 border-l-2 border-white/20 text-white/75 italic"
             style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px", lineHeight: 1.5 }}>
          "{story.reggieQuote}"
          <div className="mt-0.5 not-italic" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.32em", color: "#a0a0a5" }}>
            — REGGIE
          </div>
        </div>
      )}
    </div>
  );
}
