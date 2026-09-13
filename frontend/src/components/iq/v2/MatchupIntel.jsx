// Tonight V3.1 selected-matchup intelligence.
//
// Design intent (from the Tonight V3.1 correction):
//   1. Reggie + Marc panel restored near the top — personality immediately.
//      Compact desk, Talk buttons visible.
//   2. Selected matchup uses HUGE team crests as the primary identity.
//      No container tiles, no "AWAY / HOME" kickers, no full team names —
//      logos carry the meaning.
//   3. THE READ collapses to two voices — TICKER IQ + COMMUNITY. Each row
//      is a big logo + big percentage. Provenance stays visible but is
//      demoted to a tiny secondary label. No redundant disagreement badges.
//   4. Renamed "Head to Head" → "TEAM SNAPSHOT" and folded into a horizontal
//      Intelligence-lens rail. OVERVIEW is the only active lens today; the
//      future lenses (SPECIAL TEAMS IQ, TRANSITION IQ, 5v5 IQ, NET FRONT,
//      GOALTENDING, DISCIPLINE) render as dimmed navigation tabs so the
//      architecture is visible without pretending they carry live data.
//   5. Sticky "Make Your Call" bar preserved unchanged.
//
// Preserved unchanged: MakeCallPanel event pipeline, IQCoachChat, HostPortrait.

import { useState } from "react";
import { ArrowRight, MessageSquare, Volume2, Lock } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import HostPortrait from "@/components/HostPortrait";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MakeCallPanel from "@/components/iq/MakeCallPanel";
import IQCoachChat from "@/components/iq/IQCoachChat";
import WhyChip from "./WhyChip";
import MatchupStats from "./MatchupStats";

const teamName = (teams, code) => teams.find((t) => t.code === code)?.name || code;
const teamAccent = (teams, code) => teams.find((t) => t.code === code)?.accent || "#1e5dff";

// Intelligence-lens tabs. OVERVIEW is the only lens with live content today.
// Future lenses render as disabled navigation tabs so the architecture is
// visible without misleading the user about present data availability.
const LENSES = [
  { key: "overview",       label: "Overview",       active: true  },
  { key: "special-teams",  label: "Special Teams",  active: false },
  { key: "transition",     label: "Transition",     active: false },
  { key: "five-on-five",   label: "5v5",            active: false },
  { key: "net-front",      label: "Net Front",      active: false },
  { key: "goaltending",    label: "Goaltending",    active: false },
  { key: "discipline",     label: "Discipline",     active: false },
];

export default function MatchupIntel({ game, teams, deviceId, onCallLocked }) {
  const [callOpen, setCallOpen] = useState(false);
  const [talkTo, setTalkTo] = useState(null);
  const [lens, setLens] = useState("overview");

  const awayName = teamName(teams, game.away);
  const homeName = teamName(teams, game.home);
  const awayAccent = teamAccent(teams, game.away);
  const homeAccent = teamAccent(teams, game.home);

  // Ticker IQ read — one official Ticker position on the matchup.
  const deskPct = game.ai_consensus;
  const deskSide = game.ai_consensus_side; // "home" | "away"
  const deskCode = deskSide === "home" ? game.home : game.away;
  const deskAccent = deskSide === "home" ? homeAccent : awayAccent;

  // Community read — real user predictions from db.predictions.
  const roomTotal = game.community?.total || 0;
  const roomHomePct = game.community?.home_pct;
  const roomAwayPct = game.community?.away_pct;
  const roomLeaningHome =
    roomHomePct != null && roomAwayPct != null && roomHomePct >= roomAwayPct;
  const roomCode = roomLeaningHome ? game.home : game.away;
  const roomPct = roomLeaningHome ? roomHomePct : roomAwayPct;
  const roomAccent = roomLeaningHome ? homeAccent : awayAccent;

  return (
    <div className="relative pb-24" data-testid={`iq-matchup-${game.id}`}>
      {/* 1) Reggie + Marc — personality immediately */}
      <IQDeskPanel
        game={game}
        teams={teams}
        onTalk={(who) => setTalkTo(who)}
      />

      {/* 2) Selected matchup — huge crests, no containers, no full names */}
      <MatchupHeader
        awayCode={game.away}
        homeCode={game.home}
        awayAccent={awayAccent}
        homeAccent={homeAccent}
      />

      {/* 3) THE READ — Ticker IQ vs Community. Big logos + big percentages. */}
      <SectionLabel>The read</SectionLabel>
      <div className="space-y-4 pb-4">
        <ReadRow
          kicker="Ticker IQ"
          kickerColor="#7fb0ff"
          provenance="Editorial · pre-model"
          provenanceTone="warn"
          help={{
            title: "Ticker's official read on tonight's matchup.",
            body:
              "One position, not several. Until a validated Ticker prediction model comes online with Foundation 1C, this is an editorial call from the intelligence desk — informed, but not math. Reggie and Marc explain it in the IQ Desk; they don't file competing predictions.",
          }}
          value={deskPct != null ? `${deskPct}%` : null}
          code={deskCode}
          accent={deskAccent}
          testid="iq-read-ticker"
        />
        <ReadRow
          kicker="Community"
          kickerColor="#c4b5fd"
          provenance={
            roomTotal
              ? `${roomTotal} prediction${roomTotal === 1 ? "" : "s"}`
              : "No predictions yet"
          }
          provenanceTone="neutral"
          help={{
            title: "How Ticker's community is predicting this game.",
            body:
              "The live share of predictions filed by other Ticker users. A distinct source of intelligence from Ticker IQ. When real sportsbook market data is wired later, MARKET becomes a third column alongside these two.",
          }}
          value={roomPct != null ? `${roomPct}%` : null}
          code={roomCode}
          accent={roomAccent}
          testid="iq-read-community"
        />
      </div>

      <Divider />

      {/* 4) Intelligence lens rail — swipe sideways to change lens. Only
             OVERVIEW is live today; future lenses render as dimmed nav
             tabs so the architecture is visible without pretending. */}
      <SectionLabel>Matchup intelligence</SectionLabel>
      <LensTabStrip lenses={LENSES} active={lens} onSelect={setLens} />
      <div className="pt-2 pb-1" data-testid={`iq-lens-body-${lens}`}>
        {lens === "overview" && (
          <>
            <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/50 mb-1.5">
              Team snapshot
            </div>
            <MatchupStats
              awayCode={game.away}
              homeCode={game.home}
              awayAccent={awayAccent}
              homeAccent={homeAccent}
            />
          </>
        )}
      </div>

      <Divider />

      {/* 5) What's Watching — honest empty state, ready for real events */}
      <SectionLabel>
        What's watching
        <span className="text-white/25 ml-1.5">·</span>
        <span className="text-white/40 normal-case tracking-normal text-[10px] ml-1.5">
          Ticker's eyes on tonight
        </span>
      </SectionLabel>
      <div
        className="pt-1 pb-4 text-[13px] text-white/50 leading-relaxed"
        data-testid="iq-watching-empty"
      >
        No lineup changes, no line moves, no goalie news yet.
        <span className="text-white/35"> Ticker will surface events here as they happen.</span>
      </div>

      {/* Sticky Make Your Call bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-6xl mx-auto px-3 pb-3">
          <button
            onClick={() => setCallOpen(true)}
            data-testid="iq-primary-cta"
            className="pointer-events-auto group w-full flex items-center justify-between rounded-full pl-5 pr-2 py-2 bg-[#1e5dff] hover:bg-[#3574ff] text-white shadow-[0_16px_48px_-12px_rgba(30,93,255,0.9)] transition-colors backdrop-blur"
          >
            <span className="font-accent text-[11px] uppercase tracking-[0.32em]">
              Make your call
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-accent text-[10px] uppercase tracking-[0.28em]">
              {game.away} @ {game.home}
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      </div>

      {/* Sheets */}
      <Sheet open={callOpen} onOpenChange={setCallOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#050510] border-t border-white/15 text-white p-0 max-h-[92dvh] overflow-y-auto"
          data-testid="iq-call-sheet"
        >
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#7fb0ff]">
              On the record
            </SheetTitle>
          </SheetHeader>
          <div className="px-3 pb-6">
            <MakeCallPanel
              deviceId={deviceId}
              game={game}
              teams={teams}
              onDone={(payload) => {
                setCallOpen(false);
                onCallLocked?.(payload);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!talkTo} onOpenChange={(o) => !o && setTalkTo(null)}>
        <SheetContent
          side="bottom"
          className="bg-[#050510] border-t border-white/15 text-white p-0 h-[86dvh] flex flex-col"
          data-testid="iq-talk-sheet"
        >
          <SheetHeader className="px-5 pt-5 pb-2 shrink-0">
            <SheetTitle className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#7fb0ff]">
              Talk to {talkTo === "marc" ? "Marc" : "Reggie"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {talkTo && (
              <IQCoachChat
                deviceId={deviceId}
                mode="tonight"
                seedMessage={`About ${awayName} at ${homeName}.`}
                onClose={() => setTalkTo(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------- sub-components ----------

function SectionLabel({ children }) {
  return (
    <div className="pt-4 pb-2 font-accent text-[10px] uppercase tracking-[0.34em] text-white/45 flex items-center flex-wrap">
      {children}
    </div>
  );
}

function Divider() {
  return <div aria-hidden className="h-px w-full bg-white/8" />;
}

function MatchupHeader({ awayCode, homeCode, awayAccent, homeAccent }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${awayAccent}, transparent 40%, transparent 60%, ${homeAccent})`,
        }}
      />
      {/* Radial glows behind each crest carry team color without needing a container */}
      <div className="relative pt-6 pb-5 flex items-center justify-center gap-2">
        <CrestSlot code={awayCode} accent={awayAccent} align="left" />
        <div className="font-accent text-[13px] uppercase tracking-[0.4em] text-white/35 pb-2">
          @
        </div>
        <CrestSlot code={homeCode} accent={homeAccent} align="right" />
      </div>
    </div>
  );
}

function CrestSlot({ code, accent, align }) {
  return (
    <div
      className={`relative flex flex-col items-center gap-1.5 flex-1 ${
        align === "left" ? "items-end pr-1" : "items-start pl-1"
      }`}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-0 opacity-40 blur-2xl"
        style={{
          background: `radial-gradient(60% 60% at 50% 50%, ${accent}, transparent 70%)`,
        }}
      />
      <TeamLogo code={code} size={88} className="relative z-10 drop-shadow-[0_6px_24px_rgba(0,0,0,0.9)]" />
      <div className="relative z-10 font-headline text-white text-[13px] tracking-[0.14em]">
        {code}
      </div>
    </div>
  );
}

function ReadRow({
  kicker,
  kickerColor,
  provenance,
  provenanceTone,
  help,
  value,
  code,
  accent,
  testid,
}) {
  const empty = value == null;
  return (
    <div className="flex items-center gap-3" data-testid={testid}>
      {/* Left: kicker + tiny provenance */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="font-accent text-[11px] uppercase tracking-[0.32em]"
            style={{ color: kickerColor }}
          >
            {kicker}
          </span>
          <WhyChip label={kicker} title={help.title} body={help.body} />
        </div>
        <div
          className={`mt-1 text-[9px] uppercase tracking-[0.22em] ${
            provenanceTone === "warn" ? "text-amber-200/85" : "text-white/45"
          }`}
        >
          {provenance}
        </div>
      </div>
      {/* Right: big crest + big percentage. Logo is the team identity. */}
      <div className="flex items-center gap-3 shrink-0">
        {empty ? (
          <div className="font-headline text-white/30 text-[32px] tabular-nums leading-none">
            —
          </div>
        ) : (
          <>
            <div className="relative flex items-center justify-center">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-lg opacity-40"
                style={{ background: accent }}
              />
              <TeamLogo code={code} size={40} className="relative z-10" />
            </div>
            <span
              className="font-headline text-white text-[38px] tabular-nums leading-none min-w-[72px] text-right"
              style={{ textShadow: `0 0 18px ${accent}66` }}
            >
              {value}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LensTabStrip({ lenses, active, onSelect }) {
  return (
    <div
      className="-mx-3 sm:mx-0 relative"
      data-testid="iq-lens-tabstrip"
    >
      <div className="flex gap-1 overflow-x-auto no-scrollbar px-3 sm:px-0 pb-1.5 snap-x">
        {lenses.map((lens) => {
          const isActive = lens.key === active;
          const isDisabled = !lens.active;
          return (
            <button
              key={lens.key}
              type="button"
              onClick={() => !isDisabled && onSelect(lens.key)}
              disabled={isDisabled}
              data-testid={`iq-lens-tab-${lens.key}`}
              aria-selected={isActive}
              className={`snap-start relative flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 font-accent text-[10px] uppercase tracking-[0.28em] transition-colors ${
                isActive
                  ? "text-white"
                  : isDisabled
                    ? "text-white/25 cursor-not-allowed"
                    : "text-white/60 hover:text-white/90"
              }`}
            >
              {isDisabled && <Lock className="w-2.5 h-2.5" strokeWidth={2.4} />}
              {lens.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-2 right-2 -bottom-px h-[2px] bg-[#1e5dff] rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
      <div aria-hidden className="h-px w-full bg-white/8" />
    </div>
  );
}

function IQDeskPanel({ game, teams, onTalk }) {
  const homeName = teamName(teams, game.home);
  const awayName = teamName(teams, game.away);
  const reggieSideName =
    game.reggie_pick === "home" ? homeName : awayName;
  const marcSideName = game.marc_pick === "home" ? homeName : awayName;

  return (
    <div className="pt-1 pb-3" data-testid="iq-desk-panel">
      <div className="flex items-center justify-between mb-2">
        <div className="font-accent text-[10px] uppercase tracking-[0.34em] text-[#7fb0ff]">
          Reggie + Marc · IQ Desk
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-accent text-[8px] uppercase tracking-[0.24em] bg-amber-400/10 border border-amber-400/35 text-amber-200"
          title="Editorial takes — hand-authored broadcast copy, not stat-derived"
        >
          <span className="h-1 w-1 rounded-full bg-amber-300" />
          Editorial
        </span>
      </div>

      <div className="grid grid-cols-[100px_1fr_100px] items-start gap-3">
        <HostPortrait
          persona="reggie"
          size={100}
          showName={false}
          className="rounded-xl"
        />

        <div className="min-w-0 space-y-2.5">
          <TakeLine
            who="Reggie"
            side={reggieSideName}
            take={game.reggie_take}
            testid="iq-desk-reggie-take"
          />
          <TakeLine
            who="Marc"
            side={marcSideName}
            take={game.marc_take}
            testid="iq-desk-marc-take"
          />
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <button
              type="button"
              onClick={() => onTalk("reggie")}
              data-testid="iq-desk-talk-reggie"
              className="inline-flex items-center gap-1 rounded-full bg-[#1e5dff]/15 hover:bg-[#1e5dff]/35 border border-[#1e5dff]/45 hover:border-[#1e5dff] px-2 py-1 font-accent text-[9px] uppercase tracking-[0.24em] text-white transition-colors"
            >
              <MessageSquare className="w-3 h-3" /> Talk
            </button>
            <button
              type="button"
              onClick={() => onTalk("reggie")}
              data-testid="iq-desk-hear-read"
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/15 hover:border-white/30 px-2 py-1 font-accent text-[9px] uppercase tracking-[0.24em] text-white/85 transition-colors"
            >
              <Volume2 className="w-3 h-3" /> Hear the read
            </button>
          </div>
        </div>

        <HostPortrait
          persona="marc"
          size={100}
          showName={false}
          mirror
          className="rounded-xl"
        />
      </div>
    </div>
  );
}

function TakeLine({ who, side, take, testid }) {
  return (
    <div data-testid={testid}>
      <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/45 mb-0.5">
        {who} · {side}
      </div>
      <div className="text-white/85 text-[13px] leading-snug">
        {take || <span className="text-white/40">No take yet.</span>}
      </div>
    </div>
  );
}
