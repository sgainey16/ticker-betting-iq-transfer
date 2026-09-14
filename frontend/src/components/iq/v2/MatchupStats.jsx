// Tonight V3 comparative matchup stats.
// Uses REAL LIVE SportsData.io data via GET /api/nhl/standings.
// Fields displayed today (all verified live in the current feed):
//   - Record  (W-L-OTL)
//   - Points  (computed W*2 + OTL, standard NHL)
//   - Points percentage
//   - Conference rank
//   - Division rank
//
// Explicitly NOT rendered because the current feed does NOT expose them:
//   - Last 10, PP%, PK%, GF/GA, home/road W-L, xG, shots for/against
// Grammar accepts extra rows via the STAT_ROWS registry — future live
// feeds plug in without redesign, and rows only render when both teams
// have a real value.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TeamLogo } from "@/lib/teamLogos";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

// Registry of stat rows. Each row picks its values from a standings row.
// Return null when data is missing → row hides itself entirely (never
// fabricated). `better` returns "away" | "home" | "tie" | null.
const STAT_ROWS = [
  {
    key: "record",
    label: "Record",
    get: (t) =>
      t && t.Wins != null
        ? `${t.Wins}-${t.Losses}-${t.OvertimeLosses || 0}`
        : null,
    numeric: (t) =>
      t && t.Wins != null ? (t.Wins * 2 + (t.OvertimeLosses || 0)) : null,
  },
  {
    key: "points",
    label: "Points",
    get: (t) =>
      t && t.Wins != null
        ? String(t.Wins * 2 + (t.OvertimeLosses || 0))
        : null,
    numeric: (t) =>
      t && t.Wins != null ? t.Wins * 2 + (t.OvertimeLosses || 0) : null,
  },
  {
    key: "pct",
    label: "Points %",
    get: (t) =>
      t?.Percentage != null ? `.${Math.round(t.Percentage * 1000).toString().padStart(3, "0")}` : null,
    numeric: (t) => (t?.Percentage != null ? t.Percentage : null),
  },
  {
    key: "confRank",
    label: "Conference rank",
    get: (t) => (t?.ConferenceRank != null ? `#${t.ConferenceRank}` : null),
    numeric: (t) => (t?.ConferenceRank != null ? -t.ConferenceRank : null), // lower rank = better
  },
  {
    key: "divRank",
    label: "Division rank",
    get: (t) => (t?.DivisionRank != null ? `#${t.DivisionRank}` : null),
    numeric: (t) => (t?.DivisionRank != null ? -t.DivisionRank : null),
  },
];

function chooseBetter(awayVal, homeVal) {
  if (awayVal == null || homeVal == null) return null;
  if (awayVal === homeVal) return "tie";
  return awayVal > homeVal ? "away" : "home";
}

export default function MatchupStats({ awayCode, homeCode, awayAccent, homeAccent }) {
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get("/nhl/standings")
      .then((r) => {
        if (!alive) return;
        setStandings(r.data.teams || []);
        setLive(!!r.data.live);
      })
      .catch(() => alive && setStandings([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div
        className="text-white/40 font-accent text-[10px] uppercase tracking-[0.28em] py-3"
        data-testid="iq-matchup-stats-loading"
      >
        Reading tonight's standings…
      </div>
    );
  }

  const away = standings?.find((t) => t.Key === awayCode || t.code === awayCode);
  const home = standings?.find((t) => t.Key === homeCode || t.code === homeCode);

  if (!away || !home) {
    return (
      <div
        className="text-white/45 text-[12px] py-3"
        data-testid="iq-matchup-stats-missing"
      >
        Season standings not available for this matchup.
      </div>
    );
  }

  return (
    <div className="pt-1" data-testid="iq-matchup-stats">
      {/* Header row: logos + tiny provenance */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/50">
          Season comparison
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-accent text-[8px] uppercase tracking-[0.24em] border ${
            live
              ? "bg-emerald-400/10 border-emerald-400/35 text-emerald-200"
              : "bg-white/[0.03] border-white/12 text-white/45"
          }`}
        >
          <span
            className={`h-1 w-1 rounded-full ${
              live ? "bg-emerald-300" : "bg-white/40"
            }`}
          />
          {live ? "Live" : "Cached"}
        </span>
      </div>

      {/* Column headers with team logos */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-2 border-b border-white/8">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo code={awayCode} size={24} />
          <span className="font-headline text-white text-[14px] tracking-wide truncate">
            {awayCode}
          </span>
        </div>
        <span className="font-accent text-[9px] uppercase tracking-[0.32em] text-white/30">
          vs
        </span>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="font-headline text-white text-[14px] tracking-wide truncate">
            {homeCode}
          </span>
          <TeamLogo code={homeCode} size={24} />
        </div>
      </div>

      {/* Comparison rows — thin dividers, no boxes per row */}
      <div className="divide-y divide-white/6">
        {STAT_ROWS.map((row) => {
          const aVal = row.get(away);
          const hVal = row.get(home);
          if (aVal == null || hVal == null) return null;
          const aNum = row.numeric(away);
          const hNum = row.numeric(home);
          const better = chooseBetter(aNum, hNum);

          return (
            <div
              key={row.key}
              data-testid={`iq-stat-${row.key}`}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2"
            >
              <StatValue
                value={aVal}
                emphasized={better === "away"}
                dimmed={better === "home"}
                align="left"
                accent={awayAccent}
              />
              <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/40 text-center px-2">
                {row.label}
              </div>
              <StatValue
                value={hVal}
                emphasized={better === "home"}
                dimmed={better === "away"}
                align="right"
                accent={homeAccent}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatValue({ value, emphasized, dimmed, align, accent }) {
  const alignCls = align === "right" ? "justify-end text-right" : "justify-start text-left";
  const emphColor = emphasized ? "text-emerald-300" : dimmed ? "text-white/40" : "text-white";
  return (
    <div className={`flex items-center gap-1.5 ${alignCls}`}>
      {emphasized && align === "right" && (
        <ArrowUp className="w-3 h-3 text-emerald-300" strokeWidth={2.5} />
      )}
      <span
        className={`font-headline text-[16px] tabular-nums leading-none ${emphColor}`}
        style={emphasized ? { textShadow: `0 0 12px ${accent}55` } : undefined}
      >
        {value}
      </span>
      {emphasized && align === "left" && (
        <ArrowUp className="w-3 h-3 text-emerald-300" strokeWidth={2.5} />
      )}
    </div>
  );
}
