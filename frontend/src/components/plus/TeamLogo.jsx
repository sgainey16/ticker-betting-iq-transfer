// TeamLogo — one-line drop-in for any team logo across Ticker+.
// - Shows the licensed logo image when present and loadable.
// - Falls back to a coloured initial badge if the image errors (offline,
//   404, blocked). This makes the app resilient to individual URL rot
//   without any per-page error handling.
//
// LEGAL NOTE: Wikipedia Special:FilePath URLs are used for demo purposes
// under editorial nominative fair use. Before public launch, replace with
// team-supplied brand kits or a licensed provider CDN. See
// /app/memory/LEGAL_TODO.md.

import { useState } from "react";

export function TeamLogo({ team, size = 32, className = "", roundedFull = true }) {
  const [errored, setErrored] = useState(false);
  const styleSize = { width: size, height: size };
  const rounded = roundedFull ? "rounded-full" : "rounded";
  if (team?.logoUrl && !errored) {
    return (
      <div
        className={`${rounded} bg-white flex items-center justify-center overflow-hidden shadow ${className}`}
        style={styleSize}
        title={team.name}
      >
        <img
          src={team.logoUrl}
          alt={`${team.name} logo`}
          className="w-[85%] h-[85%] object-contain"
          onError={() => setErrored(true)}
          loading="lazy"
        />
      </div>
    );
  }
  // Fallback: coloured initial badge (the safe visual)
  const label = team?.code || "??";
  const fontSize = Math.max(9, Math.floor(size * 0.28));
  return (
    <div
      className={`${rounded} flex items-center justify-center font-headline text-white shadow ${className}`}
      style={{ ...styleSize, background: team?.primary || "#F58220", fontSize }}
      title={team?.name || ""}
    >
      {label}
    </div>
  );
}
