import { useMemo } from "react";
import { mockLine } from "@/lib/mockOdds";

// Compact odds row that sits inside a game card. One quiet line:
//   The Book · BOS -145 · TOR +120 · O 6.5 -105
// Favored side in emerald, dog dim white, total in accent yellow.

export default function OddsChip({ game }) {
  const line = useMemo(() => mockLine(game.id), [game.id]);
  const favCode = line.favSide === "home" ? game.home : game.away;
  const dogCode = line.favSide === "home" ? game.away : game.home;
  return (
    <div
      className="mt-3 flex items-center flex-wrap gap-x-2 gap-y-1 rounded-md border border-white/10 bg-black/30 px-3 py-1.5"
      data-testid={`odds-chip-${game.id}`}
    >
      <span className="inline-flex items-center gap-1 font-accent text-[9px] uppercase tracking-[0.3em] text-[#1E5BFF]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1E5BFF] opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1E5BFF]" />
        </span>
        The Book
      </span>
      <span className="text-white/40">·</span>
      <span className="font-headline text-sm text-white">
        {favCode} <span className="text-emerald-300">{line.favOdds}</span>
      </span>
      <span className="text-white/40">·</span>
      <span className="font-headline text-sm text-white/70">
        {dogCode} <span className="text-white/60">{line.dogOdds}</span>
      </span>
      <span className="text-white/40">·</span>
      <span className="font-accent text-[10px] uppercase tracking-widest text-white/50">
        {line.totalSide} {line.total} <span className="text-white/40">{line.totalOdds}</span>
      </span>
    </div>
  );
}
