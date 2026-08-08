// TONIGHT — the sequential game-hubs experience.
// -----------------------------------------------------------------------------
// Replaces the old "Morning Skate ambient loop + team-vs-team card" page. Now
// this route is a stack of expandable game hubs — one for each tonight game.
// The user expands one at a time; a per-game Reggie/Marc segment plays; the
// user reviews the head-to-head, then makes their pick; after the pick the
// hub auto-collapses and the next one expands.
//
// This flow:
//   1. Kills the ambient broadcast on this route (see LiveDesk QUIET_ROUTES).
//   2. Absorbs the retired /predictions page — Picks tab is gone.
//   3. Emits high-value signals per expansion + per segment play + per pick.

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { BROADCAST_SLOT_ID } from "@/lib/broadcastContext";
import { TeamLogo } from "@/lib/teamLogos";
import { PickRecordCard } from "@/components/PickRecordCard";
import { ShowOpener } from "@/components/ShowOpener";
import { emitSignal } from "@/lib/signals";
import { Check } from "lucide-react";

export default function Home() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myPreds, setMyPreds] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [submitting, setSubmitting] = useState({});
  const [userName] = useState(() => localStorage.getItem("ticker_user") || "guest");
  const hubRefs = useRef({});

  const refresh = useCallback(async () => {
    try {
      const [g, t, mine] = await Promise.all([
        api.get("/predictions/games").catch(() => ({ data: { games: [] } })),
        api.get("/stats/teams").catch(() => ({ data: { teams: [] } })),
        api.get(`/predictions/mine?user_name=${encodeURIComponent(userName)}`).catch(() => ({ data: { predictions: [] } })),
      ]);
      const gl = g.data?.games || [];
      setGames(gl);
      setTeams(t.data?.teams || []);
      setMyPreds(mine.data?.predictions || []);
      setOpenId((cur) => cur || gl[0]?.id || null);
    } catch (e) { /* soft fail */ }
  }, [userName]);

  useEffect(() => { refresh(); }, [refresh]);

  // team code → row map for O(1) stat lookups inside GameHub
  const teamStats = useMemo(() => {
    const map = {};
    for (const t of teams) map[t.code] = t;
    return map;
  }, [teams]);

  // gameId → pick side map (persisted picks from backend)
  const pickedSideByGame = useMemo(() => {
    const m = {};
    for (const p of myPreds) m[p.game_id] = p.pick;
    return m;
  }, [myPreds]);

  async function submitPick(gameId, side) {
    if (pickedSideByGame[gameId]) return;
    setSubmitting(s => ({ ...s, [gameId]: true }));
    // Optimistic: append to myPreds so the UI shows chosen immediately
    setMyPreds(prev => [...prev, { game_id: gameId, pick: side, user_name: userName }]);
    // Emit signal — a real pick is a very strong signal.
    emitSignal({ kind: "game_pick", league: "NHL", target: gameId, weight: 2 });
    try {
      await api.post("/predictions", {
        user_name: userName,
        game_id: gameId,
        pick: side,
        reasoning: "",
      });
      refresh();
    } catch (e) {
      // Roll back optimistic pick
      setMyPreds(prev => prev.filter(p => p.game_id !== gameId));
    } finally {
      setSubmitting(s => ({ ...s, [gameId]: false }));
    }
  }

  const openNextGame = useCallback((currentId) => {
    const idx = games.findIndex(g => g.id === currentId);
    if (idx < 0) return;
    // Find next unpicked game if any; otherwise next in order.
    let nextIdx = -1;
    for (let i = idx + 1; i < games.length; i++) {
      if (!pickedSideByGame[games[i].id]) { nextIdx = i; break; }
    }
    if (nextIdx < 0) nextIdx = Math.min(idx + 1, games.length - 1);
    const next = games[nextIdx];
    if (next) {
      setOpenId(next.id);
      // Smooth scroll to it
      setTimeout(() => {
        hubRefs.current[next.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [games, pickedSideByGame]);

  const openCount = games.length;
  const pickedCount = games.filter(g => pickedSideByGame[g.id]).length;

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-4" data-testid="tonight-page">
      {/* Broadcast panel — Reggie and Marc at the desk, up top. Their
       * audio picks up wherever the user last left it (Pause button lives
       * inside the panel). Each game hub still owns its own per-game
       * segment when the user expands one. */}
      <div id={BROADCAST_SLOT_ID} className="mb-2" data-testid="tonight-broadcast-slot" />

      {/* Welcome opener — auto-plays once per session on arrival. Feels
       * alive without being a 20-minute ambient loop. */}
      <ShowOpener variant="tonight" sessionKey="ticker.opener.tonight" />

      {/* Header — brief chyron. */}
      <div className="flex items-baseline justify-between">
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.34em", color: "#F58220" }}>
            Tonight on The Ticker
          </div>
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: "#fff", lineHeight: 1.2, marginTop: 2 }}>
            {openCount} {openCount === 1 ? "game" : "games"} on the slate — read the room, then make your call.
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-headline text-2xl text-white leading-none" data-testid="tonight-pick-count">
            {pickedCount}<span className="text-white/40 text-sm">/{openCount}</span>
          </div>
          <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
            picked
          </div>
        </div>
      </div>

      {/* Pick record — the daily-return hook. Shows your accuracy vs Reggie
       * & Marc, current streak, all-time record. This is the main engagement
       * mechanism (per user's direction to prioritize prediction accuracy
       * over content voting). */}
      <PickRecordCard userName={userName} />

      {/* Horizontal logo-rail of tonight's games. Same visual grammar as
       * the Recap segment rail — logos vs logos, tap to open the full
       * per-game page (deep-link at /tonight/:gameId) which auto-plays
       * the Reggie & Marc pregame segment for that matchup. */}
      {games.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-white/60"
             style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px" }}>
          No games on the slate right now.
        </div>
      ) : (
        <div
          data-testid="tonight-rail"
          className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 landscape:grid landscape:grid-flow-col landscape:auto-cols-fr landscape:overflow-visible"
        >
          {games.map((g) => {
            const homeAccent = teamStats[g.home]?.primary || "#1e5dff";
            const awayAccent = teamStats[g.away]?.primary || "#F58220";
            const myPick = pickedSideByGame[g.id];
            const resolved = !!g.winner;
            const correct = resolved && myPick && myPick === g.winner;
            const kickoff = g.starts_at
              ? new Date(g.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
              : "TBD";
            return (
              <Link
                key={g.id}
                to={`/tonight/${g.id}`}
                data-testid={`tonight-tile-${g.id}`}
                onClick={() => emitSignal({ kind: "tonight_tile_tap", league: "NHL", target: g.id, weight: 1.2 })}
                className={`flex-shrink-0 landscape:flex-shrink landscape:min-w-0 min-w-[180px] rounded-lg overflow-hidden border transition-all group ${
                  myPick
                    ? "bg-black/50 border-[#F58220]/40 hover:border-[#F58220]"
                    : "bg-black/40 border-white/10 hover:border-white/40"
                }`}
              >
                <div className="px-3 py-3">
                  {/* Away · @ · Home logos */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-11 w-11 rounded-md flex items-center justify-center"
                           style={{ background: `${awayAccent}22`, border: `1px solid ${awayAccent}44` }}>
                        <TeamLogo code={g.away} size={32} monogramClass="!bg-transparent" />
                      </div>
                      <span className="text-[9px] font-accent uppercase tracking-widest text-white/50">{g.away}</span>
                    </div>
                    <span className="font-headline text-white/30 text-xs tracking-widest">@</span>
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-11 w-11 rounded-md flex items-center justify-center"
                           style={{ background: `${homeAccent}22`, border: `1px solid ${homeAccent}44` }}>
                        <TeamLogo code={g.home} size={32} monogramClass="!bg-transparent" />
                      </div>
                      <span className="text-[9px] font-accent uppercase tracking-widest text-white/50">{g.home}</span>
                    </div>
                  </div>

                  {/* Status line — final score OR kickoff OR your-pick */}
                  <div className="mt-2 text-center">
                    {resolved ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-headline text-sm text-white/70 tabular-nums">
                          {g.away_score ?? "—"}–{g.home_score ?? "—"}
                        </span>
                        {myPick && (
                          <span
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full"
                            style={{ background: correct ? "#22c55e" : "#ef4444", color: "#0b0b10" }}
                          >
                            {correct ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : "×"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="font-headline text-sm text-white/85">{kickoff}</div>
                    )}
                    <div className={`mt-1 text-[9px] font-accent uppercase tracking-[0.24em] ${
                      myPick ? "text-[#F58220]" : "text-white/40"
                    }`}>
                      {myPick
                        ? `Your pick · ${myPick === "home" ? g.home : g.away}`
                        : "Tap to open"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer — legal + attribution */}
      <div className="pt-6 text-center text-[10px] font-accent uppercase tracking-widest text-white/30">
        For entertainment &amp; decision insights — never a wager
      </div>
    </div>
  );
}
