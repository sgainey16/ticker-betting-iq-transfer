import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Ticker from "@/components/Ticker";
import LiveDesk from "@/components/LiveDesk";
import { TEST_IDS } from "@/lib/config";
import { api } from "@/lib/api";
import { Mic, Vote, Sparkles } from "lucide-react";

export default function Home() {
  const [topics, setTopics] = useState([]);
  // First-visit default: April 8 2025 Wildcard Night panel (real games, real stats)
  const [activeTopic, setActiveTopic] = useState("wildcard_night_apr_8_2025");

  useEffect(() => {
    api
      .get("/topics")
      .then((r) => setTopics(r.data.topics || []))
      .catch(() => setTopics([]));
  }, []);

  return (
    <div className="-mx-5 sm:-mx-8 -mt-8">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-6">
        <LiveDesk
          topics={topics}
          activeTopic={activeTopic}
          onTopicChange={(id) => setActiveTopic(id)}
          autoFlow={true}
        />

        {/* Below the fold — two tiles: Deep Dive (Presser) + Matchups voting */}
        <div className="mt-14 grid sm:grid-cols-2 gap-4">
          <Link
            to="/press-conference"
            data-testid={TEST_IDS.home.askCta}
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform relative overflow-hidden"
          >
            <div className="min-w-0">
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#1e5dff]">
                Deep dive · analytics
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Every tool studies the game. We study you.
              </div>
              <div className="text-white/60 text-sm mt-1">
                Your patterns, your blind spots, your history. Coach, not casino.
              </div>
              <div className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-accent uppercase tracking-widest text-[#00e5ff]">
                <Sparkles className="w-3 h-3" />
                First session on the house
              </div>
            </div>
            <Mic className="w-6 h-6 text-white/50 group-hover:text-white transition-colors flex-shrink-0" />
          </Link>

          <Link
            to="/predictions"
            data-testid="home-matchups-cta"
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform relative overflow-hidden"
          >
            <div className="min-w-0">
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#00e5ff]">
                Matchups · pick against the panel
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Tonight's Card
              </div>
              <div className="text-white/60 text-sm mt-1">
                Reggie says one thing. Marc says another. Call it — track your streak vs. the desk.
              </div>
              <div className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-accent uppercase tracking-widest text-[#1e5dff]">
                <Vote className="w-3 h-3" />
                Vote now — no wallet required
              </div>
            </div>
            <Vote className="w-6 h-6 text-white/50 group-hover:text-white transition-colors flex-shrink-0" />
          </Link>
        </div>
      </div>

      {/* Ticker moved to bottom-of-page per broadcast lower-third convention.
       * Single-lane now (topics only) — the old dual-lane felt blurry. */}
      <Ticker
        topics={topics}
        activeTopicId={activeTopic}
        onTopicClick={(id) => setActiveTopic(id)}
      />
    </div>
  );
}
