// Reusable "Make a call" panel. Same Phase 0 event pipeline as before —
// extracted so it can render from Tonight, from a Reggie/Marc chat card,
// from Fantasy roster decisions, and from a Community reply thread.
//
// Contract:
//   game    → { id, home, away }
//   teams   → array of { code, name } for the label
//   onDone  → optional callback when the call is locked (or user cancels)
//   compact → optional; use tighter spacing for embedded contexts

import { useState } from "react";
import { CheckCircle2, Lock, Eye, EyeOff, Globe } from "lucide-react";
import { api } from "@/lib/api";

export default function MakeCallPanel({ deviceId, game, teams = [], onDone, compact = false }) {
  const teamMeta = (code) => teams.find((t) => t.code === code) || {};
  const home = teamMeta(game.home);
  const away = teamMeta(game.away);
  const homeName = home.name || game.home;
  const awayName = away.name || game.away;

  const [step, setStep] = useState("instinct");   // instinct | reason | lock | done
  const [callId, setCallId] = useState(null);
  const [pick, setPick] = useState(null);
  const [reasoning, setReasoning] = useState("");
  const [confidence, setConfidence] = useState(6);
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const startCall = async (whichSide) => {
    setBusy(true); setErr("");
    try {
      const r = await api.post("/iq/call/event", {
        device_id: deviceId, call_id: null, kind: "instinct_captured",
        call_kind: "game_pick",
        subject: { game_id: game.id, home: game.home, away: game.away },
        payload: { pick: whichSide }, source: "tap",
      });
      setCallId(r.data.call.id);
      setPick(whichSide);
      setStep("reason");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't start the call.");
    } finally { setBusy(false); }
  };

  const submitReasoning = async () => {
    setBusy(true); setErr("");
    try {
      if (reasoning.trim()) {
        await api.post("/iq/call/event", {
          device_id: deviceId, call_id: callId, kind: "reasoning_added",
          payload: { text: reasoning.trim(), tags: [] }, source: "tap",
        });
      }
      await api.post("/iq/call/event", {
        device_id: deviceId, call_id: callId, kind: "confidence_set",
        payload: { value: confidence }, source: "tap",
      });
      setStep("lock");
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't save reasoning.");
    } finally { setBusy(false); }
  };

  const lockCall = async () => {
    setBusy(true); setErr("");
    try {
      await api.post("/iq/call/event", {
        device_id: deviceId, call_id: callId, kind: "locked",
        payload: {
          explicit: true,
          ui_action: "iq_make_call_lock_button",
          confirmation_prompt: `Lock ${pick === game.home ? homeName : awayName}?`,
          user_response: "confirmed",
        },
        source: "tap",
      });
      if (visibility !== "private") {
        await api.patch(`/iq/call/${callId}/visibility`, { device_id: deviceId, visibility });
      }
      setStep("done");
      // Hold the confirmation on screen briefly before firing onDone so
      // the user actually sees the "On the record" state even when the
      // parent tab wants to navigate away (e.g., cold-start → My IQ).
      setTimeout(() => { onDone?.({ callId, pick, confidence, visibility }); }, 1500);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Couldn't lock the call.");
    } finally { setBusy(false); }
  };

  const pad = compact ? "p-4" : "p-5 sm:p-6";

  return (
    <div className={`rounded-xl bg-gradient-to-br from-[#0e1533]/70 to-[#050510]/70 border border-[#1e5dff]/30 ${pad}`}
         data-testid="iq-make-a-call">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff] mb-1">
            {step === "done" ? "Locked in" : "Make a call"}
          </div>
          <div className="font-headline text-white text-base sm:text-lg leading-tight">
            {awayName} @ {homeName}
          </div>
        </div>
      </div>

      {err && <div className="text-rose-300 text-xs mb-3">{err}</div>}

      {step === "instinct" && (
        <div>
          <div className="text-white/70 text-sm mb-2.5">Who wins?</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => startCall(game.away)} disabled={busy}
              data-testid="iq-mkcall-pick-away"
              className="rounded-lg bg-black/40 border border-white/15 hover:border-[#1e5dff] hover:bg-[#1e5dff]/10 p-3 transition-colors text-left">
              <div className="font-accent text-[9px] uppercase tracking-widest text-white/50">Away</div>
              <div className="font-headline text-white text-base mt-0.5">{awayName}</div>
            </button>
            <button onClick={() => startCall(game.home)} disabled={busy}
              data-testid="iq-mkcall-pick-home"
              className="rounded-lg bg-black/40 border border-white/15 hover:border-[#1e5dff] hover:bg-[#1e5dff]/10 p-3 transition-colors text-left">
              <div className="font-accent text-[9px] uppercase tracking-widest text-white/50">Home</div>
              <div className="font-headline text-white text-base mt-0.5">{homeName}</div>
            </button>
          </div>
        </div>
      )}

      {step === "reason" && (
        <div className="space-y-3">
          <div className="text-white/70 text-sm">
            You said <span className="font-headline text-white">{pick === game.home ? homeName : awayName}</span>. Why?
          </div>
          <textarea value={reasoning} onChange={(e) => setReasoning(e.target.value)}
            placeholder="Optional — one line. Marc will hold you to it."
            rows={2} data-testid="iq-mkcall-reasoning"
            className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#1e5dff]" />
          <label className="block">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Confidence</span>
              <span className="font-headline text-white">{confidence}/10</span>
            </div>
            <input type="range" min="1" max="10" value={confidence}
              onChange={(e) => setConfidence(parseInt(e.target.value, 10))}
              data-testid="iq-mkcall-confidence" className="w-full accent-[#1e5dff]" />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={submitReasoning} disabled={busy} data-testid="iq-mkcall-continue"
              className="px-4 py-2 rounded-md bg-[#1e5dff] hover:bg-[#3574ff] text-white font-accent text-[11px] uppercase tracking-widest transition-colors">
              {busy ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === "lock" && (
        <div className="space-y-3">
          <div className="rounded-md bg-black/30 border border-white/10 p-3">
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/40 mb-0.5">Your call</div>
            <div className="font-headline text-white text-base">{pick === game.home ? homeName : awayName}</div>
            <div className="text-white/60 text-xs">Confidence {confidence}/10{reasoning ? ` · "${reasoning}"` : ""}</div>
          </div>
          <div>
            <div className="font-accent text-[10px] uppercase tracking-widest text-white/50 mb-2">Who sees it</div>
            <div className="grid gap-2">
              <VisOpt v="private" cur={visibility} on={setVisibility} icon={EyeOff}
                label="Just me" sub="Counts toward My IQ." />
              <VisOpt v="public" cur={visibility} on={setVisibility} icon={Globe}
                label="Public" sub="Community sees it. Builds community credibility when it resolves." />
              <VisOpt v="anonymous_aggregate" cur={visibility} on={setVisibility} icon={Eye}
                label="Anonymous" sub="Signal shared, identity hidden." />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={lockCall} disabled={busy} data-testid="iq-mkcall-lock"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-accent text-[11px] uppercase tracking-widest transition-colors">
              <Lock className="w-3.5 h-3.5" />
              {busy ? "Locking…" : "Lock it in"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-2">
          <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-1" />
          <div className="font-headline text-white text-base">On the record.</div>
          <div className="text-white/60 text-xs mt-0.5">
            {visibility === "private" && "Just you. Marc will read it when it resolves."}
            {visibility === "public"  && "Live on the community feed."}
            {visibility === "anonymous_aggregate" && "Signal shared. Identity hidden."}
          </div>
        </div>
      )}
    </div>
  );
}

function VisOpt({ v, cur, on, icon: Icon, label, sub }) {
  const active = v === cur;
  return (
    <button onClick={() => on(v)} data-testid={`iq-mkcall-vis-${v}`}
      className={`text-left rounded-md border p-2.5 transition-colors flex items-start gap-2 ${
        active ? "bg-[#1e5dff]/15 border-[#1e5dff]" : "bg-black/30 border-white/10 hover:border-white/25"
      }`}>
      <Icon className={`w-4 h-4 mt-0.5 ${active ? "text-[#1e5dff]" : "text-white/50"}`} />
      <div>
        <div className={`font-accent text-[11px] uppercase tracking-widest ${active ? "text-white" : "text-white/70"}`}>{label}</div>
        <div className="text-white/50 text-xs mt-0.5">{sub}</div>
      </div>
    </button>
  );
}
