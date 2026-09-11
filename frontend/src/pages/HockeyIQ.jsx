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
  Send, Eye, EyeOff, MessageSquare, Globe,
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
  const deviceId = useMemo(() => getDeviceId(), []);
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
      setGames(g.data.games || []);
      setTeams(t.data.teams || []);
    }).finally(() => setLoading(false));
    return () => { live = false; };
  }, []);

  const gameCount = games.length;
  const selectedGame = games.find((g) => g.id === selectedGameId);

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
            selectedGameId={selectedGameId}
            onSelect={setSelectedGameId}
            playAllLabel="All Games"
            testids={{
              root: "iq-tonight-picker",
              all: "iq-tonight-picker-all",
              game: (id) => `iq-tonight-picker-game-${id}`,
            }}
          />

          {selectedGame ? (
            <MakeACall
              deviceId={deviceId}
              game={selectedGame}
              teams={teams}
              onClosed={() => setSelectedGameId(null)}
            />
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/60 to-[#050510]/60 border border-white/10 p-5 sm:p-6" data-testid="iq-tonight-prompt">
              <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff] mb-1">
                Pick a game above
              </div>
              <div className="font-headline text-xl sm:text-2xl text-white mb-1">
                Then tell Ticker who you like.
              </div>
              <p className="text-white/60 text-sm">
                It becomes a call in your history. Keep it private — it still counts toward your Personal IQ.
                Publish it — it goes on the community feed and, when it resolves, adds to your community credibility.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}


// The inline "Make a call" flow — Think → Call → Lock → optionally Publish.
// Uses the Phase 0 event pipeline. Zero new endpoints needed.
function MakeACall({ deviceId, game, teams, onClosed }) {
  const teamMeta = (code) => teams.find((t) => t.code === code) || {};
  const home = teamMeta(game.home);
  const away = teamMeta(game.away);
  const homeName = home.name || game.home;
  const awayName = away.name || game.away;

  const [step, setStep] = useState("instinct");  // instinct | reason | lock | done
  const [callId, setCallId] = useState(null);
  const [pick, setPick] = useState(null);
  const [reasoning, setReasoning] = useState("");
  const [confidence, setConfidence] = useState(5);
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const startCall = async (whichSide) => {
    setBusy(true); setErr("");
    try {
      const r = await api.post("/iq/call/event", {
        device_id: deviceId, call_id: null, kind: "instinct_captured",
        call_kind: "game_pick",
        subject: { game_id: game.id, home: game.home, away: game.away },
        payload: { pick: whichSide }, source: "tap",
      });
      setCallId(r.data.call.id);
      setPick(whichSide);
      setStep("reason");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't start the call.");
    } finally {
      setBusy(false);
    }
  };

  const submitReasoning = async () => {
    setBusy(true); setErr("");
    try {
      if (reasoning.trim()) {
        await api.post("/iq/call/event", {
          device_id: deviceId, call_id: callId, kind: "reasoning_added",
          payload: { text: reasoning.trim(), tags: [] }, source: "tap",
        });
      }
      await api.post("/iq/call/event", {
        device_id: deviceId, call_id: callId, kind: "confidence_set",
        payload: { value: confidence }, source: "tap",
      });
      setStep("lock");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't save reasoning.");
    } finally {
      setBusy(false);
    }
  };

  const lockCall = async () => {
    setBusy(true); setErr("");
    try {
      await api.post("/iq/call/event", {
        device_id: deviceId, call_id: callId, kind: "locked",
        payload: {
          explicit: true,
          ui_action: "iq_tonight_lock_button",
          confirmation_prompt: `Lock ${pick === game.home ? homeName : awayName}?`,
          user_response: "confirmed",
        },
        source: "tap",
      });
      if (visibility !== "private") {
        await api.patch(`/iq/call/${callId}/visibility`, { device_id: deviceId, visibility });
      }
      setStep("done");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't lock the call.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep("instinct"); setCallId(null); setPick(null);
    setReasoning(""); setConfidence(5); setVisibility("private");
    onClosed?.();
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0e1533]/70 to-[#050510]/70 border border-[#1e5dff]/30 p-5 sm:p-6" data-testid="iq-make-a-call">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff] mb-1">
            {step === "done" ? "Locked" : "Make a call"}
          </div>
          <div className="font-headline text-lg sm:text-xl text-white leading-tight">
            {awayName} @ {homeName}
          </div>
        </div>
        <button
          onClick={reset}
          className="text-white/40 hover:text-white text-xs font-accent uppercase tracking-widest"
          data-testid="iq-make-a-call-cancel"
        >
          {step === "done" ? "Done" : "Cancel"}
        </button>
      </div>

      {err && <div className="text-rose-300 text-xs mb-3">{err}</div>}

      {step === "instinct" && (
        <div>
          <div className="text-white/60 text-sm mb-3">First instinct — who wins?</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => startCall(game.away)}
              disabled={busy}
              data-testid="iq-mkcall-pick-away"
              className="rounded-lg bg-black/40 border border-white/15 hover:border-[#1e5dff] hover:bg-[#1e5dff]/10 p-4 transition-colors text-left"
            >
              <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">Away</div>
              <div className="font-headline text-white text-lg mt-1">{awayName}</div>
            </button>
            <button
              onClick={() => startCall(game.home)}
              disabled={busy}
              data-testid="iq-mkcall-pick-home"
              className="rounded-lg bg-black/40 border border-white/15 hover:border-[#1e5dff] hover:bg-[#1e5dff]/10 p-4 transition-colors text-left"
            >
              <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">Home</div>
              <div className="font-headline text-white text-lg mt-1">{homeName}</div>
            </button>
          </div>
        </div>
      )}

      {step === "reason" && (
        <div className="space-y-3">
          <div className="text-white/70 text-sm">
            You said <span className="font-headline text-white">{pick === game.home ? homeName : awayName}</span>. Anything driving that?
          </div>
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder="Optional — a line of reasoning. Ticker remembers this."
            rows={2}
            data-testid="iq-mkcall-reasoning"
            className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1e5dff]"
          />
          <label className="block">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Confidence</span>
              <span className="font-headline text-white">{confidence}/10</span>
            </div>
            <input
              type="range" min="1" max="10" value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value, 10))}
              data-testid="iq-mkcall-confidence"
              className="w-full accent-[#1e5dff]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={submitReasoning}
              disabled={busy}
              data-testid="iq-mkcall-continue"
              className="px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              {busy ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === "lock" && (
        <div className="space-y-4">
          <div className="rounded-md bg-black/30 border border-white/10 p-3">
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/40 mb-1">Your call</div>
            <div className="font-headline text-white text-lg">{pick === game.home ? homeName : awayName}</div>
            <div className="text-white/60 text-xs">Confidence {confidence}/10{reasoning ? ` · "${reasoning}"` : ""}</div>
          </div>

          <div>
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/50 mb-2">Visibility · your choice</div>
            <div className="grid gap-2">
              <VisibilityOption
                value="private" current={visibility} onChoose={setVisibility}
                icon={EyeOff} label="Private"
                sub="Only you. Still counts toward your Personal IQ."
              />
              <VisibilityOption
                value="public" current={visibility} onChoose={setVisibility}
                icon={Globe} label="Public"
                sub="Post to the community feed. Builds community credibility when it resolves."
              />
              <VisibilityOption
                value="anonymous_aggregate" current={visibility} onChoose={setVisibility}
                icon={Eye} label="Anonymous"
                sub="Signal shared, identity hidden. Doesn't reveal your strategy."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={lockCall}
              disabled={busy}
              data-testid="iq-mkcall-lock"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              {busy ? "Locking…" : "Lock the call"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <div className="font-headline text-white text-lg">Call is on the record.</div>
          <div className="text-white/60 text-sm mt-1">
            {visibility === "private" && "Kept private. It'll count toward My IQ when it resolves."}
            {visibility === "public" && "Published to the community feed. Community credibility unlocks on resolve."}
            {visibility === "anonymous_aggregate" && "Published anonymously. Signal without the strategy."}
          </div>
        </div>
      )}
    </div>
  );
}

function VisibilityOption({ value, current, onChoose, icon: Icon, label, sub }) {
  const active = value === current;
  return (
    <button
      onClick={() => onChoose(value)}
      data-testid={`iq-mkcall-vis-${value}`}
      className={`text-left rounded-md border p-3 transition-colors flex items-start gap-2 ${
        active
          ? "bg-[#1e5dff]/15 border-[#1e5dff]"
          : "bg-black/30 border-white/10 hover:border-white/25"
      }`}
    >
      <Icon className={`w-4 h-4 mt-0.5 ${active ? "text-[#1e5dff]" : "text-white/50"}`} />
      <div>
        <div className={`font-accent text-[11px] uppercase tracking-widest ${active ? "text-white" : "text-white/70"}`}>{label}</div>
        <div className="text-white/50 text-xs mt-0.5">{sub}</div>
      </div>
    </button>
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
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(true);
  const isAdult = !!user?.eligibility?.adult_features_unlocked;

  useEffect(() => {
    let live = true;
    Promise.all([
      api.get(`/iq/user/brief?device_id=${encodeURIComponent(deviceId)}`),
      api.get(`/iq/reputation?device_id=${encodeURIComponent(deviceId)}`),
    ]).then(([b, r]) => {
      if (!live) return;
      setBrief(b.data);
      setRep(r.data.reputation);
    }).finally(() => setLoading(false));
    return () => { live = false; };
  }, [deviceId, user]);

  const s = brief?.accuracy_summary;
  const insights = brief?.insights || [];
  const coachingLine = brief?.coaching_line;

  return (
    <div className="space-y-8" data-testid="iq-my-iq">
      <Hero
        kicker="My IQ"
        headline={insights.length > 0
          ? "What Hockey IQ is learning about you"
          : (brief && s?.total_resolved > 0
              ? `${s.total_resolved} calls graded. ${s.accuracy_pct ?? "—"}% on gradeable.`
              : "You haven't graded any calls yet.")}
        sub={insights.length > 0
          ? "Interpretation over raw numbers. Each read carries its sample size — historical performance is not future edge."
          : "Every game you pick, every prop you call — Ticker remembers. Start on Tonight, come back here to see the pattern."}
      />

      {/* PHASE 3: Insight list — sentences, not a wall of numbers. */}
      {loading ? (
        <SkeletonCard label="Reading your record…" />
      ) : insights.length > 0 ? (
        <div className="space-y-3" data-testid="iq-insights-list">
          {coachingLine && (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/40 p-4 sm:p-5" data-testid="iq-coaching-line">
              <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-amber-300 mb-2 flex items-center gap-2">
                <Target className="w-3 h-3" /> Marc · tonight's read
              </div>
              <div className="text-white text-sm sm:text-base leading-relaxed">{coachingLine}</div>
            </div>
          )}
          {insights.slice(0, 8).map((i) => (
            <div
              key={`${i.code}-${i.sample_size}`}
              data-testid={`iq-insight-${i.code}`}
              className={`rounded-lg border p-4 sm:p-5 ${
                i.confidence === "high"
                  ? "bg-[#0e1533]/60 border-[#1e5dff]/50"
                  : "bg-black/30 border-white/15"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`font-accent text-[10px] uppercase tracking-widest ${
                  i.confidence === "high" ? "text-[#1e5dff]" : "text-white/50"
                }`}>{i.confidence} confidence</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/40 text-xs">{i.sample_size} calls</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/40 text-xs">{i.category}</span>
              </div>
              <div className="font-headline text-white text-base sm:text-lg leading-snug mb-1">
                {i.headline}
              </div>
              <div className="text-white/70 text-sm leading-relaxed">
                {i.marc_voice}
              </div>
            </div>
          ))}
        </div>
      ) : s && s.total_resolved > 0 ? (
        <EmptyCard
          headline={`${s.total_resolved} calls graded — patterns still forming.`}
          body={`Hockey IQ won't call out patterns from a small sample. Each interpretation needs at least 10 calls in that category. You're on your way.`}
        />
      ) : (
        <EmptyCard
          headline="Not enough data yet."
          body="Make a few picks on Tonight. Come back here after those games have graded."
        />
      )}

      {/* Reputation dimensions — five separate scores, never collapsed. */}
      {rep && <ReputationBlock rep={rep} isAdult={isAdult} />}

      {/* Adult Betting section — content flexes based on eligibility. */}
      <BettingSection user={user} deviceId={deviceId} onUnlocked={onUserChange} isAdult={isAdult} />
    </div>
  );
}


function ReputationBlock({ rep, isAdult }) {
  const dims = [
    { key: "hockey_iq",        label: "Hockey IQ",        pitch: "general prediction",       icon: Brain },
    { key: "accuracy_overall", label: "Accuracy",         pitch: "everything gradeable",     icon: CheckCircle2 },
    { key: "community_cred",   label: "Community cred",   pitch: "public + resolved",        icon: Users },
    { key: "fantasy_iq",       label: "Fantasy IQ",       pitch: "lineup calls",             icon: Trophy },
    isAdult ? { key: "betting_iq", label: "Betting IQ", pitch: "wager-attached accuracy", icon: Target } : null,
  ].filter(Boolean);
  return (
    <div className="space-y-3" data-testid="iq-reputation-block">
      <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">
        Reputation · kept separate on purpose
      </div>
      <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {dims.map((d) => {
          const r = rep[d.key] || { n: 0, correct: 0, accuracy_pct: null, qualified: false };
          const Icon = d.icon;
          return (
            <div
              key={d.key}
              data-testid={`iq-rep-${d.key}`}
              className={`rounded-lg bg-black/40 border p-4 ${r.qualified ? "border-[#1e5dff]/40" : "border-white/10"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${r.qualified ? "text-[#1e5dff]" : "text-white/40"}`} />
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/50">{d.label}</div>
              </div>
              <div className="font-headline text-2xl text-white tabular-nums leading-none">
                {r.accuracy_pct != null ? `${r.accuracy_pct}%` : "—"}
              </div>
              <div className="text-white/40 text-[11px] mt-2">
                {r.n} graded · {d.pitch}
                {!r.qualified && r.n < 10 && (
                  <span className="block mt-0.5 text-white/30">Unqualified · {10 - r.n} more needed</span>
                )}
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
  const deviceId = useMemo(() => getDeviceId(), []);
  const [feed, setFeed] = useState([]);
  const [posts, setPosts] = useState([]);
  const [board, setBoard] = useState([]);
  const [dimension, setDimension] = useState("hockey_iq");
  const [postBody, setPostBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      api.get("/iq/community/public-calls?limit=20"),
      api.get("/iq/community/posts?limit=20"),
      api.get(`/iq/leaderboard?dimension=${dimension}`),
    ]).then(([f, p, b]) => {
      setFeed(f.data.feed || []);
      setPosts(p.data.posts || []);
      setBoard(b.data.leaderboard || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [dimension]);

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
    } finally {
      setPosting(false);
    }
  };

  const DIMS = [
    { id: "hockey_iq",        label: "Hockey IQ" },
    { id: "accuracy_overall", label: "Accuracy" },
    { id: "community_cred",   label: "Community cred" },
    { id: "fantasy_iq",       label: "Fantasy IQ" },
  ];

  return (
    <div className="space-y-8" data-testid="iq-community">
      <Hero
        kicker="Community · Hockey IQ"
        headline="Who actually knows their stuff?"
        sub="Public calls with outcomes attached. Conversation about hockey. Leaderboards that reward accuracy — not posting frequency."
      />

      {/* Public call feed — the payoff of publishing */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/60">Public calls</div>
          <div className="text-[10px] text-white/30">graded when the game ends</div>
        </div>
        {loading ? (
          <SkeletonCard label="Loading the room…" />
        ) : feed.length === 0 ? (
          <EmptyCard headline="Nobody has published yet." body="Publish a locked call from Tonight to be first." />
        ) : (
          <div className="grid gap-2" data-testid="iq-community-feed">
            {feed.map((f) => (
              <div key={f.call_id} className="rounded-md bg-black/30 border border-white/10 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-accent text-[9px] uppercase tracking-widest text-white/40">
                      {f.author.anonymous ? "Anonymous" : f.author.nickname}
                    </span>
                    {f.author.anonymous && <Eye className="w-3 h-3 text-white/30" />}
                  </div>
                  <div className="font-headline text-white text-base leading-tight">
                    Called <span className="text-[#1e5dff]">{f.pick}</span>
                    {f.first_instinct && f.first_instinct.pick !== f.pick && (
                      <span className="text-white/40 text-sm ml-1">(revised from {f.first_instinct.pick})</span>
                    )}
                  </div>
                  {f.reasoning_tags?.length > 0 && (
                    <div className="text-white/50 text-xs mt-1">tags: {f.reasoning_tags.join(", ")}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {f.outcome ? (
                    f.outcome.correct === true ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-accent text-[11px] uppercase tracking-widest">
                        <CheckCircle2 className="w-3.5 h-3.5" /> right
                      </span>
                    ) : f.outcome.correct === false ? (
                      <span className="font-accent text-[11px] uppercase tracking-widest text-rose-400">wrong</span>
                    ) : (
                      <span className="font-accent text-[11px] uppercase tracking-widest text-white/40">{f.outcome.status}</span>
                    )
                  ) : (
                    <span className="font-accent text-[11px] uppercase tracking-widest text-white/30">pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Community conversation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/60">Talk hockey</div>
          <div className="text-[10px] text-white/30">general hockey — betting talk stays in the adult section</div>
        </div>
        <div className="rounded-md bg-black/30 border border-white/10 p-3">
          <textarea
            value={postBody}
            onChange={(e) => setPostBody(e.target.value)}
            placeholder="What are you seeing tonight?"
            rows={2}
            data-testid="iq-community-post-body"
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1e5dff]"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={submitPost}
              disabled={!postBody.trim() || posting}
              data-testid="iq-community-post-submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] disabled:opacity-40 text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> Post
            </button>
          </div>
        </div>
        {posts.length > 0 && (
          <div className="grid gap-2" data-testid="iq-community-posts">
            {posts.slice(0, 10).map((p) => (
              <div key={p.id} className="rounded-md bg-black/20 border border-white/8 p-3">
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/40 mb-1">
                  {p.author_nickname} · {new Date(p.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-white text-sm leading-snug whitespace-pre-wrap">{p.body}</div>
                {p.culture_meta?.team_refs?.length > 0 && (
                  <div className="text-white/40 text-[11px] mt-1">re: {p.culture_meta.team_refs.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified-performance leaderboards — per dimension */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/60 mr-2">
            Leaderboard
          </div>
          {DIMS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDimension(d.id)}
              data-testid={`iq-leaderboard-dim-${d.id}`}
              className={`font-accent text-[10px] uppercase tracking-widest px-2 py-1 rounded-full transition-colors ${
                dimension === d.id
                  ? "bg-[#1e5dff]/25 text-white border border-[#1e5dff]/60"
                  : "bg-black/30 text-white/50 border border-white/10 hover:text-white"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {board.length === 0 ? (
          <div className="rounded-md bg-black/20 border border-white/10 p-4 text-white/50 text-sm">
            No one is qualified for the <span className="text-white">{DIMS.find(x => x.id === dimension)?.label}</span> leaderboard yet.
            Users need at least 10 resolved calls in this dimension to appear. Volume alone doesn't rank.
          </div>
        ) : (
          <div className="rounded-md bg-black/30 border border-white/10 overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2 border-b border-white/10 font-accent text-[9px] uppercase tracking-widest text-white/40">
              <div>#</div><div>Player</div><div className="text-right">Graded</div><div className="text-right">Accuracy</div>
            </div>
            {board.slice(0, 15).map((row, i) => (
              <div key={row.user_id} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2.5 items-center border-b border-white/5 last:border-b-0 hover:bg-white/[0.03]">
                <div className={`font-headline w-7 text-center ${i < 3 ? "text-[#1e5dff]" : "text-white/40"}`}>{i + 1}</div>
                <div className="text-white font-accent text-sm truncate">{row.nickname}</div>
                <div className="text-white/70 text-sm text-right tabular-nums">{row.n}</div>
                <div className="text-white font-headline text-right tabular-nums">{row.accuracy_pct}%</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-white/15 p-5 text-white/50 text-sm">
        <span className="font-accent text-[10px] uppercase tracking-widest text-white/40">Coming next</span>
        <div className="mt-1">Verified team specialists · per-team leaderboards · reply threads with fact/reported/rumor tiers · a cultural language layer that keeps Reggie current without polluting his voice.</div>
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
