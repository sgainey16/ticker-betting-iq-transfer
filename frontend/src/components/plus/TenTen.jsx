// 10-10 — Daily Vote Card
// -----------------------------------------------------------------------------
// One card, ten quick taps, done. This is our high-frequency engagement surface:
// every day at 10:00 the deck refreshes with a mix of hot topics, fav-team
// pulses, star-power call-outs, draft/prospect risers, and light predictions.
// No paragraph reads, no long forms — one question, two-to-four chip answers,
// tap and advance.
//
// Design intent (matches the tone reset): every question is *asking for the
// user's take*, never mocking a player. Even negative-framed questions
// ("who's overrated?") get rewritten as "who's most under-appreciated?".
//
// Answers persist to localStorage keyed by day so the card remembers where the
// user left off — they can come back mid-day and finish the last three. When
// all 10 are complete we show the mini-recap ("here's how the room voted").
//
// Data: today's 10 is a curated pool blending leagues per the "cream rises"
// rule. In production the Auto-Producer swaps this out based on last night's
// events and the user's profile.

import { useMemo, useState } from "react";
import { Zap, Trophy, Target, TrendingUp, Users, Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import { emitSignal } from "@/lib/signals";

// A stable day key so votes bucket per-day. When we swap to real time this
// becomes a server-issued deck id.
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const STORAGE_KEY = `ticker.tenten.${todayKey()}`;

// -----------------------------------------------------------------------------
// The deck — 10 questions today, five categories, cross-league where relevant.
// Each answer has an id, a label, an optional league chip, and (importantly)
// a rough baseline percentage so results feel populated even on day one.
// -----------------------------------------------------------------------------
const DECK = [
  {
    id: "q1", category: "hot", icon: "hot",
    prompt: "Story of the night — pick one.",
    subtext: "What's the first thing you tell your buddy at work tomorrow?",
    options: [
      { id: "makar",  label: "Makar's end-to-end goal",    league: "NHL", pct: 42 },
      { id: "wright", label: "Wright's first pro goal",    league: "AHL", pct: 18 },
      { id: "howard", label: "Howard's two-point night",   league: "NCAA", pct: 24 },
      { id: "oliver", label: "Oliver's 23rd of the year",  league: "WHL", pct: 16 },
    ],
  },
  {
    id: "q2", category: "fav", icon: "fav",
    prompt: "Your team's most important player right now.",
    subtext: "Not the biggest name — the guy the season hinges on.",
    options: [
      { id: "goalie",   label: "The goalie",          pct: 38 },
      { id: "top-line", label: "Top-line center",     pct: 27 },
      { id: "top-d",    label: "Number one D",        pct: 22 },
      { id: "coach",    label: "The coach",           pct: 13 },
    ],
  },
  {
    id: "q3", category: "star", icon: "star",
    prompt: "Who owned last night across all leagues?",
    subtext: "One vote. Star power meter.",
    options: [
      { id: "makar",   label: "Cale Makar",     league: "NHL",  pct: 47 },
      { id: "howard",  label: "Gabe Howard",    league: "NCAA", pct: 21 },
      { id: "petrov",  label: "Max Petrov",     league: "OHL",  pct: 19 },
      { id: "oliver",  label: "Kaid Oliver",    league: "WHL",  pct: 13 },
    ],
  },
  {
    id: "q4", category: "draft", icon: "draft",
    prompt: "Biggest riser on your team's draft board.",
    subtext: "Who's climbing fastest — top-15 range?",
    options: [
      { id: "howard",       label: "Gabe Howard · NCAA",       league: "NCAA", pct: 34 },
      { id: "petrov",       label: "Max Petrov · OHL",         league: "OHL",  pct: 29 },
      { id: "oliver",       label: "Kaid Oliver · WHL",        league: "WHL",  pct: 22 },
      { id: "boumedienne",  label: "Owen Boumedienne · WHL",   league: "WHL",  pct: 15 },
    ],
  },
  {
    id: "q5", category: "prospect", icon: "prospect",
    prompt: "Draft-eligible name most NHL fans still don't know.",
    subtext: "Under-the-radar. Time to start typing their name.",
    options: [
      { id: "kelso",   label: "Riley Kelso · BU",       league: "NCAA", pct: 31 },
      { id: "trudeau", label: "Jack Trudeau · London",  league: "OHL",  pct: 27 },
      { id: "sop",     label: "Jaden Sop · Kamloops",   league: "WHL",  pct: 24 },
      { id: "cristall",label: "Andrew Cristall · Vic",  league: "WHL",  pct: 18 },
    ],
  },
  {
    id: "q6", category: "hot", icon: "hot",
    prompt: "Tomorrow's must-watch matchup.",
    subtext: "One click, one plan for your evening.",
    options: [
      { id: "vgk-col",   label: "Vegas @ Colorado",       league: "NHL",  pct: 44 },
      { id: "kam-kel",   label: "Blazers @ Rockets",      league: "WHL",  pct: 22 },
      { id: "mich-osu",  label: "Michigan @ Ohio State",  league: "NCAA", pct: 21 },
      { id: "kit-ldn",   label: "Kitchener @ London",     league: "OHL",  pct: 13 },
    ],
  },
  {
    id: "q7", category: "fav", icon: "fav",
    prompt: "What does your team need most before the deadline?",
    subtext: "Coach's honest question to the fanbase.",
    options: [
      { id: "top-6",       label: "Top-six winger",    pct: 34 },
      { id: "right-d",     label: "Right-shot D",      pct: 28 },
      { id: "backup",      label: "Reliable backup G", pct: 20 },
      { id: "3c",          label: "Two-way 3C",        pct: 18 },
    ],
  },
  {
    id: "q8", category: "star", icon: "star",
    prompt: "Most under-appreciated NHL player right now.",
    subtext: "The one you'd tell a casual fan to watch.",
    options: [
      { id: "hughes",   label: "Quinn Hughes",   pct: 33 },
      { id: "verhaeghe",label: "Carter Verhaeghe",pct: 22 },
      { id: "necas",    label: "Martin Necas",   pct: 24 },
      { id: "byram",    label: "Bowen Byram",    pct: 21 },
    ],
  },
  {
    id: "q9", category: "prospect", icon: "prospect",
    prompt: "Which junior/college team should be a hockey household name?",
    subtext: "Feels big-time in person, still under-covered nationally.",
    options: [
      { id: "kam",   label: "Kamloops Blazers",       league: "WHL",  pct: 27 },
      { id: "mich",  label: "Michigan Wolverines",    league: "NCAA", pct: 32 },
      { id: "ldn",   label: "London Knights",         league: "OHL",  pct: 26 },
      { id: "bu",    label: "Boston University",      league: "NCAA", pct: 15 },
    ],
  },
  {
    id: "q10", category: "predict", icon: "predict",
    prompt: "Best bet for the game tonight — coach, not casino.",
    subtext: "What's the read — not the parlay, the actual truth.",
    options: [
      { id: "under",    label: "Under 6.5 · goalie duel",   pct: 32 },
      { id: "home-ml",  label: "Home team gets it done",    pct: 34 },
      { id: "road-dog", label: "Road dog covers — value",   pct: 22 },
      { id: "pass",     label: "Pass — feels like a coin",  pct: 12 },
    ],
  },
];

const ICONS = {
  hot: Zap, fav: Users, star: Trophy, draft: TrendingUp, prospect: Sparkles, predict: Target,
};

const CATEGORY_LABEL = {
  hot: "Hot topic", fav: "Fav team", star: "Star power", draft: "Draft board", prospect: "Prospect radar", predict: "Coach's read",
};

const LEAGUE_COLOR = {
  NHL: "#FCB514", AHL: "#7A0019", WHL: "#F58220", OHL: "#C41230", NCAA: "#CC0000", MIX: "#8B5CF6",
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

export function TenTen() {
  const [store, setStore] = useState(readStore);

  // Find first un-answered question — that's the one we show.
  const currentIdx = useMemo(() => {
    for (let i = 0; i < DECK.length; i++) {
      if (!store[DECK[i].id]) return i;
    }
    return DECK.length; // all done
  }, [store]);

  const answered = Object.keys(store).length;
  const total = DECK.length;
  const isDone = currentIdx >= total;
  const q = !isDone ? DECK[currentIdx] : null;

  const cast = (answerId) => {
    if (!q) return;
    const next = { ...store, [q.id]: answerId };
    writeStore(next);
    setStore(next);
    // Emit an app-wide signal so the ranker can learn which leagues and
    // targets this user actually cares about. Category becomes the weight
    // hint — draft/prospect answers count harder than a hot-topic tap.
    const chosen = q.options.find(o => o.id === answerId);
    if (chosen) {
      emitSignal({
        kind: "tenten_vote",
        league: chosen.league || null,
        target: `${q.id}:${answerId}`,
        weight: q.category === "draft" || q.category === "prospect" ? 1.5 : 1,
      });
    }
  };

  const reset = () => {
    writeStore({});
    setStore({});
  };

  const IconEl = q ? (ICONS[q.icon] || Zap) : Trophy;

  return (
    <div data-testid="tenten" className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-full bg-[#F58220] px-2 py-0.5"
                style={{ fontFamily: "Oswald", fontWeight: 800, fontSize: "10px", letterSpacing: "0.22em", color: "#000" }}>
            10 @ 10
          </span>
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff", lineHeight: 1.1 }}>
              Ten quick taps. Your take, every day.
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.24em", color: "#a0a0a5", marginTop: 2 }}>
              Refreshes every morning · No wrong answers
            </div>
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: "#fff", lineHeight: 1 }} data-testid="tenten-count">
            {answered}<span className="text-white/40 text-sm">/{total}</span>
          </div>
          <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.22em", color: "#a0a0a5" }}>
            done
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-[#F58220] transition-all duration-500"
          style={{ width: `${(answered / total) * 100}%` }}
          data-testid="tenten-progress"
        />
      </div>

      {/* Body */}
      {!isDone && q && (
        <div className="p-4 md:p-5" data-testid={`tenten-question-${q.id}`}>
          {/* Category chip */}
          <div className="flex items-center gap-2 mb-2">
            <IconEl className="w-3.5 h-3.5 text-[#F58220]" />
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
              {CATEGORY_LABEL[q.category]} · Q{currentIdx + 1}
            </span>
          </div>

          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: "#fff", lineHeight: 1.2 }}>
            {q.prompt}
          </div>
          <div className="mt-1" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.18em", color: "#a0a0a5" }}>
            {q.subtext}
          </div>

          {/* Answer chips — 2-column on md+, stack on mobile */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {q.options.map(opt => (
              <button
                key={opt.id}
                data-testid={`tenten-option-${q.id}-${opt.id}`}
                onClick={() => cast(opt.id)}
                className="group flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-black/40 hover:border-[#F58220] hover:bg-[#F58220]/10 px-3.5 py-3 transition-all text-left"
              >
                <div className="min-w-0 flex-1">
                  <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: "#fff", lineHeight: 1.15 }}>
                    {opt.label}
                  </div>
                  {opt.league && (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full" style={{ background: LEAGUE_COLOR[opt.league] || "#a0a0a5" }} />
                      <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.28em", color: LEAGUE_COLOR[opt.league] || "#a0a0a5" }}>
                        {opt.league}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[#F58220] group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>

          {/* Skip / footer */}
          <div className="mt-4 flex items-center justify-between text-white/40">
            <span style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em" }}>
              Tap any option to advance
            </span>
            {answered > 0 && (
              <button
                onClick={reset}
                data-testid="tenten-reset"
                className="flex items-center gap-1 hover:text-white/70 transition-colors"
                style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em" }}
              >
                <RotateCcw className="w-3 h-3" /> Restart
              </button>
            )}
          </div>
        </div>
      )}

      {/* Done — show tallies */}
      {isDone && (
        <div className="p-4 md:p-5 space-y-3" data-testid="tenten-done">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#F58220]" />
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
              10 for 10 · here's how the room voted
            </span>
          </div>
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: "#fff", lineHeight: 1.2 }}>
            Your take is locked in. See you at 10 tomorrow.
          </div>

          <div className="space-y-3 pt-1">
            {DECK.map(qd => {
              const mine = store[qd.id];
              const chosen = qd.options.find(o => o.id === mine);
              const total = qd.options.reduce((a, b) => a + b.pct, 0) || 100;
              return (
                <div key={qd.id} className="rounded-lg border border-white/8 bg-black/30 p-3" data-testid={`tenten-recap-${qd.id}`}>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", color: "#fff", lineHeight: 1.15 }}>
                      {qd.prompt}
                    </div>
                    <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "9px", letterSpacing: "0.24em", color: "#a0a0a5", whiteSpace: "nowrap" }}>
                      YOU: {chosen?.label?.split(" · ")[0]}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {qd.options.map(o => {
                      const pct = ((o.pct / total) * 100);
                      const isMine = o.id === mine;
                      return (
                        <div key={o.id} className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
                            <div
                              className="h-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: isMine ? "#4ade80" : "#F58220" }}
                            />
                          </div>
                          <span className="tabular-nums" style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.15em", color: isMine ? "#4ade80" : "#a0a0a5", minWidth: 32, textAlign: "right" }}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={reset}
            data-testid="tenten-restart"
            className="w-full mt-2 rounded-full border border-white/15 hover:border-[#F58220] hover:text-[#F58220] py-2 transition-all text-white/70"
            style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.3em" }}
          >
            RESTART · JUST FOR FUN
          </button>
        </div>
      )}
    </div>
  );
}
