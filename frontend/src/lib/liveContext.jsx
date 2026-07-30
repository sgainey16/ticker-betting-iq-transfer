import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

// Global live-state polling. Every ~5s we hit /api/live/state and diff
// the events list against what we've already surfaced. New goal events
// fire the Red Light alert; a listener callback lets consumers hook the
// goal horn.

const POLL_MS = 5000;
const LiveCtx = createContext(null);

export function LiveProvider({ children }) {
  const [games, setGames] = useState([]);
  const [lastGoal, setLastGoal] = useState(null); // {team_code, team_name, period, clock, ...}
  const [lastEventAt, setLastEventAt] = useState(null);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("ticker.goalhorn.muted") === "1"; } catch { return false; }
  });
  const seenEventsRef = useRef(new Set());
  const goalListenersRef = useRef(new Set());

  // Persist mute preference.
  useEffect(() => {
    try { localStorage.setItem("ticker.goalhorn.muted", muted ? "1" : "0"); } catch { /* noop */ }
  }, [muted]);

  // Poll loop — swap URL for a websocket later without touching consumers.
  useEffect(() => {
    let cancelled = false;
    let timer;
    async function tick() {
      try {
        const r = await api.get(`/live/state${lastEventAt ? `?since=${encodeURIComponent(lastEventAt)}` : ""}`);
        if (cancelled) return;
        const data = r.data || {};
        setGames(data.games || []);
        const newGoals = [];
        for (const ev of data.events || []) {
          if (seenEventsRef.current.has(ev.id)) continue;
          seenEventsRef.current.add(ev.id);
          if (ev.kind === "goal") newGoals.push(ev);
        }
        // Bump the polling cursor so subsequent polls only fetch newer.
        if ((data.events || []).length > 0) {
          setLastEventAt(data.events[data.events.length - 1].at);
        } else if (!lastEventAt) {
          setLastEventAt(data.server_time);
        }
        if (newGoals.length > 0) {
          const g = newGoals[newGoals.length - 1]; // show most-recent goal
          setLastGoal({ ...g, key: `${g.id}-${Date.now()}` });
          goalListenersRef.current.forEach((cb) => { try { cb(g); } catch { /* noop */ } });
        }
      } catch (e) { /* silent — backend is optional */ }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [lastEventAt]);

  // Consumers can subscribe to goal events (used by the horn player).
  const onGoal = useCallback((cb) => {
    goalListenersRef.current.add(cb);
    return () => goalListenersRef.current.delete(cb);
  }, []);

  // Auto-clear the Red Light after 7s so the ticker doesn't linger.
  useEffect(() => {
    if (!lastGoal) return;
    const t = setTimeout(() => setLastGoal(null), 7000);
    return () => clearTimeout(t);
  }, [lastGoal]);

  const forceGoal = useCallback(async () => {
    try { await api.post("/live/force-goal"); } catch { /* noop */ }
  }, []);

  const value = { games, lastGoal, muted, setMuted, onGoal, forceGoal };
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveCtx);
  if (!ctx) throw new Error("useLive must be used inside LiveProvider");
  return ctx;
}
