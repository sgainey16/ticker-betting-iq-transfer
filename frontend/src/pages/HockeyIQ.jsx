// Ticker Hockey IQ · Phase 1 shell.
//
// Nav decision (see /app/memory/PHASE_0_RATIFIED.md): 4 primary tabs.
//   TONIGHT · MY IQ · FANTASY · COMMUNITY
// Betting is a first-class section INSIDE My IQ, unlocked via the Phase 0
// adult-attestation flow. This preserves "Know the game. Know your numbers.
// Know yourself." as the umbrella and never fakes tabs at users who
// haven't unlocked wagering content.
//
// Reuse-first: this file wires up existing panels (Predictions logic,
// SpotCheckPanel, BetForm, BulkImportPanel, Fantasy Tracker, leaderboard).
// The only NEW UI here is the shell, hero landing, tab bar, adult unlock
// card, and accuracy summary tile.

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Radio, Brain, Trophy, Users, Target, Sparkles,
  Lock, Unlock, CheckCircle2, TrendingUp, Award, Flame,
} from "lucide-react";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { TMark } from "@/lib/brand";
import GamePickerStrip from "@/components/GamePickerStrip";

const TABS = [
  { id: "tonight",   label: "Tonight",   pitch: "What matters to me tonight",      icon: Radio },
  { id: "my-iq",     label: "My IQ",     pitch: "How good am I. What am I learning", icon: Brain },
  { id: "fantasy",   label: "Fantasy",   pitch: "What should I do with my team",   icon: Trophy },
  { id: "community", label: "Community", pitch: "Who actually knows their stuff",  icon: Users  },
];

export default function HockeyIQ() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const active = params.get("tab") || "tonight";
  const setActive = (id) => setParams({ tab: id }, { replace: true });

  const deviceId = useMemo(() => getDeviceId(), []);
  const [user, setUser] = useState(null);

  // Load / bootstrap the IQ user record on entry. This is idempotent —
  // hits `GET /api/iq/user` which get-or-creates the User for this device.
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
      className="min-h-screen bg-gradient-to-b from-[#050510] via-[#08081a] to-[#050510] text-white -mx-5 sm:-mx-8 -my-8"
      data-testid="hockey-iq-root"
    >
      {/* Sub-app header — always visible, always a way back to normal Ticker */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/")}
            data-testid="iq-back-to-ticker"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            The Ticker
          </button>
          <div className="flex items-center gap-2">
            <TMark size={22} variant="light" />
            <div className="font-headline text-white text-sm sm:text-base leading-none">
              HOCKEY IQ
            </div>
            <span className="hidden sm:inline text-[9px] font-accent uppercase tracking-[0.3em] text-[#1e5dff] pl-1">
              beta
            </span>
          </div>
          <div className="w-[68px]" />
        </div>

        {/* Tab bar — 4 tabs, adaptive width. Bottom nav on mobile, top on desktop. */}
        <nav className="max-w-6xl mx-auto px-2 sm:px-6 pb-1 flex items-stretch overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const isActive = active === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                data-testid={`iq-tab-${t.id}`}
                className={`flex-1 min-w-[90px] px-2 sm:px-4 py-2 flex flex-col items-center gap-0.5 font-accent text-[10px] sm:text-[11px] uppercase tracking-[0.18em] border-b-2 transition-colors ${
                  isActive
                    ? "text-white border-[#1e5dff]"
                    : "text-white/50 border-transparent hover:text-white/80"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#1e5dff]" : ""}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Content — max-width column, generous vertical breathing room */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {active === "tonight"   && <TonightTab userName={user?.nickname} />}
        {active === "my-iq"     && <MyIQTab user={user} deviceId={deviceId} onUserChange={refreshUser} />}
        {active === "fantasy"   && <FantasyTab />}
        {active === "community" && <CommunityTab />}
      </main>
    </div>
  );
}


// =====================================================================
// TONIGHT — "What matters to me tonight"
//   Reuses: /api/predictions/games, /api/predictions/leaderboard,
//           GamePickerStrip. Live NHL data via existing endpoints.
// =====================================================================
function TonightTab() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      api.get("/predictions/games"),
      api.get("/stats/teams"),
    ]).then(([g, t]) => {
      if (!live) return;
      setGames(g.data.games || []);
      setTeams(t.data.teams || []);
    }).finally(() => setLoading(false));
    return () => { live = false; };
  }, []);

  const gameCount = games.length;

  return (
    <div className="space-y-8" data-testid="iq-tonight">
      <Hero
        kicker="Tonight · Hockey IQ"
        headline={gameCount ? `${gameCount} games. One night to sharpen your read.` : "Tonight's card"}
        sub="Pick who wins. Add reasoning if you want. Reggie will remember what you thought — and what actually happened."
      />

      {loading ? (
        <SkeletonCard label="Loading tonight's card…" />
      ) : gameCount === 0 ? (
        <EmptyCard
          headline="No games on tonight."
          body="When the schedule fires up, this is where the night's card lands. Come back for puck drop."
        />
      ) : (
        <>
          <GamePickerStrip
            games={games}
            teams={teams}
            selectedGameId={null}
            onSelect={() => {}}
            playAllLabel="All Games"
            testids={{
              root: "iq-tonight-picker",
              all: "iq-tonight-picker-all",
              game: (id) => `iq-tonight-picker-game-${id}`,
            }}
          />
          <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/60 to-[#050510]/60 border border-white/10 p-5 sm:p-6">
            <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff] mb-1">
              Ready to call it?
            </div>
            <div className="font-headline text-xl sm:text-2xl text-white mb-3">
              Go to the full picking room →
            </div>
            <p className="text-white/60 text-sm mb-4 max-w-2xl">
              The current predictions surface has everything wired up — game-by-game pick, reasoning, streak, leaderboard.
              It's moving into Hockey IQ properly in Phase 2. Until then, this is where you play tonight's card.
            </p>
            <Link
              to="/show"
              data-testid="iq-tonight-open-predictions"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              Open tonight's picks
            </Link>
          </div>
        </>
      )}
    </div>
  );
}


// =====================================================================
// MY IQ — "How good am I. What am I learning."
//   Personal history via Phase 0's /iq/user/brief endpoint.
//   BETTING sub-section appears here for adults only (post-attestation).
//   Reuses SpotCheckPanel + BetForm + BulkImportPanel via the DEV Back Office.
// =====================================================================
function MyIQTab({ user, deviceId, onUserChange }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdult = !!user?.eligibility?.adult_features_unlocked;

  useEffect(() => {
    let live = true;
    api.get(`/iq/user/brief?device_id=${encodeURIComponent(deviceId)}`)
       .then((r) => { if (live) setBrief(r.data); })
       .finally(() => setLoading(false));
    return () => { live = false; };
  }, [deviceId, user]);

  const s = brief?.accuracy_summary;

  return (
    <div className="space-y-8" data-testid="iq-my-iq">
      <Hero
        kicker="My IQ"
        headline={brief && s?.total_resolved > 0
          ? `${s.total_resolved} calls graded. ${s.accuracy_pct ?? "—"}% on gradeable.`
          : "You haven't graded any calls yet."}
        sub={brief && s?.total_resolved > 0
          ? "Your record, honest. First-instinct vs revised, by kind, by reasoning tag — everything Hockey IQ is learning about how you decide."
          : "Every game you pick, every prop you call — Ticker remembers. Start on Tonight, come back here to see the pattern."}
      />

      {/* Accuracy snapshot — derived from Phase 0 brief. Only shows if there
       * are resolved calls to summarise. */}
      {loading ? (
        <SkeletonCard label="Loading your history…" />
      ) : s && s.total_resolved > 0 ? (
        <div className="grid sm:grid-cols-4 gap-3">
          <StatTile
            icon={CheckCircle2}
            label="Accuracy"
            value={s.accuracy_pct != null ? `${s.accuracy_pct}%` : "—"}
            sub={`${s.correct} of ${s.gradeable} gradeable`}
            accent="emerald"
          />
          <StatTile
            icon={Sparkles}
            label="First instinct"
            value={s.first_instinct_accuracy_pct != null ? `${s.first_instinct_accuracy_pct}%` : "—"}
            sub="how often your gut was right"
          />
          <StatTile
            icon={TrendingUp}
            label="Changed mind"
            value={s.changed_mind_accuracy_pct != null ? `${s.changed_mind_accuracy_pct}%` : "—"}
            sub="revised & correct"
          />
          <StatTile
            icon={Award}
            label="Total graded"
            value={s.total_resolved}
            sub={s.ungradeable ? `${s.ungradeable} ungradeable` : "all binary"}
          />
        </div>
      ) : (
        <EmptyCard
          headline="Not enough data yet."
          body="Make a few picks on Tonight. Come back here after those games have graded."
        />
      )}

      {/* Adult Betting section — content flexes based on eligibility. */}
      <BettingSection user={user} deviceId={deviceId} onUnlocked={onUserChange} isAdult={isAdult} />
    </div>
  );
}


// =====================================================================
// BETTING SECTION (inside My IQ)
//   Adaptive: shows attestation card when locked, Spot Check + Bet History
//   when unlocked. All the frozen panels live in the DEV Back Office —
//   Phase 1 links to them rather than re-implementing them so the frozen
//   engine is 100% preserved.
// =====================================================================
function BettingSection({ user, deviceId, onUnlocked, isAdult }) {
  if (!isAdult) {
    return <AdultUnlockCard deviceId={deviceId} onUnlocked={onUnlocked} />;
  }
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#12081a] to-[#050510] border border-amber-500/30 p-5 sm:p-7" data-testid="iq-betting-section">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-amber-300 mb-1 flex items-center gap-2">
            <Unlock className="w-3 h-3" /> Adult · Betting
          </div>
          <div className="font-headline text-xl sm:text-2xl text-white">
            Your history. Your patterns. Your Spot Checks.
          </div>
          <div className="text-white/60 text-sm mt-1">
            Frozen v2 engine. Never claims market edge — reads your history and tells you when you tend to make bad calls.
          </div>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <BettingTile
          icon={Target}
          headline="Spot Check"
          body="Pick a spot type. Marc reads your record. LEAN IN, NEUTRAL, or SKIP — with the reasoning."
          cta="Run a Spot Check"
          href="/back-office"
          testid="iq-open-spot-check"
        />
        <BettingTile
          icon={Flame}
          headline="Bet Log"
          body="Log a bet manually, or bulk-paste your history. 8-column CSV, preview + guardrail before anything writes."
          cta="Open Bet Log"
          href="/back-office"
          testid="iq-open-bet-log"
        />
        <BettingTile
          icon={TrendingUp}
          headline="Bulk Import"
          body="Paste 30–100 real bets. Validation shows every rejected row with a clear reason. No silent contamination."
          cta="Open Bulk Import"
          href="/back-office"
          testid="iq-open-bulk-import"
        />
      </div>
      <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-4">
        Betting content is 18+. Attestation on file · {user?.eligibility?.attestation?.jurisdiction || "—"}
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
        device_id: deviceId,
        jurisdiction,
        policy_version_accepted: "adult-unlock-policy-v1",
        method: "self_attestation_v1",
      });
      await onUnlocked?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Attestation failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl bg-gradient-to-br from-[#0e1533] to-[#050510] border border-white/10 p-5 sm:p-7"
      data-testid="iq-adult-unlock-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-white/50" />
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">
          Adult · Locked
        </div>
      </div>
      <div className="font-headline text-xl sm:text-2xl text-white mb-2">
        Unlock the betting layer inside Hockey IQ
      </div>
      <p className="text-white/60 text-sm mb-4 max-w-2xl">
        Turns on Bet Log + Bulk Import + frozen v2 Spot Check. Hockey IQ never processes wagers, tells you a play is "guaranteed",
        or claims a market edge — it reads YOUR history and tells you when you tend to make bad calls. 18+ only.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="font-accent text-[10px] uppercase tracking-widest text-white/50">Jurisdiction</span>
          <select
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            data-testid="iq-adult-unlock-jurisdiction"
            className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-white text-sm focus:outline-none focus:border-[#1e5dff]"
          >
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
        <label className="flex items-start gap-2 text-white/70 text-xs max-w-xl">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            data-testid="iq-adult-unlock-ack"
            className="mt-0.5 h-4 w-4 accent-[#1e5dff]"
          />
          I confirm I am at least 18 years old and legally eligible for real-money wagering features
          in the jurisdiction above. I understand The Ticker does not process wagers.
        </label>
      </div>

      {err && <div className="text-rose-300 text-xs mt-3">{err}</div>}

      <div className="mt-5">
        <button
          onClick={submit}
          disabled={!ack || busy}
          data-testid="iq-adult-unlock-submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] disabled:opacity-40 text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
        >
          <Unlock className="w-3.5 h-3.5" />
          {busy ? "Unlocking…" : "Unlock adult features"}
        </button>
      </div>
    </div>
  );
}


// =====================================================================
// FANTASY — "What should I do with my team"
//   Phase 1: link to existing /fantasy page (works today with mock data).
//   Phase 4 will bring Yahoo/ESPN import + real player data.
// =====================================================================
function FantasyTab() {
  return (
    <div className="space-y-8" data-testid="iq-fantasy">
      <Hero
        kicker="Fantasy"
        headline="What should I do with my team?"
        sub="Roster health, start/sit calls, waiver ideas. Yahoo/ESPN import lands in a later phase — for now, punch in your roster and Reggie reads it."
      />
      <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/60 to-[#050510]/60 border border-white/10 p-5 sm:p-7">
        <div className="font-headline text-xl sm:text-2xl text-white mb-2">
          Open the Fantasy Tracker
        </div>
        <p className="text-white/60 text-sm mb-4 max-w-2xl">
          The existing tracker already handles rosters, scoring settings, start-sit logic and waiver watchlists.
          It's moving into Hockey IQ properly with real league import in Phase 4.
        </p>
        <Link
          to="/fantasy"
          data-testid="iq-open-fantasy"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" /> Open Fantasy Tracker
        </Link>
      </div>
    </div>
  );
}


// =====================================================================
// COMMUNITY — "Who actually knows their stuff"
//   Reuses /api/predictions/leaderboard. Verified specialists / forum
//   / Community Edge™ come in later phases.
// =====================================================================
function CommunityTab() {
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api.get("/predictions/leaderboard").then((r) => {
      if (!live) return;
      setBoard(r.data.leaderboard || []);
    }).finally(() => setLoading(false));
    return () => { live = false; };
  }, []);

  return (
    <div className="space-y-8" data-testid="iq-community">
      <Hero
        kicker="Community"
        headline="Who actually knows their stuff?"
        sub="Right now: overall accuracy across everyone playing tonight's card. Verified team specialists, forum threads and Community Edge™ come next."
      />

      {loading ? (
        <SkeletonCard label="Loading the room…" />
      ) : board.length === 0 ? (
        <EmptyCard headline="Nobody's on the board yet." body="Play tonight's card. You'll show up here." />
      ) : (
        <div className="rounded-xl bg-black/30 border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-3 border-b border-white/10 font-accent text-[9px] uppercase tracking-widest text-white/40">
            <div>#</div><div>Player</div><div className="text-right">Correct</div><div className="text-right">Resolved</div><div className="text-right">Accuracy</div>
          </div>
          {board.slice(0, 20).map((row, i) => (
            <div key={row.user_name} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 px-4 py-2.5 items-center border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]">
              <div className={`font-headline w-7 text-center ${i < 3 ? "text-[#1e5dff]" : "text-white/40"}`}>{i + 1}</div>
              <div className="text-white font-accent text-sm truncate">{row.user_name}</div>
              <div className="text-white/70 text-sm text-right tabular-nums">{row.correct}</div>
              <div className="text-white/70 text-sm text-right tabular-nums">{row.resolved}</div>
              <div className="text-white font-headline text-right tabular-nums">{row.accuracy}%</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-white/15 p-5 text-white/50 text-sm">
        <span className="font-accent text-[10px] uppercase tracking-widest text-white/40">Coming next</span>
        <div className="mt-1">Verified specialists · per-team leaderboards · forum threads with fact/reported/rumor tiers · Community Edge™</div>
      </div>
    </div>
  );
}


// =====================================================================
// Small shared UI pieces — keep them here (single file) rather than
// splintering into a dozen tiny files during Phase 1.
// =====================================================================

function Hero({ kicker, headline, sub }) {
  return (
    <div className="pt-2 pb-1">
      <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-[#1e5dff] mb-2">
        {kicker}
      </div>
      <h1 className="font-headline text-3xl sm:text-5xl leading-[1.05] text-white max-w-3xl">
        {headline}
      </h1>
      {sub && (
        <p className="text-white/60 text-sm sm:text-base mt-3 max-w-2xl">
          {sub}
        </p>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, accent }) {
  const accentCls = accent === "emerald" ? "text-emerald-300" : "text-[#1e5dff]";
  return (
    <div className="rounded-lg bg-black/40 border border-white/10 p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${accentCls}`} />
        <div className="font-accent text-[9px] uppercase tracking-widest text-white/50">{label}</div>
      </div>
      <div className="font-headline text-3xl text-white leading-none tabular-nums">{value}</div>
      {sub && <div className="text-white/40 text-[11px] mt-2">{sub}</div>}
    </div>
  );
}

function BettingTile({ icon: Icon, headline, body, cta, href, testid }) {
  return (
    <Link
      to={href}
      data-testid={testid}
      className="block rounded-lg bg-black/40 border border-amber-500/25 hover:border-amber-500/60 p-4 transition-colors group"
    >
      <Icon className="w-5 h-5 text-amber-300 mb-2" />
      <div className="font-headline text-white text-lg leading-tight mb-1">{headline}</div>
      <div className="text-white/60 text-xs mb-3 leading-snug">{body}</div>
      <div className="font-accent text-[10px] uppercase tracking-widest text-amber-300 group-hover:text-amber-200 inline-flex items-center gap-1">
        {cta} →
      </div>
    </Link>
  );
}

function SkeletonCard({ label }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-6 text-white/40 text-sm animate-pulse">
      {label}
    </div>
  );
}

function EmptyCard({ headline, body }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/10 p-6">
      <div className="font-headline text-white text-lg mb-1">{headline}</div>
      <div className="text-white/50 text-sm">{body}</div>
    </div>
  );
}
