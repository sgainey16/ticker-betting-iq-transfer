import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { TEST_IDS } from "@/lib/config";
import { LineChart, Trophy, Shield, Calendar } from "lucide-react";

const TABS = [
  { id: "skaters", label: "Skaters", icon: LineChart, testid: TEST_IDS.stats.tabSkaters },
  { id: "goalies", label: "Goalies", icon: Shield, testid: TEST_IDS.stats.tabGoalies },
  { id: "teams",   label: "Standings", icon: Trophy, testid: TEST_IDS.stats.tabTeams },
  { id: "schedule", label: "Schedule", icon: Calendar, testid: TEST_IDS.stats.tabSchedule },
];

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function Stats() {
  const [tab, setTab] = useState("skaters");
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [nhlLive, setNhlLive] = useState(false);

  useEffect(() => {
    api.get("/stats/players").then((r) => setPlayers(r.data.players || [])).catch(() => {});
    api.get("/stats/teams").then((r) => setTeams(r.data.teams || [])).catch(() => {});
    api.get("/nhl/games").then((r) => { setGames(r.data.games || []); setNhlLive(!!r.data.live); }).catch(() => {});
  }, []);

  const skaters = useMemo(
    () => players.filter((p) => p.pos !== "G").sort((a, b) => (b.pts || 0) - (a.pts || 0)),
    [players],
  );
  const goalies = useMemo(
    () => players.filter((p) => p.pos === "G").sort((a, b) => (b.sv_pct || 0) - (a.sv_pct || 0)),
    [players],
  );
  const standings = useMemo(
    () => [...teams].sort((a, b) => (b.pts || 0) - (a.pts || 0)),
    [teams],
  );

  return (
    <div className="space-y-6" data-testid={TEST_IDS.stats.pageRoot}>
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#00e5ff]">
            The numbers · 2025-26
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl text-white mt-1">
            Live NHL Stats
          </h1>
          <p className="text-white/60 text-sm mt-1 max-w-2xl">
            Skater leaders, goalie leaders, standings, and tonight's slate.
            Same layout you already read on the league site — dressed for the desk.
          </p>
        </div>
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/50">
          Data · SportsData.io · {nhlLive ? "live" : "illustrative"}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              data-testid={t.testid}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-accent text-[11px] uppercase tracking-widest transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#1e5dff] text-white shadow-[0_0_18px_-4px_rgba(30,93,255,0.7)]"
                  : "border border-[#2d2d35] text-white/70 hover:border-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "skaters" && (
        <StatsTable
          columns={[
            { key: "rank",    label: "#",    className: "text-white/40 w-10" },
            { key: "name",    label: "Player" },
            { key: "team",    label: "TM",   className: "text-center w-14" },
            { key: "pos",     label: "POS",  className: "text-center w-14" },
            { key: "gp",      label: "GP",   className: "text-right w-14" },
            { key: "g",       label: "G",    className: "text-right w-14" },
            { key: "a",       label: "A",    className: "text-right w-14" },
            { key: "pts",     label: "PTS",  className: "text-right w-16 text-white" },
            { key: "plus_minus", label: "+/-", className: "text-right w-16",
              render: (v) => (v > 0 ? `+${v}` : String(v)) },
            { key: "toi",     label: "TOI",  className: "text-right w-20" },
          ]}
          rows={skaters.map((p, i) => ({ ...p, rank: i + 1 }))}
        />
      )}

      {tab === "goalies" && (
        <StatsTable
          columns={[
            { key: "rank", label: "#", className: "text-white/40 w-10" },
            { key: "name", label: "Goaltender" },
            { key: "team", label: "TM", className: "text-center w-14" },
            { key: "gp",   label: "GP", className: "text-right w-14" },
            { key: "w",    label: "W",  className: "text-right w-14" },
            { key: "l",    label: "L",  className: "text-right w-14" },
            { key: "sv_pct", label: "SV%", className: "text-right w-20 text-white",
              render: (v) => `.${Math.round(v * 1000).toString().padStart(3, "0")}` },
            { key: "gaa",  label: "GAA", className: "text-right w-16" },
          ]}
          rows={goalies.map((p, i) => ({ ...p, rank: i + 1 }))}
        />
      )}

      {tab === "teams" && (
        <StatsTable
          columns={[
            { key: "rank", label: "#", className: "text-white/40 w-10" },
            { key: "name", label: "Team" },
            { key: "gp",   label: "GP", className: "text-right w-14" },
            { key: "w",    label: "W",  className: "text-right w-14" },
            { key: "l",    label: "L",  className: "text-right w-14" },
            { key: "otl",  label: "OTL", className: "text-right w-14" },
            { key: "pts",  label: "PTS", className: "text-right w-16 text-white" },
            { key: "gf",   label: "GF", className: "text-right w-16" },
            { key: "ga",   label: "GA", className: "text-right w-16" },
            { key: "diff", label: "+/-", className: "text-right w-16",
              render: (v) => (v > 0 ? `+${v}` : String(v)) },
          ]}
          rows={standings.map((t, i) => ({
            ...t, rank: i + 1, diff: (t.gf || 0) - (t.ga || 0),
          }))}
        />
      )}

      {tab === "schedule" && (
        <div className="card-surface p-4">
          {games.length === 0 ? (
            <div className="text-white/50 text-sm py-6 text-center">
              No games on the slate right now. Come back at puck drop.
            </div>
          ) : (
            <div className="divide-y divide-[#2d2d35]">
              {games.map((g, i) => (
                <div key={g.id || i} className="flex items-center justify-between py-3 px-2">
                  <div className="font-accent text-[11px] uppercase tracking-widest text-white/50 w-24">
                    {fmtDate(g.start_iso)}
                  </div>
                  <div className="flex-1 text-center font-headline text-white">
                    {(g.away?.code || g.away)} <span className="text-white/40 mx-2">@</span> {(g.home?.code || g.home)}
                  </div>
                  <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 w-24 text-right">
                    {g.status || "Scheduled"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] font-accent uppercase tracking-widest text-white/35 text-center pt-2">
        Numbers refresh live where available · Illustrative otherwise · For entertainment
      </div>
    </div>
  );
}

function StatsTable({ columns, rows }) {
  return (
    <div className="card-surface p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[#2d2d35] bg-[#0b0b10]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2.5 font-accent text-[10px] uppercase tracking-widest text-white/50 ${c.className || ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || i} className="border-b border-[#1a1a22] hover:bg-white/[0.02] transition-colors">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 text-white/75 ${c.className || ""}`}>
                    {c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
