import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChevronDown } from "lucide-react";

// Highlightly's raw display names, normalized into the row order Reggie &
// Marc actually reference on-air. Each entry maps to a rendering strategy:
//   - "bar": numeric compare with a proportional bar
//   - "pct": show as X.X% with a bar based on the percent value (0-100)
// The list is short by design — the panel is a glance, not a spreadsheet.
const METRICS = [
  { key: "Shots",                  label: "Shots on Goal", mode: "bar" },
  { key: "Blocked Shots",          label: "Blocked Shots", mode: "bar" },
  { key: "Hits",                   label: "Hits",          mode: "bar" },
  { key: "Faceoff Win Percent",    label: "Faceoffs %",    mode: "pct" },
  { key: "Power Play Percentage",  label: "PP %",          mode: "pct" },
  { key: "Takeaways",              label: "Takeaways",     mode: "bar" },
  { key: "Giveaways",              label: "Giveaways",     mode: "bar", lowerIsBetter: true },
  { key: "Penalty Minutes",        label: "PIM",           mode: "bar", lowerIsBetter: true },
];

// Fetch + memoize per match_id so tapping between segments is instant.
const _cache = new Map();

export default function PostGameStats({ segment, defaultOpen = false }) {
  const matchId = segment?.match_id;
  const [open, setOpen] = useState(defaultOpen);
  const [data, setData] = useState(() => _cache.get(matchId) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    if (_cache.has(matchId)) { setData(_cache.get(matchId)); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/recap-show/post-game-stats?match_id=${matchId}`)
      .then((r) => {
        if (cancelled) return;
        _cache.set(matchId, r.data);
        setData(r.data);
      })
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
      {/* Header — tap to expand/collapse; big matchup line + verdict */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors"
        data-testid="post-game-stats-toggle"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F5A623]">
            Post-Game Stats
          </div>
          <div className="hidden sm:flex items-center gap-2 min-w-0">
            {away.logo_url && <img src={away.logo_url} alt={away.code} className="w-5 h-5 object-contain" />}
            <span className="font-headline text-white text-sm">{away.code}</span>
            <span className="text-white/30">·</span>
            <span className="font-headline text-white text-sm">
              {data?.score?.current || "Final"}
            </span>
            <span className="text-white/30">·</span>
            <span className="font-headline text-white text-sm">{home.code}</span>
            {home.logo_url && <img src={home.logo_url} alt={home.code} className="w-5 h-5 object-contain" />}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Comparison table — one row per metric */}
      {open && (
        <div className="border-t border-[#2d2d35] px-4 py-3 space-y-2" data-testid="post-game-stats-body">
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
              {/* Team header row — big logos + names */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center pb-2 border-b border-white/10">
                <TeamHeader team={away} align="left" logo={data.away?.team?.logo} />
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/40">vs</div>
                <TeamHeader team={home} align="right" logo={data.home?.team?.logo} />
              </div>
              {METRICS.map((m) => (
                <StatRow
                  key={m.key}
                  label={m.label}
                  mode={m.mode}
                  lowerIsBetter={!!m.lowerIsBetter}
                  awayVal={data.away?.stats?.[m.key]}
                  homeVal={data.home?.stats?.[m.key]}
                  awayAccent={away.accent || "#1e5dff"}
                  homeAccent={home.accent || "#1e5dff"}
                />
              ))}
              <div className="pt-2 text-[10px] font-accent uppercase tracking-widest text-white/30 text-right">
                Source · Highlightly
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function TeamHeader({ team, logo, align }) {
  return (
    <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}>
      {align === "left" && logo && <img src={logo} alt={team.code} className="w-8 h-8 object-contain" />}
      <div className="font-headline text-white text-sm">{team.name || team.code}</div>
      {align === "right" && logo && <img src={logo} alt={team.code} className="w-8 h-8 object-contain" />}
    </div>
  );
}

// One row: [away number] [label + bar] [home number]. The bar leans toward
// whichever side has the better value on that metric so the eye instantly
// reads who "won" that stat category.
function StatRow({ label, mode, lowerIsBetter, awayVal, homeVal, awayAccent, homeAccent }) {
  const a = numeric(awayVal);
  const h = numeric(homeVal);
  let awayShare = 50, homeShare = 50;
  if (mode === "pct") {
    // For percentages we anchor at 50/50 baseline so bars grow proportionally
    // to the actual value, but sum still stops at 100 for visual clarity.
    const total = (a || 0) + (h || 0);
    awayShare = total > 0 ? (a / total) * 100 : 50;
    homeShare = 100 - awayShare;
  } else {
    const total = (a || 0) + (h || 0);
    if (total > 0) {
      awayShare = (a / total) * 100;
      homeShare = 100 - awayShare;
    }
  }
  const awayLead = lowerIsBetter ? a < h : a > h;
  const homeLead = lowerIsBetter ? h < a : h > a;
  const fmt = (v) => (mode === "pct" && v != null ? `${Number(v).toFixed(1)}%` : (v ?? "—"));
  return (
    <div className="grid grid-cols-[3.5rem_1fr_3.5rem] gap-3 items-center">
      <div className={`text-right font-headline text-lg ${awayLead ? "text-white" : "text-white/50"}`}>
        {fmt(awayVal)}
      </div>
      <div>
        <div className="text-center font-accent text-[10px] uppercase tracking-widest text-white/50 mb-1">
          {label}
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
          <div style={{ width: `${awayShare}%`, background: awayAccent, opacity: awayLead ? 1 : 0.55 }} />
          <div style={{ width: `${homeShare}%`, background: homeAccent, opacity: homeLead ? 1 : 0.55 }} />
        </div>
      </div>
      <div className={`text-left font-headline text-lg ${homeLead ? "text-white" : "text-white/50"}`}>
        {fmt(homeVal)}
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
