import { useState } from "react";
import { ChevronDown, VolumeX, Volume2, Radio } from "lucide-react";
import { useLive } from "@/lib/liveContext";
import { TeamLogo } from "@/lib/teamLogos";
import { BROADCAST_SLOT_ID } from "@/lib/broadcastContext";

// The Scoreboard tab. In demo mode this shows 4 mock games with a live
// ticker feel — clock, period, PP/PK, score updating every ~12s. When we
// wire the real NHL API, this same shell paints whatever comes back from
// /api/live/state (no UI changes needed).
//
// Reggie & Marc anchor the top of the page via the shared broadcast slot
// so the Scoreboard feels like the same live desk as /show — the label
// on the chyron reads "LIVE ACTION" here.

export default function Scoreboard() {
  const { games, muted, setMuted, forceGoal } = useLive();

  return (
    <div className="-mx-5 sm:-mx-8 -mt-8" data-testid="scoreboard-page">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-6 space-y-6">
        {/* Reggie & Marc portal in here — same live desk as /show. */}
        <div id={BROADCAST_SLOT_ID} data-testid="broadcast-slot" />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-headline text-4xl sm:text-5xl text-white">Scoreboard</h1>
            <p className="text-white/60 mt-2 text-sm max-w-xl">
              Tonight's board — clock, period, special teams, and a red-light alert every time the puck hits the back of the net.
            </p>
          </div>

          {/* Sound toggle + investor "force goal" button */}
          <div className="flex items-center gap-2">
            <button
              data-testid="scoreboard-mute-toggle"
              onClick={() => setMuted(!muted)}
              className="inline-flex items-center gap-2 rounded-full border border-[#2d2d35] hover:border-white/30 px-3 py-2 font-accent text-[11px] uppercase tracking-widest text-white/70 hover:text-white transition-colors"
              title={muted ? "Turn goal horn on" : "Mute goal horn"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {muted ? "Horn off" : "Horn on"}
            </button>
            <button
              data-testid="scoreboard-force-goal"
              onClick={forceGoal}
              className="inline-flex items-center gap-2 rounded-full border border-red-500/50 hover:border-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 font-accent text-[11px] uppercase tracking-widest text-red-300 hover:text-red-200 transition-colors"
              title="Fire a demo goal now"
            >
              <Radio className="w-4 h-4" />
              Fire goal (demo)
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((g) => <GameCard key={g.game_id} game={g} />)}
        </div>

        {games.length === 0 && (
          <div className="card-surface p-12 text-center">
            <div className="font-accent text-xs uppercase tracking-widest text-white/40">
              No games on the board
            </div>
            <div className="text-white/60 mt-2 text-sm">
              Live feed will populate here once the season is underway.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ game }) {
  const [open, setOpen] = useState(false);
  const situationLabel = situationText(game.situation);
  const isPP = game.situation.startsWith("PP-");
  const ppSide = isPP ? game.situation.split("-")[1].toLowerCase() : null;
  const isFinal = game.state === "FINAL";

  return (
    <div className="card-surface p-4 sm:p-5" data-testid={`scoreboard-card-${game.game_id}`}>
      {/* Header — clock + period + special teams */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest ${
            isFinal
              ? "bg-white/10 text-white/60"
              : "bg-red-500/20 text-red-300 border border-red-500/40"
          }`}>
            {isFinal ? "Final" : (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                Live
              </>
            )}
          </span>
          <span className="font-headline text-white text-sm">
            {isFinal ? "Final" : `P${game.period} · ${game.clock}`}
          </span>
        </div>
        {!isFinal && (
          <span className={`font-accent text-[9px] uppercase tracking-widest ${
            isPP ? "text-[#1E5BFF]" : "text-white/50"
          }`}>
            {situationLabel}
          </span>
        )}
      </div>

      {/* Score row — big logos flanking the score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide side="away" team={game.away} isPP={ppSide === "away"} />
        <div className="font-headline text-2xl sm:text-3xl text-white/40">·</div>
        <TeamSide side="home" team={game.home} isPP={ppSide === "home"} />
      </div>

      {/* Expand — advanced numbers (xG, possession — offseason: placeholders) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-md border border-white/10 hover:border-white/25 py-1.5 font-accent text-[10px] uppercase tracking-widest text-white/50 hover:text-white transition-colors"
      >
        {open ? "Hide analytics" : "Show analytics"}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          <MiniStat label="Shots" away={game.away.shots} home={game.home.shots} />
          <MiniStat label="xG" away="—" home="—" placeholder />
          <MiniStat label="Possession %" away="—" home="—" placeholder />
          <div className="text-[9px] font-accent uppercase tracking-widest text-white/25 text-right pt-1">
            xG / possession wire to NHL EDGE feed at puck drop
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSide({ side, team, isPP }) {
  const align = side === "home" ? "justify-end text-right" : "justify-start text-left";
  const flexOrder = side === "home" ? "flex-row-reverse" : "flex-row";
  return (
    <div className={`flex items-center gap-3 ${align}`}>
      <div className={`flex items-center gap-2 ${flexOrder}`}>
        <TeamLogo code={team.code} size={40} />
        <div>
          <div className="font-headline text-white text-sm sm:text-base leading-tight">{team.code}</div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
            {team.shots} SOG {isPP && <span className="text-[#1E5BFF]">· PP</span>}
          </div>
        </div>
      </div>
      <div className="font-headline text-3xl sm:text-4xl text-white leading-none">
        {team.score}
      </div>
    </div>
  );
}

function MiniStat({ label, away, home, placeholder }) {
  return (
    <div className={`grid grid-cols-3 items-center ${placeholder ? "opacity-50" : ""}`}>
      <div className="text-right font-headline text-lg text-white">{away}</div>
      <div className="text-center font-accent text-[9px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="text-left font-headline text-lg text-white">{home}</div>
    </div>
  );
}

function situationText(sit) {
  if (sit === "5v5") return "Even Strength";
  if (sit === "PP-HOME") return "Home Power Play";
  if (sit === "PP-AWAY") return "Away Power Play";
  return sit;
}
