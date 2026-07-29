import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import TwoHostDesk, { resolveShot } from "@/components/TwoHostDesk";
import { ANALYSTS, TEST_IDS } from "@/lib/config";
import { BACKEND_URL, api } from "@/lib/api";
import { useBroadcast, BROADCAST_SLOT_ID } from "@/lib/broadcastContext";
import { playTickerSting } from "@/lib/sting";
import { Volume2, VolumeX, PlayCircle, PauseCircle, ExternalLink } from "lucide-react";

// ---- Timing ----
const DEFAULT_OVERLAP_MS = 400;
const END_OF_TOPIC_GAP_MS = 320;
const PACE_MS = {
  cutoff: -700, quick: -500, relaxed: -400, beat: 60, land: 180, breath: 320,
};

function paceGapMs(paceKey, isInterrupt) {
  if (isInterrupt) return -700;
  if (paceKey && PACE_MS[paceKey] !== undefined) return PACE_MS[paceKey];
  return -DEFAULT_OVERLAP_MS;
}

function playStinger(audioCtx, gain = 0.12) {
  playTickerSting(audioCtx, gain);
}

// LiveDesk owns the audio elements + playback loop for the whole app.
// Mounted ONCE inside Layout (via BroadcastProvider) so navigation never
// unmounts the <audio> tags — the show keeps playing while users hop
// between Stats / Matchups / Predict / Recaps.
//
// Render modes:
//   • FULL — portaled into a <div id="broadcast-slot" /> on the Home page.
//   • MINI — sticky bottom-of-viewport bar on every other route, with
//            play/pause + mute + "Return to broadcast" link.
export default function LiveDesk({ autoFlow = true }) {
  const { topics, activeTopic, setActiveTopic } = useBroadcast();
  const location = useLocation();
  const navigate = useNavigate();

  const [turns, setTurns] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentShot, setCurrentShot] = useState("side_two_shot");
  const [turnIdx, setTurnIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const audioRef = useRef(null);
  const audioRefB = useRef(null);
  const audioCtxRef = useRef(null);
  const unlockAudioRef = useRef(() => {});
  const advancedRef = useRef(new Set());

  const [slotEl, setSlotEl] = useState(null);
  // Predict Show now lives at /show. Landing (/) is the Recap Show, which
  // owns its own audio flow — the persistent Predict player is paused there.
  const isHome = location.pathname === "/show";

  // Routes where the persistent Predict Show competes with something else.
  // Recap Show (/) has its own audio flow — pause the Predict-show mini-bar.
  // Presser (/press-conference) and Back Office are 1-on-1/settings flows.
  const QUIET_ROUTES = ["/press-conference", "/back-office", "/"];
  const isQuietRoute =
    location.pathname === "/" ||
    QUIET_ROUTES.filter((r) => r !== "/").some((r) => location.pathname.startsWith(r));

  // Auto-pause when the user walks into a "quiet" route (Presser, Back
  // Office, Recap Show landing). Auto-RESUME the moment the user arrives
  // at /show — that's the home of the Predict Show, they came here to
  // listen. Elsewhere (Stats, Predict, etc.) we honor whatever state the
  // pause button last set.
  useEffect(() => {
    if (isQuietRoute) {
      setPaused(true);
      audioRef.current?.pause();
      audioRefB.current?.pause();
    } else if (location.pathname === "/show") {
      setPaused(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Track the Home broadcast slot — appears when Home mounts, disappears
  // when user leaves. We portal the full frame into it; when it goes away
  // we render the mini bar in Layout's flow.
  useEffect(() => {
    if (!isHome) {
      setSlotEl(null);
      return;
    }
    // Wait one tick so Home has committed its DOM.
    const raf = requestAnimationFrame(() => {
      setSlotEl(document.getElementById(BROADCAST_SLOT_ID));
    });
    return () => cancelAnimationFrame(raf);
  }, [isHome, location.pathname]);

  // Load banter whenever active topic changes.
  useEffect(() => {
    if (!activeTopic) return;
    let mounted = true;
    (async () => {
      setTurns([]);
      setTurnIdx(0);
      setCurrentSpeaker(null);
      setCurrentShot("side_two_shot");
      advancedRef.current = new Set();
      if (audioRef.current) audioRef.current.pause();
      if (audioRefB.current) audioRefB.current.pause();
      if (audioUnlocked && !muted && audioCtxRef.current) {
        playStinger(audioCtxRef.current, 0.36);
      }
      try {
        const r = await api.get(`/banter?topic=${encodeURIComponent(activeTopic)}`);
        if (mounted) setTurns(r.data.turns || []);
      } catch (e) {
        console.error("banter load failed", e);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic]);

  useEffect(() => {
    if (audioUnlocked) return;
    const onFirst = () => unlockAudioRef.current?.();
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, [audioUnlocked]);

  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      const el = audioRef.current;
      if (el) {
        el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
        const p = el.play();
        if (p && typeof p.then === "function") {
          p.then(() => { el.pause(); el.currentTime = 0; }).catch(() => {});
        }
      }
      if (audioCtxRef.current) playStinger(audioCtxRef.current, 0.42);
      setAudioUnlocked(true);
    } catch (e) {
      console.warn("audio unlock failed", e);
    }
  }, [audioUnlocked]);

  useEffect(() => { unlockAudioRef.current = unlockAudio; }, [unlockAudio]);

  // Playback loop.
  useEffect(() => {
    if (!turns.length) return;

    if (turnIdx >= turns.length) {
      setCurrentSpeaker(null);
      setCurrentShot("two_neutral_open");
      if (autoFlow && topics.length > 0 && activeTopic) {
        const currIdx = topics.findIndex((t) => t.id === activeTopic);
        const nextIdx = currIdx >= 0 && currIdx < topics.length - 1 ? currIdx + 1 : 0;
        const nextId = topics[nextIdx]?.id;
        if (nextId && nextId !== activeTopic) {
          const t = setTimeout(() => setActiveTopic(nextId), END_OF_TOPIC_GAP_MS);
          return () => clearTimeout(t);
        }
      }
      return;
    }

    if (paused) return;

    const turn = turns[turnIdx];
    setCurrentSpeaker(turn.speaker);
    setCurrentShot(resolveShot({ shot: turn.shot, speaker: turn.speaker }));

    let advanced = false;
    let handoff = null;
    const advance = (delayMs = 0) => {
      if (advanced || advancedRef.current.has(turnIdx)) return;
      advanced = true;
      advancedRef.current.add(turnIdx);
      handoff = setTimeout(() => setTurnIdx((i) => i + 1), Math.max(0, delayMs));
    };

    if (!audioUnlocked || muted || !turn.audio_url) {
      const t = setTimeout(() => advance(0), Math.max(1000, turn.text.length * 45));
      return () => clearTimeout(t);
    }

    const isEven = turnIdx % 2 === 0;
    const el = isEven ? audioRef.current : audioRefB.current;
    const otherEl = isEven ? audioRefB.current : audioRef.current;
    if (!el) return;

    const url = `${BACKEND_URL}${turn.audio_url}`;
    if (el.src !== url) el.src = url;
    try { el.currentTime = 0; } catch {}

    const next = turns[turnIdx + 1];
    if (next?.audio_url && otherEl) {
      const nextUrl = `${BACKEND_URL}${next.audio_url}`;
      if (otherEl.src !== nextUrl) {
        otherEl.src = nextUrl;
        try { otherEl.load(); } catch {}
      }
    }

    const gap = next ? paceGapMs(next.pace, next.interrupt) : 200;

    el.onended = () => advance(Math.max(0, gap));
    el.onerror = () => { console.warn("audio failed for", turn.audio_url); advance(300); };
    el.ontimeupdate = () => {
      if (advanced || gap >= 0) return;
      if (!el.duration || !isFinite(el.duration)) return;
      const earlySec = Math.abs(gap) / 1000;
      if (el.duration - el.currentTime <= earlySec) advance(0);
    };

    el.play().catch((err) => { console.warn("play() rejected", err); advance(200); });

    return () => {
      if (handoff) clearTimeout(handoff);
      el.onended = null;
      el.onerror = null;
      el.ontimeupdate = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, turnIdx, audioUnlocked, muted, paused, autoFlow, topics, activeTopic]);

  useEffect(() => {
    if (muted) {
      audioRef.current?.pause();
      audioRefB.current?.pause();
    }
  }, [muted]);

  const speakerAccent = currentSpeaker ? ANALYSTS[currentSpeaker]?.accent : "#1e5dff";
  const speakerName = currentSpeaker ? ANALYSTS[currentSpeaker]?.short : null;
  const activeTopicLabel =
    topics.find((t) => t.id === activeTopic)?.label || "Live from the desk";

  // Shared audio elements — always in the tree, never unmount.
  const AudioTags = (
    <>
      <audio ref={audioRef} preload="auto" playsInline />
      <audio ref={audioRefB} preload="auto" playsInline />
    </>
  );

  const controls = (
    <>
      <button
        onClick={() => setPaused((p) => !p)}
        data-testid="desk-play-toggle"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 font-accent text-[11px] uppercase tracking-widest transition-colors"
        title={paused ? "Resume broadcast" : "Pause broadcast"}
      >
        {paused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        onClick={() => setMuted((m) => !m)}
        data-testid={TEST_IDS.desk.muteBtn}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 font-accent text-[11px] uppercase tracking-widest transition-colors"
        title={muted ? "Unmute the desk" : "Mute the desk"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        {muted ? "Muted" : "Sound On"}
      </button>
    </>
  );

  const fullFrame = (
    <section className="relative">
      {/* Slim control strip — topic label left, playback + mute right */}
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="h-2 w-2 rounded-full bg-red-500 live-pulse flex-shrink-0" />
          <div className="font-accent text-[10px] uppercase tracking-[0.4em] text-white/50 flex-shrink-0">
            Now
          </div>
          <div className="font-headline text-white text-lg sm:text-xl truncate" data-testid="desk-active-topic">
            {activeTopicLabel}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">{controls}</div>
      </div>

      <div
        data-testid={TEST_IDS.desk.shotFrame}
        className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11]"
      >
        <TwoHostDesk
          shot={currentShot}
          speaker={currentSpeaker}
          speaking={!!currentSpeaker && audioUnlocked && !muted && !paused}
        />

        {!audioUnlocked && (
          <button
            type="button"
            onClick={() => unlockAudio()}
            data-testid="tap-to-start"
            className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer group"
            style={{
              background: "radial-gradient(circle at 50% 50%, rgba(5,7,15,0.65) 0%, rgba(5,7,15,0.92) 100%)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div className="flex flex-col items-center gap-3 text-center transition-transform duration-500 group-hover:scale-105">
              <div className="flex items-center gap-2 font-accent text-xs uppercase tracking-[0.4em] text-white/60">
                <span className="h-2 w-2 rounded-full bg-red-500 live-pulse" />
                On Air
              </div>
              <h2
                className="font-headline text-4xl sm:text-5xl lg:text-6xl text-white"
                style={{ textShadow: "0 0 40px rgba(30,93,255,0.7)" }}
              >
                Tap to join<br />the broadcast.
              </h2>
              <div className="mt-2 font-accent text-[11px] uppercase tracking-[0.3em] text-white/45">
                Sound comes on. Reggie & Marc are already talking.
              </div>
            </div>
          </button>
        )}

        {currentSpeaker && audioUnlocked && (
          <div
            className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md border transition-opacity duration-300"
            style={{ background: "rgba(5,7,15,0.55)", borderColor: speakerAccent + "88" }}
            data-testid={TEST_IDS.desk.lowerThird}
          >
            <span className="h-2 w-2 rounded-full live-pulse" style={{ background: speakerAccent }} />
            <span className="font-accent text-[11px] uppercase tracking-widest text-white/90">
              {speakerName}
            </span>
          </div>
        )}
      </div>
    </section>
  );

  const miniBar = (
    <div
      data-testid="broadcast-mini-bar"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#2d2d35] bg-[#0b0b10]/95 backdrop-blur-md"
      style={{ boxShadow: "0 -8px 24px -8px rgba(0,0,0,0.6)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate("/")}
          data-testid="broadcast-mini-return"
          className="flex items-center gap-2.5 min-w-0 group"
          title="Return to the broadcast"
        >
          <div className="relative h-9 w-9 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
               style={{ background: speakerAccent + "22", border: `1px solid ${speakerAccent}66` }}>
            {audioUnlocked && !paused && !muted && currentSpeaker ? (
              <span className="absolute inset-0 flex items-end justify-center gap-0.5 pb-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-sm live-pulse"
                    style={{
                      height: `${8 + i * 3}px`,
                      background: speakerAccent,
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </span>
            ) : (
              <PlayCircle className="w-4 h-4" style={{ color: speakerAccent }} />
            )}
          </div>
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-accent text-[9px] uppercase tracking-[0.3em] text-[#1e5dff]">
                On Air
              </span>
              {speakerName && (
                <span className="font-accent text-[9px] uppercase tracking-widest text-white/50">
                  · {speakerName}
                </span>
              )}
            </div>
            <div className="text-white text-sm font-headline leading-tight truncate max-w-[220px] sm:max-w-[360px]">
              {activeTopicLabel}
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 transition-colors" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 flex-shrink-0">{controls}</div>
      </div>
    </div>
  );

  // Portal the full frame into Home's slot when available; otherwise render
  // the mini bar in Layout's flow — unless we're on a "quiet" route (Presser,
  // Back Office) where the show would compete with the current experience.
  return (
    <>
      {AudioTags}
      {slotEl ? createPortal(fullFrame, slotEl) : (isQuietRoute ? null : miniBar)}
    </>
  );
}
