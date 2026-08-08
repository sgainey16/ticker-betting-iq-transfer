import { NavLink, Link, useLocation } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import { Radio, Settings } from "lucide-react";
import ReggieAssistant from "@/components/ReggieAssistant";
import LiveDesk from "@/components/LiveDesk";
import GoalAlertBar from "@/components/GoalAlertBar";
import NHLShield from "@/components/NHLShield";
import IosInstallPrompt from "@/components/IosInstallPrompt";
import { TMark } from "@/lib/brand";
import { BroadcastProvider } from "@/lib/broadcastContext";
import { LiveProvider } from "@/lib/liveContext";

const linkBase =
  "px-3 py-2 rounded-md font-accent text-[12px] uppercase tracking-widest transition-colors";
const active = "text-white bg-white/5";
const inactive = "text-white/60 hover:text-white hover:bg-white/5";

// Phase 1 nav — Recap Show IS the landing page. Predict Show at /show.
// SCORE is the new live scoreboard (Red Light ticker feed).
const NAV = [
  { to: "/", end: true, label: "Recap", testid: TEST_IDS.nav.recaps },
  { to: "/show", label: "Tonight", testid: TEST_IDS.nav.broadcast },
  { to: "/scoreboard", label: "Scores", testid: "nav-scoreboard" },
  { to: "/home-v2", label: "Home", testid: TEST_IDS.nav.presser },
  { to: "/stats", label: "Stats", testid: TEST_IDS.nav.stats },
  { to: "/predictions", label: "Picks", testid: TEST_IDS.nav.predictions },
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
    location.pathname.startsWith("/show") ||
    location.pathname.startsWith("/scoreboard") ||
    location.pathname.startsWith("/press-conference") ||
    location.pathname.startsWith("/home-v2") ||
    location.pathname.startsWith("/back-office");
  // Ticker+ cascade lives outside the NHL broadcast frame entirely — hide
  // the live audio player so its stream doesn't fight the onboarding /
  // desk-show TTS.
  const isPlusRoute = location.pathname.startsWith("/plus");
  const needsMiniBarPadding = !isHome && !isQuietRoute && !isPlusRoute;

  // The Back Office gear only surfaces from Home — everywhere else it
  // clutters the header. Users who want settings tap Home first, then
  // the gear. Free-ing the space also gives us room for future header
  // features (nickname pill, notifications, etc.).
  const showBackOffice = location.pathname.startsWith("/home-v2");

  return (
    <div className="min-h-screen">
      {/* LaunchZoneBanner ("no charge / free launch window") removed per
       * user request. Component file stays on disk — flip it back on when
       * we're ready to talk pricing. */}

      <header
        className="sticky top-0 z-40 glass border-b border-[#2d2d35]"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 landscape:h-12 flex items-center justify-between gap-2 sm:gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 group flex-shrink-0 min-w-0"
            data-testid="brand-link"
          >
            {/* Compact wordmark — just T · THE TICKER on one line. Removed
             * the NHL DESK sub-line and the small NHL shield so nav tabs
             * get the breathing room. */}
            <div className="flex items-center justify-center flex-shrink-0" data-testid="brand-mark">
              <TMark size={28} variant="light" />
            </div>
            <div className="hidden sm:block font-headline text-sm md:text-base text-white whitespace-nowrap tracking-wide">
              THE TICKER
            </div>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar min-w-0 flex-1 justify-center">
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

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Junior + college entry is now part of the app-wide
             * onboarding — no separate header pill needed. HomeV2's
             * "Beyond the NHL" section is the discovery surface for it. */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-accent uppercase tracking-widest">
              <Radio className="w-4 h-4 text-[#1e5dff] live-pulse" />
              <span className="text-[#1e5dff]">Live</span>
            </div>
            <NavLink
              to="/back-office"
              data-testid={TEST_IDS.nav.backOffice}
              className={({ isActive }) =>
                `h-9 w-9 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${
                  showBackOffice ? "" : "hidden"
                } ${
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
        <div className="flex items-center gap-2 flex-wrap">
          <NHLShield size={14} className="opacity-60" />
          <span>The Ticker · Phase 1 · NHL Desk · For entertainment &amp; decision insights — never a wager</span>
        </div>
        <div className="text-white/30" data-testid="sportradar-attribution">
          NHL data provided by <span className="text-white/50">Sportradar</span>
        </div>
        <div className="text-white/25 normal-case tracking-normal text-[10px] pt-2 max-w-3xl">
          The Ticker is an independent sports commentary product and is not affiliated with,
          endorsed by, or sponsored by the National Hockey League. NHL and the NHL Shield are
          registered trademarks of the National Hockey League. All team marks and logos are
          the property of their respective teams.
        </div>
      </footer>

      {/* Mounted ONCE — audio elements survive every route change so the
       * broadcast keeps rolling while users hop between pages. Renders as
       * full frame (portaled into #broadcast-slot on /) or mini bar. */}
      <LiveDesk autoFlow={true} />

      <ReggieAssistant />
      <IosInstallPrompt />
    </div>
  );
}
