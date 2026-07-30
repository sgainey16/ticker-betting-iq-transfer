/**
 * PlayByPlayModal — cinematic "zoom into a play" overlay.
 *
 * Reuses the same fast-reel behaviour we shipped at /audition/fast-reel:
 * YouTube IFrame Player SDK, T-mark branded bumpers, whoosh sting, random
 * Reggie one-liners between clips. Auto-advances through the game's short
 * clips starting from whichever chip the user tapped in the panel.
 *
 * Kept intentionally lean vs the full audition page — no scrubber, no long-
 * recap fallback, no rotate-hint (the modal's naturally landscape-friendly).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { TeamLogo } from "@/lib/teamLogos";
import { TMark, C } from "@/lib/brand";
import { playBumperSting } from "@/lib/sting";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Category → clean human label. Numbering added by buildLabels() below.
const CATEGORY_LABEL = {
  "goal": "GOAL",
  "power-play-goal": "POWER-PLAY",
  "shorthanded-goal": "SHORTIE",
  "overtime-shootout-goal": "OT WINNER",
  "hat-trick": "HAT TRICK",
  "save": "BIG SAVE",
  "hit-check": "BIG HIT",
  "fight": "SCRAP",
  "assist-play": "SET-UP",
  "viral-moment": "VIRAL",
};

function buildLabels(clips) {
  const counters = {};
  const totals = {};
  for (const c of clips) totals[c.category] = (totals[c.category] || 0) + 1;
  return clips.map((c) => {
    counters[c.category] = (counters[c.category] || 0) + 1;
    const base = CATEGORY_LABEL[c.category] || (c.category || "PLAY").toUpperCase();
    if (totals[c.category] > 1) return `${base} ${counters[c.category]}`;
    return base;
  });
}

function ytIdFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/embed\/([^/?&#]+)/) || url.match(/[?&]v=([^&#]+)/);
  return m ? m[1] : null;
}
function ytThumb(url) {
  const id = ytIdFromUrl(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

// Lazy-load YT IFrame API (guarded against double-load).
function loadYTApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (window._ytApiPromise) return window._ytApiPromise;
  window._ytApiPromise = new Promise((resolve) => {
    const prior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prior === "function") { try { prior(); } catch { /* noop */ } }
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return window._ytApiPromise;
}

// Shared with the audition page — kept in sync manually until we extract.
const REGGIE_TRANSITION_LINES = [
  "Ohhh, what a snipe.",
  "Are you kidding me right now?",
  "Top shelf. Cellophane.",
  "That is a highlight-reel goal.",
  "Nasty finish. Wow.",
  "Absolute rocket.",
  "Look at that setup.",
  "Give me another one.",
  "Alright, watch this one.",
  "Here comes another beauty.",
  "How about this next one.",
  "Set up like clockwork.",
  "Backhand, top corner.",
  "Boys, don't blink.",
];

export default function PlayByPlayModal({ open, clips, matchup, startIdx = 0, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const [hasStarted, setHasStarted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showBumper, setShowBumper] = useState(false);

  const playerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const bumperAudioRef = useRef(null);
  const reggieLinesRef = useRef([]);
  const lastReggieIdxRef = useRef(-1);
  const PLAYER_ID = "pbp-yt-player";

  const labels = useMemo(() => buildLabels(clips || []), [clips]);
  const current = clips?.[idx];
  const nextClip = clips?.[idx + 1];
  const total = clips?.length || 0;

  // Reset when the modal reopens on a different starting clip
  useEffect(() => {
    if (open) {
      setIdx(startIdx);
      setHasStarted(false);
      setTransitioning(false);
      setShowBumper(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, startIdx]);

  // Warm the Reggie audio pool on first open
  useEffect(() => {
    if (!open || reggieLinesRef.current.length) return;
    let alive = true;
    Promise.all(
      REGGIE_TRANSITION_LINES.map((text) =>
        axios.get(`${API}/recap-show/line-audio`, { params: { speaker: "reggie", text } })
          .then((r) => r.data?.audio_url).catch(() => null)
      )
    ).then((urls) => { if (alive) reggieLinesRef.current = urls.filter(Boolean); });
    return () => { alive = false; };
  }, [open]);

  // YouTube player lifecycle
  useEffect(() => {
    if (!open || !current) return;
    let cancelled = false;
    // Watchdog: some Highlightly YT clips are "removed" and never fire a
    // reliable onError. If the video hasn't reached PLAYING state within
    // 8 seconds of load, treat it as broken and auto-advance so the modal
    // never gets stuck on a black frame.
    let hasReachedPlaying = false;
    let watchdog = null;
    loadYTApi().then((YT) => {
      if (cancelled) return;
      const videoId = ytIdFromUrl(current.embed_url);
      if (!videoId) { setTimeout(() => advance(), 500); return; }

      const armWatchdog = () => {
        if (watchdog) clearTimeout(watchdog);
        hasReachedPlaying = false;
        watchdog = setTimeout(() => {
          if (!hasReachedPlaying) advance();
        }, 8000);
      };

      if (playerRef.current?.loadVideoById) {
        try { playerRef.current.loadVideoById(videoId); } catch { /* noop */ }
        armWatchdog();
        return;
      }
      playerRef.current = new YT.Player(PLAYER_ID, {
        videoId,
        playerVars: {
          autoplay: 1, modestbranding: 1, rel: 0, playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e) => { try { e.target.playVideo(); } catch { /* noop */ } },
          onStateChange: (e) => {
            if (e.data === 1) { hasReachedPlaying = true; setHasStarted(true); }
            if (e.data === 0) advance();
          },
          onError: () => setTimeout(() => advance(), 500),
        },
      });
      armWatchdog();
    });
    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current?.id]);

  // Destroy player when modal closes
  useEffect(() => {
    if (!open) {
      try { playerRef.current?.destroy(); } catch { /* noop */ }
      playerRef.current = null;
      if (bumperAudioRef.current) {
        try { bumperAudioRef.current.pause(); } catch { /* noop */ }
        bumperAudioRef.current = null;
      }
    }
  }, [open]);

  function getAudioCtx() {
    if (!audioCtxRef.current) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      } catch { /* noop */ }
    }
    return audioCtxRef.current;
  }

  function pickReggieUrl() {
    const urls = reggieLinesRef.current;
    if (!urls.length) return null;
    let i = Math.floor(Math.random() * urls.length);
    if (i === lastReggieIdxRef.current && urls.length > 1) i = (i + 1) % urls.length;
    lastReggieIdxRef.current = i;
    return urls[i];
  }

  function advance() {
    if (idx >= (clips?.length || 0) - 1) return;
    setTransitioning(true);
    playBumperSting(getAudioCtx(), 0.4);
    setTimeout(() => {
      setShowBumper(true);
      const url = pickReggieUrl();
      if (bumperAudioRef.current) {
        try { bumperAudioRef.current.pause(); } catch { /* noop */ }
      }
      const finish = () => {
        setIdx((i) => i + 1);
        setShowBumper(false);
        setTransitioning(false);
        bumperAudioRef.current = null;
      };
      if (url) {
        const audio = new Audio(`${process.env.REACT_APP_BACKEND_URL}${url}`);
        audio.volume = 0.9;
        audio.onended = finish;
        const safety = setTimeout(finish, 3800);
        audio.onerror = () => { clearTimeout(safety); finish(); };
        audio.onplay = () => { clearTimeout(safety); };
        audio.play().catch(() => { clearTimeout(safety); finish(); });
        bumperAudioRef.current = audio;
      } else {
        setTimeout(finish, 1000);
      }
    }, 220);
  }

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      data-testid="pbp-modal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="relative w-full max-w-4xl" style={{ background: C.black, borderRadius: 8, overflow: "hidden", border: `1px solid rgba(255,255,255,0.1)` }}>
        {/* Top chrome */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-1 rounded-sm font-accent text-[10px] uppercase tracking-[0.25em]"
              style={{ background: "#c40b1a", color: "#fff" }}
            >
              {labels[idx] || CATEGORY_LABEL[current.category] || current.category}
            </div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "14px", color: C.white, letterSpacing: "0.05em" }}>
              {matchup || `${current.away_team} @ ${current.home_team}`}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.28em", color: C.silver }}>
              {idx + 1} / {total}
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
              data-testid="pbp-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video frame */}
        <div className="relative bg-black aspect-video">
          {/* Progress dots */}
          <div className="absolute top-2 left-0 right-0 px-3 flex items-center gap-1 z-10">
            {clips.map((_, i) => (
              <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${
                i < idx ? "bg-[#1E5BFF]" : i === idx ? "bg-white" : "bg-white/15"
              }`} />
            ))}
          </div>

          {/* YT player mount */}
          <div id={PLAYER_ID} className={`w-full h-full ${transitioning ? "invisible" : ""}`} />

          {/* Poster before first play (mobile autoplay is often blocked) */}
          {!hasStarted && !transitioning && (
            <button
              onClick={() => {
                try { playerRef.current?.playVideo(); } catch { /* noop */ }
                setHasStarted(true);
              }}
              className="absolute inset-0 z-20 group"
              aria-label="Tap to play"
              data-testid="pbp-poster"
            >
              <img src={ytThumb(current.embed_url)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-14 w-14 rounded-full bg-red-600 group-active:bg-red-500 flex items-center justify-center transition-colors"
                      style={{ boxShadow: "0 0 28px -4px rgba(239,68,68,0.9)" }}>
                  <Play className="w-5 h-5 text-white translate-x-[2px]" fill="currentColor" />
                </span>
              </span>
            </button>
          )}

          {/* Bumper */}
          {showBumper && nextClip && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
                 style={{ background: `radial-gradient(ellipse at center, rgba(30,91,255,0.35), ${C.black} 68%)` }}>
              <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 opacity-70"
                   style={{
                     background: `linear-gradient(90deg, transparent 0%, ${C.blue} 40%, ${C.white} 50%, ${C.blue} 60%, transparent 100%)`,
                     animation: "sweep 700ms ease-out both",
                   }} />
              <div className="relative flex flex-col items-center gap-3 z-10"
                   style={{ animation: "bumperIn 500ms cubic-bezier(0.16,1,0.3,1) both" }}>
                <TMark size={100} variant="light" />
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: C.white, letterSpacing: "0.05em" }}>
                  {labels[idx + 1] || CATEGORY_LABEL[nextClip.category] || nextClip.category}
                </div>
              </div>
            </div>
          )}

          {/* Transition scrim */}
          {transitioning && !showBumper && <div className="absolute inset-0 bg-black" />}
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/10">
          <button
            onClick={() => idx > 0 && setIdx((i) => i - 1)}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/15 hover:border-white/40 disabled:opacity-30 font-accent text-[10px] uppercase tracking-widest transition-colors"
            data-testid="pbp-prev"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            onClick={advance}
            disabled={idx >= total - 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/15 hover:border-white/40 disabled:opacity-30 font-accent text-[10px] uppercase tracking-widest transition-colors"
            data-testid="pbp-next"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <style>{`
          @keyframes bumperIn { 0% {opacity:0; transform:scale(.62);} 55% {opacity:1; transform:scale(1.08);} 100% {opacity:1; transform:scale(1);} }
          @keyframes sweep { 0% {transform:translateX(-100%) translateY(-50%); opacity:0;} 40% {opacity:1;} 100% {transform:translateX(100%) translateY(-50%); opacity:0;} }
        `}</style>
      </div>
    </div>
  );
}
