import { useEffect, useState } from "react";
import { useLive } from "@/lib/liveContext";
import { useTeamLogos } from "@/lib/teamLogos";
import { playGoalHorn } from "@/lib/stinger";
import { VolumeX } from "lucide-react";

// Compact "Red Light" alert — a small toast that slides in from the
// top-right so it doesn't dominate the broadcast frame. Auto-dismisses
// after ~8s. Renders inside Layout so every route gets it.

export default function GoalAlertBar() {
  const { lastGoal, muted, onGoal } = useLive();
  const { logoByCode } = useTeamLogos();
  const [visible, setVisible] = useState(false);

  // Fire the horn on each new goal, and make the toast visible briefly.
  useEffect(() => {
    const unsub = onGoal(() => {
      if (!muted) playGoalHorn();
      setVisible(true);
    });
    return unsub;
  }, [onGoal, muted]);

  // Auto-dismiss whenever lastGoal changes — the toast lives ~8s per goal.
  useEffect(() => {
    if (!lastGoal) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(t);
  }, [lastGoal]);

  if (!lastGoal || !visible) return null;

  const teamCode = lastGoal.team_code;
  const teamName = lastGoal.team_name || teamCode;
  const logo = logoByCode(teamCode);
  const scoreAfter = lastGoal.score_after || {};
  const isPp = lastGoal.is_pp_goal;

  return (
    <div
      data-testid="goal-alert-bar"
      className="fixed right-3 top-20 z-40 flex justify-end pointer-events-none max-w-[calc(100vw-1.5rem)]"
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="pointer-events-auto goal-alert-slide flex items-center gap-2 rounded-full border border-red-500/50 pl-2.5 pr-3 py-1 shadow-[0_6px_24px_-8px_rgba(239,68,68,0.5)] hover:bg-black/70"
        style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(11,11,16,0.92) 60%)",
          backdropFilter: "blur(10px)",
        }}
        title="Dismiss"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
        <span className="font-accent text-[9px] uppercase tracking-[0.3em] text-red-300">
          {isPp ? "PP" : "Goal"}
        </span>
        {logo && (
          <img src={logo} alt={teamCode} className="w-4 h-4 object-contain flex-shrink-0" />
        )}
        <span className="text-white text-[12px] font-semibold" style={{ fontFamily: "Rajdhani" }}>
          {teamCode}
        </span>
        <span className="text-white/60 text-[11px]">
          {scoreAfter.away ?? "?"}–{scoreAfter.home ?? "?"}
        </span>
        {muted && (
          <VolumeX className="w-3 h-3 text-white/40" title="Goal horn muted" />
        )}
      </button>
    </div>
  );
}
