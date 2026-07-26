// Stable per-browser device id — the current stand-in for "user account"
// until real auth ships. Backed by localStorage so free-question counters
// and premium activation persist across reloads.
const KEY = "ticker.device_id";
const VISITS_KEY = "ticker.visits";
const FIRST_SEEN_KEY = "ticker.first_seen";

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

/**
 * Increments the local visit counter for the given "scope" (e.g. "presser",
 * "home") and returns the resulting count. Also stamps first_seen on first
 * ever call. Used for the Presser "Welcome back" header + future taper.
 */
export function trackVisit(scope = "app") {
  try {
    if (!localStorage.getItem(FIRST_SEEN_KEY)) {
      localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
    }
    const raw = localStorage.getItem(VISITS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[scope] = (map[scope] || 0) + 1;
    localStorage.setItem(VISITS_KEY, JSON.stringify(map));
    return map[scope];
  } catch {
    return 1;
  }
}

export function getVisitCount(scope = "app") {
  try {
    const raw = localStorage.getItem(VISITS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw);
    return map[scope] || 0;
  } catch {
    return 0;
  }
}

export function getFirstSeen() {
  try {
    const v = localStorage.getItem(FIRST_SEEN_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
