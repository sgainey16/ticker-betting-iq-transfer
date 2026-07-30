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
  const rows = [
    { label: "Record",       a: rec(away),                h: rec(home) },
    { label: "Points",       a: away.pts ?? "—",          h: home.pts ?? "—" },
    { label: "Goals For",    a: away.gf ?? "—",           h: home.gf ?? "—" },
    { label: "Goals Against", a: away.ga ?? "—",           h: home.ga ?? "—" },
    { label: "Goal Diff",    a: signed((away.gf || 0) - (away.ga || 0)),
                             h: signed((home.gf || 0) - (home.ga || 0)) },
  ];
  return (
    <section
      className="mt-4 card-surface p-4 sm:p-5"
      data-testid="pregame-analytics"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff]">
          Pregame · Team vs Team
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
        Season Snapshot · Reggie &amp; Marc are watching these
      </div>
    </section>
  );
}

function signed(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}
