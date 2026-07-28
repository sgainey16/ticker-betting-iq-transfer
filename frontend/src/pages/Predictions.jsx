import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { TEST_IDS, ANALYSTS } from "@/lib/config";
import { Trophy, Flame, Target, RefreshCcw, Users, Cpu, Info } from "lucide-react";

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

  return (
    <div className="grid lg:grid-cols-12 gap-8" data-testid="predictions-page">
      <div className="lg:col-span-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff]">
              <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
              Call It · Tonight{"\u2019"}s card
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl text-white mt-1">
              Pick against the panel
            </h1>
            <p className="text-white/60 mt-2 text-sm max-w-xl">
              Reggie says one thing. Marc says another. The model has its own
              read. You have to <em className="not-italic text-white">call it</em>.
              We track your record vs the desk — no wallet, just bragging rights.
            </p>
          </div>

          <div className="glass rounded-lg px-4 py-3">
            <label className="block text-[10px] font-accent uppercase tracking-widest text-white/50">
              Display name
            </label>
            <input
              data-testid={TEST_IDS.pred.userInput}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="mt-1 bg-transparent text-white text-sm focus:outline-none border-b border-white/20 focus:border-[#1e5dff] pb-1 w-44"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-400 text-sm font-accent" data-testid="pred-error">
            {error}
          </div>
        )}

        {/* Games */}
        <div className="grid gap-4">
          {games.map((g) => {
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

                {/* Panel takes — Reggie & Marc quotes */}
                <div className="mt-4 grid sm:grid-cols-2 gap-2" data-testid={`pred-panel-${g.id}`}>
                  <PanelTake
                    analyst={ANALYSTS.reggie}
                    pick={g.reggie_pick}
                    take={g.reggie_take}
                    teamCode={g.reggie_pick === "home" ? g.home : g.away}
                  />
                  <PanelTake
                    analyst={ANALYSTS.marc}
                    pick={g.marc_pick}
                    take={g.marc_take}
                    teamCode={g.marc_pick === "home" ? g.home : g.away}
                  />
                </div>

                {/* AI consensus + community vote */}
                <div className="mt-4 grid sm:grid-cols-2 gap-3" data-testid={`pred-consensus-${g.id}`}>
                  <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-accent uppercase tracking-widest text-white/40">
                      <Cpu className="w-3 h-3" /> Model read
                    </div>
                    <div className="mt-1 text-white text-sm font-headline">
                      {g.ai_consensus}% <span className="text-white/60 font-normal">on {g.ai_consensus_side === "home" ? g.home : g.away}</span>
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
                          <span>{g.away} {awayPct}%</span>
                          <span>{homePct}% {g.home}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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
        {/* Track record */}
        <div className="card-surface p-5">
          <div className="font-accent text-xs uppercase tracking-[0.3em] text-white/50">
            Your track record
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile icon={Target} label="Acc" value={myStats ? `${myStats.accuracy}%` : "—"} />
            <StatTile icon={Flame} label="Streak" value={myStats ? myStats.streak : "—"} />
            <StatTile icon={Trophy} label="Correct" value={myStats ? myStats.correct : "—"} />
          </div>

          <button
            data-testid={TEST_IDS.pred.simulate}
            onClick={simulateResolve}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-md border border-[#2d2d35] hover:border-white/30 px-3 py-2 text-xs font-accent uppercase tracking-widest text-white/70 hover:text-white transition-colors"
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
  return (
    <button
      data-testid={testid}
      disabled={picked}
      onClick={onClick}
      className="text-left rounded-lg border p-4 transition-all disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
      style={{
        borderColor: chosen ? "#1e5dff" : "#2d2d35",
        background: chosen ? "rgba(30,93,255,0.08)" : "transparent",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            {side === "home" ? "Home" : "Away"} · {code}
          </div>
          <div className="font-headline text-xl text-white mt-1">{label}</div>
        </div>
        <div className="h-9 w-9 rounded flex items-center justify-center font-headline text-[11px]"
             style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}>
          {code}
        </div>
      </div>
      {(reggie || marc) && (
        <div className="mt-3 flex gap-1.5 flex-wrap">
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

function PanelTake({ analyst, pick, take, teamCode }) {
  return (
    <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full flex items-center justify-center font-headline text-[10px]"
             style={{ background: `${analyst.accent}22`, color: analyst.accent, border: `1px solid ${analyst.accent}55` }}>
          {analyst.short[0]}
        </div>
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">
          {analyst.short} takes <span className="text-white font-headline text-xs ml-1">{teamCode}</span>
        </div>
      </div>
      <div className="text-white/80 text-xs mt-1.5 leading-snug italic">
        &ldquo;{take}&rdquo;
      </div>
    </div>
  );
}

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
