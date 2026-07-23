import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Ticker from "@/components/Ticker";
import LiveDesk from "@/components/LiveDesk";
import AnalystAvatar from "@/components/AnalystAvatar";
import { ANALYSTS, ANALYST_ORDER, TEST_IDS } from "@/lib/config";
import { api } from "@/lib/api";
import { Mic, TrendingUp } from "lucide-react";

export default function Home() {
  const [tickerItems, setTickerItems] = useState([]);

  useEffect(() => {
    api
      .get("/ticker")
      .then((r) => setTickerItems(r.data.items || []))
      .catch(() => setTickerItems([]));
  }, []);

  return (
    <div className="-mx-5 sm:-mx-8 -mt-8">
      <Ticker items={tickerItems} />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-8 pb-6">
        {/* Live desk — the whole point */}
        <LiveDesk />

        {/* Below the fold: quick nav to the other rooms */}
        <div className="mt-14 grid sm:grid-cols-2 gap-4">
          <Link
            to="/ask"
            data-testid={TEST_IDS.home.askCta}
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform"
          >
            <div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#1e5dff]">
                Take it further
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Ask an analyst a real question
              </div>
              <div className="text-white/60 text-sm mt-1">
                Pick your voice. Get a stat-backed answer, live-typed.
              </div>
            </div>
            <Mic className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          </Link>

          <Link
            to="/predictions"
            data-testid="home-predictions-cta"
            className="group card-surface p-6 flex items-center justify-between hover:-translate-y-0.5 transition-transform"
          >
            <div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-[#1e5dff]">
                Call it
              </div>
              <div className="font-headline text-2xl text-white mt-1">
                Make tonight's picks
              </div>
              <div className="text-white/60 text-sm mt-1">
                No wallet. No lines. Just skill + a public track record.
              </div>
            </div>
            <TrendingUp className="w-6 h-6 text-white/50 group-hover:text-white transition-colors" />
          </Link>
        </div>

        {/* Meet the desk — no names; users get to know them through the banter */}
        <section className="mt-14" data-testid={TEST_IDS.home.panelHeading}>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="font-accent text-[11px] uppercase tracking-[0.3em] text-white/50">
                On the desk
              </div>
              <h2 className="font-headline text-2xl text-white mt-1">
                Two voices. No filler.
              </h2>
            </div>
            <div className="hidden sm:block text-xs font-accent uppercase tracking-widest text-white/40">
              Get to know them on air
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ANALYST_ORDER.map((id, i) => {
              const a = ANALYSTS[id];
              return (
                <Link
                  to={`/ask?analyst=${id}`}
                  key={id}
                  data-testid={TEST_IDS.home.analystCard(id)}
                  className="card-surface p-4 flex items-center gap-3 transition-transform duration-300 hover:-translate-y-0.5 group"
                  style={{ borderColor: "#2d2d35" }}
                >
                  <AnalystAvatar analystId={id} size={64} shape="circle" ring={true} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-headline text-base leading-tight uppercase tracking-widest"
                      style={{ color: a.accent }}
                    >
                      {a.role}
                    </div>
                    <div className="text-sm text-white/60 mt-1 truncate italic">
                      "{a.tagline}"
                    </div>
                  </div>
                  <div className="text-[10px] font-accent uppercase tracking-widest text-white/40 flex-shrink-0 group-hover:text-white/70 transition-colors">
                    Ask
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
