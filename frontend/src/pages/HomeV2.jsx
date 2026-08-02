// V2 Home — the team command center.
//
// Answers one question in under 10 seconds: "Where does my team stand
// right now?" Every panel is visual-first, every stat carries a league
// rank, every rank is color-coded. Reggie's audio take sits above the
// dashboard so a fan can either read or listen — never both required.
//
// Cup Score™ formula (v1 weights, transparent on the page):
//   xGF%           25%
//   Goal Diff      25%
//   Goalie GSAx    20%
//   Special Teams  15%
//   Recent Form    15%
//
// Route: /home-v2 (A/B alongside the current /press-conference until
// approved).

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Info, Volume2, ArrowUp, ArrowDown, Minus, Target, Shield, Zap,
  ChevronRight, TrendingUp, AlertTriangle, Play, Crosshair,
} from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { TMark, C } from "@/lib/brand";

/* ================================================================
   SEED DATA — mirrors the V2 mockup. Real NHL/Highlightly hydration
   comes in a follow-up. Numbers here are demo-strength: internally
   consistent so the Cup Score math actually adds up to what's shown.
   ================================================================ */

const TEAMS = {
  MTL: {
    code: "MTL",
    name: "Montreal Canadiens",
    division: "Atlantic Division",
    primary: "#AF1E2D",
    accent: "#192168",
    record: { w: 32, l: 18, ot: 6, gd: 48, points: 70 },
    cupScore: {
      value: 84,
      trend: +6,
      trendWindow: "7 days",
      breakdown: [
        { label: "xGF%",           value: "57.2",  weight: 25 },
        { label: "Goal Diff",      value: "+48",   weight: 25 },
        { label: "Goalie GSAx",    value: "+12.3", weight: 20 },
        { label: "Special Teams",  value: "+9.1%", weight: 15 },
        { label: "Recent Form",    value: "9-1-0", weight: 15 },
      ],
    },
    story: [
      { icon: "target",   label: "Elite Offense",     rank: "4th in NHL",  value: "3.68 GF/Game", tone: "good" },
      { icon: "goalie",   label: "Strong Goaltending", rank: "8th in NHL", value: ".914 Save %",  tone: "good" },
      { icon: "shield",   label: "Great Penalty Kill", rank: "5th in NHL", value: "82.6% PK %",   tone: "good" },
      { icon: "faceoff",  label: "Face-offs Hurting Us", rank: "27th in NHL", value: "48.7% FO %", tone: "bad" },
      { icon: "calendar", label: "Road Struggles",    rank: "16-11-3",     value: "On The Road",  tone: "bad" },
    ],
    reggieQuote: "We've got the firepower, our goalie is bailing us out, and our PK is shutting doors. Fix the faceoffs and this team can make noise.",
    pillars: {
      offense: {
        rank: 4, color: "#ef4444",
        rows: [
          { label: "Goals / Game",              value: "3.68", rank: 4  },
          { label: "Expected Goals / Game",     value: "3.45", rank: 4  },
          { label: "Shooting %",                value: "10.2%",rank: 6  },
          { label: "High Danger Chances / Game",value: "14.1", rank: 3  },
          { label: "Rush Chances / Game",       value: "12.6", rank: 5  },
        ],
      },
      defense: {
        rank: 9, color: "#3b82f6",
        rows: [
          { label: "Goals Against / Game",           value: "2.61", rank: 10 },
          { label: "Expected Goals Against / Game",  value: "2.79", rank: 9  },
          { label: "Shots Against / Game",           value: "28.7", rank: 11 },
          { label: "High Danger Chances Against",    value: "10.8", rank: 10 },
          { label: "Blocks / Game",                  value: "17.6", rank: 8  },
        ],
      },
      goaltending: {
        rank: 8, color: "#14b8a6",
        rows: [
          { label: "Save %",                        value: ".914", rank: 8  },
          { label: "Goals Saved Above Expected",    value: "+12.3", rank: 7 },
          { label: "Quality Starts %",              value: "61%",  rank: 7  },
          { label: "Shutouts",                      value: "5",    rank: 6  },
          { label: "Last 10 Games (SV%)",           value: ".931", rank: 5  },
        ],
      },
      specialTeams: {
        rank: 7, color: "#a855f7",
        rows: [
          { label: "Power Play %",         value: "24.2%", rank: 7  },
          { label: "Penalty Kill %",       value: "82.6%", rank: 5  },
          { label: "Special Teams %",      value: "+9.1%", rank: 7  },
          { label: "Penalty Differential", value: "+58",   rank: 6  },
          { label: "Face-off %",           value: "48.7%", rank: 27 },
        ],
      },
    },
    momentum: {
      streak: [true, true, true, true, false], // last 5 wins
      label: "PLAYING OUR BEST HOCKEY",
      lastTen: { record: "9-1-0", goalDiff: "+18" },
      quick: [
        { label: "GF/G", value: "3.68", rank: 4 },
        { label: "GA/G", value: "2.10", rank: 6 },
        { label: "SV%",  value: ".931", rank: 5 },
        { label: "PP%",  value: "31.0%", rank: 3 },
      ],
    },
    reggieKeys: {
      good: [
        "We score. A lot. 4th in the league.",
        "Goalie is red-hot. .931 last 10 games.",
        "PK is elite. Top 5 in the NHL.",
      ],
      concern: [
        "Faceoff battle is a huge weakness.",
        "We take too many penalties on the road.",
      ],
      keyTonight: "Win the faceoff battle. Keep this 5-on-5 and our skill will take over.",
    },
    injuries: [
      { name: "Auston Matthews",  pos: "C", tag: "Upper Body",  status: "OUT",         eta: "May 10",   impact: "high"   }, // seed sample
      { name: "T.J. Brodie",      pos: "D", tag: "Lower Body",  status: "DAY-TO-DAY",  eta: "Apr 29",   impact: "medium" },
      { name: "David Reinbacher", pos: "D", tag: "Shoulder",    status: "IR",          eta: "Unknown",  impact: "low"    },
    ],
    injuryImpact: "moderate",
    accuracyLeaders: [
      { name: "Cole Caufield",    pos: "RW", stat: "Shooting %",     value: "17.4%", rank: 4  },
      { name: "Nick Suzuki",      pos: "C",  stat: "Face-off Win %", value: "54.8%", rank: 9  },
      { name: "Sam Montembeault", pos: "G",  stat: "Save %",         value: ".914",  rank: 8  },
      { name: "Lane Hutson",      pos: "D",  stat: "+/-",            value: "+22",   rank: 6  },
    ],
    highlights: [
      { title: "Suzuki wrister roofs it top corner",  when: "1st · 8:42",  team: "MTL" },
      { title: "Caufield PP one-timer from the dot",  when: "2nd · 14:11", team: "MTL" },
      { title: "Montembeault paddle-save robbery",    when: "3rd · 5:03",  team: "MTL" },
    ],
    tonight: {
      opp: "BOS", oppName: "BOS", venue: "TD Garden, Boston, MA", time: "TONIGHT 7:00 PM ET",
      projectedEdge: { home: 55, away: 45 },
    },
  },
  BOS: {
    code: "BOS",
    name: "Boston Bruins",
    division: "Atlantic Division",
    primary: "#FFB81C",
    accent: "#000000",
    record: { w: 44, l: 17, ot: 5, gd: 62, points: 93 },
    cupScore: {
      value: 88, trend: +2, trendWindow: "7 days",
      breakdown: [
        { label: "xGF%",           value: "58.4",  weight: 25 },
        { label: "Goal Diff",      value: "+62",   weight: 25 },
        { label: "Goalie GSAx",    value: "+18.1", weight: 20 },
        { label: "Special Teams",  value: "+11.4%",weight: 15 },
        { label: "Recent Form",    value: "8-2-0", weight: 15 },
      ],
    },
    story: [
      { icon: "target",   label: "Elite Offense",       rank: "3rd in NHL", value: "3.82 GF/Game", tone: "good" },
      { icon: "goalie",   label: "Vezina-Track Goalie", rank: "2nd in NHL", value: ".928 Save %",  tone: "good" },
      { icon: "shield",   label: "Structured D",        rank: "4th in NHL", value: "2.38 GA/Game", tone: "good" },
      { icon: "faceoff",  label: "PP Cooling Off",      rank: "18th in NHL",value: "19.4% PP %",   tone: "bad" },
      { icon: "calendar", label: "Home Ice Beast",      rank: "24-6-2",     value: "at TD Garden", tone: "good" },
    ],
    reggieQuote: "This team wins the game the right way — five-on-five, backed by Swayman standing on his head. Fix the power play and we're a Cup problem.",
    pillars: {
      offense:      { rank: 3,  color: "#ef4444", rows: [
        { label: "Goals / Game", value: "3.82", rank: 3 },
        { label: "Expected Goals / Game", value: "3.58", rank: 4 },
        { label: "Shooting %", value: "10.8%", rank: 4 },
        { label: "High Danger Chances / Game", value: "13.9", rank: 4 },
        { label: "Rush Chances / Game", value: "11.2", rank: 8 },
      ]},
      defense:      { rank: 4,  color: "#3b82f6", rows: [
        { label: "Goals Against / Game", value: "2.38", rank: 4 },
        { label: "Expected Goals Against / Game", value: "2.51", rank: 3 },
        { label: "Shots Against / Game", value: "27.4", rank: 6 },
        { label: "High Danger Chances Against", value: "9.6", rank: 3 },
        { label: "Blocks / Game", value: "16.9", rank: 11 },
      ]},
      goaltending:  { rank: 2,  color: "#14b8a6", rows: [
        { label: "Save %", value: ".928", rank: 2 },
        { label: "Goals Saved Above Expected", value: "+18.1", rank: 2 },
        { label: "Quality Starts %", value: "68%", rank: 3 },
        { label: "Shutouts", value: "7", rank: 2 },
        { label: "Last 10 Games (SV%)", value: ".936", rank: 2 },
      ]},
      specialTeams: { rank: 15, color: "#a855f7", rows: [
        { label: "Power Play %", value: "19.4%", rank: 18 },
        { label: "Penalty Kill %", value: "84.1%", rank: 3 },
        { label: "Special Teams %", value: "+3.5%", rank: 14 },
        { label: "Penalty Differential", value: "+42", rank: 12 },
        { label: "Face-off %", value: "52.4%", rank: 6 },
      ]},
    },
    momentum: {
      streak: [true, true, false, true, true],
      label: "STEADY AS SHE GOES",
      lastTen: { record: "8-2-0", goalDiff: "+14" },
      quick: [
        { label: "GF/G", value: "3.82", rank: 3 },
        { label: "GA/G", value: "2.38", rank: 4 },
        { label: "SV%",  value: ".936", rank: 2 },
        { label: "PP%",  value: "19.4%", rank: 18 },
      ],
    },
    reggieKeys: {
      good: [
        "Swayman's a wall right now. Best goalie in the world last 30 days.",
        "PK is a top-3 unit. We survive the tough minutes.",
        "Home record is filthy — 24-6-2.",
      ],
      concern: [
        "Power play needs a shake-up. We can't score 5-on-4.",
        "Second line has gone quiet — needs a spark.",
      ],
      keyTonight: "Win the second period. If we're tied after 40, Swayman closes the door.",
    },
    injuries: [
      { name: "Charlie McAvoy",  pos: "D", tag: "Lower Body",  status: "DAY-TO-DAY", eta: "Game-time", impact: "high" },
      { name: "Matt Poitras",    pos: "C", tag: "Shoulder",    status: "OUT",        eta: "May 15",    impact: "medium" },
    ],
    injuryImpact: "moderate",
    accuracyLeaders: [
      { name: "David Pastrnak",  pos: "RW", stat: "Shooting %",     value: "16.8%", rank: 5  },
      { name: "Charlie Coyle",   pos: "C",  stat: "Face-off Win %", value: "58.2%", rank: 3  },
      { name: "Jeremy Swayman",  pos: "G",  stat: "Save %",         value: ".928",  rank: 2  },
      { name: "Charlie McAvoy",  pos: "D",  stat: "+/-",            value: "+34",   rank: 2  },
    ],
    highlights: [
      { title: "Pastrnak snipes short-side",           when: "1st · 12:04", team: "BOS" },
      { title: "Swayman robs a two-on-none",           when: "2nd · 7:38",  team: "BOS" },
      { title: "Marchand cheeky lacrosse pass to Pasta",when: "3rd · 15:12",team: "BOS" },
    ],
    tonight: {
      opp: "MTL", oppName: "MTL", venue: "TD Garden, Boston, MA", time: "TONIGHT 7:00 PM ET",
      projectedEdge: { home: 62, away: 38 },
    },
  },
};

const TEAM_ORDER = ["MTL", "BOS"];

/* ---------------------------- HELPERS ---------------------------- */

function rankColor(rank) {
  if (rank <= 8)  return { color: "#22c55e", label: "top" };   // green — top-8
  if (rank <= 16) return { color: "#eab308", label: "mid" };   // yellow — 9-16
  return { color: "#ef4444", label: "bot" };                    // red — 17+
}
function rankBadge(rank) {
  const suffix = rank % 10 === 1 && rank !== 11 ? "st" :
                 rank % 10 === 2 && rank !== 12 ? "nd" :
                 rank % 10 === 3 && rank !== 13 ? "rd" : "th";
  return `${rank}${suffix}`;
}

const STORY_ICONS = {
  target:   Target,
  goalie:   Shield,
  shield:   Shield,
  faceoff:  AlertTriangle,
  calendar: TrendingUp,
};

/* ---------------------------- ICONS ---------------------------- */

function ArrowTrend({ trend }) {
  if (trend > 0) return <ArrowUp className="w-4 h-4 text-emerald-400" />;
  if (trend < 0) return <ArrowDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-white/40" />;
}

/* ---------------------------- PANELS ---------------------------- */

function CupScoreCard({ team }) {
  const { cupScore } = team;
  const [openBreakdown, setOpenBreakdown] = useState(false);
  // Colored ring around the number
  const ringColor = cupScore.value >= 75 ? "#22c55e" : cupScore.value >= 55 ? "#eab308" : "#ef4444";
  const trending = cupScore.trend > 0 ? "TRENDING UP" : cupScore.trend < 0 ? "TRENDING DOWN" : "STEADY";
  const trendColor = cupScore.trend > 0 ? "#22c55e" : cupScore.trend < 0 ? "#ef4444" : "#a0a0a5";
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-6" data-testid="cup-score-card">
      <div className="grid md:grid-cols-2 gap-6 items-center">
        {/* Left — the score with SVG ring */}
        <div className="flex items-center gap-5">
          <div className="relative" style={{ width: 130, height: 130 }}>
            <svg width="130" height="130" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r="56" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
              <circle
                cx="65" cy="65" r="56"
                stroke={ringColor} strokeWidth="10" fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(cupScore.value / 100) * 2 * Math.PI * 56} ${2 * Math.PI * 56}`}
                transform="rotate(-90 65 65)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "56px", color: "#fff", lineHeight: 1 }}>
                {cupScore.value}
              </span>
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
                /100
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
                CUP SCORE
              </span>
              <span className="text-white/25" title="Composite team rating — see breakdown">
                <Info className="w-3.5 h-3.5" />
              </span>
              <span className="ml-1 text-[9px] text-white/45" style={{ fontFamily: "Oswald", letterSpacing: "0.2em" }}>™</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <ArrowTrend trend={cupScore.trend} />
              <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.2em", color: trendColor }}>
                {trending}
              </span>
            </div>
            <div className="mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "14px", color: "#a0a0a5" }}>
              {cupScore.trend > 0 ? "+" : ""}{cupScore.trend} pts last {cupScore.trendWindow}
            </div>
          </div>
        </div>

        {/* Right — the transparent breakdown */}
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
            HOW IT'S CALCULATED
          </div>
          <div className="mt-2 space-y-1.5">
            {cupScore.breakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between text-[15px]">
                <span className="text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
                  {b.label} ({b.value})
                </span>
                <span className="text-white/60 tabular-nums" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.05em" }}>
                  {b.weight}%
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setOpenBreakdown(!openBreakdown)}
            className="mt-3 text-[13px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
            style={{ fontFamily: "Rajdhani", fontWeight: 600 }}
          >
            Learn more <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NextGameCard({ team }) {
  const t = team;
  const opp = TEAMS[t.tonight.opp];
  const { projectedEdge } = t.tonight;
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5" data-testid="next-game-card">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
          NEXT GAME
        </span>
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.25em", color: "#1E5BFF" }}>
          {t.tonight.time}
        </span>
      </div>
      <div className="flex items-center justify-around py-2">
        <div className="flex flex-col items-center gap-1">
          <TeamLogo code={t.code} size={64} />
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px" }}>{t.code}</div>
        </div>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: "#a0a0a5" }}>VS</div>
        <div className="flex flex-col items-center gap-1">
          <TeamLogo code={t.tonight.opp} size={64} />
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px" }}>{t.tonight.opp}</div>
        </div>
      </div>
      <div className="text-center text-[13px] text-white/60 mb-3" style={{ fontFamily: "Rajdhani", fontWeight: 600, letterSpacing: "0.05em" }}>
        {t.tonight.venue}
      </div>
      <div className="pt-3 border-t border-white/10">
        <div className="flex items-center justify-between text-[11px] mb-2" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.28em" }}>
          <span className="text-white/60">PROJECTED EDGE</span>
          <span className="text-white/40">TICKER MODEL</span>
        </div>
        <div className="relative h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-y-0 left-0" style={{ width: `${projectedEdge.home}%`, background: "linear-gradient(90deg, #ef4444, #eab308)" }} />
          <div className="absolute inset-y-0 top-0 bottom-0" style={{ left: `${projectedEdge.home}%`, right: 0, background: "rgba(255,255,255,0.1)" }} />
        </div>
        <div className="mt-1 flex justify-between text-[13px]" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
          <span style={{ color: "#ef4444" }}>{projectedEdge.home}%</span>
          <span className="text-white/60">{projectedEdge.away}%</span>
        </div>
      </div>
      <button className="mt-4 w-full py-2.5 rounded-md border border-white/15 hover:border-white/40 text-white/90"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.2em" }}
              data-testid="matchup-preview-btn">
        MATCHUP PREVIEW →
      </button>
    </div>
  );
}

function StoryAtAGlance({ team }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5" data-testid="story-at-a-glance">
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
          THE STORY AT A GLANCE
        </span>
        <button className="flex items-center gap-2 text-[13px] text-white/70 hover:text-white"
                style={{ fontFamily: "Rajdhani", fontWeight: 600 }}
                data-testid="reggie-take-btn">
          Reggie's take in 12 seconds <Volume2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {team.story.map((s, i) => {
          const Icon = STORY_ICONS[s.icon] || Target;
          const isGood = s.tone === "good";
          return (
            <div
              key={i}
              className="rounded-lg p-4 border text-center"
              style={{
                background: isGood ? "linear-gradient(180deg, #14532d33, #0b0b1080)" : "linear-gradient(180deg, #7f1d1d33, #0b0b1080)",
                borderColor: isGood ? "#16a34a55" : "#dc262655",
              }}
            >
              <div className="flex justify-center mb-2">
                <Icon className="w-8 h-8" style={{ color: isGood ? "#22c55e" : "#f87171" }} />
              </div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff", lineHeight: 1.15 }}>
                {s.label}
              </div>
              <div className="mt-2" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.15em", color: isGood ? "#22c55e" : "#f87171" }}>
                {s.rank}
              </div>
              <div className="mt-0.5 text-[12px] text-white/60" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
                {s.value}
              </div>
            </div>
          );
        })}
      </div>
      {/* Reggie's quote — Ticker Blue accent card for eye attraction */}
      <div className="mt-5 rounded-lg p-4 flex items-start gap-4"
           style={{
             background: "linear-gradient(135deg, rgba(30,91,255,0.18) 0%, rgba(30,91,255,0.04) 100%)",
             border: "1px solid rgba(30,91,255,0.55)",
             boxShadow: "0 0 24px -8px rgba(30,91,255,0.45)",
           }}>
        <div className="h-14 w-14 rounded-full flex-shrink-0 flex items-center justify-center"
             style={{ background: "#1E5BFF33", border: "1.5px solid #1E5BFF" }}>
          <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#1E5BFF" }}>RH</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", letterSpacing: "0.3em", color: "#1E5BFF" }}>
              REGGIE HARLOW
            </span>
            <span className="text-[10px] text-white/45" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.25em" }}>
              · YOUR HOST
            </span>
          </div>
          <div className="mt-1.5 text-[17px] text-white" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.4 }}>
            "{team.reggieQuote}"
          </div>
        </div>
      </div>
    </div>
  );
}

function PillarCard({ title, icon: Icon, color, pillar }) {
  const rc = rankColor(pillar.rank);
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
               style={{ background: color + "33", border: `1px solid ${color}55` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
            {title}
          </span>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: rc.color, lineHeight: 1 }}>
            {rankBadge(pillar.rank)}
          </div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
            NHL
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {pillar.rows.map((r, i) => {
          const c = rankColor(r.rank);
          const pct = Math.max(6, Math.min(100, 100 - ((r.rank - 1) / 31) * 100));
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>{r.label}</span>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, color: "#fff" }}>{r.value}</span>
                  <span className="w-8 text-right" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", color: c.color, letterSpacing: "0.1em" }}>
                    {rankBadge(r.rank)}
                  </span>
                </div>
              </div>
              <div className="mt-0.5 h-[3px] rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
              </div>
            </div>
          );
        })}
      </div>
      <button className="mt-4 w-full py-2 rounded-sm text-white/70 hover:text-white border border-white/10 hover:border-white/40"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.2em" }}>
        VIEW {title} DETAILS →
      </button>
    </div>
  );
}

function MomentumMeter({ team }) {
  const { momentum } = team;
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "14px", letterSpacing: "0.3em", color: "#fff" }}>
            LAST 10
          </span>
          <span className="ml-2 text-[11px] text-white/45" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
            · MOMENTUM
          </span>
        </div>
        <Info className="w-3.5 h-3.5 text-white/30" />
      </div>
      <div className="flex items-end gap-1.5 mb-2">
        {momentum.streak.map((up, i) => (
          <div key={i}
               className="flex-1 rounded-t"
               style={{
                 height: up ? 60 : 30,
                 background: up ? "linear-gradient(180deg, #22c55e, #14532d)" : "linear-gradient(180deg, #7f1d1d, #dc2626)",
                 opacity: 0.35 + (i * 0.15),
               }}>
            <div className="w-full h-full flex items-start justify-center pt-1">
              {up
                ? <ArrowUp className="w-4 h-4 text-white" strokeWidth={3} />
                : <ArrowDown className="w-4 h-4 text-white" strokeWidth={3} />}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#22c55e", letterSpacing: "0.02em" }}>
        {momentum.label}
      </div>
      <div className="mt-1 flex items-baseline gap-3" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
        <span className="text-[18px] text-white">{momentum.lastTen.record}</span>
        <span className="text-[13px] text-white/60">{momentum.lastTen.goalDiff} Goal Differential</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 pt-3 border-t border-white/10">
        {momentum.quick.map((q, i) => {
          const c = rankColor(q.rank);
          return (
            <div key={i} className="text-center">
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em", color: "#a0a0a5" }}>{q.label}</div>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: "#fff", lineHeight: 1.05 }}>{q.value}</div>
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.15em", color: c.color }}>{rankBadge(q.rank)}</div>
            </div>
          );
        })}
      </div>
      <button className="mt-4 w-full py-2 rounded-sm text-white/70 hover:text-white border border-white/10"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.2em" }}>
        VIEW GAME LOG →
      </button>
    </div>
  );
}

function ReggieKeys({ team }) {
  const { reggieKeys } = team;
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
          REGGIE'S KEYS TO TONIGHT
        </span>
        <Info className="w-3.5 h-3.5 text-white/30" />
      </div>
      <div className="space-y-3">
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#22c55e" }}>
            THE GOOD
          </div>
          <ul className="mt-1 space-y-1">
            {reggieKeys.good.map((k, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>
                <span className="text-emerald-400 mt-0.5">✓</span> {k}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#f97316" }}>
            THE CONCERN
          </div>
          <ul className="mt-1 space-y-1">
            {reggieKeys.concern.map((k, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.35 }}>
                <span className="text-orange-400 mt-0.5">◆</span> {k}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em", color: "#1E5BFF" }}>
            TONIGHT'S KEY
          </div>
          <div className="mt-1 text-[14px] text-white/90" style={{ fontFamily: "Rajdhani", fontWeight: 600, lineHeight: 1.4 }}>
            {reggieKeys.keyTonight}
          </div>
        </div>
      </div>
    </div>
  );
}

function InjuryImpact({ team }) {
  const impactColor = team.injuryImpact === "high" ? "#ef4444" : team.injuryImpact === "moderate" ? "#eab308" : "#22c55e";
  const impactLabel = team.injuryImpact.toUpperCase();
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
          INJURY IMPACT
        </span>
        <span className="px-2 py-1 rounded text-[11px]"
              style={{ background: impactColor + "22", color: impactColor, border: `1px solid ${impactColor}55`, fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.15em" }}>
          ● {impactLabel}
        </span>
      </div>
      <div className="space-y-3">
        {team.injuries.map((inj, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Silhouette placeholder — real headshots come later */}
            <div className="h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "12px", color: "#a0a0a5" }}>
                {inj.name.split(" ").map(n => n[0]).join("")}
              </span>
            </div>
            <div className="flex-1">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff" }}>{inj.name}</div>
              <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "11px", letterSpacing: "0.1em", color: "#a0a0a5" }}>
                {inj.pos} · {inj.tag}
              </div>
              <div className="text-[11px] text-white/50" style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>Est. Return: {inj.eta}</div>
            </div>
            <div className="text-right">
              <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.15em",
                            color: inj.status === "OUT" ? "#ef4444" : inj.status === "IR" ? "#ef4444" : "#eab308" }}>
                {inj.status}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="mt-4 w-full py-2 rounded-sm text-white/70 hover:text-white border border-white/10 flex items-center justify-center gap-2"
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.2em" }}>
        VIEW FULL INJURY REPORT →
      </button>
    </div>
  );
}

/* ---------------------------- PAGE ---------------------------- */

function TeamLeadersAccuracy({ team }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5" data-testid="team-leaders-accuracy">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-sky-400" />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
            TEAM LEADERS · ACCURACY
          </span>
        </div>
        <span className="text-[11px] text-white/45" style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}>
          THIS SEASON
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {team.accuracyLeaders.map((p, i) => {
          const c = rankColor(p.rank);
          return (
            <button key={i}
                    className="rounded-md border border-white/10 bg-black/50 hover:border-white/40 p-3 text-left transition-colors"
                    data-testid={`accuracy-leader-${i}`}>
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                     style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <span style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "12px", color: "#a0a0a5" }}>
                    {p.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <div className="min-w-0">
                  <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff", lineHeight: 1.15 }}>
                    {p.name}
                  </div>
                  <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.15em", color: "#a0a0a5" }}>
                    {p.pos} · {p.stat.toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "28px", color: "#fff", lineHeight: 1 }}>
                  {p.value}
                </div>
                <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "12px", color: c.color, letterSpacing: "0.15em" }}>
                  {rankBadge(p.rank)} NHL
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HighlightsRail({ team }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-5" data-testid="highlights-rail">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-red-400" fill="currentColor" />
          <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "13px", letterSpacing: "0.28em", color: "#fff" }}>
            LAST NIGHT'S HIGHLIGHTS
          </span>
        </div>
        <Link to="/" className="text-[13px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
              style={{ fontFamily: "Rajdhani", fontWeight: 600 }}>
          Full Recap Show <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {team.highlights.map((h, i) => (
          <button key={i}
                  className="group relative aspect-video rounded-md overflow-hidden border border-white/10 hover:border-white/40 transition-all"
                  style={{ background: `linear-gradient(135deg, ${team.primary}44 0%, #0b0b10 70%)` }}
                  data-testid={`highlight-tile-${i}`}>
            <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
              <TeamLogo code={h.team} size={64} />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black to-transparent text-left">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff", lineHeight: 1.25 }}>
                {h.title}
              </div>
              <div className="mt-0.5" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.2em", color: "#a0a0a5" }}>
                {h.when}
              </div>
            </div>
            <div className="absolute top-2 right-2 h-10 w-10 rounded-full flex items-center justify-center bg-red-600/95 group-hover:scale-110 transition-transform"
                 style={{ boxShadow: "0 4px 20px -4px rgba(239,68,68,0.7)" }}>
              <Play className="w-4 h-4 text-white translate-x-[1.5px]" fill="currentColor" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomeV2() {
  const [params, setParams] = useSearchParams();
  const [teamCode, setTeamCode] = useState(() => params.get("team")?.toUpperCase() || "MTL");
  const team = TEAMS[teamCode] || TEAMS.MTL;

  useEffect(() => {
    if (params.get("team")?.toUpperCase() !== teamCode) {
      const next = new URLSearchParams(params);
      next.set("team", teamCode);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamCode]);

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white pb-24" data-testid="home-v2-page">
      {/* Sub-header with team switcher (audition only — the top-nav MY TEAM
       * dropdown will replace this once the nav restructure ships) */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="flex items-center gap-3">
          <TeamLogo code={team.code} size={44} />
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "26px", letterSpacing: "0.02em", color: "#fff", lineHeight: 1 }}>
              {team.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.3em", color: "#a0a0a5" }}>
              {team.division.toUpperCase()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter the CURRENT team out — showing it twice is redundant
           * (we already have the big header logo). Switcher is for scouting
           * other franchises. */}
          {TEAM_ORDER.filter((c) => c !== teamCode).map((c) => (
            <button key={c} onClick={() => setTeamCode(c)}
                    className="h-10 w-10 rounded-md flex items-center justify-center border border-white/15 hover:border-white/50 transition-all"
                    title={`Peek at ${TEAMS[c].name}`}
                    data-testid={`home-v2-team-${c}`}>
              <TeamLogo code={c} size={26} />
            </button>
          ))}
          <Link
            to="/press-conference"
            className="ml-2 text-[11px] text-white/50 hover:text-white/90"
            style={{ fontFamily: "Oswald", fontWeight: 700, letterSpacing: "0.2em" }}
          >
            ← V1
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Row 1 — Cup Score + Next Game */}
        <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
          <CupScoreCard team={team} />
          <NextGameCard team={team} />
        </div>

        {/* Row 2 — Story at a glance (full width) */}
        <StoryAtAGlance team={team} />

        {/* Row 3 — Four Performance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PillarCard title="OFFENSE"       icon={Target} color={team.pillars.offense.color}      pillar={team.pillars.offense} />
          <PillarCard title="DEFENSE"       icon={Shield} color={team.pillars.defense.color}      pillar={team.pillars.defense} />
          <PillarCard title="GOALTENDING"   icon={Shield} color={team.pillars.goaltending.color}  pillar={team.pillars.goaltending} />
          <PillarCard title="SPECIAL TEAMS" icon={Zap}    color={team.pillars.specialTeams.color} pillar={team.pillars.specialTeams} />
        </div>

        {/* Row 4 — Team Leaders (accuracy) */}
        <TeamLeadersAccuracy team={team} />

        {/* Row 5 — Last Night's Highlights (video rail) */}
        <HighlightsRail team={team} />

        {/* Row 6 — Last 10 + Reggie's Keys + Injuries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MomentumMeter team={team} />
          <ReggieKeys team={team} />
          <InjuryImpact team={team} />
        </div>
      </div>
    </div>
  );
}
