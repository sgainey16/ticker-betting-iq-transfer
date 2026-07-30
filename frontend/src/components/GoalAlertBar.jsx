import { useEffect } from "react";
import { useLive } from "@/lib/liveContext";
import { useTeamLogos } from "@/lib/teamLogos";
import { playGoalHorn } from "@/lib/stinger";
import { VolumeX } from "lucide-react";

// Fixed, global "Red Light" alert. Renders inside Layout so every route
// gets it. Idles hidden; whenever a new goal event flows through the
// LiveProvider we slide it in with a soft red pulse + goal horn.

export default function GoalAlertBar() {
  const { lastGoal, muted, onGoal } = useLive();
  const { logoByCode } = useTeamLogos();

  // Fire the horn on each new goal (respects the user mute preference).
  useEffect(() => {
    const unsub = onGoal(() => { if (!muted) playGoalHorn(); });
    return unsub;
  }, [onGoal, muted]);

  if (!lastGoal) return null;

  const teamCode = lastGoal.team_code;
  const teamName = lastGoal.team_name || teamCode;
  const logo = logoByCode(teamCode);
  const scoreAfter = lastGoal.score_after || {};
  const isPp = lastGoal.is_pp_goal;

  return (
    <div
      data-testid="goal-alert-bar"
      className="fixed left-0 right-0 top-16 z-40 flex justify-center px-4 pointer-events-none"
      // top-16 sits it right under the header so it doesn't cover anything.
    >
      <div
        className="pointer-events-auto goal-alert-slide flex items-center gap-3 rounded-full border border-red-500/60 px-4 py-2 shadow-[0_10px_40px_-10px_rgba(239,68,68,0.7)]"
        style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.28) 0%, rgba(11,11,16,0.92) 60%)",
          backdropFilter: "blur(12px)",
        }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="font-accent text-[10px] uppercase tracking-[0.35em] text-red-300">
          {isPp ? "PP Goal" : "Goal"}
        </span>
        {logo && (
          <img src={logo} alt={teamCode} className="w-6 h-6 object-contain flex-shrink-0" />
        )}
        <span className="font-headline text-white text-sm sm:text-base">
          <span className="text-white">{teamName}</span>
          {" · "}
          <span className="text-white/70 text-xs sm:text-sm">
            {scoreAfter.away ?? "?"} – {scoreAfter.home ?? "?"} · P{lastGoal.period} {lastGoal.clock}
          </span>
        </span>
        {muted && (
          <VolumeX className="w-3.5 h-3.5 text-white/40" title="Goal horn muted" />
        )}
      </div>
    </div>
  );
}
