// Stable per-browser device id — the current stand-in for "user account"
// until real auth ships. Backed by localStorage so free-question counters
// and premium activation persist across reloads.
const KEY = "ticker.device_id";

export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        (crypto?.randomUUID?.() ?? "") ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Non-browser / privacy modes → ephemeral id.
    return "anon_" + Math.random().toString(36).slice(2);
  }
}
