// iOS install nudge — teaches users how to escape Safari's chrome.
// -----------------------------------------------------------------------------
// The single biggest UX pain point users have reported is landscape Safari
// on iPhone: the browser's URL bar + tab bar sit on top of the app content,
// and any swipe near them kicks the user out to the iOS home screen or the
// tab switcher. The fix is Add-to-Home-Screen: once installed, the app runs
// standalone (no chrome, no accidental gestures).
//
// This component detects iOS Safari (not already in standalone mode) and
// shows a compact bottom banner with the exact two-tap instructions. Users
// can dismiss it; the dismissal is remembered for 14 days so we don't nag.

import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

const STORAGE_KEY = "ticker.installPrompt.dismissedUntil";
const HIDE_DAYS = 14;

function detectIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  // Chrome iOS reports "CriOS", Firefox reports "FxiOS" — those still use
  // WebKit but don't support add-to-home-screen the same way.
  const isSafari = !/CriOS|FxiOS|EdgiOS/.test(ua);
  // Already installed (standalone or PWA) — nothing to prompt.
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  return isIos && isSafari && !isStandalone;
}

function readDismissedUntil() {
  if (typeof window === "undefined") return 0;
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY) || 0);
  } catch { return 0; }
}
function writeDismissedUntil(ts) {
  try { window.localStorage.setItem(STORAGE_KEY, String(ts)); }
  catch { /* quota */ }
}

export default function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!detectIosSafari()) return;
    if (Date.now() < readDismissedUntil()) return;
    // Small delay so it doesn't fight the initial page load animation.
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    const until = Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000;
    writeDismissedUntil(until);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="ios-install-prompt"
      className="fixed bottom-3 left-3 right-3 md:left-auto md:right-4 md:w-[380px] z-[70] rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: "linear-gradient(135deg, #14141c 0%, #0b0b10 100%)",
        border: "1px solid rgba(245,130,32,0.35)",
        boxShadow: "0 12px 40px -8px rgba(245,130,32,0.35)",
      }}
    >
      <div className="p-3.5 pr-11 relative">
        {/* Close */}
        <button
          onClick={dismiss}
          data-testid="ios-install-dismiss"
          className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
          Better on Home Screen
        </div>
        <div className="mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "15px", color: "#fff", lineHeight: 1.3 }}>
          Install The Ticker so Safari's chrome stops getting in your way — full-screen, no accidental swipes.
        </div>

        {/* Two-step, laid out like actual iOS UI */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2 rounded-md border border-white/8 bg-black/40 px-2.5 py-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-white/90"
                  style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px" }}>
              1
            </span>
            <span className="text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px" }}>
              Tap
            </span>
            <Share className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px" }}>
              in the Safari bar
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/8 bg-black/40 px-2.5 py-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-white/90"
                  style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px" }}>
              2
            </span>
            <span className="text-white/85" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px" }}>
              Choose
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-white/90"
                  style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "12px" }}>
              <Plus className="w-3 h-3" /> Add to Home Screen
            </span>
          </div>
        </div>

        <div className="mt-2.5 text-white/40"
             style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.24em" }}>
          Dismisses for 14 days
        </div>
      </div>
    </div>
  );
}
