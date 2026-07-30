import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, ChevronRight, Play, Pause, SkipForward, ExternalLink } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Human-readable badges for each Highlightly category.
const CATEGORY_LABEL = {
  "goal": "GOAL",
  "power-play-goal": "POWER-PLAY GOAL",
  "shorthanded-goal": "SHORTIE",
  "overtime-shootout-goal": "OT / SHOOTOUT WINNER",
  "hat-trick": "HAT TRICK",
  "save": "BIG SAVE",
  "hit-check": "BIG HIT",
  "fight": "SCRAP",
  "assist-play": "SET-UP",
  "viral-moment": "VIRAL",
  "match-highlights": "FULL RECAP",
};

// Extract a YouTube video ID from either an /embed/... or a /watch?v=... URL
function ytIdFromUrl(url) {
  if (!url) return null;
  const embed = url.match(/\/embed\/([^/?&#]+)/);
  if (embed) return embed[1];
  const watch = url.match(/[?&]v=([^&#]+)/);
  return watch ? watch[1] : null;
}

function ytThumb(url) {
  const id = ytIdFromUrl(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

// Build an iframe URL that (a) autoplays, (b) hides YouTube branding,
// (c) exposes the JS API so we can listen for `onStateChange` and know
// when the clip has ended so we can auto-advance to the next one.
function buildEmbed(url) {
  const id = ytIdFromUrl(url);
  if (!id) return url;
  const origin = encodeURIComponent(window.location.origin);
  return (
    `https://www.youtube.com/embed/${id}` +
    `?autoplay=1&mute=0&modestbranding=1&rel=0&playsinline=1` +
    `&enablejsapi=1&origin=${origin}`
  );
}

export default function FastReelAudition() {
  const { matchId } = useParams();
  const [reel, setReel] = useState(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showBumper, setShowBumper] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    axios.get(`${API}/audition/fast-reel`, { params: { match_id: matchId } })
      .then((r) => { if (alive) setReel(r.data); })
      .catch(() => { if (alive) setReel({ short_clips: [], long_clip: null }); });
    return () => { alive = false; };
  }, [matchId]);

  const clips = reel?.short_clips || [];
  const current = clips[idx];

  // Register with the YouTube iframe once it loads so we get postMessage
  // events for state changes. We watch for state 0 (ended) → advance.
  useEffect(() => {
    if (!current || !iframeRef.current) return;
    const iframe = iframeRef.current;

    function tellIframeToListen() {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: "reel", channel: "widget" }),
          "*"
        );
      } catch { /* noop */ }
    }
    // Ask the iframe to start reporting once it's loaded.
    iframe.addEventListener("load", tellIframeToListen);

    function onMsg(ev) {
      if (typeof ev.data !== "string") return;
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data?.event === "onStateChange" && data.info === 0) {
        // Clip ended — advance with the bumper transition.
        advance();
      }
    }
    window.addEventListener("message", onMsg);
    return () => {
      iframe.removeEventListener("load", tellIframeToListen);
      window.removeEventListener("message", onMsg);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function advance() {
    if (idx >= clips.length - 1) {
      setPaused(true);
      return;
    }
    // 1) fade-to-black (400ms) → 2) NEXT UP bumper (700ms) → 3) new clip auto-plays
    setTransitioning(true);
    setTimeout(() => {
      setShowBumper(true);
      setTimeout(() => {
        setIdx((i) => i + 1);
        setShowBumper(false);
        setTransitioning(false);
      }, 700);
    }, 400);
  }

  function goPrev() {
    if (idx <= 0) return;
    setIdx((i) => i - 1);
  }
  function goNext() { advance(); }

  const total = clips.length;
  const nextClip = clips[idx + 1];

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" data-testid="audition-back" className="text-white/50 hover:text-white text-xs font-accent uppercase tracking-widest">
            ← Recap
          </Link>
          <span className="text-white/25">/</span>
          <span className="font-headline text-sm">Fast-Reel Audition</span>
        </div>
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">
          {reel ? `${total} clips` : "loading…"}
        </div>
      </div>

      {/* Matchup ribbon */}
      {current && (
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-center gap-3">
          <TeamLogo code={current.away_team} className="h-8 w-8 object-contain" />
          <span className="font-headline text-lg">{current.away_team} @ {current.home_team}</span>
          <TeamLogo code={current.home_team} className="h-8 w-8 object-contain" />
        </div>
      )}

      {/* Video frame */}
      <div className="relative bg-black aspect-video max-w-4xl mx-auto mt-3 border border-white/10">
        {current && !transitioning && (
          <iframe
            ref={iframeRef}
            key={current.id}
            src={buildEmbed(current.embed_url)}
            title={current.title || "Clip"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
            data-testid={`reel-iframe-${idx}`}
          />
        )}

        {/* Transition scrim (fade to black) */}
        {transitioning && !showBumper && (
          <div className="absolute inset-0 bg-black transition-opacity duration-300 opacity-100" />
        )}

        {/* NEXT-UP bumper */}
        {showBumper && nextClip && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <div className="text-center animate-[fadeIn_400ms_ease-out]">
              <div className="font-accent text-[10px] uppercase tracking-[0.4em] text-[#1E5BFF]">Next up</div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <TeamLogo code={nextClip.away_team} className="h-10 w-10 object-contain" />
                <span className="font-headline text-2xl">
                  {CATEGORY_LABEL[nextClip.category] || nextClip.category}
                </span>
                <TeamLogo code={nextClip.home_team} className="h-10 w-10 object-contain" />
              </div>
              <div className="mt-2 font-accent text-[11px] uppercase tracking-widest text-white/50">
                Clip {idx + 2} of {total}
              </div>
            </div>
          </div>
        )}

        {/* Progress dots — one per clip */}
        <div className="absolute top-2 left-0 right-0 px-3 flex items-center gap-1">
          {clips.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors ${
                i < idx ? "bg-[#1E5BFF]" : i === idx ? "bg-white" : "bg-white/15"
              }`}
            />
          ))}
        </div>

        {/* Category chip */}
        {current && !showBumper && (
          <div className="absolute top-4 left-3 bg-red-600 px-2 py-1 rounded-sm font-accent text-[9px] uppercase tracking-[0.25em] shadow-lg">
            {CATEGORY_LABEL[current.category] || current.category}
          </div>
        )}
      </div>

      {/* Transport controls */}
      <div className="max-w-4xl mx-auto mt-3 px-4 flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={idx === 0}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-white/15 hover:border-white/40 disabled:opacity-30 font-accent text-[11px] uppercase tracking-widest transition-colors"
          data-testid="reel-prev"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <div className="text-center">
          <div className="font-headline text-lg">Clip {idx + 1} <span className="text-white/40">of {total}</span></div>
          <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
            {current?.channel || "Highlightly"}
          </div>
        </div>
        <button
          onClick={goNext}
          disabled={idx >= total - 1}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-white/15 hover:border-white/40 disabled:opacity-30 font-accent text-[11px] uppercase tracking-widest transition-colors"
          data-testid="reel-next"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Clip strip (Netflix-style scrubber) */}
      <div className="max-w-4xl mx-auto mt-4 px-4">
        <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
          Every play in this game
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {clips.map((c, i) => {
            const t = ytThumb(c.embed_url);
            return (
              <button
                key={c.id}
                onClick={() => setIdx(i)}
                className={`flex-shrink-0 w-32 rounded-md border overflow-hidden transition-all ${
                  i === idx ? "border-[#1E5BFF] shadow-[0_0_12px_-2px_rgba(30,91,255,0.7)]" : "border-white/10 hover:border-white/40"
                }`}
                data-testid={`reel-chip-${i}`}
              >
                <div className="aspect-video bg-black/60 relative">
                  {t && <img src={t} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25" />
                  <span className="absolute top-1 left-1 font-accent text-[8px] uppercase tracking-widest bg-red-600 text-white px-1 py-0.5 rounded-sm">
                    {(CATEGORY_LABEL[c.category] || c.category).split(" ")[0]}
                  </span>
                  <span className="absolute bottom-1 right-1 font-accent text-[9px] text-white/85">
                    {i + 1}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle: switch to long recap if user wants the couch experience */}
      {reel?.long_clip && (
        <div className="max-w-4xl mx-auto mt-6 px-4 py-3 border-t border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/45">Or watch the full 7-10 min recap</div>
              <div className="font-headline text-sm mt-1">{reel.long_clip.title || "Full match highlights"}</div>
            </div>
            <a
              href={reel.long_clip.source_url || `https://www.youtube.com/watch?v=${ytIdFromUrl(reel.long_clip.embed_url)}`}
              target="_blank"
              rel="noreferrer"
              data-testid="reel-long-mode"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/25 hover:border-white/60 font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              Long recap <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from {opacity:0} to {opacity:1} }`}</style>
    </div>
  );
}
