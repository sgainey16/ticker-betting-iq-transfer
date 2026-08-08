// ShowOpener — the "network is alive" heartbeat.
// -----------------------------------------------------------------------------
// A short, structured welcome that auto-plays once per session per page when
// the user arrives on Tonight or Recap. After the opener finishes, the show
// goes quiet and the tile rail takes over. Users can tap any tile to open a
// per-game deep-dive with its own segment.
//
// Today the opener uses a fixed text chyron that scrolls through beats. When
// real per-day ElevenLabs opener audio is generated it will slot in via the
// audioSrc prop. The visual + timing is unchanged — we just add sound.

import { useEffect, useRef, useState } from "react";
import { Radio, Play, Pause, X } from "lucide-react";
import { emitSignal } from "@/lib/signals";

// Session-scoped remember-me so the opener doesn't replay on every route
// change. Cleared when the tab closes — a fresh session gets a fresh open.
function sessionSeen(key) {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(key) === "1"; } catch { return false; }
}
function markSeen(key) {
  try { window.sessionStorage.setItem(key, "1"); } catch {}
}

export function ShowOpener({
  variant,                 // "tonight" | "recap"
  autoStart = true,        // set false to require a manual tap
  audioSrc,                // future ElevenLabs mp3; null → visual-only for now
  onFinish,                // callback when opener completes
  sessionKey,              // storage key so opener plays once per session
}) {
  const beats = variant === "recap" ? RECAP_BEATS : TONIGHT_BEATS;
  const [beatIdx, setBeatIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const audioRef = useRef(null);
  const tickRef = useRef(null);

  // Auto-start once per session on mount
  useEffect(() => {
    if (!autoStart || sessionSeen(sessionKey)) return;
    setPlaying(true);
    emitSignal({ kind: "show_opener_start", league: "NHL", target: variant, weight: 0.5 });
    markSeen(sessionKey);
  }, [autoStart, sessionKey, variant]);

  // Beat cycling — each beat holds for its own duration. When we hit the
  // last beat we call onFinish and stop.
  useEffect(() => {
    if (!playing) return;
    const beat = beats[beatIdx];
    if (!beat) return;
    tickRef.current = setTimeout(() => {
      if (beatIdx + 1 >= beats.length) {
        setPlaying(false);
        emitSignal({ kind: "show_opener_finish", league: "NHL", target: variant, weight: 0.7 });
        onFinish?.();
      } else {
        setBeatIdx(i => i + 1);
      }
    }, beat.ms);
    return () => clearTimeout(tickRef.current);
  }, [playing, beatIdx, beats, variant, onFinish]);

  // Real audio hook — no-op when audioSrc is null (visual-only mode)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.play().catch(() => {}); }
    else { el.pause(); }
  }, [playing]);

  if (dismissed) return null;

  const beat = beats[beatIdx];

  return (
    <div
      data-testid={`show-opener-${variant}`}
      className="relative rounded-xl border border-[#F58220]/25 bg-gradient-to-r from-[#F58220]/[0.08] via-black/40 to-black/40 p-4 overflow-hidden"
    >
      {/* subtle glow */}
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: "radial-gradient(ellipse at left, rgba(245,130,32,0.16) 0%, transparent 55%)" }} />

      <div className="relative flex items-center gap-3">
        <button
          onClick={() => setPlaying(p => !p)}
          data-testid={`show-opener-toggle-${variant}`}
          className="h-11 w-11 rounded-full bg-[#F58220] hover:bg-[#ff9042] flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {playing
            ? <Pause className="w-4 h-4 text-black" />
            : <Play className="w-4 h-4 text-black ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Radio className={`w-3 h-3 ${playing ? "text-red-400 live-pulse" : "text-white/40"}`} />
            <span style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: playing ? "#ef4444" : "#a0a0a5" }}>
              {playing ? "ON AIR · REGGIE & MARC" : "READY WHEN YOU ARE"}
            </span>
          </div>
          <div className="mt-0.5 transition-opacity" key={beatIdx}
               style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#fff", lineHeight: 1.3, opacity: playing ? 1 : 0.7 }}>
            {beat?.text || (variant === "recap" ? "Highlights of the night — one tight room." : "Read the room before you make your call.")}
          </div>
        </div>

        <button
          onClick={() => { setPlaying(false); setDismissed(true); }}
          data-testid={`show-opener-dismiss-${variant}`}
          className="h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/8 flex-shrink-0"
          aria-label="Dismiss opener"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress hairline */}
      <div className="relative mt-3 h-0.5 bg-white/6 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#F58220] transition-all"
          style={{ width: `${((beatIdx + (playing ? 1 : 0)) / beats.length) * 100}%`, transitionDuration: `${beat?.ms || 0}ms` }}
        />
      </div>

      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="auto" />}
    </div>
  );
}

// Placeholder scripts — real ElevenLabs audio replaces these copy strings
// once we generate daily openers. Each beat holds for its own duration.
const TONIGHT_BEATS = [
  { text: "Marc's here, I'm here — welcome to Tonight on The Ticker.", ms: 3800 },
  { text: "We've got the whole night laid out for you — one tile per game.",  ms: 3800 },
  { text: "Read the room, look at the numbers, then make your call — the panel's picks are already in.", ms: 4600 },
  { text: "Tap a game when you're ready. We'll break it down when you get there.",                       ms: 4200 },
];

const RECAP_BEATS = [
  { text: "Welcome back — Reggie and Marc, one tight room, everything you missed.",  ms: 4200 },
  { text: "We picked the games that mattered and cut the rest.",                     ms: 3600 },
  { text: "Tap any tile below to hear us break down that game — highlight, key stat, honest read.", ms: 4600 },
  { text: "Or say the word and we'll play the full highlight package for you.",     ms: 4000 },
];
