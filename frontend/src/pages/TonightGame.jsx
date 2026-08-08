// Tonight — deep-link per-game hub.
// -----------------------------------------------------------------------------
// The `/tonight/:gameId` route. Same GameHub component the Tonight list uses,
// but rendered solo and always-expanded so a share link, notification, or
// deep bookmark drops the user directly onto one game.
//
// Use cases:
//   • Share links from the app ("check out tonight's COL @ VGK")
//   • Push notifications ("Reggie's take on your Habs game is live")
//   • Bookmark for a game the user picks every week (rivalry, favorite team)

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { GameHub } from "@/components/GameHub";
import { emitSignal } from "@/lib/signals";

export default function TonightGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [myPreds, setMyPreds] = useState([]);
  const [userName] = useState(() => localStorage.getItem("ticker_user") || "guest");

  const refresh = useCallback(async () => {
    try {
      const [g, t, mine] = await Promise.all([
        api.get("/predictions/games").catch(() => ({ data: { games: [] } })),
        api.get("/stats/teams").catch(() => ({ data: { teams: [] } })),
        api.get(`/predictions/mine?user_name=${encodeURIComponent(userName)}`).catch(() => ({ data: { predictions: [] } })),
      ]);
      setGames(g.data?.games || []);
      setTeams(t.data?.teams || []);
      setMyPreds(mine.data?.predictions || []);
    } catch { /* soft fail */ }
  }, [userName]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    emitSignal({ kind: "game_deeplink_open", league: "NHL", target: gameId, weight: 1.5 });
  }, [gameId]);

  const game = useMemo(() => games.find(g => g.id === gameId) || null, [games, gameId]);
  const teamStats = useMemo(() => {
    const m = {}; for (const t of teams) m[t.code] = t; return m;
  }, [teams]);

  const myPickSide = myPreds.find(p => p.game_id === gameId)?.pick || null;

  async function submitPick(gid, side) {
    // Allow pick changes until game start; backend upserts on user+game.
    if (myPickSide === side) return;
    const prev = myPickSide;
    setMyPreds(prevList => {
      const others = prevList.filter(p => p.game_id !== gid);
      return [...others, { game_id: gid, pick: side, user_name: userName }];
    });
    emitSignal({ kind: prev ? "game_pick_change" : "game_pick", league: "NHL", target: gid, weight: 2 });
    try {
      await api.post("/predictions", { user_name: userName, game_id: gid, pick: side, reasoning: "" });
      refresh();
    } catch {
      setMyPreds(prevList => {
        const others = prevList.filter(p => p.game_id !== gid);
        return prev ? [...others, { game_id: gid, pick: prev, user_name: userName }] : others;
      });
    }
  }

  if (!games.length) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="text-white/60 text-center" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px" }}>
          Loading tonight's slate…
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <Link to="/show" className="inline-flex items-center gap-1 text-white/60 hover:text-white"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em" }}>
          <ChevronLeft className="w-3 h-3" /> Back to Tonight
        </Link>
        <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center">
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#fff" }}>
            That game isn't on tonight's slate.
          </div>
          <div className="mt-2" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px", color: "#a0a0a5" }}>
            It may have already been played or postponed. Head back to see what's on.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-4" data-testid="tonight-deeplink-page">
      <Link to="/show" data-testid="tonight-deeplink-back"
            className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors"
            style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em" }}>
        <ChevronLeft className="w-3 h-3" /> All tonight's games
      </Link>
      <GameHub
        game={game}
        teamStats={teamStats}
        myPickSide={myPickSide}
        onSubmitPick={submitPick}
        expanded={true}
        onToggle={() => navigate("/show")}
        onAdvance={() => navigate("/show")}
        isLast={true}
        autoStartSegment={true}
      />
    </div>
  );
}
