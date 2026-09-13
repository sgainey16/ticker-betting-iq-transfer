// Tonight V3 selected-matchup intelligence.
//
// Design intent (from Step 3 correction):
//   - Fewer boxes. One canvas, hierarchy from typography + spacing + team color.
//   - DESK / ROOM are stated separately with sample size, NOT as a green +N pts edge.
//   - The word "SIGNAL" is reserved for future F1C tactical intel. Present pass
//     uses the label "READS" for editorial + community reads.
//   - Reggie + Marc take strip carries an explicit EDITORIAL provenance chip
//     because reggie_take / marc_take are hand-authored broadcast copy, not
//     stat-derived reads.
//   - Comparative hockey stats sit prominently — populated by real live
//     SportsData.io standings via MatchupStats.
//   - A "What's Watching" grammar strip is architected but shows an honest
//     empty state until real events (line moves, lineup news, market moves)
//     become available. No fabrication today.
//   - Primary CTA becomes a slim sticky-feel bar, not a giant blue rectangle.
//
// Preserved unchanged: MakeCallPanel event pipeline, IQCoachChat, HostPortrait.

import { useState } from "react";
import { ArrowRight, Eye, MessageSquare, Volume2 } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import HostPortrait from "@/components/HostPortrait";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MakeCallPanel from "@/components/iq/MakeCallPanel";
import IQCoachChat from "@/components/iq/IQCoachChat";
import WhyChip from "./WhyChip";
import MatchupStats from "./MatchupStats";

// ---- helpers ----
const teamName = (teams, code) => teams.find((t) => t.code === code)?.name || code;
const teamAccent = (teams, code) => teams.find((t) => t.code === code)?.accent || "#1e5dff";

export default function MatchupIntel({ game, teams, deviceId, onCallLocked }) {
  const [callOpen, setCallOpen] = useState(false);
  const [talkTo, setTalkTo] = useState(null);

  const awayName = teamName(teams, game.away);
  const homeName = teamName(teams, game.home);
  const awayAccent = teamAccent(teams, game.away);
  const homeAccent = teamAccent(teams, game.home);

  const deskPct = game.ai_consensus;
  const deskSide = game.ai_consensus_side; // "home" | "away"
  const deskSideName = deskSide === "home" ? homeName : awayName;
  const deskCode = deskSide === "home" ? game.home : game.away;
  const deskAccent = deskSide === "home" ? homeAccent : awayAccent;

  const roomTotal = game.community?.total || 0;
  // Community lean = the side users are on (may be a different side than Ticker IQ).
  const roomHomePct = game.community?.home_pct;
  const roomAwayPct = game.community?.away_pct;
  const roomLeaningHome =
    roomHomePct != null && roomAwayPct != null && roomHomePct >= roomAwayPct;
  const roomSideName = roomLeaningHome ? homeName : awayName;
  const roomCode = roomLeaningHome ? game.home : game.away;
  const roomPct = roomLeaningHome ? roomHomePct : roomAwayPct;
  const roomAccent = roomLeaningHome ? homeAccent : awayAccent;

  return (
    <div
      className="relative pb-24"
      data-testid={`iq-matchup-${game.id}`}
    >
      {/* ---------- Matchup header (single accent stripe, no card) ---------- */}
      <div className="relative overflow-hidden">
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, ${awayAccent}, transparent 40%, transparent 60%, ${homeAccent})`,
          }}
        />
        <div className="pt-4 pb-3 flex items-center gap-2.5">
          <div className="flex-1 min-w-0 flex items-center gap-2.5">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${awayAccent}22`, boxShadow: `inset 0 0 0 1px ${awayAccent}44` }}
            >
              <TeamLogo code={game.away} size={40} />
            </div>
            <div className="min-w-0">
              <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/40 leading-none">
                Away
              </div>
              <div className="font-headline text-white text-[18px] leading-tight truncate mt-0.5">
                {awayName}
              </div>
            </div>
          </div>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/30">
            @
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2.5 justify-end text-right">
            <div className="min-w-0">
              <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/40 leading-none">
                Home
              </div>
              <div className="font-headline text-white text-[18px] leading-tight truncate mt-0.5">
                {homeName}
              </div>
            </div>
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${homeAccent}22`, boxShadow: `inset 0 0 0 1px ${homeAccent}44` }}
            >
              <TeamLogo code={game.home} size={40} />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- The read (Ticker IQ vs Community) ---------- */}
      <SectionLabel>The read</SectionLabel>
      <div className="space-y-3 pb-4">
        {/* TICKER IQ — Ticker's single official position on the matchup.
            Provenance stays visible but demoted from the main language. */}
        <ReadRow
          leftKicker="Ticker IQ"
          kickerColor="#7fb0ff"
          leftProvenance={{ label: "Editorial · pre-model", tone: "warn" }}
          leftHelp={{
            label: "Ticker IQ",
            title: "Ticker's official read on tonight's matchup.",
            body:
              "One position, not several. Until a validated Ticker prediction model comes online with Foundation 1C, this is an editorial call from the intelligence desk — informed, but not math. Reggie and Marc explain it in the WHY? and IQ Desk sections; they don't file competing predictions.",
          }}
          side={deskPct != null ? deskSideName : null}
          value={deskPct != null ? `${deskPct}%` : null}
          code={deskCode}
          accent={deskAccent}
        />
        {/* COMMUNITY — real user predictions from db.predictions. */}
        <ReadRow
          leftKicker="Community"
          kickerColor="#c4b5fd"
          leftProvenance={{
            label: roomTotal
              ? `${roomTotal} prediction${roomTotal === 1 ? "" : "s"}`
              : "No predictions yet",
            tone: "neutral",
          }}
          leftHelp={{
            label: "Community",
            title: "How Ticker's community is predicting this game.",
            body:
              "The live share of predictions filed by other Ticker users. A distinct source of intelligence from Ticker IQ. When real sportsbook market data is wired later, MARKET becomes a third column alongside these two.",
          }}
          side={roomPct != null ? roomSideName : null}
          value={roomPct != null ? `${roomPct}%` : null}
          code={roomCode}
          accent={roomAccent}
        />
      </div>

      <Divider />

      {/* ---------- Comparative hockey stats (real live) ---------- */}
      <SectionLabel>Head to head</SectionLabel>
      <MatchupStats
        awayCode={game.away}
        homeCode={game.home}
        awayAccent={awayAccent}
        homeAccent={homeAccent}
      />

      <Divider />

      {/* ---------- What's Watching (empty until F1C) ---------- */}
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

      <Divider />

      {/* ---------- Reggie + Marc IQ Desk (larger portraits, editorial) ---------- */}
      <IQDeskPanel
        game={game}
        teams={teams}
        onTalk={(who) => setTalkTo(who)}
      />

      {/* ---------- Sticky Make Your Call bar ---------- */}
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

      {/* ---------- Sheets ---------- */}
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

function ReadRow({
  leftKicker,
  kickerColor,
  leftProvenance,
  leftHelp,
  side,
  value,
  code,
  accent,
}) {
  const empty = value == null;
  return (
    <div
      className="flex items-center gap-3"
      data-testid={`iq-read-${leftKicker.split(" ")[0].toLowerCase()}`}
    >
      {/* Left: kicker + provenance */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="font-accent text-[10px] uppercase tracking-[0.32em]"
            style={{ color: kickerColor }}
          >
            {leftKicker}
          </span>
          <WhyChip label={leftHelp.label} title={leftHelp.title} body={leftHelp.body} />
        </div>
        <div
          className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-accent text-[8px] uppercase tracking-[0.24em] border ${
            leftProvenance.tone === "warn"
              ? "bg-amber-400/10 border-amber-400/35 text-amber-200"
              : "bg-white/[0.03] border-white/12 text-white/50"
          }`}
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          {leftProvenance.label}
        </div>
      </div>

      {/* Right: side + value (typography, no box) */}
      <div className="flex items-center gap-2 shrink-0 text-right">
        {empty ? (
          <div className="font-headline text-white/30 text-[24px] tabular-nums leading-none">
            —
          </div>
        ) : (
          <>
            <div className="flex flex-col items-end">
              <span className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/50 leading-none">
                on
              </span>
              <span className="font-headline text-white text-[13px] leading-tight mt-0.5 truncate max-w-[130px]">
                {side}
              </span>
            </div>
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${accent}20` }}
            >
              <TeamLogo code={code} size={26} />
            </div>
            <span
              className="font-headline text-white text-[26px] tabular-nums leading-none min-w-[62px] text-right"
              style={{ textShadow: `0 0 14px ${accent}55` }}
            >
              {value}
            </span>
          </>
        )}
      </div>
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
    <div className="pt-3 pb-2" data-testid="iq-desk-panel">
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

      <div className="grid grid-cols-[110px_1fr_110px] items-start gap-3">
        {/* Reggie portrait */}
        <HostPortrait
          persona="reggie"
          size={110}
          showName={false}
          className="rounded-xl"
        />

        {/* Center takes */}
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
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onTalk("reggie")}
              data-testid="iq-desk-talk-reggie"
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] hover:bg-[#1e5dff]/25 border border-white/15 hover:border-[#1e5dff]/60 px-2 py-1 font-accent text-[9px] uppercase tracking-[0.24em] text-white/85 transition-colors"
            >
              <MessageSquare className="w-3 h-3" /> Talk
            </button>
            <button
              type="button"
              onClick={() => onTalk("reggie")}
              data-testid="iq-desk-hear-read"
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] hover:bg-[#1e5dff]/25 border border-white/15 hover:border-[#1e5dff]/60 px-2 py-1 font-accent text-[9px] uppercase tracking-[0.24em] text-white/85 transition-colors"
            >
              <Volume2 className="w-3 h-3" /> Hear the read
            </button>
          </div>
        </div>

        {/* Marc portrait mirrored inward */}
        <HostPortrait
          persona="marc"
          size={110}
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
