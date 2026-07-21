import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { TEST_IDS } from "@/lib/config";
import { Trophy, Flame, Target, RefreshCcw } from "lucide-react";

const teamName = (code, teams) => {
  const t = teams.find((x) => x.code === code);
  return t ? t.name : code;
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
  const [picks, setPicks] = useState({}); // { gameId: 'home'|'away' }
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem("ticker_user", userName);
  }, [userName]);

  async function submitPick(gameId) {
    const pick = picks[gameId];
    if (!pick) {
      setError("Pick a side before submitting.");
      return;
    }
    if (!userName.trim()) {
      setError("Enter a display name to submit picks.");
      return;
    }
    setError("");
    setSubmitting((s) => ({ ...s, [gameId]: true }));
    try {
      await api.post("/predictions", {
        user_name: userName,
        game_id: gameId,
        pick,
        reasoning: reasoning[gameId] || "",
      });
      setPicks((p) => {
        const c = { ...p };
        delete c[gameId];
        return c;
      });
      setReasoning((r) => {
        const c = { ...r };
        delete c[gameId];
        return c;
      });
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
    } catch (e) {
      console.error(e);
    }
  }

  const alreadyPicked = new Set(myPreds.map((p) => p.game_id));

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8">
        {/* Header + user name */}
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff]">
              <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
              Call It · Tonight{"\u2019"}s card
            </div>
            <h1 className="font-headline text-4xl sm:text-5xl text-white mt-1">
              Make your picks
            </h1>
            <p className="text-white/60 mt-2 text-sm max-w-xl">
              Pick a side. Drop a one-line reason. We lock it. Your accuracy
              and streak build a public track record {"\u2014"} no wallet
              required.
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
            return (
              <div
                key={g.id}
                data-testid={TEST_IDS.pred.gameCard(g.id)}
                className="card-surface p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="font-accent text-[11px] uppercase tracking-widest text-white/50">
                    NHL · {new Date(g.start_iso).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="font-accent text-[11px] uppercase tracking-widest text-white/40">
                    O/U {g.total}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    data-testid={TEST_IDS.pred.pickAway(g.id)}
                    disabled={picked}
                    onClick={() => setPicks((p) => ({ ...p, [g.id]: "away" }))}
                    className="text-left rounded-lg border p-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: chosen === "away" ? "#1e5dff" : "#2d2d35",
                      background: chosen === "away" ? "rgba(30,93,255,0.08)" : "transparent",
                    }}
                  >
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
                      Away
                    </div>
                    <div className="font-headline text-xl text-white mt-1">
                      {teamName(g.away, teams)}
                    </div>
                    <div className="font-accent text-sm text-white/60 mt-1">
                      ML {g.away_ml > 0 ? `+${g.away_ml}` : g.away_ml}
                    </div>
                  </button>

                  <button
                    data-testid={TEST_IDS.pred.pickHome(g.id)}
                    disabled={picked}
                    onClick={() => setPicks((p) => ({ ...p, [g.id]: "home" }))}
                    className="text-left rounded-lg border p-4 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: chosen === "home" ? "#1e5dff" : "#2d2d35",
                      background: chosen === "home" ? "rgba(30,93,255,0.08)" : "transparent",
                    }}
                  >
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
                      Home
                    </div>
                    <div className="font-headline text-xl text-white mt-1">
                      {teamName(g.home, teams)}
                    </div>
                    <div className="font-accent text-sm text-white/60 mt-1">
                      ML {g.home_ml > 0 ? `+${g.home_ml}` : g.home_ml}
                    </div>
                  </button>
                </div>

                {!picked && (
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <input
                      data-testid={TEST_IDS.pred.reasoning(g.id)}
                      value={reasoning[g.id] || ""}
                      onChange={(e) =>
                        setReasoning((r) => ({ ...r, [g.id]: e.target.value }))
                      }
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
                  <div className="mt-4 text-xs font-accent uppercase tracking-widest text-white/50">
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
                <div
                  key={p.id}
                  className="card-surface px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-white text-sm">
                      <span className="font-accent uppercase tracking-widest text-white/50 mr-2">
                        {p.pick.toUpperCase()}
                      </span>
                      {p.game
                        ? `${p.game.away.name} @ ${p.game.home.name}`
                        : p.game_id}
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

      {/* Side: stats + leaderboard */}
      <aside className="lg:col-span-4 space-y-5">
        <div className="card-surface p-5">
          <div className="font-accent text-xs uppercase tracking-[0.3em] text-white/50">
            Your track record
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]">
              <div className="flex items-center gap-1 text-[10px] font-accent uppercase tracking-widest text-white/40">
                <Target className="w-3 h-3" /> Acc
              </div>
              <div className="font-accent text-3xl text-white mt-0.5">
                {myStats ? `${myStats.accuracy}` : "—"}
                <span className="text-white/40 text-lg">%</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]">
              <div className="flex items-center gap-1 text-[10px] font-accent uppercase tracking-widest text-white/40">
                <Flame className="w-3 h-3" /> Streak
              </div>
              <div className="font-accent text-3xl text-white mt-0.5">
                {myStats ? myStats.streak : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]">
              <div className="flex items-center gap-1 text-[10px] font-accent uppercase tracking-widest text-white/40">
                <Trophy className="w-3 h-3" /> Correct
              </div>
              <div className="font-accent text-3xl text-white mt-0.5">
                {myStats ? myStats.correct : "—"}
              </div>
            </div>
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
                <div
                  key={row.user_name}
                  className="flex items-center justify-between rounded-md px-3 py-2 border border-[#2d2d35] bg-[#0b0b10]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-6 text-center font-accent text-sm"
                      style={{ color: i === 0 ? "#F5A623" : "#9CA3AF" }}
                    >
                      {i + 1}
                    </div>
                    <div className="text-white text-sm truncate">
                      {row.user_name}
                    </div>
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
