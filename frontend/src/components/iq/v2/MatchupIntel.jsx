// Tonight V2 selected-matchup intelligence body.
// Reads real /predictions/games fields ONLY:
//   - reggie_pick / reggie_take / marc_pick / marc_take
//   - ai_consensus (0-100) + ai_consensus_side       → DESK read (editorial)
//   - community.home_pct / away_pct / total          → ROOM read (community)
//
// No sportsbook Market until real odds are wired.
// No F1C signals until F1C ships.
// The SignalRail is architected to accept a signals[] array so future
// signal generators plug in cleanly — but ONLY chips with real data render.
//
// Provenance rule: DESK carries an "editorial · pre-model" chip because
// ai_consensus is hand-authored today. When the real Ticker model earns
// this number, the label upgrades to "TICKER" and the provenance chip
// changes accordingly. Visual authority of the number never exceeds the
// authority of the data behind it.

import { useMemo, useState } from "react";
import { ChevronRight, MessageSquare, TrendingUp, ArrowRight } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import HostPortrait from "@/components/HostPortrait";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import MakeCallPanel from "@/components/iq/MakeCallPanel";
import IQCoachChat from "@/components/iq/IQCoachChat";
import WhyChip from "./WhyChip";

// ---------- Helpers ----------

function pickTeamName(teams, code) {
  return teams.find((t) => t.code === code)?.name || code;
}
function pickTeamAccent(teams, code) {
  return teams.find((t) => t.code === code)?.accent || "#1e5dff";
}

/**
 * Build the list of REAL signals for this game. Empty array is a valid
 * state — the rail hides itself. Signals that need Foundation 1C are
 * intentionally NOT included; the shape they'll return matches this
 * contract so wiring them later is additive, not a redesign.
 *
 * Contract (future signals must match):
 *   { key, label, strength, direction, headline, body, tone }
 *     strength: "high" | "medium" | "low"
 *     direction: "up" | "down" | "flat"   (visual only)
 *     tone: "positive" | "negative" | "neutral"
 */
function buildRealSignals(game, teams) {
  const signals = [];
  const homeName = pickTeamName(teams, game.home);
  const awayName = pickTeamName(teams, game.away);

  // HOST SPLIT — only when Reggie and Marc actually disagree.
  if (game.reggie_pick && game.marc_pick && game.reggie_pick !== game.marc_pick) {
    const reggieSide = game.reggie_pick === game.home ? homeName : awayName;
    const marcSide = game.marc_pick === game.home ? homeName : awayName;
    signals.push({
      key: "host-split",
      label: "Host split",
      strength: "high",
      direction: "flat",
      tone: "neutral",
      headline: `Reggie ${reggieSide} · Marc ${marcSide}`,
      body:
        `Reggie is on ${reggieSide}. Marc is on ${marcSide}. When the desk splits, ` +
        `the game's telling us something — read both takes below before you call it.`,
    });
  }

  // DESK CONVICTION — only when the editorial read leans meaningfully.
  // Threshold of ≥7 pts off 50/50 keeps this from firing on coin flips.
  if (game.ai_consensus != null && Math.abs(game.ai_consensus - 50) >= 7) {
    const side = game.ai_consensus_side === game.home ? homeName : awayName;
    signals.push({
      key: "desk-conviction",
      label: "Desk lean",
      strength: game.ai_consensus >= 60 ? "high" : "medium",
      direction: "up",
      tone: "positive",
      headline: `Desk leans ${side} · ${game.ai_consensus}%`,
      body:
        `The intelligence desk's editorial read leans ${side} at ${game.ai_consensus}%. ` +
        `This is a curated call — not the validated Ticker model. That comes online with ` +
        `Foundation 1C. Weigh it against Room and your own read.`,
    });
  }

  // ROOM MOMENTUM — only when community has actually voted enough to matter.
  const total = game.community?.total || 0;
  if (total >= 5) {
    const homePct = game.community.home_pct;
    const awayPct = game.community.away_pct;
    const leadPct = Math.max(homePct || 0, awayPct || 0);
    if (leadPct >= 60) {
      const leadSide =
        (homePct || 0) >= (awayPct || 0) ? homeName : awayName;
      signals.push({
        key: "room-momentum",
        label: "Room lean",
        strength: leadPct >= 70 ? "high" : "medium",
        direction: "up",
        tone: "neutral",
        headline: `Room on ${leadSide} · ${leadPct}%`,
        body:
          `The community is running ${leadPct}% toward ${leadSide} across ${total} call${
            total === 1 ? "" : "s"
          }. Room is a distinct read from the desk — track when they diverge.`,
      });
    }
  }

  return signals;
}

// ---------- Component ----------

export default function MatchupIntel({ game, teams, deviceId, onCallLocked }) {
  const [callOpen, setCallOpen] = useState(false);
  const [talkTo, setTalkTo] = useState(null); // "reggie" | "marc" | null

  const homeName = pickTeamName(teams, game.home);
  const awayName = pickTeamName(teams, game.away);
  const homeAccent = pickTeamAccent(teams, game.home);
  const awayAccent = pickTeamAccent(teams, game.away);

  // DESK read — editorial pre-model number, honestly labeled.
  const deskPct = game.ai_consensus;
  const deskSide = game.ai_consensus_side;
  const deskSideName = deskSide === game.home ? homeName : awayName;
  const deskCode = deskSide === game.home ? game.home : game.away;

  // ROOM read — community %, shown for the SAME side DESK is leaning
  // so the two numbers are apples-to-apples and Δ is meaningful.
  const roomTotal = game.community?.total || 0;
  const roomPct =
    deskSide === "home" ? game.community?.home_pct : game.community?.away_pct;

  const deltaPts =
    deskPct != null && roomPct != null ? deskPct - roomPct : null;

  const signals = useMemo(() => buildRealSignals(game, teams), [game, teams]);

  return (
    <div className="space-y-4" data-testid={`iq-matchup-${game.id}`}>
      {/* ---------- Matchup header ---------- */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b0b1c] via-[#08081a] to-[#050510]"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: `linear-gradient(180deg, ${awayAccent}, ${homeAccent})` }}
        />
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${awayAccent}20` }}
            >
              <TeamLogo code={game.away} size={40} />
            </div>
            <div className="min-w-0">
              <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/40">
                Away
              </div>
              <div className="font-headline text-white text-[17px] leading-tight truncate">
                {awayName}
              </div>
            </div>
          </div>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/30 px-1">
            at
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end text-right">
            <div className="min-w-0">
              <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/40">
                Home
              </div>
              <div className="font-headline text-white text-[17px] leading-tight truncate">
                {homeName}
              </div>
            </div>
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${homeAccent}20` }}
            >
              <TeamLogo code={game.home} size={40} />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- DESK / ROOM read strip ---------- */}
      <div className="grid grid-cols-2 gap-2.5">
        <ReadCard
          label="Desk"
          provenance="Editorial · pre-model"
          provenanceTone="warn"
          testid="iq-read-desk"
          value={deskPct != null ? `${deskPct}%` : null}
          sub={deskPct != null ? `on ${deskSideName}` : "No read"}
          accent="#1e5dff"
          code={deskPct != null ? deskCode : null}
          why={{
            title: "The intelligence desk's editorial call.",
            body:
              "A curated read from the desk — Reggie, Marc, and the show team — not the validated Ticker prediction model. That comes online with Foundation 1C. Until then, treat Desk as informed opinion, not math.",
          }}
        />
        <ReadCard
          label="Room"
          provenance={roomTotal ? `${roomTotal} call${roomTotal === 1 ? "" : "s"}` : "No calls yet"}
          provenanceTone="neutral"
          testid="iq-read-room"
          value={roomPct != null ? `${roomPct}%` : null}
          sub={roomPct != null ? `on ${deskSideName}` : "Awaiting calls"}
          accent="#a78bfa"
          why={{
            title: "How Ticker's community is calling this game.",
            body:
              "The live share of community calls on the same side the desk is leaning. Room is a distinct read from Desk — track when they diverge, that's usually where the interesting games live.",
          }}
        />
      </div>

      {/* Δ line — only when both sides have real data */}
      {deltaPts != null && (
        <div
          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5"
          data-testid="iq-delta-strip"
        >
          <div className="flex items-center gap-2">
            <span className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/50">
              Desk − Room
            </span>
            <WhyChip
              label="Δ"
              title="How far the desk sits from the room."
              body="A wide gap means the editorial read and the community disagree. Not automatically an edge — but a place to look harder."
            />
          </div>
          <span
            className={`font-headline text-lg tabular-nums ${
              deltaPts > 0
                ? "text-emerald-400"
                : deltaPts < 0
                ? "text-rose-400"
                : "text-white/70"
            }`}
          >
            {deltaPts > 0 ? "+" : ""}
            {deltaPts} pts
          </span>
        </div>
      )}

      {/* ---------- Signal rail (real signals only) ---------- */}
      {signals.length > 0 && (
        <SignalRail signals={signals} />
      )}

      {/* ---------- Primary CTA ---------- */}
      <button
        onClick={() => setCallOpen(true)}
        data-testid="iq-primary-cta"
        className="group relative w-full overflow-hidden rounded-2xl border border-[#1e5dff]/50 bg-gradient-to-r from-[#1e5dff] via-[#2e6bff] to-[#1e5dff] px-5 py-4 text-left transition-all hover:shadow-[0_16px_48px_-12px_rgba(30,93,255,0.9)] active:translate-y-[1px]"
      >
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(255,255,255,0.28),transparent_55%)]"
        />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <div className="font-accent text-[10px] uppercase tracking-[0.36em] text-white/70 mb-0.5">
              Your call
            </div>
            <div className="font-headline text-white text-[17px] leading-tight">
              {awayName} at {homeName}
            </div>
          </div>
          <div className="flex items-center gap-2 font-accent text-[11px] uppercase tracking-[0.28em] text-white">
            Make the call
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </button>

      {/* ---------- Reggie + Marc — What Caught Our Eye ---------- */}
      <DeskStrip
        game={game}
        teams={teams}
        onTalk={(who) => setTalkTo(who)}
      />

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

// ---------- Sub-components ----------

function ReadCard({ label, provenance, provenanceTone, value, sub, accent, code, why, testid }) {
  const empty = value == null;
  return (
    <div
      data-testid={testid}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b0b1c] to-[#050510] px-4 py-3.5"
    >
      <span
        aria-hidden
        className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-25 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="font-accent text-[10px] uppercase tracking-[0.32em]"
              style={{ color: accent }}
            >
              {label}
            </span>
            <WhyChip label={label} title={why.title} body={why.body} />
          </div>
          {code && <TeamLogo code={code} size={16} />}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-headline leading-none tabular-nums ${
              empty ? "text-white/30 text-[26px]" : "text-white text-[36px]"
            }`}
          >
            {empty ? "—" : value}
          </span>
        </div>
        <div className="mt-1 text-white/60 text-[12px] leading-tight">{sub}</div>
        <div
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-accent text-[8px] uppercase tracking-[0.24em] border ${
            provenanceTone === "warn"
              ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-white/[0.03] text-white/50"
          }`}
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          {provenance}
        </div>
      </div>
    </div>
  );
}

function SignalRail({ signals }) {
  const [open, setOpen] = useState(null); // key
  return (
    <div data-testid="iq-signal-rail">
      <div className="flex items-center justify-between mb-2">
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/50 inline-flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" /> Signals on this game
        </div>
        <span className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/25">
          Tap to expand
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 pb-1">
        {signals.map((s) => {
          const active = open === s.key;
          const toneRing =
            s.tone === "positive"
              ? "border-emerald-400/45"
              : s.tone === "negative"
              ? "border-rose-400/45"
              : "border-[#1e5dff]/45";
          return (
            <button
              key={s.key}
              data-testid={`iq-signal-chip-${s.key}`}
              onClick={() => setOpen(active ? null : s.key)}
              className={`snap-start flex-shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-accent text-[10px] uppercase tracking-[0.22em] border transition-colors ${
                active
                  ? `bg-white/8 text-white ${toneRing}`
                  : `bg-black/40 text-white/75 border-white/15 hover:border-white/35`
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  s.strength === "high"
                    ? "bg-white"
                    : s.strength === "medium"
                    ? "bg-white/60"
                    : "bg-white/30"
                }`}
              />
              {s.label}
              <ChevronRight
                className={`w-3 h-3 transition-transform ${active ? "rotate-90" : ""}`}
              />
            </button>
          );
        })}
      </div>
      {signals.map((s) =>
        open === s.key ? (
          <div
            key={s.key}
            data-testid={`iq-signal-body-${s.key}`}
            className="mt-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3"
          >
            <div className="font-headline text-white text-[14px] mb-1 leading-snug">
              {s.headline}
            </div>
            <div className="text-white/70 text-[12.5px] leading-relaxed">
              {s.body}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function DeskStrip({ game, teams, onTalk }) {
  const homeName = teams.find((t) => t.code === game.home)?.name || game.home;
  const awayName = teams.find((t) => t.code === game.away)?.name || game.away;
  const reggieSideName =
    game.reggie_pick === game.home ? homeName : awayName;
  const marcSideName = game.marc_pick === game.home ? homeName : awayName;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1030] via-[#08081a] to-[#050510]"
      data-testid="iq-desk-strip"
    >
      <div className="px-4 pt-4 pb-2">
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#7fb0ff]">
          Reggie + Marc · what caught our eye
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 px-4 pb-4">
        {/* Reggie */}
        <HostTake
          persona="reggie"
          side={reggieSideName}
          take={game.reggie_take}
          onTalk={() => onTalk("reggie")}
        />
        {/* Marc — mirrored to look inward */}
        <HostTake
          persona="marc"
          side={marcSideName}
          take={game.marc_take}
          mirror
          onTalk={() => onTalk("marc")}
          align="right"
        />
      </div>
    </div>
  );
}

function HostTake({ persona, side, take, mirror = false, onTalk, align = "left" }) {
  const isRight = align === "right";
  return (
    <div
      className={`flex flex-col gap-2 ${
        isRight ? "items-end text-right" : "items-start text-left"
      }`}
      data-testid={`iq-desk-take-${persona}`}
    >
      <HostPortrait
        persona={persona}
        size={92}
        showName={false}
        mirror={mirror}
        className="rounded-xl"
      />
      <div className="min-w-0">
        <div className="font-accent text-[9px] uppercase tracking-[0.3em] text-white/45 mb-0.5">
          {persona === "marc" ? "Marc" : "Reggie"} · {side}
        </div>
        <div className="text-white/85 text-[13px] leading-snug">
          {take || "No take yet."}
        </div>
      </div>
      <button
        type="button"
        onClick={onTalk}
        data-testid={`iq-desk-talk-${persona}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-[#1e5dff]/30 border border-white/15 hover:border-[#1e5dff]/60 text-white/85 font-accent text-[9px] uppercase tracking-[0.28em] transition-colors"
      >
        <MessageSquare className="w-3 h-3" /> Talk to {persona === "marc" ? "Marc" : "Reggie"}
      </button>
    </div>
  );
}
