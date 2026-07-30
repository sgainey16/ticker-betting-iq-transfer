import { useMemo } from "react";

// The Odds Ticker — a horizontal marquee crawl that sits at the bottom
// of the Predict page. Reads like a real sportsbook feed but the numbers
// are deterministic from the game ID so they don't jitter on re-render.
//
// When live odds are wired (Highlightly PRO `/odds?matchId=`), swap
// `mockLine()` for a live fetch — same shape flows through.

// Simple, seeded RNG so refreshes give the same "reasonable" numbers per game
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Produce a plausible American moneyline pair (fav/dog) for a matchup.
function mockLine(gameId) {
  const h = hashString(gameId);
  // Bias: 65% chance the home team is favored (matches real NHL split)
  const homeFav = (h % 100) < 65;
  // Fav odds between -105 and -220, dog odds between +100 and +205
  const favMag = 105 + (h % 116);          // 105..220
  const dogMag = 100 + ((h >> 3) % 106);   // 100..205
  return {
    favSide: homeFav ? "home" : "away",
    favOdds: `-${favMag}`,
    dogOdds: `+${dogMag}`,
    total: (5.5 + (((h >> 6) % 4) * 0.5)).toFixed(1), // 5.5 / 6.0 / 6.5 / 7.0
    totalSide: (h >> 9) % 2 === 0 ? "O" : "U",
    totalOdds: (h >> 11) % 2 === 0 ? "-105" : "-115",
  };
}

// One tile in the ticker: `BOS -145 · TOR +120 · O 6.5 -105`
function OddsTile({ game }) {
  const line = useMemo(() => mockLine(game.id), [game.id]);
  const favCode = line.favSide === "home" ? game.home : game.away;
  const dogCode = line.favSide === "home" ? game.away : game.home;
  return (
    <div className="inline-flex items-center gap-2 px-4 py-1.5 border-r border-white/10 font-headline text-xs">
      <span className="font-accent text-[9px] uppercase tracking-widest text-white/40">
        {game.away} @ {game.home}
      </span>
      <span className="text-white/90">
        {favCode} <span className="text-emerald-300">{line.favOdds}</span>
      </span>
      <span className="text-white/40">·</span>
      <span className="text-white/70">
        {dogCode} <span className="text-white/60">{line.dogOdds}</span>
      </span>
      <span className="text-white/40">·</span>
      <span className="text-white/50 font-accent text-[10px] uppercase tracking-widest">
        {line.totalSide} {line.total}
      </span>
      <span className="text-white/40 text-[9px]">{line.totalOdds}</span>
    </div>
  );
}

export default function OddsTicker({ games }) {
  if (!games || games.length === 0) return null;
  // Duplicate the row so the marquee wraps seamlessly without a visible gap.
  const doubled = [...games, ...games];
  return (
    <div
      className="border-t border-b border-[#2d2d35] bg-black/60 overflow-hidden relative"
      data-testid="odds-ticker"
    >
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-[#0b0b10]/95 border-r border-[#2d2d35]">
        <span className="inline-flex items-center gap-1.5 font-accent text-[9px] uppercase tracking-[0.3em] text-[#F5A623]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F5A623] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F5A623]" />
          </span>
          The Book · Live
        </span>
      </div>
      <div className="odds-marquee flex items-center whitespace-nowrap py-2 pl-40">
        {doubled.map((g, i) => (
          <OddsTile key={`${g.id}-${i}`} game={g} />
        ))}
      </div>
    </div>
  );
}
