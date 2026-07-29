import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Flame,
  Zap,
  Send,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Radio,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { MATCHUPS, DEFAULT_MATCHUP } from "@/data/matchups";
import { TeamLogo } from "@/lib/teamLogos";
import { askAnalystStream, BACKEND_URL } from "@/lib/api";

export default function MatchupDeepDive() {
  const { matchupId } = useParams();
  const navigate = useNavigate();
  const m = MATCHUPS[matchupId] || MATCHUPS[DEFAULT_MATCHUP];

  // AI Game Story — LLM-streamed narrative on mount
  const [story, setStory] = useState("");
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyAudioUrl, setStoryAudioUrl] = useState(null);
  const storyAudioRef = useRef(null);

  useEffect(() => {
    if (!m) return;
    setStory("");
    setStoryLoading(true);
    setStoryAudioUrl(null);
    askAnalystStream(
      { analyst_id: "reggie", question: m.ai_game_story_prompt },
      ({ event, data }) => {
        if (event === "token") setStory((prev) => prev + (data.t || ""));
        else if (event === "audio" && data?.audio_url) setStoryAudioUrl(data.audio_url);
        else if (event === "done") setStoryLoading(false);
      },
      () => setStoryLoading(false),
    );
  }, [matchupId, m]);

  if (!m) return <div className="text-white/70">Matchup not found.</div>;

  const winner = m.away.score > m.home.score ? "away" : m.home.score > m.away.score ? "home" : null;

  return (
    <div className="space-y-6" data-testid="matchup-deep-dive">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-white/50 hover:text-white transition-colors font-accent text-[10px] uppercase tracking-widest"
      >
        <ArrowLeft className="w-3 h-3" /> Back to broadcast
      </Link>

      {/* Hero */}
      <section className="card-surface p-6 sm:p-8" data-testid="matchup-hero">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#f5c542]" />
            <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/60">
              Matchup Deep Dive · {m.date}
            </div>
          </div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
            {m.puck_drop} · {m.venue}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <TeamBlock team={m.away} side="away" won={winner === "away"} />
          <div className="text-center">
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">Final</div>
            <div className="font-headline text-3xl sm:text-4xl text-white mt-1">
              {m.away.score}<span className="text-white/40 mx-1.5">·</span>{m.home.score}
            </div>
          </div>
          <TeamBlock team={m.home} side="home" won={winner === "home"} />
        </div>

        {/* Storylines */}
        <div className="mt-5 grid sm:grid-cols-2 gap-2">
          <StorylineChip team={m.away} />
          <StorylineChip team={m.home} />
        </div>
      </section>

      {/* AI Game Story */}
      <section className="card-surface p-5 sm:p-6" data-testid="ai-game-story">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1e5dff]" />
            <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/60">
              AI Game Story · Reggie's take
            </div>
          </div>
          {storyAudioUrl && (
            <button
              onClick={() => {
                const el = storyAudioRef.current;
                if (!el) return;
                el.paused ? el.play().catch(() => {}) : el.pause();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#1e5dff]/60 bg-[#1e5dff]/10 px-3 py-1 font-accent text-[9px] uppercase tracking-widest text-white hover:bg-[#1e5dff]/20 transition-colors"
              data-testid="story-audio-toggle"
            >
              <Radio className="w-3 h-3" /> Hear it
            </button>
          )}
        </div>
        <p className={`text-white/90 leading-relaxed text-base ${storyLoading ? "stream-caret" : ""}`}>
          {story || (storyLoading ? "Reggie is watching the tape…" : m.away.storyline)}
        </p>
        <audio ref={storyAudioRef} src={storyAudioUrl ? `${BACKEND_URL}${storyAudioUrl}` : undefined} preload="auto" />
      </section>

      {/* Ticker Intelligence Dashboard */}
      <section data-testid="ticker-intelligence">
        <SectionHeader
          kicker="The Differentiator"
          title="Ticker Intelligence"
          subtitle="8 composite scores blended from every data category. Higher = the edge."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {m.ticker_intelligence.map((ti) => (
            <IntelGauge key={ti.key} data={ti} away={m.away} home={m.home} />
          ))}
        </div>
      </section>

      {/* Factor Importance — the "Holy Grail" */}
      <section data-testid="factor-importance">
        <SectionHeader
          kicker="Why This Game Broke the Way It Did"
          title="Factor Importance"
          subtitle="Every factor ranked by weight — no black boxes."
        />
        <div className="card-surface p-5 space-y-2.5">
          {m.factor_importance.map((f, i) => (
            <FactorBar key={f.factor} rank={i + 1} data={f} />
          ))}
        </div>
      </section>

      {/* 20-category deep dive */}
      <section data-testid="matchup-categories">
        <SectionHeader
          kicker="Full Framework"
          title="20-Category Breakdown"
          subtitle="Every stat that matters. Expand any category for the numbers."
        />
        <div className="grid sm:grid-cols-2 gap-2">
          {m.categories.map((cat) => (
            <CategoryRow key={cat.id} cat={cat} away={m.away} home={m.home} />
          ))}
        </div>
      </section>

      {/* Ask Reggie footer */}
      <section
        className="card-surface p-5 sm:p-6"
        data-testid="matchup-ask-footer"
        style={{ background: "linear-gradient(135deg, #1e5dff11 0%, #00e5ff11 100%)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#1e5dff]" />
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/70">
            Take it to the desk
          </div>
        </div>
        <div className="font-headline text-white text-xl mb-3">
          Ask Reggie about this game
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            `Why did ${m.home.name} beat ${m.away.name} tonight?`,
            `Which factor was most important?`,
            `Was ${m.away.name}'s goaltending the story?`,
            `What does this game mean for ${m.home.name}'s playoff path?`,
          ].map((q) => (
            <button
              key={q}
              onClick={() =>
                navigate(`/press-conference?q=${encodeURIComponent(q)}`)
              }
              data-testid={`matchup-ask-chip`}
              className="rounded-full border border-[#2d2d35] bg-[#0b0b10] hover:bg-[#151520] hover:border-white/40 px-3 py-1.5 text-sm text-white/80 hover:text-white transition-colors flex items-center gap-1.5"
            >
              {q}
              <ArrowRight className="w-3 h-3" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* -------- Team block -------- */
function TeamBlock({ team, side, won }) {
  return (
    <div className={`${side === "away" ? "text-right" : "text-left"} min-w-0`}>
      <div
        className="inline-flex items-center gap-3"
        style={{ flexDirection: side === "away" ? "row-reverse" : "row" }}
      >
        <div
          className={`h-14 w-14 sm:h-16 sm:w-16 rounded-lg flex-shrink-0 flex items-center justify-center border-2 overflow-hidden ${
            won ? "shadow-[0_0_24px_rgba(255,255,255,0.15)]" : "opacity-70"
          }`}
          style={{
            background: team.accent + "22",
            borderColor: team.accent + (won ? "" : "77"),
          }}
        >
          <TeamLogo code={team.abbr} size={52} monogramClass="!bg-transparent" />
        </div>
        <div className="min-w-0">
          <div className="font-headline text-white text-2xl sm:text-3xl leading-tight truncate">
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

function StorylineChip({ team }) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ borderColor: team.accent + "55", background: team.accent + "10" }}
    >
      <div className="font-accent text-[9px] uppercase tracking-widest inline-flex items-center gap-1.5" style={{ color: team.accent }}>
        <TeamLogo code={team.abbr} size={12} monogramClass="!bg-transparent" />
        {team.abbr} · Storyline
      </div>
      <div className="text-white text-sm mt-0.5">{team.storyline}</div>
    </div>
  );
}

/* -------- Section header -------- */
function SectionHeader({ kicker, title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/45">
        {kicker}
      </div>
      <div className="font-headline text-2xl text-white mt-1">{title}</div>
      {subtitle && <div className="text-white/50 text-sm mt-1 max-w-2xl">{subtitle}</div>}
    </div>
  );
}

/* -------- Ticker Intelligence gauge (single) -------- */
function IntelGauge({ data, away, home }) {
  const total = data.away + data.home;
  const awayPct = total ? Math.round((data.away / total) * 100) : 50;
  const edge = data.home > data.away ? "home" : "away";
  const edgeTeam = edge === "home" ? home : away;
  return (
    <div className="card-surface p-3.5" data-testid={`intel-${data.key}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/70">
          {data.label}
        </div>
        <div
          className="font-accent text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ background: edgeTeam.accent + "22", color: edgeTeam.accent }}
        >
          {edgeTeam.abbr}
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-[#1a1a22] flex">
        <div className="h-full" style={{ width: `${awayPct}%`, background: away.accent }} />
        <div className="h-full flex-1" style={{ background: home.accent }} />
      </div>
      <div className="flex justify-between mt-1.5 font-accent text-[9px] uppercase tracking-widest text-white/50">
        <span>{data.away}</span>
        <span>{data.home}</span>
      </div>
      <div className="text-white/50 text-[11px] mt-2 leading-snug">{data.note}</div>
    </div>
  );
}

/* -------- Factor bar (Holy Grail) -------- */
function FactorBar({ rank, data }) {
  return (
    <div className="grid grid-cols-[24px_1fr_50px] gap-3 items-center" data-testid="factor-bar">
      <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
        #{rank}
      </div>
      <div>
        <div className="text-white text-sm">{data.factor}</div>
        <div className="mt-1 h-1.5 rounded-full bg-[#1a1a22] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1e5dff] to-[#00e5ff]"
            style={{ width: `${data.weight}%` }}
          />
        </div>
      </div>
      <div className="font-headline text-white text-lg text-right">{data.weight}%</div>
    </div>
  );
}

/* -------- Category row (accordion) -------- */
function CategoryRow({ cat, away, home }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="card-surface overflow-hidden"
      data-testid={`category-${cat.id}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors text-left"
      >
        <div className="min-w-0">
          <div className="font-headline text-white text-base truncate">{cat.name}</div>
          <div className="text-white/45 text-[11px] mt-0.5 truncate">{cat.description}</div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/50 flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 border-t border-[#2d2d35] pt-3 bg-[#0b0b10]/50">
          <StatsGrid stats={cat.stats} away={away} home={home} />
        </div>
      )}
    </div>
  );
}

/* -------- Stats grid inside a category -------- */
function StatsGrid({ stats, away, home }) {
  // stats can be:
  // - { away: <primitive>, home: <primitive>, note?: string }
  // - { away: { key: value, ... }, home: { key: value, ... }, note?: string }
  const isObject = typeof stats.away === "object" && stats.away !== null;
  if (!isObject) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <StatCell label={away.abbr} value={String(stats.away)} accent={away.accent} />
        <StatCell label={home.abbr} value={String(stats.home)} accent={home.accent} />
        {stats.note && (
          <div className="col-span-2 text-[10px] font-accent uppercase tracking-widest text-white/40 mt-1">
            {stats.note}
          </div>
        )}
      </div>
    );
  }
  const keys = Array.from(
    new Set([...Object.keys(stats.away || {}), ...Object.keys(stats.home || {})]),
  );
  return (
    <div className="space-y-1.5">
      {keys.map((k) => (
        <div
          key={k}
          className="grid grid-cols-[1fr_60px_1fr] gap-2 items-center py-0.5"
        >
          <div
            className="text-right text-white font-headline text-sm"
            style={{ color: away.accent }}
          >
            {String(stats.away?.[k] ?? "—")}
          </div>
          <div className="font-accent text-[9px] uppercase tracking-widest text-white/45 text-center">
            {k.replaceAll("_", " ")}
          </div>
          <div
            className="text-left text-white font-headline text-sm"
            style={{ color: home.accent }}
          >
            {String(stats.home?.[k] ?? "—")}
          </div>
        </div>
      ))}
      {stats.note && (
        <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 mt-2">
          {stats.note}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, accent }) {
  return (
    <div className="rounded-md border border-[#2d2d35] bg-[#0b0b10] p-2.5">
      <div
        className="font-accent text-[9px] uppercase tracking-widest"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div className="font-headline text-white text-base mt-0.5">{value}</div>
    </div>
  );
}
