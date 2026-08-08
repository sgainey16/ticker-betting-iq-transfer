// StatCallouts — a "broadcast graphics" strip that pulses key stats while a
// segment is playing.
// -----------------------------------------------------------------------------
// Real broadcast production highlights on-screen graphics that match what the
// host is saying ("and Vegas hit 34% on the PP tonight" → 34% chip glows).
// We can't yet perfectly time-sync callouts to the audio (that needs
// timestamped scripts). What we CAN do today is cycle chips on a rotating
// loop while the segment plays. Feels like broadcast graphics; costs nothing.
//
// When real timed scripts land later, this component takes an optional
// `activeIndex` prop and highlights that specific chip. Same visual — real
// sync underneath.

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

export function StatCallouts({
  callouts,                 // [{ label, value, unit? }]
  active,                   // true → cycle through them; false → static
  intervalMs = 3400,
  activeIndex,              // optional: force which chip is highlighted (for real-timed sync)
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!active || activeIndex != null) return;
    const t = setInterval(() => setI(x => (x + 1) % (callouts?.length || 1)), intervalMs);
    return () => clearInterval(t);
  }, [active, callouts, intervalMs, activeIndex]);

  const highlighted = activeIndex != null ? activeIndex : i;

  if (!callouts?.length) return null;

  return (
    <div data-testid="stat-callouts" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {callouts.map((c, idx) => {
        const hot = active && idx === highlighted;
        return (
          <div
            key={idx}
            data-testid={`stat-callout-${idx}`}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all ${
              hot
                ? "bg-[#F58220]/15 border border-[#F58220] scale-[1.03]"
                : "bg-black/40 border border-white/10"
            }`}
            style={{ boxShadow: hot ? "0 0 12px -4px rgba(245,130,32,0.6)" : "none" }}
          >
            {hot && <Zap className="w-3 h-3 text-[#F58220]" />}
            <span style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "9px", letterSpacing: "0.24em", color: hot ? "#F58220" : "#a0a0a5" }}>
              {c.label}
            </span>
            <span className="tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", color: hot ? "#fff" : "#e5e5e7", lineHeight: 1 }}>
              {c.value}{c.unit || ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
