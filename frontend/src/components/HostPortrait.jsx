import { useLocation } from "react-router-dom";
import { pickForRoute, HOST_NAMES, HOST_ROLES, HOSTS } from "@/lib/hostImages";

// HostPortrait — drop-in portrait for either host. Auto-picks the right
// mood based on the current route (so Home V2 shows a different face than
// Recap or Uncut), or accepts a `mood` prop to force one.
//
// Two visual variants:
//   variant="tile"   — square-ish tile with rounded corners + name tag chip
//                      (default; use inside cards)
//   variant="hero"   — full-bleed frame with lower-third overlay
//                      (use as a landing header)
export default function HostPortrait({
  persona,                // "reggie" | "marc"
  mood,                   // optional override — otherwise picked per route
  variant = "tile",
  size = 240,             // tile size in px (hero ignores)
  showName = true,
  className = "",
}) {
  const location = useLocation();
  const src = mood && HOSTS[persona]?.[mood]
    ? HOSTS[persona][mood]
    : pickForRoute(location.pathname, persona);
  const name = HOST_NAMES[persona];
  const role = HOST_ROLES[persona];

  if (variant === "hero") {
    return (
      <div className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 ${className}`}
           data-testid={`host-portrait-hero-${persona}`}>
        <img src={src} alt={name} className="w-full h-full object-cover" />
        {showName && (
          <div className="absolute left-4 bottom-4 flex items-center gap-3 bg-black/70 backdrop-blur-md rounded-lg px-3.5 py-2 border-l-2 border-[#1E5BFF]">
            <div>
              <div className="font-headline text-white text-lg leading-tight">{name}</div>
              <div className="font-accent text-[10px] uppercase tracking-[0.28em] text-white/60">{role}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tile variant
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-black/50 flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      data-testid={`host-portrait-tile-${persona}`}
    >
      <img src={src} alt={name} className="absolute inset-0 w-full h-full object-cover object-top" />
      {showName && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pt-6 pb-2">
          <div className="font-headline text-white text-sm leading-tight">{name}</div>
          <div className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/60">{role}</div>
        </div>
      )}
    </div>
  );
}

// DuoRow — Reggie + Marc side-by-side. Common pattern for "Analysts on Deck"
// sections. Both faces auto-rotate per route.
export function HostDuoRow({ size = 200, className = "" }) {
  return (
    <div className={`flex gap-3 ${className}`} data-testid="host-duo-row">
      <HostPortrait persona="reggie" size={size} />
      <HostPortrait persona="marc"   size={size} />
    </div>
  );
}
