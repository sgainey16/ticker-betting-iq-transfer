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
const PRIMARY = [
  { key: "Shots",                 label: "Shots on Goal" },
  { key: "Hits",                  label: "Hits" },
  { key: "Blocked Shots",         label: "Blocked Shots" },
  { key: "Faceoff Win Percent",   label: "Faceoffs",   fmt: (v) => v == null ? "—" : `${Number(v).toFixed(0)}%` },
  { key: "__pp_ratio__",          label: "Power Play", derived: (t) => {
      const g = t?.["Power Play Goals"];
      const opp = t?.["Power Play Opportunities"];
      if (g == null || opp == null) return "—";
      return `${Number(g)}/${Number(opp)}`;
    } },
];

const SECONDARY = [
  { key: "Power Play Percentage", label: "PP %",       fmt: (v) => v == null ? "—" : `${Number(v).toFixed(0)}%` },
  { key: "Short Handed Goals",    label: "Shorthanded Goals" },
  { key: "Faceoffs Won",          label: "Faceoffs Won" },
  { key: "Takeaways",             label: "Takeaways" },
  { key: "Giveaways",             label: "Giveaways" },
  { key: "Total Penalties",       label: "Penalties" },
  { key: "Penalty Minutes",       label: "Penalty Minutes" },
];

const _cache = new Map(); // match_id → response

export default function PostGameStats({ segment }) {
  const matchId = segment?.match_id;
  const [open, setOpen] = useState(true);
  const [showMore, setShowMore] = useState(false);
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
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F5A623]">
            Post-Game Stats
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {away.logo_url && <img src={away.logo_url} alt={away.code} className="w-5 h-5 object-contain" />}
            <span className="font-headline text-white text-sm">{away.code}</span>
            <span className="text-white/30">·</span>
            <span className="font-headline text-white text-sm">{data?.score?.current || "Final"}</span>
            <span className="text-white/30">·</span>
            <span className="font-headline text-white text-sm">{home.code}</span>
            {home.logo_url && <img src={home.logo_url} alt={home.code} className="w-5 h-5 object-contain" />}
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
              {/* Team header row — big logos + team names */}
              <div className="grid grid-cols-3 items-center pb-3 mb-2 border-b border-white/10">
                <div className="flex items-center gap-2 justify-start">
                  {away.logo_url && <img src={away.logo_url} alt={away.code} className="w-9 h-9 object-contain" />}
                  <span className="font-headline text-white text-base">{away.code}</span>
                </div>
                <div className="text-center font-accent text-[10px] uppercase tracking-[0.3em] text-white/40">vs</div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="font-headline text-white text-base">{home.code}</span>
                  {home.logo_url && <img src={home.logo_url} alt={home.code} className="w-9 h-9 object-contain" />}
                </div>
              </div>

              {/* Primary rows — biggest / most important */}
              <div className="space-y-2.5">
                {PRIMARY.map((m) => (
                  <StatLine key={m.key} label={m.label}
                    away={m.derived ? m.derived(data.away?.stats) : data.away?.stats?.[m.key]}
                    home={m.derived ? m.derived(data.home?.stats) : data.home?.stats?.[m.key]}
                    fmt={m.fmt}
                    derived={!!m.derived} />
                ))}
              </div>

              {/* Show-more toggle */}
              <button
                onClick={() => setShowMore((v) => !v)}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-[#F5A623]/60 hover:border-[#F5A623] bg-[#F5A623]/10 hover:bg-[#F5A623]/20 py-3 font-accent text-xs uppercase tracking-[0.3em] text-[#F5A623] transition-all shadow-[0_0_18px_-6px_rgba(245,166,35,0.6)] hover:shadow-[0_0_24px_-4px_rgba(245,166,35,0.8)]"
                data-testid="post-game-stats-more"
              >
                {showMore ? "Show Less" : "Show More Stats"}
                <ChevronDown className={`w-4 h-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
              </button>

              {showMore && (
                <div className="space-y-2.5 mt-3">
                  {SECONDARY.map((m) => (
                    <StatLine key={m.key} label={m.label}
                      away={m.derived ? m.derived(data.away?.stats) : data.away?.stats?.[m.key]}
                      home={m.derived ? m.derived(data.home?.stats) : data.home?.stats?.[m.key]}
                      fmt={m.fmt}
                      derived={!!m.derived} />
                  ))}
                </div>
              )}

              <div className="pt-3 text-[9px] font-accent uppercase tracking-widest text-white/25 text-right">
                Source · Highlightly
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// One row: `[big away number]   [label]   [big home number]`
// The winning side gets full opacity; the trailing side dims slightly so
// the eye reads the delta without any chart. `derived` values (e.g. "1/4"
// PP goals-over-opps) skip the numeric win-compare because the string
// form encodes both parts — we just render both in full opacity.
function StatLine({ label, away, home, fmt, derived }) {
  let awayWin = false, homeWin = false;
  if (!derived) {
    const a = numeric(away);
    const h = numeric(home);
    awayWin = a > h;
    homeWin = h > a;
  }
  const format = fmt || ((v) => (v == null ? "—" : String(v)));
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className={`text-right font-headline text-2xl sm:text-3xl leading-none ${
        derived || awayWin ? "text-white" : "text-white/50"
      }`}>
        {format(away)}
      </div>
      <div className="text-center font-accent text-[10px] uppercase tracking-[0.25em] text-white/60 px-2 min-w-[110px]">
        {label}
      </div>
      <div className={`text-left font-headline text-2xl sm:text-3xl leading-none ${
        derived || homeWin ? "text-white" : "text-white/50"
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
