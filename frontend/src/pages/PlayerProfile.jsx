// Player Profile — individual deep-dive page.
//
// Structure (top → bottom):
//   1. Hero  · Name, team, jersey, position, big silhouette
//   2. Rating strip · Season line (G-A-P), Cup Score-style personal rating
//   3. Trending · Last 10 sparkline + hot/cold indicator
//   4. Advanced Stats · xG, HDC, Rush Chances, Shot Map placeholder
//   5. Reggie's Take · Ticker Blue quote card
//   6. Marc's Numbers · Deadpan analytics prose
//   7. Recent Games · Last 10 game log with G/A/+-
//   8. Fantasy & Betting · Ownership %, prop bets he covered
//   9. Contract Detail · AAV, term, per-year breakdown, bonuses, clauses
//
// Route: /player/:slug   (seed: 'suzuki-mtl', 'pastrnak-bos')

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ArrowUp, ArrowDown, Flame, Snowflake, Target, TrendingUp,
  DollarSign, Lock, ChevronRight, Volume2,
} from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { C } from "@/lib/brand";

/* ================================================================
   SEED PLAYER DATA — 2 samples to prove the layout. Real NHL API +
   CapFriendly data feeds hydrate these fields later.
   ================================================================ */

const PLAYERS = {
  "suzuki-mtl": {
    slug: "suzuki-mtl",
    name: "Nick Suzuki",
    firstName: "Nick", lastName: "Suzuki",
    team: "MTL", teamName: "Montreal Canadiens",
    teamColor: "#AF1E2D", teamAccent: "#192168",
    pos: "C", jersey: 14,
    age: 25, born: "Aug 10, 1999", birthplace: "London, ON",
    ht: "5'11\"", wt: "208 lb", shoots: "R",
    draft: "2017 · Round 1 · #13 overall (VGK)",
    role: "Captain · 1C · Faceoff Ace",
    rating: 88,
    season: { gp: 55, g: 24, a: 42, p: 66, pm: "+18", pim: 20, sog: 158 },
    advanced: {
      shPct: "15.2%", ixG: 18.4, hdc: 42, rush: 31,
      foPct: "54.8%", pkTOI: "1:12", ppTOI: "3:24",
      ozStart: "56%",
    },
    trend: { last10: { g: 6, a: 9, p: 15, pm: "+8" }, streak: "hot" },
    sparkline: [1, 0, 2, 1, 3, 2, 1, 2, 1, 2], // points per game last 10
    reggieTake: "Suzuki is the kind of captain every team needs. Doesn't chirp. Doesn't dive. Just piles up points and wins faceoffs. Marc, this is the guy Canadiens fans build the next Cup around.",
    marcNumbers: "Suzuki's 54.8% faceoff percentage is 9th in the NHL. His individual xG of 18.4 outpaces his 24 goals, which means the shooting will regress upward — he's under-scoring for his chances. If he holds this pace, he finishes with 32-plus goals and 90-plus points. That's a bona-fide No. 1 center.",
    gameLog: [
      { date: "APR 8", opp: "@ BOS", res: "W 4-2", g: 1, a: 2, pm: "+2", sog: 4 },
      { date: "APR 6", opp: "vs TOR", res: "W 5-3", g: 0, a: 1, pm: "+1", sog: 3 },
      { date: "APR 4", opp: "vs OTT", res: "OT 3-2", g: 2, a: 0, pm: "+1", sog: 6 },
      { date: "APR 2", opp: "@ NYR", res: "L 2-4", g: 0, a: 2, pm: "0", sog: 2 },
      { date: "MAR 31",opp: "@ NJD", res: "W 3-1", g: 1, a: 1, pm: "+2", sog: 3 },
      { date: "MAR 29",opp: "vs BUF", res: "W 6-3", g: 0, a: 2, pm: "+1", sog: 4 },
      { date: "MAR 27",opp: "vs FLA", res: "L 1-3", g: 0, a: 0, pm: "-1", sog: 2 },
      { date: "MAR 25",opp: "@ TBL", res: "W 4-3", g: 1, a: 0, pm: "+1", sog: 5 },
      { date: "MAR 23",opp: "@ CAR", res: "L 2-5", g: 0, a: 1, pm: "-2", sog: 3 },
      { date: "MAR 21",opp: "vs PIT", res: "W 4-2", g: 1, a: 0, pm: "+2", sog: 4 },
    ],
    fantasy: { ownership: "89%", startPct: "94%", tier: "Elite C1", note: "Must-start" },
    betting: {
      anytimeGoal: "+165",
      shotsOver: "3.5 SOG · -105",
      pointsProp: "1.5 pts · +140",
      reggieCall: "I like the shots. Volume shooter, faceoff wins put him in the O-zone all night.",
    },
    contract: {
      signed: "Oct 12, 2021",
      term: "8 years",
      aav: "$7,875,000",
      totalValue: "$63,000,000",
      expiry: "UFA · 2030-31",
      structure: "Modified No-Trade Clause (Y5-Y8, 15-team no-trade list)",
      clauses: [
        { label: "NMC (Full)", years: "Y3 – Y4", tone: "green" },
        { label: "M-NTC (15 team)", years: "Y5 – Y8", tone: "blue" },
        { label: "Signing Bonuses", years: "Y1 – Y8", tone: "gold" },
      ],
      byYear: [
        { year: "2022-23", cap: "$7.875M", base: "$1.000M", sb: "$6.875M", note: "" },
        { year: "2023-24", cap: "$7.875M", base: "$1.000M", sb: "$6.875M", note: "" },
        { year: "2024-25", cap: "$7.875M", base: "$1.000M", sb: "$6.875M", note: "NMC starts" },
        { year: "2025-26", cap: "$7.875M", base: "$1.000M", sb: "$6.875M", note: "" },
        { year: "2026-27", cap: "$7.875M", base: "$3.000M", sb: "$4.875M", note: "NMC ends → M-NTC" },
        { year: "2027-28", cap: "$7.875M", base: "$3.500M", sb: "$4.375M", note: "" },
        { year: "2028-29", cap: "$7.875M", base: "$4.000M", sb: "$3.875M", note: "" },
        { year: "2029-30", cap: "$7.875M", base: "$4.000M", sb: "$3.875M", note: "Final year" },
      ],
      cap: {
        pctOfCap: "9.2%",
        deadCapIfBoughtOut: "Complex — signing-bonus heavy, effective buyout minimal savings",
      },
    },
  },
  "pastrnak-bos": {
    slug: "pastrnak-bos",
    name: "David Pastrnak",
    firstName: "David", lastName: "Pastrnak",
    team: "BOS", teamName: "Boston Bruins",
    teamColor: "#FFB81C", teamAccent: "#000000",
    pos: "RW", jersey: 88,
    age: 28, born: "May 25, 1996", birthplace: "Havířov, Czechia",
    ht: "6'0\"", wt: "194 lb", shoots: "R",
    draft: "2014 · Round 1 · #25 overall (BOS)",
    role: "Franchise RW · Elite Sniper · PP1",
    rating: 94,
    season: { gp: 55, g: 34, a: 41, p: 75, pm: "+26", pim: 24, sog: 218 },
    advanced: {
      shPct: "15.6%", ixG: 28.2, hdc: 58, rush: 42,
      foPct: "—", pkTOI: "0:08", ppTOI: "4:12",
      ozStart: "61%",
    },
    trend: { last10: { g: 8, a: 6, p: 14, pm: "+9" }, streak: "hot" },
    sparkline: [2, 1, 1, 2, 3, 1, 0, 2, 1, 1],
    reggieTake: "Pasta is the reason opposing coaches don't sleep on Fridays. That one-timer from the office is the closest thing hockey has to Ovi. He's not slowing down.",
    marcNumbers: "Pastrnak's 218 shots pace him for 320+ on the year. His individual xG of 28.2 tracks with his 34 goals — real, not lucky. He's converting at 15.6% which is right on his career norm. Bet on 45+ goals with confidence.",
    gameLog: [
      { date: "APR 8", opp: "vs MTL", res: "W 4-2", g: 1, a: 1, pm: "+2", sog: 5 },
      { date: "APR 6", opp: "@ NYR", res: "W 3-1", g: 1, a: 0, pm: "+1", sog: 6 },
      { date: "APR 4", opp: "vs PHI", res: "W 5-2", g: 2, a: 1, pm: "+3", sog: 7 },
      { date: "APR 2", opp: "@ CBJ", res: "L 2-3", g: 0, a: 1, pm: "-1", sog: 4 },
      { date: "MAR 31",opp: "vs TBL", res: "W 4-3", g: 1, a: 1, pm: "+2", sog: 5 },
      { date: "MAR 29",opp: "@ DET", res: "W 5-1", g: 1, a: 2, pm: "+3", sog: 6 },
      { date: "MAR 27",opp: "vs BUF", res: "L 3-4", g: 0, a: 0, pm: "-1", sog: 3 },
      { date: "MAR 25",opp: "@ OTT", res: "W 3-2", g: 1, a: 0, pm: "+1", sog: 4 },
      { date: "MAR 23",opp: "vs FLA", res: "OT 3-2", g: 1, a: 0, pm: "+1", sog: 6 },
      { date: "MAR 21",opp: "@ TOR", res: "W 4-2", g: 0, a: 1, pm: "+1", sog: 3 },
    ],
    fantasy: { ownership: "99%", startPct: "100%", tier: "Elite RW1", note: "First-name basis with your league" },
    betting: {
      anytimeGoal: "-135",
      shotsOver: "4.5 SOG · -110",
      pointsProp: "2.5 pts · +160",
      reggieCall: "Volume, volume, volume. Take the shots over every time.",
    },
    contract: {
      signed: "Mar 2, 2023",
      term: "8 years",
      aav: "$11,250,000",
      totalValue: "$90,000,000",
      expiry: "UFA · 2030-31",
      structure: "Full No-Movement Clause (Y1-Y4) → Modified NTC (Y5-Y8)",
      clauses: [
        { label: "NMC (Full)", years: "Y1 – Y4", tone: "green" },
        { label: "M-NTC (16 team)", years: "Y5 – Y8", tone: "blue" },
        { label: "Signing Bonuses", years: "Y1 – Y8", tone: "gold" },
        { label: "Performance Bonuses", years: "None", tone: "gray" },
      ],
      byYear: [
        { year: "2023-24", cap: "$11.250M", base: "$1.000M", sb: "$10.250M", note: "" },
        { year: "2024-25", cap: "$11.250M", base: "$1.000M", sb: "$10.250M", note: "" },
        { year: "2025-26", cap: "$11.250M", base: "$1.000M", sb: "$10.250M", note: "" },
        { year: "2026-27", cap: "$11.250M", base: "$1.500M", sb: "$9.750M",  note: "" },
        { year: "2027-28", cap: "$11.250M", base: "$3.000M", sb: "$8.250M",  note: "NMC → M-NTC" },
        { year: "2028-29", cap: "$11.250M", base: "$4.500M", sb: "$6.750M",  note: "" },
        { year: "2029-30", cap: "$11.250M", base: "$6.000M", sb: "$5.250M",  note: "" },
        { year: "2030-31", cap: "$11.250M", base: "$7.500M", sb: "$3.750M",  note: "Final year" },
      ],
      cap: {
        pctOfCap: "13.1%",
        deadCapIfBoughtOut: "Buyout ineffective — signing bonuses cannot be bought out. Trade only.",
      },
    },
  },
};

/* ---------------------------- HELPERS ---------------------------- */

function StatCell({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.25em", color: "#a0a0a5" }}>
        {label}
      </div>
      <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "28px", color: "#fff", lineHeight: 1.05 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.15em", color: "#a0a0a5" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StreakBadge({ streak }) {
  const isHot = streak === "hot";
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
         style={{
           background: isHot ? "#f9731633" : "#38bdf833",
           border: `1px solid ${isHot ? "#f97316aa" : "#38bdf8aa"}`,
         }}>
      {isHot ? <Flame className="w-3.5 h-3.5 text-orange-400" /> : <Snowflake className="w-3.5 h-3.5 text-sky-300" />}
      <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.15em", color: isHot ? "#fdba74" : "#7dd3fc" }}>
        {isHot ? "HEATING UP" : "ICE COLD"}
      </span>
    </div>
  );
}

function Sparkline({ points }) {
  const max = Math.max(...points, 1);
  const w = 220, h = 40;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p / max) * h} r={p > 0 ? 3 : 2}
                fill={p > 0 ? "#22c55e" : "#4b5563"} />
      ))}
    </svg>
  );
}

/* ---------------------------- PAGE ---------------------------- */

export default function PlayerProfile() {
  const { slug } = useParams();
  const p = PLAYERS[slug] || PLAYERS["suzuki-mtl"];

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white pb-24" data-testid="player-profile">
      {/* HERO — team-color tinted band */}
      <div className="relative overflow-hidden border-b border-white/10"
           style={{ background: `radial-gradient(circle at 20% 40%, ${p.teamColor}22, transparent 60%), #0b0b10` }}>
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-8 flex items-center gap-3">
          <Link to="/home-v2" className="text-white/50 hover:text-white flex items-center gap-1 text-sm"
                style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
            <ArrowLeft className="w-4 h-4" /> BACK
          </Link>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-10 grid grid-cols-1 md:grid-cols-[240px_1fr_auto] gap-8 items-center">
          {/* Silhouette + team logo halo */}
          <div className="relative" style={{ width: 220, height: 260 }}>
            <div className="absolute inset-0 rounded-full blur-3xl opacity-60 pointer-events-none"
                 style={{ background: `radial-gradient(circle, ${p.teamColor}77 0%, transparent 65%)` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <TeamLogo code={p.team} size={200} className="opacity-40 drop-shadow-2xl" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "128px", color: "#fff", textShadow: "0 6px 20px rgba(0,0,0,0.5)", lineHeight: 1 }}>
                {p.jersey}
              </span>
            </div>
          </div>

          {/* Name + role + vitals */}
          <div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.35em", color: p.teamColor }}>
              {p.teamName.toUpperCase()}
            </div>
            <h1 style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "60px", lineHeight: 1, letterSpacing: "0.01em", color: "#fff" }}>
              {p.firstName.toUpperCase()} <span style={{ color: p.teamColor }}>{p.lastName.toUpperCase()}</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-1 rounded" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.2em" }}>
                #{p.jersey} · {p.pos}
              </span>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
                {p.ht} · {p.wt} · {p.shoots}
              </span>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
                AGE {p.age} · {p.birthplace}
              </span>
            </div>
            <div className="mt-4" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "20px", color: "#a0a0a5" }}>
              {p.role}
            </div>
            <div className="mt-1" style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "12px", letterSpacing: "0.2em", color: "#666" }}>
              {p.draft}
            </div>
          </div>

          {/* Rating ring — Cup Score style but per-player */}
          <div className="relative flex flex-col items-center" style={{ width: 140 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
              <circle cx="70" cy="70" r="60" stroke="#22c55e" strokeWidth="10" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${(p.rating / 100) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`}
                      transform="rotate(-90 70 70)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "48px", color: "#fff", lineHeight: 1 }}>{p.rating}</span>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.25em", color: "#a0a0a5" }}>/ 100</span>
            </div>
            <div className="mt-2" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
              PLAYER RATING
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* SEASON LINE STRIP */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.3em", color: "#fff" }}>
                SEASON LINE
              </span>
              <span className="ml-2 text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
                · {p.season.gp} GP
              </span>
            </div>
            <StreakBadge streak={p.trend.streak} />
          </div>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-4">
            <StatCell label="G"    value={p.season.g}   />
            <StatCell label="A"    value={p.season.a}   />
            <StatCell label="PTS"  value={p.season.p}   sub={`${p.trend.last10.p} in L10`} />
            <StatCell label="+/-"  value={p.season.pm}  />
            <StatCell label="PIM"  value={p.season.pim} />
            <StatCell label="SOG"  value={p.season.sog} sub={p.advanced.shPct} />
            <StatCell label="FO%"  value={p.advanced.foPct} />
          </div>
        </div>

        {/* LAST 10 TRENDLINE */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.3em", color: "#fff" }}>
              LAST 10 · POINTS PER GAME
            </span>
            <span className="text-[13px] text-white/70" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
              {p.trend.last10.g}G · {p.trend.last10.a}A · <span className="text-emerald-400">{p.trend.last10.p} PTS</span>
            </span>
          </div>
          <div className="mt-3">
            <Sparkline points={p.sparkline} />
          </div>
        </div>

        {/* ADVANCED STATS */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.3em", color: "#fff" }}>
              ADVANCED · TICKER MODEL
            </span>
            <span className="text-[11px] text-white/45" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
              5-ON-5 UNLESS NOTED
            </span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <StatCell label="ind. xG"   value={p.advanced.ixG} sub="expected goals" />
            <StatCell label="HDC"       value={p.advanced.hdc} sub="high-danger" />
            <StatCell label="RUSH"      value={p.advanced.rush} sub="chances / gm" />
            <StatCell label="SH %"      value={p.advanced.shPct} />
            <StatCell label="PP TOI"    value={p.advanced.ppTOI} />
            <StatCell label="OZ START"  value={p.advanced.ozStart} />
          </div>
        </div>

        {/* REGGIE'S TAKE — Blue accent + audio button */}
        <div className="rounded-lg p-5"
             style={{
               background: "linear-gradient(135deg, rgba(30,91,255,0.18) 0%, rgba(30,91,255,0.04) 100%)",
               border: "1px solid rgba(30,91,255,0.55)",
               boxShadow: "0 0 24px -8px rgba(30,91,255,0.45)",
             }}>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-full flex-shrink-0 flex items-center justify-center"
                 style={{ background: "#1E5BFF33", border: "1.5px solid #1E5BFF" }}>
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#1E5BFF" }}>RH</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#1E5BFF" }}>
                  REGGIE'S TAKE
                </span>
                <button className="text-[12px] text-sky-300 hover:text-sky-100 flex items-center gap-1"
                        style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
                  Hear it <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-2 text-[17px] text-white" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.4 }}>
                "{p.reggieTake}"
              </div>
            </div>
          </div>
        </div>

        {/* MARC'S NUMBERS */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-full flex-shrink-0 flex items-center justify-center"
                 style={{ background: "rgba(201,212,255,0.15)", border: "1px solid rgba(201,212,255,0.35)" }}>
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#c9d4ff" }}>MC</span>
            </div>
            <div>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#c9d4ff" }}>
                MARC'S NUMBERS
              </span>
              <div className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
                THE ANALYTICAL READ
              </div>
            </div>
          </div>
          <div className="text-[16px] text-white/90 mt-2" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.5 }}>
            {p.marcNumbers}
          </div>
        </div>

        {/* GAME LOG */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.3em", color: "#fff" }}>
              GAME LOG · LAST 10
            </span>
            <button className="text-[13px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                    style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
              Full log <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-[11px]" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
                  <th className="text-left py-2 pr-3">DATE</th>
                  <th className="text-left pr-3">OPP</th>
                  <th className="text-left pr-3">RESULT</th>
                  <th className="text-right px-3">G</th>
                  <th className="text-right px-3">A</th>
                  <th className="text-right px-3">+/-</th>
                  <th className="text-right px-3">SOG</th>
                </tr>
              </thead>
              <tbody>
                {p.gameLog.map((row, i) => {
                  const isWin  = row.res.startsWith("W");
                  const isOT   = row.res.startsWith("OT");
                  return (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-2.5 pr-3 text-white/70" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em", fontSize: "12px" }}>{row.date}</td>
                      <td className="pr-3 text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{row.opp}</td>
                      <td className="pr-3" style={{ fontFamily: "Rajdhani", fontWeight: 700, color: isWin ? "#22c55e" : isOT ? "#eab308" : "#ef4444" }}>{row.res}</td>
                      <td className="text-right px-3 tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{row.g}</td>
                      <td className="text-right px-3 tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{row.a}</td>
                      <td className="text-right px-3 tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700, color: row.pm.startsWith("-") ? "#ef4444" : row.pm === "0" ? "#a0a0a5" : "#22c55e" }}>{row.pm}</td>
                      <td className="text-right px-3 tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{row.sog}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FANTASY + BETTING (grouped) */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-black/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
                FANTASY OUTLOOK
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCell label="OWNED"   value={p.fantasy.ownership} />
              <StatCell label="STARTED" value={p.fantasy.startPct} />
              <StatCell label="TIER"    value={p.fantasy.tier}    />
            </div>
            <div className="mt-3 text-[14px] text-white/80" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
              {p.fantasy.note}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-red-400" />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
                TONIGHT'S BETTING ANGLES
              </span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(30,91,255,0.15)", border: "1px solid rgba(30,91,255,0.35)", color: "#7ea3ff", fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
                COACH NOT CASINO
              </span>
            </div>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-white/70" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>Anytime Goal</span>
                <span style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{p.betting.anytimeGoal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>Shots Over</span>
                <span style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{p.betting.shotsOver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>Points Prop</span>
                <span style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{p.betting.pointsProp}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 text-[13px] text-white/75" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.4 }}>
              <span style={{ color: "#1E5BFF", fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em", fontSize: "11px" }}>REGGIE'S CALL · </span>
              {p.betting.reggieCall}
            </div>
          </div>
        </div>

        {/* CONTRACT SECTION — bottom of the page per spec */}
        <ContractCard contract={p.contract} teamColor={p.teamColor} />
      </div>
    </div>
  );
}

/* ---------------------------- CONTRACT ---------------------------- */

function ContractCard({ contract, teamColor }) {
  const toneColor = { green: "#22c55e", blue: "#38bdf8", gold: "#eab308", gray: "#71717a" };
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-6" data-testid="contract-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" style={{ color: teamColor }} />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#fff" }}>
            CONTRACT DETAIL
          </span>
        </div>
        <span className="text-[11px] text-white/40" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
          SIGNED {contract.signed.toUpperCase()}
        </span>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pb-5 border-b border-white/10">
        <StatCell label="AAV"          value={contract.aav} />
        <StatCell label="TOTAL"        value={contract.totalValue} />
        <StatCell label="TERM"         value={contract.term} />
        <StatCell label="EXPIRY"       value={contract.expiry} />
        <StatCell label="% OF CAP"     value={contract.cap.pctOfCap} sub="est. 2025-26" />
      </div>

      {/* Clauses */}
      <div className="pt-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-3.5 h-3.5 text-white/60" />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
            CLAUSES & PROTECTION
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {contract.clauses.map((c, i) => (
            <div key={i} className="px-3 py-2 rounded-md flex items-center gap-2"
                 style={{
                   background: `${toneColor[c.tone]}22`,
                   border: `1px solid ${toneColor[c.tone]}55`,
                 }}>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.15em", color: toneColor[c.tone] }}>
                {c.label}
              </span>
              <span className="text-white/60 text-[12px]" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
                {c.years}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-[14px] text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
          <span className="text-white/50" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em", fontSize: "11px" }}>STRUCTURE · </span>
          {contract.structure}
        </div>
      </div>

      {/* Per-year table */}
      <div className="pt-4">
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
          PER-YEAR BREAKDOWN
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-[11px]" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
                <th className="text-left py-2 pr-3">SEASON</th>
                <th className="text-right pr-3">CAP HIT</th>
                <th className="text-right pr-3">BASE $</th>
                <th className="text-right pr-3">SIGN. BONUS</th>
                <th className="text-left pl-3">NOTES</th>
              </tr>
            </thead>
            <tbody>
              {contract.byYear.map((row, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="py-2.5 pr-3 text-white/70" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.1em", fontSize: "12px" }}>{row.year}</td>
                  <td className="text-right pr-3 tabular-nums text-white" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>{row.cap}</td>
                  <td className="text-right pr-3 tabular-nums text-white/80" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{row.base}</td>
                  <td className="text-right pr-3 tabular-nums" style={{ fontFamily: "Rajdhani", fontWeight: 700, color: "#eab308" }}>{row.sb}</td>
                  <td className="pl-3 text-white/60 text-[13px]" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-[13px] text-white/60" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.5 }}>
          <span style={{ color: "#eab308", fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em", fontSize: "11px" }}>BUYOUT NOTE · </span>
          {contract.cap.deadCapIfBoughtOut}
        </div>
      </div>
    </div>
  );
}
