import { useRef } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";

// Horizontal logo-vs-logo game picker strip.
// - First tile is always "▶ Play All" (continuous show mode)
// - Every next tile is one game rendered as [AWAY_CODE @ HOME_CODE]
// - Tapping a tile calls onSelect(gameId) or onSelect(null) for Play All
// - Small chevron buttons allow keyboard-free scrolling on narrow viewports
//
// Kept intentionally slim (~72px tall) so it feels like a TV channel bar,
// not a card grid. Team codes render as colored initial-badges until Imagn
// logos unlock — component will swap in <img> then with zero API change.
export default function GamePickerStrip({
  games = [],
  teams = [],
  selectedGameId = null,
  onSelect = () => {},
  playAllLabel = "Play All",
  testids = {
    root: "game-picker-strip",
    all: "game-picker-all",
    game: (id) => `game-picker-${id}`,
  },
}) {
  const scrollRef = useRef(null);

  const teamMeta = (code) => teams.find((t) => t.code === code) || {};

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 260, behavior: "smooth" });
  };

  if (games.length === 0) return null;

  return (
    <div className="relative" data-testid={testids.root}>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-[#0b0b10]/90 border border-[#2d2d35] items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto no-scrollbar md:px-10 py-2"
        style={{ scrollBehavior: "smooth" }}
      >
        {/* Play All tile */}
        <button
          data-testid={testids.all}
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 rounded-lg px-4 py-3 min-w-[128px] transition-all border ${
            selectedGameId === null
              ? "bg-[#1e5dff] border-[#1e5dff] text-white shadow-[0_0_18px_-2px_rgba(30,93,255,0.7)]"
              : "bg-[#0b0b10] border-[#2d2d35] text-white/80 hover:border-white/40 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2 text-[10px] font-accent uppercase tracking-[0.28em]">
            <Play className="w-3.5 h-3.5" />
            {playAllLabel}
          </div>
          <div className="text-[11px] mt-1 opacity-70 font-accent uppercase tracking-widest">
            Continuous show
          </div>
        </button>

        {/* Per-game logo-vs-logo tiles */}
        {games.map((g) => {
          const away = teamMeta(g.away);
          const home = teamMeta(g.home);
          const selected = selectedGameId === g.id;
          return (
            <button
              key={g.id}
              data-testid={testids.game(g.id)}
              onClick={() => onSelect(g.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-2.5 min-w-[172px] transition-all border ${
                selected
                  ? "bg-[#101625] border-[#1e5dff] shadow-[0_0_18px_-4px_rgba(30,93,255,0.7)]"
                  : "bg-[#0b0b10] border-[#2d2d35] hover:border-white/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <TeamBadge code={g.away} accent={away.accent} />
                <span className={`text-[10px] font-accent uppercase tracking-widest ${selected ? "text-white/70" : "text-white/40"}`}>
                  @
                </span>
                <TeamBadge code={g.home} accent={home.accent} />
              </div>
              <div className={`text-[9px] font-accent uppercase tracking-[0.25em] mt-1.5 text-center ${selected ? "text-[#1e5dff]" : "text-white/40"}`}>
                {new Date(g.start_iso).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-[#0b0b10]/90 border border-[#2d2d35] items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function TeamBadge({ code, accent = "#1e5dff" }) {
  return (
    <div
      className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        background: `${accent}22`,
        border: `1px solid ${accent}55`,
      }}
    >
      <TeamLogo code={code} size={28} monogramClass="!bg-transparent" />
    </div>
  );
}
