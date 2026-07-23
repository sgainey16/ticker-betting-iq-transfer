import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ANALYSTS, ANALYST_ORDER, TEST_IDS } from "@/lib/config";
import { api, askAnalystStream } from "@/lib/api";
import AnalystAvatar from "@/components/AnalystAvatar";
import { Send, Sparkles } from "lucide-react";

function useQueryParam(name) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function AskAnalyst() {
  const preselect = useQueryParam("analyst");
  const [analystId, setAnalystId] = useState(
    preselect && ANALYSTS[preselect] ? preselect : "reggie",
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [statCard, setStatCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const answerRef = useRef(null);

  const analyst = ANALYSTS[analystId];

  useEffect(() => {
    if (preselect && ANALYSTS[preselect]) setAnalystId(preselect);
  }, [preselect]);

  useEffect(() => {
    api
      .get("/suggested-questions")
      .then((r) => setSuggestions(r.data.questions || []))
      .catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    if (!loading) return;
    // Rotate through in-character loading lines while streaming warms up.
    const lines = {
      reggie: [
        "Reggie is checking the tape…",
        "Reggie is pulling up the notes…",
      ],
      marc: [
        "Marc is pulling the model…",
        "Marc is checking the trend line…",
        "Marc is adjusting his glasses…",
      ],
    }[analystId] || ["The desk is going live…"];
    let i = 0;
    setLoadingLine(lines[0]);
    const t = setInterval(() => {
      i = (i + 1) % lines.length;
      setLoadingLine(lines[i]);
    }, 1800);
    return () => clearInterval(t);
  }, [loading, analystId]);

  useEffect(() => {
    if (answerRef.current) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer]);

  async function submit(q) {
    const asked = (q ?? question).trim();
    if (!asked || loading) return;
    setLoading(true);
    setAnswer("");
    setStatCard(null);
    setErrorMsg("");

    await askAnalystStream(
      { analyst_id: analystId, question: asked },
      ({ event, data }) => {
        if (event === "stat_card") setStatCard(data);
        else if (event === "token") setAnswer((prev) => prev + (data.t || ""));
        else if (event === "error")
          setErrorMsg(data.message || "Signal lost from the desk.");
        else if (event === "done") setLoading(false);
      },
      (err) => {
        console.error(err);
        setErrorMsg("Signal lost from the desk. Try again.");
        setLoading(false);
      },
    );
    setLoading(false);
  }

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      {/* Analyst selector */}
      <div
        className="lg:col-span-12"
        data-testid={TEST_IDS.ask.analystStrip}
      >
        <div className="font-accent text-xs uppercase tracking-[0.35em] text-white/50 mb-3">
          Pick your analyst
        </div>
        <div className="grid grid-cols-2 gap-3">
          {ANALYST_ORDER.map((id) => {
            const a = ANALYSTS[id];
            const selected = id === analystId;
            return (
              <button
                key={id}
                data-testid={TEST_IDS.ask.analystPick(id)}
                onClick={() => setAnalystId(id)}
                className="text-left card-surface p-4 flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  borderColor: selected ? a.accent : "#2d2d35",
                  boxShadow: selected ? `0 10px 30px -12px ${a.accent}` : "none",
                }}
              >
                <div
                  className="h-12 w-12 rounded-full overflow-hidden flex-shrink-0"
                >
                  <AnalystAvatar analystId={id} size={48} shape="circle" ring={selected} />
                </div>
                <div className="min-w-0">
                  <div className="font-headline text-white leading-tight truncate">
                    {a.short}
                  </div>
                  <div className="text-[11px] font-accent uppercase tracking-widest text-white/50 truncate">
                    {a.role}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question + answer */}
      <div className="lg:col-span-8">
        <div
          className="card-surface p-5 sm:p-6"
          style={{ borderColor: analyst.accent + "55" }}
        >
          <label
            htmlFor="ask-input"
            className="font-accent text-xs uppercase tracking-[0.3em] text-white/50"
          >
            Ask {analyst.short}
          </label>
          <div className="mt-2 flex items-start gap-3">
            <textarea
              id="ask-input"
              data-testid={TEST_IDS.ask.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder={`Ask ${analyst.short} anything about the NHL…`}
              className="flex-1 bg-[#0b0b10] text-white placeholder:text-white/30 rounded-lg border border-[#2d2d35] focus:border-[#1e5dff] focus:outline-none px-4 py-3 text-base font-inter resize-none"
            />
            <button
              onClick={() => submit()}
              disabled={loading || !question.trim()}
              data-testid={TEST_IDS.ask.submit}
              className="h-[52px] px-5 rounded-lg font-accent uppercase tracking-widest text-sm text-white bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !answer && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.slice(0, 6).map((s, i) => (
                <button
                  key={i}
                  data-testid={TEST_IDS.ask.suggested(i)}
                  onClick={() => {
                    setQuestion(s);
                    submit(s);
                  }}
                  className="text-xs font-accent uppercase tracking-widest text-white/70 hover:text-white border border-[#2d2d35] hover:border-white/40 px-3 py-1.5 rounded-full transition-colors"
                >
                  <Sparkles className="w-3 h-3 inline mr-1.5 -mt-0.5" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Answer */}
        <div
          ref={answerRef}
          data-testid={TEST_IDS.ask.answerBlock}
          className="mt-5 card-surface p-5 sm:p-7 min-h-[220px] relative overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-full overflow-hidden flex-shrink-0"
            >
              <AnalystAvatar analystId={analystId} size={44} shape="circle" ring={true} />
            </div>
            <div>
              <div className="font-headline text-white text-lg leading-tight">
                {analyst.short}
              </div>
              <div className="text-[11px] font-accent uppercase tracking-widest text-white/50">
                {analyst.role} · Live from the desk
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[10px] font-accent uppercase tracking-widest text-white/50">
              <span
                className="h-2 w-2 rounded-full live-pulse"
                style={{ background: analyst.accent }}
              />
              On Mic
            </div>
          </div>

          <div className="mt-5">
            {errorMsg ? (
              <div className="text-red-400 font-accent text-sm" data-testid="ask-error">
                {errorMsg}
              </div>
            ) : answer ? (
              <p
                className={`text-white/90 text-base sm:text-lg leading-relaxed whitespace-pre-wrap ${
                  loading ? "stream-caret" : ""
                }`}
              >
                {answer}
              </p>
            ) : loading ? (
              <div
                className="text-white/50 italic font-accent uppercase tracking-widest text-sm"
                data-testid={TEST_IDS.ask.loadingLine}
              >
                {loadingLine}
              </div>
            ) : (
              <div className="text-white/40 text-sm">
                Type a question above or tap a suggested chip. The panel is warmed up.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat card */}
      <aside className="lg:col-span-4">
        <div
          className="card-surface p-5 sticky top-24"
          data-testid={TEST_IDS.ask.statCard}
        >
          <div className="font-accent text-xs uppercase tracking-[0.35em] text-white/50">
            The data card
          </div>
          {statCard ? (
            <>
              <div className="mt-3">
                <div className="font-headline text-2xl text-white leading-tight">
                  {statCard.title}
                </div>
                <div className="text-xs font-accent uppercase tracking-widest text-white/50 mt-0.5">
                  {statCard.subtitle}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(statCard.stats || []).map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]"
                  >
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
                      {s.label}
                    </div>
                    <div className="font-accent text-3xl text-white mt-0.5">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-[11px] font-accent uppercase tracking-widest text-white/40">
                2025-26 · Illustrative
              </div>
            </>
          ) : (
            <div className="mt-3 text-white/40 text-sm">
              Ask a question. The panel pulls the numbers it{"\u2019"}s citing right here.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
