// GameHub — one game's expandable mini-show tile.
// -----------------------------------------------------------------------------
// Every game on Tonight gets its own hub. Collapsed by default; tapping the
// header expands the tile to reveal:
//
//   1. A Reggie/Marc segment specifically about this matchup (placeholder for
//      now — TTS script generation lands in a follow-up build).
//   2. Head-to-head + recent form snapshot so the user can read while they
//      listen.
//   3. Reggie's pick, Marc's pick, the Ticker Model probability, community %.
//   4. YOUR PICK — logo-vs-logo cards.
//   5. After the pick, an auto-advance to the next game (or a "Done" state
//      when the last game is picked).
//
// This is the new IA that replaces the old ambient-loop Morning Skate. One
// segment per game, on demand, no background chatter.

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Play, Pause, Radio, ArrowRight, Check, Mic, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { TeamLogo } from "@/lib/teamLogos";
import { emitSignal } from "@/lib/signals";

// Small stat block used inside the expanded body.
function Stat({ label, home, away, homeAccent, awayAccent }) {
  return (
    <div className="grid grid-cols-3 items-center gap-2 py-1.5 border-b border-white/5 last:border-b-0">
      <div className="text-right font-headline text-lg tabular-nums" style={{ color: homeAccent }}>{home}</div>
      <div className="text-center text-[10px] font-accent uppercase tracking-widest text-white/40">{label}</div>
      <div className="text-left font-headline text-lg tabular-nums" style={{ color: awayAccent }}>{away}</div>
    </div>
  );
}

// Logo-vs-logo pick button (the one we tuned earlier — home left, away right).
function PickCard({ side, code, accent, chosen, disabled, onClick, testid }) {
  return (
    <button
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-4 transition-all disabled:cursor-not-allowed relative overflow-hidden ${
        chosen ? "scale-[1.01]" : "hover:border-white/25"
      }`}
      style={{
        borderColor: chosen ? accent : "#2d2d35",
        background: chosen
          ? `linear-gradient(135deg, ${accent}33 0%, ${accent}11 60%, transparent 100%)`
          : "transparent",
        boxShadow: chosen ? `0 0 0 1px ${accent}55, 0 8px 30px -8px ${accent}77` : "none",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 md:h-20 md:w-20 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform"
          style={{
            background: `${accent}${chosen ? "44" : "22"}`,
            border: `1px solid ${accent}${chosen ? "aa" : "55"}`,
            transform: chosen ? "scale(1.03)" : "scale(1)",
          }}
        >
          <TeamLogo code={code} size={60} monogramClass="!bg-transparent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
            {side === "home" ? "Home" : "Away"}
          </div>
          <div className="font-headline text-3xl md:text-4xl text-white leading-none mt-0.5">{code}</div>
          {chosen && (
            <div className="mt-2 inline-flex items-center gap-1 font-accent text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full" style={{ background: accent, color: "#0b0b10" }}>
                <Check className="w-2.5 h-2.5" strokeWidth={4} />
              </span>
              Your pick
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// The hub — one game, self-contained.
export function GameHub({
  game,
  teamStats,          // map { code → teamRow } for pulling stats
  myPickSide,         // "home" | "away" | null
  onSubmitPick,       // async (gameId, side) => void
  expanded,           // controlled from parent
  onToggle,           // parent handles which one is open
  onAdvance,          // called after pick + delay
  isLast,             // hide "Next game →" on the last one
  autoScrollRef,      // ref so parent can scroll expanded tile into view
}) {
  const [segmentPlaying, setSegmentPlaying] = useState(false);
  const advanceTimerRef = useRef(null);

  const homeCode = game.home;
  const awayCode = game.away;
  const homeAccent = teamStats[homeCode]?.primary || "#1e5dff";
  const awayAccent = teamStats[awayCode]?.primary || "#F58220";

  // Emit expansion signal — the fact that a user opens this game hub is a
  // very strong "I care about this matchup" signal for the ranker.
  useEffect(() => {
    if (expanded) {
      emitSignal({
        kind: "game_hub_expand",
        league: "NHL",
        target: game.id,
        weight: 1.2,
      });
    }
  }, [expanded, game.id]);

  // Auto-advance after a pick — brief delay so the "Your pick" glow can land.
  useEffect(() => {
    if (myPickSide && expanded && !isLast) {
      advanceTimerRef.current = setTimeout(() => {
        onAdvance?.();
      }, 1400);
    }
    return () => clearTimeout(advanceTimerRef.current);
  }, [myPickSide, expanded, isLast, onAdvance]);

  const handleSubmit = (side) => {
    if (myPickSide) return;
    onSubmitPick?.(game.id, side);
  };

  const kickoff = game.starts_at
    ? new Date(game.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "TBD";

  return (
    <div
      ref={autoScrollRef}
      data-testid={`game-hub-${game.id}`}
      data-expanded={expanded ? "true" : "false"}
      className={`rounded-xl border transition-all overflow-hidden ${
        expanded
          ? "border-white/25 bg-black/50"
          : "border-white/10 bg-black/30 hover:border-white/20"
      }`}
    >
      {/* Header — always visible. Tap to expand/collapse. */}
      <button
        onClick={onToggle}
        data-testid={`game-hub-header-${game.id}`}
        className="w-full p-4 flex items-center justify-between gap-3 text-left"
      >
        {/* Home team */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-12 w-12 rounded-md flex items-center justify-center flex-shrink-0"
               style={{ background: `${homeAccent}22`, border: `1px solid ${homeAccent}55` }}>
            <TeamLogo code={homeCode} size={36} monogramClass="!bg-transparent" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">Home</div>
            <div className="font-headline text-lg text-white leading-none">{homeCode}</div>
          </div>
        </div>

        {/* VS + time */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2">
          <div className="font-headline text-white/35 text-sm tracking-widest">vs</div>
          <div className="text-[9px] font-accent uppercase tracking-widest text-white/55">
            {kickoff}
          </div>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
          <div className="text-right min-w-0">
            <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">Away</div>
            <div className="font-headline text-lg text-white leading-none">{awayCode}</div>
          </div>
          <div className="h-12 w-12 rounded-md flex items-center justify-center flex-shrink-0"
               style={{ background: `${awayAccent}22`, border: `1px solid ${awayAccent}55` }}>
            <TeamLogo code={awayCode} size={36} monogramClass="!bg-transparent" />
          </div>
        </div>

        {/* Right rail — pick badge + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0 pl-2 border-l border-white/8">
          {myPickSide ? (
            <div className="text-right">
              <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">Your pick</div>
              <div className="font-headline text-sm" style={{ color: myPickSide === "home" ? homeAccent : awayAccent }}>
                {myPickSide === "home" ? homeCode : awayCode}
              </div>
            </div>
          ) : (
            <span className="hidden sm:inline text-[9px] font-accent uppercase tracking-widest text-white/40">
              Tap to preview
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-white/50 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Body — only rendered when expanded. */}
      {expanded && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3 space-y-4" data-testid={`game-hub-body-${game.id}`}>
          {/* Reggie & Marc segment player — placeholder for now.
           * When TTS scripts are ready this becomes an audio player that
           * fires per-game banter. Signal fires either way. */}
          <div className="rounded-lg border border-white/10 bg-gradient-to-r from-white/[0.03] to-transparent p-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSegmentPlaying(p => !p);
                  emitSignal({ kind: "game_segment_play", league: "NHL", target: game.id, weight: 1.4 });
                }}
                data-testid={`game-hub-segment-play-${game.id}`}
                className="h-10 w-10 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] flex items-center justify-center transition-colors flex-shrink-0"
              >
                {segmentPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Radio className={`w-3 h-3 ${segmentPlaying ? "text-red-400 live-pulse" : "text-white/40"}`} />
                  <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: segmentPlaying ? "#ef4444" : "#a0a0a5" }}>
                    {segmentPlaying ? "ON AIR · REGGIE & MARC" : "REGGIE & MARC · PREGAME"}
                  </span>
                </div>
                <div className="mt-0.5" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "14px", color: "#fff", lineHeight: 1.25 }}>
                  {homeCode} vs {awayCode} — read the room while they set the table.
                </div>
              </div>
            </div>
          </div>

          {/* Head-to-head snapshot — medium depth. Extra stats compared to
           * a basic scoreboard read; if a fan wants deeper analysis they tap
           * "Ask Reggie" below to open the assistant. */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.32em", color: "#a0a0a5" }}>
                Season · Head-to-Head
              </span>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
                {homeCode} · {awayCode}
              </span>
            </div>
            <Stat label="Goals / Game"       home={teamStats[homeCode]?.gf_per_game?.toFixed(2) ?? "—"} away={teamStats[awayCode]?.gf_per_game?.toFixed(2) ?? "—"} homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Goals Against / GP" home={teamStats[homeCode]?.ga_per_game?.toFixed(2) ?? "—"} away={teamStats[awayCode]?.ga_per_game?.toFixed(2) ?? "—"} homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Shots / Game"       home={teamStats[homeCode]?.shots_per_game?.toFixed(1) ?? "—"} away={teamStats[awayCode]?.shots_per_game?.toFixed(1) ?? "—"} homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Power Play %"       home={teamStats[homeCode]?.pp_pct?.toFixed(1) ?? "—"}     away={teamStats[awayCode]?.pp_pct?.toFixed(1) ?? "—"}     homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Penalty Kill %"     home={teamStats[homeCode]?.pk_pct?.toFixed(1) ?? "—"}     away={teamStats[awayCode]?.pk_pct?.toFixed(1) ?? "—"}     homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Faceoff Win %"      home={teamStats[homeCode]?.faceoff_pct?.toFixed(1) ?? "—"} away={teamStats[awayCode]?.faceoff_pct?.toFixed(1) ?? "—"} homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Team Save %"        home={teamStats[homeCode]?.team_sv_pct?.toFixed(3) ?? "—"} away={teamStats[awayCode]?.team_sv_pct?.toFixed(3) ?? "—"} homeAccent={homeAccent} awayAccent={awayAccent} />
            <Stat label="Last 10"            home={teamStats[homeCode]?.last_10 ?? "—"}                 away={teamStats[awayCode]?.last_10 ?? "—"}                 homeAccent={homeAccent} awayAccent={awayAccent} />
          </div>

          {/* Ask Reggie affordance — links to the ReggieAssistant floating
           * mic. Deeper questions live there. Long-term this becomes a
           * StatMuse/SportLogiq deep-dive tap. */}
          <div className="flex items-center justify-between gap-3">
            <button
              data-testid={`game-hub-ask-reggie-${game.id}`}
              onClick={() => {
                emitSignal({ kind: "ask_reggie_open", league: "NHL", target: game.id, weight: 1 });
                // ReggieAssistant lives at fixed bottom-right; scroll it into
                // focus. Full wiring lands with the assistant refactor.
                window.dispatchEvent(new CustomEvent("ticker.reggie.open", { detail: { context: `${homeCode} vs ${awayCode}` } }));
              }}
              className="inline-flex items-center gap-1.5 text-white/70 hover:text-white px-3 py-1.5 rounded-full border border-white/15 hover:border-[#F58220] transition-colors"
              style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "10px", letterSpacing: "0.24em" }}
            >
              <Mic className="w-3 h-3" /> Ask Reggie about this game
            </button>
            <Link
              to={`/tonight/${game.id}`}
              data-testid={`game-hub-deeplink-${game.id}`}
              className="inline-flex items-center gap-1 text-white/40 hover:text-white/70"
              style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em" }}
            >
              Full game hub <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Panel picks + Ticker Model */}
          <div className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              {game.reggie_pick && (
                <div className="text-white/80" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "13px" }}>
                  <span className="text-[#F58220]">Reggie:</span> {game.reggie_pick === "home" ? homeCode : awayCode}
                </div>
              )}
              {game.marc_pick && (
                <div className="text-white/80" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "13px" }}>
                  <span className="text-[#1e5dff]">Marc:</span> {game.marc_pick === "home" ? homeCode : awayCode}
                </div>
              )}
              {game.model_prob_home != null && (
                <div className="text-white/60" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.24em" }}>
                  Ticker Model · {homeCode} {Math.round(game.model_prob_home * 100)}%
                </div>
              )}
            </div>
          </div>

          {/* Your pick — logo-vs-logo. Home left, VS, Away right. */}
          <div>
            <div className="mb-2" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
              Your call
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 md:gap-3">
              <PickCard
                testid={`game-hub-pick-home-${game.id}`}
                side="home" code={homeCode} accent={homeAccent}
                chosen={myPickSide === "home"} disabled={!!myPickSide}
                onClick={() => handleSubmit("home")}
              />
              <div className="flex items-center justify-center px-1 md:px-2 select-none">
                <span className="font-headline text-white/35 text-xl md:text-2xl tracking-widest" aria-hidden="true">vs</span>
              </div>
              <PickCard
                testid={`game-hub-pick-away-${game.id}`}
                side="away" code={awayCode} accent={awayAccent}
                chosen={myPickSide === "away"} disabled={!!myPickSide}
                onClick={() => handleSubmit("away")}
              />
            </div>
          </div>

          {/* Post-pick footer */}
          {myPickSide && !isLast && (
            <div className="pt-2 flex items-center justify-between text-white/50">
              <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em" }}>
                Locked in — next game coming up
              </span>
              <button
                onClick={onAdvance}
                data-testid={`game-hub-advance-${game.id}`}
                className="inline-flex items-center gap-1 text-[#F58220] hover:text-[#ff9042]"
                style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em" }}
              >
                Next game <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {myPickSide && isLast && (
            <div className="pt-2 text-center text-white/60" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em" }}>
              Every game picked · See you at puck-drop
            </div>
          )}
        </div>
      )}
    </div>
  );
}
