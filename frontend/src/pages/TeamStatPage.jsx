// Team Stat Page — one team's full sheet.
// -----------------------------------------------------------------------------
// Route: /team/:code   (e.g. /team/EDM, /team/MTL)
// Opens from Stats > Standings row click. Shows the team's season line, an
// auto-generated depth chart pulled from /api/stats/players, and prospects
// from tickerCatalog. Every player row deep-links into PlayerDetail so the
// user can drill from team → roster → individual stats.

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users, ChevronRight, TrendingUp, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { TeamLogo } from "@/lib/teamLogos";
import { prospectsForTeam, PROSPECTS } from "@/data/tickerCatalog";

const TEAM_COLORS = {
  EDM: "#fc4c02", COL: "#6f263d", TOR: "#00205b", TBL: "#00205b",
  MIN: "#154734", WPG: "#041e42", NYR: "#0038a8", NYI: "#00539b",
  NJD: "#ce1126", BOS: "#ffb81c", FLA: "#c8102e", CAR: "#cc0000",
  DAL: "#006847", VAN: "#001f5c", ANA: "#f47a38", CGY: "#c8102e",
  BUF: "#003087", UTA: "#71afe5", SJS: "#006d75", CHI: "#cf0a2c",
  DET: "#ce1126", LAK: "#111111", PIT: "#000000", VGK: "#b4975a",
  MTL: "#af1e2d", NSH: "#ffb81c", OTT: "#c52032", PHI: "#f74902",
  STL: "#002f87", SEA: "#001628", WSH: "#c8102e", CBJ: "#002654",
};

// Position groups. Highlightly/NHL data uses C, L (or LW), R (or RW), D, G.
function isForward(pos) {
  if (!pos) return false;
  const p = pos.toUpperCase();
  return ["C", "L", "R", "LW", "RW", "F"].includes(p);
}
function isDefense(pos) {
  return (pos || "").toUpperCase() === "D";
}
function isGoalie(pos) {
  return (pos || "").toUpperCase() === "G";
}

// Auto-generate a depth chart from a list of players. Forwards packed into
// 4 lines of 3 by points; defense into 3 pairs by points; goalies top-2
// by games played. Missing slots stay as null so the layout still renders.
function buildDepthChart(players) {
  const forwards = players.filter((p) => isForward(p.pos))
    .sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const defense = players.filter((p) => isDefense(p.pos))
    .sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const goalies = players.filter((p) => isGoalie(p.pos))
    .sort((a, b) => (b.gp || 0) - (a.gp || 0));

  const lines = [];
  for (let i = 0; i < 4; i++) {
    lines.push([forwards[i * 3] || null, forwards[i * 3 + 1] || null, forwards[i * 3 + 2] || null]);
  }
  const pairs = [];
  for (let i = 0; i < 3; i++) {
    pairs.push([defense[i * 2] || null, defense[i * 2 + 1] || null]);
  }
  const netMinders = [goalies[0] || null, goalies[1] || null];

  return { lines, pairs, netMinders, counts: {
    forwards: forwards.length, defense: defense.length, goalies: goalies.length,
  }};
}

// A single player slot in the depth chart. Missing player → placeholder.
function PlayerSlot({ player, testid }) {
  if (!player) {
    return (
      <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-center">
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/25">Slot open</div>
      </div>
    );
  }
  const pm = player.plus_minus ?? 0;
  return (
    <Link
      to={`/player/${player.id}`}
      data-testid={testid || `team-roster-player-${player.id}`}
      className="rounded-md border border-white/10 bg-black/40 hover:border-[#F58220] hover:bg-white/[0.04] transition-all px-3 py-2.5 group flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-accent text-[9px] uppercase tracking-widest px-1 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.05)", color: "#a0a0a5" }}
          >
            {player.pos || "—"}
          </span>
          <span className="text-white font-headline text-[15px] truncate leading-tight" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
            {player.name}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/55" style={{ fontFamily: "Oswald", fontWeight: 500, letterSpacing: "0.15em" }}>
          {isGoalie(player.pos) ? (
            <>
              <span>{player.gp ?? "—"} GP</span>
              <span>·</span>
              <span>{player.sv_pct != null ? "." + Math.round(player.sv_pct * 1000).toString().padStart(3, "0") : "—"} SV%</span>
              <span>·</span>
              <span>{player.gaa != null ? player.gaa.toFixed(2) : "—"} GAA</span>
            </>
          ) : (
            <>
              <span>{player.g ?? "—"}G · {player.a ?? "—"}A · {player.pts ?? "—"}P</span>
              <span>·</span>
              <span className={pm > 0 ? "text-emerald-400" : pm < 0 ? "text-rose-400" : "text-white/45"}>
                {pm > 0 ? `+${pm}` : String(pm)}
              </span>
            </>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[#F58220] transition-colors flex-shrink-0" />
    </Link>
  );
}

function SeasonStat({ label, value, sub, accent }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">{label}</div>
      <div className="font-headline text-2xl leading-none mt-1" style={{ color: accent || "#fff" }}>{value ?? "—"}</div>
      {sub && <div className="text-[9px] font-accent uppercase tracking-widest text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

export default function TeamStatPage() {
  const { code } = useParams();
  const teamCode = (code || "").toUpperCase();
  const [team, setTeam] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get("/stats/teams").catch(() => ({ data: { teams: [] } })),
      api.get("/stats/players").catch(() => ({ data: { players: [] } })),
    ]).then(([tRes, pRes]) => {
      if (!alive) return;
      const teams = tRes.data?.teams || [];
      const roster = (pRes.data?.players || []).filter(p => (p.team || "").toUpperCase() === teamCode);
      setAllTeams(teams);
      setTeam(teams.find(t => (t.code || "").toUpperCase() === teamCode) || null);
      setPlayers(roster);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [teamCode]);

  const depth = useMemo(() => buildDepthChart(players), [players]);
  // Prospects for an NHL team come from two places: hand-authored orbit list
  // on the prospect (`nhlOrbit`), plus anyone whose junior/college team is a
  // literal match on the code (legacy behavior in `prospectsForTeam`).
  const prospects = useMemo(() => {
    const byOrbit = (PROSPECTS || []).filter(p => (p.nhlOrbit || []).includes(teamCode));
    const byCode = prospectsForTeam(teamCode) || [];
    // dedupe by id
    const map = new Map();
    for (const p of [...byOrbit, ...byCode]) map.set(p.id || `${p.first}-${p.last}`, p);
    return Array.from(map.values());
  }, [teamCode]);
  const accent = TEAM_COLORS[teamCode] || "#1e5dff";

  const divRank = useMemo(() => {
    if (!team) return null;
    const inDiv = allTeams
      .filter(t => t.div === team.div)
      .sort((a, b) => (b.pts || 0) - (a.pts || 0));
    const idx = inDiv.findIndex(t => t.code === team.code);
    return idx >= 0 ? `#${idx + 1} in ${team.div}` : null;
  }, [team, allTeams]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8 text-white/50 text-sm">Loading team…</div>
    );
  }
  if (!team) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4" data-testid="team-stat-not-found">
        <Link to="/stats" className="inline-flex items-center gap-1 text-white/60 hover:text-white text-[11px] font-accent uppercase tracking-widest">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Stats
        </Link>
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center">
          <div className="font-headline text-white text-xl">No team card for “{teamCode}”</div>
          <div className="text-white/50 text-sm mt-1">Check the standings for the right code.</div>
        </div>
      </div>
    );
  }

  const diff = (team.gf || 0) - (team.ga || 0);
  const gfpg = team.gp ? (team.gf / team.gp).toFixed(2) : "—";
  const gapg = team.gp ? (team.ga / team.gp).toFixed(2) : "—";

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6" data-testid={`team-stat-page-${teamCode}`}>
      {/* Back */}
      <Link
        to="/stats"
        className="inline-flex items-center gap-1 text-white/55 hover:text-white text-[11px] font-accent uppercase tracking-widest"
        data-testid="team-stat-back"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Stats
      </Link>

      {/* Hero */}
      <section
        className="rounded-2xl border border-white/10 overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${accent}22 0%, transparent 55%), #0b0b10` }}
        data-testid="team-stat-hero"
      >
        <div className="p-6 sm:p-8 flex items-center gap-5 flex-wrap">
          <div
            className="h-24 w-24 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}33`, border: `1px solid ${accent}88` }}
          >
            <TeamLogo code={teamCode} size={72} monogramClass="!bg-transparent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-accent text-[10px] uppercase tracking-[0.32em]" style={{ color: accent }}>
              {team.conf} · {team.div}
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl text-white leading-none mt-1">{team.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">
                {team.w}-{team.l}-{team.otl}
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">
                {team.pts} PTS
              </span>
              {divRank && (
                <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">
                  {divRank}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest border ${
                diff > 0 ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                         : diff < 0 ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
                                    : "border-white/10 bg-white/5 text-white/60"
              }`}>
                {diff > 0 ? `+${diff}` : String(diff)} DIFF
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Season stat block */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="team-stat-season">
        <SeasonStat label="GP"       value={team.gp} />
        <SeasonStat label="Wins"     value={team.w} accent="#4ade80" />
        <SeasonStat label="Losses"   value={team.l} />
        <SeasonStat label="OTL"      value={team.otl} />
        <SeasonStat label="Points"   value={team.pts} accent={accent} />
        <SeasonStat label="Diff"     value={diff > 0 ? `+${diff}` : String(diff)}
                    accent={diff > 0 ? "#4ade80" : diff < 0 ? "#ff5c7a" : "#fff"} />
        <SeasonStat label="GF"       value={team.gf} sub={`${gfpg} / GP`} />
        <SeasonStat label="GA"       value={team.ga} sub={`${gapg} / GP`} />
        <SeasonStat label="Skaters"  value={depth.counts.forwards + depth.counts.defense} sub="on roster" />
        <SeasonStat label="Goalies"  value={depth.counts.goalies} sub="on roster" />
        <SeasonStat label="Prospects" value={prospects.length} sub={prospects.length ? "in pipeline" : "coming soon"} />
      </section>

      {/* Lineup */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5" data-testid="team-stat-lineup">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-white/60" />
          <span className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/70">
            Lineup · auto-generated from season stats
          </span>
          <div className="flex-1 h-px bg-white/10 ml-2" />
        </div>

        {/* Forward lines */}
        <div className="space-y-3">
          {depth.lines.map((line, i) => (
            <div key={i}>
              <div className="text-[10px] font-accent uppercase tracking-[0.24em] text-white/45 mb-1.5">
                {i === 0 ? "First Line" : i === 1 ? "Second Line" : i === 2 ? "Third Line" : "Fourth Line"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {line.map((p, j) => (
                  <PlayerSlot key={p?.id || `f-${i}-${j}`} player={p} testid={p ? `team-roster-fwd-${p.id}` : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Defense pairs */}
        <div className="space-y-3 mt-5">
          {depth.pairs.map((pair, i) => (
            <div key={i}>
              <div className="text-[10px] font-accent uppercase tracking-[0.24em] text-white/45 mb-1.5">
                {i === 0 ? "Top Pair" : i === 1 ? "Second Pair" : "Third Pair"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pair.map((p, j) => (
                  <PlayerSlot key={p?.id || `d-${i}-${j}`} player={p} testid={p ? `team-roster-def-${p.id}` : undefined} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Goalies */}
        <div className="mt-5">
          <div className="text-[10px] font-accent uppercase tracking-[0.24em] text-white/45 mb-1.5">
            Goaltenders
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {depth.netMinders.map((p, i) => (
              <PlayerSlot key={p?.id || `g-${i}`} player={p} testid={p ? `team-roster-goalie-${p.id}` : undefined} />
            ))}
          </div>
        </div>

        {/* IR — empty for now, kept as scaffolding */}
        <div className="mt-5">
          <div className="text-[10px] font-accent uppercase tracking-[0.24em] text-white/45 mb-1.5">
            Injured Reserve
          </div>
          <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-center text-white/40 text-xs">
            No IR entries reported.
          </div>
        </div>

        {players.length === 0 && (
          <div className="mt-4 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-center text-white/50 text-sm">
            Full roster coming soon. Real Sportradar hydration lands with the next data pass.
          </div>
        )}
      </section>

      {/* Prospects */}
      <section className="rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5" data-testid="team-stat-prospects">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#F58220]" />
          <span className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/70">
            Prospects · pipeline
          </span>
          <div className="flex-1 h-px bg-white/10 ml-2" />
        </div>
        {prospects.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-white/50 text-sm">
            No prospects logged yet — check back after the next scouting run.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {prospects.map((pr) => {
              const pid = pr.id || `${pr.first}-${pr.last}`;
              const name = pr.name || [pr.first, pr.last].filter(Boolean).join(" ");
              const meta = [pr.pos, pr.juniorTeam || pr.ncaaTeam || pr.league || pr.club, pr.draftYear ? `${pr.draftYear} draft` : null].filter(Boolean).join(" · ");
              return (
                <Link
                  key={pid}
                  to={pr.id ? `/plus/prospect/${pr.id}` : "#"}
                  data-testid={`team-prospect-${pid}`}
                  className="rounded-md border border-white/10 bg-black/40 hover:border-[#F58220] hover:bg-white/[0.04] px-3 py-2.5 flex items-center justify-between gap-3 transition-all group"
                >
                  <div className="min-w-0">
                    <div className="text-white font-headline text-[15px] leading-tight truncate" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
                      {name}
                    </div>
                    <div className="text-[11px] text-white/55 mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 500, letterSpacing: "0.15em" }}>
                      {meta || "In pipeline"}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[#F58220] transition-colors flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer note */}
      <div className="pt-4 text-center text-[10px] font-accent uppercase tracking-widest text-white/30">
        Depth chart derived from live season stats · full roster + IR when Sportradar unlocks
      </div>
    </div>
  );
}
