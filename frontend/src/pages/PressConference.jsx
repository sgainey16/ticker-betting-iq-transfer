import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ANALYSTS, ANALYST_ORDER, TEST_IDS } from "@/lib/config";
import { api, askAnalystStream, BACKEND_URL } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { UPCOMING, DEEP_DIVE_TABS, GAME_TABS } from "@/lib/upcoming";
import { Send, Sparkles, Crown, X, ChevronDown, Radio, Target, Trophy, Star, ArrowUpRight } from "lucide-react";

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
  const [suggestOpen, setSuggestOpen] = useState(true);
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
    try {
      const r = await api.post("/subscription/increment-question", { device_id: deviceId });
      setSub((s) => ({ ...s, questions_used: r.data.questions_used, is_premium: r.data.is_premium }));
      if (!r.data.is_premium && r.data.questions_used > (r.data.free_limit || 3)) {
        setShowUpgrade(true);
      }
    } catch (_) {}
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
  const heroUrl = `${BACKEND_URL}${analyst.portrait || analyst.hero}`;

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-[#1e5dff]">
            1-on-1 · Press Conference
          </div>
          <h1 className="font-headline text-3xl sm:text-4xl text-white mt-1">
            At the podium tonight.
          </h1>
        </div>
        {showCounter ? (
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
        ) : (
          <div className="rounded-full border border-[#1e5dff]/60 bg-[#0b0b10] px-4 py-2 inline-flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#1e5dff]" />
            <span className="font-accent text-[11px] uppercase tracking-widest text-white/85">
              Founding Member
            </span>
          </div>
        )}
      </div>

      {/* Sticky sub-nav — Presser is locked to 3 sections: Deep Dive · Analytics · Games */}
      <div className="sticky top-16 z-30 -mx-5 sm:-mx-8 px-5 sm:px-8 py-2 bg-[#05050f]/85 backdrop-blur-md border-b border-[#2d2d35]">
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: "deep-dive", label: "Deep Dive", testid: TEST_IDS.presser.subnavDeepDive },
            { id: "analytics", label: "Analytics", testid: TEST_IDS.presser.subnavAnalytics },
            { id: "games",     label: "Games",     testid: TEST_IDS.presser.subnavGames },
          ].map((s) => (
            <a
              key={s.id}
              href={`#presser-${s.id}`}
              data-testid={s.testid}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(`presser-${s.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="px-3 py-1.5 rounded-md font-accent text-[11px] uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Big hero + controls */}
      <div id="presser-deep-dive" className="grid lg:grid-cols-12 gap-6 scroll-mt-32">
        {/* Hero photo */}
        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0d0d13] min-h-[360px] sm:min-h-[440px]">
          <div
            className="absolute inset-0 transition-all duration-500"
            style={{
              backgroundImage: `url(${heroUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center 25%",
              filter: "brightness(0.98) saturate(1.02)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, transparent 40%, ${analyst.accent}22 75%, rgba(5,5,15,0.85) 100%)`,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full backdrop-blur-md border mb-3"
              style={{
                background: "rgba(5,5,15,0.55)",
                borderColor: analyst.accent + "88",
              }}
            >
              <Radio className="w-3 h-3 live-pulse" style={{ color: analyst.accent }} />
              <span className="font-accent text-[10px] uppercase tracking-widest text-white/90">
                At the podium
              </span>
            </div>
            <div
              className="font-headline text-3xl sm:text-4xl text-white leading-tight"
              style={{ textShadow: "0 0 40px rgba(0,0,0,0.9)" }}
            >
              {analyst.name || analyst.role}
            </div>
            <div className="font-accent text-[11px] uppercase tracking-[0.3em] mt-1" style={{ color: analyst.accent }}>
              {analyst.role}
            </div>
            <div className="text-white/70 text-sm mt-2 italic max-w-md">
              "{analyst.tagline}"
            </div>
          </div>

          {/* Host toggle pinned top-right */}
          <div className="absolute top-4 right-4 flex gap-1.5 rounded-full backdrop-blur-md p-1 border border-white/15 bg-black/40">
            {ANALYST_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => setAnalystId(id)}
                data-testid={TEST_IDS.ask.analystPick(id)}
                className={`px-3 py-1 rounded-full font-accent text-[10px] uppercase tracking-widest transition-colors ${
                  id === analystId
                    ? "bg-white text-black"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {ANALYSTS[id].short || ANALYSTS[id].role.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Controls column */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Ask input */}
          <div className="card-surface p-5" style={{ borderColor: analyst.accent + "55" }}>
            <label htmlFor="ask-input" className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
              Ask {analyst.short || analyst.role.split(" ")[0]} anything
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
          </div>

          {/* Collapsible suggested questions */}
          {suggestions.length > 0 && (
            <details
              open={suggestOpen}
              onToggle={(e) => setSuggestOpen(e.currentTarget.open)}
              className="card-surface"
            >
              <summary
                className="cursor-pointer select-none list-none px-5 py-3 flex items-center justify-between"
                data-testid="presser-suggested-toggle"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white/50" />
                  <span className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                    Questions to ask · {suggestions.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 transition-transform ${suggestOpen ? "rotate-180" : ""}`}
                />
              </summary>
              <div className="px-5 pb-5 pt-1 flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    data-testid={TEST_IDS.ask.suggested(i)}
                    onClick={() => { setQuestion(s); submit(s); }}
                    className="text-xs font-accent uppercase tracking-widest text-white/70 hover:text-white border border-[#2d2d35] hover:border-white/40 px-3 py-1.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </details>
          )}

          {/* Answer + Stat card side-by-side on wide screens */}
          <div className="grid sm:grid-cols-5 gap-4">
            <div
              ref={answerRef}
              data-testid={TEST_IDS.ask.answerBlock}
              className="sm:col-span-3 card-surface p-5 min-h-[220px]"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full live-pulse" style={{ background: analyst.accent }} />
                <div className="font-headline text-sm uppercase tracking-widest" style={{ color: analyst.accent }}>
                  {analyst.role}
                </div>
                <div className="ml-auto font-accent text-[10px] uppercase tracking-widest text-white/45">
                  Live from the desk
                </div>
              </div>
              {errorMsg ? (
                <div className="text-red-400 font-accent text-sm" data-testid="ask-error">{errorMsg}</div>
              ) : answer ? (
                <p className={`text-white/90 text-base leading-relaxed whitespace-pre-wrap ${loading ? "stream-caret" : ""}`}>{answer}</p>
              ) : loading ? (
                <div className="text-white/50 italic font-accent uppercase tracking-widest text-sm" data-testid={TEST_IDS.ask.loadingLine}>
                  {loadingLine}
                </div>
              ) : (
                <div className="text-white/40 text-sm">
                  Type a question or tap a suggested chip. The panel is warmed up.
                </div>
              )}
            </div>

            <div className="sm:col-span-2 card-surface p-4" data-testid={TEST_IDS.ask.statCard}>
              {statCard ? (
                <>
                  <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/50">
                    The data card
                  </div>
                  <div className="mt-2 font-headline text-lg text-white leading-tight">{statCard.title}</div>
                  <div className="text-[10px] font-accent uppercase tracking-widest text-white/50 mt-0.5">
                    {statCard.subtitle}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(statCard.stats || []).map((s, i) => (
                      <div key={i} className="rounded-lg border border-[#2d2d35] p-2 bg-[#0b0b10]">
                        <div className="text-[9px] font-accent uppercase tracking-widest text-white/40">{s.label}</div>
                        <div className="font-accent text-xl text-white mt-0.5">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <BackOfficeMiniTicker />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics tabs */}
      <section id="presser-analytics" className="scroll-mt-32">
        <div className="flex items-center gap-2 mb-3">
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/60">
            Analytics
          </div>
          <div className="flex-1 h-px bg-[#2d2d35]" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEEP_DIVE_TABS.map((slug) => {
            const m = UPCOMING[slug];
            return (
              <Link
                key={slug}
                to={`/soon/${slug}`}
                data-testid={`presser-tab-${slug}`}
                className="card-surface p-4 hover:-translate-y-0.5 transition-transform group"
                style={{ borderColor: m.accent + "44" }}
              >
                <div className="font-accent text-[10px] uppercase tracking-[0.3em]" style={{ color: m.accent }}>
                  {m.kicker}
                </div>
                <div className="font-headline text-white text-lg mt-1 group-hover:text-white">
                  {m.title}
                </div>
                <div className="text-[11px] text-white/50 mt-1 line-clamp-2">
                  {m.blurb.split(" — ")[0]}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Games tabs */}
      <section id="presser-games" className="scroll-mt-32">
        <div className="flex items-center gap-2 mb-3">
          <div className="font-accent text-[11px] uppercase tracking-[0.35em] text-white/60">
            Games · your record shows here
          </div>
          <div className="flex-1 h-px bg-[#2d2d35]" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {GAME_TABS.map((slug) => {
            const m = UPCOMING[slug];
            const accuracyStat = m.stats?.[0];
            return (
              <Link
                key={slug}
                to={`/soon/${slug}`}
                data-testid={`presser-game-${slug}`}
                className="card-surface p-5 hover:-translate-y-0.5 transition-transform group flex items-center gap-4"
                style={{ borderColor: m.accent + "55" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-accent text-[10px] uppercase tracking-[0.3em]" style={{ color: m.accent }}>
                    {m.kicker}
                  </div>
                  <div className="font-headline text-white text-xl mt-1">{m.title}</div>
                  <div className="text-[11px] text-white/50 mt-1 line-clamp-2">
                    {m.blurb.split(".")[0]}.
                  </div>
                </div>
                {accuracyStat && (
                  <div className="text-right flex-shrink-0">
                    <div className="font-accent text-[10px] uppercase tracking-widest text-white/45">
                      {accuracyStat.label}
                    </div>
                    <div className="font-headline text-3xl mt-0.5" style={{ color: m.accent }}>
                      {accuracyStat.value}
                    </div>
                    <div className="text-[10px] font-accent uppercase tracking-widest text-white/40">
                      {accuracyStat.sub}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </section>

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


/* -------- Back Office Mini Ticker --------
   Sits in the empty state of the data card. Shows a compressed personal
   stat strip so the third-section-down feels like YOUR desk, not another
   "type a question" prompt. Deep-links each stat to its Back Office tab.
   All values mocked for now — will wire to real device profile data next.
*/
function BackOfficeMiniTicker() {
  const stats = [
    { label: "Accuracy",   value: "—",   sub: "No picks yet",  icon: Target,  to: "/back-office", accent: "#1e5dff" },
    { label: "Banners",    value: "0",   sub: "Win a season",  icon: Trophy,  to: "/back-office", accent: "#f5c542" },
    { label: "Top Team",   value: "—",   sub: "Set a favorite", icon: Star,   to: "/back-office", accent: "#00e5ff" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="font-accent text-[10px] uppercase tracking-[0.35em] text-white/50">
          Your Back Office
        </div>
        <Link
          to="/back-office"
          data-testid="presser-mini-ticker-link"
          className="font-accent text-[9px] uppercase tracking-widest text-[#1e5dff] hover:text-white transition-colors flex items-center gap-1"
        >
          Open <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="mt-3 space-y-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              to={s.to}
              data-testid={`presser-mini-ticker-${s.label.toLowerCase().replace(" ", "-")}`}
              className="flex items-center gap-3 rounded-lg border border-[#2d2d35] bg-[#0b0b10] px-3 py-2.5 hover:border-white/30 transition-colors group"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0"
                style={{ background: s.accent + "22", border: `1px solid ${s.accent}55` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: s.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/45">
                  {s.label}
                </div>
                <div className="text-[10px] text-white/40 truncate">{s.sub}</div>
              </div>
              <div className="font-headline text-xl text-white flex-shrink-0">
                {s.value}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] font-accent uppercase tracking-widest text-white/35 text-center">
        Ask a question — receipts land here next
      </div>
    </div>
  );
}
