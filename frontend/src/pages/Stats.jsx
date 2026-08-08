import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { TEST_IDS } from "@/lib/config";
import { LineChart, Trophy, Shield, Calendar, Mic, ArrowRight, X } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";

const TABS = [
  { id: "skaters",  label: "Skaters",   icon: LineChart, testid: TEST_IDS.stats.tabSkaters },
  { id: "goalies",  label: "Goalies",   icon: Shield,    testid: TEST_IDS.stats.tabGoalies },
  { id: "teams",    label: "Standings", icon: Trophy,    testid: TEST_IDS.stats.tabTeams },
  { id: "schedule", label: "Schedule",  icon: Calendar,  testid: TEST_IDS.stats.tabSchedule },
];

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}
function fmtPct1000(v) {
  if (v == null) return "—";
  return "." + Math.round(v * 1000).toString().padStart(3, "0");
}

// The Stats page is the "NHL monitor" — a familiar light-mode widget embedded
// in the dark app shell. Layout mirrors NHL.com's density and column set.
// Proprietary analytics (Momentum, Fatigue, xG, etc.) do NOT live here —
// they live in the Presser Deep Dive tabs. Subtle "want the story?" hooks
// invite users over without cluttering the sheet.

export default function Stats() {
  const [tab, setTab] = useState("skaters");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [nhlLive, setNhlLive] = useState(false);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [divFilter, setDivFilter] = useState("ALL");

  useEffect(() => {
    api.get("/stats/players").then((r) => setPlayers(r.data.players || [])).catch(() => {});
    api.get("/stats/teams").then((r) => setTeams(r.data.teams || [])).catch(() => {});
    api.get("/nhl/games").then((r) => { setGames(r.data.games || []); setNhlLive(!!r.data.live); }).catch(() => {});
  }, []);

  const teamsInDiv = useMemo(() => {
    if (divFilter === "ALL") return null;
    return new Set(teams.filter((t) => t.div === divFilter).map((t) => t.code));
  }, [teams, divFilter]);

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (teamFilter !== "ALL" && p.team !== teamFilter) return false;
      if (teamsInDiv && !teamsInDiv.has(p.team)) return false;
      return true;
    });
  }, [players, teamFilter, teamsInDiv]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (teamFilter !== "ALL" && t.code !== teamFilter) return false;
      if (divFilter !== "ALL" && t.div !== divFilter) return false;
      return true;
    });
  }, [teams, teamFilter, divFilter]);

  const skaters = useMemo(() => filteredPlayers.filter((p) => p.pos !== "G"), [filteredPlayers]);
  const goalies = useMemo(() => filteredPlayers.filter((p) => p.pos === "G"), [filteredPlayers]);

  function sortRows(rows, defaultKey) {
    const key = sortKey || defaultKey;
    const dir = sortDir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = a[key] ?? 0, vb = b[key] ?? 0;
      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });
  }

  function onSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  return (
    <div className="space-y-6" data-testid={TEST_IDS.stats.pageRoot}>
      {/* Dark shell header */}
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#00e5ff]">
            The numbers · 2025-26
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl text-white mt-1">
            Stats
          </h1>
          <p className="text-white/60 text-sm mt-1 max-w-2xl">
            The full sheet — laid out the way you already read it.
            <Link to="/press-conference" className="text-[#1e5dff] hover:text-white ml-1 inline-flex items-center gap-1">
              Read it Marc &amp; Reggie's way <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/50">
          Data · Sportradar · {nhlLive ? "live" : "illustrative"}
        </div>
      </header>

      {/* Tabs (dark) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              data-testid={t.testid}
              onClick={() => { setTab(t.id); setSortKey(null); }}
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

      {/* Light "NHL monitor" widget */}
      <div
        className="rounded-2xl border border-white/10 overflow-hidden shadow-[0_20px_60px_-30px_rgba(30,93,255,0.4)]"
        style={{ background: "linear-gradient(180deg, #f7f8fa 0%, #ffffff 100%)" }}
      >
        {/* Widget top bar with team + division filters (mimics NHL.com filter row) */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white flex-wrap">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 live-pulse" />
            <span className="font-accent text-[10px] uppercase tracking-[0.28em] text-slate-500">
              Live · Season 2025-26
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="font-accent text-[10px] uppercase tracking-widest text-slate-400">Division</label>
            <select
              value={divFilter}
              onChange={(e) => setDivFilter(e.target.value)}
              data-testid="stats-filter-division"
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-[#1e5dff]"
            >
              <option value="ALL">All divisions</option>
              <option value="Atlantic">Atlantic</option>
              <option value="Metropolitan">Metropolitan</option>
              <option value="Central">Central</option>
              <option value="Pacific">Pacific</option>
            </select>
            <label className="font-accent text-[10px] uppercase tracking-widest text-slate-400 ml-2">Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              data-testid="stats-filter-team"
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-[#1e5dff]"
            >
              <option value="ALL">All teams</option>
              {teams
                .filter((t) => divFilter === "ALL" || t.div === divFilter)
                .map((t) => (
                  <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
                ))}
            </select>
          </div>
        </div>

        {tab === "skaters" && (
          <NHLTable
            rows={sortRows(skaters, "pts").map((p, i) => ({ ...p, rank: i + 1 }))}
            columns={[
              { key: "rank", label: "#", w: "w-10 text-slate-400", sort: null },
              { key: "team", label: "Team", w: "w-20 text-center", sort: null,
                render: (v) => (
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <TeamLogo code={v} size={20} />
                    <span className="text-[12px] font-accent uppercase tracking-widest text-slate-600">{v}</span>
                  </span>
                ) },
              { key: "name", label: "Player", w: "min-w-[160px] text-slate-900 font-semibold sticky-name", sort: null },
              { key: "pos",  label: "Pos",  w: "w-14 text-center", sort: null },
              { key: "gp",   label: "GP",   w: "w-14 text-right",  sort: true },
              { key: "g",    label: "G",    w: "w-14 text-right",  sort: true },
              { key: "a",    label: "A",    w: "w-14 text-right",  sort: true },
              { key: "pts",  label: "P",    w: "w-14 text-right font-bold text-slate-900", sort: true },
              { key: "plus_minus", label: "+/-", w: "w-14 text-right", sort: true,
                render: (v) => (v > 0 ? `+${v}` : String(v)) },
              { key: "toi",  label: "TOI/GP", w: "w-20 text-right", sort: null },
            ]}
            onSort={onSort}
            sortKey={sortKey || "pts"}
            sortDir={sortDir}
            currentTab={tab}
            rowLinkFn={(r) => `/player/${r.id}`}
          />
        )}

        {tab === "goalies" && (
          <NHLTable
            rows={sortRows(goalies, "sv_pct").map((p, i) => ({ ...p, rank: i + 1 }))}
            columns={[
              { key: "rank", label: "#", w: "w-10 text-slate-400", sort: null },
              { key: "team", label: "Team", w: "w-20 text-center", sort: null,
                render: (v) => (
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <TeamLogo code={v} size={20} />
                    <span className="text-[12px] font-accent uppercase tracking-widest text-slate-600">{v}</span>
                  </span>
                ) },
              { key: "name", label: "Goaltender", w: "min-w-[160px] text-slate-900 font-semibold sticky-name", sort: null },
              { key: "gp",   label: "GP",   w: "w-14 text-right", sort: true },
              { key: "w",    label: "W",    w: "w-14 text-right", sort: true },
              { key: "l",    label: "L",    w: "w-14 text-right", sort: true },
              { key: "sv_pct", label: "SV%", w: "w-20 text-right font-bold text-slate-900", sort: true,
                render: fmtPct1000 },
              { key: "gaa",  label: "GAA",  w: "w-16 text-right", sort: true },
            ]}
            onSort={onSort}
            sortKey={sortKey || "sv_pct"}
            sortDir={sortDir}
            currentTab={tab}
            rowLinkFn={(r) => `/player/${r.id}`}
          />
        )}

        {tab === "teams" && (
          <NHLTable
            rows={sortRows(
              filteredTeams.map((t) => ({ ...t, diff: (t.gf || 0) - (t.ga || 0) })),
              "pts",
            ).map((t, i) => ({ ...t, rank: i + 1 }))}
            columns={[
              { key: "rank", label: "#", w: "w-10 text-slate-400", sort: null },
              { key: "name", label: "Team", w: "min-w-[160px] text-slate-900 font-semibold sticky-name", sort: null,
                render: (v, row) => (
                  <span className="inline-flex items-center gap-2">
                    <TeamLogo code={row.code} size={22} />
                    <span>{v}</span>
                  </span>
                ) },
              { key: "gp",   label: "GP",  w: "w-14 text-right", sort: true },
              { key: "w",    label: "W",   w: "w-14 text-right", sort: true },
              { key: "l",    label: "L",   w: "w-14 text-right", sort: true },
              { key: "otl",  label: "OTL", w: "w-14 text-right", sort: true },
              { key: "pts",  label: "PTS", w: "w-16 text-right font-bold text-slate-900", sort: true },
              { key: "gf",   label: "GF",  w: "w-16 text-right", sort: true },
              { key: "ga",   label: "GA",  w: "w-16 text-right", sort: true },
              { key: "diff", label: "+/-", w: "w-16 text-right", sort: true,
                render: (v) => (v > 0 ? `+${v}` : String(v)) },
            ]}
            onSort={onSort}
            sortKey={sortKey || "pts"}
            sortDir={sortDir}
            currentTab={tab}
            rowLinkFn={(r) => `/team/${r.code}`}
          />
        )}

        {tab === "schedule" && (
          <div className="p-4">
            {games.length === 0 ? (
              <div className="text-slate-500 text-sm py-8 text-center">
                No games on the slate right now. Come back at puck drop.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {games.map((g, i) => (
                  <Link
                    key={g.id || i}
                    to="/soon/matchup-sheet"
                    className="flex items-center justify-between py-3 px-2 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="font-accent text-[11px] uppercase tracking-widest text-slate-500 w-24">
                      {fmtDate(g.start_iso)}
                    </div>
                    <div className="flex-1 text-center font-headline text-slate-900">
                      <span className="inline-flex items-center gap-2 justify-center">
                        <TeamLogo code={g.away?.code || g.away} size={20} />
                        <span>{(g.away?.code || g.away)}</span>
                        <span className="text-slate-400 mx-1">@</span>
                        <span>{(g.home?.code || g.home)}</span>
                        <TeamLogo code={g.home?.code || g.home} size={20} />
                      </span>
                    </div>
                    <div className="text-[10px] font-accent uppercase tracking-widest text-slate-400 w-32 text-right flex items-center justify-end gap-2">
                      <span>{g.status || "Scheduled"}</span>
                      <Mic className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#1e5dff] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Widget footer */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-slate-200 bg-slate-50">
          <div className="text-[10px] font-accent uppercase tracking-widest text-slate-400">
            Source · Sportradar · Refreshed 5m
          </div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-slate-400">
            The Ticker · Public Sheet
          </div>
        </div>
      </div>

      {/* Leaders grid — scroll-down leaders in every category, NHL.com-style */}
      <LeadersGrid players={filteredPlayers} />

      <div className="text-[10px] font-accent uppercase tracking-widest text-white/35 text-center pt-2">
        For entertainment &amp; decision insights — never a wager
      </div>
    </div>
  );
}

function NHLTable({ rows, columns, onSort, sortKey, sortDir, currentTab, rowLinkFn }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => c.sort && onSort(c.key)}
                className={`px-3 py-2.5 font-accent text-[10px] uppercase tracking-widest text-slate-500 ${c.w} ${
                  c.sort ? "cursor-pointer hover:text-slate-900" : ""
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.sort && sortKey === c.key && (
                    <span className="text-[#1e5dff]">{sortDir === "desc" ? "▼" : "▲"}</span>
                  )}
                </span>
              </th>
            ))}
            {/* Presser hook column */}
            <th className="w-10 px-2 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const href = rowLinkFn ? rowLinkFn(r) : null;
            return (
              <tr
                key={r.id || i}
                className={`border-b border-slate-100 hover:bg-blue-50/60 transition-colors ${
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 text-slate-700 ${c.w}`}>
                    {c.key === "name" && href ? (
                      <Link
                        to={href}
                        className="text-slate-900 hover:text-[#1e5dff] transition-colors"
                        data-testid={`stats-row-link-${currentTab}-${i}`}
                      >
                        {c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}
                      </Link>
                    ) : c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}
                  </td>
                ))}
                <td className="w-10 px-2 py-2 text-right">
                  <Link
                    to={`/press-conference?analyst=marc`}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full text-slate-300 hover:text-[#1e5dff] hover:bg-blue-100 transition-all"
                    title="Ask Marc about this"
                    data-testid={`stats-presser-hook-${currentTab}-${i}`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Scroll-down leaders in every major category — NHL.com's "Stats Hub" pattern.
// Each card is white (matches the light widget style) and clickable — tap to
// open the full top-15 list for that category.
function LeadersGrid({ players }) {
  const [openCat, setOpenCat] = useState(null);
  const skaters = players.filter((p) => p.pos !== "G");
  const goalies = players.filter((p) => p.pos === "G");

  const cats = [
    { title: "Goals", key: "g" },
    { title: "Assists", key: "a" },
    { title: "Points", key: "pts" },
    { title: "Plus / Minus", key: "plus_minus", fmt: (v) => (v > 0 ? `+${v}` : String(v)) },
    { title: "Shots on Goal", key: "s" },
    { title: "Shooting %", key: "s_pct", unit: "%", fmt: (v) => v?.toFixed(1) },
    { title: "Power Play Goals", key: "ppg" },
    { title: "Game-Winning Goals", key: "gwg" },
    { title: "Hits", key: "hits" },
    { title: "Blocked Shots", key: "blocks" },
    { title: "Faceoff Win %", key: "fow_pct", unit: "%", fmt: (v) => v?.toFixed(1) },
    { title: "Penalty Minutes", key: "pim" },
  ];

  const goalieCats = [
    { title: "Wins", key: "w" },
    { title: "Save %", key: "sv_pct", fmt: (v) => "." + Math.round(v * 1000).toString().padStart(3, "0") },
    { title: "Goals-Against Avg", key: "gaa", fmt: (v) => v?.toFixed(2), lowerBetter: true },
    { title: "Shutouts", key: "so" },
  ];

  return (
    <section data-testid="stats-leaders-grid" className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/60">
          Leaders · every category · tap to expand
        </div>
        <div className="flex-1 h-px bg-[#2d2d35]" />
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
          Filters carry through
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cats.map((c) => (
          <LeaderCard key={c.key} players={skaters} cat={c} onOpen={() => setOpenCat({ cat: c, pool: skaters, group: "Skaters" })} />
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/60">
          Goaltenders
        </div>
        <div className="flex-1 h-px bg-[#2d2d35]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {goalieCats.map((c) => (
          <LeaderCard key={c.key} players={goalies} cat={c} onOpen={() => setOpenCat({ cat: c, pool: goalies, group: "Goaltenders" })} />
        ))}
      </div>

      {openCat && (
        <LeaderModal
          cat={openCat.cat}
          pool={openCat.pool}
          group={openCat.group}
          onClose={() => setOpenCat(null)}
        />
      )}
    </section>
  );
}

function LeaderCard({ players, cat, onOpen }) {
  const sorted = [...players]
    .filter((p) => p[cat.key] != null)
    .sort((a, b) => cat.lowerBetter ? (a[cat.key] - b[cat.key]) : (b[cat.key] - a[cat.key]))
    .slice(0, 3);
  const fmt = cat.fmt || ((v) => String(v));

  return (
    <button
      onClick={onOpen}
      data-testid={`leader-card-${cat.key}`}
      className="text-left rounded-xl border border-slate-200 bg-white hover:border-[#1e5dff] hover:shadow-[0_8px_24px_-8px_rgba(30,93,255,0.35)] transition-all p-3.5 group"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-accent text-[11px] uppercase tracking-[0.22em] text-slate-500">
          {cat.title}
        </div>
        <span className="text-[11px] font-accent uppercase tracking-widest text-slate-300 group-hover:text-[#1e5dff] transition-colors">
          Full list →
        </span>
      </div>
      {sorted.length === 0 ? (
        <div className="text-slate-400 text-sm">No data</div>
      ) : (
        <ol className="space-y-2">
          {sorted.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-accent text-[12px] w-4 flex-shrink-0 ${i === 0 ? "text-[#1e5dff]" : "text-slate-400"}`}>
                  {i + 1}
                </span>
                {/* Logo BEFORE name — easier team recognition at a glance */}
                <span className="flex items-center gap-1 flex-shrink-0">
                  <TeamLogo code={p.team} size={18} />
                  <span className="text-[11px] font-accent uppercase tracking-widest text-slate-500">{p.team}</span>
                </span>
                <span className={`truncate text-[15px] ${i === 0 ? "text-slate-900 font-semibold" : "text-slate-700"}`}>
                  {p.name}
                </span>
              </div>
              <span className={`font-headline flex-shrink-0 ${i === 0 ? "text-slate-900 text-lg" : "text-slate-700 text-base"}`}>
                {fmt(p[cat.key])}{cat.unit || ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </button>
  );
}

function LeaderModal({ cat, pool, group, onClose }) {
  const fmt = cat.fmt || ((v) => String(v));
  const sorted = [...pool]
    .filter((p) => p[cat.key] != null)
    .sort((a, b) => cat.lowerBetter ? (a[cat.key] - b[cat.key]) : (b[cat.key] - a[cat.key]))
    .slice(0, 20);

  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(5,7,15,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      data-testid="leader-modal"
    >
      <div
        className="max-w-lg w-full rounded-2xl overflow-hidden border border-white/10 bg-white shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-slate-500">
              {group} · League Leaders
            </div>
            <div className="font-headline text-xl text-slate-900 mt-0.5">{cat.title}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 transition-colors"
            aria-label="Close"
            data-testid="leader-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <table className="w-full text-[15px]">
            <thead className="sticky top-0 bg-white border-b border-slate-200">
              <tr>
                <th className="w-10 px-3 py-2.5 text-left font-accent text-[11px] uppercase tracking-widest text-slate-500">#</th>
                <th className="w-16 px-3 py-2.5 text-center font-accent text-[11px] uppercase tracking-widest text-slate-500">Team</th>
                <th className="px-3 py-2.5 text-left font-accent text-[11px] uppercase tracking-widest text-slate-500">Player</th>
                <th className="w-14 px-3 py-2.5 text-center font-accent text-[11px] uppercase tracking-widest text-slate-500">Pos</th>
                <th className="w-20 px-3 py-2.5 text-right font-accent text-[11px] uppercase tracking-widest text-slate-500">{cat.title}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 hover:bg-blue-50/60 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                  data-testid={`leader-modal-row-${i}`}
                >
                  <td className={`px-3 py-2.5 font-accent ${i === 0 ? "text-[#1e5dff] font-bold" : "text-slate-400"}`}>{i + 1}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600 text-[12px] font-accent uppercase tracking-widest">
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <TeamLogo code={p.team} size={20} />
                      {p.team}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 ${i === 0 ? "text-slate-900 font-semibold" : "text-slate-700"}`}>{p.name}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500 text-[12px] font-accent uppercase tracking-widest">{p.pos || "—"}</td>
                  <td className={`px-3 py-2.5 text-right font-headline ${i === 0 ? "text-slate-900 text-lg" : "text-slate-700"}`}>
                    {fmt(p[cat.key])}{cat.unit || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] font-accent uppercase tracking-widest text-slate-400">
            Showing top {sorted.length}
          </span>
          <Link
            to="/press-conference?analyst=marc"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
            data-testid="leader-modal-ask-marc"
          >
            <Mic className="w-3 h-3" /> Ask Marc why
          </Link>
        </div>
      </div>
    </div>
  );
}

function FounderTease() { return null; }

