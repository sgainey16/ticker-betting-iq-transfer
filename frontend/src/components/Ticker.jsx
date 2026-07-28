import Marquee from "react-fast-marquee";
import { TEST_IDS } from "@/lib/config";

// Single-lane broadcast ticker — the clickable SHOW TOPICS row.
// Tap a topic to jump the desk to that segment. Slim "ON AIR" label
// keeps the pill compact so the topic chips get the space they deserve.
export default function Ticker({
  topics = [],
  activeTopicId = null,
  onTopicClick = () => {},
}) {
  if (topics.length === 0) return null;

  return (
    <div
      data-testid={TEST_IDS.home.tickerBanner}
      className="relative border-y border-[#2d2d35] bg-[#0b0b10]"
      aria-label="Show topics ticker"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 pl-3 pr-3 bg-[#1e5dff] text-white font-accent text-[10px] uppercase tracking-[0.28em] shadow-[0_0_12px_rgba(30,93,255,0.55)]">
          <span className="tick-dot bg-white live-pulse" />
          On Air
        </div>
        <div className="pl-24 pr-4 py-2">
          <Marquee gradient={false} speed={38} pauseOnHover>
            {[...topics, ...topics].map((t, i) => {
              const active = t.id === activeTopicId;
              return (
                <button
                  key={`${t.id}-${i}`}
                  type="button"
                  data-testid={TEST_IDS.home.tickerTopic(t.id)}
                  onClick={() => onTopicClick(t.id)}
                  className={`mx-2 px-3 py-1 rounded-full font-accent text-[10px] uppercase tracking-[0.22em] whitespace-nowrap transition-all ${
                    active
                      ? "bg-[#1e5dff] text-white shadow-[0_0_14px_-2px_rgba(30,93,255,0.7)]"
                      : "border border-white/15 text-white/80 hover:border-white/45 hover:text-white"
                  }`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle ${
                      active ? "bg-white" : "bg-[#00e5ff]"
                    }`}
                  />
                  {t.label}
                </button>
              );
            })}
          </Marquee>
        </div>
      </div>
    </div>
  );
}
