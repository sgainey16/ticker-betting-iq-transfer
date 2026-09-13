// Tonight V2 game rail — logo-forward horizontal swipe.
// Each tile leads with real NHL shields (TeamLogo), matchup, tip time,
// and a small honest live indicator (host-split dot). No fabricated data.
//
// Snap-scrolling, selected-state elevation with the HOME team's accent
// color as the border and a subtle glow. Swipe = more.

import { useRef, useEffect } from "react";
import { TeamLogo } from "@/lib/teamLogos";

export default function GameRailV2({
  games = [],
  teams = [],
  selectedGameId,
  onSelect,
}) {
  const scrollRef = useRef(null);
  const tileRefs = useRef({});

  const meta = (code) => teams.find((t) => t.code === code) || {};

  // Keep the selected tile visible after auto-select on initial mount.
  useEffect(() => {
    if (!selectedGameId) return;
    const el = tileRefs.current[selectedGameId];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }, [selectedGameId]);

  if (!games.length) return null;

  return (
    <div
      className="relative -mx-3 sm:mx-0"
      data-testid="iq-tonight-rail"
    >
      <div className="px-3 sm:px-0 mb-2 flex items-center justify-between">
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/45">
          Swipe · Tap to switch
        </div>
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/25">
          {games.length} on
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto no-scrollbar px-3 sm:px-0 pb-2 snap-x snap-mandatory scroll-smooth"
      >
        {games.map((g) => {
          const home = meta(g.home);
          const away = meta(g.away);
          const selected = selectedGameId === g.id;
          const hostSplit =
            g.reggie_pick && g.marc_pick && g.reggie_pick !== g.marc_pick;
          const accent = home.accent || "#1e5dff";
          const time = new Date(g.start_iso).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            <button
              key={g.id}
              ref={(el) => (tileRefs.current[g.id] = el)}
              onClick={() => onSelect?.(g.id)}
              data-testid={`iq-tonight-rail-tile-${g.id}`}
              className={`snap-start flex-shrink-0 relative rounded-2xl w-[196px] sm:w-[212px] px-4 pt-4 pb-3.5 text-left transition-all duration-200 border ${
                selected
                  ? "bg-gradient-to-b from-[#101a3d] to-[#08081a] border-white/20 -translate-y-[2px]"
                  : "bg-[#0a0a15] border-white/8 hover:border-white/20 hover:bg-[#0b0b1c]"
              }`}
              style={
                selected
                  ? {
                      boxShadow: `0 10px 40px -12px ${accent}, inset 0 0 0 1px ${accent}66`,
                    }
                  : undefined
              }
            >
              {/* Selected accent bar */}
              {selected && (
                <span
                  aria-hidden
                  className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
                  style={{ background: accent }}
                />
              )}

              {/* Time + status row */}
              <div className="flex items-center justify-between text-[10px] font-accent uppercase tracking-[0.24em] mb-3">
                <span className={selected ? "text-white/90" : "text-white/50"}>
                  {time}
                </span>
                {hostSplit && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] text-white/80"
                    title="Reggie and Marc disagree"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_1px_rgba(251,191,36,0.8)]" />
                    Split
                  </span>
                )}
              </div>

              {/* Logos */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: `${away.accent || "#1e5dff"}18`,
                    }}
                  >
                    <TeamLogo code={g.away} size={34} />
                  </div>
                  <div className="font-headline text-white/80 text-[11px] tracking-wide">
                    {g.away}
                  </div>
                </div>
                <div
                  className={`font-accent text-[10px] uppercase tracking-[0.32em] ${
                    selected ? "text-white/50" : "text-white/25"
                  }`}
                >
                  at
                </div>
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center"
                    style={{ background: `${accent}18` }}
                  >
                    <TeamLogo code={g.home} size={34} />
                  </div>
                  <div className="font-headline text-white/80 text-[11px] tracking-wide">
                    {g.home}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
