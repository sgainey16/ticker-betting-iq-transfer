import { useState } from "react";
import { Link } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import {
  Target,
  Zap,
  Trophy,
  Users,
  Settings,
  Crown,
  ArrowUpRight,
  Flame,
  TrendingUp,
  Lock,
  Star,
} from "lucide-react";

const TABS = [
  { id: "picks",      label: "Your Picks",  icon: Target,   kicker: "Track record" },
  { id: "edge",       label: "Edge Score",  icon: Zap,      kicker: "Reggie's rating of you" },
  { id: "fantasy",    label: "Fantasy",     icon: Trophy,   kicker: "Your roster + AI" },
  { id: "social",     label: "Social",      icon: Users,    kicker: "Public profile · followers" },
  { id: "prefs",      label: "Preferences", icon: Settings, kicker: "Team · pace · voice" },
  { id: "membership", label: "Membership",  icon: Crown,    kicker: "Founding Member · billing" },
];

export default function BackOffice() {
  const [active, setActive] = useState("picks");
  const activeTab = TABS.find((t) => t.id === active);

  return (
    <div className="space-y-6" data-testid={TEST_IDS.backOffice.pageRoot}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/50">
            The Ticker · Your Console
          </div>
          <div className="font-headline text-3xl sm:text-4xl text-white mt-1">
            Back Office
          </div>
          <div className="text-white/60 text-sm mt-1 max-w-xl">
            {activeTab?.kicker}
          </div>
        </div>
        <MembershipBadge />
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        {/* Left rail (desktop) / horizontal scroll (mobile) */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActive(t.id)}
                  data-testid={TEST_IDS.backOffice.tab(t.id)}
                  className={`flex-shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors border ${
                    isActive
                      ? "bg-[#1e5dff]/15 border-[#1e5dff]/60 text-white"
                      : "bg-transparent border-transparent text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? "text-[#1e5dff]" : "text-white/50"
                    }`}
                  />
                  <span className="font-accent text-[12px] uppercase tracking-widest whitespace-nowrap">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <section>
          {active === "picks"      && <PicksTab />}
          {active === "edge"       && <EdgeScoreTab />}
          {active === "fantasy"    && <FantasyTab />}
          {active === "social"     && <SocialTab />}
          {active === "prefs"      && <PreferencesTab />}
          {active === "membership" && <MembershipTab />}
        </section>
      </div>
    </div>
  );
}

/* -------- Small shared bits -------- */

function MembershipBadge() {
  // Placeholder — reads local device.js later. For now: assumes free user.
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-[#2d2d35] bg-[#0e0e14] px-3 py-2">
      <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">
        Status
      </div>
      <div className="font-accent text-[11px] uppercase tracking-widest text-white">
        Free Tier
      </div>
      <Link
        to="/login"
        className="ml-2 font-accent text-[10px] uppercase tracking-widest text-[#f5c542] hover:text-white transition-colors flex items-center gap-1"
      >
        Upgrade <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function SectionHeader({ kicker, title, right }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div>
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/45">
          {kicker}
        </div>
        <div className="font-headline text-2xl text-white mt-0.5">{title}</div>
      </div>
      {right}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, cta }) {
  return (
    <div className="card-surface p-10 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1e5dff]/10 border border-[#1e5dff]/30 mx-auto">
        <Icon className="w-5 h-5 text-[#1e5dff]" />
      </div>
      <div className="font-headline text-white text-lg mt-4">{title}</div>
      <div className="text-white/50 text-sm mt-2 max-w-md mx-auto">{body}</div>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

/* -------- Tab: Your Picks -------- */

function PicksTab() {
  const stats = [
    { label: "Win Rate",       value: "—",    sub: "No picks yet" },
    { label: "Current Streak", value: "0",    sub: "Play tonight" },
    { label: "Longest Streak", value: "0",    sub: "Coming" },
    { label: "vs Reggie",      value: "—",    sub: "0-0" },
  ];
  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Track Record"
        title="Your Picks"
        right={
          <Link
            to="/soon/game-picks"
            className="font-accent text-[10px] uppercase tracking-widest text-[#1e5dff] hover:text-white transition-colors flex items-center gap-1"
          >
            Make tonight's picks <ArrowUpRight className="w-3 h-3" />
          </Link>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card-surface p-4">
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
              {s.label}
            </div>
            <div className="font-headline text-3xl text-white mt-1">{s.value}</div>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-1">
              {s.sub}
            </div>
          </div>
        ))}
      </div>
      <div className="card-surface p-0 overflow-hidden" data-testid={TEST_IDS.backOffice.picksTable}>
        <div className="px-4 py-3 border-b border-[#2d2d35] flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#ff8f3b]" />
          <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
            Pick History
          </div>
        </div>
        <EmptyState
          icon={Target}
          title="Your first pick lands here"
          body="After Reggie makes his on-air call for tonight's slate, your pick — and his — will show up here with a running win-rate."
        />
      </div>
    </div>
  );
}

/* -------- Tab: Edge Score -------- */

function EdgeScoreTab() {
  const score = 1200; // starting Elo
  const nextTier = 1400;
  const pct = Math.min(100, Math.round(((score - 1000) / (nextTier - 1000)) * 100));
  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Reggie's Rating"
        title="Edge Score"
        right={
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">
            Elo-style · updates after every pick
          </div>
        }
      />

      {/* Big score */}
      <div className="card-surface p-6 sm:p-8">
        <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/45">
              Your rating
            </div>
            <div
              className="font-headline text-6xl sm:text-7xl text-white mt-1 leading-none"
              data-testid={TEST_IDS.backOffice.edgeScoreValue}
            >
              {score}
            </div>
            <div className="text-white/60 text-sm mt-2">
              You start here. Beat Reggie's pick — you climb. Miss where he
              hits — you drop. Big underdog calls that hit? Bigger jumps.
            </div>
          </div>

          <div className="flex-shrink-0 w-40">
            <div className="font-accent text-[9px] uppercase tracking-widest text-white/40">
              Next tier
            </div>
            <div className="font-headline text-white text-2xl mt-0.5">{nextTier}</div>
            <div className="mt-2 h-2 rounded-full bg-[#1a1a22] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1e5dff] to-[#00e5ff]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-2">
              {pct}% to Analyst
            </div>
          </div>
        </div>
      </div>

      {/* Comparison bars */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ComparisonBar label="vs Reggie" you={score} them={1450} accent="#1e5dff" />
        <ComparisonBar label="vs The Crowd" you={score} them={1275} accent="#00e5ff" />
      </div>

      {/* Tier ladder */}
      <div className="card-surface p-5">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/45 mb-3">
          Tier Ladder
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {[
            { name: "Rookie",  min: 1000, on: score >= 1000 },
            { name: "Analyst", min: 1400, on: score >= 1400 },
            { name: "Scout",   min: 1600, on: score >= 1600 },
            { name: "GM",      min: 1800, on: score >= 1800 },
            { name: "Legend",  min: 2000, on: score >= 2000 },
          ].map((t) => (
            <div
              key={t.name}
              className={`rounded-md border p-2 ${
                t.on
                  ? "border-[#1e5dff]/60 bg-[#1e5dff]/10"
                  : "border-[#2d2d35] bg-[#0b0b10]"
              }`}
            >
              <div className={`font-headline text-sm ${t.on ? "text-white" : "text-white/40"}`}>
                {t.name}
              </div>
              <div className="font-accent text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                {t.min}+
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonBar({ label, you, them, accent }) {
  const total = you + them;
  const youPct = Math.round((you / total) * 100);
  return (
    <div className="card-surface p-4">
      <div className="flex justify-between items-baseline mb-2">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
          {label}
        </div>
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/60">
          {you} · {them}
        </div>
      </div>
      <div className="h-2 rounded-full bg-[#1a1a22] overflow-hidden flex">
        <div className="h-full" style={{ width: `${youPct}%`, background: accent }} />
        <div className="h-full flex-1 bg-white/10" />
      </div>
      <div className="flex justify-between mt-1.5">
        <div className="text-[10px] text-white/50">You</div>
        <div className="text-[10px] text-white/50">{label.replace("vs ", "")}</div>
      </div>
    </div>
  );
}

/* -------- Tab: Fantasy -------- */

function FantasyTab() {
  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Your Team"
        title="Fantasy"
        right={
          <Link
            to="/fantasy"
            data-testid={TEST_IDS.backOffice.fantasyDeepLink}
            className="font-accent text-[10px] uppercase tracking-widest text-[#1e5dff] hover:text-white transition-colors flex items-center gap-1"
          >
            Open full roster <ArrowUpRight className="w-3 h-3" />
          </Link>
        }
      />

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Roster snapshot */}
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-[#f5c542]" />
            <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
              Roster Snapshot
            </div>
          </div>
          <div className="text-white/60 text-sm">
            Your saved league, scoring, and top 6 skaters — one glance.
          </div>
          <div className="mt-4 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2"
              >
                <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
                  Slot {i}
                </div>
                <div className="text-white/40 text-xs">Empty</div>
              </div>
            ))}
          </div>
          <Link
            to="/fantasy"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
          >
            Manage roster <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* AI insights preview */}
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#00e5ff]" />
            <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
              This Week from the Desk
            </div>
          </div>
          <div className="text-white/60 text-sm">
            Reggie &amp; Marc's start/sit calls, waiver-wire fits, and
            anomaly flags — read from your saved roster the moment the
            numbers move.
          </div>
          <EmptyState
            icon={TrendingUp}
            title="Save a roster to unlock"
            body="Insights are personalized to the players you actually own. Add players from the full Fantasy page to start seeing calls here."
          />
        </div>
      </div>
    </div>
  );
}

/* -------- Tab: Social -------- */

function SocialTab() {
  const unlocks = [
    { level: 1, name: "Rookie",   at: 0,   done: true },
    { level: 2, name: "Regular",  at: 10,  done: false },
    { level: 3, name: "Analyst",  at: 50,  done: false },
    { level: 4, name: "Insider",  at: 250, done: false },
    { level: 5, name: "Icon",     at: 1000, done: false },
  ];
  return (
    <div className="space-y-5">
      <SectionHeader kicker="Community" title="Social" />

      {/* Public profile card */}
      <div
        className="card-surface p-5 sm:p-6"
        data-testid={TEST_IDS.backOffice.socialProfile}
      >
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#1e5dff] to-[#00e5ff] flex items-center justify-center font-headline text-2xl text-white">
            ?
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headline text-white text-xl">Set your handle</div>
            <div className="text-white/50 text-sm mt-0.5">
              Your public profile — this is what other fans see when you climb
              the leaderboard.
            </div>
          </div>
          <button className="px-4 py-2 rounded-md border border-[#2d2d35] bg-[#0b0b10] hover:bg-[#151520] text-white font-accent text-[11px] uppercase tracking-widest transition-colors">
            Set up
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <ProfileStat label="Followers" value="0" />
          <ProfileStat label="Following" value="0" />
          <ProfileStat label="Public Rank" value="—" />
        </div>
      </div>

      {/* Avatar unlock ladder */}
      <div className="card-surface p-5" data-testid={TEST_IDS.backOffice.avatarUnlockBar}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#f5c542]" />
            <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
              Avatar Unlocks
            </div>
          </div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
            0 / 1000 followers
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {unlocks.map((u) => (
            <div
              key={u.level}
              className={`rounded-md border p-3 text-center ${
                u.done
                  ? "border-[#f5c542]/60 bg-[#f5c542]/10"
                  : "border-[#2d2d35] bg-[#0b0b10]"
              }`}
            >
              <div className="flex items-center justify-center h-8">
                {u.done ? (
                  <Star className="w-5 h-5 text-[#f5c542] fill-[#f5c542]" />
                ) : (
                  <Lock className="w-4 h-4 text-white/30" />
                )}
              </div>
              <div className={`font-headline text-sm mt-2 ${u.done ? "text-white" : "text-white/40"}`}>
                {u.name}
              </div>
              <div className="font-accent text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                {u.at}+ followers
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Follow suggestions placeholder */}
      <EmptyState
        icon={Users}
        title="Follow suggestions land here"
        body="Once you make a few picks, we'll surface fans with a similar edge — plus the top Ticker analysts to learn from."
      />
    </div>
  );
}

function ProfileStat({ label, value }) {
  return (
    <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] p-3 text-center">
      <div className="font-headline text-white text-xl">{value}</div>
      <div className="font-accent text-[9px] uppercase tracking-widest text-white/45 mt-0.5">
        {label}
      </div>
    </div>
  );
}

/* -------- Tab: Preferences -------- */

function PreferencesTab() {
  const teams = ["EDM", "COL", "TOR", "TBL", "MIN", "NJD", "WPG", "NYR"];
  const [favTeams, setFavTeams] = useState([]);
  const [pace, setPace] = useState(50);
  const [notifs, setNotifs] = useState({
    daily: true,
    lineChanges: true,
    trades: false,
    picks: true,
  });

  const toggleTeam = (t) =>
    setFavTeams((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  return (
    <div className="space-y-5">
      <SectionHeader kicker="Personalization" title="Preferences" />

      {/* Favorite teams */}
      <div className="card-surface p-5" data-testid={TEST_IDS.backOffice.prefsFavTeams}>
        <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
          Favorite Teams
        </div>
        <div className="text-white/50 text-xs mt-1">
          The desk prioritizes your teams during Home broadcast + Presser.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {teams.map((t) => {
            const on = favTeams.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTeam(t)}
                className={`rounded-md border px-3 py-1.5 font-accent text-[11px] uppercase tracking-widest transition-colors ${
                  on
                    ? "border-[#1e5dff] bg-[#1e5dff]/20 text-white"
                    : "border-[#2d2d35] bg-[#0b0b10] text-white/60 hover:text-white"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Favorite players */}
      <div className="card-surface p-5">
        <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
          Favorite Players
        </div>
        <div className="text-white/50 text-xs mt-1">
          Get flagged the moment their line, deployment, or health changes.
        </div>
        <input
          type="text"
          placeholder="Add a player (e.g. McDavid)"
          className="mt-3 w-full rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1e5dff]"
        />
        <div className="text-white/40 text-xs mt-3">No players added yet.</div>
      </div>

      {/* Pace of speech slider */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
              Pace of Speech
            </div>
            <div className="text-white/50 text-xs mt-1">
              How fast Reggie &amp; Marc talk during Home broadcast.
            </div>
          </div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/60">
            {pace < 33 ? "Relaxed" : pace < 66 ? "Broadcast" : "Rapid"}
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={pace}
          onChange={(e) => setPace(Number(e.target.value))}
          data-testid={TEST_IDS.backOffice.prefsPaceSlider}
          className="mt-3 w-full accent-[#1e5dff]"
        />
        <div className="flex justify-between mt-1 font-accent text-[9px] uppercase tracking-widest text-white/40">
          <span>Slow</span>
          <span>Normal</span>
          <span>Fast</span>
        </div>
      </div>

      {/* Notifications */}
      <div className="card-surface p-5">
        <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
          Notifications
        </div>
        <div className="mt-3 space-y-2">
          {[
            { id: "daily", label: "Daily show ready (5pm ET)" },
            { id: "lineChanges", label: "Line changes for my players" },
            { id: "trades", label: "Trade & injury news for my teams" },
            { id: "picks", label: "Reggie's picks are live" },
          ].map((n) => (
            <label
              key={n.id}
              className="flex items-center gap-3 py-1 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={notifs[n.id]}
                onChange={(e) =>
                  setNotifs((p) => ({ ...p, [n.id]: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[#2d2d35] bg-[#0b0b10] accent-[#1e5dff]"
              />
              <span className="text-white/70 text-sm group-hover:text-white">
                {n.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------- Tab: Membership -------- */

function MembershipTab() {
  return (
    <div className="space-y-5">
      <SectionHeader kicker="Account" title="Membership" />

      {/* Plan card */}
      <div
        className="card-surface p-6 sm:p-8"
        data-testid={TEST_IDS.backOffice.membershipPlan}
      >
        <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/45">
              Current Plan
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="font-headline text-3xl text-white">Free Tier</div>
              <div className="rounded-full border border-white/20 px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest text-white/60">
                3 free Presser questions / day
              </div>
            </div>
            <div className="text-white/60 text-sm mt-3 max-w-lg">
              Founding Members unlock unlimited Presser questions, Pick 10,
              Analytics deep dives, Fantasy AI, and your Back Office track
              record. Locked in at $3.99/month — for life.
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-gradient-to-r from-[#f5c542] to-[#f4a622] text-black font-accent text-[11px] uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Crown className="w-4 h-4" />
            Upgrade — $3.99/mo
          </Link>
        </div>
      </div>

      {/* Billing / account rows */}
      <div className="card-surface p-0 overflow-hidden">
        {[
          { label: "Email",          value: "Not signed in",   action: "Sign in" },
          { label: "Payment method", value: "None",            action: "Add" },
          { label: "Billing history", value: "No invoices",    action: "View" },
          { label: "Notifications",  value: "Manage in Preferences", action: null },
        ].map((r, i, arr) => (
          <div
            key={r.label}
            className={`flex items-center justify-between px-5 py-4 ${
              i < arr.length - 1 ? "border-b border-[#2d2d35]" : ""
            }`}
          >
            <div>
              <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
                {r.label}
              </div>
              <div className="text-white/80 text-sm mt-0.5">{r.value}</div>
            </div>
            {r.action && (
              <button className="font-accent text-[10px] uppercase tracking-widest text-[#1e5dff] hover:text-white transition-colors">
                {r.action}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div className="card-surface p-5">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
          Danger Zone
        </div>
        <div className="text-white/70 text-sm mt-2">
          Delete account — permanently removes your picks, roster, and profile.
        </div>
        <button className="mt-3 font-accent text-[10px] uppercase tracking-widest text-white/50 hover:text-red-400 transition-colors">
          Delete account
        </button>
      </div>
    </div>
  );
}
