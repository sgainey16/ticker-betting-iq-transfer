import { useEffect, useState } from "react";
import { X, Rocket, Info } from "lucide-react";
import { TEST_IDS } from "@/lib/config";

// Persistent banner across every page — communicates that early users are
// inside the free launch window and paid features will flip on later.
// Dismissible per-device (localStorage). Re-appears after 14 days so users
// see the notice again before a pricing change (heuristic — replace with
// server-driven "pricing_flip_date" once the founding-member count launches).

const DISMISS_KEY = "ticker.launch_zone.dismissed_at";
const REAPPEAR_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export default function LaunchZoneBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return setVisible(true);
      const dismissedAt = parseInt(raw, 10);
      if (!Number.isFinite(dismissedAt)) return setVisible(true);
      if (Date.now() - dismissedAt > REAPPEAR_MS) return setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid={TEST_IDS.launchZone.banner}
      className="relative border-b border-[#1e5dff]/40 bg-gradient-to-r from-[#0b0b10] via-[#101625] to-[#0b0b10] landscape:hidden"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#1e5dff]/15 border border-[#1e5dff]/60">
          <Rocket className="w-3 h-3 text-[#1e5dff]" />
          <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#1e5dff]">
            Founding Member Zone
          </span>
        </div>
        <div className="text-white/85 text-xs sm:text-sm flex-1 min-w-0">
          You&rsquo;re inside the free launch window &mdash; full access, no charge. When paid features flip on (prediction voting, Reggie analytics, deep-dive), we&rsquo;ll tell you before it happens. <span className="text-white/50">No surprise bills. Promise.</span>
        </div>
        <button
          type="button"
          data-testid={TEST_IDS.launchZone.learnMore}
          onClick={() => setShowDetail((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] font-accent uppercase tracking-widest text-white/60 hover:text-white transition-colors"
        >
          <Info className="w-3 h-3" />
          {showDetail ? "Hide" : "Details"}
        </button>
        <button
          type="button"
          data-testid={TEST_IDS.launchZone.dismiss}
          onClick={dismiss}
          aria-label="Dismiss"
          className="h-6 w-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showDetail && (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-3 -mt-1 text-xs text-white/70 space-y-1">
          <div>
            <span className="font-accent uppercase tracking-widest text-[10px] text-[#00e5ff] mr-2">Free during launch</span>
            Broadcast · Press Conference · Stats · Predictions voting · Reggie casual chat
          </div>
          <div>
            <span className="font-accent uppercase tracking-widest text-[10px] text-[#1E5BFF] mr-2">Flipping to Founding Member</span>
            Deep Dive analytics · Betting IQ · Fantasy Tracker · leaderboards history
          </div>
          <div className="text-white/60 italic pl-1 pt-0.5 border-l-2 border-[#1E5BFF]/40 ml-2 mt-1.5">
            &ldquo;Every other tool studies the game. We study <span className="text-white not-italic font-headline">you</span>. Your patterns, your blind spots, your history. That&rsquo;s how you actually get better.&rdquo;
          </div>
          <div className="text-white/40">
            First 1,000&ndash;2,000 signups keep every launch feature free for life. Details lock in when the counter goes live.
          </div>
        </div>
      )}
    </div>
  );
}
