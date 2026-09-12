// Inline chat surface for Reggie/Marc, dropped into a Hockey IQ tab as
// a bottom sheet. Reuses /api/assistant/reggie/chat + /action so any
// action proposal (log_bet, set_favorites, load_roster) still runs
// through the same confirmed pipeline.
//
// Difference vs. the global ReggieAssistant FAB: this component is
// mounted per-tab and knows the mode (tonight / my-iq / fantasy /
// community) so the opening prompt is contextual rather than generic.

import { useEffect, useRef, useState } from "react";
import { X, Send, Loader2, Sparkles, Check } from "lucide-react";
import { api } from "@/lib/api";
import HostPortrait from "@/components/HostPortrait";

const MODE_INTRO = {
  tonight:   { persona: "reggie", intro: "What are you seeing tonight? Give me the game and your read, I'll help you sharpen it." },
  "my-iq":   { persona: "marc",   intro: "Ask me about your record. I'll tell you what's real and what's noise." },
  fantasy:   { persona: "reggie", intro: "Roster, waiver, start/sit — what do you need eyes on?" },
  community: { persona: "marc",   intro: "The room's leaning one way tonight. Want me to walk you through where the specialists split?" },
};

export default function IQCoachChat({ deviceId, mode = "tonight", seedMessage, onClose }) {
  const meta = MODE_INTRO[mode] || MODE_INTRO.tonight;
  const [messages, setMessages] = useState(() => ([
    { role: "assistant", content: meta.intro, seed: true },
  ]));
  const [text, setText] = useState(seedMessage || "");
  const [busy, setBusy] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (overrideText) => {
    const body = (overrideText ?? text).trim();
    if (!body || busy) return;
    setBusy(true);
    setText("");
    setMessages((m) => [...m, { role: "user", content: body }]);
    try {
      const r = await api.post("/assistant/reggie/chat", { device_id: deviceId, message: body });
      const { reply, action_proposal } = r.data;
      setMessages((m) => [...m, {
        role: "assistant",
        content: reply,
        action_proposal: action_proposal || null,
      }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "My headset just cut out — try me again." }]);
    } finally {
      setBusy(false);
    }
  };

  const confirmProposal = async (idx, proposal) => {
    setConfirmingId(idx);
    try {
      const r = await api.post("/assistant/reggie/action", {
        device_id: deviceId,
        proposal_id: proposal.proposal_id || `p-${idx}`,
        kind: proposal.kind,
        payload: proposal.payload || {},
      });
      setMessages((m) => [
        ...m,
        { role: "system", content: r.data?.message || "Done.", confirmed: true },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "system", content: "Couldn't run that action." }]);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 top-0 bg-[#050510]/98 backdrop-blur-xl z-10 flex flex-col rounded-2xl"
      data-testid={`iq-coach-chat-${mode}`}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <HostPortrait persona={meta.persona} size={30} showName={false} className="rounded-md" />
        <div className="flex-1 min-w-0">
          <div className="font-headline text-white text-sm leading-none">
            {meta.persona === "marc" ? "Marc" : "Reggie"}
          </div>
          <div className="font-accent text-[9px] uppercase tracking-widest text-white/50 mt-0.5">
            {mode === "my-iq" ? "Your record" : mode === "community" ? "The room" : mode === "fantasy" ? "Roster" : "Tonight"}
          </div>
        </div>
        <button
          onClick={onClose}
          data-testid="iq-coach-chat-close"
          className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white grid place-items-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-snug ${
              m.role === "user"
                ? "bg-[#1e5dff]/25 border border-[#1e5dff]/50 text-white"
                : m.role === "system"
                ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 font-accent text-xs uppercase tracking-widest"
                : "bg-white/5 border border-white/10 text-white/90"
            }`}>
              {m.content}
              {m.action_proposal && (
                <div className="mt-2 rounded-md border border-[#1e5dff]/40 bg-black/40 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-[#1e5dff]" />
                    <div className="font-accent text-[9px] uppercase tracking-widest text-white/60">
                      Wants to do this
                    </div>
                  </div>
                  <div className="text-white text-xs font-headline mb-2">
                    {m.action_proposal.summary || m.action_proposal.kind}
                  </div>
                  <button
                    onClick={() => confirmProposal(i, m.action_proposal)}
                    disabled={confirmingId === i}
                    data-testid={`iq-coach-chat-confirm-${i}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
                  >
                    {confirmingId === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {confirmingId === i ? "Running" : "Confirm"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-white/60 text-xs inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-2 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask a question…"
          rows={1}
          data-testid="iq-coach-chat-input"
          className="flex-1 resize-none rounded-md bg-black/50 border border-white/15 focus:border-[#1e5dff] px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none max-h-32"
        />
        <button
          onClick={() => send()}
          disabled={!text.trim() || busy}
          data-testid="iq-coach-chat-send"
          className="w-9 h-9 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] disabled:opacity-40 text-white grid place-items-center transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
