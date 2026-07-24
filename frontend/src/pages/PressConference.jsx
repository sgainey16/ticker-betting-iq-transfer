import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ANALYSTS, ANALYST_ORDER, TEST_IDS } from "@/lib/config";
import { api, askAnalystStream } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import AnalystAvatar from "@/components/AnalystAvatar";
import { Send, Sparkles, Crown, X } from "lucide-react";

function useQueryParam(name) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name), [search, name]);
}

export default function PressConference() {
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
  const [sub, setSub] = useState({ questions_used: 0, free_limit: 3, is_premium: false });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const answerRef = useRef(null);

  const deviceId = useMemo(() => getDeviceId(), []);
  const analyst = ANALYSTS[analystId];

  useEffect(() => {
    if (preselect && ANALYSTS[preselect]) setAnalystId(preselect);
  }, [preselect]);

  useEffect(() => {
    api.get("/suggested-questions")
      .then((r) => setSuggestions(r.data.questions || []))
      .catch(() => setSuggestions([]));
    api.get(`/subscription/state?device_id=${encodeURIComponent(deviceId)}`)
      .then((r) => setSub(r.data))
      .catch(() => {});
  }, [deviceId]);

  useEffect(() => {
    if (!loading) return;
    const lines = {
      reggie: ["Reggie is checking the tape…", "Reggie is pulling up the notes…"],
      marc: ["Marc is pulling the model…", "Marc is checking the trend line…"],
    }[analystId] || ["The desk is going live…"];
    let i = 0; setLoadingLine(lines[0]);
    const t = setInterval(() => { i = (i + 1) % lines.length; setLoadingLine(lines[i]); }, 1800);
    return () => clearInterval(t);
  }, [loading, analystId]);

  useEffect(() => {
    if (answerRef.current) answerRef.current.scrollTop = answerRef.current.scrollHeight;
  }, [answer]);

  async function submit(q) {
    const asked = (q ?? question).trim();
    if (!asked || loading) return;

    // Soft counter — paywall stays OFF for MVP, but we show a "Founding Member"
    // nudge after the free limit so the upgrade path is visible.
    try {
      const r = await api.post("/subscription/increment-question", { device_id: deviceId });
      setSub((s) => ({ ...s, questions_used: r.data.questions_used, is_premium: r.data.is_premium }));
      if (!r.data.is_premium && r.data.questions_used > (r.data.free_limit || 3)) {
        setShowUpgrade(true);
      }
    } catch (_) { /* non-fatal */ }

    setLoading(true); setAnswer(""); setStatCard(null); setErrorMsg("");
    await askAnalystStream(
      { analyst_id: analystId, question: asked },
      ({ event, data }) => {
        if (event === "stat_card") setStatCard(data);
        else if (event === "token") setAnswer((prev) => prev + (data.t || ""));
        else if (event === "error") setErrorMsg(data.message || "Signal lost from the desk.");
        else if (event === "done") setLoading(false);
      },
      (err) => { console.error(err); setErrorMsg("Signal lost from the desk. Try again."); setLoading(false); },
    );
    setLoading(false);
  }

  async function activatePremium() {
    try {
      await api.post("/subscription/activate", { device_id: deviceId });
      setSub((s) => ({ ...s, is_premium: true }));
      setShowUpgrade(false);
    } catch (e) { console.error(e); }
  }

  const freeRemaining = Math.max(0, (sub.free_limit || 3) - (sub.questions_used || 0));
  const showCounter = !sub.is_premium;

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      {/* Header row */}
      <div className="lg:col-span-12 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#1e5dff]">
            1-on-1 · Press Conference
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl text-white mt-1">
            Ask the desk anything.
          </h1>
        </div>
        {showCounter && (
          <div
            className="rounded-full border border-[#2d2d35] bg-[#0b0b10] px-4 py-2 flex items-center gap-3"
            data-testid={TEST_IDS.ask.questionCounter}
          >
            <span className="font-accent text-[10px] uppercase tracking-widest text-white/50">
              Founding member perk
            </span>
            <span className="font-headline text-white/90 text-sm">
              {freeRemaining} of {sub.free_limit || 3} free deep-dives left
            </span>
            <button
              onClick={() => setShowUpgrade(true)}
              className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-accent uppercase tracking-widest text-[#1e5dff] hover:text-white transition-colors"
            >
              <Crown className="w-3.5 h-3.5" /> Unlock
            </button>
          </div>
        )}
        {sub.is_premium && (
          <div className="rounded-full border border-[#1e5dff]/60 bg-[#0b0b10] px-4 py-2 inline-flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#1e5dff]" />
            <span className="font-accent text-[11px] uppercase tracking-widest text-white/85">
              Founding Member
            </span>
          </div>
        )}
      </div>

      {/* Analyst selector */}
      <div className="lg:col-span-12" data-testid={TEST_IDS.ask.analystStrip}>
        <div className="font-accent text-xs uppercase tracking-[0.35em] text-white/50 mb-3">
          Pick who takes the podium
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
                <div className="h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
                  <AnalystAvatar analystId={id} size={48} shape="circle" ring={selected} />
                </div>
                <div className="min-w-0">
                  <div className="font-headline text-sm leading-tight uppercase tracking-widest" style={{ color: a.accent }}>
                    {a.role}
                  </div>
                  <div className="text-[11px] text-white/50 truncate mt-1 italic">"{a.tagline}"</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question + answer */}
      <div className="lg:col-span-8">
        <div className="card-surface p-5 sm:p-6" style={{ borderColor: analyst.accent + "55" }}>
          <label htmlFor="ask-input" className="font-accent text-xs uppercase tracking-[0.3em] text-white/50">
            Ask the desk
          </label>
          <div className="mt-2 flex items-start gap-3">
            <textarea
              id="ask-input"
              data-testid={TEST_IDS.ask.input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              placeholder="Ask anything about the NHL, your fantasy team, matchup edges…"
              className="flex-1 bg-[#0b0b10] text-white placeholder:text-white/30 rounded-lg border border-[#2d2d35] focus:border-[#1e5dff] focus:outline-none px-4 py-3 text-base font-inter resize-none"
            />
            <button
              onClick={() => submit()}
              disabled={loading || !question.trim()}
              data-testid={TEST_IDS.ask.submit}
              className="h-[52px] px-5 rounded-lg font-accent uppercase tracking-widest text-sm text-white bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>

          {suggestions.length > 0 && !answer && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.slice(0, 6).map((s, i) => (
                <button
                  key={i}
                  data-testid={TEST_IDS.ask.suggested(i)}
                  onClick={() => { setQuestion(s); submit(s); }}
                  className="text-xs font-accent uppercase tracking-widest text-white/70 hover:text-white border border-[#2d2d35] hover:border-white/40 px-3 py-1.5 rounded-full transition-colors"
                >
                  <Sparkles className="w-3 h-3 inline mr-1.5 -mt-0.5" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          ref={answerRef}
          data-testid={TEST_IDS.ask.answerBlock}
          className="mt-5 card-surface p-5 sm:p-7 min-h-[220px] relative overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full overflow-hidden flex-shrink-0">
              <AnalystAvatar analystId={analystId} size={44} shape="circle" ring={true} />
            </div>
            <div>
              <div className="font-headline text-sm uppercase tracking-widest leading-tight" style={{ color: analyst.accent }}>
                {analyst.role}
              </div>
              <div className="text-[11px] font-accent uppercase tracking-widest text-white/50 mt-1">
                Live from the desk
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[10px] font-accent uppercase tracking-widest text-white/50">
              <span className="h-2 w-2 rounded-full live-pulse" style={{ background: analyst.accent }} />
              On Mic
            </div>
          </div>
          <div className="mt-5">
            {errorMsg ? (
              <div className="text-red-400 font-accent text-sm" data-testid="ask-error">{errorMsg}</div>
            ) : answer ? (
              <p className={`text-white/90 text-base sm:text-lg leading-relaxed whitespace-pre-wrap ${loading ? "stream-caret" : ""}`}>{answer}</p>
            ) : loading ? (
              <div className="text-white/50 italic font-accent uppercase tracking-widest text-sm" data-testid={TEST_IDS.ask.loadingLine}>
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
        <div className="card-surface p-5 sticky top-24" data-testid={TEST_IDS.ask.statCard}>
          <div className="font-accent text-xs uppercase tracking-[0.35em] text-white/50">
            The data card
          </div>
          {statCard ? (
            <>
              <div className="mt-3">
                <div className="font-headline text-2xl text-white leading-tight">{statCard.title}</div>
                <div className="text-xs font-accent uppercase tracking-widest text-white/50 mt-0.5">
                  {statCard.subtitle}
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(statCard.stats || []).map((s, i) => (
                  <div key={i} className="rounded-lg border border-[#2d2d35] p-3 bg-[#0b0b10]">
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">{s.label}</div>
                    <div className="font-accent text-3xl text-white mt-0.5">{s.value}</div>
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

        {/* Founding member perks card */}
        {!sub.is_premium && (
          <div className="card-surface p-5 mt-4 border" style={{ borderColor: "#1e5dff55" }}>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#1e5dff]" />
              <div className="font-headline text-white text-lg">Founding Member</div>
            </div>
            <div className="text-white/60 text-sm mt-2">
              Unlimited deep dives, personal fantasy back-office, anomaly alerts, and start-sit calls tailored to your roster.
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="mt-3 w-full h-10 rounded-lg bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent uppercase tracking-widest text-xs inline-flex items-center justify-center gap-2 transition-colors"
              data-testid="presser-upgrade-cta"
            >
              <Crown className="w-3.5 h-3.5" /> Become a Founder
            </button>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/35 mt-2 text-center">
              MVP · early access · no charge yet
            </div>
          </div>
        )}
      </aside>

      {/* Upgrade modal */}
      {showUpgrade && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(5,7,15,0.75)", backdropFilter: "blur(4px)" }}
          data-testid={TEST_IDS.ask.upgradeModal}
        >
          <div className="max-w-md w-full card-surface p-6 relative border" style={{ borderColor: "#1e5dff88" }}>
            <button
              onClick={() => setShowUpgrade(false)}
              className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#1e5dff]" />
              <div className="font-headline text-2xl text-white">Founding Member</div>
            </div>
            <div className="mt-3 text-white/70 text-sm">
              You used your {sub.free_limit || 3} free deep-dives. Founders get:
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li className="flex gap-2"><span className="text-[#1e5dff]">●</span> Unlimited Press Conference deep-dives</li>
              <li className="flex gap-2"><span className="text-[#1e5dff]">●</span> Fantasy back-office: roster + league rules</li>
              <li className="flex gap-2"><span className="text-[#1e5dff]">●</span> Start-sit calls tailored to your team</li>
              <li className="flex gap-2"><span className="text-[#1e5dff]">●</span> Anomaly flags on your favorite players</li>
              <li className="flex gap-2"><span className="text-[#1e5dff]">●</span> Priority topics on the broadcast desk</li>
            </ul>
            <div className="mt-4 rounded-lg bg-[#0b0b10] border border-[#2d2d35] p-4 flex items-baseline gap-2">
              <div className="font-headline text-3xl text-white">$3.99</div>
              <div className="font-accent text-xs uppercase tracking-widest text-white/50">/ month · MVP free</div>
            </div>
            <button
              onClick={activatePremium}
              className="mt-4 w-full h-11 rounded-lg bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2 transition-colors"
              data-testid={TEST_IDS.ask.upgradeConfirm}
            >
              <Crown className="w-4 h-4" /> Activate Founding Member
            </button>
            <div className="text-[10px] font-accent uppercase tracking-widest text-white/35 mt-3 text-center">
              MVP · early access · payment goes live next release
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
