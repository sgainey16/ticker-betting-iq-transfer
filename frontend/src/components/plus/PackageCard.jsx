// PackageCard — reusable tile for any Ranker-scored content unit.
// Three variants: "hero" (top of a feed), "list" (dense inline), "compact" (grid).
// The card is deliberately dumb — no data fetching, no personalization logic.
// It just displays a `package` from the catalog. Higher-level pages decide what
// to show and in what variant.

import { Link } from "react-router-dom";
import { PlayCircle, TrendingUp, Users, Video, Newspaper, Radio } from "lucide-react";
import { PROSPECTS, teamByCode } from "@/data/tickerCatalog";

const TAG_ICON = {
  "DESK SHOW":  Radio,
  "PROSPECT":   TrendingUp,
  "GOAL":       Video,
  "RECAP":      Newspaper,
  "PREVIEW":    Users,
  "STANDINGS":  TrendingUp,
};

function inferHref(pkg) {
  if (pkg.video?.route) return pkg.video.route;
  if (pkg.prospects?.length === 1) return `/plus/prospect/${pkg.prospects[0]}`;
  if (pkg.teams?.length) return `/plus/team/${pkg.teams[0]}`;
  return "#";
}

export function PackageCard({ pkg, variant = "compact", score }) {
  const Icon = TAG_ICON[pkg.thumbTag] || Video;
  const href = inferHref(pkg);
  const teams = (pkg.teams || []).map(teamByCode).filter(Boolean);
  const featured = (pkg.prospects || []).map(id => PROSPECTS.find(p => p.id === id)).filter(Boolean);
  const primary = teams[0]?.primary || "#F58220";

  if (variant === "hero") {
    return (
      <Link
        data-testid={`pkg-hero-${pkg.id}`}
        to={href}
        className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black to-[#0b0b10] hover:border-white/25 transition-all"
      >
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at top left, ${primary}66 0%, transparent 55%)` }} />
        <div className="relative p-5 md:p-6 flex flex-col gap-3 min-h-[220px]">
          <div className="flex items-center gap-2">
            <span className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/70 flex items-center gap-1.5">
              <Icon className="w-3 h-3" style={{ color: primary }} />
              {pkg.thumbTag}
            </span>
            {pkg.storyline && (
              <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/45">
                · {pkg.storyline}
              </span>
            )}
          </div>
          <div className="mt-auto">
            <div className="font-headline text-white text-2xl md:text-3xl leading-tight">{pkg.title}</div>
            <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/55 mt-1.5">
              {pkg.subtitle}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3">
            <PlayCircle className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />
            <span className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/70 group-hover:text-white">
              Watch the desk
            </span>
            {typeof score === "number" && (
              <span className="ml-auto font-accent text-[9px] uppercase tracking-[0.28em] text-white/35">
                score {score.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === "list") {
    return (
      <Link
        data-testid={`pkg-list-${pkg.id}`}
        to={href}
        className="group flex items-stretch gap-3 py-3 border-b border-white/8 hover:bg-white/[0.03] transition-colors -mx-2 px-2 rounded-md"
      >
        <div className="w-1 rounded-full" style={{ background: primary }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-3 h-3" style={{ color: primary }} />
            <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/55">
              {pkg.thumbTag}
            </span>
            {featured[0] && (
              <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/35">
                · {featured[0].last}
              </span>
            )}
          </div>
          <div className="font-headline text-white text-base leading-tight truncate">{pkg.title}</div>
          <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/45 mt-0.5">
            {pkg.subtitle}
          </div>
        </div>
        <PlayCircle className="w-4 h-4 text-white/40 group-hover:text-white transition-colors self-center" />
      </Link>
    );
  }

  // compact grid tile
  return (
    <Link
      data-testid={`pkg-card-${pkg.id}`}
      to={href}
      className="group relative flex flex-col rounded-lg border border-white/10 bg-black/40 hover:border-white/25 hover:bg-black/60 transition-all overflow-hidden"
    >
      <div className="h-1" style={{ background: primary }} />
      <div className="p-3.5 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className="w-3 h-3" style={{ color: primary }} />
          <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/60">
            {pkg.thumbTag}
          </span>
          {pkg.storyline && (
            <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/30">· {pkg.storyline}</span>
          )}
        </div>
        <div className="font-headline text-white text-[15px] leading-tight">{pkg.title}</div>
        <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/50 mt-1.5">
          {pkg.subtitle}
        </div>
        <div className="mt-auto pt-3 flex items-center gap-2">
          <PlayCircle className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
          <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/40 group-hover:text-white/80">
            Open
          </span>
        </div>
      </div>
    </Link>
  );
}
