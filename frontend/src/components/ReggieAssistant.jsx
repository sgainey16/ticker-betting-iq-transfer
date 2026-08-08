import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getDeviceId } from "@/lib/device";
import { TEST_IDS } from "@/lib/config";
import { Mic2, X, Send, Check, RotateCcw, Sparkles, Loader2, ChevronDown, MessageCircle } from "lucide-react";

// FAB + chat panel for the Back Office. Reggie greets users, answers app
// questions, and PROPOSES actions (set favorites, load roster, log bet)
// which the user confirms via inline cards before anything writes to DB.

function ActionProposalCard({ proposal, onConfirm, onCancel, busy }) {
  const kind = proposal.kind;
  const payload = proposal.payload || {};
  return (
    <div
      className="mt-2 rounded-lg border border-[#1e5dff]/40 bg-[#0b0b10] p-3"
      data-testid="reggie-proposal-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-[#1e5dff]" />
        <div className="font-accent text-[10px] uppercase tracking-widest text-white/60">
          Reggie wants to do this for you
        </div>
      </div>
      <div className="text-white/90 text-sm font-headline mb-2">
        {proposal.summary || `Confirm ${kind}`}
      </div>

      {kind === "set_favorites" && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(payload.teams || []).map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-full text-[10px] font-accent uppercase tracking-widest bg-white/8 border border-white/15 text-white/85"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {kind === "load_roster" && (
        <div className="space-y-1 mb-3">
          {(payload.players || []).slice(0, 6).map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/80">
              <span className="text-white/40 w-4">{i + 1}.</span>
              <span className="text-white font-headline">{p.name || "—"}</span>
              <span className="text-white/50">·</span>
              <span className="text-white/60">{p.team || "?"}</span>
              <span className="text-white/50">·</span>
              <span className="text-white/60">{p.pos || "?"}</span>
            </div>
          ))}
        </div>
      )}

      {kind === "log_bet" && (
        <div className="space-y-1 mb-3 text-xs">
          {payload.matchup && <div><span className="text-white/50">Matchup: </span><span className="text-white/90">{payload.matchup}</span></div>}
          {payload.bet_type && <div><span className="text-white/50">Type: </span><span className="text-white/90">{payload.bet_type}</span></div>}
          {payload.selection && <div><span className="text-white/50">Pick: </span><span className="text-white/90">{payload.selection}</span></div>}
          {payload.odds && <div><span className="text-white/50">Odds: </span><span className="text-white/90">{payload.odds}</span></div>}
          {payload.stake != null && <div><span className="text-white/50">Stake: </span><span className="text-white/90">${Number(payload.stake).toFixed(2)}</span></div>}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(proposal)}
          disabled={busy}
          data-testid={TEST_IDS.assistant.confirm}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-50 text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          {busy ? "Saving" : "Confirm"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          data-testid={TEST_IDS.assistant.cancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#2d2d35] hover:border-white/40 text-white/70 hover:text-white font-accent text-[10px] uppercase tracking-widest transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  if (isSystem) {
    // Muted confirmation line ("Saved EDM, CGY as your favorite teams.")
    return (
      <div className="text-center my-2">
        <span className="text-[10px] font-accent uppercase tracking-widest text-[#4ade80]/80">
          {msg.content.replace(/^\[action:[^\]]+\]\s*/, "")}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[#1e5dff] text-white rounded-br-md"
            : "bg-[#1a1a22] text-white/90 border border-[#2d2d35] rounded-bl-md"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function ReggieAssistant() {
  const [open, setOpen] = useState(false);
  // Companion mode: when the chat is open, users can COLLAPSE the panel to a
  // small bottom-right pill so they can keep scrolling and browsing the app
  // while Reggie stays with them. Tapping the pill re-expands the panel.
  // Close (X) fully returns to the FAB state.
  const [minimized, setMinimized] = useState(false);
  const [msgs, setMsgs] = useState([]); // {role, content, action_proposal?}
  const [input, setInput] = useState("");
  const [nudges, setNudges] = useState([]);
  const [state, setState] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const listRef = useRef(null);
  const deviceId = getDeviceId();

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const loadStateAndHistory = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        api.get(`/assistant/state?device_id=${deviceId}`),
        api.get(`/assistant/history?device_id=${deviceId}`),
      ]);
      setState(s.data.state);
      setNudges(s.data.nudges || []);
      setMsgs(h.data.messages || []);
    } catch (e) {
      // silent — assistant is optional
    }
  }, [deviceId]);

  useEffect(() => {
    loadStateAndHistory();
  }, [loadStateAndHistory]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, msgs.length]);

  const showBadge =
    state &&
    (!state.has_favorite_teams || !state.has_roster || !state.has_logged_bet);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setSending(true);
    setInput("");
    // optimistic user bubble
    setMsgs((m) => [...m, { role: "user", content: message }]);
    scrollToBottom();
    try {
      const r = await api.post("/assistant/reggie/chat", { device_id: deviceId, message });
      const assistantMsg = {
        role: "assistant",
        content: r.data.reply || "",
      };
      if (r.data.action_proposal) assistantMsg.action_proposal = r.data.action_proposal;
      setMsgs((m) => [...m, assistantMsg]);
      // refresh state (nudges shift as user makes progress)
      loadStateAndHistory();
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: "My headset just cut out — try me again in a second." }]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const confirmProposal = async (proposal) => {
    setConfirming(true);
    try {
      const r = await api.post("/assistant/reggie/action", {
        device_id: deviceId,
        proposal_id: proposal.id,
        kind: proposal.kind,
        payload: proposal.payload,
      });
      // Remove the proposal from the last assistant message + push a system confirmation.
      setMsgs((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].action_proposal && copy[i].action_proposal.id === proposal.id) {
            copy[i] = { ...copy[i], action_proposal: null };
            break;
          }
        }
        copy.push({ role: "system", content: r.data.message || "Done." });
        return copy;
      });
      loadStateAndHistory();
    } catch (e) {
      setMsgs((m) => [...m, { role: "system", content: "That didn't save — try again." }]);
    } finally {
      setConfirming(false);
      scrollToBottom();
    }
  };

  const cancelProposal = (proposal) => {
    setMsgs((m) => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].action_proposal && copy[i].action_proposal.id === proposal.id) {
          copy[i] = { ...copy[i], action_proposal: null };
          break;
        }
      }
      copy.push({ role: "system", content: "Cancelled — no changes made." });
      return copy;
    });
  };

  const resetHistory = async () => {
    if (!window.confirm("Clear your chat with Reggie? (Doesn't touch your settings)")) return;
    try {
      await api.delete(`/assistant/history?device_id=${deviceId}`);
      setMsgs([]);
    } catch (e) {}
  };

  return (
    <>
      {/* Floating action button — full-character Reggie avatar with a
       * "Talk to me!" tooltip. The avatar itself IS the button; the label
       * hovers to its left so it doesn't shove the tap zone off-screen on
       * mobile. Larger tap target (h-16 w-16) since the illustrated
       * character reads at a different size than a plain icon. */}
      {!open && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 group">
          {/* Speech-bubble label — visible on desktop hover and always on
           * larger screens; hidden on very narrow phones so the avatar
           * doesn't crowd the frame. */}
          <span
            className="hidden sm:inline-flex items-center rounded-full bg-black/85 backdrop-blur border border-[#1e5dff]/50 px-3 py-1.5 shadow-lg pointer-events-none"
            style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "13px", color: "#fff", letterSpacing: "0.02em" }}
          >
            Talk to me!
          </span>
          <button
            onClick={() => setOpen(true)}
            data-testid={TEST_IDS.assistant.fab}
            className="relative h-16 w-16 rounded-full overflow-hidden bg-[#1e5dff] shadow-[0_10px_40px_rgba(30,93,255,0.5)] transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#F58220]"
            aria-label="Talk to Reggie"
            style={{ border: "3px solid #1e5dff" }}
          >
            <img
              src="/reggie-avatar.png"
              alt="Reggie"
              className="h-full w-full object-cover"
              draggable={false}
            />
            {showBadge && (
              <span
                data-testid={TEST_IDS.assistant.fabBadge}
                className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#ff8f3b] border-2 border-[#0f0f14] animate-pulse"
              />
            )}
          </button>
        </div>
      )}

      {/* Chat panel — expanded companion. Sits at bottom-right, does NOT
       * block the app underneath (fixed positioning + defined size). On
       * mobile we cap height so users always see ~180px of the page above
       * to preserve the "buddy along for the ride" feel. */}
      {open && !minimized && (
        <div
          data-testid={TEST_IDS.assistant.panel}
          className="fixed bottom-6 right-6 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-180px)] rounded-2xl border border-[#2d2d35] bg-[#0f0f14] shadow-[0_20px_80px_rgba(0,0,0,0.6)] flex flex-col z-40 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d2d35] bg-gradient-to-r from-[#1e5dff]/20 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full overflow-hidden shadow-[0_0_20px_rgba(30,93,255,0.5)]"
                   style={{ border: "2px solid #1e5dff" }}>
                <img src="/reggie-avatar.png" alt="Reggie" className="h-full w-full object-cover" draggable={false} />
              </div>
              <div>
                <div className="font-headline text-white text-sm">Reggie Banks</div>
                <div className="font-accent text-[9px] uppercase tracking-widest text-white/50">
                  Along for the ride
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetHistory}
                data-testid={TEST_IDS.assistant.resetHistory}
                title="Clear chat"
                className="h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {/* Minimize — keep the chat active but collapse into a pill
               * so the user can scroll the app freely. */}
              <button
                onClick={() => setMinimized(true)}
                data-testid="reggie-minimize"
                title="Minimize"
                aria-label="Minimize chat"
                className="h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setOpen(false); setMinimized(false); }}
                data-testid={TEST_IDS.assistant.close}
                title="Close"
                aria-label="Close chat"
                className="h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            data-testid={TEST_IDS.assistant.messages}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
          >
            {msgs.length === 0 && (
              <div className="text-center py-8">
                <div className="font-headline text-white text-lg mb-1">Hey. I'm Reggie.</div>
                <div className="text-white/60 text-sm max-w-[280px] mx-auto leading-relaxed">
                  Tap a chip below or just ask me anything about the app.
                  I can also save stuff for you — favorite teams, fantasy roster, bets — you talk, I load.
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className="space-y-1">
                <MessageBubble msg={m} />
                {m.action_proposal && (
                  <ActionProposalCard
                    proposal={m.action_proposal}
                    onConfirm={confirmProposal}
                    onCancel={() => cancelProposal(m.action_proposal)}
                    busy={confirming}
                  />
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-[#1a1a22] border border-[#2d2d35] rounded-2xl rounded-bl-md px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chip suggestions */}
          {nudges.length > 0 && msgs.length < 4 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {nudges.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => send(n.prompt)}
                  disabled={sending}
                  data-testid={TEST_IDS.assistant.chip(i)}
                  className="px-2.5 py-1 rounded-full border border-[#2d2d35] hover:border-[#1e5dff] hover:text-white bg-[#0b0b10] text-white/70 text-[11px] transition-colors disabled:opacity-40"
                >
                  {n.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#2d2d35] p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask me anything…"
              disabled={sending}
              data-testid={TEST_IDS.assistant.input}
              className="flex-1 bg-[#0b0b10] border border-[#2d2d35] focus:border-[#1e5dff] rounded-full px-4 py-2 text-white text-sm placeholder:text-white/30 outline-none transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              data-testid={TEST_IDS.assistant.send}
              className="h-9 w-9 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
              aria-label="Send"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Minimized companion pill — the "Reggie's along for the ride" state.
       * Chat is still active (history + context preserved), user can browse
       * the whole app underneath. Tap the pill to re-expand the full panel.
       * Shows the last thing Reggie said so users know there's a message
       * waiting even while collapsed. */}
      {open && minimized && (
        <button
          onClick={() => setMinimized(false)}
          data-testid="reggie-companion-pill"
          className="fixed bottom-6 right-6 z-40 max-w-[calc(100vw-2rem)] w-[300px] rounded-full border border-[#1e5dff]/60 bg-[#0f0f14]/95 backdrop-blur shadow-[0_10px_40px_rgba(30,93,255,0.35)] pl-1 pr-3 py-1 flex items-center gap-2 hover:border-[#1e5dff] transition-colors group"
        >
          {/* Avatar with live dot — "he's still here" indicator */}
          <div className="relative flex-shrink-0">
            <div
              className="h-10 w-10 rounded-full overflow-hidden"
              style={{ border: "2px solid #1e5dff" }}
            >
              <img src="/reggie-avatar.png" alt="Reggie" className="h-full w-full object-cover" draggable={false} />
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#0f0f14]"
              aria-label="Reggie is active"
              title="Along for the ride"
            />
          </div>
          {/* Preview line — last Reggie message truncated, or default hint */}
          <div className="min-w-0 flex-1 text-left">
            <div className="font-accent text-[8px] uppercase tracking-[0.28em] text-[#1e5dff]">
              Reggie
            </div>
            <div className="text-white/85 text-[12px] leading-tight truncate" style={{ fontFamily: "Rajdhani", fontWeight: 500 }}>
              {(() => {
                const last = [...msgs].reverse().find(m => m.role === "assistant");
                return last?.content?.slice(0, 60) || "Tap to keep chatting";
              })()}
            </div>
          </div>
          {/* Close (fully) — separate from the tap-to-expand action */}
          <span
            onClick={(e) => { e.stopPropagation(); setOpen(false); setMinimized(false); }}
            role="button"
            aria-label="Close chat"
            data-testid="reggie-companion-close"
            className="h-7 w-7 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        </button>
      )}
    </>
  );
}
