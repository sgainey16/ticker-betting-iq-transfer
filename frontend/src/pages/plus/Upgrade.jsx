// Upgrade — the paywall destination when someone taps "Go Deeper".
// Not a real Stripe flow yet — just a well-designed landing that shows what
// Ticker+ unlocks, and a "Simulate upgrade" button that flips the local flag
// so the demo can walk through the unlocked state on the same device.

import { Link } from "react-router-dom";
import { Check, ChevronLeft, Sparkles } from "lucide-react";
import { useUserProfile } from "@/lib/userProfile";

const FEATURES = [
  { free: false, plus: true, label: "Full prospect scout reports (film notes, comps, dev notes)" },
  { free: false, plus: true, label: "Advanced analytics on any game (Game Control Score, xG, coverage)" },
  { free: false, plus: true, label: "Your prediction record & tracked picks" },
  { free: false, plus: true, label: "Personal Monday briefing tailored to your teams" },
  { free: false, plus: true, label: "Early access — Friday desk show drops 24h before public" },
  { free: false, plus: true, label: "Ad-free experience across the app" },
  { free: true,  plus: true, label: "The full show — Reggie & Marc audio, all recaps, highlights" },
  { free: true,  plus: true, label: "Team pages, division cascades, scoreboards" },
];

export default function Upgrade() {
  const { profile, updateProfile } = useUserProfile();
  const hasPlus = profile.interests?.includes("has_plus");

  const simulate = () => {
    const next = new Set([...(profile.interests || []), "has_plus"]);
    updateProfile({ interests: [...next] });
  };

  const revoke = () => {
    updateProfile({ interests: (profile.interests || []).filter(x => x !== "has_plus") });
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8">
        <Link
          data-testid="upgrade-back"
          to="/plus/your-ticker"
          className="inline-flex items-center gap-1.5 font-accent text-[9px] uppercase tracking-[0.28em] text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3 h-3" /> Your Ticker
        </Link>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F58220]/10 border border-[#F58220]/30 px-3 py-1 mb-5">
            <Sparkles className="w-3 h-3 text-[#F58220]" />
            <span className="font-accent text-[10px] uppercase tracking-[0.32em] text-[#F58220]">Ticker+</span>
          </div>
          <div className="font-headline text-white text-4xl md:text-5xl leading-[1.05]">
            Go deeper on the game you already love.
          </div>
          <div className="font-accent text-sm uppercase tracking-[0.22em] text-white/55 mt-4 max-w-lg mx-auto">
            The show stays free. Ticker+ unlocks the office — scout reports, analytics, your record.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PricingCard
            title="Ticker+"
            subtitle="Monthly"
            price="$6"
            per="/month"
            testid="price-monthly"
          />
          <PricingCard
            title="Ticker+"
            subtitle="Annual"
            price="$50"
            per="/year"
            highlight="Save $22"
            testid="price-annual"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/40 p-5 space-y-2">
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85 mb-3">
            What's included
          </div>
          {FEATURES.map((f, i) => (
            <div key={i} className={`flex items-center gap-3 py-1 ${f.free ? "text-white/50" : "text-white"}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${f.free ? "bg-white/10" : "bg-[#F58220]"}`}>
                <Check className={`w-2.5 h-2.5 ${f.free ? "text-white/40" : "text-black"}`} />
              </div>
              <span className="text-[13px]">{f.label}</span>
              {f.free && <span className="ml-auto font-accent text-[9px] uppercase tracking-[0.28em] text-white/30">Free</span>}
              {!f.free && <span className="ml-auto font-accent text-[9px] uppercase tracking-[0.28em] text-[#F58220]">Plus</span>}
            </div>
          ))}
        </div>

        {/* Demo simulator — clearly flagged so nobody thinks it's real Stripe */}
        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5 text-center">
          <div className="font-accent text-[9px] uppercase tracking-[0.32em] text-white/45 mb-2">
            Prototype · No payment collected
          </div>
          {hasPlus ? (
            <>
              <div className="font-headline text-emerald-400 text-lg mb-3">
                Ticker+ active (simulated)
              </div>
              <button
                data-testid="upgrade-revoke"
                onClick={revoke}
                className="rounded-full border border-white/15 bg-black/40 px-5 py-2 font-accent text-[10px] uppercase tracking-[0.28em] text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Turn off Ticker+ (for demo)
              </button>
            </>
          ) : (
            <button
              data-testid="upgrade-simulate"
              onClick={simulate}
              className="rounded-full bg-[#F58220] text-black px-6 py-2.5 font-accent text-[10px] uppercase tracking-[0.3em] hover:bg-[#ff9042] transition-colors shadow-[0_10px_30px_-6px_rgba(245,130,32,0.6)]"
            >
              Simulate Ticker+ upgrade
            </button>
          )}
          <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/35 mt-3">
            Real Stripe wiring lands after v1 pilots
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ title, subtitle, price, per, highlight, testid }) {
  return (
    <div
      data-testid={testid}
      className={`rounded-xl border-2 bg-black/40 p-5 ${highlight ? "border-[#F58220]" : "border-white/10"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-accent text-[10px] uppercase tracking-[0.32em] text-white/85">{title}</div>
          <div className="font-accent text-[9px] uppercase tracking-[0.28em] text-white/45 mt-0.5">{subtitle}</div>
        </div>
        {highlight && (
          <span className="rounded-full bg-[#F58220] text-black px-2.5 py-0.5 font-accent text-[9px] uppercase tracking-[0.24em]">
            {highlight}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1">
        <span className="font-headline text-white text-4xl leading-none">{price}</span>
        <span className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/45 pb-1">{per}</span>
      </div>
    </div>
  );
}
