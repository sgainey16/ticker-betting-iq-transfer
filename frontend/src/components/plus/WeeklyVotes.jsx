// Weekly Votes — the cross-league voting rail.
// -----------------------------------------------------------------------------
// The unified-hockey product idea in one component. One card, tabbed across
// content categories, each pulling one entry per league (NHL · AHL · WHL /
// NCAA rotating). Users vote once per category per week; votes are cached
// locally so the demo works end-to-end without a backend.
//
// Categories:
//   • Fight  — code, respect, honest scraps (no goon-fest framing)
//   • Goal   — pure skill, moments the game turns on
//   • Play   — reads, passes, coverage brilliance (the stuff casual fans miss)
//   • Culture — "coming soon" — dressing-room visits, fan moments, volunteering
//
// Framing rule (matches the tone reset earlier in the project): every entry
// is written up as *culture and craft*, not as *personality attack*. Reggie's
// quote for each entry defends the game.

import { useMemo, useState } from "react";
import { Zap, Lock, Heart, Trophy } from "lucide-react";
import { emitSignal } from "@/lib/signals";

const WEEK_ID = "2026-w06";
const STORAGE_KEY = `ticker.weeklyvotes.${WEEK_ID}`;

// -----------------------------------------------------------------------------
// The catalog of votable weekly categories. Each entry has one item per league.
// In production these are produced by the Auto-Producer from live events.
// -----------------------------------------------------------------------------
const CATEGORIES = {
  fight: {
    id: "fight",
    label: "Fight",
    tagline: "The code, the respect, the moment.",
    entries: [
      {
        id: "nhl-flyers-bruins", league: "NHL", color: "#FCB514",
        matchup: "PHI @ BOS", where: "TD Garden · Feb 3",
        principal: "Garnet Hathaway", opponent: "Zach Aston-Reese",
        frame: "Response fight", tag: "Vet vs vet",
        reggie: "Hathaway wasn't gonna let that hit on Pastrnak slide. Full respect between two guys who know the code.",
      },
      {
        id: "ahl-hershey-charlotte", league: "AHL", color: "#7A0019",
        matchup: "CLT @ HER", where: "Giant Center · Feb 4",
        principal: "Hendrix Lapierre", opponent: "Mackenzie MacEachern",
        frame: "Heavyweight square-up", tag: "Old school",
        reggie: "Two heavyweights, gloves off after a scrum. Honest scrap, both guys still standing at the whistle.",
      },
      {
        id: "whl-blazers-winterhawks", league: "WHL", color: "#F58220",
        matchup: "PDX @ KAM", where: "Sandman Centre · Feb 5",
        principal: "Ben Riche", opponent: "Diego Buttazzoni",
        frame: "Playoff push", tag: "Kids stepping up",
        reggie: "Two eighteen-year-olds sending a message with three weeks to WHL playoffs. Real pride in that scrap.",
      },
    ],
  },
  goal: {
    id: "goal",
    label: "Goal",
    tagline: "Pure skill. The moments the game turns on.",
    entries: [
      {
        id: "nhl-mccar-goal", league: "NHL", color: "#6F263D",
        matchup: "VGK @ COL", where: "Ball Arena · Feb 2",
        principal: "Cale Makar", opponent: "Adin Hill",
        frame: "End-to-end", tag: "Superstar shift",
        reggie: "Two Vegas defenders on the ice. Makar cuts through all three of them, roof. Best in the league at that shift.",
      },
      {
        id: "ahl-firebirds-goal", league: "AHL", color: "#001628",
        matchup: "SDG @ CBH", where: "Acrisure Arena · Feb 3",
        principal: "Shane Wright", opponent: "Beck Warm",
        frame: "First AHL goal", tag: "Callup teaser",
        reggie: "Wright's first pro goal — one-timer top corner. Kraken faithful, you're watching your future here.",
      },
      {
        id: "whl-oliver-goal", league: "WHL", color: "#F58220",
        matchup: "KAM @ VIC", where: "Save-On-Foods Centre · Feb 4",
        principal: "Kaid Oliver", opponent: "Cole Reschny",
        frame: "In-tight backhand", tag: "Twenty-third of the year",
        reggie: "Oliver just refuses to be denied around the net. Twenty-third of the year — draft stock rising every week.",
      },
    ],
  },
  play: {
    id: "play",
    label: "Play",
    tagline: "Reads, passes, coverage. The stuff casual fans miss.",
    entries: [
      {
        id: "nhl-makar-stretch", league: "NHL", color: "#6F263D",
        matchup: "COL @ DAL", where: "American Airlines · Feb 1",
        principal: "Cale Makar", opponent: "-",
        frame: "80-foot stretch pass", tag: "Pass of the year",
        reggie: "Blind, backhand, tape-to-tape from his own zone. Makar's hockey IQ is a different sport sometimes.",
      },
      {
        id: "ohl-petrov-backcheck", league: "OHL", color: "#C41230",
        matchup: "KIT @ WSR", where: "WFCU Centre · Feb 4",
        principal: "Max Petrov", opponent: "-",
        frame: "Diving backcheck", tag: "Captain's shift",
        reggie: "Down two, Petrov sprints back and pokes it off the stick at the crease. That's the shift that separates prospects from picks.",
      },
      {
        id: "ncaa-kelso-outlet", league: "NCAA", color: "#CC0000",
        matchup: "BU @ PROV", where: "Amica · Feb 3",
        principal: "Riley Kelso", opponent: "-",
        frame: "First-touch outlet", tag: "Freshman poise",
        reggie: "One-touch pass off the boards, three-on-two the other way, goal. Freshman defenseman doing veteran things.",
      },
    ],
  },
  starpower: {
    id: "starpower",
    label: "Star Power",
    tagline: "Who owned the night — across every league. Vote your one.",
    entries: [
      {
        id: "sp-makar", league: "NHL", color: "#6F263D",
        matchup: "COL vs VGK", where: "Ball Arena · Last night",
        principal: "Cale Makar", opponent: "-",
        frame: "1G · 2A · 8 shots · 26:04 TOI", tag: "Best D on Earth",
        reggie: "Two assists, a highlight-reel goal, twenty-six minutes. He runs the game at both ends — nobody else is doing this shift.",
      },
      {
        id: "sp-howard", league: "NCAA", color: "#00274C",
        matchup: "MICH vs WISC", where: "Yost Ice Arena · Last night",
        principal: "Gabe Howard", opponent: "-",
        frame: "2G · 1A · Yost roars", tag: "Freshman owning grown men",
        reggie: "Two goals as a freshman against a top-five program. Yost was electric — that's the future of Michigan hockey right there.",
      },
      {
        id: "sp-petrov", league: "OHL", color: "#C41230",
        matchup: "KIT vs LDN", where: "Aud · Last night",
        principal: "Max Petrov", opponent: "-",
        frame: "1G · 2A · captain's shift", tag: "Every shift a story",
        reggie: "Two assists, a goal, a fight, and the buzzer-beating clear. Petrov plays 200 feet like a ten-year vet — NHL rooms are watching every shift.",
      },
      {
        id: "sp-oliver", league: "WHL", color: "#F58220",
        matchup: "KAM vs VIC", where: "Sandman Centre · Last night",
        principal: "Kaid Oliver", opponent: "-",
        frame: "2G · 1A · 24th of the year", tag: "First-round riser",
        reggie: "Twenty-fourth of the year and he doesn't miss the top corner. Draft stock's climbing every week — teams have him top-fifteen now.",
      },
    ],
  },
  culture: {
    id: "culture",
    label: "Culture",
    tagline: "Dressing-room visits, fan moments, volunteering. Coming soon.",
    locked: true,
    lockedTeaser: [
      "Player brings a young fan to the room after warmups",
      "Team spends a Saturday at the local children's hospital",
      "Rookie shovels a neighbor's driveway before morning skate",
      "Captain quietly picks up the tab for a family after a game",
    ],
  },
};

// Deterministic warm-start tallies so the card doesn't render at 0.
const BASE_VOTES = {
  "nhl-flyers-bruins": 421,  "ahl-hershey-charlotte": 287, "whl-blazers-winterhawks": 356,
  "nhl-mccar-goal": 892,     "ahl-firebirds-goal": 244,    "whl-oliver-goal": 519,
  "nhl-makar-stretch": 613,  "ohl-petrov-backcheck": 385,  "ncaa-kelso-outlet": 292,
  "sp-makar": 1284,          "sp-howard": 466,             "sp-petrov": 402,           "sp-oliver": 371,
};

function readStore() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function writeStore(v) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); }
  catch { /* quota */ }
}

export function WeeklyVotes() {
  const [active, setActive] = useState("fight");
  const [store, setStore] = useState(readStore);

  const cat = CATEGORIES[active];

  // per-category totals combining baseline + local votes
  const tallies = useMemo(() => {
    if (!cat?.entries) return {};
    const out = {};
    for (const e of cat.entries) {
      const local = store[cat.id]?.tallies?.[e.id] || 0;
      out[e.id] = (BASE_VOTES[e.id] || 0) + local;
    }
    return out;
  }, [cat, store]);

  const total = Object.values(tallies).reduce((a, b) => a + b, 0);
  const myVote = store[cat.id]?.vote || null;
  const alreadyVoted = Boolean(myVote);

  const castVote = (entryId) => {
    if (alreadyVoted) return;
    const next = { ...store, [cat.id]: {
      vote: entryId,
      tallies: { ...(store[cat.id]?.tallies || {}), [entryId]: 1 },
    }};
    writeStore(next);
    setStore(next);
    // Emit signal so ranker learns which leagues/entries this user backs.
    // Star Power gets a heavier weight — voting for a specific player is a
    // stronger affinity than picking a fight of the week.
    const entry = cat.entries?.find(e => e.id === entryId);
    if (entry) {
      emitSignal({
        kind: "weekly_vote",
        league: entry.league || null,
        target: entryId,
        weight: cat.id === "starpower" ? 1.5 : 1,
      });
    }
  };

  return (
    <div data-testid="weekly-votes" className="space-y-3">
      {/* Section header */}
      <div className="flex items-baseline justify-between">
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
            This Week Across Hockey
          </div>
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#fff", lineHeight: 1.2, marginTop: 2 }}>
            Vote the best of the week — every league on one card
          </div>
          <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.18em", color: "#a0a0a5", marginTop: 4 }}>
            Reggie and Marc's picks across NHL, AHL, WHL/OHL, and NCAA — you pick the fight, the goal, the play, and the star.
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-0 overflow-x-auto">
        {Object.values(CATEGORIES).map(c => {
          const isActive = c.id === active;
          const isLocked = Boolean(c.locked);
          return (
            <button
              key={c.id}
              data-testid={`weekly-tab-${c.id}`}
              onClick={() => setActive(c.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 whitespace-nowrap transition-all ${
                isActive
                  ? "text-white"
                  : isLocked
                    ? "text-white/30 hover:text-white/50"
                    : "text-white/50 hover:text-white/80"
              }`}
              style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "11px", letterSpacing: "0.28em" }}
            >
              {isLocked && <Lock className="w-3 h-3" />}
              {c.id === "culture" && !isLocked && <Heart className="w-3 h-3" />}
              {c.id === "starpower" && <Trophy className="w-3 h-3" />}
              {c.label.toUpperCase()}
              {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#F58220]" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {cat.locked ? (
        // "Culture Move" — locked/coming-soon panel that plants the vision
        <div className="rounded-xl border border-dashed border-white/15 bg-black/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-4 h-4 text-[#F58220]" />
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
              Coming soon
            </span>
          </div>
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", color: "#fff", lineHeight: 1.25 }}>
            The moments that make hockey feel like a family.
          </div>
          <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "11px", letterSpacing: "0.18em", color: "#a0a0a5", marginTop: 6 }}>
            {cat.tagline}
          </div>
          <ul className="mt-4 space-y-2 max-w-lg">
            {cat.lockedTeaser?.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-white/70 text-[13px] leading-snug">
                <Heart className="w-3 h-3 text-[#F58220]/70 mt-0.5 flex-shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: "#a0a0a5" }}>
            When we launch this, one vote a week goes to a moment that has nothing to do with the scoreboard.
          </div>
        </div>
      ) : (
        <>
          {/* Category tagline */}
          <div className="flex items-center justify-between">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
              {cat.tagline}
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
              {total.toLocaleString()} votes
            </div>
          </div>

          {/* Entries grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {cat.entries.map(e => {
              const votes = tallies[e.id] || 0;
              const pct = total > 0 ? (votes / total) * 100 : 0;
              const mine = myVote === e.id;
              return (
                <div
                  key={e.id}
                  data-testid={`weekly-entry-${e.id}`}
                  className={`relative rounded-xl border overflow-hidden transition-all ${mine ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10 bg-black/40"}`}
                >
                  <div className="absolute inset-0 opacity-20 pointer-events-none"
                       style={{ background: `radial-gradient(circle at top left, ${e.color}66 0%, transparent 55%)` }} />
                  <div className="relative p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />
                      <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: e.color }}>
                        {e.league}
                      </span>
                      <span className="ml-auto" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
                        {e.tag}
                      </span>
                    </div>
                    <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#fff", lineHeight: 1.2 }}>
                      {e.principal}
                    </div>
                    <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.22em", color: "#a0a0a5", marginTop: 1 }}>
                      {e.opponent !== "-" ? `vs ${e.opponent} · ` : ""}{e.frame}
                    </div>
                    <div className="mt-1" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#7a7a80" }}>
                      {e.matchup} · {e.where}
                    </div>
                    <div className="mt-3 pl-2 border-l-2 border-[#F58220]/40 text-white/85 text-[12px] italic leading-snug">
                      "{e.reggie}"
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.28em", color: mine ? "#4ade80" : "#fff" }}>
                          {votes.toLocaleString()} {votes === 1 ? "vote" : "votes"}
                        </span>
                        <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: mine ? "#4ade80" : e.color }}
                        />
                      </div>
                    </div>
                    <button
                      data-testid={`weekly-vote-${e.id}`}
                      onClick={() => castVote(e.id)}
                      disabled={alreadyVoted}
                      className={`mt-3 w-full rounded-full py-2 transition-all ${
                        mine
                          ? "bg-emerald-500 text-black"
                          : alreadyVoted
                            ? "bg-white/5 text-white/30 cursor-not-allowed"
                            : "bg-[#F58220] text-black hover:bg-[#ff9042] shadow-[0_4px_14px_-4px_rgba(245,130,32,0.6)]"
                      }`}
                      style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.3em" }}
                    >
                      {mine ? "✓ YOUR VOTE" : alreadyVoted ? "VOTED" : "VOTE"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {alreadyVoted && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 flex items-center gap-3">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.24em", color: "#4ade80" }}>
                Vote counted. Come back Monday to hear Reggie announce the winners on the desk.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
