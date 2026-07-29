import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ANALYSTS, TEST_IDS } from "@/lib/config";
import TwoHostDesk from "@/components/TwoHostDesk";
import {
  Play, Pause, SkipForward, Volume2, VolumeX, Film,
  ChevronDown, ChevronUp,
} from "lucide-react";

// Recap Show — SportsCenter-style "morning line" player. Advances through:
//   1) Cold open (Reggie + Marc welcome, big graphic)
//   2) N game segments (host hook → clip → host outro → next)
//   3) Close (sign-off)
//
// State machine: current "beat" is either { kind:'host', segment_index, speaker, text }
// or { kind:'clip', segment_index, embed_url }. `beatIdx` iterates over the
// flat sequence built at load time.

const DEMO_DATE = "2025-04-12";

// Reggie & Marc pose rotation — each category picks a fitting expression so
// the same face doesn't hold across every game. resolveShot() in TwoHostDesk
// converts these into the actual portrait PNG.
const REGGIE_EXP_BY_CAT = {
  goals: ["pointing", "hot_take", "celebrating"],
  "match-highlights": ["explaining", "leaning", "hands_open"],
  "hits-fights": ["chirping", "smirking", "yelling"],
  saves: ["hot_take", "pointing"],
  default: ["explaining", "leaning", "hands_open"],
};
const MARC_EXP_BY_CAT = {
  goals: ["explaining", "analyzing_stats", "serious"],
  "match-highlights": ["explaining", "analyzing_stats", "counting"],
  "hits-fights": ["serious", "skeptical"],
  saves: ["analyzing_stats", "explaining"],
  default: ["explaining", "analyzing_stats", "counting"],
};

function shotForBeat(beat, seedNum) {
  if (!beat || beat.kind !== "host") return "side_two_shot";
  const cat = beat.segment?.clip?.category || "";
  const bucket = cat.includes("hit") || cat.includes("fight") ? "hits-fights"
    : cat.includes("goal") ? "goals"
    : cat === "save" ? "saves"
    : cat === "match-highlights" ? "match-highlights"
    : "default";
  const bank = beat.speaker === "reggie" ? REGGIE_EXP_BY_CAT : MARC_EXP_BY_CAT;
  const options = bank[bucket] || bank.default;
  return `${beat.speaker}_${options[seedNum % options.length]}`;
}

function buildBeatSequence(episode) {
  const beats = [];
  if (!episode || !episode.ready) return beats;
  // Cold open — Reggie then Marc.
  beats.push({ kind: "host", speaker: "reggie", text: episode.cold_open.reggie, label: "Cold Open" });
  beats.push({ kind: "host", speaker: "marc",   text: episode.cold_open.marc,   label: "Cold Open" });
  // Per-game segments.
  episode.segments.forEach((seg, i) => {
    beats.push({ kind: "host", speaker: "reggie", text: seg.reggie_hook, segment: seg, label: `Game ${i + 1}` });
    beats.push({ kind: "clip", segment: seg,                                             label: `Game ${i + 1}` });
    beats.push({ kind: "host", speaker: "marc",   text: seg.marc_outro, segment: seg,   label: `Game ${i + 1}` });
  });
  // Close — Marc then Reggie.
  beats.push({ kind: "host", speaker: "marc",   text: episode.close.marc,   label: "Sign-off" });
  beats.push({ kind: "host", speaker: "reggie", text: episode.close.reggie, label: "Sign-off" });
  return beats;
}

export default function RecapShow() {
  const [episode, setEpisode] = useState(null);
  const [beatIdx, setBeatIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const audioRef = useRef(null);

  const beats = useMemo(() => buildBeatSequence(episode), [episode]);
  const currentBeat = beats[beatIdx];

  // Fetch episode
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/recap-show/episode", { params: { date: DEMO_DATE } });
        setEpisode(r.data);
      } catch (e) { console.error("recap-show load", e); }
    })();
  }, []);

  // When on a host beat: fetch the audio URL on demand, then play it. When
  // it ends → advance to next beat. On clip beats, playback advances when
  // the iframe reports 'ended' (we can't detect YouTube ended reliably from
  // outside, so we use a max-duration timer instead).
  useEffect(() => {
    if (!playing || !currentBeat) return;
    if (currentBeat.kind === "host") {
      let cancelled = false;
      (async () => {
        try {
          const r = await api.get("/recap-show/line-audio", {
            params: { speaker: currentBeat.speaker, text: currentBeat.text },
          });
          if (cancelled) return;
          const url = r.data?.audio_url;
          if (!url) {
            // No audio → hold caption for read-time then advance. Longer
            // lines get more time (roughly 60ms per char, min 4s).
            const ms = Math.max(4000, currentBeat.text.length * 60);
            const t = setTimeout(() => setBeatIdx((i) => i + 1), ms);
            return () => clearTimeout(t);
          }
          const el = audioRef.current;
          if (!el) return;
          el.src = url;
          el.muted = muted;
          el.onended = () => setBeatIdx((i) => i + 1);
          el.onerror = () => setBeatIdx((i) => i + 1);
          try { await el.play(); } catch { /* autoplay blocked */ }
        } catch (e) {
          const ms = Math.max(4000, (currentBeat.text || "").length * 60);
          const t = setTimeout(() => setBeatIdx((i) => i + 1), ms);
          return () => clearTimeout(t);
        }
      })();
      return () => { cancelled = true; if (audioRef.current) { audioRef.current.onended = null; audioRef.current.onerror = null; } };
    }
    if (currentBeat.kind === "clip") {
      // Cap each clip at 45s of desk time — after that we roll to hosts.
      // User can tap Next to skip earlier.
      const capMs = 45000;
      const t = setTimeout(() => setBeatIdx((i) => i + 1), capMs);
      return () => clearTimeout(t);
    }
  }, [beatIdx, playing, currentBeat, muted]);

  // End of show
  useEffect(() => {
    if (beats.length && beatIdx >= beats.length) {
      setPlaying(false);
    }
  }, [beatIdx, beats.length]);

  const start = () => {
    setBeatIdx(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const resume = () => setPlaying(true);
  const next = () => setBeatIdx((i) => Math.min(i + 1, beats.length));

  if (!episode) {
    return <div className="text-white/60 text-sm">Loading morning show…</div>;
  }
  if (!episode.ready) {
    return (
      <div className="card-surface p-8 text-center">
        <Film className="w-8 h-8 text-white/30 mx-auto mb-3" />
        <div className="font-headline text-white text-lg">No episode available for {DEMO_DATE}.</div>
        <div className="text-white/50 text-sm mt-1">{episode.reason || "Try another date."}</div>
      </div>
    );
  }

  const finished = beats.length > 0 && beatIdx >= beats.length;

  return (
    <div data-testid="recap-show-page" className="space-y-4">
      {/* Slim date badge only — nothing above the frame competes with the hosts */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#F5A623]/15 border border-[#F5A623]/50 px-3 py-1">
          <span className="tick-dot bg-[#F5A623] live-pulse" />
          <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F5A623]">
            The Morning Line · {formatDate(episode.date)}
          </span>
        </div>
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
          {episode.stats.total_games_covered} games
        </div>
      </div>

      {/* Main show frame — Reggie & Marc are the stars */}
      <ShowFrame
        beat={currentBeat}
        beatIdx={beatIdx}
        playing={playing}
        finished={finished}
        muted={muted}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onNext={next}
        onToggleMute={() => setMuted((m) => !m)}
      />

      {/* Caption sits BELOW the frame so it never covers the hosts */}
      {playing && currentBeat?.kind === "host" && (
        <div className="rounded-lg border border-[#2d2d35] bg-[#0b0b10] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="font-accent text-[10px] uppercase tracking-[0.35em]"
                 style={{ color: ANALYSTS[currentBeat.speaker]?.accent || "#1e5dff" }}>
              {ANALYSTS[currentBeat.speaker]?.short || currentBeat.speaker}
            </div>
            {currentBeat.speaker === "marc" && currentBeat.segment?.stat_line && (
              <div className="inline-flex items-center gap-1.5 rounded-md bg-[#1e5dff]/15 border border-[#1e5dff]/50 px-2 py-0.5">
                <span className="font-accent text-[8px] uppercase tracking-widest text-[#1e5dff]">Stat</span>
                <span className="text-white text-xs font-headline">{currentBeat.segment.stat_line}</span>
              </div>
            )}
          </div>
          <div className="font-headline text-white text-lg sm:text-xl leading-snug">
            {currentBeat.text}
          </div>
        </div>
      )}

      {/* Segment progress rail */}
      <SegmentRail
        episode={episode}
        beats={beats}
        beatIdx={beatIdx}
        onJumpToSegment={(segIdx) => {
          const target = beats.findIndex(
            (b, i) => b.segment && b.segment.order === segIdx + 1 && b.kind === "host" && b.speaker === "reggie"
          );
          if (target >= 0) {
            setBeatIdx(target);
            setPlaying(true);
          }
        }}
      />

      {/* Fold: browse-other-days (the old Recaps gallery) */}
      <div className="pt-4 border-t border-[#2d2d35]">
        <button
          onClick={() => setBrowseOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left group"
          data-testid="recap-browse-toggle"
        >
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/50 group-hover:text-white transition-colors">
            Browse other days · full clip archive
          </div>
          {browseOpen ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
        </button>
        {browseOpen && (
          <div className="mt-4 rounded-lg border border-dashed border-[#2d2d35] p-4 text-white/60 text-sm space-y-2">
            <p>The full category-tagged clip browser lives on the <Link to="/recaps-archive" className="text-[#1e5dff] hover:underline">Recaps archive</Link>.</p>
            <p className="text-xs text-white/40">Everything you had on the old Recaps tab is preserved — just moved so this page can be the show.</p>
          </div>
        )}
      </div>

      {/* Hidden audio element for host lines */}
      <audio ref={audioRef} playsInline />
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  } catch { return iso; }
}

// ---- Show frame ----
function ShowFrame({ beat, beatIdx, playing, finished, muted, onStart, onPause, onResume, onNext, onToggleMute }) {
  // The current shot for the animated hosts. Between beats the two-shot
  // hangs (looks like a broadcast cut). During a clip we hold the two-shot
  // silently behind the iframe overlay.
  const shot = shotForBeat(beat, beatIdx);
  const speaker = beat?.kind === "host" ? beat.speaker : null;
  const isClipBeat = beat?.kind === "clip";
  const seg = beat?.segment;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11] aspect-video">
      {/* Always-mounted animated hosts — same TwoHostDesk the Predict Show
       * uses. When speaking, the mouth animates + the speaker pane widens. */}
      <TwoHostDesk
        shot={shot}
        speaker={speaker}
        speaking={playing && !!speaker && !muted}
      />

      {/* Segment label (top-left) — always visible when playing */}
      {(playing || finished) && beat && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-3 py-1.5 backdrop-blur-md">
          <span className="tick-dot bg-red-500 live-pulse" />
          <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/80">
            {beat.label}
          </span>
        </div>
      )}

      {/* Team lower-third — shows during host beats that have a segment */}
      {playing && beat?.kind === "host" && seg && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-3 py-1.5 backdrop-blur-md">
          {seg.away.logo_url && <img src={seg.away.logo_url} alt={seg.away.code} className="h-5 w-5 object-contain" />}
          <span className="font-accent text-[10px] uppercase tracking-widest text-white/80">
            {seg.away.code} @ {seg.home.code}
          </span>
          {seg.home.logo_url && <img src={seg.home.logo_url} alt={seg.home.code} className="h-5 w-5 object-contain" />}
        </div>
      )}

      {/* Speaker caption — REMOVED from inside frame. Now sits BELOW the
       * frame in the parent component, so it never covers Reggie & Marc.
       * Only the tiny team logos badge stays as an on-frame lower-third. */}

      {/* Clip iframe — sits ON TOP of the host frame during clip beats */}
      {playing && isClipBeat && seg && (
        <div className="absolute inset-0 z-30 bg-black">
          <iframe
            src={seg.clip.embed_url}
            title={seg.clip.title || "Highlight"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-3 py-1.5 backdrop-blur-md">
            {seg.away.logo_url && <img src={seg.away.logo_url} alt={seg.away.code} className="h-4 w-4 object-contain" />}
            <span className="font-accent text-[10px] uppercase tracking-widest text-white/80">{seg.away.code} @ {seg.home.code}</span>
            {seg.home.logo_url && <img src={seg.home.logo_url} alt={seg.home.code} className="h-4 w-4 object-contain" />}
          </div>
        </div>
      )}

      {/* Pre-roll cover — subtle so the hosts show through cleanly */}
      {!playing && !finished && (
        <button
          onClick={onStart}
          data-testid="recap-tap-to-start"
          className="absolute inset-0 z-40 flex items-end justify-center pb-12 cursor-pointer group"
          style={{
            background: "linear-gradient(to top, rgba(5,7,15,0.75) 0%, rgba(5,7,15,0.05) 55%, rgba(5,7,15,0.05) 100%)",
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center transition-transform duration-500 group-hover:scale-105">
            <div className="flex items-center gap-2 font-accent text-[10px] uppercase tracking-[0.4em] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 live-pulse" />
              On Air
            </div>
            <h2 className="font-headline text-3xl sm:text-4xl text-white"
                style={{ textShadow: "0 0 30px rgba(30,93,255,0.6)" }}>
              Tap to run the tape
            </h2>
          </div>
        </button>
      )}

      {/* End-of-show */}
      {finished && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/80">
          <div className="font-headline text-3xl text-white text-center px-4">That's the tape.</div>
          <button onClick={onStart} className="px-5 py-2 rounded-full bg-[#1e5dff] text-white font-accent text-xs uppercase tracking-widest hover:bg-[#3a72ff]">Replay</button>
        </div>
      )}

      {/* Controls overlay (bottom-right) */}
      {(playing || finished) && (
        <div className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5">
          {playing && (
            <button onClick={onPause} data-testid="recap-pause"
              className="h-8 w-8 rounded-full flex items-center justify-center bg-black/70 hover:bg-black border border-white/20 text-white transition-colors"
              title="Pause">
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {!playing && !finished && (
            <button onClick={onResume}
              className="h-8 w-8 rounded-full flex items-center justify-center bg-black/70 hover:bg-black border border-white/20 text-white transition-colors"
              title="Resume">
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onNext} data-testid="recap-next"
            className="h-8 w-8 rounded-full flex items-center justify-center bg-black/70 hover:bg-black border border-white/20 text-white transition-colors"
            title="Skip forward">
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggleMute}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-black/70 hover:bg-black border border-white/20 text-white transition-colors"
            title={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Segment rail ----
function SegmentRail({ episode, beats, beatIdx, onJumpToSegment }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {episode.segments.map((s, i) => {
        const firstBeatIdx = beats.findIndex(
          (b) => b.segment && b.segment.order === s.order && b.kind === "host" && b.speaker === "reggie"
        );
        const lastBeatIdx = beats.map((b, idx) => (b.segment && b.segment.order === s.order ? idx : -1))
          .filter((n) => n >= 0).pop() ?? -1;
        const isCurrent = beatIdx >= firstBeatIdx && beatIdx <= lastBeatIdx;
        const isDone = beatIdx > lastBeatIdx;
        return (
          <button
            key={s.match_id}
            onClick={() => onJumpToSegment(i)}
            data-testid={`recap-segment-${s.match_id}`}
            className={`flex-shrink-0 rounded-lg px-3 py-2 min-w-[128px] border transition-all ${
              isCurrent
                ? "bg-[#101625] border-[#F5A623] shadow-[0_0_16px_-4px_rgba(245,166,35,0.7)]"
                : "bg-[#0b0b10] border-[#2d2d35] hover:border-white/40"
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              {s.away.logo_url ? <img src={s.away.logo_url} alt={s.away.code} className="h-6 w-6 object-contain" /> : <span className="text-[9px] text-white/50">{s.away.code}</span>}
              <span className="text-[9px] font-accent uppercase tracking-widest text-white/40">@</span>
              {s.home.logo_url ? <img src={s.home.logo_url} alt={s.home.code} className="h-6 w-6 object-contain" /> : <span className="text-[9px] text-white/50">{s.home.code}</span>}
            </div>
            <div className={`text-[9px] font-accent uppercase tracking-[0.25em] mt-1.5 text-center ${
              isCurrent ? "text-[#F5A623]" : isDone ? "text-emerald-400/70" : "text-white/40"
            }`}>
              {isCurrent ? "On air" : isDone ? "✓ done" : `Game ${i + 1}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
