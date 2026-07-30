/* Single source of truth for The Ticker brand system.
 * Every logo, color, or nametag pill in the app should import from here so
 * that when the real SVG package lands we swap ONE file and the entire
 * product updates. Do not hardcode brand colors or logos anywhere else.
 */

// Brand-approved palette (from the official brand guide).
export const C = {
  blue:   "#1E5BFF",  // Ticker Blue  · primary accent
  white:  "#FFFFFF",  // Ice White
  black:  "#0B0B0F",  // Night Black  · app background
  gray:   "#5C6670",  // Steel Gray
  silver: "#C8CDD3",  // Puck Silver
};

/* ------------------------------------------------------------------ *
 * T-MARK — angular black T with 3 blue speed-streaks flying off the
 * top-right (forward motion). Reference-approximate placeholder until
 * the full SVG branding package lands.
 *   `variant`   swaps light-on-dark ("light") vs dark-on-light ("dark")
 *   `size`      sets the rendered pixel width
 * ------------------------------------------------------------------ */
export function TMark({ size = 32, variant = "light", className = "" }) {
  const w = size;
  const h = size * (200 / 270);
  const body = variant === "dark" ? C.black : C.white;
  const accent = C.blue;
  return (
    <svg
      viewBox="0 0 270 200"
      width={w}
      height={h}
      className={className}
      aria-label="The Ticker"
    >
      {/* Black (or white) T body */}
      <polygon points="18,28 152,28 142,72 8,72" fill={body} />
      <polygon points="70,72 118,72 100,188 58,188" fill={body} />
      {/* Blue forward-motion streaks off the top-right of the crossbar */}
      <polygon points="156,28 250,28 262,52 168,52" fill={accent} />
      <polygon points="148,58 218,58 232,80 160,80" fill={accent} />
      <polygon points="140,86 188,86 202,104 148,104" fill={accent} opacity="0.9" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * WORDMARK — "THE TICKER" in Rajdhani Bold, stacked 2 lines.
 * ------------------------------------------------------------------ */
export function Wordmark({ size = 22, color = C.white }) {
  return (
    <div
      style={{
        fontFamily: "Rajdhani",
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "0.02em",
        color,
      }}
    >
      THE<br />TICKER
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * LOWER-THIRD PILL — Reggie/Marc nametag treatment.
 * Blue leading tab with the T mark + Rajdhani speaker name + Oswald role.
 * ------------------------------------------------------------------ */
export function LowerThird({ speaker, role, className = "" }) {
  return (
    <div
      className={`inline-flex items-stretch overflow-hidden border border-white/15 ${className}`}
      style={{ background: C.black }}
      data-testid="brand-lower-third"
    >
      <div className="flex items-center justify-center px-2" style={{ background: C.blue }}>
        <TMark size={20} variant="light" />
      </div>
      <div className="px-3 py-1.5">
        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: "13px",
            color: C.white,
            letterSpacing: "0.06em",
            lineHeight: 1,
          }}
        >
          {speaker}
        </div>
        {role && (
          <div
            className="mt-0.5"
            style={{
              fontFamily: "Oswald",
              fontWeight: 500,
              fontSize: "8px",
              letterSpacing: "0.28em",
              color: C.blue,
            }}
          >
            {role}
          </div>
        )}
      </div>
    </div>
  );
}
