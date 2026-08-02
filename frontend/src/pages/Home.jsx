import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import Ticker from "@/components/Ticker";
import { useBroadcast, BROADCAST_SLOT_ID } from "@/lib/broadcastContext";
import { TeamLogo } from "@/lib/teamLogos";

// The Morning Skate — pregame preview page (`/show`). LiveDesk still
// portals in the two-shot from Layout; below the panel we show:
//   1. Tonight's Games rail — logo vs logo tiles the viewer can tap to
//      focus one game's analytics.
//   2. Pregame Analytics — team-vs-team season stats for the selected
//      matchup. Users glance here while Reggie & Marc talk.

export default function Home() {
  const { topics, activeTopic, setActiveTopic } = useBroadcast();
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/predictions/games").catch(() => ({ data: { games: [] } })),
      api.get("/stats/teams").catch(() => ({ data: { teams: [] } })),
    ]).then(([g, t]) => {
      if (cancelled) return;
      const gl = g.data?.games || [];
      setGames(gl);
      setTeams(t.data?.teams || []);
      setSelectedId((cur) => cur || gl[0]?.id || null);
    });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => games.find((g) => g.id === selectedId) || games[0] || null,
    [games, selectedId]
  );

  return (
    <div className="-mx-5 sm:-mx-8 -mt-8">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-6">
        {/* LiveDesk portals its full frame into this slot */}
        <div id={BROADCAST_SLOT_ID} data-testid="broadcast-slot" />

        {/* Tonight's Games rail — logo vs logo tiles */}
        {games.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="tick-dot bg-[#1E5BFF] live-pulse" />
              <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-[#1E5BFF]">
                Tonight's Board
              </div>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-2 landscape:grid landscape:grid-flow-col landscape:auto-cols-fr landscape:overflow-visible landscape:pb-0"
              data-testid="show-games-rail"
            >
              {games.map((g) => {
                const isSel = selected?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    data-testid={`show-game-tile-${g.id}`}
                    className={`flex-shrink-0 min-w-[130px] rounded-lg border px-3 py-2 transition-all ${
                      isSel
                        ? "bg-[#101625] border-[#1E5BFF] shadow-[0_0_16px_-4px_rgba(30,91,255,0.7)]"
                        : "bg-[#0b0b10] border-[#2d2d35] hover:border-white/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <TeamLogo code={g.away} size={32} />
                      <span className="font-accent text-[9px] uppercase tracking-widest text-white/40">@</span>
                      <TeamLogo code={g.home} size={32} />
                    </div>
                    <div className={`mt-1 text-center font-accent text-[9px] uppercase tracking-[0.25em] ${
                      isSel ? "text-[#1E5BFF]" : "text-white/40"
                    }`}>
                      {g.away} · {g.home}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pregame Analytics — team vs team for the selected matchup */}
        {selected && (
          <PregameAnalytics
            awayCode={selected.away}
            homeCode={selected.home}
            teams={teams}
          />
        )}
      </div>

      <Ticker
        topics={topics}
        activeTopicId={activeTopic}
        onTopicClick={setActiveTopic}
      />
    </div>
  );
}

// Simple side-by-side comparison — the numbers Reggie & Marc are
// actually referencing on air. Same clean format as Post-Game Stats
// so users don't have to relearn a layout.
//
// Also includes The Ticker Model projected edge — a computed win-% split
// from each team's per-game goal differential (normalized). Not a betting
// line — a "who's the better team on paper" indicator.
function PregameAnalytics({ awayCode, homeCode, teams }) {
  const away = teams.find((t) => t.code === awayCode);
  const home = teams.find((t) => t.code === homeCode);
  if (!away || !home) {
    return (
      <div className="mt-4 card-surface p-6 text-center">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
          Loading pregame numbers…
        </div>
      </div>
    );
  }
  const rec = (t) => `${t.w ?? 0}-${t.l ?? 0}-${t.otl ?? 0}`;
  const pct = (t) => {
    const gp = t.gp || 0;
    const pts = t.pts || 0;
    return gp > 0 ? `${((pts / (gp * 2)) * 100).toFixed(1)}%` : "—";
  };
  const perG = (n, d) => (d > 0 ? (n / d).toFixed(2) : "—");
  const signedPerG = (n, d) => {
    if (!d) return "—";
    const v = n / d;
    return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
  };
  const rows = [
    { label: "Record",         a: rec(away),                                     h: rec(home) },
    { label: "Points",         a: away.pts ?? "—",                               h: home.pts ?? "—" },
    { label: "Point %",        a: pct(away),                                     h: pct(home) },
    { label: "Goals / G",      a: perG(away.gf || 0, away.gp),                   h: perG(home.gf || 0, home.gp) },
    { label: "GA / G",         a: perG(away.ga || 0, away.gp),                   h: perG(home.ga || 0, home.gp) },
    { label: "Goal Diff / G",  a: signedPerG((away.gf || 0) - (away.ga || 0), away.gp),
                                h: signedPerG((home.gf || 0) - (home.ga || 0), home.gp) },
  ];

  // Ticker Model projected edge — normalize each team's per-game GD around
  // league neutral (0). Convert to a soft 0-1 score with a small home-ice
  // bump (+0.03). Renders as a red→yellow gradient bar toward the favorite.
  const gdPerG = (t) => (t.gp > 0 ? ((t.gf || 0) - (t.ga || 0)) / t.gp : 0);
  const rawA = 0.5 + Math.max(-0.35, Math.min(0.35, gdPerG(away) * 0.20));
  const rawH = 0.5 + Math.max(-0.35, Math.min(0.35, gdPerG(home) * 0.20)) + 0.03;
  const total = rawA + rawH;
  const homeEdge = Math.round((rawH / total) * 100);
  const awayEdge = 100 - homeEdge;

  return (
    <section
      className="mt-4 card-surface p-4 sm:p-5"
      data-testid="pregame-analytics"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff]">
          Matchup Preview
        </div>
      </div>
      <div className="grid grid-cols-3 items-center pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2 justify-start">
          <TeamLogo code={awayCode} size={32} />
          <span className="font-headline text-white text-base">{away.name || awayCode}</span>
        </div>
        <div className="text-center font-accent text-[9px] uppercase tracking-[0.3em] text-white/40">vs</div>
        <div className="flex items-center gap-2 justify-end">
          <span className="font-headline text-white text-base">{home.name || homeCode}</span>
          <TeamLogo code={homeCode} size={32} />
        </div>
      </div>

      {/* Ticker Model projected edge bar */}
      <div className="mb-4 pb-4 border-b border-white/10" data-testid="pregame-projected-edge">
        <div className="flex items-center justify-between text-[10px] mb-2 font-accent uppercase tracking-[0.28em]">
          <span className="text-white/60">Projected Edge</span>
          <span className="text-white/40">Ticker Model</span>
        </div>
        <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0 left-0" style={{ width: `${awayEdge}%`, background: "linear-gradient(90deg, #ef4444, #eab308)" }} />
          <div className="absolute inset-y-0" style={{ left: `${awayEdge}%`, right: 0, background: "rgba(255,255,255,0.1)" }} />
        </div>
        <div className="mt-1.5 flex justify-between text-sm font-headline">
          <span className="text-red-400">{awayEdge}% <span className="text-white/40 text-xs font-accent tracking-widest">{awayCode}</span></span>
          <span className="text-white/70">{homeEdge}% <span className="text-white/40 text-xs font-accent tracking-widest">{homeCode}</span></span>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-3 items-center gap-3">
            <div className="text-right font-headline text-2xl sm:text-3xl leading-none text-white">{r.a}</div>
            <div className="text-center font-accent text-[10px] uppercase tracking-[0.25em] text-white/60">
              {r.label}
            </div>
            <div className="text-left font-headline text-2xl sm:text-3xl leading-none text-white">{r.h}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 text-[9px] font-accent uppercase tracking-widest text-white/30 text-right">
        Season Snapshot · Ticker Model = per-game goal differential + home-ice
      </div>
    </section>
  );
}
