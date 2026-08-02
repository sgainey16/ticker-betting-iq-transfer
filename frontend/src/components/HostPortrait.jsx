import { useLocation } from "react-router-dom";
import { pickForRoute, HOST_NAMES, HOST_ROLES, HOSTS } from "@/lib/hostImages";

// HostPortrait — drop-in portrait for either host. Auto-picks the right
// mood based on the current route (so Home V2 shows a different face than
// Recap or Uncut), or accepts a `mood` prop to force one.
//
// Broadcast composition: when placing two portraits side-by-side, use
// `mirror` on the right-slot host so his gaze flips to point LEFT, toward
// the other host. This is how TV directors fake eye contact between two
// isolated shots — same trick, tiny scaleX(-1) transform.
//
// Two visual variants:
//   variant="tile"   — square-ish tile with rounded corners + name tag chip
//   variant="hero"   — full-bleed frame with lower-third overlay
export default function HostPortrait({
  persona,                // "reggie" | "marc"
  mood,                   // optional override — otherwise picked per route
  variant = "tile",
  size = 240,             // tile size in px (hero ignores)
  showName = true,
  mirror = false,         // flip horizontally so gaze aims the other way
  tilt  = 0,              // subtle inward tilt in degrees (e.g. 2 or -2)
  className = "",
}) {
  const location = useLocation();
  const src = mood && HOSTS[persona]?.[mood]
    ? HOSTS[persona][mood]
    : pickForRoute(location.pathname, persona);
  const name = HOST_NAMES[persona];
  const role = HOST_ROLES[persona];

  // Compose transforms in one string so hover animations don't clobber
  // the mirror/tilt state on re-render.
  const transform = [
    mirror ? "scaleX(-1)" : "",
    tilt   ? `rotate(${tilt}deg)` : "",
  ].filter(Boolean).join(" ") || undefined;

  if (variant === "hero") {
    return (
      <div className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 ${className}`}
           data-testid={`host-portrait-hero-${persona}`}>
        <img src={src} alt={name} style={{ transform }} className="w-full h-full object-cover" />
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
      <img src={src} alt={name} style={{ transform }}
           className="absolute inset-0 w-full h-full object-cover object-top" />
      {showName && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pt-6 pb-2">
          <div className="font-headline text-white text-sm leading-tight">{name}</div>
          <div className="font-accent text-[9px] uppercase tracking-[0.25em] text-white/60">{role}</div>
        </div>
      )}
    </div>
  );
}

// DuoRow — Reggie + Marc as a connected desk pair. Broadcast-style: the
// right-slot host is mirrored so both hosts appear to look at each other.
// The tiles butt directly against a shared center seam (no gap) and a
// hairline blue divider marks the "cut" between cameras.
export function HostDuoRow({ size = 200, className = "" }) {
  return (
    <div className={`flex ${className}`} data-testid="host-duo-row">
      <HostPortrait persona="reggie" size={size} className="rounded-r-none border-r-0" />
      <div className="w-px bg-[#1E5BFF]/40 flex-shrink-0" />
      <HostPortrait persona="marc"   size={size} mirror className="rounded-l-none border-l-0" />
    </div>
  );
}
