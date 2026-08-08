// Reels — the highlight video hub. Currently a shell that reserves the tab.
// -----------------------------------------------------------------------------
// Real reel content lands as we curate: Top 10 Tonight, Player Reels, Team
// Reels, League Reels, My Reel. Voting on reels is intentionally deferred —
// prediction-accuracy interactions carry the daily engagement instead.
//
// When real content lands, this page will host:
//   • [Hero] Ticker Top 10 Tonight — auto-playing reel with Reggie/Marc bumpers
//   • Player reels ("Ovi in March", "Bedard First Year")
//   • Team reels ("Oilers PP Goals · April")
//   • League reels (Top CHL Goals, Top NCAA Goals) — cross-border discovery
//   • My Reel — user's saved clips
//   • Discover — reels tuned to Signals affinity

import { Link } from "react-router-dom";
import { Film, Users, Layers, Sparkles, Plus, ChevronRight } from "lucide-react";

const PLACEHOLDER_REELS = [
  { icon: Film,    title: "Ticker Top 10 Tonight",  desc: "The ten plays that mattered — auto-cut every morning" },
  { icon: Users,   title: "Player Reels",           desc: "Ovi in March · Bedard's first year · McDavid's April" },
  { icon: Layers,  title: "Team Reels",             desc: "Oilers PP goals · Habs comebacks · Panthers hits" },
  { icon: Sparkles,title: "Cross-League Cuts",      desc: "Top CHL goals · Top NCAA saves · Junior riser watch" },
];

export default function Reels() {
  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6" data-testid="reels-page">
      <div>
        <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.34em", color: "#F58220" }}>
          Reels · Coming as the clips are cut
        </div>
        <div className="mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "24px", color: "#fff", lineHeight: 1.2 }}>
          The best of the night — the best of the week — the best of you.
        </div>
        <div className="mt-2 max-w-2xl" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "14px", color: "#cfd3da", lineHeight: 1.5 }}>
          One page for every clip that matters. Reggie and Marc bumper each reel — they set the room before the clip and grade it after. When you save a clip, it lands in <em className="not-italic text-[#F58220]">My Reel</em> — your own personal night.
        </div>
      </div>

      {/* Hero placeholder — the eventual Top 10 auto-player lives here */}
      <div
        data-testid="reels-hero-placeholder"
        className="rounded-xl border border-white/10 bg-gradient-to-br from-[#1e5dff]/[0.08] via-black/40 to-black/40 aspect-video flex flex-col items-center justify-center gap-3 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at center, rgba(30,93,255,0.25) 0%, transparent 60%)" }} />
        <Film className="w-12 h-12 text-white/40 relative" />
        <div className="relative text-center px-6">
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.34em", color: "#a0a0a5" }}>
            Ticker Top 10 · Tonight
          </div>
          <div className="mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "20px", color: "#fff" }}>
            Auto-cutting the ten plays that mattered
          </div>
          <div className="mt-1" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.24em", color: "#a0a0a5" }}>
            Reggie and Marc will bumper each clip
          </div>
        </div>
      </div>

      {/* Chapter cards — signals what's coming without over-promising */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLACEHOLDER_REELS.map(({ icon: Icon, title, desc }, i) => (
          <div key={i} data-testid={`reels-chapter-${i}`}
               className="rounded-lg border border-white/10 bg-black/30 p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,130,32,0.12)", border: "1px solid rgba(245,130,32,0.3)" }}>
              <Icon className="w-4 h-4 text-[#F58220]" />
            </div>
            <div className="min-w-0">
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#fff", lineHeight: 1.2 }}>
                {title}
              </div>
              <div className="mt-0.5" style={{ fontFamily: "Rajdhani", fontWeight: 500, fontSize: "13px", color: "#a0a8b3", lineHeight: 1.4 }}>
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cross-link to picks accuracy — where the real interaction lives today */}
      <Link
        to="/show"
        data-testid="reels-picks-link"
        className="group flex items-center justify-between gap-3 rounded-xl border border-[#F58220]/25 bg-[#F58220]/[0.05] p-4 hover:border-[#F58220]/50 transition-all"
      >
        <div>
          <div style={{ fontFamily: "Oswald", fontWeight: 700, fontSize: "10px", letterSpacing: "0.32em", color: "#F58220" }}>
            While you wait
          </div>
          <div className="mt-1" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: "#fff", lineHeight: 1.25 }}>
            Make tonight's picks — track your record against Reggie & Marc.
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#F58220] group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
      </Link>
    </div>
  );
}
