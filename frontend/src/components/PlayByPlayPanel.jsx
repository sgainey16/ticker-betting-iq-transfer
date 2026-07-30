/**
 * PlayByPlayPanel — sits beside the PostGameStats on the Recap page.
 * Shows every goal from the game with scorer, assists, time, score-at-time,
 * situation (EV/PP/SH/EN) and a play button that opens PlayByPlayModal.
 *
 * Data source: /api/audition/play-by-play merges NHL public play-by-play
 * (rich stats) with Highlightly clip pairing (video, best-effort).
 */
import { useEffect, useState } from "react";
import axios from "axios";
import { Play } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { C } from "@/lib/brand";
import PlayByPlayModal from "@/components/PlayByPlayModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Colour cue per situation — lets the eye scan for PP/SH/EN goals fast.
const SITUATION_STYLE = {
  EV: { color: "#8892a0", label: "EV" },
  PP: { color: "#1E5BFF", label: "PP" },
  SH: { color: "#c40b1a", label: "SH" },
  EN: { color: "#F5A623", label: "EN" },
};

export default function PlayByPlayPanel({ segment }) {
  const matchId = segment?.match_id;
  const [data, setData] = useState(null);
  const [modalIdx, setModalIdx] = useState(null);

  useEffect(() => {
    if (!matchId) { setData(null); return; }
    let alive = true;
    setData({ loading: true });
    axios.get(`${API}/audition/play-by-play`, { params: { match_id: matchId } })
      .then((r) => { if (alive) setData(r.data); })
      .catch(() => { if (alive) setData({ ready: false }); });
    return () => { alive = false; };
  }, [matchId]);

  if (!matchId) return null;
  if (data?.loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#0d0d13] p-4">
        <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.3em", color: C.blue }}>PLAY BY PLAY</div>
        <div className="mt-3 text-xs text-white/40">Loading events…</div>
      </div>
    );
  }
  if (!data?.ready) return null;

  const plays = data.plays || [];
  const clipsForModal = plays.filter((p) => p.clip).map((p) => ({
    id: p.clip.id, embed_url: p.clip.embed_url, source_url: p.clip.source_url,
    category: p.situation === "PP" ? "power-play-goal" : p.situation === "SH" ? "shorthanded-goal" : "goal",
    home_team: data.home_team, away_team: data.away_team,
  }));

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d13] p-4">
      {/* Section label */}
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.3em", color: C.blue }}>
          PLAY BY PLAY
        </div>
        <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.25em", color: C.gray }}>
          {plays.length} GOALS
        </div>
      </div>

      {plays.length === 0 && (
        <div className="text-xs text-white/40 py-4 text-center">No play-by-play available</div>
      )}

      <div className="space-y-2" data-testid="pbp-list">
        {plays.map((p, i) => {
          const sit = SITUATION_STYLE[p.situation] || SITUATION_STYLE.EV;
          const hasClip = !!p.clip;
          // Only clip-having plays can open the modal. `clipIdxInPool` is
          // the index within `clipsForModal` since it filters out stats-only.
          const clipIdxInPool = clipsForModal.findIndex((c) => c.id === p.clip?.id);
          return (
            <button
              key={i}
              onClick={() => hasClip && setModalIdx(clipIdxInPool)}
              disabled={!hasClip}
              className={`w-full flex items-center gap-3 p-2 rounded-md border transition-all ${
                hasClip
                  ? "border-white/10 hover:border-[#1E5BFF] hover:bg-white/5 cursor-pointer"
                  : "border-white/5 bg-black/20 opacity-60"
              }`}
              data-testid={`pbp-row-${i}`}
            >
              {/* Team logo + play overlay */}
              <div className="relative flex-shrink-0 h-11 w-11 rounded-md bg-black/60 flex items-center justify-center border border-white/10">
                <TeamLogo code={p.team_code} className="h-8 w-8 object-contain" />
                {hasClip && (
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-red-600 flex items-center justify-center border-2 border-[#0d0d13]"
                        style={{ boxShadow: "0 0 10px -2px rgba(239,68,68,0.9)" }}>
                    <Play className="w-2.5 h-2.5 text-white translate-x-[0.5px]" fill="currentColor" />
                  </span>
                )}
              </div>
              {/* Middle: scorer + assists */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: C.white, letterSpacing: "0.02em" }}
                        className="truncate">
                    {p.scorer || "Unknown scorer"}
                  </span>
                  <span className="px-1 py-0.5 rounded-sm font-accent text-[8px] uppercase tracking-widest"
                        style={{ background: sit.color + "33", color: sit.color, border: `1px solid ${sit.color}55` }}>
                    {sit.label}
                  </span>
                </div>
                {(p.assist1 || p.assist2) && (
                  <div className="text-[10px] text-white/50 truncate mt-0.5">
                    {[p.assist1, p.assist2].filter(Boolean).join(" · ")}
                  </div>
                )}
                {!p.assist1 && !p.assist2 && (
                  <div className="text-[10px] text-white/30 italic mt-0.5">unassisted</div>
                )}
              </div>
              {/* Right: score-at-time + period-time */}
              <div className="flex-shrink-0 text-right">
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: C.white, lineHeight: 1 }}>
                  {p.away_score}–{p.home_score}
                </div>
                <div className="mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.2em", color: C.gray }}>
                  P{p.period} · {p.time}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {clipsForModal.length > 0 && modalIdx !== null && (
        <PlayByPlayModal
          open={true}
          clips={clipsForModal}
          matchup={data.matchup}
          startIdx={modalIdx || 0}
          onClose={() => setModalIdx(null)}
        />
      )}
    </div>
  );
}
