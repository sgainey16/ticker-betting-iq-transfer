// Ticker Pro — one game with Betting IQ turned on.
//
// This is a CONVERGENCE PROOF. It reuses actual Best Ticker components
// (GameHub is rendered untouched) and adds three Betting IQ overlays:
//
//   1. The Read Triangle — TICKER IQ | MARKET (locked) | COMMUNITY.
//   2. MyCallState       — if this game is on the user's Tonight's 10 board.
//   3. Hockey Intelligence Rail — architecture visible, only real lenses render.
//
// Explicitly NOT here:
//   - Fabricated Market data (Market stays locked until a real feed lands).
//   - Fabricated Sportlogiq analytics (lenses without real data don't render).
//   - Duplicated Tonight, duplicated Team/Player databases, or a rebuilt GameHub.
//
// Layout rhythm follows the approved convergence brief:
//   HOCKEY (matchup identity)
//   ↓
//   REGGIE + MARC / MEDIA / RECAP  ← GameHub already carries this
//   ↓
//   TICKER IQ | MARKET | COMMUNITY
//   ↓
//   KEY GAME STATS / COMPARISON     ← GameHub already carries this
//   ↓
//   HOCKEY INTELLIGENCE (with drill-down architecture visible)

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { TMark } from "@/lib/brand";
import { GameHub } from "@/components/GameHub";
import {
  ReadTriangle,
  IntelligenceRail,
  MyCallState,
} from "@/components/iq/v2/BettingIQOverlays";

export default function TickerProGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const deviceId = useMemo(() => getDeviceId(), []);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myPreds, setMyPreds] = useState([]);
  const [userName] = useState(() => localStorage.getItem("ticker_user") || "guest");

  const refresh = useCallback(async () => {
    const [g, t, mine] = await Promise.all([
      api.get("/predictions/games").catch(() => ({ data: { games: [] } })),
      api.get("/stats/teams").catch(() => ({ data: { teams: [] } })),
      api.get(`/predictions/mine?user_name=${encodeURIComponent(userName)}`)
        .catch(() => ({ data: { predictions: [] } })),
    ]);
    setGames(g.data?.games || []);
    setTeams(t.data?.teams || []);
    setMyPreds(mine.data?.predictions || []);
  }, [userName]);

  useEffect(() => { refresh(); }, [refresh]);

  const game = useMemo(() => games.find((g) => g.id === gameId) || null, [games, gameId]);
  const teamStats = useMemo(() => {
    const m = {}; for (const t of teams) m[t.code] = t; return m;
  }, [teams]);
  const myPickSide = myPreds.find((p) => p.game_id === gameId)?.pick || null;

  const submitPick = async (gid, side) => {
    if (myPickSide === side) return;
    const prev = myPickSide;
    setMyPreds((prevList) => {
      const others = prevList.filter((p) => p.game_id !== gid);
      return [...others, { game_id: gid, pick: side, user_name: userName }];
    });
    try {
      await api.post("/predictions", { user_name: userName, game_id: gid, pick: side, reasoning: "" });
      refresh();
    } catch {
      setMyPreds((prevList) => {
        const others = prevList.filter((p) => p.game_id !== gid);
        return prev ? [...others, { game_id: gid, pick: prev, user_name: userName }] : others;
      });
    }
  };

  if (!games.length) {
    return (
      <div className="max-w-3xl mx-auto py-8 text-center text-white/60"
           style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px" }}>
        Loading tonight's slate…
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-3 space-y-4">
        <Link to="/iq" className="inline-flex items-center gap-1 text-white/60 hover:text-white"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em" }}>
          <ChevronLeft className="w-3 h-3" /> Back to Betting IQ
        </Link>
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center">
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#fff" }}>
            That game isn't on tonight's slate.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050510] via-[#08081a] to-[#050510] text-white"
         data-testid="iq-proof-root">
      {/* Sticky mode bar — makes it obvious the user is inside Betting IQ */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-3 h-11 flex items-center gap-2">
          <button
            onClick={() => navigate("/iq")}
            className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors shrink-0"
            aria-label="Back to Betting IQ"
            data-testid="iq-proof-back"
          >
            <ChevronLeft className="w-4 h-4" />
            <TMark size={16} variant="light" />
          </button>
          <div className="flex-1" />
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1e5dff]/20 border border-[#1e5dff]/60 px-2.5 py-1"
            data-testid="iq-proof-mode-badge"
          >
            <Sparkles className="w-3 h-3 text-[#7fb0ff]" />
            <span className="font-accent"
                  style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.32em", color: "#7fb0ff" }}>
              Betting IQ · On
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 pt-3 pb-10 space-y-3">
        {/* HOCKEY → REGGIE + MARC → HEAD-TO-HEAD — all live inside GameHub. */}
        <GameHub
          game={game}
          teamStats={teamStats}
          myPickSide={myPickSide}
          onSubmitPick={submitPick}
          expanded={true}
          onToggle={() => {}}
          onAdvance={() => navigate("/iq")}
          isLast={true}
          autoStartSegment={false}
        />

        {/* THE READ triangle — Ticker IQ | Market (locked) | Community */}
        <ReadTriangle game={game} />

        {/* Personal call state — only appears if the user has this game on
            their Tonight's 10 board. */}
        <MyCallState deviceId={deviceId} gameId={game.id} />

        {/* Deep hockey intelligence entry point — Overview lens is live,
            other lenses are architecturally represented but not surfaced
            until data providers land. */}
        <IntelligenceRail game={game} teamStats={teamStats} />
      </main>
    </div>
  );
}
