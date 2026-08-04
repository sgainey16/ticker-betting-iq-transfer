import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChevronDown } from "lucide-react";

// Post-Game Stats — simple two-column comparison.
//   `<away>   Label   <home>`
// PRIMARY rows show on first tap. SECONDARY rows only after "Show more".
// One game at a time — follows whatever segment is currently on-air.

// The full box score, grouped so nothing feels crammed. The PRIMARY set
// shows on the very first tap — the "at-a-glance" numbers a fan actually
// discusses. SECONDARY unfolds on "Show more" for the deeper crowd. We're
// deliberately generous with what's included — hockey stats are fun to
// read, and the format is dead simple.
// PRIMARY: the five headline metrics — "translate data into meaning" set.
// Hits + Power Play were dropped from top-level per product direction
// (Hits over-index in perceived importance vs. actual game impact) and
// live under SECONDARY now.
//
// `derived: true` = read from the backend's `derived.{home,away}` block
// (Ticker Model estimates — Highlightly doesn't publish xG or HDCF).
const PRIMARY = [
  { key: "Shots",                 label: "Shots on Goal" },
  { key: "xg",                    label: "Expected Goals",  derived: true, tag: "MODEL",
    fmt: (v) => v == null ? "—" : Number(v).toFixed(1) },
  { key: "hdc",                   label: "High-Danger",     derived: true, tag: "MODEL" },
  { key: "scoring_chances",       label: "Scoring Chances", derived: true },
  { key: "Faceoff Win Percent",   label: "Faceoffs",   fmt: (v) => v == null ? "—" : `${Number(v).toFixed(0)}%` },
];

const SECONDARY = [
  { key: "Hits",                  label: "Hits" },
  { key: "__pp_ratio__",          label: "Power Play", derivedFmt: (own) => {
      const g = own?.["Power Play Goals"];
      const opp = own?.["Power Play Opportunities"];
      if (g == null || opp == null) return "—";
      return `${Number(g)}/${Number(opp)}`;
    } },
  { key: "Blocked Shots",         label: "Blocked Shots" },
  { key: "Power Play Percentage", label: "PP %",       fmt: (v) => v == null ? "—" : `${Number(v).toFixed(0)}%` },
  { key: "Short Handed Goals",    label: "Shorthanded Goals" },
  { key: "Takeaways",             label: "Takeaways" },
  { key: "Giveaways",             label: "Giveaways" },
  { key: "Total Penalties",       label: "Penalties" },
  { key: "Penalty Minutes",       label: "Penalty Minutes" },
];

const _cache = new Map(); // match_id → response

export default function PostGameStats({ segment }) {
  const matchId = segment?.match_id;
  const [open, setOpen] = useState(true);
  const [data, setData] = useState(() => _cache.get(matchId) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    if (_cache.has(matchId)) { setData(_cache.get(matchId)); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/recap-show/post-game-stats?match_id=${matchId}`)
      .then((r) => { if (!cancelled) { _cache.set(matchId, r.data); setData(r.data); } })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [matchId]);

  if (!segment) return null;
  const away = segment.away || {};
  const home = segment.home || {};

  return (
    <section
      className="rounded-2xl border border-[#2d2d35] bg-[#0b0b10] overflow-hidden landscape:rounded-none landscape:border-x-0"
      data-testid="post-game-stats-panel"
    >
      {/* Tappable header — matchup + score + chevron */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors"
        data-testid="post-game-stats-toggle"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1E5BFF]">
            Post-Game Stats
          </div>
          <div className="hidden sm:flex items-center gap-2.5">
            {away.logo_url && <img src={away.logo_url} alt={away.code} className="w-8 h-8 object-contain" />}
            <span className="font-headline text-white text-base">{data?.score?.current || "Final"}</span>
            {home.logo_url && <img src={home.logo_url} alt={home.code} className="w-8 h-8 object-contain" />}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[#2d2d35] px-4 py-4" data-testid="post-game-stats-body">
          {loading && !data && (
            <div className="text-white/50 text-sm font-accent py-4 text-center">Loading box score…</div>
          )}
          {data && !data.ready && (
            <div className="text-white/50 text-sm font-accent py-4 text-center">
              Box score not published for this game.
            </div>
          )}
          {data?.ready && (
            <>
              {/* Team header row — logo-only, no city abbreviations */}
              <div className="grid grid-cols-3 items-center pb-3 mb-2 border-b border-white/10">
                <div className="flex items-center justify-start">
                  {away.logo_url && <img src={away.logo_url} alt={away.code} className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />}
                </div>
                <div className="text-center font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">vs</div>
                <div className="flex items-center justify-end">
                  {home.logo_url && <img src={home.logo_url} alt={home.code} className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />}
                </div>
              </div>

              {/* Primary + Secondary — all rows always open. Keep scrolling. */}
              <div className="space-y-2.5">
                {PRIMARY.map((m) => (
                  <StatLine key={m.key} label={m.label} tag={m.tag}
                    away={resolveVal(m, data, "away")}
                    home={resolveVal(m, data, "home")}
                    fmt={m.fmt} />
                ))}
              </div>

              {/* Divider between headline metrics and the rest */}
              <div className="my-4 border-t border-white/5" />

              <div className="space-y-2.5">
                {SECONDARY.map((m) => (
                  <StatLine key={m.key} label={m.label}
                    away={resolveVal(m, data, "away")}
                    home={resolveVal(m, data, "home")}
                    fmt={m.fmt} />
                ))}
              </div>

              <div className="pt-3 text-[9px] font-accent uppercase tracking-widest text-white/25 text-right">
                Source · Highlightly · xG &amp; High-Danger = Ticker Model estimates
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// Value resolver — handles three cases:
//   1. `derived: true`  → pull from data.derived.{side}.{key} (Ticker Model)
//   2. `derivedFmt`     → formatter callback receiving the team's stats obj
//   3. raw key          → straight lookup on data.{side}.stats[key]
function resolveVal(meta, data, side) {
  if (meta.derived) return data?.derived?.[side]?.[meta.key];
  if (meta.derivedFmt) return meta.derivedFmt(data?.[side]?.stats, data?.[side === "home" ? "away" : "home"]?.stats);
  return data?.[side]?.stats?.[meta.key];
}

// One row: `[big away number]   [label]   [big home number]`
// The winning side gets full opacity; the trailing side dims slightly so
// the eye reads the delta without any chart. Non-numeric (string) values
// skip the win-compare and show both in full opacity.
function StatLine({ label, away, home, fmt, tag }) {
  const format = fmt || ((v) => (v == null ? "—" : String(v)));
  const a = numeric(away);
  const h = numeric(home);
  // If either side comes through as a non-numeric string ("1/4"), skip
  // dimming — both parts are meaningful in the string form.
  const isPair = typeof away === "string" && /\D/.test(away);
  const awayWin = !isPair && a > h;
  const homeWin = !isPair && h > a;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className={`text-right font-headline text-2xl sm:text-3xl leading-none ${
        isPair || awayWin ? "text-white" : "text-white/50"
      }`}>
        {format(away)}
      </div>
      <div className="text-center px-2 min-w-[110px]">
        <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/60">
          {label}
        </div>
        {tag && (
          <div className="font-accent text-[8px] tracking-[0.3em] text-[#1E5BFF] mt-0.5">
            {tag}
          </div>
        )}
      </div>
      <div className={`text-left font-headline text-2xl sm:text-3xl leading-none ${
        isPair || homeWin ? "text-white" : "text-white/50"
      }`}>
        {format(home)}
      </div>
    </div>
  );
}

function numeric(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
