import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, ChevronRight, Play, Pause, SkipForward, ExternalLink, Smartphone } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { TMark, C } from "@/lib/brand";
import { playBumperSting } from "@/lib/sting";

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
  const audioCtxRef = useRef(null);

  // Lazy-init a single Web Audio context (browsers require a user gesture).
  function getAudioCtx() {
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      } catch { /* noop */ }
    }
    return audioCtxRef.current;
  }

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
    // 1) fade-to-black (300ms) → 2) branded bumper (900ms) → 3) new clip auto-plays
    // Sting fires at the start of the fade so audio bridges the video swap.
    setTransitioning(true);
    playBumperSting(getAudioCtx(), 0.5);
    setTimeout(() => {
      setShowBumper(true);
      setTimeout(() => {
        setIdx((i) => i + 1);
        setShowBumper(false);
        setTransitioning(false);
      }, 900);
    }, 300);
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

      {/* Matchup ribbon — also carries the category chip so it sits on our
       * chrome (not overlapping YouTube's own top-corner UI like Share /
       * fullscreen / video title). Layered logos-@-logos in the centre. */}
      {current && (
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
          <div
            className="px-2 py-1 rounded-sm font-accent text-[10px] uppercase tracking-[0.25em] shadow-lg"
            style={{ background: "#c40b1a", color: "#fff" }}
            data-testid="reel-category-chip"
          >
            {CATEGORY_LABEL[current.category] || current.category}
          </div>
          <div className="flex items-center gap-3">
            <TeamLogo code={current.away_team} className="h-8 w-8 object-contain" />
            <span className="font-headline text-lg">{current.away_team} @ {current.home_team}</span>
            <TeamLogo code={current.home_team} className="h-8 w-8 object-contain" />
          </div>
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50 min-w-[60px] text-right">
            {idx + 1}/{total}
          </div>
        </div>
      )}

      {/* Video frame */}
      <div className="relative bg-black aspect-video max-w-4xl mx-auto mt-3 border border-white/10">
        <ReelRotateHint />
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

        {/* NEXT-UP bumper — branded T-mark reveal */}
        {showBumper && nextClip && (
          <div
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{
              background: `radial-gradient(ellipse at center, rgba(30,91,255,0.35), ${C.black} 68%)`,
            }}
          >
            {/* Blue speed-line sweep across the frame */}
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 opacity-70"
                 style={{
                   background: `linear-gradient(90deg, transparent 0%, ${C.blue} 40%, ${C.white} 50%, ${C.blue} 60%, transparent 100%)`,
                   animation: "sweep 700ms ease-out both",
                 }}
            />
            <div className="relative flex flex-col items-center gap-4 z-10"
                 style={{ animation: "bumperIn 500ms cubic-bezier(0.16,1,0.3,1) both" }}>
              <TMark size={130} variant="light" />
              <div className="flex items-center gap-3">
                <TeamLogo code={nextClip.away_team} className="h-8 w-8 object-contain" />
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "26px", color: C.white, letterSpacing: "0.05em" }}>
                  {CATEGORY_LABEL[nextClip.category] || nextClip.category}
                </div>
                <TeamLogo code={nextClip.home_team} className="h-8 w-8 object-contain" />
              </div>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.4em", color: C.blue }}>
                CLIP {idx + 2} · OF {total}
              </div>
            </div>
          </div>
        )}

        {/* Progress dots — one per clip */}
        <div className="absolute top-2 left-0 right-0 px-3 flex items-center gap-1 z-10">
          {clips.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors ${
                i < idx ? "bg-[#1E5BFF]" : i === idx ? "bg-white" : "bg-white/15"
              }`}
            />
          ))}
        </div>
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

      <style>{`
        @keyframes fadeIn { from {opacity:0} to {opacity:1} }
        @keyframes bumperIn {
          0%   { opacity: 0; transform: scale(0.62); }
          55%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1);    }
        }
        @keyframes sweep {
          0%   { transform: translateX(-100%) translateY(-50%); opacity: 0; }
          40%  { opacity: 1; }
          100% { transform: translateX(100%) translateY(-50%);  opacity: 0; }
        }
      `}</style>
    </div>
  );
}


// ---- Rotate-your-phone hint ----
// Small nudge for portrait viewers to flip to landscape for a bigger clip.
// Auto-dismisses after 6 seconds AND on first tap. Remembered per-device
// via localStorage so it never nags returning users.
const REEL_ROTATE_HINT_KEY = "ticker.reel.rotate_hint_dismissed";
function ReelRotateHint() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(REEL_ROTATE_HINT_KEY); } catch { return true; }
  });
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [visible]);
  const dismiss = () => {
    try { localStorage.setItem(REEL_ROTATE_HINT_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };
  if (!visible) return null;
  return (
    <button
      onClick={dismiss}
      data-testid="reel-rotate-hint"
      className="portrait:flex landscape:hidden absolute top-3 left-1/2 -translate-x-1/2 z-30 items-center gap-2 rounded-full bg-black/70 border border-[#1E5BFF]/60 px-3 py-1.5 backdrop-blur-md shadow-[0_6px_20px_-8px_rgba(30,91,255,0.7)] animate-pulse"
      aria-label="Rotate phone for bigger clip"
    >
      <Smartphone className="w-3.5 h-3.5 text-[#1E5BFF]" style={{ transform: "rotate(90deg)" }} />
      <span className="font-accent text-[10px] uppercase tracking-[0.25em] text-white/90">
        Flip for bigger clip
      </span>
    </button>
  );
}
