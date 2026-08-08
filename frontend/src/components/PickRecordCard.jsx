// PickRecordCard — your pick history vs Reggie, Marc, and the Ticker Model.
// -----------------------------------------------------------------------------
// The daily-return hook. Every time you open Tonight you see:
//   • Your all-time W-L and accuracy %
//   • Your current streak
//   • How many times you've beaten Reggie and Marc
//   • A subtle nudge that this record IS the reason to come back
//
// Backend endpoint /api/predictions/me/{user_name} already returns everything
// we need. If the user is unauthenticated ("guest") we still show numbers —
// they'll accrue as guest until we add sign-in.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Trophy, TrendingUp, Target, Flame } from "lucide-react";

export function PickRecordCard({ userName = "guest" }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/predictions/me/${encodeURIComponent(userName)}`)
      .then(r => { if (!cancelled) setStats(r.data); })
      .catch(() => { if (!cancelled) setStats(null); });
    return () => { cancelled = true; };
  }, [userName]);

  if (!stats) return null;

  const {
    total = 0,
    resolved = 0,
    correct = 0,
    accuracy = 0,
    streak = 0,
    vs_panel = {},
  } = stats;

  // First-time state — friendly nudge, not empty numbers.
  const isEmpty = total === 0;

  const accuracyColor =
    accuracy >= 60 ? "#22c55e" :
    accuracy >= 50 ? "#F58220" :
    "#a0a0a5";

  return (
    <div
      data-testid="pick-record-card"
      className="rounded-xl border border-white/10 bg-gradient-to-r from-black/50 via-black/35 to-black/50 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-[#F58220]" />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
            Your record
          </span>
        </div>
        {!isEmpty && streak >= 2 && (
          <div className="inline-flex items-center gap-1 text-orange-400" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.24em" }}>
            <Flame className="w-3 h-3" /> {streak}-GAME STREAK
          </div>
        )}
      </div>

      {isEmpty ? (
        <div style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "15px", color: "#e5e5e7", lineHeight: 1.4 }}>
          You haven't made a pick yet — make your first tonight and Reggie & Marc will start tracking you against the panel.
        </div>
      ) : (
        <>
          {/* Big number row */}
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Target}     label="Accuracy" value={`${accuracy.toFixed(1)}%`} color={accuracyColor} />
            <Stat icon={TrendingUp} label="Correct"  value={`${correct}/${resolved}`} color="#fff" />
            <Stat icon={Trophy}     label="Picks"    value={String(total)}             color="#a0a0a5" />
          </div>

          {/* Panel comparison row */}
          <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between text-white/70 flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <PanelDelta label="Beat Reggie" count={vs_panel.beat_reggie ?? 0} tied={vs_panel.tie_reggie ?? 0} color="#F58220" />
              <PanelDelta label="Beat Marc"   count={vs_panel.beat_marc ?? 0}   tied={vs_panel.tie_marc ?? 0}   color="#1e5dff" />
            </div>
            <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.24em", color: "#a0a0a5" }}>
              {resolved} game{resolved === 1 ? "" : "s"} graded
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-white/40">
        <Icon className="w-3 h-3" />
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.24em" }}>{label}</span>
      </div>
      <div className="mt-0.5 tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "24px", color, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function PanelDelta({ label, count, tied, color }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "10px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
        {label}
      </span>
      <span className="tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff" }}>
        {count}
      </span>
      {tied > 0 && (
        <span className="text-white/40" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.2em" }}>
          · tied {tied}
        </span>
      )}
    </div>
  );
}
