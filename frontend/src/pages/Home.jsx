import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Ticker from "@/components/Ticker";
import AnalystCard from "@/components/AnalystCard";
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

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-6">
        {/* Hero */}
        <section className="grid lg:grid-cols-12 gap-8 items-end pb-10">
          <div className="lg:col-span-8">
            <div className="font-accent text-xs uppercase tracking-[0.35em] text-[#1e5dff] mb-4">
              <span className="tick-dot live-pulse inline-block mr-2 align-middle" />
              One-on-one press conference · NHL Desk
            </div>
            <h1 className="font-headline text-white text-4xl sm:text-5xl lg:text-6xl leading-[0.95]">
              Four analysts.
              <br />
              <span className="text-white/60">One hockey desk.</span>
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg,#1e5dff,#00e5ff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Zero corporate answers.
              </span>
            </h1>
            <p className="mt-6 text-white/70 max-w-xl leading-relaxed">
              Ask a hockey question. Pick your analyst. Get an answer that sounds
              like a desk, not a chatbot — backed by real stats, delivered in
              character, live-typed on the air.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/ask"
                data-testid={TEST_IDS.home.askCta}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1e5dff] hover:bg-[#3a72ff] text-white font-accent uppercase tracking-widest text-sm shadow-[0_10px_30px_-10px_rgba(30,93,255,0.8)] transition-colors"
              >
                <Mic className="w-4 h-4" />
                Ask the panel
              </Link>
              <Link
                to="/predictions"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#2d2d35] hover:border-white/30 text-white/85 font-accent uppercase tracking-widest text-sm transition-colors"
                data-testid="home-predictions-cta"
              >
                <TrendingUp className="w-4 h-4" />
                Make a pick
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="glass rounded-xl p-5">
              <div className="font-accent text-xs uppercase tracking-[0.3em] text-white/50 mb-3">
                Tonight{"\u2019"}s headlines
              </div>
              <ul className="space-y-3">
                {(tickerItems.slice(0, 4).length
                  ? tickerItems.slice(0, 4)
                  : ["Warming up the desk…"]
                ).map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/80">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: "#1e5dff" }}
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Panel */}
        <section>
          <div
            className="flex items-baseline justify-between mb-5"
            data-testid={TEST_IDS.home.panelHeading}
          >
            <div>
              <div className="font-accent text-xs uppercase tracking-[0.35em] text-white/50">
                Meet the desk
              </div>
              <h2 className="font-headline text-2xl sm:text-3xl text-white mt-1">
                The Panel
              </h2>
            </div>
            <div className="hidden sm:block text-xs font-accent uppercase tracking-widest text-white/40">
              4 personalities · 1 sport · no filler
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ANALYST_ORDER.map((id, i) => (
              <AnalystCard key={id} analyst={ANALYSTS[id]} index={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
