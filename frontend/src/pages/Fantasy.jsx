import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { TEST_IDS } from "@/lib/config";
import { Crown, Trophy, Sparkles, Flame, Save, ExternalLink } from "lucide-react";

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

// Deterministic "insights" derived from the roster — placeholder for the
// real AI-driven engine that lands after Presser + affiliate deals.
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
    </div>
  );
}
