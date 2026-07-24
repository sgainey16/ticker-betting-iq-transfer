import { useEffect, useRef, useState, useCallback } from "react";
import TwoHostDesk, { resolveShot } from "@/components/TwoHostDesk";
import { ANALYSTS, TEST_IDS } from "@/lib/config";
import { api, BACKEND_URL } from "@/lib/api";
import { Send, Volume2, VolumeX, PlayCircle, PauseCircle } from "lucide-react";
import { playTickerSting } from "@/lib/sting";

// ---- Timing ----
// All gaps are signed milliseconds. NEGATIVE = start the next line early
// (overlap). POSITIVE = wait after the current line ENDS. Defaults are
// aggressive on purpose — the whole point of this show is "no dead air".
const DEFAULT_OVERLAP_MS = 400; // ~0.4s of natural overlap between speakers
const END_OF_TOPIC_GAP_MS = 320; // brief breath between topics in continuous flow
const PACE_MS = {
  cutoff: -700,  // hard interrupt
  quick: -500,   // near-touching debate handoff
  relaxed: -400, // default overlap
  beat: 60,      // tiny pause, almost seamless
  land: 180,     // joke landing
  breath: 320,   // reset / new topic
};

function paceGapMs(paceKey, isInterrupt) {
  if (isInterrupt) return -700;
  if (paceKey && PACE_MS[paceKey] !== undefined) return PACE_MS[paceKey];
  return -DEFAULT_OVERLAP_MS;
}

function playStinger(audioCtx, gain = 0.12) {
  playTickerSting(audioCtx, gain);
}

export default function LiveDesk({
  topics = [],
  activeTopic,
  onTopicChange = () => {},
  autoFlow = true,
}) {
  const [turns, setTurns] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentShot, setCurrentShot] = useState("side_two_shot");
  const [turnIdx, setTurnIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatResponse, setChatResponse] = useState(null);

  const audioRef = useRef(null);
  const audioRefB = useRef(null);
  const chatAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const unlockAudioRef = useRef(() => {});
  const advancedRef = useRef(new Set());

  // Load banter whenever the active topic changes.
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

  // First interaction unlocks audio.
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
        el.src =
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
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

  // Core playback loop — one effect per turn.
  useEffect(() => {
    if (!turns.length) return;

    // End of segment — advance to next topic in continuous flow, or park.
    if (turnIdx >= turns.length) {
      setCurrentSpeaker(null);
      setCurrentShot("two_neutral_open");
      if (autoFlow && topics.length > 0 && activeTopic) {
        const currIdx = topics.findIndex((t) => t.id === activeTopic);
        const nextIdx = currIdx >= 0 && currIdx < topics.length - 1 ? currIdx + 1 : 0;
        const nextId = topics[nextIdx]?.id;
        if (nextId && nextId !== activeTopic) {
          const t = setTimeout(() => onTopicChange(nextId), END_OF_TOPIC_GAP_MS);
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

    // Warm up the NEXT turn immediately so the swap is instant.
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
    el.onerror = () => {
      console.warn("audio failed for", turn.audio_url);
      advance(300);
    };
    el.ontimeupdate = () => {
      if (advanced || gap >= 0) return;
      if (!el.duration || !isFinite(el.duration)) return;
      const earlySec = Math.abs(gap) / 1000;
      if (el.duration - el.currentTime <= earlySec) advance(0);
    };

    el.play().catch((err) => {
      console.warn("play() rejected", err);
      advance(200);
    });

    return () => {
      if (handoff) clearTimeout(handoff);
      el.onended = null;
      el.onerror = null;
      el.ontimeupdate = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, turnIdx, audioUnlocked, muted, paused, autoFlow, topics, activeTopic]);

  // Mute toggle should pause both audio elements immediately.
  useEffect(() => {
    if (muted) {
      audioRef.current?.pause();
      audioRefB.current?.pause();
    }
  }, [muted]);

  async function submitTopic() {
    const t = chatInput.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    setChatResponse(null);
    try {
      const r = await api.post("/banter/quick-reply", { topic: t });
      setChatResponse(r.data);
      setChatInput("");
      if (r.data.analyst_id === "reggie") setCurrentShot("reggie_pointing");
      else if (r.data.analyst_id === "marc") setCurrentShot("marc_analyzing_stats");
      if (audioUnlocked && !muted && r.data.audio_url && chatAudioRef.current) {
        chatAudioRef.current.src = `${BACKEND_URL}${r.data.audio_url}`;
        chatAudioRef.current.play().catch(() => {});
      }
    } catch (e) {
      setChatResponse({
        analyst_id: "reggie",
        text: "Signal lost from the desk. Try again.",
      });
    } finally {
      setChatBusy(false);
    }
  }

  const speakerAccent = currentSpeaker ? ANALYSTS[currentSpeaker]?.accent : "#1e5dff";
  const speakerName = currentSpeaker ? ANALYSTS[currentSpeaker]?.short : null;
  const activeTopicLabel =
    topics.find((t) => t.id === activeTopic)?.label || "Live from the desk";

  return (
    <section className="relative">
      <audio ref={audioRef} preload="auto" playsInline />
      <audio ref={audioRefB} preload="auto" playsInline />
      <audio ref={chatAudioRef} preload="auto" playsInline />

      {/* Slim control strip — topic label left, playback + mute right */}
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="h-2 w-2 rounded-full bg-red-500 live-pulse flex-shrink-0" />
          <div className="font-accent text-[10px] uppercase tracking-[0.4em] text-white/50 flex-shrink-0">
            Now
          </div>
          <div
            className="font-headline text-white text-lg sm:text-xl truncate"
            data-testid="desk-active-topic"
          >
            {activeTopicLabel}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
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
        </div>
      </div>

      {/* Broadcast frame */}
      <div
        data-testid={TEST_IDS.desk.shotFrame}
        className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11]"
      >
        <TwoHostDesk
          shot={currentShot}
          speaker={currentSpeaker}
          speaking={!!currentSpeaker && audioUnlocked && !muted && !paused}
        />

        {/* Full-frame Tap-to-Start overlay */}
        {!audioUnlocked && (
          <button
            type="button"
            onClick={() => unlockAudio()}
            data-testid="tap-to-start"
            className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer group"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(5,7,15,0.65) 0%, rgba(5,7,15,0.92) 100%)",
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

        {/* Minimal speaker badge — no more chunky lower-third */}
        {currentSpeaker && audioUnlocked && (
          <div
            className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md border transition-opacity duration-300"
            style={{
              background: "rgba(5,7,15,0.55)",
              borderColor: speakerAccent + "88",
            }}
            data-testid={TEST_IDS.desk.lowerThird}
          >
            <span
              className="h-2 w-2 rounded-full live-pulse"
              style={{ background: speakerAccent }}
            />
            <span
              className="font-accent text-[11px] uppercase tracking-widest text-white/90"
            >
              {speakerName}
            </span>
          </div>
        )}
      </div>

      {/* Ask-the-panel input */}
      <div
        className={`mt-5 card-surface p-5 transition-all duration-500 ${
          chatOpen ? "opacity-100" : "opacity-70"
        }`}
      >
        <label className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
          Jump in — ask the desk
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitTopic()}
            placeholder="e.g. What's wrong with the Leafs?"
            disabled={chatBusy}
            data-testid={TEST_IDS.desk.topicInput}
            className="flex-1 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={() => { unlockAudio(); submitTopic(); }}
            disabled={chatBusy || !chatInput.trim()}
            data-testid={TEST_IDS.desk.topicSubmit}
            className="h-[48px] px-5 rounded-lg bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-40 disabled:cursor-not-allowed text-white font-accent uppercase tracking-widest text-sm inline-flex items-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            Toss it in
          </button>
        </div>

        {chatBusy && (
          <div className="mt-3 text-white/50 text-sm font-accent uppercase tracking-widest">
            Someone at the desk is jumping in…
          </div>
        )}

        {chatResponse && (
          <div
            className="mt-3 rounded-lg border p-4 flex items-start gap-3"
            style={{
              borderColor: (ANALYSTS[chatResponse.analyst_id]?.accent || "#2d2d35") + "77",
              background: "#0b0b10",
            }}
            data-testid={TEST_IDS.desk.quickReply}
          >
            <span
              className="h-2.5 w-2.5 mt-2 rounded-full live-pulse flex-shrink-0"
              style={{ background: ANALYSTS[chatResponse.analyst_id]?.accent }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="font-accent text-[11px] uppercase tracking-widest"
                style={{ color: ANALYSTS[chatResponse.analyst_id]?.accent }}
              >
                {ANALYSTS[chatResponse.analyst_id]?.role}
              </div>
              <div className="text-white/85 text-sm mt-1 leading-relaxed">
                {chatResponse.text}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
