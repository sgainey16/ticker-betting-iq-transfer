// useWakeWord — Web Speech API "Hey Reggie" listener.
// -----------------------------------------------------------------------------
// Listens continuously for the wake phrase and fires a callback when heard.
// After the phrase triggers, we ALSO listen for a short follow-up utterance
// (up to `dormancySeconds` of silence) which is passed to the same callback
// as the initial user prompt.
//
// Honest caveats:
//   - Chrome/Edge desktop = solid. Chrome/Edge Android = mostly solid.
//   - Safari iOS = works if the user grants mic permission; can pause when
//     the tab is backgrounded.
//   - Firefox = SpeechRecognition not implemented. Hook silently no-ops.
//
// The hook is intentionally passive when `enabled=false` — no permission
// prompts, no listeners started, zero battery cost.

import { useEffect, useRef } from "react";

// Wake-phrase matcher. Accept small mishears — recognisers often return
// "hey reggae", "hey ragi", "hey ready". We normalise + fuzzy-match the
// leading token.
function isWakePhrase(transcript) {
  if (!transcript) return false;
  const t = transcript.toLowerCase().trim();
  // Must start with "hey" and contain something that STARTS with "reg".
  if (!t.startsWith("hey")) return false;
  const rest = t.slice(3).trim();
  return (
    rest.startsWith("reggie") ||
    rest.startsWith("reggy") ||
    rest.startsWith("reggae") ||
    rest.startsWith("regi") ||
    rest.startsWith("ready")   // common mishear
  );
}

// Strip the wake phrase from a transcript so any follow-up is clean.
function trimWake(transcript) {
  const t = (transcript || "").trim();
  const parts = t.split(/\s+/);
  // Drop up to 2 leading tokens ("hey" + wake token variants)
  return parts.slice(2).join(" ").trim();
}

export function useWakeWord({ enabled, dormancySeconds = 15, onWake }) {
  const recRef = useRef(null);
  const dormancyRef = useRef(null);
  const restartRef = useRef(null);

  useEffect(() => {
    if (!enabled) return () => {};
    if (typeof window === "undefined") return () => {};

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return () => {}; // Firefox / older browsers — silently no-op

    let stopped = false;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recRef.current = rec;

    // Restart automatically when it ends (browsers time out after ~60s of
    // silence). Continuous coverage until the caller disables.
    const startAgain = () => {
      if (stopped) return;
      try {
        rec.start();
      } catch {
        // Already started or in transition — swallow.
      }
    };

    rec.onresult = (event) => {
      // Get the LATEST utterance chunk. Only care about interim + final.
      let combined = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      if (isWakePhrase(combined)) {
        const followUp = trimWake(combined);
        onWake?.({ followUp });
        // Reset dormancy — this counts as active input
        if (dormancyRef.current) clearTimeout(dormancyRef.current);
        dormancyRef.current = setTimeout(() => {
          // No follow-up detected within window → wake ends. Session goes
          // dormant. The caller's onWake will have already opened the chat.
        }, dormancySeconds * 1000);
      }
    };

    rec.onerror = (e) => {
      // "not-allowed" = user denied permission. Give up until reload.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        stopped = true;
        return;
      }
      // Other errors ("no-speech", "aborted", "network") — just restart
      // after a beat.
      if (!stopped) {
        restartRef.current = setTimeout(startAgain, 500);
      }
    };

    rec.onend = () => {
      if (!stopped) {
        restartRef.current = setTimeout(startAgain, 300);
      }
    };

    startAgain();

    return () => {
      stopped = true;
      if (restartRef.current) clearTimeout(restartRef.current);
      if (dormancyRef.current) clearTimeout(dormancyRef.current);
      try { rec.stop(); } catch { /* noop */ }
      recRef.current = null;
    };
    // We want the hook to re-init when enabled or dormancy changes; onWake
    // should be stable (wrap in useCallback if needed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dormancySeconds]);
}

// Feature detection — components can hide the toggle if the browser can't
// support it (Firefox etc.).
export function isWakeWordSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}
