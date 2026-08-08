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
//
// The matchup logos at the top ARE the vote buttons when the tile is
// expanded — no separate "Your call" row underneath. Tap a logo to lock
// your call; tap the other one to switch it (until the puck drops).

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Play, Pause, Radio, ArrowRight, Check, Mic, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { TeamLogo } from "@/lib/teamLogos";
import { emitSignal } from "@/lib/signals";
import { StatCallouts } from "@/components/StatCallouts";
import { api } from "@/lib/api";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

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

// Team side inside the header — doubles as a vote button when expanded &
// not locked. Kept in one place so the collapsed and expanded views share
// the exact same logo treatment (just with vote affordance added when it
// makes sense).
function TeamSide({
  side, code, accent, myPickSide, resolved, votable, onVote, align, testid,
}) {
  const chosen = myPickSide === side;
  const otherChosen = myPickSide && myPickSide !== side;
  const clickable = votable && !resolved;
  const Wrapper = clickable ? "button" : "div";
  const wrapperProps = clickable
    ? {
        type: "button",
        onClick: (e) => { e.stopPropagation(); onVote?.(side); },
        "aria-label": `Pick ${code} (${side})`,
        "aria-pressed": chosen,
        "data-testid": testid,
      }
    : { "data-testid": testid };

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex items-center gap-3 min-w-0 flex-1 rounded-lg transition-all ${
        align === "right" ? "justify-end text-right" : "text-left"
      } ${clickable ? "cursor-pointer p-1.5 -m-1.5 hover:bg-white/[0.03]" : ""} ${
        otherChosen ? "opacity-45" : "opacity-100"
      }`}
    >
      {align === "right" && (
        <div className="min-w-0">
          <div className="text-[9px] font-accent uppercase tracking-widest" style={{ color: chosen ? accent : "rgba(255,255,255,0.4)" }}>
            {chosen ? "Your pick" : side === "home" ? "Home" : "Away"}
          </div>
          <div className="font-headline text-lg text-white leading-none">{code}</div>
        </div>
      )}
      <div
        className="h-12 w-12 rounded-md flex items-center justify-center flex-shrink-0 relative transition-all"
        style={{
          background: `${accent}${chosen ? "44" : "22"}`,
          border: `1px solid ${accent}${chosen ? "cc" : "55"}`,
          boxShadow: chosen ? `0 0 0 2px ${accent}bb, 0 6px 20px -6px ${accent}77` : "none",
          transform: chosen ? "scale(1.06)" : "scale(1)",
        }}
      >
        <TeamLogo code={code} size={36} monogramClass="!bg-transparent" />
        {chosen && (
          <span
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: accent, color: "#0b0b10", boxShadow: `0 0 0 2px #0b0b10` }}
            aria-hidden="true"
          >
            <Check className="w-2.5 h-2.5" strokeWidth={4} />
          </span>
        )}
      </div>
      {align !== "right" && (
        <div className="min-w-0">
          <div className="text-[9px] font-accent uppercase tracking-widest" style={{ color: chosen ? accent : "rgba(255,255,255,0.4)" }}>
            {chosen ? "Your pick" : side === "home" ? "Home" : "Away"}
          </div>
          <div className="font-headline text-lg text-white leading-none">{code}</div>
        </div>
      )}
    </Wrapper>
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
  autoStartSegment,   // true = play the R&M segment on first mount (deep-link)
}) {
  const [segmentPlaying, setSegmentPlaying] = useState(false);
  const [segment, setSegment] = useState(null); // { reggie_hook, marc_read, reggie_audio_url, marc_audio_url }
  const [segmentLoading, setSegmentLoading] = useState(false);
  const [audioBeat, setAudioBeat] = useState(null); // "reggie" | "marc" | null
  const audioRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const autoStartedRef = useRef(false);
  const firstPickRef = useRef(!!myPickSide); // tracks if pick already existed on mount

  // Fetch the per-game pregame script the first time the tile expands.
  // Cached backend-side, so re-opens are instant. `voice=true` pre-renders
  // ElevenLabs audio so tap-to-play is a single audio element swap.
  useEffect(() => {
    if (!expanded || segment || segmentLoading) return;
    setSegmentLoading(true);
    api.get(`/tonight/segment?game_id=${encodeURIComponent(game.id)}&voice=true`)
      .then((r) => setSegment(r.data))
      .catch(() => setSegment({ reggie_hook: "", marc_read: "", source: "error" }))
      .finally(() => setSegmentLoading(false));
  }, [expanded, game.id, segment, segmentLoading]);

  // Play/pause the pregame segment audio. Plays Reggie first, then Marc.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!segmentPlaying) {
      el.pause();
      setAudioBeat(null);
      return;
    }
    if (!segment) return;
    const reggieUrl = segment.reggie_audio_url ? `${BACKEND}${segment.reggie_audio_url}` : null;
    const marcUrl = segment.marc_audio_url ? `${BACKEND}${segment.marc_audio_url}` : null;
    const beats = [
      { speaker: "reggie", url: reggieUrl },
      { speaker: "marc", url: marcUrl },
    ].filter(b => b.url);
    if (beats.length === 0) return;

    let idx = 0;
    const playNext = () => {
      if (idx >= beats.length) {
        setSegmentPlaying(false);
        setAudioBeat(null);
        return;
      }
      const b = beats[idx];
      setAudioBeat(b.speaker);
      el.src = b.url;
      el.onended = () => { idx += 1; playNext(); };
      el.onerror = () => { idx += 1; playNext(); };
      el.play().catch(() => { idx += 1; playNext(); });
    };
    playNext();

    return () => {
      el.onended = null;
      el.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentPlaying, segment]);

  // Deep-link entry → auto-play the segment once. Prevents re-firing on
  // re-renders. Signal fires just like a manual play.
  useEffect(() => {
    if (autoStartSegment && expanded && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setSegmentPlaying(true);
      emitSignal({ kind: "game_segment_play", league: "NHL", target: game.id, weight: 1.4 });
    }
  }, [autoStartSegment, expanded, game.id]);

  const homeCode = game.home;
  const awayCode = game.away;
  const homeAccent = teamStats[homeCode]?.primary || "#1e5dff";
  const awayAccent = teamStats[awayCode]?.primary || "#F58220";

  // Pick lock: after puck drops or the game is graded, votes are frozen.
  // start_iso is the canonical field from /api/predictions/games; we
  // tolerate the legacy starts_at name too.
  const startIso = game.start_iso || game.starts_at || null;
  const gameStarted = !!(startIso && new Date(startIso).getTime() <= Date.now());
  const resolved = !!game.winner;
  const lockedIn = resolved || gameStarted;
  const votable = expanded && !lockedIn;

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

  // Auto-advance after the FIRST pick — brief delay so the "Your pick"
  // glow can land. Once the user changes their mind we don't keep
  // advancing (feels like a shove).
  useEffect(() => {
    if (myPickSide && !firstPickRef.current && expanded && !isLast) {
      firstPickRef.current = true;
      advanceTimerRef.current = setTimeout(() => {
        onAdvance?.();
      }, 1400);
    }
    return () => clearTimeout(advanceTimerRef.current);
  }, [myPickSide, expanded, isLast, onAdvance]);

  const handleVote = (side) => {
    if (lockedIn) return;
    if (myPickSide === side) return; // same pick — no-op
    onSubmitPick?.(game.id, side);
  };

  const kickoff = startIso
    ? new Date(startIso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
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
      {/* Header — always visible.
       * COLLAPSED: whole header is a toggle-button that expands the tile.
       * EXPANDED : header logos become vote buttons; only the small chevron
       *           on the right collapses the tile. */}
      <div
        className="w-full p-4 flex items-center justify-between gap-3"
        onClick={!expanded ? onToggle : undefined}
        data-testid={`game-hub-header-${game.id}`}
        style={{ cursor: !expanded ? "pointer" : "default" }}
      >
        {/* Home team — left, vote button when expanded */}
        <TeamSide
          side="home"
          code={homeCode}
          accent={homeAccent}
          myPickSide={myPickSide}
          resolved={resolved}
          votable={votable}
          onVote={handleVote}
          align="left"
          testid={`game-hub-pick-home-${game.id}`}
        />

        {/* VS + time */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2 select-none">
          <div className="font-headline text-white/35 text-sm tracking-widest">vs</div>
          <div className="text-[9px] font-accent uppercase tracking-widest text-white/55">
            {kickoff}
          </div>
        </div>

        {/* Away team — right, vote button when expanded */}
        <TeamSide
          side="away"
          code={awayCode}
          accent={awayAccent}
          myPickSide={myPickSide}
          resolved={resolved}
          votable={votable}
          onVote={handleVote}
          align="right"
          testid={`game-hub-pick-away-${game.id}`}
        />

        {/* Right rail — resolved grade badge (post-game) or the small
         * expand/collapse chevron. Kept as a dedicated tap zone so the
         * logos above stay focused on voting. */}
        <div className="flex items-center gap-2 flex-shrink-0 pl-2 border-l border-white/8">
          {myPickSide && resolved ? (
            (() => {
              const correct = myPickSide === game.winner;
              const bg = correct ? "#22c55e" : "#ef4444";
              return (
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold"
                  style={{ background: bg, color: "#0b0b10" }}
                  title={correct ? "Correct call" : "Missed this one"}
                  data-testid={`game-hub-grade-${game.id}`}
                >
                  {correct ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : "×"}
                </span>
              );
            })()
          ) : null}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
            data-testid={`game-hub-toggle-${game.id}`}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-white/5 text-white/60 hover:text-white transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body — only rendered when expanded. */}
      {expanded && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3 space-y-4" data-testid={`game-hub-body-${game.id}`}>
          {/* Vote hint / status — subtle line so users know the top logos
           * are how you make your pick. Once locked, we swap in a status. */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex items-center gap-1.5"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em" }}
            >
              {lockedIn ? (
                <span className="text-white/50">
                  {resolved ? "Final · picks graded" : "Puck's dropped · picks locked"}
                </span>
              ) : myPickSide ? (
                <span style={{ color: "#F58220" }}>
                  Locked in · tap the other logo to switch
                </span>
              ) : (
                <span style={{ color: "#F58220" }}>
                  Your call · tap a logo above to pick
                </span>
              )}
            </span>
            {myPickSide && !resolved && (
              <span className="text-white/40" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "12px" }}>
                {myPickSide === "home" ? homeCode : awayCode}
              </span>
            )}
          </div>

          {/* Reggie & Marc per-game segment player — real script pulled from
           * /api/tonight/segment (Claude via Emergent LLM key), TTS via
           * ElevenLabs. Cached backend-side per (game, panel picks) so
           * subsequent opens are instant. */}
          <div className="rounded-lg border border-white/10 bg-gradient-to-r from-white/[0.03] to-transparent p-3 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSegmentPlaying(p => !p);
                  emitSignal({ kind: "game_segment_play", league: "NHL", target: game.id, weight: 1.4 });
                }}
                data-testid={`game-hub-segment-play-${game.id}`}
                disabled={segmentLoading}
                className="h-10 w-10 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-40 flex items-center justify-center transition-colors flex-shrink-0"
              >
                {segmentPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Radio className={`w-3 h-3 ${segmentPlaying ? "text-red-400 live-pulse" : "text-white/40"}`} />
                  <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: segmentPlaying ? "#ef4444" : "#a0a0a5" }}>
                    {segmentLoading
                      ? "LOADING SEGMENT…"
                      : segmentPlaying
                        ? `ON AIR · ${audioBeat === "marc" ? "MARC" : "REGGIE"} SPEAKING`
                        : "REGGIE & MARC · PREGAME"}
                  </span>
                </div>
                <div className="mt-0.5" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "14px", color: "#fff", lineHeight: 1.25 }}>
                  {homeCode} vs {awayCode} — the desk on tonight's matchup.
                </div>
              </div>
            </div>

            {/* Reggie & Marc lines — visible as captions so users can read
             * along and get the point even with sound off. */}
            {segment?.reggie_hook && (
              <div
                className={`rounded-md border p-2.5 transition-colors ${
                  audioBeat === "reggie"
                    ? "border-[#F58220] bg-[#F58220]/10"
                    : "border-white/8 bg-black/30"
                }`}
                data-testid={`game-hub-reggie-line-${game.id}`}
              >
                <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.28em", color: "#F58220" }}>
                  Reggie{game.reggie_pick ? ` · ${game.reggie_pick === "home" ? homeCode : awayCode}` : ""}
                </div>
                <div className="mt-1 text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px", lineHeight: 1.4 }}>
                  {segment.reggie_hook}
                </div>
              </div>
            )}
            {segment?.marc_read && (
              <div
                className={`rounded-md border p-2.5 transition-colors ${
                  audioBeat === "marc"
                    ? "border-[#1e5dff] bg-[#1e5dff]/10"
                    : "border-white/8 bg-black/30"
                }`}
                data-testid={`game-hub-marc-line-${game.id}`}
              >
                <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.28em", color: "#1e5dff" }}>
                  Marc{game.marc_pick ? ` · ${game.marc_pick === "home" ? homeCode : awayCode}` : ""}
                </div>
                <div className="mt-1 text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px", lineHeight: 1.4 }}>
                  {segment.marc_read}
                </div>
              </div>
            )}
            {segment?.stat_line && (
              <div className="text-center text-white/50 text-[10px] font-accent uppercase tracking-[0.28em] pt-1">
                {segment.stat_line}
              </div>
            )}

            {/* Hidden audio element — plays reggie then marc back-to-back. */}
            <audio ref={audioRef} playsInline preload="none" />

            {/* Stat callouts — pulse in a rotating loop while the segment
             * is playing so users can "follow along while looking at
             * content" (real broadcast-graphics feel). */}
            <StatCallouts
              active={segmentPlaying}
              callouts={[
                { label: `${homeCode} · GF/GP`, value: teamStats[homeCode]?.gf_per_game?.toFixed(2) ?? "—" },
                { label: `${awayCode} · GF/GP`, value: teamStats[awayCode]?.gf_per_game?.toFixed(2) ?? "—" },
                { label: `${homeCode} · PP%`,   value: teamStats[homeCode]?.pp_pct?.toFixed(1) ?? "—", unit: "%" },
                { label: `${awayCode} · PK%`,   value: teamStats[awayCode]?.pk_pct?.toFixed(1) ?? "—", unit: "%" },
                { label: `${homeCode} · L10`,   value: teamStats[homeCode]?.last_10 ?? "—" },
              ]}
            />
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

          {/* Post-pick footer */}
          {myPickSide && !isLast && !lockedIn && (
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
          {myPickSide && isLast && !lockedIn && (
            <div className="pt-2 text-center text-white/60" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em" }}>
              Every game picked · See you at puck-drop
            </div>
          )}
        </div>
      )}
    </div>
  );
}
