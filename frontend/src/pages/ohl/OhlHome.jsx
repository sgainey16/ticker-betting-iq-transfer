// OHL Home — Kitchener Rangers command center.
// SIDECAR route: /ohl/home. Fully isolated from the NHL pages so this
// mockup can be evaluated, iterated, or killed without touching the
// working NHL Ticker. When the vibe is right, we lift the shared
// components out and formalize a real league-agnostic architecture.
//
// Uses the same visual DNA as HomeV2 (Cup Score, Story at a Glance,
// Reggie's Keys, Analytics pillars) but themed for junior hockey and
// operating on Kitchener Rangers mock data. Real OHL Sportradar data
// hydrates in a follow-up if the concept clears.

import { useState } from "react";
import { Info, ArrowUp, ArrowDown, Minus, Play } from "lucide-react";

// -- Kitchener Rangers seed data --------------------------------------
// Numbers are internally-consistent junior hockey values (68-game season,
// higher PP% typical of the OHL, PDO in normal range). Not real data.
const TEAM = {
  code: "KIT",
  name: "Kitchener Rangers",
  city: "Kitchener",
  arena: "The Aud",
  conference: "Western Conference",
  division: "Midwest Division",
  primary: "#0033A0",
  accent: "#C8102E",
  logo: "https://upload.wikimedia.org/wikipedia/en/thumb/1/1e/Kitchener_Rangers_logo.svg/1200px-Kitchener_Rangers_logo.svg.png",
  record: { w: 38, l: 18, otl: 4, gd: +58, points: 80, gp: 60 },
  cupScore: {
    value: 78,
    trend: +4,
    trendWindow: "10 days",
    breakdown: [
      { label: "xGF%",              value: "55.8",  weight: 25 },
      { label: "Goal Diff",         value: "+58",   weight: 25 },
      { label: "Goalie SV%",        value: ".912",  weight: 20 },
      { label: "Special Teams Net", value: "+7.4%", weight: 15 },
      { label: "Recent Form",       value: "8-2-0", weight: 15 },
    ],
  },
  tonight: {
    opp: "LDN", oppName: "London Knights",
    oppLogo: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/London_Knights_Logo.svg/1200px-London_Knights_Logo.svg.png",
    time: "TONIGHT · 7:30 PM ET",
    venue: "The Aud · Kitchener, ON",
    projectedEdge: { home: 54, away: 46 },
  },
  story: [
    { label: "Elite Offense",         rank: "#3",  tail: "in OHL",  value: "4.15 GF/Game",  tone: "good" },
    { label: "Special Teams Cooking", rank: "#4",  tail: "in OHL",  value: "26.8% PP",      tone: "good" },
    { label: "Strong Netminding",     rank: "#6",  tail: "in OHL",  value: ".912 SV%",      tone: "good" },
    { label: "Discipline Slipping",   rank: "#17", tail: "in OHL",  value: "11.4 PIM/G",    tone: "bad" },
    { label: "Faceoff Trouble",       rank: "#14", tail: "in OHL",  value: "48.9% FO",      tone: "bad" },
  ],
  reggieQuote: "This Rangers group is loaded — three NHL draft picks in the top-six and a 20-year-old goalie stealing games. The only thing between them and a Memorial Cup run is 60 minutes of discipline.",
  pillars: {
    offense: {
      rank: 3, color: "#ef4444",
      rows: [
        { label: "Goals / Game",         value: "4.15", rank: 3  },
        { label: "Shots / Game",         value: "34.6", rank: 4  },
        { label: "PP %",                 value: "26.8%", rank: 4 },
        { label: "5v5 Shot Attempts %",  value: "54.1%", rank: 5 },
        { label: "Expected Goals / Game",value: "3.82", rank: 4  },
      ],
    },
    defense: {
      rank: 8, color: "#3b82f6",
      rows: [
        { label: "Goals Against / Game", value: "3.18", rank: 9  },
        { label: "Shots Against / Game", value: "29.4", rank: 7  },
        { label: "PK %",                 value: "82.4%", rank: 9 },
        { label: "Blocks / Game",        value: "14.8", rank: 12 },
        { label: "5v5 Chances Against",  value: "12.1", rank: 10 },
      ],
    },
    goaltending: {
      rank: 6, color: "#14b8a6",
      rows: [
        { label: "Team SV%",             value: ".912", rank: 6 },
        { label: "Quality Starts %",     value: "58%",  rank: 7 },
        { label: "Shutouts",             value: "3",    rank: 5 },
        { label: "Last 10 (SV%)",        value: ".925", rank: 4 },
        { label: "Goals Saved Above Avg",value: "+8.2", rank: 6 },
      ],
    },
  },
  leaders: [
    { name: "Cam Allen",       pos: "C",  no: 19, line: "G-A-P", stat: "34-51-85", note: "PPG in last 12"   },
    { name: "Matthew Sop",     pos: "RW", no: 27, line: "G-A-P", stat: "28-33-61", note: "NHL '25 eligible" },
    { name: "Jack Pridham",    pos: "LW", no: 11, line: "G-A-P", stat: "22-30-52", note: "6 GWG"            },
    { name: "Hunter Brzustewicz", pos: "D", no: 3, line: "G-A-P", stat: "8-42-50",  note: "Canucks prospect" },
  ],
  reggieKeys: [
    "Get to the middle of the ice — Knights collapse on the walls but leak seams",
    "Special teams battle — Rangers PP is #4, Knights PK is #22, run it hot",
    "Ride Baksi — he's stolen the last four starts, ride him until he cools",
    "First 5 minutes — Kitchener is a first-period team, London chases the game",
  ],
  prospects: [
    { name: "C. Allen",        team: "DAL", round: 3, year: 2023, note: "Center of the future" },
    { name: "H. Brzustewicz", team: "VAN", round: 2, year: 2023, note: "Top-4 D-man projection" },
    { name: "M. Sop",          team: "—",   round: null, year: 2025, note: "1st-round eligible" },
  ],
  last10: [
    { r: "W", s: "5-3" }, { r: "W", s: "4-1" }, { r: "L", s: "2-4" }, { r: "W", s: "6-2" },
    { r: "W", s: "3-1" }, { r: "W", s: "5-4" }, { r: "W", s: "4-2" }, { r: "W", s: "3-2" },
    { r: "L", s: "1-3" }, { r: "W", s: "5-2" },
  ],
};

const OHL_SHIELD = "/hosts/ohl_shield.svg"; // fallback; inline SVG below if not present

// Inline OHL wordmark badge — editorial use, mirrors the NHL shield placement
function OHLBadge({ size = 20 }) {
  return (
    <svg viewBox="0 0 120 40" width={size * 3} height={size} className="inline-block flex-shrink-0"
         data-testid="ohl-badge">
      <rect x="1" y="1" width="118" height="38" rx="4" fill="#000" stroke="#FF6600" strokeWidth="2" />
      <text x="60" y="27" textAnchor="middle" fontFamily="Oswald, Impact, sans-serif"
            fontWeight="900" fontSize="20" fill="#FF6600" letterSpacing="3">
        OHL
      </text>
    </svg>
  );
}

export default function OhlHome() {
  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <BetaBanner />
        <HeaderStrip team={TEAM} />
        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
          <CupScoreCard team={TEAM} />
          <NextGameCard team={TEAM} />
        </div>
        <StoryAtAGlance team={TEAM} />
        <ReggieTake team={TEAM} />
        <div className="grid md:grid-cols-3 gap-5">
          <PillarCard title="Offense"     data={TEAM.pillars.offense} />
          <PillarCard title="Defense"     data={TEAM.pillars.defense} />
          <PillarCard title="Goaltending" data={TEAM.pillars.goaltending} />
        </div>
        <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5">
          <TeamLeaders leaders={TEAM.leaders} />
          <ReggieKeys keys={TEAM.reggieKeys} />
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <ProspectTracker prospects={TEAM.prospects} />
          <Last10Card last10={TEAM.last10} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------

function BetaBanner() {
  return (
    <div className="rounded-lg border border-[#FF6600]/40 bg-gradient-to-r from-[#FF6600]/15 to-transparent px-4 py-2.5 flex items-center gap-3">
      <OHLBadge size={16} />
      <div className="flex-1 min-w-0">
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#FF6600]">
          The Ticker · OHL Desk · Concept Mock
        </div>
        <div className="font-headline text-white text-sm mt-0.5">
          Kitchener Rangers · Vibe Check
        </div>
      </div>
      <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/50">
        Not Public
      </span>
    </div>
  );
}

function HeaderStrip({ team }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 flex items-center gap-4">
      <img src={team.logo} alt={team.name} className="w-16 h-16 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <OHLBadge size={12} />
          <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">
            OHL · {team.division.toUpperCase()}
          </span>
        </div>
        <div className="font-headline text-2xl sm:text-3xl text-white leading-tight">
          {team.name}
        </div>
        <div className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/50 mt-0.5">
          {team.record.w}-{team.record.l}-{team.record.otl} · {team.record.points} PTS · GD {team.record.gd > 0 ? "+" : ""}{team.record.gd}
        </div>
      </div>
    </div>
  );
}

function ArrowTrend({ trend }) {
  if (trend > 0) return <ArrowUp className="w-3 h-3" style={{ color: "#22c55e" }} />;
  if (trend < 0) return <ArrowDown className="w-3 h-3" style={{ color: "#ef4444" }} />;
  return <Minus className="w-3 h-3" style={{ color: "#a0a0a5" }} />;
}

function CupScoreCard({ team }) {
  const { cupScore } = team;
  const [showWhy, setShowWhy] = useState(false);
  const ringColor = cupScore.value >= 75 ? "#22c55e" : cupScore.value >= 55 ? "#eab308" : "#ef4444";
  const trending = cupScore.trend > 0 ? "TRENDING UP" : cupScore.trend < 0 ? "TRENDING DOWN" : "STEADY";
  const trendColor = cupScore.trend > 0 ? "#22c55e" : cupScore.trend < 0 ? "#ef4444" : "#a0a0a5";
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="38" stroke="rgba(255,255,255,0.08)" strokeWidth="7" fill="none" />
            <circle cx="44" cy="44" r="38" stroke={ringColor} strokeWidth="7" fill="none" strokeLinecap="round"
                    strokeDasharray={`${(cupScore.value / 100) * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                    transform="rotate(-90 44 44)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "34px", color: "#fff", lineHeight: 1 }}>{cupScore.value}</span>
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.2em", color: "#a0a0a5" }}>/100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#a0a0a5" }}>CUP SCORE</span>
            <span className="text-[9px] text-white/45" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>™</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <ArrowTrend trend={cupScore.trend} />
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.2em", color: trendColor }}>{trending}</span>
          </div>
          <div className="mt-0.5" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "12px", color: "#a0a0a5" }}>
            {cupScore.trend > 0 ? "+" : ""}{cupScore.trend} pts last {cupScore.trendWindow}
          </div>
        </div>
        <button onClick={() => setShowWhy((v) => !v)}
                className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-white/10 hover:border-white/30 text-sky-400"
                style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.2em" }}>
          {showWhy ? "HIDE" : "WHY?"}
        </button>
      </div>
      {showWhy && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.3em", color: "#a0a0a5" }}>HOW IT'S CALCULATED</div>
          <div className="mt-2 space-y-1.5">
            {cupScore.breakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-[14px]">
                <span className="text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{b.label} ({b.value})</span>
                <span className="text-white/60 tabular-nums" style={{ fontFamily: "Oswald", fontWeight: 700 }}>{b.weight}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NextGameCard({ team }) {
  const t = team;
  const { projectedEdge } = t.tonight;
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
          NEXT GAME · {t.tonight.time}
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 py-1.5">
        <img src={t.logo} alt={t.code} className="w-8 h-8 object-contain" />
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px" }}>{t.code}</div>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", color: "#a0a0a5" }}>VS</div>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px" }}>{t.tonight.opp}</div>
        <img src={t.tonight.oppLogo} alt={t.tonight.opp} className="w-8 h-8 object-contain" />
      </div>
      <div className="text-center text-[11px] text-white/50 mb-2" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
        {t.tonight.venue}
      </div>
      <div>
        <div className="flex items-center justify-between text-[9px] mb-1" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.25em" }}>
          <span className="text-white/50">PROJ EDGE</span>
          <span className="text-white/30">TICKER MODEL</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0 left-0" style={{ width: `${projectedEdge.home}%`, background: "linear-gradient(90deg, #FF6600, #eab308)" }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[11px]" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
          <span style={{ color: "#FF6600" }}>{projectedEdge.home}%</span>
          <span className="text-white/50">{projectedEdge.away}%</span>
        </div>
      </div>
    </div>
  );
}

function StoryAtAGlance({ team }) {
  return (
    <section className="rounded-lg p-4 border border-white/10 bg-black/40" data-testid="ohl-story-at-a-glance">
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: "#FF6600" }}>
          THE STORY AT A GLANCE
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {team.story.map((s, i) => {
          const isGood = s.tone === "good";
          const rankNum = (String(s.rank).match(/\d+/) || [""])[0];
          return (
            <div key={i} className="relative rounded-lg border overflow-hidden"
                 style={{
                   background: isGood
                     ? "linear-gradient(160deg, rgba(34,197,94,0.14) 0%, rgba(11,11,16,0.9) 65%)"
                     : "linear-gradient(160deg, rgba(239,68,68,0.14) 0%, rgba(11,11,16,0.9) 65%)",
                   borderColor: isGood ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
                 }}>
              <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: isGood ? "#22c55e" : "#ef4444" }} />
              <div className="p-3.5 pl-5">
                <div className="flex items-baseline gap-1.5">
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "42px", lineHeight: 1, color: isGood ? "#22c55e" : "#f87171" }}>
                    #{rankNum}
                  </span>
                  <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
                    {s.tail || "in OHL"}
                  </span>
                </div>
                <div className="mt-2" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "13px", color: "#fff", lineHeight: 1.2 }}>
                  {s.label}
                </div>
                <div className="mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", color: "#ffffff99" }}>
                  {s.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReggieTake({ team }) {
  return (
    <section className="rounded-lg border border-white/10 bg-gradient-to-br from-[#FF6600]/10 via-black/50 to-black/40 p-4 sm:p-5"
             data-testid="ohl-reggie-take">
      <div className="flex items-start gap-4">
        <button className="flex-shrink-0 h-11 w-11 rounded-full bg-[#FF6600] hover:bg-[#ff7a1a] flex items-center justify-center text-white transition-colors shadow-[0_0_20px_-4px_rgba(255,102,0,0.7)]"
                aria-label="Play Reggie's take">
          <Play className="w-5 h-5 translate-x-[1px]" fill="currentColor" />
        </button>
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.3em", color: "#FF6600" }}>
            REGGIE'S TAKE · 14 seconds
          </div>
          <blockquote className="mt-1.5 font-headline text-white text-base sm:text-lg leading-snug">
            "{team.reggieQuote}"
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function PillarCard({ title, data }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: data.color }}>
          {title.toUpperCase()}
        </span>
        <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: data.color }}>
          #{data.rank}
        </span>
      </div>
      <div className="space-y-1.5">
        {data.rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[13px]">
            <span className="text-white/80" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{r.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-white tabular-nums" style={{ fontFamily: "Oswald", fontWeight: 700 }}>{r.value}</span>
              <span className="text-white/40 text-[10px] tabular-nums">#{r.rank}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamLeaders({ leaders }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
          TEAM LEADERS
        </span>
      </div>
      <div className="space-y-2.5">
        {leaders.map((p) => (
          <div key={p.name} className="flex items-center gap-3 pb-2.5 border-b border-white/5 last:border-b-0 last:pb-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center font-headline text-lg"
                 style={{ background: "linear-gradient(135deg,#0033A0,#001a5c)" }}>
              {p.no}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-headline text-white text-sm">{p.name} <span className="text-white/40 text-xs">· {p.pos}</span></div>
              <div className="font-accent text-[10px] uppercase tracking-[0.2em] text-white/45">{p.note}</div>
            </div>
            <div className="text-right">
              <div className="font-headline text-white text-base tabular-nums">{p.stat}</div>
              <div className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/40">{p.line}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReggieKeys({ keys }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
          REGGIE'S KEYS TO TONIGHT
        </span>
        <Info className="w-3.5 h-3.5 text-white/30" />
      </div>
      <ul className="space-y-2">
        {keys.map((k, i) => (
          <li key={i} className="flex items-start gap-3 text-white/85 text-[13px] leading-snug">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#FF6600] flex-shrink-0" />
            <span>{k}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProspectTracker({ prospects }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
          NHL DRAFT PIPELINE
        </span>
      </div>
      <div className="space-y-2">
        {prospects.map((p, i) => (
          <div key={i} className="flex items-center justify-between pb-2 border-b border-white/5 last:border-b-0">
            <div>
              <div className="font-headline text-white text-sm">{p.name}</div>
              <div className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/45">{p.note}</div>
            </div>
            <div className="text-right">
              <div className="font-headline text-white text-sm">
                {p.team === "—" ? "Draft-Eligible" : p.team}
              </div>
              <div className="font-accent text-[9px] uppercase tracking-[0.22em] text-white/45">
                {p.round ? `Round ${p.round} · ${p.year}` : `Class of ${p.year}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Last10Card({ last10 }) {
  const wins = last10.filter((g) => g.r === "W").length;
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
          LAST 10 GAMES
        </span>
        <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#22c55e" }}>
          {wins}-{10 - wins}-0
        </span>
      </div>
      <div className="flex gap-1.5">
        {last10.map((g, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full h-8 rounded-sm flex items-center justify-center font-headline text-xs ${
              g.r === "W" ? "bg-green-500/25 text-green-300" : "bg-red-500/25 text-red-300"
            }`}>
              {g.r}
            </div>
            <div className="text-[9px] text-white/40 tabular-nums" style={{ fontFamily: "Oswald" }}>
              {g.s}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
