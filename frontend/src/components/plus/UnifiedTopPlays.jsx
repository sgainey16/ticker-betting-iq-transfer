// Unified Top Plays — the "cream rises" highlight rail.
// -----------------------------------------------------------------------------
// Replaces the previous NHL-only HighlightsRail on HomeV2. This is the surface
// where exceptional CHL / OHL / NCAA plays can climb into the flagship view —
// but only when they earn it. Otherwise the NHL owns the rail.
//
// Rules:
//   1. NHL highlights from the team card are always in the deck.
//   2. Junior/NCAA packages are eligible only if baseScore >= EXCEPTIONAL_BAR.
//   3. Final rail = top N by score, always with at least ~60% NHL by count so
//      the flagship never feels colonized. Each tile gets a league chip and
//      routes to the appropriate detail page.
//
// The badge next to non-NHL tiles ("Why you're seeing this") makes the
// promotion explicit — no mystery why a Kamloops clip is next to Pastrnak.

import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { PACKAGES, PROSPECTS } from "@/data/tickerCatalog";
import { TeamLogo } from "@/lib/teamLogos";

// Only exceptional junior/NCAA content is allowed to climb into HomeV2.
// baseScore 7.5 corresponds to a real "moment" package (goal-of-week,
// draft-riser night, marquee matchup) — not a routine recap.
const EXCEPTIONAL_BAR = 7.5;

const LEAGUE_COLOR = {
  NHL: "#FCB514", AHL: "#7A0019", WHL: "#F58220", OHL: "#C41230", NCAA: "#CC0000", MIX: "#8B5CF6",
};

// Why-badge text — explains the promotion in ~4 words.
function whyPromoted(pkg, nhlCode) {
  const p0 = pkg.prospects?.[0];
  const pr = p0 ? PROSPECTS.find(x => x.id === p0) : null;
  if (pr && nhlCode && pr.nhlOrbit?.includes(nhlCode)) {
    return `Top ${nhlCode} prospect`;
  }
  if (pkg.storyline === "rivalry" && pkg.importance >= 5) return "Marquee matchup";
  if (pkg.storyline === "milestone") return "Draft riser · milestone";
  if (pkg.storyline === "debut") return "Notable debut";
  if (pr) return `${pr.first} ${pr.last} · #${pr.draftRank}`;
  return "Cream of the week";
}

// Route a package to the best detail surface.
function packageRoute(pkg) {
  if (pkg.video?.route) return pkg.video.route;
  if (pkg.prospects?.[0]) return `/plus/prospect/${pkg.prospects[0]}`;
  if (pkg.teams?.[0]) return `/plus/team/${pkg.teams[0]}`;
  return "/plus";
}

export function UnifiedTopPlays({ team }) {
  const nhlCode = team?.code || null;

  // 1. Bake the NHL highlights into normalized "tile" shape. NHL always wins
  //    the top slot regardless of score — this is the flagship.
  const nhlTiles = (team?.highlights || []).map((h, i) => ({
    id: `nhl-${team.code}-${i}`,
    league: "NHL",
    title: h.title,
    subtitle: `${team.code} · ${h.when}`,
    teamCode: h.team || team.code,
    color: team.primary || LEAGUE_COLOR.NHL,
    to: "/",   // Full recap show
    score: 10 - i * 0.1, // pin NHL to the top of the ordering
    why: null,
  }));

  // 2. Eligible junior/NCAA packages — quality-gated.
  const eligible = PACKAGES
    .filter(p => (p.baseScore || 0) >= EXCEPTIONAL_BAR)
    .filter(p => p.league !== "NHL")
    .filter(p => p.kind !== "matchup" || (p.storyline === "rivalry" && p.importance >= 5))
    .map(p => ({
      pkg: p,
      // Small boost when the package touches the user's NHL orbit — that's
      // exactly the "your team's future is on the ice" moment.
      score: (p.baseScore || 0) + (
        nhlCode && (p.prospects || []).some(pid => {
          const pr = PROSPECTS.find(x => x.id === pid);
          return pr && pr.nhlOrbit?.includes(nhlCode);
        }) ? 0.9 : 0
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)  // Cap junior/NCAA climb-ups at 2 — flagship stays flagship.
    .map(({ pkg, score }) => ({
      id: pkg.id,
      league: pkg.league,
      title: pkg.title,
      subtitle: pkg.subtitle,
      teamCode: pkg.teams?.[0],
      color: LEAGUE_COLOR[pkg.league] || "#F58220",
      to: packageRoute(pkg),
      score,
      why: whyPromoted(pkg, nhlCode),
    }));

  // 3. Interleave — always NHL first, then top junior tile, then remaining
  //    NHL, then second junior. Feels natural, keeps NHL dominant.
  const tiles = [];
  const nhl = [...nhlTiles];
  const juniors = [...eligible];
  while (nhl.length || juniors.length) {
    if (nhl.length) tiles.push(nhl.shift());
    if (juniors.length && tiles.length % 2 === 0) tiles.push(juniors.shift());
  }
  // If we still have juniors (rare — >2 NHL, one junior), tack them on at end.
  while (juniors.length) tiles.push(juniors.shift());

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5" data-testid="unified-top-plays">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-red-400" fill="currentColor" />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
            TOP PLAYS · CREAM RISES
          </span>
        </div>
        <Link
          to="/"
          data-testid="unified-top-plays-full-show"
          className="text-[13px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
          style={{ fontFamily: "Rajdhani", fontWeight: 600 }}
        >
          Full Recap Show ›
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tiles.map(t => (
          <Link
            key={t.id}
            to={t.to}
            data-testid={`unified-top-play-${t.id}`}
            className="group relative aspect-video rounded-md overflow-hidden border border-white/10 hover:border-white/40 transition-all block"
            style={{ background: `linear-gradient(135deg, ${t.color}44 0%, #0b0b10 70%)` }}
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
              {t.teamCode
                ? <TeamLogo code={t.teamCode} size={64} />
                : <div className="text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.3em", fontSize: 12 }}>{t.league}</div>
              }
            </div>

            {/* League chip · top-left */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: "rgba(0,0,0,0.72)",
                  border: `1px solid ${t.color}66`,
                  fontFamily: "Oswald", fontWeight: 800, fontSize: "9px", letterSpacing: "0.28em",
                  color: t.color,
                }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: t.color }} />
                {t.league}
              </span>
              {t.why && (
                <span
                  className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5"
                  style={{
                    background: "rgba(0,0,0,0.72)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    fontFamily: "Oswald", fontWeight: 600, fontSize: "9px", letterSpacing: "0.2em",
                    color: "#e5e5e7",
                  }}
                >
                  {t.why}
                </span>
              )}
            </div>

            {/* Play icon · top-right */}
            <div
              className="absolute top-2 right-2 h-10 w-10 rounded-full flex items-center justify-center bg-red-600/95 group-hover:scale-110 transition-transform"
              style={{ boxShadow: "0 4px 20px -4px rgba(239,68,68,0.7)" }}
            >
              <Play className="w-4 h-4 text-white translate-x-[1.5px]" fill="currentColor" />
            </div>

            {/* Title strip · bottom */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black to-transparent text-left">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff", lineHeight: 1.2 }}>
                {t.title}
              </div>
              <div className="mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
                {t.subtitle}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Explainer strip — puts the philosophy on the page so users
       * understand why they're seeing junior/NCAA plays here. */}
      <div className="mt-3 flex items-center justify-between text-white/40">
        <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em" }}>
          Junior &amp; NCAA plays climb into this rail only when the moment earns it.
        </span>
        <Link
          to="/plus"
          className="hover:text-white/70 transition-colors"
          style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.28em" }}
        >
          MORE FROM BEYOND THE NHL →
        </Link>
      </div>
    </div>
  );
}
