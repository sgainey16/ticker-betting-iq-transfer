// Ticker Hockey IQ — Product Integration Pass
// Reggie + Marc are the human interface. This shell wires the Phase 0–3
// engines into a mobile-first 4-tab experience where every tab has a
// contextual Coach dock and calls are captured with one tap.

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Radio, Brain, Trophy, Users, Target,
  Lock, Unlock, CheckCircle2, TrendingUp, Award, Flame,
  Send, Eye, Globe, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { TMark } from "@/lib/brand";
import GamePickerStrip from "@/components/GamePickerStrip";
import HostPortrait from "@/components/HostPortrait";
import IQCoachDock from "@/components/iq/IQCoachDock";
import MakeCallPanel from "@/components/iq/MakeCallPanel";
import TonightHero from "@/components/iq/v2/TonightHero";
import GameRailV2 from "@/components/iq/v2/GameRailV2";
import MatchupIntel from "@/components/iq/v2/MatchupIntel";
import MyIQCommandCenter from "@/components/iq/v2/MyIQCommandCenter";

const TABS = [
  { id: "tonight",   label: "Tonight",   icon: Radio },
  { id: "my-iq",     label: "My IQ",     icon: Brain },
  { id: "fantasy",   label: "Fantasy",   icon: Trophy },
  { id: "community", label: "Community", icon: Users  },
];

export default function HockeyIQ() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "tonight";
  const setActive = (id) => setParams({ tab: id }, { replace: true });

  const deviceId = useMemo(() => getDeviceId(), []);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let live = true;
    api.get(`/iq/user?device_id=${encodeURIComponent(deviceId)}`)
       .then((r) => { if (live) setUser(r.data); })
       .catch(() => {});
    return () => { live = false; };
  }, [deviceId]);

  const refreshUser = () =>
    api.get(`/iq/user?device_id=${encodeURIComponent(deviceId)}`).then((r) => setUser(r.data));

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#050510] via-[#08081a] to-[#050510] text-white"
      data-testid="hockey-iq-root"
    >
      {/* COMPRESSED CHROME — one sticky bar, ~48px */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-11 flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            data-testid="iq-back-to-ticker"
            className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors shrink-0"
            aria-label="Back to The Ticker"
          >
            <ArrowLeft className="w-4 h-4" />
            <TMark size={16} variant="light" />
          </button>

          <nav className="flex-1 flex items-stretch gap-0.5 overflow-x-auto no-scrollbar justify-end sm:justify-center">
            {TABS.map((t) => {
              const isActive = active === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  data-testid={`iq-tab-${t.id}`}
                  className={`px-2 sm:px-3 h-11 inline-flex items-center gap-1.5 font-accent text-[10px] uppercase tracking-[0.18em] transition-colors border-b-2 whitespace-nowrap ${
                    isActive
                      ? "text-white border-[#1e5dff]"
                      : "text-white/50 border-transparent hover:text-white/85"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#1e5dff]" : ""}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="shrink-0 hidden sm:flex items-center gap-1.5">
            <div className="font-headline text-white/80 text-xs leading-none">HOCKEY IQ</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {active === "tonight"   && <TonightTab   deviceId={deviceId} onGoto={setActive} />}
        {active === "my-iq"     && <MyIQCommandCenter deviceId={deviceId} />}
        {active === "fantasy"   && <FantasyTab   deviceId={deviceId} />}
        {active === "community" && <CommunityTab deviceId={deviceId} />}
      </main>
    </div>
  );
}


// =====================================================================
// TONIGHT — enter Hockey IQ, immediately participate.
// Auto-selects the first game so MakeCallPanel is visible on landing.
// =====================================================================
function TonightTab({ deviceId, onGoto }) {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      api.get("/predictions/games"),
      api.get("/stats/teams"),
    ]).then(([g, t]) => {
      if (!live) return;
      const gs = g.data.games || [];
      setGames(gs);
      setTeams(t.data.teams || []);
      // Auto-select the first game so the make-a-call flow is on screen.
      if (gs.length > 0 && !selectedGameId) setSelectedGameId(gs[0].id);
    }).finally(() => setLoading(false));
    return () => { live = false; };
  }, []);  // eslint-disable-line

  const gameCount = games.length;
  const selectedGame = games.find((g) => g.id === selectedGameId);

  return (
    <div className="space-y-5" data-testid="iq-tonight">
      {loading ? (
        <SkeletonCard label="Loading tonight's card…" />
      ) : gameCount === 0 ? (
        <EmptyCard
          headline="No games on tonight."
          body="Come back at puck drop — this is where the card lands."
        />
      ) : (
        <>
          {/* Broadcast hero — real derived intel, no CTAs, no explainer copy */}
          <TonightHero games={games} />

          {/* Logo-forward horizontal rail. Swipe / tap to switch. */}
          <GameRailV2
            games={games}
            teams={teams}
            selectedGameId={selectedGameId}
            onSelect={setSelectedGameId}
          />

          {/* Selected matchup intelligence — updates in place on rail select.
              Real signals only. DESK is editorial pre-model, honestly labeled.
              ROOM stays distinct from a future sportsbook MARKET.
              Primary CTA opens existing MakeCallPanel in a sheet. */}
          {selectedGame && (
            <MatchupIntel
              game={selectedGame}
              teams={teams}
              deviceId={deviceId}
              onCallLocked={() => onGoto?.("my-iq")}
            />
          )}
        </>
      )}
    </div>
  );
}


// =====================================================================
// MY IQ — the Phase 3 coach leads. Numbers are evidence underneath.
// =====================================================================
function MyIQTab({ deviceId, user, onUserChange, onGoto }) {
  const [brief, setBrief] = useState(null);
  const [rep, setRep] = useState(null);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdult = !!user?.eligibility?.adult_features_unlocked;

  const refresh = () =>
    Promise.all([
      api.get(`/iq/user/brief?device_id=${encodeURIComponent(deviceId)}`),
      api.get(`/iq/reputation?device_id=${encodeURIComponent(deviceId)}`),
      api.get("/predictions/games"),
      api.get("/stats/teams"),
    ]).then(([b, r, g, t]) => {
      setBrief(b.data);
      setRep(r.data.reputation);
      setGames(g.data.games || []);
      setTeams(t.data.teams || []);
    }).finally(() => setLoading(false));

  useEffect(() => { let live = true; refresh(); return () => { live = false; }; }, [deviceId, user]);  // eslint-disable-line

  const s = brief?.accuracy_summary;
  const insights = brief?.insights || [];
  const coachingLine = brief?.coaching_line;
  const hasHistory = s && s.total_resolved > 0;
  const hasInsights = insights.length > 0;
  const totalCalls = (s?.total_resolved || 0) + (brief?.open_calls?.length || 0);

  return (
    <div className="space-y-4" data-testid="iq-my-iq">
      {/* COACH FIRST — Marc's read is the hero */}
      <IQCoachDock
        mode="my-iq"
        deviceId={deviceId}
        line={
          coachingLine
          || (hasHistory
                ? `${s.total_resolved} calls in the book. Ask me what you're really good at.`
                : "Empty book. Make a call on Tonight and we'll start reading you.")
        }
        suggestions={hasInsights
          ? ["What am I best at?", "Where do I miss?"]
          : ["What should I start with?", "How does this work?"]
        }
      />

      {loading ? (
        <SkeletonCard label="Reading your record…" />
      ) : hasInsights ? (
        <InsightsList insights={insights} />
      ) : hasHistory ? (
        <YesterdayCard summary={s} />
      ) : (
        <ColdStartCard
          deviceId={deviceId}
          games={games}
          teams={teams}
          onMade={() => refresh()}
          onGoto={onGoto}
        />
      )}

      {/* Numbers underneath, not on top */}
      {rep && <ReputationBlock rep={rep} isAdult={isAdult} totalCalls={totalCalls} />}

      {/* Adult Betting section — hidden until unlocked */}
      <BettingSection user={user} deviceId={deviceId} onUnlocked={onUserChange} isAdult={isAdult} />

      {/* Dev-only demo trigger — only when backend has IQ_DEV_MODE=1 */}
      <DevSimulateResolve deviceId={deviceId} onResolved={refresh} />
    </div>
  );
}

function InsightsList({ insights }) {
  return (
    <div className="space-y-2.5" data-testid="iq-insights-list">
      {insights.slice(0, 6).map((i) => (
        <div
          key={`${i.code}-${i.sample_size}`}
          data-testid={`iq-insight-${i.code}`}
          className={`rounded-lg border p-3.5 ${
            i.confidence === "high"
              ? "bg-[#0e1533]/70 border-[#1e5dff]/50"
              : "bg-black/30 border-white/15"
          }`}
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-accent text-[9px] uppercase tracking-widest ${
              i.confidence === "high" ? "text-[#1e5dff]" : "text-white/50"
            }`}>{i.confidence}</span>
            <span className="text-white/30 text-[10px]">·</span>
            <span className="text-white/45 text-[10px]">{i.sample_size} calls</span>
            <span className="text-white/30 text-[10px]">·</span>
            <span className="text-white/45 text-[10px]">{i.category}</span>
          </div>
          <div className="font-headline text-white text-[15px] leading-snug mb-1">{i.headline}</div>
          <div className="text-white/75 text-sm leading-relaxed">{i.marc_voice}</div>
        </div>
      ))}
    </div>
  );
}

function YesterdayCard({ summary }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/60 to-[#050510]/60 border border-white/15 p-4" data-testid="iq-yesterday-card">
      <div className="font-accent text-[10px] uppercase tracking-widest text-[#1e5dff] mb-1">
        Your read so far
      </div>
      <div className="font-headline text-white text-lg leading-tight mb-1">
        {summary.total_resolved} graded · {summary.accuracy_pct ?? "—"}% correct.
      </div>
      <div className="text-white/60 text-sm">
        Keep the calls coming — Marc needs ~10 in a category before he'll call out a real pattern.
      </div>
    </div>
  );
}

function ColdStartCard({ deviceId, games, teams, onMade, onGoto }) {
  const first = games[0];
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/70 to-[#050510]/60 border border-[#1e5dff]/30 p-4" data-testid="iq-cold-start">
      <div className="flex items-center gap-2 mb-1.5">
        <HostPortrait persona="reggie" size={32} showName={false} className="rounded-md" />
        <div className="font-accent text-[10px] uppercase tracking-widest text-[#1e5dff]">
          Reggie · let's start
        </div>
      </div>
      <div className="font-headline text-white text-lg leading-snug mb-1">
        We haven't seen you call anything yet.
      </div>
      <div className="text-white/70 text-sm mb-3">
        Give me one call tonight. Just one. Ticker starts learning your read from there.
      </div>
      {first ? (
        <div className="rounded-lg bg-black/40 border border-white/15 p-3">
          <MakeCallPanel
            deviceId={deviceId}
            game={first}
            teams={teams}
            onDone={() => { onMade?.(); }}
            compact
          />
        </div>
      ) : (
        <button
          onClick={() => onGoto?.("tonight")}
          data-testid="iq-cold-start-goto-tonight"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
        >
          <Radio className="w-3.5 h-3.5" /> Go to Tonight
        </button>
      )}
    </div>
  );
}

function ReputationBlock({ rep, isAdult, totalCalls }) {
  const dims = [
    { key: "hockey_iq",        label: "Hockey IQ",        icon: Brain },
    { key: "accuracy_overall", label: "Accuracy",         icon: CheckCircle2 },
    { key: "community_cred",   label: "Community",        icon: Users },
    { key: "fantasy_iq",       label: "Fantasy",          icon: Trophy },
    isAdult ? { key: "betting_iq", label: "Betting", icon: Target } : null,
  ].filter(Boolean);
  return (
    <div className="space-y-2" data-testid="iq-reputation-block">
      <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">
        Your numbers
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {dims.map((d) => {
          const r = rep[d.key] || { n: 0, correct: 0, accuracy_pct: null, qualified: false };
          const Icon = d.icon;
          return (
            <div
              key={d.key}
              data-testid={`iq-rep-${d.key}`}
              className={`rounded-lg bg-black/40 border p-3 ${r.qualified ? "border-[#1e5dff]/50" : "border-white/10"}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className={`w-3 h-3 ${r.qualified ? "text-[#1e5dff]" : "text-white/40"}`} />
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/50">{d.label}</div>
              </div>
              <div className="font-headline text-xl text-white tabular-nums leading-none">
                {r.accuracy_pct != null ? `${r.accuracy_pct}%` : "—"}
              </div>
              <div className="text-white/40 text-[10px] mt-1.5">
                {r.n} graded{!r.qualified && r.n < 10 && ` · ${10 - r.n} to unlock`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// =====================================================================
// BETTING SECTION (inside My IQ)
// =====================================================================
function BettingSection({ user, deviceId, onUnlocked, isAdult }) {
  if (!isAdult) return <AdultUnlockCard deviceId={deviceId} onUnlocked={onUnlocked} />;
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#12081a] to-[#050510] border border-amber-500/30 p-4" data-testid="iq-betting-section">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-amber-300 mb-1 flex items-center gap-1.5">
            <Unlock className="w-3 h-3" /> Betting · 18+
          </div>
          <div className="font-headline text-white text-base sm:text-lg leading-tight">
            Your history. Your patterns. Your Spot Checks.
          </div>
          <div className="text-white/60 text-xs mt-1">
            Ticker reads your record and calls out where you tend to miss. Never a market edge — a pattern in you.
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <BettingTile icon={Target} headline="Spot Check" body="Pick a spot type — Marc reads your record and says LEAN IN, NEUTRAL, or SKIP." cta="Open" href="/back-office" testid="iq-open-spot-check" />
        <BettingTile icon={Flame}  headline="Bet Log"    body="Log a bet manually, or bulk-paste your history. Preview + guardrail before anything writes." cta="Open" href="/back-office" testid="iq-open-bet-log" />
        <BettingTile icon={TrendingUp} headline="Bulk Import" body="Paste 30–100 real bets. Every rejected row shows a reason." cta="Open" href="/back-office" testid="iq-open-bulk-import" />
      </div>
      <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-3">
        Attestation on file · {user?.eligibility?.attestation?.jurisdiction || "—"}
      </div>
    </div>
  );
}

function AdultUnlockCard({ deviceId, onUnlocked }) {
  const [jurisdiction, setJurisdiction] = useState("US");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await api.post("/iq/user/attest-adult", {
        device_id: deviceId, jurisdiction,
        policy_version_accepted: "adult-unlock-policy-v1",
        method: "self_attestation_v1",
      });
      await onUnlocked?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Attestation failed. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0e1533] to-[#050510] border border-white/10 p-4"
         data-testid="iq-adult-unlock-card">
      <div className="flex items-center gap-2 mb-1.5">
        <Lock className="w-4 h-4 text-white/50" />
        <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/50">Betting · locked</div>
      </div>
      <div className="font-headline text-white text-lg leading-snug mb-1">
        Unlock the betting layer
      </div>
      <p className="text-white/60 text-xs mb-3">
        Turns on Bet Log, Bulk Import, and Spot Check. Ticker never processes wagers or claims edge on a market — it reads your history and tells you when your calls tend to go bad. 18+ only.
      </p>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-accent text-[10px] uppercase tracking-widest text-white/50">Jurisdiction</span>
          <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}
            data-testid="iq-adult-unlock-jurisdiction"
            className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-white text-sm focus:outline-none focus:border-[#1e5dff]">
            <option value="US">United States</option>
            <option value="US-CA">California (US)</option>
            <option value="US-NY">New York (US)</option>
            <option value="CA">Canada</option>
            <option value="CA-ON">Ontario (Canada)</option>
            <option value="CA-BC">British Columbia (Canada)</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="flex items-start gap-2 text-white/70 text-xs">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)}
            data-testid="iq-adult-unlock-ack" className="mt-0.5 h-4 w-4 accent-[#1e5dff]" />
          I confirm I am at least 18 and eligible for real-money wagering features in the jurisdiction above.
        </label>
      </div>
      {err && <div className="text-rose-300 text-xs mt-2">{err}</div>}
      <div className="mt-3">
        <button onClick={submit} disabled={!ack || busy} data-testid="iq-adult-unlock-submit"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] disabled:opacity-40 text-white font-accent text-[10px] uppercase tracking-widest transition-colors">
          <Unlock className="w-3.5 h-3.5" /> {busy ? "Unlocking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}


// =====================================================================
// FANTASY — use the existing tracker cleanly. No roadmap language.
// =====================================================================
function FantasyTab({ deviceId }) {
  return (
    <div className="space-y-4" data-testid="iq-fantasy">
      <IQCoachDock
        mode="fantasy"
        deviceId={deviceId}
        line="Roster in? I'll help you decide start / sit and who to grab off waivers."
        suggestions={["Start/sit tonight", "Best waiver adds"]}
      />
      <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/60 to-[#050510]/60 border border-white/10 p-4">
        <div className="font-headline text-white text-lg leading-snug mb-1">
          Your team, tracked.
        </div>
        <p className="text-white/60 text-sm mb-3">
          Rosters, scoring settings, start-sit calls, waiver watchlists. Reggie will read your team when you open it.
        </p>
        <Link
          to="/fantasy"
          data-testid="iq-open-fantasy"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" /> Open Fantasy
        </Link>
      </div>
    </div>
  );
}


// =====================================================================
// COMMUNITY — people + expertise, not a database dump.
// =====================================================================
function CommunityTab({ deviceId }) {
  const [feed, setFeed] = useState([]);
  const [posts, setPosts] = useState([]);
  const [board, setBoard] = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [dimension, setDimension] = useState("hockey_iq");
  const [postBody, setPostBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      api.get("/iq/community/feed-enriched?limit=20"),
      api.get("/iq/community/posts?limit=20"),
      api.get(`/iq/leaderboard?dimension=${dimension}`),
      api.get(`/iq/community/specialists?dimension=${dimension}&limit=6`),
    ]).then(([f, p, b, sp]) => {
      setFeed(f.data.feed || []);
      setPosts(p.data.posts || []);
      setBoard(b.data.leaderboard || []);
      setSpecialists(sp.data.specialists || []);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [dimension]);  // eslint-disable-line

  const submitPost = async () => {
    if (!postBody.trim()) return;
    setPosting(true);
    try {
      await api.post("/iq/community/post", {
        device_id: deviceId, kind: "discussion", body: postBody.trim(),
        language_marker: navigator.language || null,
      });
      setPostBody("");
      load();
    } finally { setPosting(false); }
  };

  // Consensus line derived client-side from the enriched feed for tonight
  const consensus = useMemo(() => {
    if (!feed.length) return null;
    const total = feed.length;
    const publicPicks = {};
    const specialistPicks = {};
    for (const f of feed) {
      publicPicks[f.pick] = (publicPicks[f.pick] || 0) + 1;
      if (f.author?.specialty?.key === "community_cred" || f.author?.specialty?.key === "hockey_iq") {
        specialistPicks[f.pick] = (specialistPicks[f.pick] || 0) + 1;
      }
    }
    const publicTop = Object.entries(publicPicks).sort((a, b) => b[1] - a[1])[0];
    const specTop = Object.entries(specialistPicks).sort((a, b) => b[1] - a[1])[0];
    if (!publicTop) return null;
    return {
      publicPick: publicTop[0],
      publicPct: Math.round((publicTop[1] / total) * 100),
      total,
      specialistPick: specTop?.[0] || null,
      specialistCount: specTop?.[1] || 0,
      split: !!(specTop && specTop[0] !== publicTop[0]),
    };
  }, [feed]);

  const consensusLine = consensus
    ? consensus.split
      ? `Public is on ${consensus.publicPick} (${consensus.publicPct}%). The specialists lean ${consensus.specialistPick}. That's a real split.`
      : consensus.specialistCount > 0
        ? `Room and specialists both on ${consensus.publicPick} (${consensus.publicPct}% of ${consensus.total}). Rare alignment.`
        : `${consensus.publicPick} is the popular call tonight (${consensus.publicPct}% of ${consensus.total}). No specialist read yet.`
    : "Quiet room. Publish a call and start the conversation.";

  const DIMS = [
    { id: "hockey_iq",        label: "Hockey IQ" },
    { id: "accuracy_overall", label: "Accuracy" },
    { id: "community_cred",   label: "Community" },
    { id: "fantasy_iq",       label: "Fantasy" },
  ];

  return (
    <div className="space-y-4" data-testid="iq-community">
      <IQCoachDock
        mode="community"
        deviceId={deviceId}
        line={consensusLine}
        suggestions={["Who's hot tonight?", "Who fades the public?"]}
      />

      {/* Specialists strip */}
      {specialists.length > 0 && (
        <div className="space-y-2" data-testid="iq-specialists-strip">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/60 mr-1">
              Specialists · {DIMS.find(d => d.id === dimension)?.label}
            </div>
            {DIMS.map((d) => (
              <button key={d.id} onClick={() => setDimension(d.id)}
                data-testid={`iq-specialists-dim-${d.id}`}
                className={`font-accent text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors ${
                  dimension === d.id
                    ? "bg-[#1e5dff]/25 text-white border border-[#1e5dff]/60"
                    : "bg-black/30 text-white/50 border border-white/10 hover:text-white"
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {specialists.slice(0, 6).map((s) => (
              <div key={s.user_id} data-testid={`iq-specialist-${s.user_id}`}
                className="rounded-md bg-black/40 border border-[#1e5dff]/30 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3 h-3 text-[#1e5dff]" />
                  <div className="text-white text-xs font-headline truncate flex-1">{s.nickname}</div>
                </div>
                <div className="text-white/60 text-[10px] mt-1">
                  <span className="text-white font-headline">{s.accuracy_pct}%</span> · {s.n} graded
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public call feed with expertise */}
      <div className="space-y-2">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/60">
          Public calls
        </div>
        {loading ? (
          <SkeletonCard label="Loading the room…" />
        ) : feed.length === 0 ? (
          <EmptyCard headline="Nobody has published yet." body="Publish a locked call from Tonight to be first." />
        ) : (
          <div className="grid gap-2" data-testid="iq-community-feed">
            {feed.map((f) => (
              <FeedItem key={f.call_id} f={f} />
            ))}
          </div>
        )}
      </div>

      {/* Talk hockey */}
      <div className="space-y-2">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/60">
          Talk hockey
        </div>
        <div className="rounded-md bg-black/30 border border-white/10 p-2.5">
          <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)}
            placeholder="What are you seeing tonight?"
            rows={2} data-testid="iq-community-post-body"
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1e5dff]" />
          <div className="flex justify-end mt-2">
            <button onClick={submitPost} disabled={!postBody.trim() || posting}
              data-testid="iq-community-post-submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] disabled:opacity-40 text-white font-accent text-[10px] uppercase tracking-widest transition-colors">
              <Send className="w-3 h-3" /> Post
            </button>
          </div>
        </div>
        {posts.length > 0 && (
          <div className="grid gap-2" data-testid="iq-community-posts">
            {posts.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-md bg-black/20 border border-white/10 p-2.5">
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/50 mb-0.5">
                  {p.author_nickname} · {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-white text-sm leading-snug whitespace-pre-wrap">{p.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/60">
          Leaderboard · {DIMS.find(d => d.id === dimension)?.label}
        </div>
        {board.length === 0 ? (
          <div className="rounded-md bg-black/20 border border-white/10 p-3 text-white/50 text-sm">
            Nobody qualifies yet — ten graded calls in this dimension gets you on.
          </div>
        ) : (
          <div className="rounded-md bg-black/30 border border-white/10 overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2 border-b border-white/10 font-accent text-[9px] uppercase tracking-widest text-white/40">
              <div>#</div><div>Player</div><div className="text-right">Graded</div><div className="text-right">Acc.</div>
            </div>
            {board.slice(0, 12).map((row, i) => (
              <div key={row.user_id} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2 items-center border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]">
                <div className={`font-headline w-6 text-center text-sm ${i < 3 ? "text-[#1e5dff]" : "text-white/40"}`}>{i + 1}</div>
                <div className="text-white font-accent text-xs truncate">{row.nickname}</div>
                <div className="text-white/70 text-xs text-right tabular-nums">{row.n}</div>
                <div className="text-white font-headline text-right tabular-nums text-sm">{row.accuracy_pct}%</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Enriched feed item — author + specialty + record + outcome
function FeedItem({ f }) {
  const author = f.author || {};
  const rep = author.reputation_summary;
  const specialty = author.specialty;
  return (
    <div
      className="rounded-lg bg-black/40 border border-white/10 p-3 flex items-start gap-2.5"
      data-testid={`iq-feed-item-${f.call_id}`}
    >
      <HostPortrait
        persona={specialty?.key === "hockey_iq" ? "marc" : "reggie"}
        size={36}
        showName={false}
        className="rounded-md flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <div className="font-headline text-white text-sm leading-none">
            {author.anonymous ? "Anonymous" : (author.nickname || "Guest")}
          </div>
          {specialty && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#1e5dff]/20 border border-[#1e5dff]/40 text-[9px] font-accent uppercase tracking-widest text-[#9fb7ff]">
              <Award className="w-2.5 h-2.5" />
              {specialty.label} · {specialty.accuracy_pct}%
            </span>
          )}
          {!specialty && rep?.n > 0 && (
            <span className="text-white/40 text-[10px]">{rep.n} graded</span>
          )}
        </div>
        <div className="text-white/85 text-sm leading-snug">
          Called <span className="font-headline text-[#9fb7ff]">{f.pick}</span>
          {f.first_instinct && f.first_instinct.pick !== f.pick && (
            <span className="text-white/45 text-xs ml-1">(revised from {f.first_instinct.pick})</span>
          )}
          {f.subject?.team_ref && (
            <span className="text-white/45 text-xs ml-1">· {f.subject.team_ref}</span>
          )}
        </div>
        {f.reasoning_tags?.length > 0 && (
          <div className="text-white/45 text-[10px] mt-0.5">tags: {f.reasoning_tags.join(", ")}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        {f.outcome ? (
          f.outcome.correct === true ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-accent text-[10px] uppercase tracking-widest">
              <CheckCircle2 className="w-3 h-3" /> right
            </span>
          ) : f.outcome.correct === false ? (
            <span className="font-accent text-[10px] uppercase tracking-widest text-rose-400">wrong</span>
          ) : (
            <span className="font-accent text-[10px] uppercase tracking-widest text-white/40">{f.outcome.status}</span>
          )
        ) : (
          <span className="font-accent text-[10px] uppercase tracking-widest text-white/35">pending</span>
        )}
      </div>
    </div>
  );
}


// =====================================================================
// DEV-ONLY: Auto-grade locked calls so the return loop can be demoed.
// Only renders if the endpoint returns 200 (backend IQ_DEV_MODE=1).
// =====================================================================
function DevSimulateResolve({ deviceId, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/iq/dev/mode")
       .then((r) => setAvailable(!!r.data?.enabled))
       .catch(() => setAvailable(false));
  }, [deviceId]);

  if (available === false) return null;

  const run = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.post(`/iq/dev/simulate-resolve?device_id=${encodeURIComponent(deviceId)}`, {});
      setMsg(`Resolved ${r.data.resolved} locked call(s).`);
      await onResolved?.();
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Couldn't run simulated resolve.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl bg-black/40 border border-dashed border-white/15 p-3 text-white/60 text-xs" data-testid="iq-dev-resolve">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="font-accent text-[9px] uppercase tracking-widest text-white/40">Dev · demo</div>
          <div className="text-white/70">Auto-grade my locked calls to show the return loop.</div>
        </div>
        <button onClick={run} disabled={busy} data-testid="iq-dev-resolve-run"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-accent text-[10px] uppercase tracking-widest transition-colors">
          <Sparkles className="w-3 h-3" /> {busy ? "Running…" : "Grade"}
        </button>
      </div>
      {msg && <div className="mt-1.5 text-emerald-300">{msg}</div>}
    </div>
  );
}


// =====================================================================
// Shared small pieces
// =====================================================================
function BettingTile({ icon: Icon, headline, body, cta, href, testid }) {
  return (
    <Link to={href} data-testid={testid}
      className="block rounded-lg bg-black/40 border border-amber-500/25 hover:border-amber-500/60 p-3 transition-colors group">
      <Icon className="w-4 h-4 text-amber-300 mb-1.5" />
      <div className="font-headline text-white text-sm leading-tight mb-1">{headline}</div>
      <div className="text-white/60 text-[11px] mb-2 leading-snug">{body}</div>
      <div className="font-accent text-[9px] uppercase tracking-widest text-amber-300 group-hover:text-amber-200 inline-flex items-center gap-1">
        {cta} →
      </div>
    </Link>
  );
}

function SkeletonCard({ label }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-5 text-white/40 text-sm animate-pulse">
      {label}
    </div>
  );
}

function EmptyCard({ headline, body }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/10 p-5">
      <div className="font-headline text-white text-base mb-1">{headline}</div>
      <div className="text-white/55 text-sm">{body}</div>
    </div>
  );
}
