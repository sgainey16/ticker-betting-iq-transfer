// Tonight V2 broadcast hero.
// No CTAs, no explanatory paragraphs, no "welcome" copy.
// Lead with intelligence: game count, host disagreement count, tightest
// DESK↔ROOM gap. Every number is derived from real /predictions/games
// data — no fabrication.

import { useMemo } from "react";
import { Zap, Users2 } from "lucide-react";

// Compute honest headline metrics from the games slate.
// Returns nulls where we don't have enough data — the hero renders
// only what's real.
function computeHeadlineMetrics(games) {
  if (!games?.length) {
    return { gameCount: 0, splitCount: 0, tightestGap: null };
  }
  const gameCount = games.length;
  const splitCount = games.filter(
    (g) => g.reggie_pick && g.marc_pick && g.reggie_pick !== g.marc_pick
  ).length;

  // Tightest DESK↔ROOM gap on the DESK's chosen side.
  // Only counted where community has actual votes cast (total > 0) —
  // otherwise ROOM % is null and the gap is undefined.
  let tightest = null;
  for (const g of games) {
    const total = g.community?.total || 0;
    if (!total || !g.ai_consensus_side || g.ai_consensus == null) continue;
    const roomPct =
      g.ai_consensus_side === "home"
        ? g.community.home_pct
        : g.community.away_pct;
    if (roomPct == null) continue;
    const gap = Math.abs(g.ai_consensus - roomPct);
    if (tightest == null || gap < tightest) tightest = gap;
  }
  return { gameCount, splitCount, tightestGap: tightest };
}

export default function TonightHero({ games }) {
  const { gameCount, splitCount, tightestGap } = useMemo(
    () => computeHeadlineMetrics(games),
    [games]
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a1030] via-[#08081a] to-[#050510]"
      data-testid="iq-tonight-hero"
    >
      {/* Diagonal broadcast ribbon */}
      <div
        aria-hidden
        className="absolute -top-16 -right-24 w-[420px] h-[220px] rotate-[16deg] bg-gradient-to-r from-[#1e5dff]/25 via-[#1e5dff]/5 to-transparent blur-2xl"
      />
      {/* Grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' seed='7'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative px-5 sm:px-7 py-5 sm:py-6">
        <div className="flex items-center gap-2 text-[#7fb0ff] font-accent text-[10px] uppercase tracking-[0.36em] mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1e5dff] shadow-[0_0_10px_1px_#1e5dff] animate-pulse" />
          Tonight
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div
            className="font-headline text-white leading-none tracking-tight text-[64px] sm:text-[84px] tabular-nums"
            data-testid="iq-hero-game-count"
          >
            {gameCount}
          </div>
          <div className="font-accent text-white/70 text-[13px] uppercase tracking-[0.34em] pb-2.5">
            {gameCount === 1 ? "Game on the card" : "Games on the card"}
          </div>
        </div>

        {/* Real derived intel line — only chips with real data render */}
        {gameCount > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {splitCount > 0 && (
              <HeroChip
                icon={Users2}
                testid="iq-hero-split-chip"
                label={
                  <>
                    <span className="text-white font-headline tabular-nums">
                      {splitCount}
                    </span>{" "}
                    Host disagreement{splitCount === 1 ? "" : "s"}
                  </>
                }
              />
            )}
            {tightestGap != null && (
              <HeroChip
                icon={Zap}
                testid="iq-hero-tightest-chip"
                accent
                label={
                  <>
                    Tightest gap{" "}
                    <span className="text-white font-headline tabular-nums">
                      ±{Math.round(tightestGap)} pts
                    </span>
                  </>
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HeroChip({ icon: Icon, label, accent = false, testid }) {
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-accent text-[10px] uppercase tracking-[0.24em] border ${
        accent
          ? "bg-[#1e5dff]/12 border-[#1e5dff]/45 text-white"
          : "bg-white/[0.04] border-white/12 text-white/75"
      }`}
    >
      <Icon className={`w-3 h-3 ${accent ? "text-[#7fb0ff]" : "text-white/50"}`} />
      {label}
    </span>
  );
}
