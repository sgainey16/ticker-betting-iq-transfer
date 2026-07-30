import { NavLink, Link, useLocation } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import { Radio, Settings, Volume2, VolumeX } from "lucide-react";
import ReggieAssistant from "@/components/ReggieAssistant";
import LaunchZoneBanner from "@/components/LaunchZoneBanner";
import LiveDesk from "@/components/LiveDesk";
import GoalAlertBar from "@/components/GoalAlertBar";
import { BroadcastProvider } from "@/lib/broadcastContext";
import { LiveProvider, useLive } from "@/lib/liveContext";

const linkBase =
  "px-3 py-2 rounded-md font-accent text-[12px] uppercase tracking-widest transition-colors";
const active = "text-white bg-white/5";
const inactive = "text-white/60 hover:text-white hover:bg-white/5";

// Phase 1 nav — Recap Show IS the landing page. Predict Show at /show.
// SCORE is the new live scoreboard (Red Light ticker feed).
const NAV = [
  { to: "/", end: true, label: "Recap", testid: TEST_IDS.nav.recaps },
  { to: "/show", label: "Show", testid: TEST_IDS.nav.broadcast },
  { to: "/scoreboard", label: "Scores", testid: "nav-scoreboard" },
  { to: "/press-conference", label: "Presser", testid: TEST_IDS.nav.presser },
  { to: "/stats", label: "Stats", testid: TEST_IDS.nav.stats },
  { to: "/predictions", label: "Predict", testid: TEST_IDS.nav.predictions },
];

export default function Layout({ children }) {
  return (
    <BroadcastProvider>
      <LiveProvider>
        <LayoutInner>{children}</LayoutInner>
      </LiveProvider>
    </BroadcastProvider>
  );
}

function LayoutInner({ children }) {
  const location = useLocation();
  // Both "flagship show" routes: Recap at / and Predict at /show. Neither
  // wants the mini-bar hovering — Recap has its own player, Predict has
  // the full frame inline.
  const isHome = location.pathname === "/" || location.pathname === "/show";
  // Routes where the mini broadcast bar is hidden (Presser is a 1-on-1,
  // Back Office is settings, / is the Recap Show landing).
  const isQuietRoute =
    location.pathname === "/" ||
    location.pathname.startsWith("/scoreboard") ||
    location.pathname.startsWith("/press-conference") ||
    location.pathname.startsWith("/back-office");
  const needsMiniBarPadding = !isHome && !isQuietRoute;

  return (
    <div className="min-h-screen">
      <LaunchZoneBanner />

      <header
        className="sticky top-0 z-40 glass border-b border-[#2d2d35]"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 landscape:h-12 flex items-center justify-between gap-4">
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
            <GoalHornToggle />
          </div>
        </div>
      </header>

      {/* Global Red Light alert — fixed under the header, appears when a
       * goal event flows through the LiveProvider (demo mode ticks every
       * ~10-15s). */}
      <GoalAlertBar />

      {/* Off-Home routes get extra bottom padding so the fixed mini-player
       * doesn't cover the footer / last row of content. Landscape shrinks
       * the vertical padding so the show frame gets more real estate. */}
      <main
        className={`max-w-7xl mx-auto px-5 sm:px-8 py-8 landscape:py-2 ${
          needsMiniBarPadding ? "pb-24" : ""
        }`}
      >
        {children}
      </main>

      <footer className={`max-w-7xl mx-auto px-5 sm:px-8 py-10 text-xs text-white/40 font-accent uppercase tracking-widest space-y-1.5 ${needsMiniBarPadding ? "pb-24" : ""}`}>
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


// Tiny header control — toggle the goal horn on/off. Kept next to Settings
// so it's reachable from every route (any tab can hear the alert).
function GoalHornToggle() {
  const { muted, setMuted } = useLive();
  return (
    <button
      data-testid="goal-horn-toggle"
      onClick={() => setMuted(!muted)}
      className={`h-9 w-9 rounded-md flex items-center justify-center transition-colors ${
        muted ? "text-white/40 hover:text-white/70" : "text-red-400 hover:text-red-300"
      } hover:bg-white/5`}
      title={muted ? "Goal horn is off — click to enable" : "Goal horn on — click to mute"}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
