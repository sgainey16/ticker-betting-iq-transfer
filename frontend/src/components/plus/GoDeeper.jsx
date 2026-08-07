// GoDeeper — the reusable paywall surface.
// Lives inside any content unit at the highest-intent moment. Free users see
// a preview + soft prompt; Ticker+ users see the full content. For the demo,
// Ticker+ status is a client-side flag on the profile ("interests" bucket).
// Real Stripe wiring comes later.

import { Lock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useUserProfile } from "@/lib/userProfile";

export function GoDeeper({ title, previewLines = [], full, cta = "Read the full scout report" }) {
  const { profile } = useUserProfile();
  // Placeholder gate — real check will hit the account.
  const hasPlus = profile.interests?.includes("has_plus");

  if (hasPlus && full) {
    return (
      <div data-testid="go-deeper-unlocked" className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-emerald-400">Ticker+ · Deep Dive</span>
        </div>
        <div className="font-headline text-white text-lg leading-snug mb-2">{title}</div>
        <div className="prose prose-invert prose-sm max-w-none text-white/85 leading-relaxed">
          {full}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="go-deeper-locked" className="mt-6 rounded-xl border border-[#F58220]/25 bg-gradient-to-br from-[#F58220]/10 via-transparent to-transparent p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-3.5 h-3.5 text-[#F58220]" />
        <span className="font-accent text-[10px] uppercase tracking-[0.3em] text-[#F58220]">Ticker+ · Go Deeper</span>
      </div>
      <div className="font-headline text-white text-lg leading-snug mb-2">{title}</div>
      <ul className="space-y-1.5 mb-4">
        {previewLines.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-white/75 text-sm">
            <span className="text-[#F58220] mt-0.5">›</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <Link
        data-testid="go-deeper-cta"
        to="/plus/upgrade"
        className="inline-flex items-center gap-2 rounded-full bg-[#F58220] text-black px-5 py-2 font-accent text-[10px] uppercase tracking-[0.3em] hover:bg-[#ff9042] transition-colors shadow-[0_6px_24px_-6px_rgba(245,130,32,0.6)]"
      >
        {cta}
      </Link>
      <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/40 mt-3">
        Ticker+ · $6/mo · Ad-free · Full reports · Early access
      </div>
    </div>
  );
}
