import { useEffect, useRef, useState, useCallback } from "react";
import { ANALYSTS } from "@/lib/config";
import { api, BACKEND_URL } from "@/lib/api";
import { Send, Volume2, VolumeX } from "lucide-react";

// Analyst horizontal positions on the desk photo (%, left-to-right on the reference).
const DESK_POS = {
  marchetti: 16,
  doyle: 39,
  kovalenko: 61,
  lindqvist: 84,
};

const DESK_IMAGE =
  "https://customer-assets-39nsmqrw.emergentagent.net/job_sports-broadcast-21/artifacts/w55umj8m_710626E9-E6C1-45DB-8CC2-0F51791FBB4B.png";

const PAUSE_BETWEEN_TURNS = 90; // tight desk-banter handoff
const INTERRUPT_OVERLAP_MS = -180; // interrupts step ON the previous line

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
  const chatAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const pushedRef = useRef(new Set());

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
        const r = await api.get("/banter", { params: { topic: activeTopic } });
        if (mounted) setTurns(r.data.turns || []);
      } catch (e) {
        console.error("banter load failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeTopic]);

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
      const el = audioRef.current;
      if (el) {
        el.src = `${BACKEND_URL}${turn.audio_url}`;
        el.onended = () => advance();
        el.onerror = () => {
          console.warn("audio failed for", turn.audio_url);
          // Estimate duration from text length as a fallback.
          setTimeout(advance, Math.max(1200, turn.text.length * 55));
        };
        el.play().catch((err) => {
          console.warn("play() rejected", err);
          setTimeout(advance, Math.max(1200, turn.text.length * 55));
        });
        return () => {
          cancelled = true;
          if (handoff) clearTimeout(handoff);
          el.onended = null;
          el.onerror = null;
          el.pause();
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
      <audio ref={chatAudioRef} preload="auto" playsInline />

      {/* Topic tabs + sound control */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {topics.map((t) => {
          const active = t.id === activeTopic;
          return (
            <button
              key={t.id}
              data-testid={`topic-tab-${t.id}`}
              onClick={() => {
                unlockAudio();
                setActiveTopic(t.id);
                if (audioCtxRef.current) playStinger(audioCtxRef.current, muted ? 0.0001 : 0.1);
              }}
              className="px-3.5 py-1.5 rounded-full font-accent text-[11px] uppercase tracking-widest transition-colors"
              style={{
                background: active ? "#1e5dff" : "transparent",
                color: active ? "#fff" : "#9ca3af",
                border: `1px solid ${active ? "#1e5dff" : "#2d2d35"}`,
              }}
            >
              {t.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {!audioUnlocked ? (
            <button
              onClick={unlockAudio}
              data-testid="unlock-audio-btn"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors shadow-[0_0_20px_-6px_rgba(30,93,255,0.9)]"
            >
              <Volume2 className="w-4 h-4" />
              Turn on sound
            </button>
          ) : (
            <button
              onClick={() => setMuted((m) => !m)}
              data-testid="mute-btn"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {muted ? "Muted" : "Sound On"}
            </button>
          )}
        </div>
      </div>

      {/* Desk photo hero — big */}
      <div className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d11]">
        <div
          className="relative w-full"
          style={{ aspectRatio: "16 / 8", overflow: "hidden" }}
        >
          <img
            src={DESK_IMAGE}
            alt="The Ticker desk — four analysts mid-broadcast"
            className="absolute inset-0 w-full h-full select-none"
            style={{ objectFit: "cover", objectPosition: "center 46%" }}
            draggable={false}
          />

          {/* Top mask — fully hides the mockup title area */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: "26%",
              background:
                "linear-gradient(180deg, #0d0d11 0%, #0d0d11 70%, rgba(13,13,17,0) 100%)",
            }}
          />
          {/* Bottom mask — fully hides the mockup search bar + chips */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: "42%",
              background:
                "linear-gradient(0deg, #0d0d11 0%, #0d0d11 78%, rgba(13,13,17,0) 100%)",
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
                  : "Tap 'Turn on sound' to join the broadcast"}
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
 uppercase tracking-widest">
              on the mic — listen up
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
