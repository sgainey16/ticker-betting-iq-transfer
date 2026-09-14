// Tonight's 10 — the phone-first fast prediction loop.
//
// UX principle: SEE → TAP → LOCK → NEXT.
//
// One full-viewport card at a time. Two big tappable team crests.
// A tap:
//   1) sends /iq/board/{id}/lock (reuses iq_calls + iq_events under the hood)
//   2) plays a ~450ms LOCKED confirmation
//   3) auto-advances to the next unlocked question
//
// Explicitly NOT here in the default loop (preserved as capability, not asked):
//   - Confidence slider
//   - "Why?" reasoning tags
//   - Per-pick visibility choice (uses saved default_visibility instead)
//
// Board size is honest: renders whatever the backend returned. If the real
// slate only supports 4 questions tonight, that is what the user plays.
//
// A completion screen closes the loop and points the user at Last Night for
// grading (or dev-resolve when IQ_DEV_MODE is on).

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { TeamLogo } from "@/lib/teamLogos";

const AUTO_ADVANCE_MS = 550;

export default function TonightsTenLoop({ deviceId, onExit, onComplete }) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [locking, setLocking] = useState(false);
  const [flash, setFlash] = useState(null); // { pick, code }
  const advanceTimer = useRef(null);

  useEffect(() => {
    let live = true;
    api
      .get(`/iq/board?device_id=${encodeURIComponent(deviceId)}`)
      .then((r) => {
        if (!live) return;
        setBoard(r.data);
        // Land on the first not-yet-locked question so returning users
        // resume where they left off.
        const first = (r.data.questions || []).findIndex((q) => !q.locked_call_id);
        setIdx(first === -1 ? (r.data.questions || []).length : first);
      })
      .catch((e) => setError(e?.response?.data?.detail || "Couldn't load tonight's card."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [deviceId]);

  const questions = board?.questions || [];
  const total = questions.length;
  const done = idx >= total;
  const current = !done ? questions[idx] : null;

  const progress = useMemo(() => {
    if (!board) return { locked: 0, total: 0 };
    return board.progress || { locked: 0, total };
  }, [board, total]);

  const handleLock = async (pickKey) => {
    if (!current || locking) return;
    if (current.locked_call_id) {
      // Already locked (e.g. user reopened) — just advance.
      setIdx((i) => i + 1);
      return;
    }
    const pickedCode = pickKey === "home" ? current.subject.home : current.subject.away;
    setLocking(true);
    setFlash({ pick: pickKey, code: pickedCode });
    try {
      const r = await api.post(`/iq/board/${board.id}/lock`, {
        device_id: deviceId,
        q_id: current.q_id,
        pick: pickKey,
      });
      setBoard(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Couldn't lock that call.");
      setLocking(false);
      setFlash(null);
      return;
    }
    advanceTimer.current = setTimeout(() => {
      setFlash(null);
      setLocking(false);
      setIdx((i) => i + 1);
    }, AUTO_ADVANCE_MS);
  };

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center text-white/40 font-accent text-[10px] uppercase tracking-[0.28em]"
           data-testid="iq-tonights10-loading">
        Loading tonight's card…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-black/40 border border-rose-400/30 p-4 text-rose-200 text-sm" data-testid="iq-tonights10-error">
        {error}
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-xl bg-black/40 border border-white/10 p-6 text-center" data-testid="iq-tonights10-empty">
        <div className="font-headline text-white text-lg mb-1">No games on tonight.</div>
        <div className="text-white/55 text-sm">Come back at puck drop — your card lands automatically.</div>
      </div>
    );
  }

  if (done) {
    return (
      <CompletionScreen
        board={board}
        onReplay={() => setIdx(Math.max(0, questions.findIndex((q) => !q.locked_call_id)))}
        onExit={() => onComplete?.() || onExit?.()}
      />
    );
  }

  const awayCode = current.subject.away;
  const homeCode = current.subject.home;

  return (
    <div className="relative min-h-[70vh] flex flex-col" data-testid={`iq-tonights10-card-${current.q_id}`}>
      {/* Top bar: progress + exit */}
      <div className="flex items-center gap-3 pt-1 pb-3">
        <button
          type="button"
          onClick={onExit}
          data-testid="iq-tonights10-exit"
          className="text-white/50 hover:text-white/90 transition-colors inline-flex items-center gap-1 font-accent text-[9px] uppercase tracking-[0.28em]"
        >
          <ChevronLeft className="w-3 h-3" /> My IQ
        </button>
        <div className="flex-1">
          <ProgressBar current={idx + 1} total={total} lockedCount={progress.locked} />
        </div>
        <div className="font-headline text-white/85 text-[13px] tabular-nums">
          <span className="text-white">{idx + 1}</span>
          <span className="text-white/35"> / {total}</span>
        </div>
      </div>

      {/* Matchup label */}
      <div className="text-center pt-2 pb-1">
        <div className="font-accent text-[10px] uppercase tracking-[0.34em] text-white/45">
          {awayCode} @ {homeCode}
        </div>
      </div>

      {/* Prompt */}
      <div className="text-center pt-1 pb-6">
        <div className="font-headline text-white text-[26px] leading-[1.1] tracking-tight">
          {current.prompt}
        </div>
      </div>

      {/* Two tappable crests — large, obvious, but the prompt is the star */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        <PickTile
          code={awayCode}
          side="away"
          selected={flash?.pick === "away"}
          disabled={locking}
          onClick={() => handleLock("away")}
        />
        <PickTile
          code={homeCode}
          side="home"
          selected={flash?.pick === "home"}
          disabled={locking}
          onClick={() => handleLock("home")}
        />
      </div>

      {/* Small footer — no confidence, no "why", no visibility toggle. */}
      <div className="pt-4 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          data-testid="iq-tonights10-prev"
          className="inline-flex items-center gap-1 text-white/40 hover:text-white/85 disabled:opacity-30 font-accent text-[9px] uppercase tracking-[0.28em] transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> Prev
        </button>
        <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/30">
          Tap a logo to lock
        </div>
        <button
          type="button"
          onClick={() => setIdx((i) => Math.min(total, i + 1))}
          data-testid="iq-tonights10-skip"
          className="inline-flex items-center gap-1 text-white/40 hover:text-white/85 font-accent text-[9px] uppercase tracking-[0.28em] transition-colors"
        >
          Skip <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Full-screen locked flash */}
      {flash && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-sm rounded-lg pointer-events-none"
          data-testid="iq-tonights10-locked-flash"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-2xl opacity-70"
                style={{ background: "#1e5dff" }}
              />
              <TeamLogo code={flash.code} size={88} className="relative z-10" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#1e5dff] px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span className="font-accent text-[11px] uppercase tracking-[0.32em] text-white">
                {flash.code} locked
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ current, total, lockedCount }) {
  const cells = Array.from({ length: total });
  return (
    <div className="flex items-center gap-1" data-testid="iq-tonights10-progress">
      {cells.map((_, i) => {
        const isPast = i < lockedCount;
        const isCurrent = i === current - 1;
        return (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors ${
              isPast ? "bg-[#1e5dff]" : isCurrent ? "bg-white/45" : "bg-white/12"
            }`}
          />
        );
      })}
    </div>
  );
}

function PickTile({ code, side, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={`iq-tonights10-pick-${side}-${code}`}
      className={`group relative rounded-2xl border transition-all overflow-hidden ${
        selected
          ? "bg-[#1e5dff]/12 border-[#1e5dff]"
          : "bg-black/55 border-white/12 hover:border-[#1e5dff]/60 hover:bg-white/[0.03]"
      } ${disabled ? "cursor-default" : "cursor-pointer active:scale-[0.985]"}`}
      style={{ minHeight: "42vh" }}
    >
      <span
        aria-hidden
        className={`absolute inset-0 pointer-events-none transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        }`}
        style={{
          background:
            "radial-gradient(60% 65% at 50% 45%, rgba(30,93,255,0.28), transparent 70%)",
        }}
      />
      <div className="relative z-10 h-full flex flex-col items-center justify-center gap-3 px-4">
        <TeamLogo
          code={code}
          size={128}
          className="drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
        />
        <div className="font-headline text-white text-[18px] tracking-[0.22em]">
          {code}
        </div>
      </div>
    </button>
  );
}

function CompletionScreen({ board, onReplay, onExit }) {
  const total = board.questions?.length || 0;
  const locked = board.progress?.locked || 0;
  const allLocked = locked === total && total > 0;
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4"
      data-testid="iq-tonights10-completion"
    >
      <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#1e5dff]/15 border border-[#1e5dff]/40">
        <Sparkles className="w-7 h-7 text-[#7fb0ff]" />
      </div>
      <div className="font-headline text-white text-[24px] leading-tight mb-1.5">
        {allLocked ? "Locked in." : `${locked} / ${total} locked.`}
      </div>
      <div className="text-white/60 text-sm max-w-xs mb-6">
        {allLocked
          ? "See you tomorrow — Ticker grades everything as the games finish. Your record starts building tonight."
          : "You can come back and finish tonight's card any time before puck drop."}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {!allLocked && (
          <button
            onClick={onReplay}
            data-testid="iq-tonights10-finish"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[10px] uppercase tracking-[0.32em] transition-colors"
          >
            Finish the card
          </button>
        )}
        <button
          onClick={onExit}
          data-testid="iq-tonights10-back-my-iq"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-accent text-[10px] uppercase tracking-[0.32em] transition-colors"
        >
          Back to My IQ
        </button>
      </div>
    </div>
  );
}
