import { Link } from "react-router-dom";

/* =============================================================================
 * BRAND AUDITION — a single-page showroom of the proposed "The Ticker" identity.
 * All assets are pure SVG so we get vector-crisp scaling + brand-exact colors
 * (#1E5BFF Ticker Blue, #0B0B0F Night Black, #C8CDD3 Puck Silver, etc.).
 * Once you approve here, these SVGs get lifted straight into the header,
 * nametag pills, goal-alert bar, and each sub-brand's page.
 * ==========================================================================*/

// ---------------------------------------------------------------------------
// Color palette (single source of truth)
// ---------------------------------------------------------------------------
const C = {
  blue:   "#1E5BFF",
  white:  "#FFFFFF",
  black:  "#0B0B0F",
  gray:   "#5C6670",
  silver: "#C8CDD3",
};

// ---------------------------------------------------------------------------
// T-MARK — the angular T with the blue lightning slash to the upper-left.
// Parameterized so the same primitive drives the header, favicon, nametag
// pills, jerseys — every place the mark needs to appear. `variant` swaps
// between light-on-dark and dark-on-light execution. `flip` mirrors the
// mark so the motion runs the opposite direction — used only for auditioning
// the correct orientation until the real brand file lands.
// ---------------------------------------------------------------------------
function TMark({ size = 120, variant = "light", flip = false, className = "" }) {
  const stroke = variant === "dark" ? C.black : C.white;
  const accent = C.blue;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      aria-label="The Ticker mark"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      {/* Blue lightning slash — sits to the upper-left of the T */}
      <polygon points="12,42 78,42 58,78 12,78" fill={accent} />
      <polygon points="46,58 78,42 60,90" fill={accent} opacity="0.85" />

      {/* Top crossbar of the T — slanted right for motion */}
      <polygon
        points="82,42 188,42 178,86 72,86"
        fill={stroke}
      />

      {/* Vertical stem of the T — slanted, tapered */}
      <polygon
        points="118,86 158,86 138,188 100,188"
        fill={stroke}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PRIMARY LOGO — T-mark + wordmark + tagline lockup
// ---------------------------------------------------------------------------
function PrimaryLogo({ variant = "light", showTag = true }) {
  const fg = variant === "dark" ? C.black : C.white;
  return (
    <div className="flex items-center gap-4">
      <TMark size={82} variant={variant} />
      <div>
        <div
          className="leading-none tracking-tight"
          style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "44px", color: fg }}
        >
          THE<br />TICKER
        </div>
        {showTag && (
          <div
            className="mt-2"
            style={{
              fontFamily: "Oswald",
              fontWeight: 500,
              fontSize: "11px",
              letterSpacing: "0.28em",
              color: C.blue,
            }}
          >
            AI POWERED. HOCKEY OBSESSED.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHIELD LOGO — for scoreboard header, broadcast watermarks
// ---------------------------------------------------------------------------
function ShieldLogo({ size = 130 }) {
  return (
    <svg viewBox="0 0 220 260" width={size} height={(260 / 220) * size}>
      <defs>
        <linearGradient id="shieldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0F2A66" />
          <stop offset="1" stopColor={C.black} />
        </linearGradient>
      </defs>
      {/* Shield outline */}
      <path
        d="M110 8 L210 40 L210 150 C210 210 168 240 110 252 C52 240 10 210 10 150 L10 40 Z"
        fill="url(#shieldFill)"
        stroke={C.blue}
        strokeWidth="4"
      />
      {/* Inner beveled panel */}
      <path
        d="M110 22 L196 50 L196 148 C196 200 162 226 110 236 C58 226 24 200 24 148 L24 50 Z"
        fill="none"
        stroke={C.silver}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      {/* Wordmark */}
      <text
        x="110"
        y="105"
        textAnchor="middle"
        style={{ fontFamily: "Rajdhani", fontWeight: 700 }}
        fontSize="30"
        fill={C.white}
        letterSpacing="1"
      >
        THE
      </text>
      <text
        x="110"
        y="140"
        textAnchor="middle"
        style={{ fontFamily: "Rajdhani", fontWeight: 700 }}
        fontSize="40"
        fill={C.white}
        letterSpacing="1"
      >
        TICKER
      </text>
      <text
        x="110"
        y="162"
        textAnchor="middle"
        style={{ fontFamily: "Oswald", fontWeight: 500, letterSpacing: "0.25em" }}
        fontSize="9"
        fill={C.blue}
      >
        AI POWERED
      </text>
      {/* Puck at bottom */}
      <ellipse cx="110" cy="200" rx="42" ry="10" fill={C.black} stroke={C.silver} strokeOpacity="0.4" strokeWidth="1" />
      <ellipse cx="110" cy="198" rx="42" ry="4" fill="#1a1a20" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SUB-BRAND FEATURE MARKS — angled badge treatment for each product surface
// ---------------------------------------------------------------------------
function FeatureMark({ title, subtitle, tone = "blue", size = 180 }) {
  const isBlue = tone === "blue";
  const bg = isBlue ? C.blue : C.black;
  const borderColor = isBlue ? C.white : C.blue;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{
        width: size,
        height: size * 0.66,
        clipPath: "polygon(6% 0%, 100% 0%, 94% 100%, 0% 100%)",
        background: bg,
        border: `2px solid ${borderColor}`,
      }}
    >
      <div className="text-center px-4">
        <div
          style={{
            fontFamily: "Rajdhani",
            fontWeight: 700,
            fontSize: size * 0.12,
            color: C.white,
            lineHeight: 1,
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            className="mt-2"
            style={{
              fontFamily: "Oswald",
              fontWeight: 500,
              fontSize: size * 0.055,
              color: isBlue ? C.white : C.blue,
              letterSpacing: "0.28em",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {/* Tiny T mark stamp in the corner so every sub-brand ties back */}
      <div className="absolute bottom-1 right-2 opacity-80">
        <TMark size={size * 0.14} variant="light" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LOWER-THIRD PILL — what the "REGGIE" nametag becomes on the broadcast frame
// ---------------------------------------------------------------------------
function LowerThird({ speaker = "REGGIE HARLOW", role = "COLOR • LIVE" }) {
  return (
    <div className="inline-flex items-stretch overflow-hidden border border-white/15" style={{ background: C.black }}>
      {/* Blue leading tab with T mark */}
      <div className="flex items-center justify-center px-2" style={{ background: C.blue }}>
        <TMark size={18} variant="light" />
      </div>
      {/* Speaker name */}
      <div className="px-4 py-2">
        <div
          style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: C.white, letterSpacing: "0.06em", lineHeight: 1 }}
        >
          {speaker}
        </div>
        <div
          className="mt-1"
          style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.3em", color: C.blue }}
        >
          {role}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BREAKING-NEWS ALERT BAR — the goal-horn / red-light moment, re-branded
// ---------------------------------------------------------------------------
function BreakingNewsBar() {
  return (
    <div className="w-full flex items-stretch overflow-hidden shadow-2xl" style={{ background: C.black }}>
      <div className="flex items-center justify-center px-4 py-3 animate-pulse" style={{ background: "#c40b1a" }}>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: C.white, letterSpacing: "0.08em" }}>
          BREAKING
        </div>
      </div>
      <div className="flex-1 flex items-center px-4 py-3 gap-4" style={{ background: C.black }}>
        <TMark size={26} variant="light" />
        <div
          style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "16px", color: C.white, letterSpacing: "0.03em" }}
        >
          MCDAVID GOAL · EDM leads COL <span style={{ color: C.blue }}>3-2</span> · 12:44 · P2
        </div>
      </div>
      <div className="flex items-center px-4" style={{ background: C.blue }}>
        <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.3em", color: C.white }}>
          LIVE
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COLOR SWATCH — palette card
// ---------------------------------------------------------------------------
function Swatch({ label, hex }) {
  const darkText = ["ICE WHITE", "PUCK SILVER"].includes(label);
  return (
    <div className="rounded-md overflow-hidden border border-white/10" style={{ background: C.black }}>
      <div style={{ background: hex, height: 90 }} />
      <div className="p-2">
        <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.25em", color: darkText ? C.silver : C.white }}>
          {label}
        </div>
        <div style={{ fontFamily: "Inter", fontSize: "10px", color: C.gray, letterSpacing: "0.05em" }}>
          {hex}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SECTION — labelled block
// ---------------------------------------------------------------------------
function Section({ number, title, children }) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-3 mb-6 pb-2 border-b border-white/10">
        <div style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "12px", color: C.blue, letterSpacing: "0.3em" }}>
          {number}
        </div>
        <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: C.white, letterSpacing: "0.03em" }}>
          {title}
        </div>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function BrandAudition() {
  return (
    <div className="min-h-screen text-white pb-24" style={{ background: C.black }}>
      {/* Sticky top brand ribbon */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between" style={{ background: C.black }}>
        <div className="flex items-center gap-4">
          <TMark size={36} variant="light" />
          <div>
            <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "18px", letterSpacing: "0.03em" }}>
              THE TICKER · BRAND AUDITION
            </div>
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", color: C.blue, letterSpacing: "0.3em" }}>
              OFF-APP PREVIEW · V1
            </div>
          </div>
        </div>
        <Link to="/" data-testid="brand-back"
          className="text-white/50 hover:text-white"
          style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", letterSpacing: "0.3em" }}
        >
          ← BACK TO APP
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-12">
        {/* Hero — big primary logo */}
        <div className="mb-16 flex flex-col items-center gap-6 py-16 border border-white/10 rounded-lg"
             style={{ background: "radial-gradient(ellipse at center, rgba(30,91,255,0.15), transparent 70%)" }}>
          <PrimaryLogo />
          <div style={{ fontFamily: "Inter", fontSize: "13px", color: C.silver, maxWidth: 520, textAlign: "center", lineHeight: 1.6 }}>
            THE TICKER is an AI-powered hockey media network that combines elite analysis, real-time info,
            and entertaining personalities to give fans everything they need — all in one place.
          </div>
        </div>

        {/* 1 · LOGO SUITE */}
        <Section number="01" title="LOGO SUITE">
          {/* Direction A/B — my current SVG vs. mirrored. Whichever reads
              as "moving forward" is closer to the real brand mark. */}
          <div className="mb-6 p-6 rounded-md border" style={{ background: "#111116", borderColor: C.blue }}>
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }} className="mb-4">
              DIRECTION AUDIT · WHICH ONE READS AS "MOVING FORWARD"?
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col items-center gap-3">
                <TMark size={140} variant="light" flip={false} />
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: C.white }}>
                  V1 · SLASH LEFT
                </div>
                <div style={{ fontFamily: "Inter", fontSize: "11px", color: C.gray, textAlign: "center" }}>
                  Original take — slash trails behind on the left
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <TMark size={140} variant="light" flip={true} />
                <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "16px", color: C.white }}>
                  V2 · SLASH RIGHT (FLIPPED)
                </div>
                <div style={{ fontFamily: "Inter", fontSize: "11px", color: C.gray, textAlign: "center" }}>
                  Motion runs forward, slash leads the way
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center gap-3 p-6 rounded-md" style={{ background: "#111116" }}>
              <TMark size={100} variant="light" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>
                T · MONOGRAM
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 p-6 rounded-md" style={{ background: C.blue }}>
              <TMark size={100} variant="dark" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.white }}>
                MONOGRAM · BLUE
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 p-6 rounded-md" style={{ background: "#111116" }}>
              <ShieldLogo size={110} />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>
                SHIELD · SCOREBOARD
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-md" style={{ background: "#111116" }}>
              <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "38px", color: C.white, lineHeight: 1, letterSpacing: "0.02em" }}>
                THE<br />TICKER
              </div>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>
                WORDMARK
              </div>
            </div>
          </div>

          {/* App icon strip */}
          <div className="mt-6 flex items-center gap-3">
            <div className="rounded-2xl flex items-center justify-center" style={{ background: C.black, width: 84, height: 84, border: `2px solid ${C.blue}` }}>
              <TMark size={48} variant="light" />
            </div>
            <div className="rounded-2xl flex items-center justify-center" style={{ background: C.blue, width: 84, height: 84 }}>
              <TMark size={48} variant="dark" />
            </div>
            <div className="rounded-2xl flex items-center justify-center" style={{ background: C.white, width: 84, height: 84 }}>
              <TMark size={48} variant="dark" />
            </div>
            <div className="ml-4" style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "10px", color: C.silver, letterSpacing: "0.28em" }}>
              APP ICONS ·<br />DARK / BLUE / LIGHT
            </div>
          </div>
        </Section>

        {/* 2 · PALETTE */}
        <Section number="02" title="COLOR PALETTE">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Swatch label="TICKER BLUE" hex={C.blue} />
            <Swatch label="ICE WHITE" hex={C.white} />
            <Swatch label="NIGHT BLACK" hex={C.black} />
            <Swatch label="STEEL GRAY" hex={C.gray} />
            <Swatch label="PUCK SILVER" hex={C.silver} />
          </div>
        </Section>

        {/* 3 · TYPOGRAPHY */}
        <Section number="03" title="TYPOGRAPHY">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-md" style={{ background: "#111116" }}>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }}>HEADLINE</div>
              <div className="mt-2" style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "38px", color: C.white, lineHeight: 1 }}>
                ALL CAPS.<br />ALL IN.
              </div>
              <div className="mt-3" style={{ fontFamily: "Inter", fontSize: "10px", color: C.gray }}>Rajdhani Bold</div>
            </div>
            <div className="p-6 rounded-md" style={{ background: "#111116" }}>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }}>ACCENT</div>
              <div className="mt-2" style={{ fontFamily: "Oswald", fontWeight: 600, fontSize: "22px", color: C.blue, letterSpacing: "0.06em" }}>
                FAST. SHARP. UNFILTERED.
              </div>
              <div className="mt-3" style={{ fontFamily: "Inter", fontSize: "10px", color: C.gray }}>Oswald SemiBold</div>
            </div>
            <div className="p-6 rounded-md" style={{ background: "#111116" }}>
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }}>BODY</div>
              <div className="mt-2" style={{ fontFamily: "Inter", fontSize: "14px", color: C.white, lineHeight: 1.55 }}>
                Clean, easy to read, built for every screen. Used for body copy, UI text, and long-form content.
              </div>
              <div className="mt-3" style={{ fontFamily: "Inter", fontSize: "10px", color: C.gray }}>Inter Regular</div>
            </div>
          </div>
        </Section>

        {/* 4 · SUB-BRANDS */}
        <Section number="04" title="SUB-BRAND FEATURE MARKS">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="ASK OUR" subtitle="ANALYST · 1-ON-1" tone="black" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>PRESSER</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="THE DEBATE" subtitle="HEAD-TO-HEAD TAKES" tone="black" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>NEW SEGMENT</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="CALL IT" subtitle="MAKE YOUR PICKS" tone="blue" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>PREDICTIONS</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="BREAKING NEWS" tone="blue" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>GOAL ALERT</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="TICKER FANTASY" tone="black" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>FANTASY</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="LEADERBOARD" subtitle="SEASON COMPETITION" tone="black" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>SCORECARD</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FeatureMark title="COMMUNITY" subtitle="ZONE" tone="blue" />
              <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.silver }}>SOCIAL LAYER</div>
            </div>
          </div>
        </Section>

        {/* 5 · IN-APP PREVIEWS */}
        <Section number="05" title="APPLIED · WHERE THIS SHOWS UP">
          {/* Lower-third pill */}
          <div className="mb-8">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }} className="mb-3">
              A. RECAP/SHOW · LOWER-THIRD NAMETAG PILL
            </div>
            <div className="flex flex-wrap items-center gap-4 p-6 rounded-md" style={{ background: "#111116" }}>
              <LowerThird speaker="REGGIE HARLOW" role="COLOR · LIVE" />
              <LowerThird speaker="MARC COLLINS" role="ANALYST · LIVE" />
              <div style={{ fontFamily: "Inter", fontSize: "11px", color: C.gray, maxWidth: 240 }}>
                Replaces the current amber pill — sits bottom-left on the broadcast frame, ties every host mention back to the T mark.
              </div>
            </div>
          </div>

          {/* Breaking News bar */}
          <div className="mb-8">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }} className="mb-3">
              B. SCOREBOARD · BREAKING-NEWS GOAL ALERT
            </div>
            <BreakingNewsBar />
            <div className="mt-3" style={{ fontFamily: "Inter", fontSize: "11px", color: C.gray }}>
              Replaces the current red-light bar. The "BREAKING" pulse stays, but the middle is now bright, dense, on-brand.
            </div>
          </div>

          {/* Nav pills preview */}
          <div className="mb-8">
            <div style={{ fontFamily: "Oswald", fontWeight: 500, fontSize: "9px", letterSpacing: "0.28em", color: C.blue }} className="mb-3">
              C. NAV · RENAMED TABS WITH SUB-BRAND WEIGHT
            </div>
            <div className="flex flex-wrap gap-2 p-4 rounded-md" style={{ background: "#111116" }}>
              {[
                { label: "RECAP", active: true },
                { label: "SHOW" },
                { label: "SCORES" },
                { label: "PRESSER" },
                { label: "STATS" },
                { label: "CALL IT" }, // was "PREDICT"
              ].map((t) => (
                <div
                  key={t.label}
                  className="px-4 py-2 rounded-full border"
                  style={{
                    background: t.active ? C.blue : "transparent",
                    borderColor: t.active ? C.blue : "rgba(255,255,255,0.15)",
                    color: t.active ? C.white : C.silver,
                    fontFamily: "Oswald",
                    fontWeight: 500,
                    fontSize: "11px",
                    letterSpacing: "0.28em",
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 6 · TAGLINES */}
        <Section number="06" title="TAGLINES">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              "All your hockey info. One chirp away.",
              "No Intermission.",
              "We don't agree on much — except you should be watching.",
            ].map((t) => (
              <div key={t} className="p-6 rounded-md border" style={{ borderColor: C.blue, background: "#0d0d13" }}>
                <div style={{ fontFamily: "Rajdhani", fontWeight: 600, fontSize: "22px", color: C.white, lineHeight: 1.25 }}>
                  "{t}"
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Feedback bar */}
        <div className="mt-16 p-6 rounded-md border" style={{ borderColor: C.blue, background: "#0d0d13" }}>
          <div style={{ fontFamily: "Rajdhani", fontWeight: 700, fontSize: "22px", color: C.white }}>
            YOUR CALL
          </div>
          <div className="mt-2" style={{ fontFamily: "Inter", fontSize: "13px", color: C.silver, lineHeight: 1.6 }}>
            Every logo, sub-brand mark, and application above is production-ready SVG — no external assets required.
            If the vibe and quality feel right, we can promote this system into the live app in ~2 hours (color migration + header swap + nametag pill + goal-alert rebrand).
            If a specific shape (e.g., the T-slash angle, the shield contour) needs to change, tell me and I'll adjust <em>this</em> page first for another review.
          </div>
        </div>
      </div>
    </div>
  );
}
