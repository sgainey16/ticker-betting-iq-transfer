import { useEffect, useRef, useState, useCallback } from "react";
import { ANALYSTS } from "@/lib/config";
import { api, API } from "@/lib/api";
import { Send, Volume2, VolumeX } from "lucide-react";

// Analyst horizontal positions on the desk photo (in %, from left edge)
// Left-to-right in the reference photo: Marchetti, Doyle, Kovalenko, Lindqvist.
const DESK_POS = {
  marchetti: 16,
  doyle: 39,
  kovalenko: 61,
  lindqvist: 84,
};

const DESK_IMAGE =
  "https://customer-assets-39nsmqrw.emergentagent.net/job_sports-broadcast-21/artifacts/w55umj8m_710626E9-E6C1-45DB-8CC2-0F51791FBB4B.png";

// Text-typing pacing when we don't yet know audio duration.
const FALLBACK_TYPE_MS = 22;
const PAUSE_BETWEEN_TURNS = 220;

// ---- Broadcast stinger (Web Audio API, no external files) ----
function playStinger(audioCtx, gain = 0.12) {
  try {
    const now = audioCtx.currentTime;
    // Two-note broadcast bump: low → high, short
    const notes = [
      { f: 261.63, t: now + 0.0, d: 0.14 }, // C4
      { f: 523.25, t: now + 0.12, d: 0.22 }, // C5
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
  const [transcript, setTranscript] = useState([]); // {speaker, text}
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [typedText, setTypedText] = useState("");
  const [turnIdx, setTurnIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [topic, setTopicInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatResponse, setChatResponse] = useState(null);
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const chatAudioRef = useRef(null);
  const pushedRef = useRef(new Set());

  // Load topics list once.
  useEffect(() => {
    api
      .get("/topics")
      .then((r) => setTopics(r.data.topics || []))
      .catch(() => setTopics([]));
  }, []);

  // Load banter whenever topic changes.
  const loadBanter = useCallback(async (topicId, playStingerToo) => {
    setTurns([]);
    setTranscript([]);
    setTurnIdx(0);
    setTypedText("");
    setCurrentSpeaker(null);
    pushedRef.current = new Set();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    try {
      const r = await api.get(`/banter`, { params: { topic: topicId } });
      setTurns(r.data.turns || []);
      if (playStingerToo && audioCtxRef.current) {
        playStinger(audioCtxRef.current, muted ? 0.0001 : 0.12);
      }
    } catch (e) {
      console.error("banter load failed", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // Kick off first banter after topics load.
  useEffect(() => {
    loadBanter(activeTopic, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic]);

  // First user click anywhere unlocks the audio context (browser autoplay policy).
  const unlockAudio = useCallback(() => {
    if (audioUnlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
      // Prime HTMLAudioElement — some browsers need a user-gesture play() call.
      if (audioRef.current) {
        audioRef.current.muted = true;
        audioRef.current.play().then(() => {
          audioRef.current.pause();
          audioRef.current.muted = false;
        }).catch(() => {});
      }
      // Play the stinger to punctuate the moment they turn it on.
      if (audioCtxRef.current) playStinger(audioCtxRef.current, muted ? 0.0001 : 0.14);
      setAudioUnlocked(true);
    } catch (e) {
      console.warn("audio unlock failed", e);
    }
  }, [audioUnlocked, muted]);

  // Type + play current turn.
  useEffect(() => {
    if (!turns.length) return;
    if (turnIdx >= turns.length) {
      setCurrentSpeaker(null);
      setChatOpen(true);
      return;
    }
    const turn = turns[turnIdx];
    setCurrentSpeaker(turn.speaker);
    setTypedText("");

    let cancelled = false;
    let typingIv = null;
    let handoff = null;

    const advance = () => {
      if (cancelled) return;
      if (!pushedRef.current.has(turnIdx)) {
        pushedRef.current.add(turnIdx);
        setTranscript((t) => [...t, { speaker: turn.speaker, text: turn.text }]);
        handoff = setTimeout(() => {
          if (!cancelled) setTurnIdx((x) => x + 1);
        }, PAUSE_BETWEEN_TURNS);
      }
    };

    const startTyping = (durationMs) => {
      // If audio duration is known, pace typing to finish exactly with audio.
      // Otherwise use a fallback ms-per-char rate.
      const total = turn.text.length;
      const perChar = durationMs && total > 0 ? Math.max(10, durationMs / total) : FALLBACK_TYPE_MS;
      let i = 0;
      typingIv = setInterval(() => {
        if (cancelled) return clearInterval(typingIv);
        i += 1;
        setTypedText(turn.text.slice(0, i));
        if (i >= total) {
          clearInterval(typingIv);
          typingIv = null;
          if (!durationMs) advance(); // audio-less path
        }
      }, perChar);
    };

    // If we have audio, load + play; sync typing to duration.
    if (audioUnlocked && !muted && turn.audio_url) {
      const el = audioRef.current;
      if (el) {
        el.src = `${API}${turn.audio_url}`;
        const onMeta = () => {
          const dur = (el.duration && isFinite(el.duration)) ? el.duration * 1000 : null;
          startTyping(dur);
        };
        const onEnd = () => {
          if (typingIv) {
            // finalize typing if audio finished first
            clearInterval(typingIv);
            typingIv = null;
            setTypedText(turn.text);
          }
          advance();
        };
        const onErr = () => {
          console.warn("audio failed for", turn.audio_url);
          startTyping(null);
        };
        el.onloadedmetadata = onMeta;
        el.onended = onEnd;
        el.onerror = onErr;
        // Fallback timer in case metadata never resolves.
        const metaFallback = setTimeout(() => {
          if (!typingIv && !cancelled) startTyping(null);
        }, 800);
        el.play()
          .catch((err) => {
            console.warn("play() rejected", err);
            startTyping(null);
          });
        return () => {
          cancelled = true;
          clearTimeout(metaFallback);
          if (typingIv) clearInterval(typingIv);
          if (handoff) clearTimeout(handoff);
          el.onloadedmetadata = null;
          el.onended = null;
          el.onerror = null;
          el.pause();
        };
      }
    }

    // Silent path — pure typed captions.
    startTyping(null);
    return () => {
      cancelled = true;
      if (typingIv) clearInterval(typingIv);
      if (handoff) clearTimeout(handoff);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, turnIdx, audioUnlocked, muted]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, typedText]);

  async function submitTopic() {
    const t = topic.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    setChatResponse(null);
    try {
      const r = await api.post("/banter/quick-reply", { topic: t });
      setChatResponse(r.data);
      setTopicInput("");
      // Play the reply audio.
      if (audioUnlocked && !muted && r.data.audio_url && chatAudioRef.current) {
        chatAudioRef.current.src = `${API}${r.data.audio_url}`;
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

  const stillTyping =
    currentSpeaker && turns[turnIdx] && typedText.length < turns[turnIdx].text.length;

  return (
    <section className="relative">
      {/* Hidden audio elements */}
      <audio ref={audioRef} preload="auto" playsInline />
      <audio ref={chatAudioRef} preload="auto" playsInline />

      {/* Topic tabs */}
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
                if (audioCtxRef.current)
                  playStinger(audioCtxRef.current, muted ? 0.0001 : 0.1);
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Turn on sound
            </button>
          ) : (
            <button
              onClick={() => setMuted((m) => !m)}
              data-testid="mute-btn"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 font-accent text-[11px] uppercase tracking-widest transition-colors"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {muted ? "Muted" : "On"}
            </button>
          )}
        </div>
      </div>

      {/* Desk photo hero */}
      <div className="relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0b0b10]">
        <div
          className="w-full"
          style={{ aspectRatio: "18 / 5", overflow: "hidden", position: "relative" }}
        >
          <img
            src={DESK_IMAGE}
            alt="The Ticker desk — four analysts mid-broadcast"
            className="absolute inset-0 w-full h-full select-none"
            style={{ objectFit: "cover", objectPosition: "center 42%" }}
            draggable={false}
          />
        </div>

        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0d0d11] via-[#0d0d11]/70 to-transparent pointer-events-none" />

        {/* Speaker indicator pill */}
        {Object.entries(DESK_POS).map(([id, left]) => {
          const active = currentSpeaker === id;
          const a = ANALYSTS[id];
          return (
            <div
              key={id}
              className="absolute -translate-x-1/2 pointer-events-none transition-opacity duration-300"
              style={{ left: `${left}%`, top: "6%", opacity: active ? 1 : 0 }}
              data-testid={`desk-speaker-${id}`}
            >
              <div
                className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest"
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
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-white/10">
          <span className="h-2 w-2 rounded-full bg-red-500 live-pulse" />
          <span className="font-accent text-xs uppercase tracking-widest text-white">
            On Air · NHL Desk
          </span>
        </div>
      </div>

      {/* Live captions panel */}
      <div className="mt-5 card-surface p-5 sm:p-6" data-testid="live-captions">
        <div className="flex items-center justify-between mb-3">
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
            Live captions
          </div>
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/40">
            {audioUnlocked && !muted ? "Voice · Real-time" : "Sound off · Tap 'Turn on sound' above"}
          </div>
        </div>

        <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-3 pr-2">
          {transcript.map((t, i) => {
            const a = ANALYSTS[t.speaker];
            return (
              <div key={i} className="flex gap-3">
                <div
                  className="font-headline text-sm w-24 flex-shrink-0 leading-relaxed"
                  style={{ color: a.accent }}
                >
                  {a.short.toUpperCase()}
                </div>
                <p className="text-white/85 text-base leading-relaxed">{t.text}</p>
              </div>
            );
          })}

          {stillTyping && (
            <div className="flex gap-3">
              <div
                className="font-headline text-sm w-24 flex-shrink-0 leading-relaxed"
                style={{ color: ANALYSTS[currentSpeaker].accent }}
              >
                {ANALYSTS[currentSpeaker].short.toUpperCase()}
              </div>
              <p className="text-white text-base leading-relaxed stream-caret">
                {typedText}
              </p>
            </div>
          )}
        </div>

        {/* Drop-in topic input */}
        <div
          className={`mt-5 transition-all duration-500 ${
            chatOpen ? "opacity-100 translate-y-0" : "opacity-50 translate-y-1"
          }`}
        >
          <label className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
            Jump in — ask the panel
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              value={topic}
              onChange={(e) => setTopicInput(e.target.value)}
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
              disabled={!chatOpen || chatBusy || !topic.trim()}
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
              className="mt-3 rounded-lg border p-4 flex gap-3"
              style={{
                borderColor:
                  ANALYSTS[chatResponse.analyst_id]?.accent + "77" || "#2d2d35",
                background: "#0b0b10",
              }}
              data-testid="desk-quick-reply"
            >
              <div
                className="font-headline text-sm w-24 flex-shrink-0 leading-relaxed"
                style={{ color: ANALYSTS[chatResponse.analyst_id]?.accent }}
              >
                {ANALYSTS[chatResponse.analyst_id]?.short.toUpperCase()}
              </div>
              <p className="text-white text-base leading-relaxed">
                {chatResponse.text}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
