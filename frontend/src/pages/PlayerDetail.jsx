import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import {
  ArrowLeft, TrendingUp, Target, Shield, Flame,
  Mic2, Calculator, ChevronRight, Circle,
} from "lucide-react";

// Team primary colors — matches the shell aesthetic. Any team not listed
// falls back to Ticker Blue.
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

const TEAM_NAMES = {
  EDM: "Edmonton Oilers", COL: "Colorado Avalanche", TOR: "Toronto Maple Leafs",
  TBL: "Tampa Bay Lightning", MIN: "Minnesota Wild", WPG: "Winnipeg Jets",
  NYR: "New York Rangers", NJD: "New Jersey Devils", NYI: "New York Islanders",
  BOS: "Boston Bruins", FLA: "Florida Panthers", CAR: "Carolina Hurricanes",
  DAL: "Dallas Stars", VAN: "Vancouver Canucks", ANA: "Anaheim Ducks",
  CGY: "Calgary Flames", BUF: "Buffalo Sabres", UTA: "Utah Hockey Club",
  SJS: "San Jose Sharks", CHI: "Chicago Blackhawks", DET: "Detroit Red Wings",
  LAK: "Los Angeles Kings", PIT: "Pittsburgh Penguins", VGK: "Vegas Golden Knights",
  MTL: "Montreal Canadiens", NSH: "Nashville Predators", OTT: "Ottawa Senators",
  PHI: "Philadelphia Flyers", STL: "St. Louis Blues", SEA: "Seattle Kraken",
  WSH: "Washington Capitals", CBJ: "Columbus Blue Jackets",
};

function initials(name) {
  return (name || "?").split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// Deterministic mock game log — 5 last games with real-feeling variance.
function gameLogFor(p) {
  const rng = (seed) => {
    let x = Math.abs(seed * 9301 + 49297) % 233280;
    return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  };
  const seed = (p?.name || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = rng(seed);
  const opponents = ["MIN", "COL", "WPG", "DAL", "VAN", "NYR", "TBL", "BOS"];
  const isGoalie = (p.pos || "").toUpperCase() === "G";
  return Array.from({ length: 5 }, (_, i) => {
    const home = r() > 0.5;
    const opp = opponents[Math.floor(r() * opponents.length)];
    const date = new Date(Date.now() - (i + 1) * 86400000 * 2);
    const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (isGoalie) {
      const sa = 22 + Math.floor(r() * 18);
      const ga = Math.floor(r() * 4);
      const sv = sa - ga;
      const result = ga <= 2 ? "W" : ga >= 4 ? "L" : (r() > 0.4 ? "OTL" : "W");
      return {
        date: dateStr, opp, home,
        line1: `${result} · ${sv}/${sa}`,
        line2: `${((sv / sa) * 1000 / 1000).toFixed(3)} SV% · ${ga} GA`,
        result,
      };
    }
    const g = Math.floor(r() * 3);
    const a = Math.floor(r() * 3);
    const s = Math.floor(r() * 6) + 1;
    const pm = Math.floor(r() * 5) - 2;
    return {
      date: dateStr, opp, home,
      line1: `${g}G ${a}A`, line2: `${s} SOG · ${pm >= 0 ? "+" : ""}${pm}`,
      result: g + a > 0 ? "PT" : "-",
    };
  });
}

function hostTakesForPlayer(p, rank) {
  const pos = (p.pos || "").toUpperCase();
  const t = (p.team || "").toUpperCase();
  const pts = p.pts ?? 0;
  const gp = p.gp ?? 0;
  const isGoalie = pos === "G";

  const reggie = isGoalie
    ? `${p.name.split(" ")[0]}'s a workhorse. ${p.w ?? "?"} wins with a ${(p.sv_pct ?? 0).toFixed(3)} sv% — that's a HOCKEY goalie. When his team plays the RIGHT way in front of him, he steals nights. Simple beats fancy. Write it down.`
    : pts / Math.max(1, gp) >= 1.5
    ? `Attaboy. ${pts} points in ${gp} games — that's a big-goal guy in a big-goal role. First to the puck, first to the middle. Don't overthink it. That's a HOCKEY player.`
    : pts / Math.max(1, gp) >= 0.9
    ? `Solid contributor. Not flashy — just shows up every shift. Compete for the puck, do the right things. Then execute. He's earning his minutes.`
    : `Kid's been quiet. But hockey keeps receipts. You watch what he does in the third period, that's where the story is. Effort's free.`;

  const marc = isGoalie
    ? `Sample size is meaningful now — ${p.gp} GP, sv% of ${(p.sv_pct ?? 0).toFixed(3)} sits ${rank.svRank || "top-quartile"} among starters. GAA of ${(p.gaa ?? 0).toFixed(2)} tracks with expected. Regression risk is minimal barring team-defensive collapse.`
    : `The math: ${(pts / Math.max(1, gp)).toFixed(2)} PPG puts him ${rank.pptRank || "in the top group"} among ${pos === "D" ? "defensemen" : "forwards"}. Shooting percentage of ${(p.s_pct ?? 0).toFixed(1)}% is ${((p.s_pct ?? 0) > 15 ? "running hot — expect some cooling" : (p.s_pct ?? 0) > 10 ? "sustainable" : "below career norms — positive regression coming")}. Team context (${TEAM_NAMES[t] || t}) supports current usage.`;

  return { reggie, marc };
}

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-4">
      <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="font-headline text-3xl mt-1" style={{ color: accent || "#ffffff" }}>
        {value ?? "—"}
      </div>
      {hint && <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-1">{hint}</div>}
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] p-3">
      <div className="font-accent text-[9px] uppercase tracking-widest text-white/45">{label}</div>
      <div className="font-headline text-xl text-white mt-1">{value ?? "—"}</div>
    </div>
  );
}

export default function PlayerDetail() {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/stats/players")
      .then((r) => setPlayers(r.data.players || []))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, []);

  const player = useMemo(() => players.find((p) => p.id === playerId), [players, playerId]);
  const isGoalie = (player?.pos || "").toUpperCase() === "G";
  const teamColor = TEAM_COLORS[(player?.team || "").toUpperCase()] || "#1e5dff";

  const rank = useMemo(() => {
    if (!player || !players.length) return {};
    if (isGoalie) {
      const goalies = players.filter((p) => (p.pos || "").toUpperCase() === "G");
      const svRank = 1 + goalies.filter((g) => (g.sv_pct || 0) > (player.sv_pct || 0)).length;
      const winRank = 1 + goalies.filter((g) => (g.w || 0) > (player.w || 0)).length;
      return { svRank: `#${svRank} in sv%`, winRank: `#${winRank} in wins`, poolLabel: `of ${goalies.length} qualified goalies` };
    }
    const skaters = players.filter((p) => (p.pos || "").toUpperCase() !== "G");
    const ppg = (p) => (p.gp ? p.pts / p.gp : 0);
    const pptRank = 1 + skaters.filter((s) => ppg(s) > ppg(player)).length;
    const gRank = 1 + skaters.filter((s) => (s.g || 0) > (player.g || 0)).length;
    const pointsRank = 1 + skaters.filter((s) => (s.pts || 0) > (player.pts || 0)).length;
    return {
      pptRank: `#${pptRank} in PPG`,
      gRank: `#${gRank} in goals`,
      pointsRank: `#${pointsRank} in points`,
      poolLabel: `of ${skaters.length} qualified skaters`,
    };
  }, [player, players, isGoalie]);

  const gameLog = useMemo(() => (player ? gameLogFor(player) : []), [player]);
  const takes = useMemo(() => (player ? hostTakesForPlayer(player, rank) : null), [player, rank]);

  const similar = useMemo(() => {
    if (!player) return [];
    if (isGoalie) {
      return players
        .filter((p) => (p.pos || "").toUpperCase() === "G" && p.id !== player.id)
        .sort((a, b) => Math.abs((a.sv_pct || 0) - (player.sv_pct || 0)) - Math.abs((b.sv_pct || 0) - (player.sv_pct || 0)))
        .slice(0, 4);
    }
    const ppg = (p) => (p.gp ? p.pts / p.gp : 0);
    return players
      .filter((p) => (p.pos || "").toUpperCase() !== "G" && p.id !== player.id && (p.pos || "") === (player.pos || ""))
      .sort((a, b) => Math.abs(ppg(a) - ppg(player)) - Math.abs(ppg(b) - ppg(player)))
      .slice(0, 4);
  }, [player, players, isGoalie]);

  if (loading) {
    return <div className="text-white/50 font-accent text-xs uppercase tracking-widest">Loading player…</div>;
  }
  if (!player) {
    return (
      <div className="card-surface p-8 text-center">
        <div className="font-headline text-2xl text-white mb-2">Player not found</div>
        <div className="text-white/60 text-sm">The desk doesn't have a card on that one yet.</div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/85 font-accent text-[11px] uppercase tracking-widest"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid={`player-detail-${player.id}`}>
      {/* Back link */}
      <Link
        to="/stats"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white text-[11px] font-accent uppercase tracking-widest"
        data-testid="player-back-to-stats"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Stats
      </Link>

      {/* Hero */}
      <section
        className="card-surface p-6 sm:p-8 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${teamColor}22 0%, transparent 60%), var(--card-bg, #0f0f14)`,
        }}
      >
        <div className="grid md:grid-cols-12 gap-6 items-center">
          {/* Headshot placeholder */}
          <div className="md:col-span-3 flex justify-center md:justify-start">
            <div
              className="h-32 w-32 rounded-full flex items-center justify-center border-4 shadow-[0_0_60px_rgba(30,93,255,0.25)]"
              style={{ borderColor: teamColor, background: `linear-gradient(135deg, ${teamColor}88, #111)` }}
              data-testid="player-headshot"
            >
              <span className="font-headline text-4xl text-white">{initials(player.name)}</span>
            </div>
          </div>

          {/* Name + team + pos */}
          <div className="md:col-span-9">
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center font-headline text-sm text-white shadow-[0_0_20px_rgba(0,0,0,0.4)]"
                style={{ background: teamColor }}
                data-testid="player-team-logo"
              >
                {player.team}
              </div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                {TEAM_NAMES[player.team] || player.team} · {player.pos}
              </div>
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl text-white mt-3">{player.name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {isGoalie ? (
                <>
                  <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">{rank.svRank}</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">{rank.winRank}</span>
                </>
              ) : (
                <>
                  <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">{rank.pointsRank}</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">{rank.gRank}</span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/5 border border-white/10 text-white/75">{rank.pptRank}</span>
                </>
              )}
              <span className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest text-white/40">
                {rank.poolLabel}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Big top stats */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="player-top-stats">
        {isGoalie ? (
          <>
            <StatCard label="GP" value={player.gp} />
            <StatCard label="Wins" value={player.w} accent="#4ade80" />
            <StatCard label="Losses" value={player.l} />
            <StatCard label="SV%" value={(player.sv_pct ?? 0).toFixed(3)} accent="#00e5ff" />
            <StatCard label="GAA" value={(player.gaa ?? 0).toFixed(2)} accent="#ff8f3b" />
            <StatCard label="SO" value={player.so} />
          </>
        ) : (
          <>
            <StatCard label="GP" value={player.gp} />
            <StatCard label="Goals" value={player.g} accent="#4ade80" />
            <StatCard label="Assists" value={player.a} />
            <StatCard label="Points" value={player.pts} accent="#1e5dff" />
            <StatCard label="+/-" value={(player.plus_minus ?? 0) >= 0 ? `+${player.plus_minus}` : player.plus_minus} accent={(player.plus_minus ?? 0) >= 0 ? "#4ade80" : "#ff5c7a"} />
            <StatCard label="TOI/G" value={player.toi || "—"} />
          </>
        )}
      </section>

      {/* Advanced stats */}
      <section className="card-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#00e5ff]" />
            <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
              {isGoalie ? "Volume & workload" : "Advanced · situational"}
            </div>
          </div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            2025-26 · to-date
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {isGoalie ? (
            <>
              <SmallStat label="Shots Faced" value={player.sa} />
              <SmallStat label="Saves" value={player.sv} />
              <SmallStat label="Goals Against" value={player.sa && player.sv ? player.sa - player.sv : "—"} />
              <SmallStat label="Shutouts" value={player.so} />
              <SmallStat label="Win %" value={player.gp ? `${((player.w / player.gp) * 100).toFixed(1)}%` : "—"} />
              <SmallStat label="QS (est.)" value={player.w ? Math.round(player.w * 0.75) : "—"} />
            </>
          ) : (
            <>
              <SmallStat label="Shots" value={player.s} />
              <SmallStat label="S%" value={player.s_pct != null ? `${player.s_pct.toFixed(1)}%` : "—"} />
              <SmallStat label="PPG" value={player.ppg} />
              <SmallStat label="SHG" value={player.shg} />
              <SmallStat label="GWG" value={player.gwg} />
              <SmallStat label="PIM" value={player.pim} />
              <SmallStat label="Hits" value={player.hits} />
              <SmallStat label="Blocks" value={player.blocks} />
              <SmallStat label="FO%" value={player.fow_pct != null ? `${player.fow_pct.toFixed(1)}%` : "—"} />
              <SmallStat label="PPG/G" value={player.gp ? (player.pts / player.gp).toFixed(2) : "—"} />
              <SmallStat label="G/60" value={player.gp && player.toi ? (player.g / (player.gp * (parseInt(player.toi) || 20) / 60)).toFixed(2) : "—"} />
              <SmallStat label="P/60" value={player.gp && player.toi ? (player.pts / (player.gp * (parseInt(player.toi) || 20) / 60)).toFixed(2) : "—"} />
            </>
          )}
        </div>
      </section>

      {/* Recent game log */}
      <section className="card-surface p-5" data-testid="player-game-log">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#4ade80]" />
            <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
              Last 5 games
            </div>
          </div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            most recent first
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {gameLog.map((g, i) => (
            <div key={i} className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-accent uppercase tracking-widest text-white/50">{g.date}</div>
                <span
                  className="text-[9px] font-accent uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                  style={{
                    background: g.result === "W" || g.result === "PT" ? "#4ade8022" : g.result === "L" ? "#ff5c7a22" : "#ffb54722",
                    color: g.result === "W" || g.result === "PT" ? "#4ade80" : g.result === "L" ? "#ff8fae" : "#ffb547",
                  }}
                >
                  {g.result}
                </span>
              </div>
              <div className="mt-2 text-white/85 text-sm font-headline">
                {g.home ? "vs" : "@"} {g.opp}
              </div>
              <div className="text-white text-lg font-headline mt-1">{g.line1}</div>
              <div className="text-white/60 text-xs mt-0.5">{g.line2}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Reggie + Marc takes */}
      {takes && (
        <section className="grid md:grid-cols-2 gap-4">
          <div className="card-surface p-5 relative overflow-hidden" data-testid="player-take-reggie">
            <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full blur-3xl opacity-40" style={{ background: "#1e5dff" }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Mic2 className="w-4 h-4" style={{ color: "#1e5dff" }} />
                <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">Reggie's take</div>
              </div>
              <div className="font-headline text-white text-lg leading-snug italic">"{takes.reggie}"</div>
              <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/40">— Reggie Banks · Lead Anchor</div>
            </div>
          </div>
          <div className="card-surface p-5 relative overflow-hidden" data-testid="player-take-marc">
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full blur-3xl opacity-40" style={{ background: "#00e5ff" }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4" style={{ color: "#00e5ff" }} />
                <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">Marc's take</div>
              </div>
              <div className="font-headline text-white text-lg leading-snug italic">"{takes.marc}"</div>
              <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/40">— Marc Collins · Analytics Co-Host</div>
            </div>
          </div>
        </section>
      )}

      {/* Similar players */}
      {similar.length > 0 && (
        <section className="card-surface p-5" data-testid="player-similar">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-[#ff8f3b]" />
            <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
              {isGoalie ? "Comparable goalies" : `Comparable ${(player.pos || "").toUpperCase()}s`}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {similar.map((s) => (
              <Link
                key={s.id}
                to={`/player/${s.id}`}
                className="rounded-lg border border-[#2d2d35] hover:border-white/40 bg-[#0b0b10] p-3 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center border-2 shrink-0"
                    style={{ borderColor: TEAM_COLORS[s.team] || "#1e5dff", background: `${TEAM_COLORS[s.team] || "#1e5dff"}44` }}
                  >
                    <span className="font-headline text-xs text-white">{initials(s.name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-headline text-white text-sm truncate">{s.name}</div>
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/50">
                      {s.team} · {s.pos}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                </div>
                <div className="mt-2 text-white/75 text-xs">
                  {isGoalie
                    ? `${s.w}W · ${(s.sv_pct ?? 0).toFixed(3)} sv% · ${(s.gaa ?? 0).toFixed(2)} GAA`
                    : `${s.pts} pts · ${s.g}G ${s.a}A · ${s.gp} GP`}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Deep-dive cross-link */}
      <section className="card-surface p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-widest text-white/50">Need the story?</div>
          <div className="font-headline text-white text-lg mt-1">Take {player.name.split(" ")[0]} to the presser.</div>
          <div className="text-white/60 text-xs mt-1">
            Reggie & Marc break down the tape, matchup edges, and betting IQ read.
          </div>
        </div>
        <Link
          to="/press-conference"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
        >
          <Circle className="w-3 h-3 fill-current" /> Open press conference
        </Link>
      </section>
    </div>
  );
}
