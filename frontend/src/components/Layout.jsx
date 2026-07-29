import { NavLink, Link, useLocation } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import { Radio, Settings } from "lucide-react";
import ReggieAssistant from "@/components/ReggieAssistant";
import LaunchZoneBanner from "@/components/LaunchZoneBanner";
import LiveDesk from "@/components/LiveDesk";
import { BroadcastProvider } from "@/lib/broadcastContext";

const linkBase =
  "px-3 py-2 rounded-md font-accent text-[12px] uppercase tracking-widest transition-colors";
const active = "text-white bg-white/5";
const inactive = "text-white/60 hover:text-white hover:bg-white/5";

// Phase 1 nav — entertainment-first, short labels.
const NAV = [
  { to: "/", end: true, label: "Show", testid: TEST_IDS.nav.broadcast },
  { to: "/press-conference", label: "Presser", testid: TEST_IDS.nav.presser },
  { to: "/stats", label: "Stats", testid: TEST_IDS.nav.stats },
  { to: "/predictions", label: "Predict", testid: TEST_IDS.nav.predictions },
  { to: "/recaps", label: "Recaps", testid: TEST_IDS.nav.recaps },
];

export default function Layout({ children }) {
  return (
    <BroadcastProvider>
      <LayoutInner>{children}</LayoutInner>
    </BroadcastProvider>
  );
}

function LayoutInner({ children }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen">
      <LaunchZoneBanner />

      <header
        className="sticky top-0 z-40 glass border-b border-[#2d2d35]"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 group"
            data-testid="brand-link"
          >
            <div className="h-9 w-9 rounded-md flex items-center justify-center bg-[#1e5dff] text-white font-headline text-xl leading-none shadow-[0_0_24px_rgba(30,93,255,0.55)]">
              T
            </div>
            <div className="leading-tight">
              <div className="font-headline text-lg text-white">THE TICKER</div>
              <div className="font-accent text-[10px] text-white/50 tracking-[0.3em]">
                SPORTS NETWORK
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={n.testid}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? active : inactive}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-accent uppercase tracking-widest">
              <Radio className="w-4 h-4 text-[#1e5dff] live-pulse" />
              <span className="text-[#1e5dff]">Live</span>
            </div>
            <NavLink
              to="/back-office"
              data-testid={TEST_IDS.nav.backOffice}
              className={({ isActive }) =>
                `h-9 w-9 rounded-md flex items-center justify-center transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                }`
              }
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </header>

      {/* Off-Home routes get extra bottom padding so the fixed mini-player
       * doesn't cover the footer / last row of content. */}
      <main
        className={`max-w-7xl mx-auto px-5 sm:px-8 py-8 ${
          isHome ? "" : "pb-24"
        }`}
      >
        {children}
      </main>

      <footer className={`max-w-7xl mx-auto px-5 sm:px-8 py-10 text-xs text-white/40 font-accent uppercase tracking-widest space-y-1.5 ${isHome ? "" : "pb-24"}`}>
        <div>The Ticker · Phase 1 · NHL Desk · For entertainment &amp; decision insights — never a wager</div>
        <div className="text-white/30" data-testid="sportradar-attribution">
          NHL data provided by <span className="text-white/50">Sportradar</span>
        </div>
      </footer>

      {/* Mounted ONCE — audio elements survive every route change so the
       * broadcast keeps rolling while users hop between pages. Renders as
       * full frame (portaled into #broadcast-slot on /) or mini bar. */}
      <LiveDesk autoFlow={true} />

      <ReggieAssistant />
    </div>
  );
}
