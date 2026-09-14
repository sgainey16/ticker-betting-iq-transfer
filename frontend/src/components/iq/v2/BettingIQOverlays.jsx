// Betting IQ ↔ Best Ticker convergence — overlay components.
//
// These wrap the existing Best Ticker GameHub without modifying it.
// Each overlay is a small, self-contained Betting IQ contribution.
//
// Data honesty rules (from the convergence audit):
//   - Ticker IQ = editorial pre-model probability (game.ai_consensus).
//   - Community = real user prediction aggregate (game.community).
//   - Market   = REQUIRES a legitimate odds provider. Column stays LOCKED
//                until one is wired. No fabricated numbers.
//   - Intelligence lenses render only when their underlying data is real.
//     Every other planned lens is preserved in an internal registry so
//     it can slot in when a provider comes online, but it does NOT
//     appear on the customer-facing UI.

import { useEffect, useMemo, useState } from "react";
import { Lock, Info } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { teamGlow } from "@/lib/teamColors";
import { api } from "@/lib/api";

// -----------------------------------------------------------------
// Read Triangle · TICKER IQ | MARKET | COMMUNITY
// -----------------------------------------------------------------
export function ReadTriangle({ game }) {
  const away = game.away;
  const home = game.home;

  // Ticker IQ leg (editorial pre-model)
  const tickerPct = game.ai_consensus;
  const tickerSide = game.ai_consensus_side; // "home" | "away"
  const tickerCode = tickerSide === "home" ? home : away;

  // Community leg (real predictions)
  const roomTotal = game.community?.total || 0;
  const roomHomePct = game.community?.home_pct;
  const roomAwayPct = game.community?.away_pct;
  const roomHomeLead =
    roomHomePct != null && roomAwayPct != null && roomHomePct >= roomAwayPct;
  const roomCode = roomHomeLead ? home : away;
  const roomPct = roomHomeLead ? roomHomePct : roomAwayPct;

  return (
    <div
      className="rounded-xl border border-white/10 bg-black/35 p-3"
      data-testid="iq-read-triangle"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="font-accent"
          style={{
            fontFamily: "Oswald",
            fontWeight: 700,
            fontSize: "10px",
            letterSpacing: "0.32em",
            color: "#a0a0a5",
          }}
        >
          The Read
        </span>
        <span
          className="text-[8px] uppercase tracking-[0.24em] text-white/35"
          title="Ticker IQ + Community are prediction probabilities. Market shows real bookmaker-implied probability when wired."
        >
          Probability
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ReadLeg
          label="Ticker IQ"
          labelColor="#7fb0ff"
          value={tickerPct}
          code={tickerCode}
          provenance="Editorial · pre-model"
          testid="iq-read-triangle-ticker"
        />
        <ReadLegLocked
          label="Market"
          reason="Odds provider not connected"
          testid="iq-read-triangle-market"
        />
        <ReadLeg
          label="Community"
          labelColor="#c4b5fd"
          value={roomPct}
          code={roomPct != null ? roomCode : null}
          provenance={
            roomTotal
              ? `${roomTotal} pred${roomTotal === 1 ? "" : "s"}`
              : "No predictions yet"
          }
          testid="iq-read-triangle-community"
        />
      </div>
    </div>
  );
}

function ReadLeg({ label, labelColor, value, code, provenance, testid }) {
  const empty = value == null;
  return (
    <div
      className="rounded-lg border border-white/10 bg-black/30 p-2.5 flex flex-col items-center text-center"
      data-testid={testid}
    >
      <div
        className="font-accent uppercase"
        style={{
          fontFamily: "Oswald",
          fontWeight: 700,
          fontSize: "9px",
          letterSpacing: "0.28em",
          color: labelColor,
        }}
      >
        {label}
      </div>
      <div className="my-1.5 flex items-center justify-center gap-1.5">
        {code && (
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-md opacity-45"
              style={{ background: teamGlow(code) }}
            />
            <TeamLogo code={code} size={30} className="relative z-10" />
          </div>
        )}
        <span
          className="font-headline tabular-nums leading-none"
          style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "24px", color: empty ? "#4b5563" : "#fff" }}
        >
          {empty ? "—" : `${value}%`}
        </span>
      </div>
      <div className="text-[8px] uppercase tracking-[0.22em] text-white/40 leading-tight">
        {provenance}
      </div>
    </div>
  );
}

function ReadLegLocked({ label, reason, testid }) {
  return (
    <div
      className="rounded-lg border border-dashed border-white/10 bg-black/20 p-2.5 flex flex-col items-center text-center"
      data-testid={testid}
    >
      <div
        className="font-accent uppercase"
        style={{
          fontFamily: "Oswald",
          fontWeight: 700,
          fontSize: "9px",
          letterSpacing: "0.28em",
          color: "#6b7280",
        }}
      >
        {label}
      </div>
      <div className="my-1.5 flex items-center justify-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/10 px-2 py-1">
          <Lock className="w-3 h-3 text-white/40" />
          <span className="font-accent text-[8px] uppercase tracking-[0.28em] text-white/50">
            Not wired
          </span>
        </span>
      </div>
      <div className="text-[8px] uppercase tracking-[0.22em] text-white/40 leading-tight">
        {reason}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Intelligence Rail · nine planned lenses, only real ones surface
// -----------------------------------------------------------------
//
// Registry of the deep hockey intelligence engine. Each lens carries a
// `data_tier` per the convergence audit's availability legend. A lens
// appears in the UI ONLY when data_tier === "available" AND we have a
// real render body for it. Every other lens is preserved in code so
// the architecture remains visible as providers come online.
export const INTELLIGENCE_LENS_REGISTRY = [
  { key: "overview",        label: "Overview",        data_tier: "available" },
  { key: "offense",         label: "Offense",         data_tier: "derivable_low_fidelity" },
  { key: "defense",         label: "Defense",         data_tier: "derivable_low_fidelity" },
  { key: "transition",      label: "Transition",      data_tier: "requires_sportlogiq" },
  { key: "puck-management", label: "Puck Management", data_tier: "requires_sportlogiq" },
  { key: "possession",      label: "Possession",      data_tier: "requires_sportlogiq" },
  { key: "net-front",       label: "Net Front",       data_tier: "requires_sportlogiq" },
  { key: "special-teams",   label: "Special Teams",   data_tier: "derivable_pending_baseline" },
  { key: "goaltending",     label: "Goaltending",     data_tier: "available_basic" },
  { key: "discipline",      label: "Discipline",      data_tier: "available_basic" },
];

export function IntelligenceRail({ game, teamStats }) {
  const active = INTELLIGENCE_LENS_REGISTRY.filter((l) => l.data_tier === "available");
  const [lens, setLens] = useState(active[0]?.key || "overview");

  return (
    <div
      className="rounded-xl border border-white/10 bg-black/35 p-3"
      data-testid="iq-intelligence-rail"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="font-accent uppercase"
          style={{
            fontFamily: "Oswald",
            fontWeight: 700,
            fontSize: "10px",
            letterSpacing: "0.32em",
            color: "#a0a0a5",
          }}
        >
          Hockey Intelligence
        </span>
        <span
          className="text-[8px] uppercase tracking-[0.22em] text-white/35"
          title="More lenses appear when their underlying data is legitimate. Nothing is fabricated."
        >
          {active.length} live · {INTELLIGENCE_LENS_REGISTRY.length - active.length} pending providers
        </span>
      </div>

      {active.length > 1 && (
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1.5 -mx-1 px-1">
          {active.map((l) => {
            const isActive = l.key === lens;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLens(l.key)}
                data-testid={`iq-lens-tab-${l.key}`}
                className={`shrink-0 relative px-2.5 py-1 font-accent uppercase transition-colors ${
                  isActive ? "text-white" : "text-white/55 hover:text-white/85"
                }`}
                style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.24em" }}
              >
                {l.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-1.5 right-1.5 -bottom-px h-[2px] bg-[#1e5dff] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-1" data-testid={`iq-lens-body-${lens}`}>
        {lens === "overview" && (
          <OverviewLensBody game={game} teamStats={teamStats} />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Overview lens — the one lens with legitimate data today.
// A compact team-vs-team read using SportsData.io team stats already
// on the /predictions/games payload (via /stats/teams merge).
// -----------------------------------------------------------------
function OverviewLensBody({ game, teamStats }) {
  const home = game.home;
  const away = game.away;
  const homeAccent = teamGlow(home);
  const awayAccent = teamGlow(away);
  const h = teamStats[home] || {};
  const a = teamStats[away] || {};

  // Derive per-game rates from real season totals (never fabricated).
  const perGame = (num, den) =>
    typeof num === "number" && typeof den === "number" && den > 0 ? num / den : null;

  // Row definitions — every metric is either directly available or
  // derived from data we ship today. Nothing is a placeholder.
  const rows = [
    {
      label: "Record",
      home: h.w != null ? `${h.w}-${h.l}-${h.otl || 0}` : null,
      away: a.w != null ? `${a.w}-${a.l}-${a.otl || 0}` : null,
      hi: null,
    },
    {
      label: "Points",
      home: h.pts != null ? String(h.pts) : null,
      away: a.pts != null ? String(a.pts) : null,
      hiNum: [a.pts, h.pts],
      hi: "higher",
    },
    {
      label: "Goals / GP",
      home: perGame(h.gf, h.gp)?.toFixed(2),
      away: perGame(a.gf, a.gp)?.toFixed(2),
      hiNum: [perGame(a.gf, a.gp), perGame(h.gf, h.gp)],
      hi: "higher",
    },
    {
      label: "Goals Against / GP",
      home: perGame(h.ga, h.gp)?.toFixed(2),
      away: perGame(a.ga, a.gp)?.toFixed(2),
      hiNum: [perGame(a.ga, a.gp), perGame(h.ga, h.gp)],
      hi: "lower",
    },
    {
      label: "Goal Diff",
      home: h.gf != null && h.ga != null ? String(h.gf - h.ga) : null,
      away: a.gf != null && a.ga != null ? String(a.gf - a.ga) : null,
      hiNum: [
        a.gf != null && a.ga != null ? a.gf - a.ga : null,
        h.gf != null && h.ga != null ? h.gf - h.ga : null,
      ],
      hi: "higher",
    },
  ];

  const hasAny = rows.some((r) => r.home != null && r.away != null);
  if (!hasAny) {
    return (
      <div className="text-white/45 text-[12px] py-2">
        Team stats not available for this matchup yet.
      </div>
    );
  }

  return (
    <div className="pt-1" data-testid="iq-overview-lens">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-1.5 border-b border-white/8">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo code={away} size={32} />
          <span className="font-headline text-white text-[15px]">{away}</span>
        </div>
        <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/30">vs</span>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="font-headline text-white text-[15px]">{home}</span>
          <TeamLogo code={home} size={32} />
        </div>
      </div>
      <div className="divide-y divide-white/6">
        {rows.map((r) => {
          if (r.home == null || r.away == null) return null;
          let better = null;
          if (r.hi && Array.isArray(r.hiNum)) {
            const [an, hn] = r.hiNum;
            if (an != null && hn != null) {
              if (r.hi === "higher") better = hn > an ? "home" : hn < an ? "away" : "tie";
              if (r.hi === "lower")  better = hn < an ? "home" : hn > an ? "away" : "tie";
            }
          }
          return (
            <div
              key={r.label}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2"
              data-testid={`iq-overview-row-${r.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
            >
              <StatVal value={r.away} emphasized={better === "away"} align="left"  accent={awayAccent} />
              <div
                className="text-center px-2 font-accent uppercase"
                style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.24em", color: "#a0a0a5" }}
              >
                {r.label}
              </div>
              <StatVal value={r.home} emphasized={better === "home"} align="right" accent={homeAccent} />
            </div>
          );
        })}
      </div>
      <div className="pt-2 text-[8px] uppercase tracking-[0.22em] text-white/35">
        Verified · Season to date · Derived per-game rates from real GP/GF/GA
      </div>
    </div>
  );
}

function StatVal({ value, emphasized, align, accent }) {
  const alignCls = align === "right" ? "text-right" : "text-left";
  return (
    <div className={alignCls}>
      <span
        className="font-headline tabular-nums leading-none"
        style={{
          fontFamily: "Rajdhani",
          fontWeight: 700,
          fontSize: "15px",
          color: emphasized ? "#10b981" : "#fff",
          textShadow: emphasized ? `0 0 12px ${accent}55` : "none",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------
// MyCallState · shows the user's Tonight's 10 pick for THIS game
// -----------------------------------------------------------------
export function MyCallState({ deviceId, gameId }) {
  const [q, setQ] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | none | ready

  useEffect(() => {
    let live = true;
    api
      .get(`/iq/board?device_id=${encodeURIComponent(deviceId)}`)
      .then((r) => {
        if (!live) return;
        const found = (r.data.questions || []).find(
          (x) => x.subject?.game_id === gameId
        );
        if (found?.locked_call_id) {
          setQ(found);
          setStatus("ready");
        } else {
          setStatus("none");
        }
      })
      .catch(() => live && setStatus("none"));
    return () => {
      live = false;
    };
  }, [deviceId, gameId]);

  if (status !== "ready" || !q) return null;

  const pickedCode =
    q.locked_pick === "home" ? q.subject.home :
    q.locked_pick === "away" ? q.subject.away : null;
  const outcome = q.outcome;

  return (
    <div
      className="rounded-xl border border-[#1e5dff]/40 bg-[#0a1230]/50 px-3 py-2.5 flex items-center gap-3"
      data-testid="iq-my-call-state"
    >
      <div className="relative shrink-0">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-md opacity-50"
          style={{ background: teamGlow(pickedCode) }}
        />
        <TeamLogo code={pickedCode} size={32} className="relative z-10" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-accent uppercase"
          style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.32em", color: "#7fb0ff" }}
        >
          Your call · Tonight's 10
        </div>
        <div
          style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff" }}
        >
          You called {pickedCode}
        </div>
      </div>
      <div className="shrink-0">
        {outcome?.correct === true && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/60 px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest text-emerald-200">
            ✓ Right
          </span>
        )}
        {outcome?.correct === false && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/20 border border-rose-400/60 px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest text-rose-200">
            ✕ Miss
          </span>
        )}
        {!outcome && (
          <span className="inline-flex items-center rounded-full bg-[#1e5dff]/25 border border-[#1e5dff]/70 px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest text-[#9fb7ff]">
            Locked
          </span>
        )}
      </div>
    </div>
  );
}
