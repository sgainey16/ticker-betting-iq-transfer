import { NavLink, Link } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import { Radio } from "lucide-react";

const linkBase =
  "px-3 py-2 rounded-md font-accent text-[12px] uppercase tracking-widest transition-colors";
const active = "text-white bg-white/5";
const inactive = "text-white/60 hover:text-white hover:bg-white/5";

const NAV = [
  { to: "/", end: true, label: "Broadcast", testid: TEST_IDS.nav.broadcast },
  { to: "/press-conference", label: "Presser", testid: TEST_IDS.nav.presser },
  { to: "/fantasy", label: "Fantasy", testid: TEST_IDS.nav.fantasy },
  { to: "/stats", label: "Stats", testid: TEST_IDS.nav.stats },
  { to: "/back-office", label: "Back Office", testid: TEST_IDS.nav.backOffice },
  { to: "/login", label: "Login", testid: TEST_IDS.nav.login },
];

export default function Layout({ children }) {
  return (
    <div className="min-h-screen">
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

          <div className="hidden sm:flex items-center gap-2 text-xs font-accent uppercase tracking-widest">
            <Radio className="w-4 h-4 text-[#1e5dff] live-pulse" />
            <span className="text-[#1e5dff]">Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">{children}</main>

      <footer className="max-w-7xl mx-auto px-5 sm:px-8 py-10 text-xs text-white/40 font-accent uppercase tracking-widest">
        The Ticker · Phase 1 · NHL Desk · For entertainment &amp; decision insights — never a wager
      </footer>
    </div>
  );
}
