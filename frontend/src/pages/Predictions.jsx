import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { TEST_IDS, ANALYSTS } from "@/lib/config";
import { Trophy, Flame, Target, RefreshCcw, Users, Cpu, Info } from "lucide-react";
import GamePickerStrip from "@/components/GamePickerStrip";
import { TeamLogo } from "@/lib/teamLogos";

const teamName = (code, teams) => {
  const t = teams.find((x) => x.code === code);
  return t ? t.name : code;
};

const teamAccent = (code, teams) => {
  const t = teams.find((x) => x.code === code);
  return t?.accent || "#1e5dff";
};

export default function Predictions() {
  const [userName, setUserName] = useState(
    () => localStorage.getItem("ticker_user") || "Guest",
  );
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myPreds, setMyPreds] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [board, setBoard] = useState([]);
  const [picks, setPicks] = useState({});
  const [reasoning, setReasoning] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [error, setError] = useState("");
  const [pickedGameId, setPickedGameId] = useState(null); // null = show all games

  const refresh = useCallback(async () => {
    try {
      const [g, t, mine, stats, lb] = await Promise.all([
        api.get("/predictions/games"),
        api.get("/stats/teams"),
        api.get("/predictions", { params: { user_name: userName } }),
        api.get(`/predictions/me/${encodeURIComponent(userName)}`),
        api.get("/predictions/leaderboard"),
      ]);
      setGames(g.data.games || []);
      setTeams(t.data.teams || []);
      setMyPreds(mine.data.predictions || []);
      setMyStats(stats.data);
      setBoard(lb.data.leaderboard || []);
    } catch (e) {
      console.error(e);
    }
  }, [userName]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { localStorage.setItem("ticker_user", userName); }, [userName]);

  async function submitPick(gameId) {
    const pick = picks[gameId];
    if (!pick) { setError("Pick a side before submitting."); return; }
    if (!userName.trim()) { setError("Enter a display name to submit picks."); return; }
    setError("");
    setSubmitting((s) => ({ ...s, [gameId]: true }));
    try {
      await api.post("/predictions", {
        user_name: userName,
        game_id: gameId,
        pick,
        reasoning: reasoning[gameId] || "",
      });
      setPicks((p) => { const c = { ...p }; delete c[gameId]; return c; });
      setReasoning((r) => { const c = { ...r }; delete c[gameId]; return c; });
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || "Could not submit pick.");
    } finally {
      setSubmitting((s) => ({ ...s, [gameId]: false }));
    }
  }

  async function simulateResolve() {
    try {
      await api.post("/predictions/simulate-resolve");
      await refresh();
    } catch (e) { console.error(e); }
  }

  const alreadyPicked = new Set(myPreds.map((p) => p.game_id));

  const visibleGames = useMemo(
    () => (pickedGameId ? games.filter((g) => g.id === pickedGameId) : games),
    [games, pickedGameId],
  );

  return (
    <div className="space-y-8" data-testid="predictions-page">
      {/* Logo-vs-logo picker strip — jumps user to a single game or "Play All" */}
      <GamePickerStrip
        games={games}
        teams={teams}
        selectedGameId={pickedGameId}
        onSelect={setPickedGameId}
        playAllLabel="All Games"
        testids={{
          root: TEST_IDS.pred.picker,
          all: TEST_IDS.pred.pickerAll,
          game: TEST_IDS.pred.pickerGame,
        }}
      />

      <div className="grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff]">
              <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
              Call It · Tonight{"\u2019"}s card
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl text-white mt-1">
              Pick a winner. Build your score.
            </h1>
            <p className="text-white/60 mt-2 text-sm max-w-xl">
              Tap the team you think will win. Every hit adds to your streak,
              every miss keeps you honest. No wallet — just how sharp you are
              vs the desk and the room.
            </p>
          </div>

          {/* Score card — this used to be a plain "Display name" field
           * plus a separate sidebar block. We fused them so the user's
           * identity + track record live together as one glance. */}
          <div className="glass rounded-lg px-4 py-3 min-w-[260px]" data-testid="pred-scorecard">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="block text-[10px] font-accent uppercase tracking-widest text-white/50">
                  Playing as
                </label>
                <input
                  data-testid={TEST_IDS.pred.userInput}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="mt-1 bg-transparent text-white font-headline text-base focus:outline-none border-b border-white/20 focus:border-[#1e5dff] pb-0.5 w-full min-w-0"
                />
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[10px] font-accent uppercase tracking-widest text-white/50">
                  Accuracy
                </div>
                <div className="font-headline text-3xl text-white leading-none mt-1">
                  {myStats ? `${myStats.accuracy}%` : "—"}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">Streak</div>
                <div className="font-headline text-white text-lg mt-0.5 inline-flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[#F5A623]" />
                  {myStats ? myStats.streak : 0}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">Correct</div>
                <div className="font-headline text-white text-lg mt-0.5">
                  {myStats ? myStats.correct : 0}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">Graded</div>
                <div className="font-headline text-white text-lg mt-0.5">
                  {myStats ? myStats.resolved : 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-400 text-sm font-accent" data-testid="pred-error">
            {error}
          </div>
        )}

        {/* Games */}
        <div className="grid gap-4">
          {visibleGames.map((g) => {
            const picked = alreadyPicked.has(g.id);
            const chosen = picks[g.id];
            const awayName = teamName(g.away, teams);
            const homeName = teamName(g.home, teams);
            const awayAccent = teamAccent(g.away, teams);
            const homeAccent = teamAccent(g.home, teams);
            const community = g.community || { home_pct: null, away_pct: null, total: 0 };
            const awayPct = community.away_pct ?? 50;
            const homePct = community.home_pct ?? 50;
            return (
              <div
                key={g.id}
                data-testid={TEST_IDS.pred.gameCard(g.id)}
                className="card-surface p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="font-accent text-[11px] uppercase tracking-widest text-white/50">
                    NHL · {new Date(g.start_iso).toLocaleString(undefined, {
                      weekday: "short", hour: "numeric", minute: "2-digit",
                    })}
                  </div>
                  <div className="font-accent text-[11px] uppercase tracking-widest text-white/40">
                    {picked ? "Locked" : "Pick a winner"}
                  </div>
                </div>

                {/* Team pick buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <PickButton
                    testid={TEST_IDS.pred.pickAway(g.id)}
                    side="away"
                    label={awayName}
                    code={g.away}
                    accent={awayAccent}
                    picked={picked}
                    chosen={chosen === "away"}
                    reggie={g.reggie_pick === "away"}
                    marc={g.marc_pick === "away"}
                    onClick={() => setPicks((p) => ({ ...p, [g.id]: "away" }))}
                  />
                  <PickButton
                    testid={TEST_IDS.pred.pickHome(g.id)}
                    side="home"
                    label={homeName}
                    code={g.home}
                    accent={homeAccent}
                    picked={picked}
                    chosen={chosen === "home"}
                    reggie={g.reggie_pick === "home"}
                    marc={g.marc_pick === "home"}
                    onClick={() => setPicks((p) => ({ ...p, [g.id]: "home" }))}
                  />
                </div>

                {/* AI consensus + community vote (Reggie/Marc quotes removed —
                 * their takes now live in the Desk Preview audio segment,
                 * making the card lighter and quicker to scan). */}
                <div className="mt-4 grid sm:grid-cols-2 gap-3" data-testid={`pred-consensus-${g.id}`}>
                  <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-accent uppercase tracking-widest text-white/40">
                      <Cpu className="w-3 h-3" /> Model read
                    </div>
                    <div className="mt-1 text-white text-sm font-headline">
                      {g.ai_consensus}%{" "}
                      <span className="text-white/60 font-normal inline-flex items-center gap-1 align-middle">
                        on
                        <TeamLogo code={g.ai_consensus_side === "home" ? g.home : g.away} size={14} />
                        {g.ai_consensus_side === "home" ? g.home : g.away}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2.5">
                    <div className="flex items-center justify-between text-[10px] font-accent uppercase tracking-widest text-white/40">
                      <span className="inline-flex items-center gap-1.5"><Users className="w-3 h-3" /> The room</span>
                      <span>{community.total} {community.total === 1 ? "vote" : "votes"}</span>
                    </div>
                    {community.total === 0 ? (
                      <div className="text-xs text-white/40 mt-2">Be the first name up.</div>
                    ) : (
                      <div className="mt-2">
                        <div className="h-2 rounded-full overflow-hidden bg-[#1a1a22] flex">
                          <div style={{ width: `${awayPct}%`, background: awayAccent }} />
                          <div style={{ width: `${homePct}%`, background: homeAccent }} />
                        </div>
                        <div className="flex justify-between text-[10px] font-accent uppercase tracking-widest text-white/50 mt-1">
                          <span className="inline-flex items-center gap-1"><TeamLogo code={g.away} size={12} />{g.away} {awayPct}%</span>
                          <span className="inline-flex items-center gap-1">{homePct}% {g.home}<TeamLogo code={g.home} size={12} /></span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Head-to-head dropdown — season snapshot for both teams,
                 * hidden by default so it doesn't crowd the card. Data is
                 * already loaded via /api/stats/teams so the reveal is
                 * instant. */}
                <HeadToHead
                  awayCode={g.away}
                  homeCode={g.home}
                  awayAccent={awayAccent}
                  homeAccent={homeAccent}
                  teams={teams}
                />

                {!picked && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <input
                      data-testid={TEST_IDS.pred.reasoning(g.id)}
                      value={reasoning[g.id] || ""}
                      onChange={(e) => setReasoning((r) => ({ ...r, [g.id]: e.target.value }))}
                      placeholder="One line of reasoning (optional)"
                      className="flex-1 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                    <button
                      data-testid={TEST_IDS.pred.submit(g.id)}
                      onClick={() => submitPick(g.id)}
                      disabled={submitting[g.id] || !chosen}
                      className="px-5 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent uppercase tracking-widest text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting[g.id] ? "Locking…" : "Lock it in"}
                    </button>
                  </div>
                )}

                {picked && (
                  <div className="mt-4 text-xs font-accent uppercase tracking-widest text-emerald-400">
                    ✓ Locked · pick recorded
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* My picks list */}
        <div className="mt-8" data-testid={TEST_IDS.pred.mine}>
          <h3 className="font-headline text-xl text-white mb-3">Your card</h3>
          {myPreds.length === 0 ? (
            <div className="text-white/40 text-sm">
              No picks yet. The desk is waiting for you.
            </div>
          ) : (
            <div className="space-y-2">
              {myPreds.map((p) => (
                <div key={p.id} className="card-surface px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-white text-sm">
                      <span className="font-accent uppercase tracking-widest text-white/50 mr-2">
                        {p.pick.toUpperCase()}
                      </span>
                      {p.game ? `${p.game.away.name} @ ${p.game.home.name}` : p.game_id}
                    </div>
                    {p.reasoning && (
                      <div className="text-xs text-white/50 mt-0.5">
                        &ldquo;{p.reasoning}&rdquo;
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-accent uppercase tracking-widest">
                    {p.resolved ? (
                      p.correct ? (
                        <span className="text-emerald-400">✓ Hit</span>
                      ) : (
                        <span className="text-red-400">✗ Miss</span>
                      )
                    ) : (
                      <span className="text-white/40">Locked</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side rail */}
      <aside className="lg:col-span-4 space-y-5">
        {/* Simulate button — the old sidebar "Your track record" card
         * moved inline with the display name, so we keep only the demo
         * simulate control here. */}
        <div className="card-surface p-4">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">
            Demo · grade tonight
          </div>
          <button
            data-testid={TEST_IDS.pred.simulate}
            onClick={simulateResolve}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md border border-[#2d2d35] hover:border-white/30 px-3 py-2 text-xs font-accent uppercase tracking-widest text-white/70 hover:text-white transition-colors"
            title="Phase 1 demo: simulate a results feed to grade open picks"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Simulate tonight's results
          </button>
        </div>

        {/* You vs the Panel */}
        <div className="card-surface p-5" data-testid="pred-vs-panel">
          <div className="font-accent text-xs uppercase tracking-[0.3em] text-white/50">
            You vs the panel
          </div>
          {(!myStats || myStats.resolved === 0) ? (
            <div className="text-white/40 text-sm mt-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>Lock a pick, then hit "Simulate" — we grade you against Reggie &amp; Marc.</span>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <VsPanelRow analyst={ANALYSTS.reggie} beat={myStats.vs_panel?.beat_reggie || 0} tie={myStats.vs_panel?.tie_reggie || 0} />
              <VsPanelRow analyst={ANALYSTS.marc} beat={myStats.vs_panel?.beat_marc || 0} tie={myStats.vs_panel?.tie_marc || 0} />
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="card-surface p-5" data-testid={TEST_IDS.pred.leaderboard}>
          <div className="font-accent text-xs uppercase tracking-[0.3em] text-white/50">
            Public leaderboard
          </div>
          {board.length === 0 ? (
            <div className="text-white/40 text-sm mt-3">
              Nobody is on the board yet. Be the first name up.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {board.map((row, i) => (
                <div key={row.user_name} className="flex items-center justify-between rounded-md px-3 py-2 border border-[#2d2d35] bg-[#0b0b10]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 text-center font-accent text-sm" style={{ color: i === 0 ? "#F5A623" : "#9CA3AF" }}>
                      {i + 1}
                    </div>
                    <div className="text-white text-sm truncate">{row.user_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-accent text-white text-sm">
                      {row.correct}/{row.resolved}
                    </div>
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
                      {row.accuracy}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]">
      <div className="flex items-center gap-1 text-[10px] font-accent uppercase tracking-widest text-white/40">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="font-accent text-3xl text-white mt-0.5">{value}</div>
    </div>
  );
}

function PickButton({ testid, label, code, accent, picked, chosen, reggie, marc, onClick, side }) {
  const locked = picked && chosen;
  return (
    <button
      data-testid={testid}
      disabled={picked}
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-4 transition-all disabled:cursor-not-allowed relative overflow-hidden ${
        chosen ? "scale-[1.01]" : "hover:border-white/25"
      }`}
      style={{
        borderColor: chosen ? accent : "#2d2d35",
        background: chosen
          ? `linear-gradient(135deg, ${accent}33 0%, ${accent}11 60%, transparent 100%)`
          : "transparent",
        boxShadow: chosen ? `0 0 0 1px ${accent}55, 0 8px 30px -8px ${accent}77` : "none",
      }}
    >
      {/* Glow ring when chosen */}
      {chosen && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: `inset 0 0 22px ${accent}44` }}
        />
      )}
      <div className="flex items-center justify-between relative">
        <div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            {side === "home" ? "Home" : "Away"} · {code}
          </div>
          <div className="font-headline text-xl text-white mt-1">{label}</div>
          {chosen && (
            <div
              className="mt-2 inline-flex items-center gap-1 font-accent text-[10px] uppercase tracking-[0.25em]"
              style={{ color: accent }}
              data-testid={`${testid}-chosen`}
            >
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full"
                style={{ background: accent, color: "#0b0b10" }}
              >
                ✓
              </span>
              {locked ? "Locked" : "Your pick"}
            </div>
          )}
        </div>
        <div
          className="h-12 w-12 rounded flex items-center justify-center overflow-hidden transition-transform"
          style={{
            background: `${accent}${chosen ? "44" : "22"}`,
            border: `1px solid ${accent}${chosen ? "aa" : "55"}`,
            transform: chosen ? "scale(1.05)" : "scale(1)",
          }}
        >
          <TeamLogo code={code} size={38} monogramClass="!bg-transparent" />
        </div>
      </div>
      {(reggie || marc) && (
        <div className="mt-3 flex gap-1.5 flex-wrap relative">
          {reggie && <span className="inline-flex items-center gap-1 text-[9px] font-accent uppercase tracking-widest px-1.5 py-0.5 rounded"
                           style={{ background: ANALYSTS.reggie.accent + "22", color: ANALYSTS.reggie.accent, border: `1px solid ${ANALYSTS.reggie.accent}44` }}>
            Reggie
          </span>}
          {marc && <span className="inline-flex items-center gap-1 text-[9px] font-accent uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ background: ANALYSTS.marc.accent + "22", color: ANALYSTS.marc.accent, border: `1px solid ${ANALYSTS.marc.accent}44` }}>
            Marc
          </span>}
        </div>
      )}
    </button>
  );
}

function PanelTake() { return null; } // kept as placeholder shim — Reggie/Marc quotes moved to Desk Preview audio

function VsPanelRow({ analyst, beat, tie }) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2 border border-[#2d2d35] bg-[#0b0b10]">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full flex items-center justify-center font-headline text-[11px]"
             style={{ background: `${analyst.accent}22`, color: analyst.accent, border: `1px solid ${analyst.accent}55` }}>
          {analyst.short[0]}
        </div>
        <div>
          <div className="text-white text-sm font-headline leading-tight">{analyst.short}</div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            {beat > 0 ? `You're ahead ${beat}` : "Neck and neck"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/50">
          Beat / Tie
        </div>
        <div className="font-accent text-white text-sm">
          {beat}<span className="text-white/40"> · </span>{tie}
        </div>
      </div>
    </div>
  );
}


// ---- Head-to-Head dropdown ----
// A tap-to-reveal panel that compares the two teams' season snapshots
// side-by-side. Data comes from /api/stats/teams (already loaded by the
// parent). We render the same simple format Reggie & Marc reference on-air:
//   record · goals for/against · PP% · PK%.
function HeadToHead({ awayCode, homeCode, awayAccent, homeAccent, teams }) {
  const [open, setOpen] = useState(false);
  const away = teams.find((t) => t.code === awayCode);
  const home = teams.find((t) => t.code === homeCode);
  if (!away || !home) return null;
  const rec = (t) => `${t.w ?? 0}-${t.l ?? 0}-${t.otl ?? 0}`;
  const rows = [
    { label: "Record",   a: rec(away),          h: rec(home) },
    { label: "Points",   a: away.pts ?? "—",    h: home.pts ?? "—" },
    { label: "Goals For",     a: away.gf ?? "—", h: home.gf ?? "—" },
    { label: "Goals Against", a: away.ga ?? "—", h: home.ga ?? "—" },
  ];
  return (
    <div className="mt-3 rounded-md border border-[#2d2d35] bg-[#0b0b10] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.04] transition-colors"
        data-testid={`h2h-toggle-${awayCode}-${homeCode}`}
      >
        <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/60">
          Head to Head · Season Snapshot
        </div>
        <span className={`text-white/50 text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-[#2d2d35]">
          <div className="grid grid-cols-3 items-center pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-2 justify-start">
              <TeamLogo code={awayCode} size={22} />
              <span className="font-headline text-white text-sm">{awayCode}</span>
            </div>
            <div className="text-center font-accent text-[9px] uppercase tracking-[0.3em] text-white/40">vs</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="font-headline text-white text-sm">{homeCode}</span>
              <TeamLogo code={homeCode} size={22} />
            </div>
          </div>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-3 items-center">
                <div className="text-right font-headline text-lg text-white">{r.a}</div>
                <div className="text-center font-accent text-[10px] uppercase tracking-widest text-white/50">
                  {r.label}
                </div>
                <div className="text-left font-headline text-lg text-white">{r.h}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
