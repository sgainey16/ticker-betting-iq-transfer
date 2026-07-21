import { useEffect, useRef, useState } from "react";
import { ANALYSTS } from "@/lib/config";
import { api } from "@/lib/api";
import { Send } from "lucide-react";

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

// Typing speed (ms per char). Interruptions type faster.
const TYPE_MS = 22;
const TYPE_MS_INTERRUPT = 14;
const PAUSE_BETWEEN_TURNS = 260;

export default function LiveDesk({ onOpenChat }) {
  const [turns, setTurns] = useState([]);
  const [transcript, setTranscript] = useState([]); // {speaker, text}
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [typedText, setTypedText] = useState("");
  const [turnIdx, setTurnIdx] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatResponse, setChatResponse] = useState(null); // {analyst_id, text}
  const scrollRef = useRef(null);
  const pushedRef = useRef(new Set()); // dedupe transcript pushes across strict-mode re-runs

  useEffect(() => {
    api
      .get("/banter")
      .then((r) => setTurns(r.data.turns || []))
      .catch(() => setTurns([]));
  }, []);

  // Type the turns one by one.
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
    let i = 0;
    let handoff = null;
    const speed = turn.interrupt ? TYPE_MS_INTERRUPT : TYPE_MS;
    const iv = setInterval(() => {
      i += 1;
      setTypedText(turn.text.slice(0, i));
      if (i >= turn.text.length) {
        clearInterval(iv);
        if (!pushedRef.current.has(turnIdx)) {
          pushedRef.current.add(turnIdx);
          setTranscript((t) => [...t, { speaker: turn.speaker, text: turn.text }]);
          handoff = setTimeout(() => setTurnIdx((x) => x + 1), PAUSE_BETWEEN_TURNS);
        }
      }
    }, speed);
    return () => {
      clearInterval(iv);
      if (handoff) clearTimeout(handoff);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, turnIdx]);

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
      setTopic("");
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
      {/* Desk photo hero — cropped to show only the desk portion of the mockup */}
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

        {/* subtle darkening at top so the "ON AIR" pill reads */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0d0d11] via-[#0d0d11]/70 to-transparent pointer-events-none" />

        {/* Speaker indicator dots above whoever's currently talking */}
        {Object.entries(DESK_POS).map(([id, left]) => {
          const active = currentSpeaker === id;
          const a = ANALYSTS[id];
          return (
            <div
              key={id}
              className="absolute -translate-x-1/2 pointer-events-none transition-opacity duration-300"
              style={{
                left: `${left}%`,
                top: "6%",
                opacity: active ? 1 : 0,
              }}
              data-testid={`desk-speaker-${id}`}
            >
              <div
                className="px-3 py-1 rounded-full text-[10px] font-accent uppercase tracking-widest"
                style={{
                  background: `${a.accent}`,
                  color: "#0d0d11",
                  boxShadow: `0 0 24px ${a.accent}`,
                }}
              >
                {a.short}
              </div>
              <div className="mx-auto mt-1 h-2 w-2 rounded-full live-pulse" style={{ background: a.accent }} />
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
      <div
        className="mt-5 card-surface p-5 sm:p-6"
        data-testid="live-captions"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
            Live captions
          </div>
          <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/40">
            Auto-generated · Real-time
          </div>
        </div>

        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto space-y-3 pr-2"
        >
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
                <p className="text-white/85 text-base leading-relaxed">
                  {t.text}
                </p>
              </div>
            );
          })}

          {currentSpeaker &&
            (() => {
              const curr = turns[turnIdx];
              const stillTyping = curr && typedText.length < curr.text.length;
              if (!stillTyping) return null;
              return (
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
              );
            })()}
        </div>

        {/* Drop-in topic input */}
        <div
          className={`mt-5 transition-all duration-500 ${
            chatOpen ? "opacity-100 translate-y-0" : "opacity-50 translate-y-1"
          }`}
        >
          <label className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
            Jump in — drop a team, a player, a topic
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTopic()}
              placeholder={chatOpen ? "e.g. McDavid, Leafs at home, deadline…" : "Desk is talking — hang on a sec…"}
              disabled={!chatOpen || chatBusy}
              data-testid="desk-topic-input"
              className="flex-1 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={submitTopic}
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
