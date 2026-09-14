// Tonight V3 game rail — LOGO-FORWARD, team-color energy, minimal chrome.
// The rail itself supplies most of the top-of-screen color and identity.
// Real data only: team codes, tip time, host-split flag (when Reggie and
// Marc actually disagree). Everything else stays quiet.

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

  useEffect(() => {
    if (!selectedGameId) return;
    const el = tileRefs.current[selectedGameId];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  }, [selectedGameId]);

  if (!games.length) return null;

  return (
    <div className="relative -mx-3 sm:mx-0" data-testid="iq-tonight-rail">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar px-3 sm:px-0 pb-2 snap-x snap-mandatory scroll-smooth"
      >
        {games.map((g) => {
          const home = meta(g.home);
          const away = meta(g.away);
          const selected = selectedGameId === g.id;
          const homeAccent = home.accent || "#1e5dff";
          const awayAccent = away.accent || "#1e5dff";
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
              className={`snap-start flex-shrink-0 relative rounded-2xl w-[176px] px-3 pt-3 pb-2.5 text-left transition-all duration-200 overflow-hidden ${
                selected
                  ? "ring-2 ring-white/80 -translate-y-[2px]"
                  : "ring-1 ring-white/8 hover:ring-white/20"
              }`}
              style={{
                background: selected
                  ? `linear-gradient(135deg, ${awayAccent}30 0%, #08081a 45%, ${homeAccent}30 100%)`
                  : `linear-gradient(135deg, ${awayAccent}12 0%, #0a0a15 45%, ${homeAccent}12 100%)`,
                boxShadow: selected
                  ? `0 12px 32px -12px ${homeAccent}, 0 12px 32px -12px ${awayAccent}`
                  : undefined,
              }}
            >
              {/* Tip time — one honest metric per tile */}
              <div className="mb-2">
                <span
                  className={`font-accent text-[10px] uppercase tracking-[0.22em] tabular-nums ${
                    selected ? "text-white" : "text-white/60"
                  }`}
                >
                  {time}
                </span>
              </div>

              {/* Logo-forward matchup */}
              <div className="flex items-center justify-between gap-1">
                <TeamCrest code={g.away} accent={awayAccent} selected={selected} />
                <div
                  className={`font-accent text-[10px] uppercase tracking-[0.32em] ${
                    selected ? "text-white/60" : "text-white/25"
                  }`}
                >
                  @
                </div>
                <TeamCrest code={g.home} accent={homeAccent} selected={selected} />
              </div>

              {/* Codes row */}
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span
                  className={`font-headline text-[11px] tracking-wider ${
                    selected ? "text-white/90" : "text-white/60"
                  }`}
                >
                  {g.away}
                </span>
                <span
                  className={`font-headline text-[11px] tracking-wider ${
                    selected ? "text-white/90" : "text-white/60"
                  }`}
                >
                  {g.home}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamCrest({ code, accent, selected }) {
  return (
    <div
      className="relative h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{
        background: selected ? `${accent}25` : `${accent}12`,
        boxShadow: selected ? `inset 0 0 0 1px ${accent}55` : undefined,
      }}
    >
      <TeamLogo code={code} size={44} />
    </div>
  );
}
