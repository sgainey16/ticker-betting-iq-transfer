// MatchupTile — the traffic-driving component.
// Renders a two-headed matchup preview with prominent free + paid watch
// CTAs. Every CTA is UTM-tagged so we can prove attribution to the league
// / rights-holder (this is the "we drive value to your platform" evidence).
//
// Given a package that has a `matchup` block and `watchLinks`, this becomes
// a much more valuable tile than a generic content card — because clicking
// out is the primary action, not a secondary one.

import { Link } from "react-router-dom";
import { Play, Ticket, Radio, Calendar } from "lucide-react";
import { teamByCode } from "@/data/tickerCatalog";
import { TeamLogo } from "@/components/plus/TeamLogo";

function withUtm(url, utm) {
  if (!url) return "#";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}utm_source=ticker&utm_medium=matchup&utm_campaign=${utm || "generic"}`;
}

export function MatchupTile({ pkg, variant = "hero" }) {
  const m = pkg.matchup;
  if (!m) return null;
  const awayTeam = teamByCode(m.away?.code);
  const homeTeam = teamByCode(m.home?.code);
  const paid = pkg.watchLinks?.paid;
  const free = pkg.watchLinks?.free;

  // The deep-link into the app itself (for readers who want the story, not
  // just to click out).
  const deepLink = pkg.prospects?.[0]
    ? `/plus/prospect/${pkg.prospects[0]}`
    : (pkg.teams?.[0] ? `/plus/team/${pkg.teams[0]}` : "/plus");

  return (
    <div
      data-testid={`matchup-${pkg.id}`}
      className="relative rounded-xl border border-white/10 bg-gradient-to-br from-black/60 via-[#0b0b10] to-black/40 p-4 md:p-5 overflow-hidden"
    >
      {/* Ambient primary-color glow from each team, softly overlapping */}
      <div className="absolute inset-0 opacity-25 pointer-events-none"
           style={{ background: `radial-gradient(circle at 15% 30%, ${awayTeam?.primary || "#F58220"}66 0%, transparent 45%), radial-gradient(circle at 85% 30%, ${homeTeam?.primary || "#F58220"}66 0%, transparent 45%)` }} />

      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-3.5 h-3.5 text-[#F58220]" />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
            Matchup · {pkg.league || "Hockey"}
          </span>
          {m.when && (
            <span className="ml-auto flex items-center gap-1 text-white/60" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.22em" }}>
              <Calendar className="w-3 h-3" /> {m.when}
            </span>
          )}
        </div>

        {/* Two-headed matchup line-up */}
        <div className="flex items-center justify-center gap-4 md:gap-6 py-2">
          <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <TeamLogo team={awayTeam || { code: m.away?.code, primary: "#F58220" }} size={56} />
            <div className="text-center min-w-0 w-full">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff", lineHeight: 1.2 }} className="truncate">
                {m.away?.label || awayTeam?.name}
              </div>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#a0a0a5" }} className="truncate">
                {awayTeam?.league || pkg.league}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: "#F58220", lineHeight: 1 }}>
              vs
            </span>
            <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "8px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
              matchup
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
            <TeamLogo team={homeTeam || { code: m.home?.code, primary: "#F58220" }} size={56} />
            <div className="text-center min-w-0 w-full">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff", lineHeight: 1.2 }} className="truncate">
                {m.home?.label || homeTeam?.name}
              </div>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#a0a0a5" }} className="truncate">
                {homeTeam?.league || pkg.league}
              </div>
            </div>
          </div>
        </div>

        {/* Storyline */}
        <div className="mt-3 text-center">
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "17px", color: "#fff", lineHeight: 1.25 }}>
            {pkg.title}
          </div>
          <div className="mt-1" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
            {pkg.subtitle}
          </div>
        </div>

        {/* Watch CTAs — the actual traffic driver */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {paid && (
            <a
              href={withUtm(paid.url, paid.utm)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`matchup-watch-paid-${pkg.id}`}
              className="group flex items-center gap-2 rounded-full bg-[#F58220] px-4 py-2 hover:bg-[#ff9042] transition-colors shadow-[0_6px_20px_-6px_rgba(245,130,32,0.6)]"
            >
              <Ticket className="w-3.5 h-3.5 text-black" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: "#000" }}>
                {paid.label}
              </span>
              <span className="ml-auto" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#000" }}>
                {paid.provider}
              </span>
            </a>
          )}
          {free && (
            <a
              href={withUtm(free.url, free.utm)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`matchup-watch-free-${pkg.id}`}
              className="group flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-2 hover:border-white/40 hover:bg-black/70 transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-white" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: "#fff" }}>
                {free.label}
              </span>
              <span className="ml-auto" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
                {free.provider}
              </span>
            </a>
          )}
        </div>

        {/* In-app deep-link — smaller, secondary */}
        <div className="mt-2 text-center">
          <Link
            to={deepLink}
            data-testid={`matchup-deep-${pkg.id}`}
            className="inline-block text-white/50 hover:text-white/80 transition-colors"
            style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", textTransform: "uppercase" }}
          >
            Read our take →
          </Link>
        </div>
      </div>
    </div>
  );
}
