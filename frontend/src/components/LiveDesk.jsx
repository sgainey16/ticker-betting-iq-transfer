import { useEffect, useRef, useState, useCallback } from "react";
import TwoHostDesk, { resolveShot } from "@/components/TwoHostDesk";
import { ANALYSTS, TEST_IDS } from "@/lib/config";
import { api, BACKEND_URL } from "@/lib/api";
import { Send, Volume2, VolumeX } from "lucide-react";

const PAUSE_BETWEEN_TURNS = 0;
const INTERRUPT_START_EARLY_MS = 1100; // hard cut-in
const NORMAL_OVERLAP_MS = 500; // compensate for the mp3 lead-in silence + browser overhead

function playStinger(audioCtx, gain = 0.12) {
  try {
    const now = audioCtx.currentTime;
    const notes = [
      { f: 261.63, t: now + 0.0, d: 0.14 },
      { f: 523.25, t: now + 0.12, d: 0.22 },
    ];
    for (const n of notes) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = n.f;
      g.gain.setValueAtTime(0.0001, n.t);
      g.gain.exponentialRampToValueAtTime(gain, n.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, n.t + n.d);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(n.t);
      osc.stop(n.t + n.d + 0.02);
    }
  } catch (e) {
    console.warn("stinger failed", e);
  }
}

export default function LiveDesk() {
  const [topics, setTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState("league_wide");
  const [turns, setTurns] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [currentShot, setCurrentShot] = useState("two_neutral_open");
  const [turnIdx, setTurnIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatResponse, setChatResponse] = useState(null);
  const audioRef = useRef(null);
  const audioRefB = useRef(null);
  const chatAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const pushedRef = useRef(new Set());
  const unlockAudioRef = useRef(() => {});

  // Load topics once.
  useEffect(() => {
    api
      .get("/topics")
      .then((r) => setTopics(r.data.topics || []))
      .catch(() => setTopics([]));
  }, []);

  // Load banter whenever the topic changes.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setTurns([]);
      setTurnIdx(0);
      setCurrentSpeaker(null);
      setCurrentShot("two_neutral_open");
      pushedRef.current = new Set();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      try {
        const r = await api.get(`/banter?topic=${encodeURIComponent(activeTopic)}`);
        if (mounted) setTurns(r.data.turns || []);
      } catch (e) {
        console.error("banter load failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeTopic]);

  // First interaction anywhere unlocks audio.
  useEffect(() => {
    if (audioUnlocked) return;
    const onFirstInteract = () => {
      unlockAudioRef.current?.();
    };
    window.addEventListener("pointerdown", onFirstInteract, { once: true });
    window.addEventListener("keydown", onFirstInteract, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstInteract);
      window.removeEventListener("keydown", onFirstInteract);
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
          p.then(() => {
            el.pause();
            el.currentTime = 0;
          }).catch(() => {});
        }
      }
      if (audioCtxRef.current) playStinger(audioCtxRef.current, 0.14);
      setAudioUnlocked(true);
    } catch (e) {
      console.warn("audio unlock failed", e);
    }
  }, [audioUnlocked]);

  useEffect(() => {
    unlockAudioRef.current = unlockAudio;
  }, [unlockAudio]);

  // Play current turn — camera cut happens BEFORE the audio starts.
  useEffect(() => {
    if (!turns.length) return;
    if (turnIdx >= turns.length) {
      setCurrentSpeaker(null);
      setCurrentShot("two_neutral_open");
      setChatOpen(true);
      return;
    }
    const turn = turns[turnIdx];
    setCurrentSpeaker(turn.speaker);
    setCurrentShot(resolveShot({ shot: turn.shot, speaker: turn.speaker }));

    let cancelled = false;
    let handoff = null;

    const advance = () => {
      if (cancelled) return;
      if (!pushedRef.current.has(turnIdx)) {
        pushedRef.current.add(turnIdx);
        handoff = setTimeout(() => {
          if (!cancelled) setTurnIdx((x) => x + 1);
        }, PAUSE_BETWEEN_TURNS);
      }
    };

    if (audioUnlocked && !muted && turn.audio_url) {
      const el = turnIdx % 2 === 0 ? audioRef.current : audioRefB.current;
      const otherEl = turnIdx % 2 === 0 ? audioRefB.current : audioRef.current;
      if (el) {
        el.src = `${BACKEND_URL}${turn.audio_url}`;
        el.currentTime = 0;

        let advanceScheduled = false;
        const scheduleAdvance = (delayMs = PAUSE_BETWEEN_TURNS) => {
          if (advanceScheduled || cancelled) return;
          if (pushedRef.current.has(turnIdx)) return;
          pushedRef.current.add(turnIdx);
          advanceScheduled = true;
          handoff = setTimeout(() => {
            if (!cancelled) setTurnIdx((x) => x + 1);
          }, Math.max(0, delayMs));
        };

        el.onended = () => scheduleAdvance(PAUSE_BETWEEN_TURNS);
        el.onerror = () => {
          console.warn("audio failed for", turn.audio_url);
          scheduleAdvance(Math.max(1200, turn.text.length * 55));
        };

        const nextTurn = turns[turnIdx + 1];
        if (nextTurn && nextTurn.audio_url && otherEl) {
          otherEl.src = `${BACKEND_URL}${nextTurn.audio_url}`;
          otherEl.load();
        }

        const earlyMs =
          nextTurn && nextTurn.interrupt ? INTERRUPT_START_EARLY_MS : NORMAL_OVERLAP_MS;
        if (nextTurn) {
          el.ontimeupdate = () => {
            if (
              !advanceScheduled &&
              el.duration &&
              isFinite(el.duration) &&
              el.duration - el.currentTime <= earlyMs / 1000
            ) {
              scheduleAdvance(0);
            }
          };
        } else {
          el.ontimeupdate = null;
        }

        el.play().catch((err) => {
          console.warn("play() rejected", err);
          scheduleAdvance(Math.max(1200, turn.text.length * 55));
        });

        return () => {
          cancelled = true;
          if (handoff) clearTimeout(handoff);
          el.onended = null;
          el.onerror = null;
          el.ontimeupdate = null;
        };
      }
    }

    // Silent path — pace by text length. Still cut cameras.
    const timer = setTimeout(advance, Math.max(1200, turn.text.length * 55));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (handoff) clearTimeout(handoff);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, turnIdx, audioUnlocked, muted]);

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
  const speakerRole = currentSpeaker ? ANALYSTS[currentSpeaker]?.role : null;

  return (
    <section className="relative">
      <audio ref={audioRef} preload="auto" playsInline />
      <audio ref={audioRefB} preload="auto" playsInline />
      <audio ref={chatAudioRef} preload="auto" playsInline />

      {/* Header row: mute + topic tabs (LIVE label is baked into the hero) */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {topics.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {topics.map((t) => {
              const active = t.id === activeTopic;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTopic(t.id)}
                  data-testid={`desk-topic-${t.id}`}
                  className={`px-4 py-2.5 rounded-full text-xs font-accent uppercase tracking-widest transition-all ${
                    active
                      ? "bg-[#1e5dff] text-white shadow-[0_0_20px_-4px_rgba(30,93,255,0.7)] scale-105"
                      : "border border-[#2d2d35] text-white/60 hover:border-[#1e5dff]/60 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setMuted((m) => !m)}
          data-testid={TEST_IDS.desk.muteBtn}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 font-accent text-[11px] uppercase tracking-widest transition-colors ml-auto"
          title={muted ? "Unmute the desk" : "Mute the desk"}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {muted ? "Muted" : "Sound On"}
        </button>
      </div>

      {/* Broadcast frame */}
      <div
        data-testid={TEST_IDS.desk.shotFrame}
        className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11]"
      >
        <TwoHostDesk shot={currentShot} speaker={currentSpeaker} speaking={!!currentSpeaker && audioUnlocked && !muted} />

        {/* Lower-third — swap accent + label to whoever's speaking */}
        <div
          className="absolute left-5 right-5 sm:left-8 sm:right-8 bottom-6 rounded-lg backdrop-blur-sm border px-4 py-3 flex items-center gap-3 transition-all duration-300 min-h-[52px] z-20"
          style={{
            background: "rgba(11,11,16,0.85)",
            borderColor: speakerAccent + "66",
          }}
          data-testid={TEST_IDS.desk.lowerThird}
        >
          {currentSpeaker ? (
            <>
              <span
                className="h-2.5 w-2.5 rounded-full live-pulse flex-shrink-0"
                style={{ background: speakerAccent }}
              />
              <div
                className="font-headline text-base flex-shrink-0"
                style={{ color: speakerAccent }}
              >
                {speakerName?.toUpperCase()}
              </div>
              <div className="text-white/50 font-accent text-[11px] uppercase tracking-widest hidden sm:block">
                {speakerRole}
              </div>
              <div className="ml-auto text-white/40 font-accent text-[10px] uppercase tracking-widest hidden md:block">
                on mic
              </div>
            </>
          ) : (
            <div className="text-white/40 text-sm font-accent uppercase tracking-widest">
              {audioUnlocked
                ? "The desk is listening…"
                : "Tap a topic to start the broadcast"}
            </div>
          )}
        </div>
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
            placeholder={
              chatOpen
                ? "e.g. What's wrong with the Leafs?"
                : "Desk is talking — hang on a sec…"
            }
            disabled={!chatOpen || chatBusy}
            data-testid={TEST_IDS.desk.topicInput}
            className="flex-1 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={() => {
              unlockAudio();
              submitTopic();
            }}
            disabled={!chatOpen || chatBusy || !chatInput.trim()}
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
                className="font-headline text-sm"
                style={{ color: ANALYSTS[chatResponse.analyst_id]?.accent }}
              >
                {ANALYSTS[chatResponse.analyst_id]?.short?.toUpperCase()}
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
