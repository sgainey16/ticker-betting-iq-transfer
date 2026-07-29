import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ANALYSTS, TEST_IDS } from "@/lib/config";
import {
  Play, Pause, SkipForward, Volume2, VolumeX, Film,
  ChevronDown, ChevronUp, ExternalLink,
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
            // No audio → hold caption for read-time then advance.
            const ms = Math.max(2500, currentBeat.text.length * 55);
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
          const ms = Math.max(2500, (currentBeat.text || "").length * 55);
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
    <div data-testid="recap-show-page" className="space-y-6">
      {/* Header */}
      <header>
        <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#F5A623]">
          <span className="tick-dot bg-[#F5A623] live-pulse inline-block mr-2 align-middle" />
          The Morning Line · {formatDate(episode.date)}
        </div>
        <h1 className="font-headline text-4xl sm:text-5xl text-white mt-1">
          Every game. Every story. Every night.
        </h1>
        <p className="text-white/60 mt-2 text-sm max-w-2xl">
          Reggie & Marc took your notebook to bed. Tap Play — they run the tape
          on all {episode.stats.total_games_covered} games from the wildcard
          crunch. Story hook, clip, closing stat, next.
        </p>
      </header>

      {/* Main show frame */}
      <ShowFrame
        beat={currentBeat}
        playing={playing}
        finished={finished}
        muted={muted}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onNext={next}
        onToggleMute={() => setMuted((m) => !m)}
      />

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
function ShowFrame({ beat, playing, finished, muted, onStart, onPause, onResume, onNext, onToggleMute }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11] aspect-video">
      {!beat || (!playing && !finished && beat === undefined) ? null : null}

      {/* Pre-roll cover */}
      {!playing && !finished && (
        <button
          onClick={onStart}
          data-testid="recap-tap-to-start"
          className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer group"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(5,7,15,0.55) 0%, rgba(5,7,15,0.92) 100%)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div className="flex flex-col items-center gap-3 text-center transition-transform duration-500 group-hover:scale-105">
            <div className="flex items-center gap-2 font-accent text-xs uppercase tracking-[0.4em] text-white/60">
              <span className="h-2 w-2 rounded-full bg-red-500 live-pulse" />
              On Air
            </div>
            <h2 className="font-headline text-4xl sm:text-5xl lg:text-6xl text-white"
                style={{ textShadow: "0 0 40px rgba(30,93,255,0.7)" }}>
              Tap to run the tape.
            </h2>
            <div className="mt-2 font-accent text-[11px] uppercase tracking-[0.3em] text-white/45">
              Reggie & Marc are ready. Story → clip → stat → next.
            </div>
          </div>
        </button>
      )}

      {/* Playing states */}
      {playing && beat?.kind === "host" && <HostBeat beat={beat} />}
      {playing && beat?.kind === "clip" && <ClipBeat beat={beat} />}

      {/* End-of-show state */}
      {finished && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          <div className="font-headline text-3xl text-white text-center px-4">That's the tape.</div>
          <button onClick={onStart} className="px-5 py-2 rounded-full bg-[#1e5dff] text-white font-accent text-xs uppercase tracking-widest hover:bg-[#3a72ff]">Replay</button>
        </div>
      )}

      {/* Controls overlay */}
      {(playing || finished) && (
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5">
          {playing && (
            <button
              onClick={onPause}
              data-testid="recap-pause"
              className="h-8 w-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 border border-white/20 text-white transition-colors"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}
          {!playing && !finished && (
            <button
              onClick={onResume}
              className="h-8 w-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 border border-white/20 text-white transition-colors"
              title="Resume"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onNext}
            data-testid="recap-next"
            className="h-8 w-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 border border-white/20 text-white transition-colors"
            title="Skip forward"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleMute}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-black/60 hover:bg-black/80 border border-white/20 text-white transition-colors"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Beat renderers ----
function HostBeat({ beat }) {
  const analyst = ANALYSTS[beat.speaker];
  const accent = analyst?.accent || "#1e5dff";
  const seg = beat.segment;
  return (
    <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
      {/* Segment label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="tick-dot bg-red-500 live-pulse" />
          <span className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/50">
            {beat.label}
          </span>
        </div>
        {seg && (
          <div className="flex items-center gap-2 opacity-90">
            {seg.away.logo_url && <img src={seg.away.logo_url} alt={seg.away.code} className="h-8 w-8 object-contain" />}
            <span className="text-white/50 text-xs font-accent uppercase tracking-widest">@</span>
            {seg.home.logo_url && <img src={seg.home.logo_url} alt={seg.home.code} className="h-8 w-8 object-contain" />}
          </div>
        )}
      </div>

      {/* Middle: host portrait glow + caption */}
      <div className="flex-1 flex items-center gap-6">
        <div
          className="h-28 w-28 sm:h-36 sm:w-36 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: `${accent}22`,
            border: `2px solid ${accent}88`,
            boxShadow: `0 0 60px -8px ${accent}`,
          }}
        >
          <div className="font-headline text-5xl" style={{ color: accent }}>{analyst?.short?.[0] || "?"}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-accent text-[10px] uppercase tracking-[0.35em]" style={{ color: accent }}>
            {analyst?.short || beat.speaker}
          </div>
          <div className="font-headline text-2xl sm:text-3xl text-white mt-2 leading-tight">
            {beat.text}
          </div>
        </div>
      </div>

      {/* Empty bottom slot (controls sit on the overlay) */}
      <div className="h-4" />
    </div>
  );
}

function ClipBeat({ beat }) {
  const seg = beat.segment;
  return (
    <div className="absolute inset-0 bg-black">
      <iframe
        src={seg.clip.embed_url}
        title={seg.clip.title || "Highlight"}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
      {/* Small lower-third with team logos */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-3 py-1.5 backdrop-blur-md">
        {seg.away.logo_url && <img src={seg.away.logo_url} alt={seg.away.code} className="h-4 w-4 object-contain" />}
        <span className="font-accent text-[10px] uppercase tracking-widest text-white/80">{seg.away.code} @ {seg.home.code}</span>
        {seg.home.logo_url && <img src={seg.home.logo_url} alt={seg.home.code} className="h-4 w-4 object-contain" />}
      </div>
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
