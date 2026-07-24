import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Ticker from "@/components/Ticker";
import LiveDesk from "@/components/LiveDesk";
import { TEST_IDS } from "@/lib/config";
import { api } from "@/lib/api";
import { Mic, Trophy, LineChart } from "lucide-react";

export default function Home() {
  const [tickerItems, setTickerItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [activeTopic, setActiveTopic] = useState("league_wide");

  useEffect(() => {
    api
      .get("/ticker")
      .then((r) => setTickerItems(r.data.items || []))
      .catch(() => setTickerItems([]));
    api
      .get("/topics")
      .then((r) => setTopics(r.data.topics || []))
      .catch(() => setTopics([]));
  }, []);

  return (
    <div className="-mx-5 sm:-mx-8 -mt-8">
      <Ticker
        items={tickerItems}
        topics={topics}
        activeTopicId={activeTopic}
        onTopicClick={(id) => setActiveTopic(id)}
      />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-6 pb-6">
        <LiveDesk
          topics={topics}
          activeTopic={activeTopic}
          onTopicChange={(id) => setActiveTopic(id)}
          autoFlow={true}
        />

        {/* Below the fold — quick nav to the other rooms */}
        <div className="mt-14 grid sm:grid-cols-3 gap-4">
          <Link
            to="/press-conference"
            data-testid={TEST_IDS.home.askCta}
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform"
          >
            <div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#1e5dff]">
                Deep dive
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Press Conference
              </div>
              <div className="text-white/60 text-sm mt-1">
                Ask Reggie or Marc anything. 1-on-1 breakdown, stat-backed.
              </div>
            </div>
            <Mic className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          </Link>

          <Link
            to="/stats"
            data-testid="home-stats-cta"
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform"
          >
            <div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#00e5ff]">
                The numbers
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Live NHL Stats
              </div>
              <div className="text-white/60 text-sm mt-1">
                Leaders, standings, tonight's slate. Straight from the league.
              </div>
            </div>
            <LineChart className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          </Link>

          <Link
            to="/fantasy"
            data-testid="home-fantasy-cta"
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform"
          >
            <div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/60">
                Your team
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Fantasy Desk
              </div>
              <div className="text-white/60 text-sm mt-1">
                Set your roster. Get start-sit calls, waiver fits, anomaly flags.
              </div>
            </div>
            <Trophy className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
