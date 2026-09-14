// Last Night — the grading surface for yesterday's (or today's, if
// dev-resolved) Tonight's 10 board.
//
// Honest empty state: if no board exists for the requested date (or nothing
// has been resolved yet), show a warm placeholder — do NOT render a wall of
// empty cards.
//
// Per-question result row: your pick vs the actual winner, with a right/wrong
// pill. Sources are strictly what the resolver wrote to iq_resolutions.

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { TeamLogo } from "@/lib/teamLogos";

function yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function LastNight({ deviceId }) {
  const [board, setBoard] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | empty | ready | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    // Try yesterday first (the real Last Night). If that 404s, try today —
    // useful during dev when we resolve the current board to demo the loop.
    const tryDates = [yesterdayISO(), todayISO()];
    (async () => {
      for (const d of tryDates) {
        try {
          const r = await api.get(
            `/iq/board?device_id=${encodeURIComponent(deviceId)}&board_date=${d}`
          );
          if (!live) return;
          const b = r.data;
          const anyResolved = (b.questions || []).some((q) => q.outcome != null);
          if (anyResolved) {
            setBoard(b);
            setStatus("ready");
            return;
          }
        } catch (_e) {
          // no board for that date — keep looking
        }
      }
      if (!live) return;
      setStatus("empty");
      setMessage("Nothing graded yet. As tonight's games finish, results land here.");
    })();
    return () => {
      live = false;
    };
  }, [deviceId]);

  if (status === "loading") {
    return (
      <div className="rounded-xl bg-black/30 border border-white/10 p-4 text-white/40 text-sm animate-pulse"
           data-testid="iq-last-night-loading">
        Reading last night…
      </div>
    );
  }
  if (status === "empty" || !board) {
    return (
      <div className="rounded-xl bg-black/25 border border-white/10 p-4" data-testid="iq-last-night-empty">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-3.5 h-3.5 text-white/40" />
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/50">
            Last night
          </div>
        </div>
        <div className="text-white/60 text-sm">{message}</div>
      </div>
    );
  }

  const total = board.questions.length;
  const correct = board.progress?.correct || 0;
  const graded = board.progress?.graded || 0;
  const pct = graded > 0 ? Math.round((correct / graded) * 100) : null;

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/50 to-[#050510]/60 border border-white/12 p-4"
         data-testid="iq-last-night-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#7fb0ff]">
            Last night · {board.board_date}
          </div>
          <div className="font-headline text-white text-[22px] leading-tight mt-0.5">
            {correct} / {graded}{" "}
            {pct != null && (
              <span className="text-white/50 text-[15px] ml-1">· {pct}%</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-accent text-[9px] uppercase tracking-[0.24em] text-white/40">
            of {total} calls
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {board.questions.map((q) => (
          <LastNightRow key={q.q_id} q={q} />
        ))}
      </div>
    </div>
  );
}

function LastNightRow({ q }) {
  const pick = q.locked_pick;
  const pickedCode = pick === "home" ? q.subject.home : pick === "away" ? q.subject.away : null;
  const winner = q.outcome?.actual?.winner;
  const winnerCode = winner === "home" ? q.subject.home : winner === "away" ? q.subject.away : null;
  const correct = q.outcome?.correct;

  return (
    <div
      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2 border-t border-white/6 first:border-t-0"
      data-testid={`iq-last-night-row-${q.q_id}`}
    >
      <div className="min-w-0">
        <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/45 mb-0.5">
          {q.subject.away} @ {q.subject.home}
        </div>
        <div className="flex items-center gap-1.5 text-[13px] text-white/85">
          {pick == null ? (
            <span className="text-white/40">No call</span>
          ) : (
            <>
              <TeamLogo code={pickedCode} size={16} />
              <span>You called <span className="font-headline text-white">{pickedCode}</span></span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        {winnerCode ? (
          <div className="flex items-center gap-1 text-[11px] text-white/55">
            <TeamLogo code={winnerCode} size={14} />
            <span className="font-accent uppercase tracking-widest text-[9px]">Won</span>
          </div>
        ) : (
          <span className="font-accent text-[9px] uppercase tracking-widest text-white/30">pending</span>
        )}
      </div>
      <div className="shrink-0">
        {correct === true && (
          <span className="inline-flex items-center gap-0.5 text-emerald-300 font-accent text-[10px] uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3" /> right
          </span>
        )}
        {correct === false && (
          <span className="inline-flex items-center gap-0.5 text-rose-300 font-accent text-[10px] uppercase tracking-widest">
            <XCircle className="w-3 h-3" /> miss
          </span>
        )}
        {correct == null && pick != null && (
          <span className="font-accent text-[10px] uppercase tracking-widest text-white/35">…</span>
        )}
      </div>
    </div>
  );
}
