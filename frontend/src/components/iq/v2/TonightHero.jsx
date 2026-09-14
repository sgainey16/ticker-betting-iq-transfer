// Tonight V3.2 header — compact identity strip only.
// No derived meta chips (host-split etc.) — Ticker publishes one official
// position, not several. Prime mobile space belongs to games.

export default function TonightHero({ games = [] }) {
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
    </div>
  );
}
