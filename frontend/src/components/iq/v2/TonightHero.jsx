// Tonight V3 header — compact, not a giant hero.
// Prime mobile space belongs to games, not to metadata.
// Only real, derived metrics render; no fabrication, no "coming soon".

import { useMemo } from "react";
import { Users2 } from "lucide-react";

function computeMeta(games) {
  if (!games?.length) return { splitCount: 0 };
  const splitCount = games.filter(
    (g) => g.reggie_pick && g.marc_pick && g.reggie_pick !== g.marc_pick
  ).length;
  return { splitCount };
}

export default function TonightHero({ games = [] }) {
  const { splitCount } = useMemo(() => computeMeta(games), [games]);
  const n = games.length;

  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      data-testid="iq-tonight-hero"
    >
      <div className="flex items-baseline gap-2">
        <div className="font-accent text-[10px] uppercase tracking-[0.36em] text-[#7fb0ff]">
          Betting IQ
        </div>
        <div className="h-3 w-px bg-white/15" />
        <div
          className="font-headline text-white text-[14px] tracking-wide"
          data-testid="iq-hero-tonight-label"
        >
          Tonight
        </div>
        <div className="font-accent text-white/60 text-[11px] uppercase tracking-[0.24em] tabular-nums">
          · {n} {n === 1 ? "game" : "games"}
        </div>
      </div>

      {/* Real derived meta strip — only chips with legitimate data render */}
      {splitCount > 0 && (
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-accent text-[9px] uppercase tracking-[0.24em] bg-amber-400/10 border border-amber-400/35 text-amber-200"
            data-testid="iq-hero-split-chip"
          >
            <Users2 className="w-2.5 h-2.5" />
            <span className="tabular-nums">{splitCount}</span> Host split
            {splitCount === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}
