import Marquee from "react-fast-marquee";
import { TEST_IDS } from "@/lib/config";

export default function Ticker({ items = [] }) {
  const content =
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
      className="relative overflow-hidden border-y border-[#2d2d35] bg-[#0b0b10]"
      aria-label="Live NHL headline ticker"
    >
      <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 pl-4 pr-5 bg-[#1e5dff] text-white font-headline text-sm">
        <span className="tick-dot bg-white live-pulse" /> LIVE · NHL
      </div>
      <div className="pl-40 pr-4 py-3">
        <Marquee gradient={false} speed={55} pauseOnHover>
          {content.map((t, i) => (
            <span
              key={i}
              className="mx-8 font-accent text-white/85 text-sm uppercase tracking-wider"
            >
              <span className="text-[#1e5dff] mr-2">●</span>
              {t}
            </span>
          ))}
        </Marquee>
      </div>
    </div>
  );
}
