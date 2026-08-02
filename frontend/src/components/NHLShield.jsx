// NHLShield — editorial-use NHL shield mark. Rendered inline so we have
// zero external image dependency (no CDN blocks, no CORS, no broken
// avatar on offline demos).
//
// The path below is a stylized reproduction of the NHL shield — the
// classic tilted pentagon-shield outline with "NHL" wordmark inside.
// Colors match the official palette (silver + orange highlight + black).
//
// LEGAL NOTE: The NHL shield and "NHL" wordmark are registered trademarks
// of the National Hockey League. This app uses them in editorial contexts
// only (data attribution, section markers next to news/scores) — never as
// part of The Ticker's own brand, logo, or marketing. The full disclaimer
// is rendered in the site footer.

export default function NHLShield({ size = 20, className = "", title = "NHL" }) {
  // Silver → light-grey gradient on the outer shield, orange accent stripe.
  return (
    <svg
      viewBox="0 0 100 120"
      width={size}
      height={size * 1.2}
      role="img"
      aria-label={title}
      className={`inline-block flex-shrink-0 ${className}`}
      data-testid="nhl-shield"
      style={{ height: size * 1.2, width: "auto" }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="nhl-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e8e8e8" />
          <stop offset="55%"  stopColor="#b8b8b8" />
          <stop offset="100%" stopColor="#8a8a8a" />
        </linearGradient>
      </defs>
      {/* Shield outer — classic tilted pentagon shape */}
      <path
        d="M 12 8 L 88 8 L 92 60 L 50 114 L 8 60 Z"
        fill="url(#nhl-silver)"
        stroke="#1a1a1a"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Orange accent stripe — the shield's signature warm tone */}
      <path
        d="M 18 20 L 82 20 L 84 30 L 16 30 Z"
        fill="#e37031"
      />
      {/* "NHL" wordmark — bold, condensed, tilted slightly to match the mark */}
      <text
        x="50" y="72"
        textAnchor="middle"
        fontFamily="Oswald, Impact, sans-serif"
        fontWeight="900"
        fontSize="30"
        fill="#1a1a1a"
        letterSpacing="2"
      >
        NHL
      </text>
    </svg>
  );
}
