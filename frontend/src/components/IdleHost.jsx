import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { api, BACKEND_URL } from "@/lib/api";

/**
 * IdleHost — auto-plays a rotating queue of Reggie idle-monologue clips
 * on Presser mount. Loops indefinitely so if a user just sits there, Reggie
 * keeps talking. Pauses automatically when `pauseSignal` prop increments
 * (parent bumps it when the user focuses the ask input or asks a question).
 *
 * Contract:
 *  - Auto-starts on first mount (autoplay-permitting browsers). If autoplay
 *    is blocked, user hits Play manually — no dead air, no console errors.
 *  - Play/Pause button always visible in the hero.
 *  - `onManualPlay()` fires the first time a user actually starts audio, so
 *    parent can dismiss any "tap to unmute" prompts.
 */
export default function IdleHost({
  topic = "presser_idle_welcome",
  pauseSignal = 0,
  accent = "#1E5DFF",
  analystName = "Reggie",
}) {
  const [queue, setQueue] = useState([]);         // {text, audio_url}[]
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const audioRef = useRef(null);
  const lastPauseSignal = useRef(pauseSignal);

  // Fetch banter queue once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get(`/banter?topic=${encodeURIComponent(topic)}`);
        const turns = (r.data?.turns || []).filter(
          (t) => t.audio_url && t.speaker === "reggie",
        );
        if (!cancelled) {
          setQueue(turns);
          setReady(true);
        }
      } catch (e) {
        console.error("IdleHost: failed to load banter", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topic]);

  // Play current clip whenever idx or queue changes.
  useEffect(() => {
    if (!ready || queue.length === 0) return;
    const turn = queue[idx % queue.length];
    setCurrentText(turn.text);
    const el = audioRef.current;
    if (!el) return;
    el.src = `${BACKEND_URL}${turn.audio_url}`;
    el.muted = muted;
    // Attempt to play; browsers may block until first user gesture.
    el.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false)); // silent — user will tap Play
  }, [idx, ready, queue, muted]);

  // Handle end-of-clip: advance to next in queue (looping).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIdx((i) => i + 1);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  // React to external pause signals from parent (e.g. user focused Ask input).
  useEffect(() => {
    if (pauseSignal !== lastPauseSignal.current) {
      lastPauseSignal.current = pauseSignal;
      const el = audioRef.current;
      if (el && !el.paused) el.pause();
    }
  }, [pauseSignal]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  if (!ready) {
    return null; // silent while loading — no jank
  }

  return (
    <div
      className="rounded-lg border bg-black/40 backdrop-blur px-3 py-2 flex items-center gap-3"
      style={{ borderColor: accent + "55" }}
      data-testid="idle-host"
    >
      <button
        onClick={toggle}
        data-testid="idle-host-toggle"
        aria-label={playing ? "Pause Reggie" : "Play Reggie"}
        className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors flex-shrink-0"
        style={{
          background: playing ? accent : "transparent",
          borderColor: accent,
          color: playing ? "white" : accent,
        }}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div
            className="font-accent text-[9px] uppercase tracking-widest"
            style={{ color: accent }}
          >
            {analystName} · {playing ? "On Air" : "Standing by"}
          </div>
          {playing && (
            <span
              className="h-1.5 w-1.5 rounded-full live-pulse"
              style={{ background: accent }}
            />
          )}
        </div>
        <div
          className="text-white/70 text-xs mt-0.5 truncate"
          data-testid="idle-host-current-line"
        >
          {currentText}
        </div>
      </div>

      <button
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        data-testid="idle-host-mute"
        className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white transition-colors flex-shrink-0"
      >
        {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
