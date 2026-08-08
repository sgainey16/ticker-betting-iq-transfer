// Voice Settings — Back Office prefs for Reggie's voice UX.
// -----------------------------------------------------------------------------
// Every voice feature is OPT-IN. Nobody gets forced into talking to their
// phone. Fans in public/quiet spaces can leave everything off and use text.
//
// Stored in localStorage separately from the userProfile so it survives
// profile resets and stays device-scoped (voice permissions are per-device
// anyway). Emits a `ticker:voiceSettings-change` event whenever anything
// flips so components can react without prop-drilling.

const KEY = "ticker.voiceSettings.v1";

const DEFAULTS = {
  wake_word_enabled: false,      // "Hey Reggie" listener — OFF by default
  wake_word_uses: 0,             // count of successful voice activations
  mic_button_override: null,     // null = auto (show until 3 uses); true/false = manual
  voice_replies_muted: false,    // when true, TTS/audio replies from Reggie stay silent
  dormancy_seconds: 15,          // idle timeout before the mic session sleeps
};

function safeRead() {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function safeWrite(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("ticker:voiceSettings-change", { detail: next }));
  } catch {
    // localStorage full or blocked — silently ignore; settings are non-critical.
  }
}

export function readVoiceSettings() {
  return safeRead();
}

export function updateVoiceSettings(patch) {
  const next = { ...safeRead(), ...patch };
  safeWrite(next);
  return next;
}

export function incrementWakeWordUses() {
  const s = safeRead();
  const next = { ...s, wake_word_uses: (s.wake_word_uses || 0) + 1 };
  safeWrite(next);
  return next;
}

// Should the visible FAB show? Rules:
//   - If user explicitly overrode (true/false), respect that.
//   - Else auto-hide once wake word has been used 3+ times AND is enabled
//     (progressive disclosure — power users don't need training wheels).
export function shouldShowMicFab(s) {
  const settings = s || safeRead();
  if (settings.mic_button_override === true) return true;
  if (settings.mic_button_override === false) return false;
  if (settings.wake_word_enabled && (settings.wake_word_uses || 0) >= 3) return false;
  return true;
}

// React hook — subscribes to changes so any component reflects the latest.
import { useEffect, useState } from "react";

export function useVoiceSettings() {
  const [settings, setSettings] = useState(() => safeRead());
  useEffect(() => {
    const on = (e) => setSettings(e.detail || safeRead());
    window.addEventListener("ticker:voiceSettings-change", on);
    return () => window.removeEventListener("ticker:voiceSettings-change", on);
  }, []);
  return {
    settings,
    update: updateVoiceSettings,
    incrementUses: incrementWakeWordUses,
    showFab: shouldShowMicFab(settings),
  };
}
