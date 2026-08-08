// Signals — the mechanism that lets The Ticker learn what each user cares about.
// -----------------------------------------------------------------------------
// Philosophy (from the user, Feb 2026):
//   "You will see what the user likes and adjust site to fit users wants."
//
// Every high-value user action across the app emits a small signal event. Over
// time these signals accrue into a league-affinity map + prospect-affinity map
// that other surfaces (UnifiedTopPlays, Beyond the NHL, YourTicker, etc.) read
// to reweight what climbs into the flagship. Users never see a "preferences"
// screen for this — it just happens.
//
// This is client-side only for now. Same shape will migrate to a server
// endpoint later; the hook signature won't change.
//
// Signal kinds emitted today:
//   • "tenten_vote"    — a user cast one of the ten daily-quiz votes
//   • "weekly_vote"    — a user voted in Fight/Goal/Play/Star Power
//   • "prospect_view"  — a user opened a prospect page (implicit interest)
//   • "roots_ribbon"   — a Roots ribbon lit up + was seen (rendered, not clicked)
//
// Half-life: signals decay linearly over 30 days. Recent signal beats old signal.
// A vote from today counts 1.0. A vote from 15 days ago counts 0.5. A vote from
// 30+ days ago drops to zero. This keeps the model responsive to recency.

import { useEffect, useState } from "react";

const STORAGE_KEY = "ticker.signals.v1";
const HALF_LIFE_DAYS = 30;
const MAX_STORED = 400;   // ring-buffer cap so localStorage doesn't blow up

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readAll() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeAll(events) {
  if (typeof window === "undefined") return;
  // Keep newest MAX_STORED events. Older ones fall off — same as old signals
  // stop counting anyway (30-day half life).
  const trimmed = events.slice(-MAX_STORED);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); }
  catch { /* quota */ }
  // Fire a custom event so any live hook instances re-read.
  try { window.dispatchEvent(new Event("ticker.signals.updated")); } catch {}
}

// ---------------------------------------------------------------------------
// Public API — emit a signal from anywhere in the app.
// ---------------------------------------------------------------------------
// Example: emitSignal({ kind: "weekly_vote", league: "WHL", target: "oliver-goal" })

export function emitSignal({ kind, league = null, target = null, prospect = null, weight = 1 }) {
  if (!kind) return;
  const ev = {
    kind,
    league,
    target,
    prospect,
    weight,
    ts: Date.now(),
  };
  const all = readAll();
  all.push(ev);
  writeAll(all);
}

// ---------------------------------------------------------------------------
// Reactive hook — components subscribe to signal state changes.
// ---------------------------------------------------------------------------

export function useSignals() {
  const [events, setEvents] = useState(readAll);

  useEffect(() => {
    // Storage-event catches changes from other tabs; the custom event catches
    // changes from within the same tab (React state doesn't cross Zustand-free
    // component boundaries).
    const onChange = () => setEvents(readAll());
    window.addEventListener("storage", onChange);
    window.addEventListener("ticker.signals.updated", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("ticker.signals.updated", onChange);
    };
  }, []);

  const affinity = computeLeagueAffinity(events);
  const prospectAffinity = computeProspectAffinity(events);

  return {
    events,
    affinity,
    prospectAffinity,
    // Convenience helpers surfaces can use in-render:
    leagueBoost: (league) => affinity[league] || 0,
    hasVotedFor: (target) => events.some(e => e.target === target),
    lastVoteForLeague: (league) => events.filter(e => e.league === league).slice(-1)[0]?.target || null,
  };
}

// ---------------------------------------------------------------------------
// Aggregation — turn the raw event stream into affinity scores.
// ---------------------------------------------------------------------------

function decayWeight(ts) {
  const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  if (ageDays >= HALF_LIFE_DAYS) return 0;
  return Math.max(0, 1 - ageDays / HALF_LIFE_DAYS);
}

// League affinity — sum of decayed signal weights per league. Values are
// unbounded but typical strong preferences land in the 5-15 range. Consumers
// should treat this as a relative score, not an absolute.
export function computeLeagueAffinity(events) {
  const out = {};
  for (const e of events) {
    if (!e.league) continue;
    const w = decayWeight(e.ts) * (e.weight || 1);
    if (w <= 0) continue;
    out[e.league] = (out[e.league] || 0) + w;
  }
  return out;
}

// Prospect affinity — same, but keyed on prospect id. Lets prospect pages
// and ribbons know "you've voted for Petrov twice in the last week".
export function computeProspectAffinity(events) {
  const out = {};
  for (const e of events) {
    if (!e.prospect) continue;
    const w = decayWeight(e.ts) * (e.weight || 1);
    if (w <= 0) continue;
    out[e.prospect] = (out[e.prospect] || 0) + w;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reset — dev / debug only. Wire behind a Back-Office button later.
// ---------------------------------------------------------------------------
export function clearSignals() {
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch {}
  try { window.dispatchEvent(new Event("ticker.signals.updated")); } catch {}
}
