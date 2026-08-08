import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { TEST_IDS } from "@/lib/config";
import { getDeviceId } from "@/lib/device";
import ReggieAssistant from "@/components/ReggieAssistant";
import { TeamLogo } from "@/lib/teamLogos";
import { useVoiceSettings } from "@/lib/voiceSettings";
import { isWakeWordSupported } from "@/lib/useWakeWord";
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
  Brain,
  Plus,
  Trash2,
} from "lucide-react";

const TABS = [
  { id: "picks",      label: "Your Picks",  icon: Target,   kicker: "Track record" },
  { id: "edge",       label: "Edge Score",  icon: Zap,      kicker: "Reggie's rating of you" },
  // Betting IQ + Fantasy Tracker hidden for Phase 1 (entertainment-first focus).
  // Code preserved — flip these back on for Phase 2.
  // { id: "betting-iq", label: "Betting IQ",  icon: Brain,    kicker: "Your personal AI betting coach" },
  // { id: "fantasy",    label: "Fantasy Tracker",     icon: Trophy,   kicker: "Studies your roster · you" },
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
          {active === "betting-iq" && <BettingIQTab />}
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
        title="Fantasy Tracker"
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


// Voice Settings card — sits inside Preferences. Wake word is opt-in.
// Fans in public/quiet spaces can leave everything off and use text.
function VoiceSettingsCard() {
  const { settings, update } = useVoiceSettings();
  const supported = isWakeWordSupported();

  return (
    <div className="card-surface p-5" data-testid="prefs-voice-settings">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
            Reggie · Voice
          </div>
          <div className="text-white/50 text-xs mt-1">
            Turn on any of these to talk to Reggie hands-free. Leave off if you'd rather text — that's a first-class experience too.
          </div>
        </div>
      </div>

      {/* Wake word */}
      <div className="mt-4 flex items-start justify-between gap-3 py-3 border-t border-white/8">
        <div className="min-w-0">
          <div className="text-white font-headline text-sm" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
            "Hey Reggie" wake word
          </div>
          <div className="text-white/50 text-[12px] mt-0.5 leading-snug">
            {supported
              ? "Reggie listens for the phrase while the app is open. Uses your microphone. Sleeps after 15 seconds of quiet."
              : "Your browser doesn't support voice recognition. Try Chrome, Edge, or Safari to enable this."}
          </div>
        </div>
        <Toggle
          disabled={!supported}
          on={!!settings.wake_word_enabled}
          onChange={(v) => update({ wake_word_enabled: v })}
          testid="voice-wake-toggle"
        />
      </div>

      {/* Show visible FAB */}
      <div className="flex items-start justify-between gap-3 py-3 border-t border-white/8">
        <div className="min-w-0">
          <div className="text-white font-headline text-sm" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
            Show the visible mic button
          </div>
          <div className="text-white/50 text-[12px] mt-0.5 leading-snug">
            The floating Reggie avatar in the bottom-right. Auto-hides after you use "Hey Reggie" three times, unless you pin it here.
          </div>
        </div>
        <Toggle
          on={settings.mic_button_override !== false}
          onChange={(v) => update({ mic_button_override: v ? true : false })}
          testid="voice-fab-toggle"
        />
      </div>

      {/* Mute voice replies */}
      <div className="flex items-start justify-between gap-3 py-3 border-t border-white/8">
        <div className="min-w-0">
          <div className="text-white font-headline text-sm" style={{ fontFamily: "Rajdhani", fontWeight: 700 }}>
            Silent mode
          </div>
          <div className="text-white/50 text-[12px] mt-0.5 leading-snug">
            Reggie replies in text only — no voice playback. Perfect for quiet rooms or public places.
          </div>
        </div>
        <Toggle
          on={!!settings.voice_replies_muted}
          onChange={(v) => update({ voice_replies_muted: v })}
          testid="voice-mute-toggle"
        />
      </div>
    </div>
  );
}

// Small reusable toggle switch matching the rest of the Back Office style.
function Toggle({ on, onChange, disabled, testid }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      data-testid={testid}
      className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors ${
        disabled
          ? "bg-white/5 cursor-not-allowed"
          : on
            ? "bg-[#1e5dff]"
            : "bg-white/15 hover:bg-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          on ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

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

      {/* Voice settings — every voice feature is opt-in. Fans in public
       * or quiet spaces (or who just don't like voice UIs) can leave
       * everything off and use text. This is a first-class choice. */}
      <VoiceSettingsCard />

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
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-accent text-[11px] uppercase tracking-widest transition-colors ${
                  on
                    ? "border-[#1e5dff] bg-[#1e5dff]/20 text-white"
                    : "border-[#2d2d35] bg-[#0b0b10] text-white/60 hover:text-white"
                }`}
              >
                <TeamLogo code={t} size={16} monogramClass="!bg-white/10" />
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
              Analytics deep dives, Fantasy Tracker, and your Back Office track
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


/* -------- Tab: Betting IQ (Phase 1 — Bet Log) --------
   Follows /app/memory/BETTING_IQ_SPEC.md. All stats surfaced here respect
   the Section 7 confidence bands and Section 8 skill-vs-profitability
   separation. This is the foundation the Betting Coach layer sits on. */

const BET_TYPES = [
  "moneyline", "spread", "puck-line", "total (over/under)",
  "player-prop", "first-goal", "shots", "saves", "other",
];

function BettingIQTab() {
  const deviceId = useMemo(() => getDeviceId(), []);
  const [bets, setBets] = useState([]);
  const [stats, setStats] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        api.get(`/betting/bets?device_id=${deviceId}`),
        api.get(`/betting/stats?device_id=${deviceId}`),
      ]);
      setBets(b.data?.bets || []);
      setStats(s.data || null);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteBet = async (id) => {
    if (!confirm("Delete this bet? This can't be undone.")) return;
    await api.delete(`/betting/bet/${id}?device_id=${deviceId}`);
    refresh();
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        kicker="Your personal AI betting coach"
        title="Betting IQ"
        right={
          <button
            onClick={() => setFormOpen((v) => !v)}
            data-testid="betting-iq-log-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Log a bet
          </button>
        }
      />

      {/* Log-a-bet form */}
      {formOpen && (
        <BetForm
          deviceId={deviceId}
          onSaved={() => {
            setFormOpen(false);
            refresh();
          }}
        />
      )}

      {/* Stat headline cards — prediction skill vs. betting profitability separated per spec §8 */}
      <div className="grid sm:grid-cols-2 gap-3">
        <StatCard
          title="Prediction Accuracy"
          subtitle="Did you pick the right outcome?"
          n={stats?.prediction_accuracy?.n || 0}
          confidence={stats?.prediction_accuracy?.confidence}
          value={
            stats?.prediction_accuracy?.win_rate_pct != null
              ? `${stats.prediction_accuracy.win_rate_pct}%`
              : "—"
          }
          note={
            stats?.prediction_accuracy?.n
              ? `${stats.prediction_accuracy.wins}-${stats.prediction_accuracy.losses} record`
              : "Log resolved bets to unlock"
          }
        />
        <StatCard
          title="Betting Profitability"
          subtitle="Did the wagers make money after odds?"
          n={stats?.betting_profitability?.n || 0}
          confidence={stats?.betting_profitability?.confidence}
          value={
            stats?.betting_profitability?.roi_pct != null
              ? `${stats.betting_profitability.roi_pct > 0 ? "+" : ""}${stats.betting_profitability.roi_pct}%`
              : "—"
          }
          note={
            stats?.betting_profitability?.profit_loss != null
              ? `${stats.betting_profitability.profit_loss >= 0 ? "+" : ""}$${stats.betting_profitability.profit_loss.toFixed(2)} P/L`
              : "Log money bets to unlock"
          }
          accent="#f5c542"
        />
      </div>

      {/* Callout: coach behavior explanation */}
      <div className="card-surface p-4 border-l-4 border-l-[#1e5dff]">
        <div className="font-accent text-[10px] uppercase tracking-widest text-[#1e5dff]">
          How Betting IQ works
        </div>
        <div className="text-white/70 text-sm mt-1 leading-relaxed">
          Log every bet — even prediction-only picks with no money. Once you cross{" "}
          <span className="text-white">10 comparable bets</span>, patterns start unlocking.
          At <span className="text-white">25</span> we call it moderate confidence; at{" "}
          <span className="text-white">50+</span>, higher. We never claim insight from a small sample.
        </div>
      </div>

      {/* Bet history */}
      <div className="card-surface p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2d2d35] flex items-center justify-between">
          <div className="font-accent text-[11px] uppercase tracking-widest text-white/70">
            Bet History
          </div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
            {stats?.total || 0} logged · {stats?.pending || 0} pending
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading…</div>
        ) : bets.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No bets logged yet"
            body="Every bet — win or lose, money or prediction-only — teaches the coach how you play. Log your first one to start the coaching relationship."
            cta={
              <button
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Log your first bet
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-[#2d2d35]">
            {bets.map((b) => (
              <BetRow key={b.id} bet={b} onDelete={() => deleteBet(b.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Splits by bet type — only surface if we have enough samples */}
      {stats?.by_bet_type?.some((r) => r.n >= 10) && (
        <div className="card-surface p-5">
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/45 mb-3">
            By Bet Type
          </div>
          <div className="space-y-2">
            {stats.by_bet_type.filter((r) => r.n >= 10).map((row) => (
              <SplitRow key={row.key} row={row} />
            ))}
          </div>
          <div className="text-[10px] font-accent uppercase tracking-widest text-white/35 mt-3">
            Rows with fewer than 10 bets are hidden until enough data exists.
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, subtitle, n, confidence, value, note, accent = "#1e5dff" }) {
  const bandLabel = {
    insufficient: "Insufficient history",
    low: "Low confidence",
    moderate: "Moderate confidence",
    higher: "Higher confidence",
  };
  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            {title}
          </div>
          <div className="text-white/50 text-xs mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="font-headline text-white text-4xl mt-3">{value}</div>
      <div className="text-white/50 text-xs mt-1">{note}</div>
      <div className="mt-3 flex items-center gap-2">
        <div
          className={`rounded-full px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest ${
            confidence === "higher"
              ? "bg-emerald-500/15 text-emerald-300"
              : confidence === "moderate"
              ? "bg-yellow-500/15 text-yellow-300"
              : confidence === "low"
              ? "bg-orange-500/15 text-orange-300"
              : "bg-white/10 text-white/50"
          }`}
        >
          {bandLabel[confidence] || bandLabel.insufficient}
        </div>
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
          n = {n}
        </div>
      </div>
    </div>
  );
}

function SplitRow({ row }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center py-1">
      <div>
        <div className="text-white text-sm">{row.label}</div>
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-0.5">
          n {row.n} · {row.confidence}
        </div>
      </div>
      <div className="text-right">
        <div className="font-headline text-white text-lg">{row.win_rate_pct}%</div>
        {row.roi_pct != null && (
          <div className={`text-[10px] font-accent uppercase tracking-widest ${row.roi_pct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {row.roi_pct >= 0 ? "+" : ""}{row.roi_pct}% ROI
          </div>
        )}
      </div>
    </div>
  );
}

function BetRow({ bet, onDelete }) {
  const chip = {
    win: "bg-emerald-500/20 text-emerald-300",
    loss: "bg-rose-500/20 text-rose-300",
    push: "bg-white/10 text-white/50",
    pending: "bg-yellow-500/15 text-yellow-300",
  }[bet.result] || "bg-white/10 text-white/50";
  // Parse "BOS @ NJD" / "BOS vs NJD" / "BOS - NJD" into two 2–3 letter codes
  const codes = (bet.matchup || "").match(/\b[A-Z]{2,3}\b/g) || [];
  const [awayCode, homeCode] = codes;
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-headline text-white text-sm truncate inline-flex items-center gap-1.5">
            {awayCode && <TeamLogo code={awayCode} size={18} />}
            <span>{bet.matchup}</span>
            {homeCode && <TeamLogo code={homeCode} size={18} />}
          </div>
          <div className={`rounded-full px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest ${chip}`}>
            {bet.result}
          </div>
          {bet.prediction_only && (
            <div className="rounded-full px-2 py-0.5 font-accent text-[9px] uppercase tracking-widest bg-[#1e5dff]/20 text-[#1e5dff]">
              Prediction only
            </div>
          )}
        </div>
        <div className="text-white/50 text-xs mt-0.5">
          {bet.bet_date} · {bet.bet_type} · {bet.selection} · odds {bet.odds}
          {!bet.prediction_only && ` · $${bet.stake.toFixed(2)}`}
        </div>
      </div>
      {!bet.prediction_only && (
        <div className={`font-headline text-sm ${bet.profit_loss >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
          {bet.profit_loss >= 0 ? "+" : ""}${bet.profit_loss.toFixed(2)}
        </div>
      )}
      <button
        onClick={onDelete}
        aria-label="Delete bet"
        className="p-1.5 rounded-md text-white/40 hover:text-rose-400 hover:bg-white/5 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BetForm({ deviceId, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    bet_date: today,
    matchup: "",
    bet_type: "moneyline",
    selection: "",
    odds: "",
    stake: "",
    prediction_only: false,
    result: "pending",
    profit_loss: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.matchup || !form.selection || !form.odds) return;
    setSaving(true);
    try {
      await api.post("/betting/bet", {
        device_id: deviceId,
        bet_date: form.bet_date,
        matchup: form.matchup,
        bet_type: form.bet_type,
        selection: form.selection,
        odds: form.odds,
        stake: form.prediction_only ? 0 : parseFloat(form.stake || "0"),
        prediction_only: form.prediction_only,
        result: form.result,
        profit_loss: form.prediction_only ? 0 : parseFloat(form.profit_loss || "0"),
        notes: form.notes,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="card-surface p-5 space-y-3"
      data-testid="betting-iq-form"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" value={form.bet_date} onChange={(e) => set("bet_date", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Matchup">
          <input placeholder="e.g. BOS @ NJD" value={form.matchup} onChange={(e) => set("matchup", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Bet Type">
          <select value={form.bet_type} onChange={(e) => set("bet_type", e.target.value)} className={inputCls}>
            {BET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Your Selection">
          <input placeholder="e.g. Devils ML" value={form.selection} onChange={(e) => set("selection", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Odds">
          <input placeholder="-135 or +180" value={form.odds} onChange={(e) => set("odds", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Result">
          <select value={form.result} onChange={(e) => set("result", e.target.value)} className={inputCls}>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="push">Push</option>
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 pt-1 cursor-pointer">
        <input
          type="checkbox"
          checked={form.prediction_only}
          onChange={(e) => set("prediction_only", e.target.checked)}
          className="h-4 w-4 accent-[#1e5dff]"
        />
        <span className="text-white/70 text-sm">
          Prediction only (no money wagered)
        </span>
      </label>

      {!form.prediction_only && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Stake ($)">
            <input type="number" step="0.01" value={form.stake} onChange={(e) => set("stake", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Profit / Loss ($) — negative for losses">
            <input type="number" step="0.01" value={form.profit_loss} onChange={(e) => set("profit_loss", e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      <Field label="Notes (optional)">
        <input placeholder="Anything the coach should remember" value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] disabled:opacity-40 text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
        >
          {saving ? "Saving…" : "Save bet"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="font-accent text-[10px] uppercase tracking-widest text-white/45 mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-[#2d2d35] bg-[#0b0b10] px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1e5dff]";

