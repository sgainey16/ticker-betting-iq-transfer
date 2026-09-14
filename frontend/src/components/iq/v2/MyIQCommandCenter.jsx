// My IQ — LOGOS. REGGIE. MARC. FUN.
//
// Design brief:
//   - Not a dashboard. A daily hockey game.
//   - Team crests, team-color atmosphere, host banter, movement.
//   - Tonight's 10 is the hero — no generic Play-circle, real matchups.
//   - Reggie + Marc host the page. Two-voice, state-aware, playful.
//   - After the hero, everything is visually secondary and compact.
//   - No "Your IQ is building" explainer paragraphs. No "Coming soon" cards.
//
// Backend contract untouched. All fetches identical to the previous slice.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { TeamLogo } from "@/lib/teamLogos";
import { teamGlow } from "@/lib/teamColors";
import HostPortrait from "@/components/HostPortrait";
import TonightsTenLoop from "./TonightsTenLoop";

export default function MyIQCommandCenter({ deviceId }) {
  const [board, setBoard] = useState(null);
  const [lastNight, setLastNight] = useState(null);
  const [brief, setBrief] = useState(null);
  const [devMode, setDevMode] = useState(false);
  const [inLoop, setInLoop] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    api.get(`/iq/board?device_id=${encodeURIComponent(deviceId)}`)
       .then((r) => setBoard(r.data))
       .catch(() => setBoard(null));
    api.get(`/iq/user/brief?device_id=${encodeURIComponent(deviceId)}`)
       .then((r) => setBrief(r.data))
       .catch(() => {});
    // Last night — try yesterday, fall back to today
    const y = new Date(); y.setUTCDate(y.getUTCDate() - 1);
    const yd = y.toISOString().slice(0, 10);
    const td = new Date().toISOString().slice(0, 10);
    (async () => {
      for (const d of [yd, td]) {
        try {
          const r = await api.get(`/iq/board?device_id=${encodeURIComponent(deviceId)}&board_date=${d}`);
          const graded = (r.data.questions || []).some((q) => q.outcome != null);
          if (graded) { setLastNight(r.data); return; }
        } catch (_) {}
      }
      setLastNight(null);
    })();
  };

  useEffect(() => {
    refresh();
    api.get("/iq/dev/mode").then((r) => setDevMode(!!r.data?.enabled)).catch(() => {});
  }, [deviceId]);  // eslint-disable-line

  if (inLoop) {
    return (
      <TonightsTenLoop
        deviceId={deviceId}
        onExit={() => { setInLoop(false); refresh(); }}
        onComplete={() => { setInLoop(false); refresh(); }}
      />
    );
  }

  const questions = board?.questions || [];
  const total = questions.length;
  const locked = board?.progress?.locked || 0;
  const graded = board?.progress?.graded || 0;
  const totalResolved = brief?.accuracy_summary?.total_resolved || 0;

  // State drives host banter + hero label
  const state = (() => {
    if (total === 0) return "empty";
    if (locked === 0) return "before";
    if (locked < total) return "during";
    if (locked === total && graded === 0) return "after";
    return "graded";
  })();

  const runDevResolve = async () => {
    if (!board?.id) return;
    setDevBusy(true);
    try {
      await api.post(`/iq/board/${board.id}/resolve?device_id=${encodeURIComponent(deviceId)}`);
      refresh();
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="iq-my-iq" key={refreshKey}>
      {/* HOSTS — Reggie & Marc set the tone. Two voices, playful. */}
      <HostBanter state={state} locked={locked} total={total} graded={graded} lastNight={lastNight} />

      {/* HERO — Tonight's 10. Real matchups, real crests, team-color energy. */}
      <TonightsTenHero
        questions={questions}
        locked={locked}
        total={total}
        state={state}
        onPlay={() => setInLoop(true)}
      />

      {/* SECONDARY — Last Night result strip. Only if we actually have grades. */}
      {lastNight && <LastNightStrip board={lastNight} />}

      {/* SECONDARY — My IQ accuracy strip. Only surfaces once sample ≥ 10. */}
      {totalResolved >= 10 && (
        <MyIQProgressStrip total={totalResolved} pct={brief?.accuracy_summary?.accuracy_pct} />
      )}

      {/* SECONDARY — My Bets. Tiny nav, not a card. */}
      <MyBetsLink />

      {/* DEV — only in dev mode */}
      {devMode && (
        <button
          onClick={runDevResolve}
          disabled={devBusy || !board?.id}
          data-testid="iq-dev-resolve-run"
          className="w-full text-white/40 hover:text-white/70 disabled:opacity-30 font-accent text-[9px] uppercase tracking-[0.32em] py-2 border-t border-white/8 transition-colors"
        >
          {devBusy ? "Grading tonight…" : "· dev · grade tonight's card"}
        </button>
      )}
    </div>
  );
}

// ============================================================
// HOSTS
// ============================================================
function HostBanter({ state, locked, total, graded, lastNight }) {
  // Two-voice hockey banter. Short. Playful. No paragraphs.
  const lines = useMemo(() => {
    // If Last Night was graded, lead with a react.
    if (lastNight && lastNight.progress?.graded > 0) {
      const c = lastNight.progress.correct;
      const g = lastNight.progress.graded;
      if (c === g) {
        return {
          reggie: `Perfect card last night. ${c}/${g}.`,
          marc:   "Lucky. Do it again.",
        };
      }
      if (c === 0) {
        return {
          reggie: `Rough night — 0/${g}.`,
          marc:   "Sample of one. Shake it off, play tonight.",
        };
      }
      const pct = Math.round((c / g) * 100);
      return {
        reggie: `${c}/${g} last night. ${pct}%.`,
        marc:   pct >= 60 ? "That's a read. Keep going." : "Middle of the pack. Let's see tonight.",
      };
    }
    if (state === "empty") {
      return {
        reggie: "No slate tonight.",
        marc:   "Rest day. Come back when the puck drops.",
      };
    }
    if (state === "before") {
      return {
        reggie: `${total} on the board tonight. You ready?`,
        marc:   "Let's see if you actually know what you're talking about.",
      };
    }
    if (state === "during") {
      return {
        reggie: `${locked}/${total} down. Finish it.`,
        marc:   "Don't overthink the last few.",
      };
    }
    if (state === "after") {
      return {
        reggie: "Card locked. Nice work.",
        marc:   "Come back when the games finish. That's when we find out.",
      };
    }
    return {
      reggie: "Card in. Games rolling.",
      marc:   "Grading as they finish.",
    };
  }, [state, locked, total, graded, lastNight]);

  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-[#0a1230] via-[#050a1a] to-[#050510] border border-white/10 px-3 py-3.5"
      data-testid="iq-host-banter"
    >
      <div className="grid grid-cols-[52px_1fr] gap-3 items-start">
        <HostPortrait persona="reggie" size={52} showName={false} className="rounded-lg" />
        <div className="pt-0.5">
          <div className="font-accent text-[9px] uppercase tracking-[0.32em] text-[#7fb0ff]">Reggie</div>
          <div className="font-headline text-white text-[16px] leading-snug">{lines.reggie}</div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_52px] gap-3 items-start mt-2.5">
        <div className="pt-0.5 text-right">
          <div className="font-accent text-[9px] uppercase tracking-[0.32em] text-[#7de9ff]">Marc</div>
          <div className="font-headline text-white text-[16px] leading-snug">{lines.marc}</div>
        </div>
        <HostPortrait persona="marc" size={52} showName={false} mirror className="rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================
// HERO — Tonight's 10
// ============================================================
function TonightsTenHero({ questions, locked, total, state, onPlay }) {
  const empty = total === 0;
  const complete = !empty && locked === total;

  return (
    <div className="space-y-3" data-testid="iq-tonights10-tile">
      {/* Chip counter + label */}
      <div className="flex items-baseline justify-between px-1">
        <div className="font-accent text-[10px] uppercase tracking-[0.36em] text-[#7fb0ff]">
          Tonight's 10
        </div>
        {!empty && (
          <div className="font-headline text-white text-[13px] tabular-nums">
            <span className="text-white">{locked}</span>
            <span className="text-white/40"> / {total}</span>
          </div>
        )}
      </div>

      {/* Horizontal matchup rail — real crests, real team-color atmosphere */}
      {empty ? (
        <EmptySlate />
      ) : (
        <div
          className="-mx-3 sm:mx-0 overflow-x-auto no-scrollbar snap-x snap-mandatory"
          data-testid="iq-tonights10-rail"
        >
          <div className="flex gap-2.5 px-3 sm:px-0 pb-1">
            {questions.map((q) => (
              <MatchupChip key={q.q_id} q={q} onTap={onPlay} />
            ))}
          </div>
        </div>
      )}

      {/* Primary CTA — a pill, not a giant Play button */}
      {!empty && (
        <button
          type="button"
          onClick={onPlay}
          data-testid="iq-tonights10-play"
          className="w-full inline-flex items-center justify-between rounded-full pl-5 pr-2 py-2.5 bg-[#1e5dff] hover:bg-[#3574ff] text-white shadow-[0_16px_44px_-16px_rgba(30,93,255,0.9)] transition-colors"
        >
          <span className="font-accent text-[11px] uppercase tracking-[0.36em]">
            {complete ? "Review my card" : locked > 0 ? "Continue" : "Play tonight's 10"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-accent text-[10px] uppercase tracking-[0.28em]">
            {locked}/{total}
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}
    </div>
  );
}

function MatchupChip({ q, onTap }) {
  const away = q.subject.away;
  const home = q.subject.home;
  const awayGlow = teamGlow(away);
  const homeGlow = teamGlow(home);
  const pickedSide = q.locked_pick;   // "home" | "away" | null
  const locked = !!q.locked_call_id;
  const outcome = q.outcome;

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={`iq-matchup-chip-${q.q_id}`}
      className={`snap-start shrink-0 relative rounded-2xl border overflow-hidden transition-all ${
        locked ? "border-[#1e5dff]/60" : "border-white/12 hover:border-white/25"
      }`}
      style={{ width: "244px", height: "146px" }}
    >
      {/* Team-color atmosphere — real hockey glow */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${awayGlow}33 0%, transparent 45%, transparent 55%, ${homeGlow}33 100%)`,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-24 blur-2xl opacity-70 pointer-events-none"
        style={{ background: `radial-gradient(60% 100% at 0% 50%, ${awayGlow}, transparent 70%)` }}
      />
      <span
        aria-hidden
        className="absolute inset-y-0 right-0 w-24 blur-2xl opacity-70 pointer-events-none"
        style={{ background: `radial-gradient(60% 100% at 100% 50%, ${homeGlow}, transparent 70%)` }}
      />
      <span aria-hidden className="absolute inset-0 bg-black/55 pointer-events-none" />

      {/* Foreground — two big crests, small VS, status pip */}
      <div className="relative h-full flex items-center justify-between px-4">
        <div className={`flex flex-col items-center gap-1 transition-opacity ${
          pickedSide === "home" ? "opacity-40" : "opacity-100"
        }`}>
          <TeamLogo code={away} size={64} className="drop-shadow-[0_6px_20px_rgba(0,0,0,0.7)]" />
          <div className="font-headline text-white/85 text-[11px] tracking-[0.22em]">{away}</div>
        </div>
        <div className="font-accent text-[10px] uppercase tracking-[0.36em] text-white/45">vs</div>
        <div className={`flex flex-col items-center gap-1 transition-opacity ${
          pickedSide === "away" ? "opacity-40" : "opacity-100"
        }`}>
          <TeamLogo code={home} size={64} className="drop-shadow-[0_6px_20px_rgba(0,0,0,0.7)]" />
          <div className="font-headline text-white/85 text-[11px] tracking-[0.22em]">{home}</div>
        </div>
      </div>

      {/* Status pip — top-right */}
      <div className="absolute top-2 right-2">
        {outcome?.correct === true && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 px-1.5 py-0.5 font-accent text-[8px] uppercase tracking-widest text-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" /> right
          </span>
        )}
        {outcome?.correct === false && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/20 border border-rose-400/60 px-1.5 py-0.5 font-accent text-[8px] uppercase tracking-widest text-rose-200">
            <XCircle className="w-2.5 h-2.5" /> miss
          </span>
        )}
        {!outcome && locked && (
          <span className="inline-flex items-center rounded-full bg-[#1e5dff]/25 border border-[#1e5dff]/70 px-1.5 py-0.5 font-accent text-[8px] uppercase tracking-widest text-[#9fb7ff]">
            locked
          </span>
        )}
      </div>
    </button>
  );
}

function EmptySlate() {
  return (
    <div className="rounded-2xl bg-black/25 border border-white/10 p-5 text-center" data-testid="iq-empty-slate">
      <div className="font-headline text-white/70 text-[15px]">No games tonight.</div>
      <div className="text-white/45 text-[12px] mt-1">Card lands automatically when the puck drops.</div>
    </div>
  );
}

// ============================================================
// SECONDARY STRIPS
// ============================================================
function LastNightStrip({ board }) {
  const c = board.progress?.correct || 0;
  const g = board.progress?.graded || 0;
  const pct = g > 0 ? Math.round((c / g) * 100) : null;

  return (
    <div className="space-y-2" data-testid="iq-last-night-strip">
      <div className="flex items-baseline justify-between px-1">
        <div className="font-accent text-[10px] uppercase tracking-[0.36em] text-white/55">
          Last night
        </div>
        <div className="font-headline text-white text-[13px] tabular-nums">
          <span className="text-white">{c}</span>
          <span className="text-white/40"> / {g}</span>
          {pct != null && <span className="text-white/50 text-[12px] ml-1.5">· {pct}%</span>}
        </div>
      </div>
      <div
        className="-mx-3 sm:mx-0 overflow-x-auto no-scrollbar"
        data-testid="iq-last-night-pips"
      >
        <div className="flex gap-2 px-3 sm:px-0 pb-0.5 pt-0.5">
          {board.questions.map((q) => (
            <ResultPip key={q.q_id} q={q} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultPip({ q }) {
  const pick = q.locked_pick;
  const pickedCode = pick === "home" ? q.subject.home : pick === "away" ? q.subject.away : null;
  const correct = q.outcome?.correct;
  const glow = pickedCode ? teamGlow(pickedCode) : "#4b5563";

  return (
    <div
      data-testid={`iq-last-night-pip-${q.q_id}`}
      className={`relative shrink-0 rounded-full border w-[54px] h-[54px] flex items-center justify-center ${
        correct === true
          ? "border-emerald-400/70"
          : correct === false
            ? "border-rose-400/70"
            : "border-white/15"
      }`}
      style={{
        background: pickedCode
          ? `radial-gradient(50% 50% at 50% 50%, ${glow}66, transparent 70%)`
          : "transparent",
      }}
    >
      {pickedCode ? (
        <TeamLogo code={pickedCode} size={34} />
      ) : (
        <span className="font-accent text-[8px] uppercase tracking-widest text-white/35">skip</span>
      )}
      {correct === true && (
        <CheckCircle2 className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-emerald-300 bg-[#050510] rounded-full" />
      )}
      {correct === false && (
        <XCircle className="absolute -bottom-1 -right-1 w-3.5 h-3.5 text-rose-300 bg-[#050510] rounded-full" />
      )}
    </div>
  );
}

function MyIQProgressStrip({ total, pct }) {
  return (
    <div
      className="flex items-baseline justify-between rounded-xl bg-black/25 border border-white/10 px-3 py-2"
      data-testid="iq-progress-strip"
    >
      <div className="font-accent text-[10px] uppercase tracking-[0.36em] text-white/55">
        My IQ
      </div>
      <div className="font-headline text-white text-[15px] tabular-nums">
        {pct != null ? `${pct}%` : "—"}
        <span className="text-white/45 text-[11px] ml-1.5">· {total} graded</span>
      </div>
    </div>
  );
}

function MyBetsLink() {
  return (
    <Link
      to="/back-office"
      data-testid="iq-my-bets-tile"
      className="flex items-center justify-between px-3 py-2 rounded-lg text-white/50 hover:text-white/85 hover:bg-white/[0.03] transition-colors"
    >
      <span className="font-accent text-[10px] uppercase tracking-[0.32em]">My bets</span>
      <ArrowUpRight className="w-3.5 h-3.5" />
    </Link>
  );
}
