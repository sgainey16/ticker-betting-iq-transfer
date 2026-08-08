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
  const interviews = data.interviews || [];
  // Include interviews in the modal's clip pool so the "Next" transport
  // rolls naturally from the last goal into the presser.
  const clipsForModal = [
    ...plays.filter((p) => p.clip).map((p) => ({
      id: p.clip.id, embed_url: p.clip.embed_url, source_url: p.clip.source_url,
      category: p.situation === "PP" ? "power-play-goal" : p.situation === "SH" ? "shorthanded-goal" : "goal",
      home_team: data.home_team, away_team: data.away_team,
    })),
    ...interviews.map((iv) => ({
      id: iv.id, embed_url: iv.embed_url, source_url: iv.source_url,
      category: iv.category,
      home_team: data.home_team, away_team: data.away_team,
    })),
  ];
  const interviewsPoolOffset = plays.filter((p) => p.clip).length;

  // Human label for presser vs post-match content — displayed on each row.
  const interviewLabel = (cat) =>
    cat === "press-conference" ? "PRESSER" : "POST-GAME";
  const interviewSubLabel = (title, cat) => {
    const t = (title || "").trim();
    if (t) return t;
    return cat === "press-conference" ? "Coach & players at the podium" : "Locker-room reactions";
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d13] p-4">
      {/* Section header — big, bold, unmissable */}
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-white/10">
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: C.white, letterSpacing: "0.02em", lineHeight: 1 }}
             data-testid="pbp-header">
          INDIVIDUAL HIGHLIGHTS
        </div>
        <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.25em", color: C.blue }}>
          {plays.length} GOALS{interviews.length > 0 ? ` · ${interviews.length} INTERVIEW${interviews.length === 1 ? "" : "S"}` : ""}
        </div>
      </div>

      {plays.length === 0 && interviews.length === 0 && (
        <div className="text-sm text-white/40 py-4 text-center">No play-by-play available</div>
      )}

      {/* Scrollable list — expanded max-height so larger logos still fit
       * multiple rows in view; scroll for the rest. */}
      <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1 no-scrollbar" data-testid="pbp-list">
        {plays.map((p, i) => {
          const sit = SITUATION_STYLE[p.situation] || SITUATION_STYLE.EV;
          const hasClip = !!p.clip;
          const clipIdxInPool = clipsForModal.findIndex((c) => c.id === p.clip?.id);
          return (
            <button
              key={i}
              onClick={() => hasClip && setModalIdx(clipIdxInPool)}
              disabled={!hasClip}
              className={`w-full flex items-center gap-3 p-3 rounded-md border transition-all ${
                hasClip
                  ? "border-white/10 hover:border-[#1E5BFF] hover:bg-white/5 cursor-pointer"
                  : "border-white/5 bg-black/20 opacity-60"
              }`}
              data-testid={`pbp-row-${i}`}
            >
              {/* Team logo tile — responsive: compact 68px on phones so
               * multiple rows fit on-screen, 128px on desktop for impact.
               * Inline `style` needed on the outer div (Tailwind arbitrary
               * sizes were being purged); logo `size` prop overrides the
               * component's default. */}
              <div
                className="relative flex-shrink-0 flex items-center justify-center rounded-lg border border-white/15 bg-black/40 tile-highlight"
              >
                <TeamLogo
                  code={p.team_code}
                  size={62}
                  className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] tile-highlight-logo"
                />
                {hasClip && (
                  <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-red-600 flex items-center justify-center border-2 border-[#0d0d13]"
                        style={{ width: 26, height: 26, boxShadow: "0 0 14px -2px rgba(239,68,68,0.9)" }}>
                    <Play className="w-3.5 h-3.5 text-white translate-x-[0.5px]" fill="currentColor" />
                  </span>
                )}
              </div>
              {/* Middle: scorer + assists — bigger and bolder */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: C.white, letterSpacing: "0.02em", lineHeight: 1.1 }}
                        className="truncate">
                    {p.scorer || "Unknown scorer"}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-sm font-accent text-[10px] uppercase tracking-widest flex-shrink-0"
                        style={{ background: sit.color + "33", color: sit.color, border: `1px solid ${sit.color}55`, fontFamily: "Oswald", fontWeight: 600 }}>
                    {sit.label}
                  </span>
                </div>
                {(p.assist1 || p.assist2) && (
                  <div className="text-[13px] text-white/70 truncate mt-1" style={{ fontFamily: "Inter", fontWeight: 400 }}>
                    {[p.assist1, p.assist2].filter(Boolean).join(" · ")}
                  </div>
                )}
                {!p.assist1 && !p.assist2 && (
                  <div className="text-[12px] text-white/40 italic mt-1">unassisted</div>
                )}
              </div>
              {/* Right: score-at-time + period-time — bigger */}
              <div className="flex-shrink-0 text-right">
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: C.white, lineHeight: 1 }}>
                  {p.away_score}–{p.home_score}
                </div>
                <div className="mt-1" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "11px", letterSpacing: "0.2em", color: C.silver }}>
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
