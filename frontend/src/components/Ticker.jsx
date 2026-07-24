import Marquee from "react-fast-marquee";
import { TEST_IDS } from "@/lib/config";

// Two-lane broadcast ticker.
//   Top lane  = clickable SHOW TOPICS (tap to jump the desk to that segment)
//   Bottom lane = live NHL headlines / mock lines (informational, scrolls)
// Both scroll independently and continuously to feel like real TV lower-thirds.
export default function Ticker({
  items = [],
  topics = [],
  activeTopicId = null,
  onTopicClick = () => {},
}) {
  const headlines =
    items.length > 0
      ? items
      : [
          "Loading league headlines…",
          "Standby: puck drop at :07",
          "The Ticker is warming up the desk",
        ];

  return (
    <div
      data-testid={TEST_IDS.home.tickerBanner}
      className="relative border-y border-[#2d2d35] bg-[#0b0b10]"
      aria-label="Live NHL headline ticker"
    >
      {/* Topics lane */}
      {topics.length > 0 && (
        <div className="relative overflow-hidden border-b border-[#2d2d35]/70">
          <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 pl-4 pr-5 bg-gradient-to-r from-[#1e5dff] via-[#1e5dff] to-[#1e5dff]/95 text-white font-headline text-[13px] shadow-[0_0_18px_rgba(30,93,255,0.55)]">
            <span className="tick-dot bg-white live-pulse" />
            ON THE SHOW
          </div>
          <div className="pl-40 pr-4 py-2">
            <Marquee gradient={false} speed={38} pauseOnHover>
              {[...topics, ...topics].map((t, i) => {
                const active = t.id === activeTopicId;
                return (
                  <button
                    key={`${t.id}-${i}`}
                    type="button"
                    data-testid={TEST_IDS.home.tickerTopic(t.id)}
                    onClick={() => onTopicClick(t.id)}
                    className={`mx-3 px-4 py-1.5 rounded-full font-accent text-[11px] uppercase tracking-[0.22em] whitespace-nowrap transition-all ${
                      active
                        ? "bg-[#1e5dff] text-white shadow-[0_0_16px_-2px_rgba(30,93,255,0.7)]"
                        : "border border-white/15 text-white/85 hover:border-white/45 hover:text-white"
                    }`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full mr-2 align-middle ${
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
      )}

      {/* Headlines lane */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 pl-4 pr-5 bg-[#141420] text-white font-headline text-[13px] border-r border-[#2d2d35]">
          <span className="tick-dot bg-[#1e5dff] live-pulse" /> LIVE · NHL
        </div>
        <div className="pl-40 pr-4 py-3">
          <Marquee gradient={false} speed={55} pauseOnHover>
            {headlines.map((t, i) => (
              <span
                key={i}
                className="mx-8 font-accent text-white/85 text-sm uppercase tracking-wider whitespace-nowrap"
              >
                <span className="text-[#1e5dff] mr-2">●</span>
                {t}
              </span>
            ))}
          </Marquee>
        </div>
      </div>
    </div>
  );
}
