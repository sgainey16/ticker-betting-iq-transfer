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
import { api } from "@/lib/api";
import { BROADCAST_SLOT_ID } from "@/lib/broadcastContext";
import { GameHub } from "@/components/GameHub";
import { PickRecordCard } from "@/components/PickRecordCard";
import { emitSignal } from "@/lib/signals";

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

      {/* Sequential game hubs — only one open at a time. */}
      {games.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-white/60"
             style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px" }}>
          No games on the slate right now.
        </div>
      )}

      {games.map((g, i) => (
        <GameHub
          key={g.id}
          game={g}
          teamStats={teamStats}
          myPickSide={pickedSideByGame[g.id] || null}
          onSubmitPick={submitPick}
          expanded={openId === g.id}
          onToggle={() => setOpenId(openId === g.id ? null : g.id)}
          onAdvance={() => openNextGame(g.id)}
          isLast={i === games.length - 1}
          autoScrollRef={(el) => { hubRefs.current[g.id] = el; }}
        />
      ))}

      {/* Footer — legal + attribution */}
      <div className="pt-6 text-center text-[10px] font-accent uppercase tracking-widest text-white/30">
        For entertainment &amp; decision insights — never a wager
      </div>
    </div>
  );
}
