import { NavLink, Link } from "react-router-dom";
import { TEST_IDS } from "@/lib/config";
import { Radio } from "lucide-react";

const linkBase =
  "px-4 py-2 rounded-md font-accent text-sm uppercase tracking-widest transition-colors";
const active = "text-white bg-white/5";
const inactive = "text-white/60 hover:text-white hover:bg-white/5";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-40 glass border-b border-[#2d2d35]"
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
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
                AI · HOCKEY DESK
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              data-testid={TEST_IDS.nav.home}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? active : inactive}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/ask"
              data-testid={TEST_IDS.nav.ask}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? active : inactive}`
              }
            >
              Ask Analyst
            </NavLink>
            <NavLink
              to="/predictions"
              data-testid={TEST_IDS.nav.predictions}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? active : inactive}`
              }
            >
              Predictions
            </NavLink>
          </nav>

          <div className="hidden sm:flex items-center gap-2 text-xs font-accent uppercase tracking-widest">
            <Radio className="w-4 h-4 text-[#1e5dff]" />
            <span className="text-white/70">On Air</span>
            <span className="tick-dot live-pulse ml-1" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-8">{children}</main>

      <footer className="max-w-7xl mx-auto px-5 sm:px-8 py-10 text-xs text-white/40 font-accent uppercase tracking-widest">
        The Ticker · Phase 1 · NHL Desk · Mock data illustrative only
      </footer>
    </div>
  );
}
