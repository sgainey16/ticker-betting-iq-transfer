import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ANALYSTS, TEST_IDS } from "@/lib/config";
import TwoHostDesk from "@/components/TwoHostDesk";
import PostGameStats from "@/components/PostGameStats";
import GameStory from "@/components/GameStory";
import PlayByPlayPanel from "@/components/PlayByPlayPanel";
import { playStinger } from "@/lib/stinger";
import { ShowOpener } from "@/components/ShowOpener";
import {
  Play, Pause, SkipForward, Volume2, VolumeX, Film, Smartphone,
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
  const audioRef = useRef(null);

  const beats = useMemo(() => buildBeatSequence(episode), [episode]);
  const currentBeat = beats[beatIdx];
  // Which segment (game) is currently on-air? The post-game stats panel
  // follows this — swap boxes as we move between games.
  const currentSegment = currentBeat?.segment
    || (episode?.segments || []).find((s) => s.order === (currentBeat?.segment_order || 1))
    || (episode?.segments || [])[0]
    || null;

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
    // Network stinger on show open — the "we're live" moment. Self-caps
    // at 3 plays per browser session so it stays fun, not annoying.
    playStinger();
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
    <div data-testid="recap-show-page" className="space-y-2 landscape:space-y-1.5">
      {/* Welcome opener — auto-plays once per session on arrival. Sets the
       * room without demanding the full ambient show up-front. Users tap
       * a game rail tile to hear per-game recap deep dives. */}
      <div className="landscape:hidden">
        <ShowOpener variant="recap" sessionKey="ticker.opener.recap" />
      </div>

      {/* Slim date badge only — nothing above the frame competes with the hosts */}
      <div className="flex items-center justify-between landscape:hidden">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#1E5BFF]/15 border border-[#1E5BFF]/50 px-3 py-1">
          <span className="tick-dot bg-[#1E5BFF] live-pulse" />
          <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1E5BFF]">
            Last Night's Games · {formatDate(episode.date)}
          </span>
        </div>
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/40">
          {episode.stats.total_games_covered} games
        </div>
      </div>

      {/* Landscape on phone: bleed the frame + rail to the device edges so
       * the show fills the screen. Wrapper claims most of the viewport
       * (only reserving the header) and frame flex-1's inside it so the
       * hosts stay big and the logo rail is pinned right below. */}
      <div className="landscape:-mx-5 sm:landscape:-mx-8 landscape:flex landscape:flex-col landscape:h-[calc(100dvh-64px)] landscape:pb-1">
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

      {/* Segment progress rail — logo vs logo. On landscape phones the grid
       * packs all 8 games onto one row without horizontal scroll and stays
       * pinned right below the frame so it's always in view. */}

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
        onJumpToClip={(segIdx) => {
          const target = beats.findIndex(
            (b) => b.segment && b.segment.order === segIdx + 1 && b.kind === "clip"
          );
          if (target >= 0) {
            setBeatIdx(target);
            setPlaying(true);
          }
        }}
      />
      </div>

      {/* Play-By-Play + Post-Game Stats — split screen.
       * Videos-first (left): every goal with scorer/assists/time/situation +
       * tap-to-play modal. Stats (right): full box score, all rows open.
       * Mobile: stacked, play-by-play still on top. */}
      {currentSegment && (
        <div className="grid gap-3 md:grid-cols-2">
          <PlayByPlayPanel segment={currentSegment} />
          <PostGameStats segment={currentSegment} />
        </div>
      )}

      {/* Game Story — signature "translate data into meaning" panel.
       * Sits below the highlights + stats split so the flow is:
       * watch → read the numbers → hear the story. Compact horizontal. */}
      {currentSegment && (
        <GameStory segment={currentSegment} />
      )}

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

// Extract a YouTube video ID from an embed_url and return the poster
// thumbnail (mqdefault ~ 320x180 — small file, sharp on tile-size preview).
function youtubeThumb(embedUrl) {
  if (!embedUrl) return null;
  const m = embedUrl.match(/\/embed\/([^/?&#]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
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
    <div className="relative overflow-hidden border border-[#2d2d35] bg-[#0d0d11] portrait:aspect-video rounded-2xl landscape:rounded-none landscape:border-x-0 landscape:w-full landscape:flex-1 landscape:min-h-0">
      {/* Always-mounted animated hosts — same TwoHostDesk the Predict Show
       * uses. When speaking, the mouth animates + the speaker pane widens.
       * `fill` stretches the desk to fill the frame (needed for landscape
       * bleed where the frame is height-driven, not aspect-driven). */}
      <TwoHostDesk
        shot={shot}
        speaker={speaker}
        speaking={playing && !!speaker && !muted}
        fill
      />

      {/* Rotate-your-phone nudge — portrait phones only, sits on-frame like
       * a camera app's orientation hint. Auto-hides after 6s or when user
       * taps it. Vanishes forever in landscape via `portrait:flex`. */}
      <RotateHint />

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

      {/* Pre-roll cover — compact bottom-anchored CTA so hosts dominate */}
      {!playing && !finished && (
        <button
          onClick={onStart}
          data-testid="recap-tap-to-start"
          className="absolute inset-0 z-40 flex items-end justify-center pb-4 cursor-pointer group"
          style={{
            background: "linear-gradient(to top, rgba(5,7,15,0.55) 0%, rgba(5,7,15,0) 30%, rgba(5,7,15,0) 100%)",
          }}
        >
          <div className="flex items-center gap-2 rounded-full bg-black/60 border border-white/20 px-4 py-1.5 backdrop-blur-md transition-transform duration-500 group-hover:scale-105">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 live-pulse" />
            <span className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/70">On Air</span>
            <span className="font-headline text-white text-sm">Tap to run the tape</span>
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
        </div>
      )}
    </div>
  );
}

// ---- Segment rail — logo vs logo ----
function SegmentRail({ episode, beats, beatIdx, onJumpToSegment, onJumpToClip }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 landscape:grid landscape:grid-flow-col landscape:auto-cols-fr landscape:overflow-visible">
      {episode.segments.map((s, i) => {
        const firstBeatIdx = beats.findIndex(
          (b) => b.segment && b.segment.order === s.order && b.kind === "host" && b.speaker === "reggie"
        );
        const lastBeatIdx = beats.map((b, idx) => (b.segment && b.segment.order === s.order ? idx : -1))
          .filter((n) => n >= 0).pop() ?? -1;
        const isCurrent = beatIdx >= firstBeatIdx && beatIdx <= lastBeatIdx;
        const isDone = beatIdx > lastBeatIdx;
        const thumb = youtubeThumb(s.clip?.embed_url);
        return (
          <div
            key={s.match_id}
            data-testid={`recap-segment-${s.match_id}`}
            className={`flex-shrink-0 landscape:flex-shrink landscape:min-w-0 min-w-[150px] rounded-lg overflow-hidden border transition-all ${
              isCurrent
                ? "bg-[#101625] border-[#1E5BFF] shadow-[0_0_16px_-4px_rgba(30,91,255,0.7)]"
                : "bg-[#0b0b10] border-[#2d2d35] hover:border-white/40"
            }`}
          >
            {/* TOP BANNER — logos + score + status (tappable = jump to segment) */}
            <button
              onClick={() => onJumpToSegment(i)}
              className="w-full px-3 landscape:px-2 py-2 text-left"
              data-testid={`recap-segment-logos-${s.match_id}`}
            >
              <div className="flex items-center justify-between gap-1.5">
                {s.away.logo_url ? <img src={s.away.logo_url} alt={s.away.code} className="h-9 w-9 landscape:h-7 landscape:w-7 object-contain" /> : <span className="text-[9px] text-white/50">{s.away.code}</span>}
                <span className="text-[9px] font-accent uppercase tracking-widest text-white/40">@</span>
                {s.home.logo_url ? <img src={s.home.logo_url} alt={s.home.code} className="h-9 w-9 landscape:h-7 landscape:w-7 object-contain" /> : <span className="text-[9px] text-white/50">{s.home.code}</span>}
              </div>
              {s.final && (
                <div className="mt-1 flex items-center justify-center gap-2 font-headline text-sm landscape:text-xs leading-none">
                  <span className={s.final.away_score > s.final.home_score ? "text-white" : "text-white/50"}>
                    {s.final.away_score}
                  </span>
                  <span className="text-white/30 text-[10px]">–</span>
                  <span className={s.final.home_score > s.final.away_score ? "text-white" : "text-white/50"}>
                    {s.final.home_score}
                  </span>
                </div>
              )}
              <div className={`text-[9px] landscape:text-[8px] font-accent uppercase tracking-[0.25em] mt-1 text-center ${
                isCurrent ? "text-[#1E5BFF]" : isDone ? "text-emerald-400/70" : "text-white/40"
              }`}>
                {isCurrent ? "On air" : isDone ? "✓ done" : `Game ${i + 1}`}
              </div>
            </button>

            {/* BOTTOM BANNER — highlight thumbnail with play button.
             * When the clip is a YouTube embed we use its thumbnail; when
             * it's a direct MP4 (e.g. ESPN CDN) there's no YT thumb, so we
             * render a fallback tile with "HIGHLIGHTS" wordmark + play
             * button so the game card doesn't look broken. */}
            {s.clip && (
              <button
                onClick={() => onJumpToClip(i)}
                data-testid={`recap-segment-clip-${s.match_id}`}
                aria-label={`Play highlights for ${s.away.code} at ${s.home.code}`}
                className="w-full relative block group border-t border-white/10 aspect-video overflow-hidden"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  /* Fallback tile — dark gradient + faint team logos so the
                   * missing-thumbnail case still reads as a highlight card. */
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a2e] via-[#0f0f1a] to-[#1a0f1f]">
                    {s.away.logo_url && <img src={s.away.logo_url} alt="" className="h-10 w-10 object-contain opacity-40" />}
                    {s.home.logo_url && <img src={s.home.logo_url} alt="" className="h-10 w-10 object-contain opacity-40" />}
                  </div>
                )}
                {/* Dark scrim so the play icon reads on any thumbnail */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/40" />
                {/* Play button — big red circle, unmissable */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-9 w-9 landscape:h-8 landscape:w-8 rounded-full bg-red-600 group-hover:bg-red-500 flex items-center justify-center shadow-[0_0_20px_-2px_rgba(239,68,68,0.85)] transition-colors">
                    <Play className="w-4 h-4 text-white translate-x-[1px]" fill="currentColor" />
                  </span>
                </span>
                {/* Corner meta — "Highlights" label so intent is clear */}
                <span className="absolute bottom-1 left-1.5 font-accent text-[8px] uppercase tracking-[0.25em] text-white/85">
                  Highlights
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ---- Rotate-your-phone hint ----
// Small camera-app-style chip that nudges portrait viewers to flip
// horizontal for the full broadcast. Dismisses permanently once tapped
// (per-device via localStorage) and auto-hides after 6 seconds so it
// never blocks the show.
const ROTATE_HINT_KEY = "ticker.recap.rotate_hint_dismissed";
function RotateHint() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(ROTATE_HINT_KEY); } catch { return true; }
  });
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [visible]);
  const dismiss = () => {
    try { localStorage.setItem(ROTATE_HINT_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };
  if (!visible) return null;
  return (
    <button
      onClick={dismiss}
      data-testid="recap-rotate-hint"
      className="portrait:flex landscape:hidden absolute top-3 left-1/2 -translate-x-1/2 z-30 items-center gap-2 rounded-full bg-black/70 border border-[#1e5dff]/60 px-3 py-1.5 backdrop-blur-md shadow-[0_6px_20px_-8px_rgba(30,93,255,0.7)] animate-pulse"
      aria-label="Rotate phone for full broadcast"
    >
      <Smartphone
        className="w-3.5 h-3.5 text-[#1e5dff]"
        style={{ transform: "rotate(90deg)" }}
      />
      <span className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/90">
        Flip for full broadcast
      </span>
    </button>
  );
}
