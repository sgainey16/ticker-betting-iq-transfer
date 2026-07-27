import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { TEST_IDS } from "@/lib/config";
import { Crown, Trophy, Sparkles, Flame, Save, ExternalLink, Activity, TrendingUp, AlertTriangle, PlayCircle, PauseCircle, Eye, Mic2, Calculator } from "lucide-react";
import ReggieAssistant from "@/components/ReggieAssistant";

const SCORING_OPTIONS = ["Points", "Head-to-Head", "Roto", "Custom"];

const AFFILIATES = [
  {
    id: "draftkings",
    name: "DraftKings",
    tag: "DFS · Salary Cap",
    tint: "#53d337",
    href: "https://www.draftkings.com/",
    note: "Sponsored slot · going live at launch",
  },
  {
    id: "sleeper",
    name: "Sleeper",
    tag: "Season Long · Dynasty",
    tint: "#00e5ff",
    href: "https://sleeper.com/",
    note: "Manual roster import supported",
  },
  {
    id: "yahoo",
    name: "Yahoo Fantasy",
    tag: "Standard · H2H",
    tint: "#7b3ff2",
    href: "https://sports.yahoo.com/fantasy/hockey/",
    note: "Integration on the roadmap",
  },
  {
    id: "espn",
    name: "ESPN Fantasy",
    tag: "Classic · Points",
    tint: "#e11d2a",
    href: "https://fantasy.espn.com/hockey/",
    note: "Integration on the roadmap",
  },
];

function emptyPlayer() { return { name: "", team: "", pos: "" }; }

// ------- Fantasy engine (deterministic mock, feels alive) -------
// All logic is roster-aware so the page evolves as the user fills in players.
// Real AI/data pipes swap in later without changing the UI surface.

const HOT_TEAMS = new Set(["EDM","COL","TBL","WPG","NYR","MIN"]);
const COLD_TEAMS = new Set(["ANA","CBJ","CHI","SJS","MTL"]);

function rosterHealth(roster) {
  const filled = roster.filter((p) => p.name?.trim());
  if (!filled.length) {
    return {
      score: null, grade: "—",
      headline: "Add your roster — I'll grade it in real time.",
      strengths: [],
      weaknesses: ["Empty roster · no calls to make yet"],
    };
  }
  let score = 55;
  const strengths = [], weaknesses = [];
  const positions = filled.map((p) => (p.pos || "").toUpperCase());
  const hasG = positions.includes("G");
  const cCount = positions.filter((p) => p === "C").length;
  const dCount = positions.filter((p) => p === "D").length;
  const hotPlayers = filled.filter((p) => HOT_TEAMS.has((p.team || "").toUpperCase()));
  const coldPlayers = filled.filter((p) => COLD_TEAMS.has((p.team || "").toUpperCase()));

  score += hotPlayers.length * 6;
  score -= coldPlayers.length * 5;
  if (hasG) { score += 4; strengths.push("Goalie slot filled — no zero from your G tonight"); }
  else { score -= 8; weaknesses.push("No goalie rostered · you'll bleed on save-related cats"); }
  if (cCount >= 2) { score += 3; strengths.push(`${cCount} centers · faceoff-win cat looks safe`); }
  if (dCount >= 2) { score += 2; strengths.push(`${dCount} D-men · block/hit floor holds up`); }
  if (dCount < 1) { score -= 6; weaknesses.push("Thin at D — PP2 minutes leaking to the free pool"); }
  if (hotPlayers.length >= 2) strengths.push(`${hotPlayers.map((p) => p.team).join(" + ")} on heat · ride it`);
  if (coldPlayers.length >= 1) weaknesses.push(`${coldPlayers.map((p) => p.team).join(", ")} cooling — watch the drop cliff`);
  if (filled.length < 4) { score -= 10; weaknesses.push("Roster's short — Marc says you're playing 5-on-4 all week"); }

  score = Math.max(15, Math.min(98, score));
  const grade =
    score >= 90 ? "A+" : score >= 85 ? "A" : score >= 80 ? "A-" :
    score >= 75 ? "B+" : score >= 70 ? "B" : score >= 65 ? "B-" :
    score >= 60 ? "C+" : score >= 55 ? "C" : score >= 50 ? "C-" :
    score >= 45 ? "D+" : score >= 40 ? "D" : "F";

  const headline =
    score >= 85 ? "This is a room-of-adults roster. Ride it." :
    score >= 70 ? "Solid build. One waiver move away from real trouble for the league." :
    score >= 55 ? "You're in the fight. A couple of holes but nothing that can't be fixed by Friday." :
    score >= 40 ? "You're playing catch-up. Marc says burn a waiver claim — Reggie says stop watching the box score." :
                  "This roster's on the wrong side of the puck. Time to work.";

  return { score, grade, headline, strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3) };
}

function startSitCalls(roster) {
  const filled = roster.filter((p) => p.name?.trim());
  if (!filled.length) return [];
  const calls = [];
  filled.slice(0, 6).forEach((p, i) => {
    const team = (p.team || "").toUpperCase();
    const pos = (p.pos || "").toUpperCase();
    const isHot = HOT_TEAMS.has(team);
    const isCold = COLD_TEAMS.has(team);
    const isG = pos === "G";
    const verdict = isHot ? "START" : isCold ? "SIT" : (i % 3 === 0 ? "START" : (i % 3 === 1 ? "LEAN" : "WATCH"));
    const line =
      verdict === "START" && isG ? "Home whites, rested, matchup team's on a back-to-back road trip. Full send." :
      verdict === "START" ? "PP1 minutes, top-line ice, matchup's PK is 27th in the league. Play him." :
      verdict === "SIT" ? "Cold team, thin ice, this is a nothing-shift night. Bench and don't look back." :
      verdict === "LEAN" ? "Coin flip. Reggie says trust the swagger — Marc says trust the ice time. Split the diff." :
                           "No game tonight, or matchup dodgy. Keep him on the bench, check back Thursday.";
    calls.push({ id: `ss-${i}`, name: p.name, team, pos, verdict, line });
  });
  return calls;
}

const TRENDING_WAIVERS = [
  { id: "w1", name: "Logan Cooley",       team: "UTA", pos: "C",  ownership: 34, streak: "4 GP · 3G 4A · +6",  hook: "Utah's second-line C is quietly PP1 now. Cheap upside." },
  { id: "w2", name: "Marco Rossi",        team: "MIN", pos: "C",  ownership: 42, streak: "6 GP · 5G 6A · +4",  hook: "Since Kaprizov came back, Rossi's TOI jumped 3 min. Ride it." },
  { id: "w3", name: "Bowen Byram",        team: "BUF", pos: "D",  ownership: 28, streak: "PP1 min · 5A / 4",   hook: "Buffalo shuffled the back end. He's the PP QB now." },
  { id: "w4", name: "Devon Levi",         team: "BUF", pos: "G",  ownership: 19, streak: "3-0-1 · .932 sv%",   hook: "If UPL keeps leaking, Levi runs with the crease." },
  { id: "w5", name: "Matt Coronato",      team: "CGY", pos: "RW", ownership: 22, streak: "5 GP · 4G · 12 SOG", hook: "Shooting % running hot but the volume is real. Speculate." },
];

const INJURY_WATCH = [
  { id: "i1", name: "Kirill Kaprizov",  team: "MIN", status: "Day-to-Day",   note: "Lower body · missed morning skate. Game-time call." , tag: "watch" },
  { id: "i2", name: "Igor Shesterkin",  team: "NYR", status: "Probable",     note: "Cleared concussion protocol. Expected to start Thursday.", tag: "green" },
  { id: "i3", name: "Miro Heiskanen",   team: "DAL", status: "IR — 2 weeks", note: "Knee sprain. Drop candidate in shallow leagues.", tag: "red" },
];

const LINE_ALERTS = [
  { team: "EDM", note: "Warmups had Nugent-Hopkins bumped up next to McDavid — if it holds, RNH's ceiling jumps." },
  { team: "COL", note: "Nichushkin moved to PP1 unit last game. Watch the shot volume tonight." },
];

function hostTakes(rosterHealthResult, favTeams) {
  // Fantasy is an opt-in room, so we CAN reference the roster directly —
  // but the panel-show tonal rule still holds: warm sports-desk voice, no
  // gambling-podcast phrases (PP1 exposure, value pop, regression coming).
  const grade = rosterHealthResult.grade;
  const fav = favTeams[0] || "your favourites";

  const reggie =
    grade === "F" || grade === "D" || grade === "D+"
      ? "Alright, listen — this roster's got some holes. That's fine. Every team I ever played on had a bad week. What you do is you show up, you fix the little things, and you don't get cute. One good pickup, one honest look at who's not earning their shift. That's it. Get back to work."
      : grade.startsWith("A")
      ? `Come on. THIS is a HOCKEY roster. You've got real guys in real spots — first to the puck, first to the middle. Don't overthink it. Just keep playing your guys. And keep an eye on ${fav} — anything happens with that lineup, you're one of the first to know.`
      : `Solid build, kid. Nothing flashy — that's why I like it. Simple beats fancy. Every week you're gonna have one guy who lets you down and one guy who saves your bacon. That's hockey. Trust the group.`;

  const marc =
    grade === "F" || grade === "D" || grade === "D+"
      ? "The roster's underperforming its position on the ice, and that's a fixable problem. One meaningful add — the right forward, in the right spot on the ice — closes most of the gap. I wouldn't overhaul. I'd trim."
      : grade.startsWith("A")
      ? "The tape and the numbers finally shook hands here. Your top guys are doing what they're supposed to, your depth is quiet, and that's the mark of a team that doesn't waste energy. Only thing worth watching: goalie week-to-week. Everything else can breathe."
      : `The pieces are there. Not championship-quality yet, but a good build with a real ceiling. ${fav} has been trending in the right direction lately — anything you have from that lineup is worth holding a little longer than you think.`;

  return { reggie, marc };
}


// Legacy inline insights (kept for the sidebar). The new engine (rosterHealth,
// startSitCalls, hostTakes, waivers, injuries) drives the new panels.
function computeInsights(roster, favTeams) {
  const insights = [];
  const filled = roster.filter((p) => p.name?.trim());
  if (filled.length === 0) {
    return [
      { kind: "tip", title: "Add your roster",
        body: "Drop your team above and I'll surface start-sit calls, waiver fits, and anomaly flags every night." },
    ];
  }
  if (filled.some((p) => (p.pos || "").toUpperCase() === "G")) {
    insights.push({
      kind: "hot", title: "Goalie watch tonight",
      body: "Marc keeps his eye on shot-quality against for your starting goalie. Anything above a 2.8 xGA and he tells you to pivot early.",
    });
  }
  const pens = ["EDM","COL","TOR","TBL","WPG","NYR","NJD","MIN"];
  const cold = filled.find((p) => pens.includes((p.team || "").toUpperCase()) === false);
  if (cold) {
    insights.push({
      kind: "flag", title: `${cold.name || "Your winger"} · matchup dip`,
      body: "Reggie flagged a soft-matchup team going into a road back-to-back. Points ceiling drops — plan a swap Friday if a top-line RW is on waivers.",
    });
  }
  if (favTeams.length) {
    insights.push({
      kind: "tip", title: `${favTeams[0]} · line-shuffle alert`,
      body: "Coach juggled the top-six in warmups last game. If it sticks, your second-line C climbs into PP1 minutes — value spike.",
    });
  }
  insights.push({
    kind: "tip", title: "Waiver-wire fit",
    body: "Utah's second-line center is quietly on a 4-game point streak with rising PP TOI. Under 40% rostered — cheap upside.",
  });
  return insights;
}

export default function Fantasy() {
  const deviceId = useMemo(() => getDeviceId(), []);
  const [sub, setSub] = useState({ is_premium: false, questions_used: 0, free_limit: 3 });
  const [league, setLeague] = useState({
    league_name: "",
    scoring: "Points",
    roster: Array.from({ length: 6 }, emptyPlayer),
    favorite_teams: [],
    notes: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get(`/subscription/state?device_id=${encodeURIComponent(deviceId)}`),
      api.get(`/subscription/roster?device_id=${encodeURIComponent(deviceId)}`),
    ]).then(([s, r]) => {
      if (!mounted) return;
      setSub(s.data);
      const doc = r.data || {};
      setLeague({
        league_name: doc.league_name || "",
        scoring: doc.scoring || "Points",
        roster: (doc.roster && doc.roster.length ? doc.roster : Array.from({ length: 6 }, emptyPlayer)),
        favorite_teams: doc.favorite_teams || [],
        notes: doc.notes || "",
      });
    }).catch(() => {}).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [deviceId]);

  function updatePlayer(i, field, v) {
    setSaved(false);
    setLeague((L) => {
      const roster = [...L.roster];
      roster[i] = { ...roster[i], [field]: v };
      return { ...L, roster };
    });
  }
  function addPlayer() {
    setSaved(false);
    setLeague((L) => ({ ...L, roster: [...L.roster, emptyPlayer()] }));
  }
  function toggleTeam(code) {
    setSaved(false);
    setLeague((L) => {
      const has = L.favorite_teams.includes(code);
      return { ...L, favorite_teams: has ? L.favorite_teams.filter((t) => t !== code) : [...L.favorite_teams, code] };
    });
  }
  async function save() {
    const cleanRoster = league.roster.filter((p) => p.name?.trim());
    const payload = { device_id: deviceId, ...league, roster: cleanRoster };
    try {
      await api.post("/subscription/roster", payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
  }
  async function activate() {
    try {
      await api.post("/subscription/activate", { device_id: deviceId });
      setSub((s) => ({ ...s, is_premium: true }));
    } catch (e) { console.error(e); }
  }

  const insights = useMemo(
    () => computeInsights(league.roster, league.favorite_teams),
    [league.roster, league.favorite_teams],
  );

  const health = useMemo(() => rosterHealth(league.roster), [league.roster]);
  const startSit = useMemo(() => startSitCalls(league.roster), [league.roster]);
  const takes = useMemo(() => hostTakes(health, league.favorite_teams), [health, league.favorite_teams]);

  const TEAM_OPTIONS = ["EDM","COL","TOR","TBL","MIN","WPG","NYR","NJD","VAN","DAL","NYI","BOS","FLA","CAR"];

  return (
    <div className="space-y-8" data-testid={TEST_IDS.fantasy.pageRoot}>
      {/* Header */}
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#1e5dff]">
            Your team · Fantasy Desk
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl text-white mt-1">
            Better decisions. No guessing.
          </h1>
          <p className="text-white/60 text-sm mt-2 max-w-2xl">
            Drop your roster and league rules. Reggie &amp; Marc turn it into start-sit calls,
            waiver-wire fits, and matchup edges. <span className="text-white/40">Insight only — never a wager.</span>
          </p>
        </div>
        {sub.is_premium ? (
          <div className="rounded-full border border-[#1e5dff]/60 bg-[#0b0b10] px-4 py-2 inline-flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#1e5dff]" />
            <span className="font-accent text-[11px] uppercase tracking-widest text-white/85">Founding Member</span>
          </div>
        ) : (
          <button
            onClick={activate}
            data-testid={TEST_IDS.fantasy.upgradeBtn}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
          >
            <Crown className="w-3.5 h-3.5" /> Activate Founding Member
          </button>
        )}
      </header>

      {/* ===== Roster Health hero card ===== */}
      <section
        data-testid={TEST_IDS.fantasy.healthScore}
        className="card-surface p-6 sm:p-7 relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at top left, #1e5dff 0%, transparent 55%), radial-gradient(ellipse at bottom right, #00e5ff 0%, transparent 55%)",
          }}
        />
        <div className="relative grid md:grid-cols-12 gap-6 items-center">
          {/* Score dial */}
          <div className="md:col-span-3 flex flex-col items-center md:items-start">
            <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">Roster Health</div>
            <div className="mt-2 flex items-baseline gap-3">
              <div
                className="font-headline text-6xl sm:text-7xl leading-none"
                style={{
                  color:
                    health.score == null ? "#666"
                    : health.score >= 80 ? "#4ade80"
                    : health.score >= 60 ? "#00e5ff"
                    : health.score >= 45 ? "#ffb547"
                    : "#ff5c7a",
                }}
              >
                {health.score == null ? "—" : health.score}
              </div>
              <div className="font-headline text-2xl text-white/70">{health.grade}</div>
            </div>
            <div className="mt-2 text-[10px] font-accent uppercase tracking-widest text-white/40">out of 100 · updated live</div>
          </div>

          {/* Headline + splits */}
          <div className="md:col-span-9 space-y-3">
            <div className="font-headline text-xl sm:text-2xl text-white leading-snug">
              {health.headline}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3">
                <div className="flex items-center gap-2 text-[10px] font-accent uppercase tracking-widest text-[#4ade80]">
                  <TrendingUp className="w-3.5 h-3.5" /> Strengths
                </div>
                <ul className="mt-2 space-y-1.5 text-white/75 text-sm">
                  {health.strengths.length ? health.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[#4ade80]">·</span><span>{s}</span></li>
                  )) : <li className="text-white/40 text-xs">Nothing standing out yet — add more players.</li>}
                </ul>
              </div>
              <div className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3">
                <div className="flex items-center gap-2 text-[10px] font-accent uppercase tracking-widest text-[#ff8f3b]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fix these first
                </div>
                <ul className="mt-2 space-y-1.5 text-white/75 text-sm">
                  {health.weaknesses.length ? health.weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[#ff8f3b]">·</span><span>{w}</span></li>
                  )) : <li className="text-white/40 text-xs">Clean sheet — nothing screaming yet.</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Tonight's Start/Sit ===== */}
      {startSit.length > 0 && (
        <section
          data-testid={TEST_IDS.fantasy.startSit}
          className="card-surface p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-[#1e5dff]" />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Tonight's Start / Sit
              </div>
            </div>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
              Reggie's read · updates every 15 min
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {startSit.map((c) => {
              const tint =
                c.verdict === "START" ? { bg: "#4ade8022", fg: "#4ade80", icon: PlayCircle } :
                c.verdict === "SIT"   ? { bg: "#ff5c7a22", fg: "#ff8fae", icon: PauseCircle } :
                c.verdict === "LEAN"  ? { bg: "#00e5ff22", fg: "#7de9ff", icon: TrendingUp } :
                                        { bg: "#ffb54722", fg: "#ffb547", icon: Eye };
              const Icon = tint.icon;
              return (
                <div key={c.id} className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-headline text-white text-base truncate">{c.name}</div>
                      <div className="text-[10px] font-accent uppercase tracking-widest text-white/50 mt-0.5">
                        {c.team || "—"} · {c.pos || "—"}
                      </div>
                    </div>
                    <span
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-accent uppercase tracking-widest"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      <Icon className="w-3 h-3" /> {c.verdict}
                    </span>
                  </div>
                  <div className="mt-3 text-white/70 text-xs leading-relaxed">{c.line}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Reggie + Marc Weekly Takes ===== */}
      <section className="grid md:grid-cols-2 gap-4">
        <div
          data-testid={TEST_IDS.fantasy.hostTakeReggie}
          className="card-surface p-5 relative overflow-hidden"
        >
          <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full blur-3xl opacity-40" style={{ background: "#1e5dff" }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className="w-4 h-4" style={{ color: "#1e5dff" }} />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Reggie's take
              </div>
            </div>
            <div className="font-headline text-white text-lg leading-snug italic">
              "{takes.reggie}"
            </div>
            <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/40">
              — Reggie Banks · Lead Anchor
            </div>
          </div>
        </div>

        <div
          data-testid={TEST_IDS.fantasy.hostTakeMarc}
          className="card-surface p-5 relative overflow-hidden"
        >
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full blur-3xl opacity-40" style={{ background: "#00e5ff" }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4" style={{ color: "#00e5ff" }} />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Marc's take
              </div>
            </div>
            <div className="font-headline text-white text-lg leading-snug italic">
              "{takes.marc}"
            </div>
            <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/40">
              — Marc Collins · Analytics Co-Host
            </div>
          </div>
        </div>
      </section>

      {/* ===== Trending Waivers · Injury Watch · Line Alerts ===== */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* Waivers */}
        <div data-testid={TEST_IDS.fantasy.waivers} className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#4ade80]" />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Trending waivers
              </div>
            </div>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
              under 50% rostered
            </div>
          </div>
          <div className="space-y-2">
            {TRENDING_WAIVERS.map((w) => (
              <div key={w.id} className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-headline text-white text-sm truncate">{w.name}</div>
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/50 mt-0.5">
                      {w.team} · {w.pos} · {w.ownership}% rostered
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-accent uppercase tracking-widest text-[#4ade80]">
                    {w.streak}
                  </span>
                </div>
                <div className="mt-1.5 text-white/70 text-xs leading-relaxed">{w.hook}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Injuries */}
        <div data-testid={TEST_IDS.fantasy.injuries} className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#ff5c7a]" />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Injury watch
              </div>
            </div>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
              refresh · morning skate
            </div>
          </div>
          <div className="space-y-2">
            {INJURY_WATCH.map((i) => {
              const tint =
                i.tag === "red" ? { bg: "#ff5c7a22", fg: "#ff8fae" } :
                i.tag === "green" ? { bg: "#4ade8022", fg: "#4ade80" } :
                                    { bg: "#ffb54722", fg: "#ffb547" };
              return (
                <div key={i.id} className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-headline text-white text-sm truncate">{i.name}</div>
                      <div className="text-[10px] font-accent uppercase tracking-widest text-white/50 mt-0.5">
                        {i.team}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-accent uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      {i.status}
                    </span>
                  </div>
                  <div className="mt-1.5 text-white/70 text-xs leading-relaxed">{i.note}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Line combo alerts */}
        <div data-testid={TEST_IDS.fantasy.lineAlert} className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#ff8f3b]" />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Line-combo alerts
              </div>
            </div>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
              warmups · game-day
            </div>
          </div>
          <div className="space-y-2">
            {LINE_ALERTS.map((l, i) => (
              <div key={i} className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-accent uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#ff8f3b22] text-[#ffb587]">
                    {l.team}
                  </span>
                </div>
                <div className="mt-1.5 text-white/75 text-xs leading-relaxed">{l.note}</div>
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-[#2d2d35] p-3">
              <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
                More combos unlock with Founding Member
              </div>
              <div className="text-white/60 text-xs mt-1">
                Live warmup detection · PP unit changes · scratches — 30 min before puck drop.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Roster editor */}
        <section className="lg:col-span-8 card-surface p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-white/60" />
            <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
              Your roster
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="font-accent text-[10px] uppercase tracking-widest text-white/50">League name</label>
              <input
                value={league.league_name}
                onChange={(e) => { setSaved(false); setLeague((L) => ({ ...L, league_name: e.target.value })); }}
                placeholder="e.g. Puck Dynasty"
                className="mt-1 w-full bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="font-accent text-[10px] uppercase tracking-widest text-white/50">Scoring</label>
              <select
                value={league.scoring}
                onChange={(e) => { setSaved(false); setLeague((L) => ({ ...L, scoring: e.target.value })); }}
                className="mt-1 w-full bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                {SCORING_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {league.roster.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2" data-testid={TEST_IDS.fantasy.playerRow(i)}>
                <input
                  value={p.name}
                  onChange={(e) => updatePlayer(i, "name", e.target.value)}
                  placeholder="Player name"
                  className="col-span-6 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                />
                <input
                  value={p.team}
                  onChange={(e) => updatePlayer(i, "team", e.target.value.toUpperCase())}
                  placeholder="TM"
                  maxLength={3}
                  className="col-span-3 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm uppercase tracking-widest focus:outline-none"
                />
                <input
                  value={p.pos}
                  onChange={(e) => updatePlayer(i, "pos", e.target.value.toUpperCase())}
                  placeholder="POS"
                  maxLength={4}
                  className="col-span-3 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm uppercase tracking-widest focus:outline-none"
                />
              </div>
            ))}
            <button
              onClick={addPlayer}
              className="text-xs font-accent uppercase tracking-widest text-white/50 hover:text-white transition-colors"
            >
              + Add another player
            </button>
          </div>

          <div className="mt-5">
            <label className="font-accent text-[10px] uppercase tracking-widest text-white/50">Favorite teams</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEAM_OPTIONS.map((c) => {
                const on = league.favorite_teams.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleTeam(c)}
                    className={`px-3 py-1 rounded-full text-[11px] font-accent uppercase tracking-widest transition-colors ${
                      on ? "bg-[#1e5dff] text-white" : "border border-[#2d2d35] text-white/60 hover:text-white hover:border-white/40"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <label className="font-accent text-[10px] uppercase tracking-widest text-white/50">Notes for the desk</label>
            <textarea
              value={league.notes}
              onChange={(e) => { setSaved(false); setLeague((L) => ({ ...L, notes: e.target.value })); }}
              rows={2}
              placeholder="e.g. I need help at 2C, considering dropping Rakell for Guenther…"
              className="mt-1 w-full bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
              Saved to this browser · exports coming
            </div>
            <button
              onClick={save}
              data-testid={TEST_IDS.fantasy.saveRoster}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {saved ? "Saved" : "Save roster"}
            </button>
          </div>
        </section>

        {/* Insights + affiliates */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#00e5ff]" />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Decision insights
              </div>
            </div>
            <div className="space-y-3">
              {insights.map((it, i) => (
                <div key={i} className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-accent uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{
                        background: it.kind === "flag" ? "#ff3b6f22" : it.kind === "hot" ? "#00e5ff22" : "#1e5dff22",
                        color: it.kind === "flag" ? "#ff8fae" : it.kind === "hot" ? "#7de9ff" : "#a4c1ff",
                      }}
                    >
                      {it.kind}
                    </span>
                    <div className="text-white font-headline text-sm">{it.title}</div>
                  </div>
                  <div className="text-white/70 text-xs mt-1.5 leading-relaxed">{it.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/35">
              Deep AI engine unlocks with Founding Member
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-[#ff8f3b]" />
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Fantasy partners
              </div>
            </div>
            <div className="space-y-2">
              {AFFILIATES.map((a) => (
                <a
                  key={a.id}
                  href={a.href}
                  target="_blank"
                  rel="noreferrer noopener sponsored"
                  className="flex items-center justify-between rounded-lg border border-[#2d2d35] hover:border-white/40 bg-[#0b0b10] p-3 transition-colors group"
                  data-testid={`affiliate-${a.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: a.tint }} />
                      <div className="font-headline text-white text-sm">{a.name}</div>
                    </div>
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/45 mt-0.5">
                      {a.tag} · {a.note}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
            <div className="mt-2 text-[10px] font-accent uppercase tracking-widest text-white/35">
              Referral pricing negotiated per partner
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="text-[11px] font-accent uppercase tracking-widest text-white/50">Need a deeper read?</div>
            <div className="font-headline text-white text-lg mt-1">Take it to the presser.</div>
            <Link
              to="/press-conference"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/85 font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              Open Press Conference →
            </Link>
          </div>
        </aside>
      </div>

      {loading && (
        <div className="text-white/40 text-xs font-accent uppercase tracking-widest">
          Loading your desk…
        </div>
      )}

      {/* Reggie — floating assistant available here too, per user directive. */}
      <ReggieAssistant />
    </div>
  );
}
