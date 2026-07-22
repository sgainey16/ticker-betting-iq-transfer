import { useEffect, useRef, useState, useCallback } from "react";
import { ANALYSTS } from "@/lib/config";
import { api, BACKEND_URL } from "@/lib/api";
import { Send, Volume2, VolumeX } from "lucide-react";

// Reggie is solo center-frame — no per-speaker position needed.
const DESK_POS = { reggie: 50 };

const DESK_IMAGE =
  "https://customer-assets-39nsmqrw.emergentagent.net/job_sports-broadcast-21/artifacts/yqmg9ffo_D0025CBA-4A29-4EB4-8AC7-EA8C955C60E0.png";

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
  const [currentText, setCurrentText] = useState(""); // shown as broadcast lower-third only
  const [turnIdx, setTurnIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatResponse, setChatResponse] = useState(null);
  const audioRef = useRef(null);
  const audioRefB = useRef(null); // second channel so interrupts overlap prior line
  const chatAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const pushedRef = useRef(new Set());
  const unlockAudioRef = useRef(() => {}); // updated when unlockAudio is defined below

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
      setCurrentText("");
      pushedRef.current = new Set();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      try {
        const r = await api.get("/reggie/show");
        if (mounted) setTurns(r.data.turns || []);
      } catch (e) {
        console.error("show load failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeTopic]);

  // Any click ANYWHERE on the page unlocks audio (browsers require a user
  // gesture — this is the least-friction workaround).
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
      // Prime the HTMLAudioElement inside the user gesture by playing a tiny
      // silent data-URI mp3. Once primed, subsequent .play() calls with new
      // src values are allowed by browser autoplay policy.
      const el = audioRef.current;
      if (el) {
        // 0.1s silence WAV (data URI) — universally supported.
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

  // Keep unlockAudioRef in sync with the latest unlockAudio implementation.
  useEffect(() => {
    unlockAudioRef.current = unlockAudio;
  }, [unlockAudio]);

  // Play current turn.
  useEffect(() => {
    if (!turns.length) return;
    if (turnIdx >= turns.length) {
      setCurrentSpeaker(null);
      setCurrentText("");
      setChatOpen(true);
      return;
    }
    const turn = turns[turnIdx];
    setCurrentSpeaker(turn.speaker);
    setCurrentText(turn.text);

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

    // If audio available and unlocked, play it.
    if (audioUnlocked && !muted && turn.audio_url) {
      // Alternate between two audio elements: even turns → A, odd → B.
      // This lets an interrupt on the NEXT turn play concurrently with the tail
      // of the previous turn on the OTHER element (real cut-off feel).
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

        // PRELOAD the next line into the OTHER channel now so el.play() on
        // it later is instantaneous (no fetch/decode gap between speakers).
        const nextTurn = turns[turnIdx + 1];
        if (nextTurn && nextTurn.audio_url && otherEl) {
          otherEl.src = `${BACKEND_URL}${nextTurn.audio_url}`;
          otherEl.load();
        }

        // Fire next turn slightly before this one ends. Interrupts overlap
        // heavily (~1100ms), normal turns still overlap (~500ms) — no dead air.
        const earlyMs = nextTurn && nextTurn.interrupt ? INTERRUPT_START_EARLY_MS : NORMAL_OVERLAP_MS;
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

        // Don't stop the OTHER channel here — let its previous line finish
        // naturally so it fades under this new voice.
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
          // NOTE: we do NOT pause the other channel — that would kill overlap.
          // On real unmount both audio elements will GC.
        };
      }
    }

    // Silent path — pace by text length.
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
      if (audioUnlocked && !muted && r.data.audio_url && chatAudioRef.current) {
        chatAudioRef.current.src = `${BACKEND_URL}${r.data.audio_url}`;
        chatAudioRef.current.play().catch(() => {});
      }
    } catch (e) {
      setChatResponse({
        analyst_id: "doyle",
        text: "Signal lost from the desk. Try again.",
      });
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <section className="relative">
      <audio ref={audioRef} preload="auto" playsInline />
      <audio ref={audioRefB} preload="auto" playsInline />
      <audio ref={chatAudioRef} preload="auto" playsInline />

      {/* Topic tabs hidden while Reggie is solo — will return with the panel */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff]">
          <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
          Live · Reggie Banks · NHL Desk
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setMuted((m) => !m)}
            data-testid="mute-btn"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 font-accent text-[11px] uppercase tracking-widest transition-colors"
            title={muted ? "Unmute the desk" : "Mute the desk"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            {muted ? "Muted" : "Sound On"}
          </button>
        </div>
      </div>

      {/* Desk photo hero — big */}
      <div className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11]">
        <div
          className="relative w-full"
          style={{ aspectRatio: "3 / 2", overflow: "hidden" }}
        >
          <img
            src={DESK_IMAGE}
            alt="Reggie Banks — The Ticker AI Sports Network"
            className="absolute inset-0 w-full h-full select-none"
            style={{ objectFit: "cover", objectPosition: "center center" }}
            draggable={false}
          />

          {/* Light bottom gradient so the lower-third caption reads */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: "22%",
              background:
                "linear-gradient(0deg, #0d0d11 0%, rgba(13,13,17,0.55) 55%, rgba(13,13,17,0) 100%)",
            }}
          />

          {/* Speaker pill above whoever's currently talking */}
          {Object.entries(DESK_POS).map(([id, left]) => {
            const active = currentSpeaker === id;
            const a = ANALYSTS[id];
            return (
              <div
                key={id}
                className="absolute -translate-x-1/2 pointer-events-none transition-opacity duration-300"
                style={{ left: `${left}%`, top: "10%", opacity: active ? 1 : 0 }}
                data-testid={`desk-speaker-${id}`}
              >
                <div
                  className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest whitespace-nowrap"
                  style={{
                    background: a.accent,
                    color: "#0d0d11",
                    boxShadow: `0 0 24px ${a.accent}`,
                  }}
                >
                  {a.short}
                </div>
                <div
                  className="mx-auto mt-1 h-2 w-2 rounded-full live-pulse"
                  style={{ background: a.accent }}
                />
              </div>
            );
          })}

          {/* ON AIR pill */}
          <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/10">
            <span className="h-2 w-2 rounded-full bg-red-500 live-pulse" />
            <span className="font-accent text-xs uppercase tracking-widest text-white">
              On Air · NHL Desk
            </span>
          </div>

          {/* Broadcast lower-third — speaker name only, no line text */}
          <div
            className="absolute left-5 right-5 sm:left-8 sm:right-8 bottom-6 rounded-lg backdrop-blur-sm border px-4 py-3 flex items-center gap-3 transition-all duration-300 min-h-[52px]"
            style={{
              background: "rgba(11,11,16,0.85)",
              borderColor: currentSpeaker
                ? `${ANALYSTS[currentSpeaker].accent}66`
                : "#1a1a22",
            }}
            data-testid="desk-lower-third"
          >
            {currentSpeaker ? (
              <>
                <span
                  className="h-2.5 w-2.5 rounded-full live-pulse flex-shrink-0"
                  style={{ background: ANALYSTS[currentSpeaker].accent }}
                />
                <div
                  className="font-headline text-base flex-shrink-0"
                  style={{ color: ANALYSTS[currentSpeaker].accent }}
                >
                  {ANALYSTS[currentSpeaker].short.toUpperCase()}
                </div>
                <div className="text-white/50 font-accent text-[11px] uppercase tracking-widest">
                  on the mic
                </div>
              </>
            ) : (
              <div className="text-white/40 text-sm font-accent uppercase tracking-widest">
                {audioUnlocked
                  ? "The desk is listening…"
                  : "Tap anywhere on the desk to hear them talking"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ask-the-panel input */}
      <div
        className={`mt-5 card-surface p-5 transition-all duration-500 ${
          chatOpen ? "opacity-100" : "opacity-70"
        }`}
      >
        <label className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
          Jump in — ask the panel
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
            data-testid="desk-topic-input"
            className="flex-1 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={() => {
              unlockAudio();
              submitTopic();
            }}
            disabled={!chatOpen || chatBusy || !chatInput.trim()}
            data-testid="desk-topic-submit"
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
            className="mt-3 rounded-lg border p-4 flex items-center gap-3"
            style={{
              borderColor: ANALYSTS[chatResponse.analyst_id]?.accent + "77" || "#2d2d35",
              background: "#0b0b10",
            }}
            data-testid="desk-quick-reply"
          >
            <span
              className="h-2.5 w-2.5 rounded-full live-pulse flex-shrink-0"
              style={{ background: ANALYSTS[chatResponse.analyst_id]?.accent }}
            />
            <div
              className="font-headline text-sm flex-shrink-0"
              style={{ color: ANALYSTS[chatResponse.analyst_id]?.accent }}
            >
              {ANALYSTS[chatResponse.analyst_id]?.short.toUpperCase()}
            </div>
            <div className="text-white/50 font-accent text-[11px] uppercase tracking-widest">
              on the mic — listen up
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
