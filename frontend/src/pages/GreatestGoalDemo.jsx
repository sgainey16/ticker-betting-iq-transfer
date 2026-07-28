import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

// The Ticker — Recap format demo built on Ovechkin's "impossible goal" (Jan 2006, Phoenix).
// Video plays with original broadcast audio ducked to ~18%. Reggie + Marc
// commentary layers on top at 100%. Static two-track approach (no ffmpeg
// available server-side) — proves the format cleanly.
//
// Timeline is tuned by hand for the specific screen recording the user uploaded.
// If the clip changes, re-tune the `startAt` seconds below.

const COMMENTARY = [
  { speaker: "reggie", startAt: 0.5,  file: "/api/audio/reggie_5becef82c7fcc62e4cc1.mp3" },
  { speaker: "marc",   startAt: 13.5, file: "/api/audio/marc_308b5b94eb72bdba3f05.mp3" },
  { speaker: "reggie", startAt: 24.0, file: "/api/audio/reggie_deab2a2536d6cd146272.mp3" },
  { speaker: "marc",   startAt: 33.5, file: "/api/audio/marc_125d76651dc0fdb84c4a.mp3" },
  // Peak-moment gap — let the video/crowd carry the goal itself here.
  { speaker: "reggie", startAt: 48.0, file: "/api/audio/reggie_735bf2e3f2401952a9c3.mp3" },
  { speaker: "marc",   startAt: 57.0, file: "/api/audio/marc_ede4d76fa2c0405b3827.mp3" },
  { speaker: "reggie", startAt: 66.0, file: "/api/audio/reggie_5530318a948c4be5187f.mp3" },
];

const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
const VIDEO_DUCK = 0.18;   // video audio while hosts talking
const VIDEO_PEAK = 1.0;    // video audio during the goal moment
const HOST_VOL   = 1.0;

export default function GreatestGoalDemo() {
  const videoRef = useRef(null);
  const audioRefs = useRef([]);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(null); // speaker currently talking

  // Sync commentary to the video's currentTime.
  useEffect(() => {
    if (!started) return;
    const v = videoRef.current;
    if (!v) return;

    const tick = () => {
      const t = v.currentTime;
      let active = null;
      COMMENTARY.forEach((c, i) => {
        const el = audioRefs.current[i];
        if (!el) return;
        // If we're inside the audio's speaking window, play it. Otherwise pause.
        const audioEnd = c.startAt + (el.duration || 8);
        if (t >= c.startAt && t < audioEnd) {
          if (el.paused) {
            el.currentTime = Math.max(0, t - c.startAt);
            el.volume = HOST_VOL;
            el.play().catch(() => {});
          }
          active = c.speaker;
        } else {
          if (!el.paused) el.pause();
        }
      });
      // Duck the video's audio while a host is talking; open it up during peak.
      v.volume = active ? VIDEO_DUCK : VIDEO_PEAK;
      setCurrent(active);
    };

    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, [started]);

  const start = async () => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = VIDEO_PEAK;
    try {
      await v.play();
      setStarted(true);
    } catch (e) {
      // browser blocked autoplay — user needs to tap the video directly
    }
  };

  const stop = () => {
    videoRef.current?.pause();
    audioRefs.current.forEach((a) => a && a.pause());
    setStarted(false);
    setCurrent(null);
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white p-6" data-testid="greatest-goal-demo">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="space-y-1">
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-white/50">
            The Ticker · Recap demo
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl">
            Ovi's Impossible Goal · Phoenix 2006
          </h1>
          <div className="text-white/60 text-sm">
            Reggie &amp; Marc reacting live · original broadcast audio underneath
          </div>
        </header>

        <div className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-black shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
          <video
            ref={videoRef}
            src="/greatest-goal.mp4"
            playsInline
            controls={started}
            className="w-full h-auto block"
            onEnded={stop}
            data-testid="demo-video"
          />
          {/* Lower-third talking indicator */}
          {current && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur bg-black/50 border border-white/20">
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ background: current === "reggie" ? "#1e5dff" : "#00e5ff" }}
              />
              <span className="font-accent text-[10px] uppercase tracking-widest text-white/85">
                {current === "reggie" ? "Reggie Banks" : "Marc Collins"}
              </span>
            </div>
          )}
          {/* Start overlay */}
          {!started && (
            <button
              onClick={start}
              data-testid="demo-start"
              className="absolute inset-0 flex items-center justify-center bg-black/60 hover:bg-black/50 transition-colors group"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-20 w-20 rounded-full bg-[#1e5dff] flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_10px_40px_rgba(30,93,255,0.6)]">
                  <Play className="w-9 h-9 text-white fill-white ml-1" />
                </div>
                <div className="font-accent text-[11px] uppercase tracking-widest text-white/80">
                  Tap to start · Reggie &amp; Marc call the play
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Hidden commentary audio elements */}
        {COMMENTARY.map((c, i) => (
          <audio
            key={i}
            ref={(el) => (audioRefs.current[i] = el)}
            src={`${BACKEND}${c.file}`}
            preload="auto"
          />
        ))}

        {started && (
          <button
            onClick={stop}
            data-testid="demo-stop"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/80 font-accent text-[11px] uppercase tracking-widest"
          >
            <Pause className="w-3.5 h-3.5" /> Stop
          </button>
        )}

        <div className="pt-4 text-xs text-white/40 font-accent uppercase tracking-widest">
          Internal demo · not for public sharing · commentary auto-generated
        </div>
      </div>
    </div>
  );
}
