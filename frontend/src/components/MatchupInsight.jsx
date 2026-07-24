import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Send, ShieldHalf, Flame } from "lucide-react";
import { TEST_IDS } from "@/lib/config";

/**
 * MatchupInsight — Team vs Team comparison card that sits above the panel
 * show on Home. Contextualizes the broadcast: user sees tonight's featured
 * matchup at a glance → dives into the show → can Deep-Dive either team
 * or ask a live analytics question, all deep-linked into the Presser page.
 *
 * All values MOCKED for MVP. Real values wire in when the SportsData.io /
 * NHL API pipeline is triggered pre-launch.
 */

// Featured matchup — swap to today's marquee game once the schedule API is live.
const MOCK_MATCHUP = {
  away: {
    abbr: "EDM",
    name: "Oilers",
    accent: "#FC4C02",     // Oilers orange
    record: "34-18-6",
    gpg: 3.62,
    gapg: 2.94,
    pp: 27.4,
    pk: 79.8,
    last10: "7-2-1",
  },
  home: {
    abbr: "COL",
    name: "Avalanche",
    accent: "#6F263D",     // Avs burgundy
    record: "36-16-4",
    gpg: 3.71,
    gapg: 2.68,
    pp: 25.1,
    pk: 82.3,
    last10: "8-1-1",
  },
  puck_drop: "10:00 PM ET",
  venue: "Ball Arena",
  headline: "West's biggest matchup of the week",
};

const STAT_ROWS = [
  { key: "record", label: "Record",       fmt: (v) => v,                         higherIsBetter: null }, // W-L, not comparable
  { key: "gpg",    label: "Goals / Gm",   fmt: (v) => v.toFixed(2),              higherIsBetter: true },
  { key: "gapg",   label: "GA / Gm",      fmt: (v) => v.toFixed(2),              higherIsBetter: false },
  { key: "pp",     label: "Power Play %", fmt: (v) => `${v.toFixed(1)}%`,        higherIsBetter: true },
  { key: "pk",     label: "Penalty Kill %", fmt: (v) => `${v.toFixed(1)}%`,      higherIsBetter: true },
  { key: "last10", label: "Last 10",      fmt: (v) => v,                         higherIsBetter: null },
];

export default function MatchupInsight() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const m = MOCK_MATCHUP;

  const goPresser = (question) => {
    navigate(`/press-conference?q=${encodeURIComponent(question)}`);
  };

  const submitQ = () => {
    if (!q.trim()) return;
    goPresser(q.trim());
  };

  const winner = (row) => {
    if (row.higherIsBetter === null) return null;
    const a = m.away[row.key];
    const h = m.home[row.key];
    if (a === h) return null;
    const awayWins = row.higherIsBetter ? a > h : a < h;
    return awayWins ? "away" : "home";
  };

  return (
    <section
      className="card-surface p-5 sm:p-6"
      data-testid={TEST_IDS.matchup?.root || "matchup-insight"}
      style={{ borderColor: "#1e5dff33" }}
    >
      {/* Kicker */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#f5c542]" />
          <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/60">
            Tonight's Featured Matchup
          </div>
        </div>
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
          {m.puck_drop} · {m.venue}
        </div>
      </div>

      {/* Team headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-6 items-center">
        <TeamHeader team={m.away} side="away" />
        <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/40">
          @
        </div>
        <TeamHeader team={m.home} side="home" />
      </div>

      {/* Comparison rows */}
      <div className="mt-5 border-t border-[#2d2d35]">
        {STAT_ROWS.map((row) => {
          const win = winner(row);
          return (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-6 items-center py-2.5 border-b border-[#2d2d35]/60"
              data-testid={`matchup-row-${row.key}`}
            >
              <div
                className={`text-right font-headline text-lg sm:text-xl ${
                  win === "away" ? "text-white" : "text-white/50"
                }`}
                style={win === "away" ? { color: m.away.accent } : undefined}
              >
                {row.fmt(m.away[row.key])}
              </div>
              <div className="font-accent text-[10px] uppercase tracking-widest text-white/40 whitespace-nowrap">
                {row.label}
              </div>
              <div
                className={`text-left font-headline text-lg sm:text-xl ${
                  win === "home" ? "text-white" : "text-white/50"
                }`}
                style={win === "home" ? { color: m.home.accent } : undefined}
              >
                {row.fmt(m.home[row.key])}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dive deeper CTAs — one per team */}
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <DeepDiveButton
          team={m.away}
          data-testid="matchup-deepdive-away"
          onClick={() =>
            goPresser(
              `Break down the ${m.away.name} tonight — what are they doing right, what's the weakness ${m.home.name} can exploit?`
            )
          }
        />
        <DeepDiveButton
          team={m.home}
          data-testid="matchup-deepdive-home"
          onClick={() =>
            goPresser(
              `Break down the ${m.home.name} tonight — what are they doing right, what's the weakness ${m.away.name} can exploit?`
            )
          }
        />
      </div>

      {/* Inline Q&A → routes to Presser with prefilled question */}
      <div className="mt-4 rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-3.5 h-3.5 text-[#1e5dff]" />
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/60">
            Ask Reggie about this matchup
          </div>
        </div>
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitQ();
              }
            }}
            placeholder={`e.g. Who has the goaltending edge tonight?`}
            className="flex-1 bg-[#05050f] text-white text-sm placeholder:text-white/30 rounded-md border border-[#2d2d35] focus:border-[#1e5dff] focus:outline-none px-3 py-2"
            data-testid="matchup-ask-input"
          />
          <button
            onClick={submitQ}
            disabled={!q.trim()}
            data-testid="matchup-ask-submit"
            className="h-[38px] px-4 rounded-md font-accent uppercase tracking-widest text-[11px] text-white bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Ask
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            `Who has the goaltending edge tonight?`,
            `What's the special-teams matchup?`,
            `Which line decides this game?`,
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => goPresser(chip)}
              className="text-[10px] font-accent uppercase tracking-widest text-white/50 hover:text-white border border-[#2d2d35] hover:border-white/40 px-2.5 py-1 rounded-full transition-colors"
              data-testid={`matchup-chip-${chip.slice(0, 15)}`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------- Team header block -------- */

function TeamHeader({ team, side }) {
  return (
    <div className={`${side === "away" ? "text-right" : "text-left"} min-w-0`}>
      <div
        className="inline-flex items-center gap-2"
        style={{ flexDirection: side === "away" ? "row-reverse" : "row" }}
      >
        <div
          className="h-10 w-10 rounded-md flex-shrink-0 flex items-center justify-center font-headline text-white text-sm border"
          style={{
            background: team.accent + "22",
            borderColor: team.accent + "88",
            color: team.accent,
          }}
        >
          {team.abbr}
        </div>
        <div className="min-w-0">
          <div className="font-headline text-white text-xl sm:text-2xl leading-tight truncate">
            {team.name}
          </div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/50">
            {team.record}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------- Deep dive CTA -------- */

function DeepDiveButton({ team, onClick, "data-testid": testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="group flex items-center justify-between rounded-md border bg-[#0b0b10] px-4 py-3 hover:bg-[#151520] transition-colors text-left"
      style={{ borderColor: team.accent + "55" }}
    >
      <div className="min-w-0">
        <div
          className="font-accent text-[9px] uppercase tracking-widest"
          style={{ color: team.accent }}
        >
          Dive deeper
        </div>
        <div className="font-headline text-white text-sm mt-0.5 truncate">
          {team.name} breakdown
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-white/50 group-hover:text-white transition-colors flex-shrink-0 ml-3">
        <ShieldHalf className="w-3.5 h-3.5" />
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}
