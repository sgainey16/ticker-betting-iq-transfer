// My IQ command-center — Phase 0 phone-first slice.
//
// Governing UX principle: activity leads, analytics follow.
// Layout order (per phone-review corrections):
//   1) TONIGHT'S 10 hero tile (0/N → PLAY)
//   2) LAST NIGHT / MY RESULTS grading strip
//   3) "YOUR IQ IS BUILDING" warm empty state (until sample-size gates open)
//   4) MY BETS — low-emphasis link tile only
//   5) "GO DEEPER WITH MY IQ" concept card (not functional yet — just a
//      concept placeholder so we can judge visual placement)
//   6) Dev grade button (only when IQ_DEV_MODE=1)
//
// Explicitly NOT here:
//   - The old 4-empty-card analytics grid (Hockey IQ / Accuracy / Community
//     / Fantasy showing "—  0 graded · 10 to unlock"). Replaced by one
//     honest empty state.
//   - The blanket 18+ BETTING · LOCKED unlock panel. Removed from the
//     general Hockey IQ / My IQ experience. Age/jurisdiction gating stays
//     modular for regulated features later, but the general prediction
//     experience is not gated.
//   - Fantasy as a My IQ performance metric.

import { useEffect, useState } from "react";
import { ArrowRight, Brain, ListChecks, Sparkles, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import TonightsTenLoop from "./TonightsTenLoop";
import LastNight from "./LastNight";

export default function MyIQCommandCenter({ deviceId }) {
  const [board, setBoard] = useState(null);
  const [brief, setBrief] = useState(null);
  const [devMode, setDevMode] = useState(false);
  const [inLoop, setInLoop] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const [devMsg, setDevMsg] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    api.get(`/iq/board?device_id=${encodeURIComponent(deviceId)}`)
       .then((r) => setBoard(r.data))
       .catch(() => setBoard(null));
    api.get(`/iq/user/brief?device_id=${encodeURIComponent(deviceId)}`)
       .then((r) => setBrief(r.data))
       .catch(() => {});
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    refresh();
    api.get("/iq/dev/mode").then((r) => setDevMode(!!r.data?.enabled)).catch(() => {});
  }, [deviceId]);  // eslint-disable-line

  if (inLoop) {
    return (
      <TonightsTenLoop
        deviceId={deviceId}
        onExit={() => { setInLoop(false); refresh(); }}
        onComplete={() => { setInLoop(false); refresh(); }}
      />
    );
  }

  const total = board?.questions?.length || 0;
  const locked = board?.progress?.locked || 0;
  const graded = board?.progress?.graded || 0;
  const totalResolved = brief?.accuracy_summary?.total_resolved || 0;
  const openCalls = brief?.open_calls?.length || 0;

  const runDevResolve = async () => {
    if (!board?.id) return;
    setDevBusy(true); setDevMsg("");
    try {
      const r = await api.post(`/iq/board/${board.id}/resolve?device_id=${encodeURIComponent(deviceId)}`);
      setDevMsg(`Graded ${r.data.resolved} call(s).`);
      refresh();
    } catch (e) {
      setDevMsg(e?.response?.data?.detail || "Couldn't run dev grade.");
    } finally {
      setDevBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="iq-my-iq">
      {/* 1) TONIGHT'S 10 — the primary activity */}
      <TonightsTenTile
        total={total}
        locked={locked}
        onPlay={() => setInLoop(true)}
      />

      {/* 2) LAST NIGHT — grading surface */}
      <LastNight key={refreshKey} deviceId={deviceId} />

      {/* 3) YOUR IQ IS BUILDING — one warm state, not a wall of empties */}
      <YourIQBuilding totalResolved={totalResolved} openCalls={openCalls} />

      {/* 4) MY BETS — low-emphasis */}
      <MyBetsTile />

      {/* 5) GO DEEPER — concept placeholder */}
      <GoDeeperCard />

      {/* 6) DEV — only in dev mode */}
      {devMode && (
        <div className="rounded-xl bg-black/40 border border-dashed border-white/15 p-3 text-white/60 text-xs"
             data-testid="iq-dev-resolve">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="font-accent text-[9px] uppercase tracking-widest text-white/40">Dev · demo</div>
              <div className="text-white/70">Grade tonight's locked picks to preview the return loop.</div>
            </div>
            <button onClick={runDevResolve} disabled={devBusy || !board?.id}
              data-testid="iq-dev-resolve-run"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-accent text-[10px] uppercase tracking-widest transition-colors">
              <Sparkles className="w-3 h-3" /> {devBusy ? "Grading…" : "Grade"}
            </button>
          </div>
          {devMsg && <div className="mt-1.5 text-emerald-300">{devMsg}</div>}
        </div>
      )}
    </div>
  );
}

function TonightsTenTile({ total, locked, onPlay }) {
  const complete = total > 0 && locked >= total;
  const empty = total === 0;
  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={empty}
      data-testid="iq-tonights10-tile"
      className={`w-full text-left rounded-2xl border p-4 transition-colors ${
        empty
          ? "bg-black/25 border-white/10 cursor-default"
          : complete
            ? "bg-[#0a1a3d]/50 border-[#1e5dff]/40 hover:border-[#1e5dff]/70"
            : "bg-gradient-to-br from-[#0e1a3f] via-[#0a1230] to-[#050510] border-[#1e5dff]/50 hover:border-[#1e5dff] shadow-[0_18px_50px_-24px_rgba(30,93,255,0.9)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
          empty ? "bg-white/8" : "bg-[#1e5dff]"
        }`}>
          <Play className={`w-5 h-5 ${empty ? "text-white/30" : "text-white"}`} fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#7fb0ff]">
            Tonight's 10
          </div>
          <div className="font-headline text-white text-[19px] leading-tight mt-0.5">
            {empty
              ? "No card tonight"
              : complete
                ? `${locked} / ${total} locked — see you tomorrow`
                : `${locked} / ${total} locked · Play`}
          </div>
          <div className="text-white/55 text-[12px] mt-0.5">
            {empty
              ? "Puck drop is quiet. Come back when the slate loads."
              : complete
                ? "Ticker will grade each call as its game finishes."
                : "Tap through tonight's calls. Answer, lock, next."}
          </div>
        </div>
        {!empty && !complete && (
          <ArrowRight className="w-4 h-4 text-white/60 shrink-0" />
        )}
      </div>
    </button>
  );
}

function YourIQBuilding({ totalResolved, openCalls }) {
  if (totalResolved >= 10) {
    // Sample size gate opens — a future slice populates real personal analytics
    // here. Until then, a light acknowledgment instead of an empty grid.
    return (
      <div className="rounded-xl bg-black/25 border border-white/10 p-4" data-testid="iq-your-iq-building-ready">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-3.5 h-3.5 text-[#7fb0ff]" />
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/60">
            Your IQ
          </div>
        </div>
        <div className="font-headline text-white text-[16px] leading-tight">
          {totalResolved} graded calls in the book.
        </div>
        <div className="text-white/55 text-[12px] mt-1">
          Personal reads unlock as Ticker learns your patterns. Deeper analytics land in the next slice.
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-xl bg-gradient-to-br from-[#0e1533]/50 to-[#050510]/60 border border-white/12 p-4"
      data-testid="iq-your-iq-building"
    >
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-3.5 h-3.5 text-[#7fb0ff]" />
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#7fb0ff]">
          Your IQ is building
        </div>
      </div>
      <div className="font-headline text-white text-[17px] leading-tight">
        {totalResolved === 0
          ? `${openCalls > 0 ? `${openCalls} call${openCalls === 1 ? "" : "s"} locked. ` : ""}0 graded so far.`
          : `${totalResolved} graded so far.`}
      </div>
      <div className="text-white/60 text-[12px] mt-1">
        Make tonight's calls. Your first personal insights appear as they resolve.
      </div>
    </div>
  );
}

function MyBetsTile() {
  return (
    <Link
      to="/back-office"
      data-testid="iq-my-bets-tile"
      className="block rounded-xl bg-black/25 border border-white/10 hover:border-white/25 hover:bg-white/[0.03] p-3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <ListChecks className="w-3.5 h-3.5 text-white/50" />
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/60 flex-1">
          My bets · optional
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-white/40" />
      </div>
      <div className="text-white/55 text-[12px] mt-1 leading-snug">
        Record what you actually wagered — separate from your predictions. Ticker never places bets.
      </div>
    </Link>
  );
}

function GoDeeperCard() {
  return (
    <div
      className="rounded-xl bg-black/20 border border-dashed border-white/12 p-4"
      data-testid="iq-go-deeper-card"
    >
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-3.5 h-3.5 text-white/45" />
        <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/55">
          Go deeper with My IQ · soon
        </div>
      </div>
      <div className="text-white/70 text-[13px] leading-relaxed">
        Want Ticker to learn <span className="text-white">how</span> you make hockey decisions — not just whether you're right?
      </div>
      <div className="text-white/45 text-[11px] mt-1.5">
        Confidence, first instinct vs revision, category strengths. Optional. Coming after the first loop lands.
      </div>
    </div>
  );
}
