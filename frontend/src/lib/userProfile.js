// User Profile Hook + Store
// -----------------------------------------------------------------------------
// LocalStorage-backed profile for Ticker+ personalization. Intentionally
// account-less at this stage — the whole personalization flywheel works
// without a login. Account creation is a later, opt-in step that syncs the
// profile across devices and unlocks Ticker+.
//
// Contract:
//   useUserProfile() → { profile, setProfile, updateProfile, clearProfile, isOnboarded }
//
// Anyone in the tree who needs personalization reads from here.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ticker.userProfile.v1";

const EMPTY = {
  nickname: "",
  nhl_team: null,           // "BOS"
  chl_teams: [],            // ["KAM", "VIC"]
  ncaa_teams: [],           // ["BU"]
  prospects: [],            // ["oliver-kaid"]
  interests: [],            // ["prospects", "betting_iq", "analytics", "highlights"]
  onboarded_at: null,       // ISO timestamp when reveal completed
  version: 1,
};

function readStorage() {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    // Merge with EMPTY so missing keys added by later versions get defaults.
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

function writeStorage(p) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    // Tell same-tab listeners (localStorage events only fire cross-tab natively).
    window.dispatchEvent(new CustomEvent("ticker:profile-change", { detail: p }));
  } catch { /* quota / private mode */ }
}

export function useUserProfile() {
  const [profile, setProfileState] = useState(readStorage);

  useEffect(() => {
    const onChange = (e) => setProfileState(e.detail ?? readStorage());
    const onStorage = () => setProfileState(readStorage());
    window.addEventListener("ticker:profile-change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("ticker:profile-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setProfile = useCallback((next) => {
    writeStorage(next);
    setProfileState(next);
  }, []);

  const updateProfile = useCallback((patch) => {
    setProfileState((prev) => {
      const merged = { ...prev, ...patch };
      writeStorage(merged);
      return merged;
    });
  }, []);

  const clearProfile = useCallback(() => {
    writeStorage(EMPTY);
    setProfileState(EMPTY);
  }, []);

  const isOnboarded = Boolean(profile.onboarded_at);

  return { profile, setProfile, updateProfile, clearProfile, isOnboarded };
}
